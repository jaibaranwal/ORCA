import os
import json
import logging
import httpx
from typing import Dict, Any, Optional, List
from models.schemas import DecisionResult

logger = logging.getLogger("orca.explanation")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

SYSTEM_EXPLANATION_PROMPT = """You are ORCA's conversational explanation assistant for Indian fishermen.
Your job is to explain the system's deterministic marine decision in simple, clear, and direct natural language.

CRITICAL CONSTRAINTS:
1. You MUST ONLY use the exact facts, numbers, and reasons provided in the input payload.
2. DO NOT invent any weather values, wave heights, wind speeds, distances, boundaries, or fishing potential.
3. DO NOT change or override the verdict (GO, CAUTION, or WAIT).
4. Keep the response concise (2 to 3 sentences maximum).
5. Match the user's language:
   - If language is 'hi' or 'hinglish', respond in natural conversational Hinglish/Hindi.
   - If language is 'en', respond in clear professional English.
"""

async def generate_gemini_explanation(
    decision_data: Dict[str, Any], 
    language: str = "en",
    context_type: str = "single_zone"
) -> Optional[str]:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None

    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    prompt_content = f"{SYSTEM_EXPLANATION_PROMPT}\n\nLanguage Requested: {language}\nContext: {context_type}\nDecision Data: {json.dumps(decision_data, indent=2)}"

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt_content}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 250
        }
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(api_url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                return text
            else:
                logger.warning(f"Gemini Explanation API error ({resp.status_code}): {resp.text}")
    except Exception as e:
        logger.warning(f"Gemini Explanation failed: {e}. Falling back to deterministic explanation.")

    return None

def generate_deterministic_explanation(
    decision_data: Dict[str, Any], 
    language: str = "en",
    context_type: str = "single_zone"
) -> str:
    """
    High-quality deterministic fallback explanation in English or Hinglish/Hindi.
    Ensures 100% demo reliability without external network dependency.
    """
    status = decision_data.get("status", "CAUTION")
    zone_name = decision_data.get("zone_name", "Target Zone")
    score = decision_data.get("score", 75)
    conditions = decision_data.get("conditions", {})
    wave = conditions.get("wave_height_m", 1.4)
    wind = conditions.get("wind_speed_kmh", 15.0)
    pfz = decision_data.get("fishing_score", 80)
    is_hard_stop = decision_data.get("hard_stop", False)

    is_hindi = language in ["hi", "hinglish"]

    if context_type == "monitor_request":
        if is_hindi:
            return f"Abhi {zone_name} ke liye status {status} (Score {score}/100) hai. Wave height {wave}m aur wind {wind} km/h hai. Continuous monitoring agle Phase (Decision Watch) mein live check hoga."
        return f"{zone_name} is currently evaluated as {status} (Score: {score}/100) with waves at {wave}m. Persistent monitoring will track conditions until suitable."

    if is_hard_stop or status == "WAIT":
        if is_hindi:
            return f"⚠️ {zone_name} ke liye abhi WAIT recommendation hai. Wave height {wave}m ya boundary/weather restrictions ki wajah se safar unsafe hai. Sea venture suspend karein."
        return f"⚠️ {zone_name} is currently rated WAIT. Sea conditions (wave: {wave}m) or safety restrictions make venturing out unsafe at this time."

    if status == "GO":
        if is_hindi:
            return f"🟢 {zone_name} ke liye GO recommendation hai (Score: {score}/100). Wave height {wave}m safe hai aur fishing potential ({pfz}/100) high hai. Aap kal subah ja sakte hain."
        return f"🟢 {zone_name} is RECOMMENDED (GO, Score: {score}/100). Sea conditions are calm (wave: {wave}m, wind: {wind} km/h) and fishing potential is strong ({pfz}/100)."

    # CAUTION status
    if is_hindi:
        return f"🟡 Abhi {zone_name} ke liye CAUTION hai (Score: {score}/100). Fishing potential ({pfz}/100) achha hai, lekin wave conditions ({wave}m) moderate hain. Extra vigilance ke saath proceed karein."
    return f"🟡 {zone_name} is evaluated as CAUTION (Score: {score}/100). Fishing potential is favourable ({pfz}/100), but sea state is moderate with {wave}m waves. Heightened caution is advised."

async def explain_decision(
    decision: DecisionResult, 
    language: str = "en",
    context_type: str = "single_zone"
) -> str:
    """
    Main explanation orchestrator:
    1. Tries Gemini with strict grounded prompt.
    2. Falls back to deterministic multi-language template on failure.
    """
    payload = {
        "zone_name": decision.zone_name,
        "status": decision.status,
        "score": decision.score,
        "safety_score": decision.safety_score,
        "fishing_score": decision.fishing_score,
        "effort_score": decision.effort_score,
        "hard_stop": decision.hard_stop,
        "boundary_violation": decision.boundary_violation,
        "reasons": decision.reasons,
        "conditions": {
            "wave_height_m": decision.conditions.wave_height_m,
            "wind_speed_kmh": decision.conditions.wind_speed_kmh,
            "visibility_km": decision.conditions.visibility_km,
            "current_speed_ms": decision.conditions.current_speed_ms,
            "data_source": decision.conditions.data_source
        }
    }

    gemini_exp = await generate_gemini_explanation(payload, language=language, context_type=context_type)
    if gemini_exp:
        return gemini_exp

    return generate_deterministic_explanation(payload, language=language, context_type=context_type)

async def answer_conversational_query(
    query: str, 
    language: str = "en"
) -> str:
    """
    Answers general informational, maritime safety, or conversational questions.
    Uses Gemini when key is present, with rich deterministic marine knowledge fallback.
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    is_hindi = language in ["hi", "hinglish"]

    if api_key:
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        system_p = (
            "You are ORCA (Oceanic Resource & Marine Decision Intelligence), an AI assistant for Indian fishermen and coastal operators. "
            "Answer the user's question directly, clearly, and factually in 2 to 3 sentences. "
            f"Language: {'Hindi/Hinglish' if is_hindi else 'English'}. Be polite, factual, and helpful."
        )
        payload = {
            "contents": [
                {"parts": [{"text": f"{system_p}\n\nUser Question: {query}"}]}
            ],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 200}
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(api_url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            logger.warning(f"Conversational Gemini query failed: {e}")

    # Rich deterministic maritime knowledge fallback
    q_low = query.lower()
    if "pfz" in q_low:
        return (
            "PFZ (Potential Fishing Zone) INCOIS dwara satellite data (SST aur Chlorophyll) se identify kiya gaya ocean area hai jahan machli milne ki sambhavna sabse adhik hoti hai."
            if is_hindi else
            "PFZ (Potential Fishing Zone) refers to high-productivity ocean zones identified via satellite data (Sea Surface Temperature and Chlorophyll) where fish aggregation is highest."
        )
    elif "wave" in q_low or "lahar" in q_low:
        return (
            "ORCA mein 1.5m tak ki wave height Safe (GO), 1.5m-2.5m Caution, aur 2.5m se upar Unsafe (WAIT) mani jaati hai."
            if is_hindi else
            "ORCA considers wave heights up to 1.5m safe (GO), 1.5m to 2.5m moderate (CAUTION), and above 2.5m hazardous (WAIT) for small fishing craft."
        )
    elif "orca" in q_low or "who" in q_low or "kya hai" in q_low:
        return (
            "ORCA ek Living Marine Decision System hai jo aapko safe fishing zones recommend karta hai aur conditions badalne par aapke decision ko monitor aur repair karta hai."
            if is_hindi else
            "ORCA is a Living Marine Decision System that provides safe fishing recommendations, tracks your decision in real-time, and generates verified alternatives when sea conditions change."
        )
    else:
        return (
            "Aap ORCA se pooch sakte hain ki kal subah kahan fishing karni chahiye, kisi specific zone ki safety check kar sakte hain, ya map par sector click karke live weather dekh sakte hain."
            if is_hindi else
            "You can ask ORCA where to fish tomorrow, check if a specific sector is safe, or select any zone on the map to evaluate real-time weather and safety."
        )

