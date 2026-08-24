import os
import json
import re
import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger("orca.query_understanding")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

KNOWN_ZONES = {
    "zone a": "zone_a",
    "zone_a": "zone_a",
    "zone-a": "zone_a",
    "zone b": "zone_b",
    "zone_b": "zone_b",
    "zone-b": "zone_b",
    "zone c": "zone_c",
    "zone_c": "zone_c",
    "zone-c": "zone_c",
}

SYSTEM_PROMPT = """You are ORCA's Query Understanding parser for a marine decision support system.
Parse the user's marine/fishing query into a structured JSON object.

Extract:
- intent: "fishing_decision" | "safety_check" | "condition_query" | "zone_suitability" | "general_query"
- purpose: "fishing" | "transit" | "general"
- location: raw mentioned location or zone (e.g. "Zone B", "Zone A", or null)
- zone_id: normalized zone ID ("zone_a" | "zone_b" | "zone_c" | null)
- time_reference: e.g. "tomorrow morning", "now", "tomorrow", "today", or null
- language: "en" | "hi" | "hinglish"
- request_type: "recommendation" (wants best zone) | "evaluate" (asking about specific zone) | "condition" (asking about weather/sea) | "monitor_request" (asking when a zone will be suitable)
- needs_tracking: boolean (true if asking about ongoing monitoring or "kab suitable hoga")

CRITICAL RULES:
1. Return ONLY valid, raw JSON without markdown blocks or backticks.
2. DO NOT make any safety decisions or output any safety verdicts.
3. DO NOT output or invent any safety thresholds (e.g. wave limits).
4. If the user asks in Hindi or Hinglish, identify language as "hi" or "hinglish".
"""

async def parse_user_query_gemini(query: str, user_role: str = "fisherman") -> Optional[Dict[str, Any]]:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{SYSTEM_PROMPT}\n\nUser Query: \"{query}\""}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(
                f"{GEMINI_API_URL}?key={api_key}",
                json=payload
            )
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                # Clean up any potential markdown formatting
                cleaned_text = re.sub(r"^```json\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
                parsed = json.loads(cleaned_text)
                return parsed
            else:
                logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.warning(f"Gemini query understanding failed: {e}. Using deterministic fallback parser.")

    return None

def parse_user_query_deterministic(query: str, user_role: str = "fisherman") -> Dict[str, Any]:
    """
    Deterministic rule-based fallback parser for English, Hindi, and Hinglish.
    Ensures 100% demo stability even when offline or without an API key.
    """
    q_lower = query.lower()

    # Detect language
    is_hindi_hinglish = bool(re.search(r'\b(kal|subah|kahan|jaana|chahiye|kaisa|hai|hoga|machli|kab|batao|kripya|mein)\b', q_lower))
    lang = "hinglish" if is_hindi_hinglish else "en"

    # Identify Zone ID
    zone_id = None
    location = None
    for pattern, zid in KNOWN_ZONES.items():
        if pattern in q_lower:
            zone_id = zid
            location = zid.replace("_", " ").title()
            break

    # Identify Intent and Request Type
    if re.search(r'\b(kab|when|suitable|theek hoga)\b', q_lower):
        intent = "zone_suitability"
        request_type = "monitor_request"
        needs_tracking = True
    elif zone_id:
        if re.search(r'\b(safe|surakshit|jaana|chahiye|should i go|is it safe)\b', q_lower):
            intent = "safety_check"
            request_type = "evaluate"
        else:
            intent = "condition_query"
            request_type = "evaluate"
        needs_tracking = False
    else:
        # General recommendation ("Where to fish tomorrow?", "Kahan jaana chahiye?")
        intent = "fishing_decision"
        request_type = "recommendation"
        needs_tracking = False

    # Extract time reference
    time_ref = "now"
    if "kal subah" in q_lower or "tomorrow morning" in q_lower:
        time_ref = "tomorrow morning"
    elif "kal" in q_lower or "tomorrow" in q_lower:
        time_ref = "tomorrow"
    elif "today" in q_lower or "aaj" in q_lower:
        time_ref = "today"

    return {
        "intent": intent,
        "purpose": "fishing",
        "location": location,
        "zone_id": zone_id,
        "time_reference": time_ref,
        "language": lang,
        "request_type": request_type,
        "needs_tracking": needs_tracking,
        "raw_query": query,
        "parser": "deterministic_fallback"
    }

def validate_and_sanitize_intent(raw_intent: Dict[str, Any], query: str) -> Dict[str, Any]:
    """
    Validates and sanitizes Gemini output:
    1. Validates zone against allowed zones.
    2. Strips any unauthorized threshold injections.
    3. Normalizes request type.
    """
    # Zone normalization
    raw_zone = str(raw_intent.get("zone_id") or raw_intent.get("location") or "").lower().strip()
    clean_zone_id = None
    for k, v in KNOWN_ZONES.items():
        if k in raw_zone or v == raw_zone:
            clean_zone_id = v
            break

    request_type = raw_intent.get("request_type", "recommendation")
    if request_type not in ["recommendation", "evaluate", "condition", "monitor_request"]:
        request_type = "evaluate" if clean_zone_id else "recommendation"

    language = raw_intent.get("language", "en")
    if language not in ["en", "hi", "hinglish"]:
        language = "en"

    return {
        "intent": raw_intent.get("intent", "fishing_decision"),
        "purpose": "fishing",
        "location": clean_zone_id.replace("_", " ").title() if clean_zone_id else None,
        "zone_id": clean_zone_id,
        "time_reference": raw_intent.get("time_reference") or "tomorrow morning",
        "language": language,
        "request_type": request_type,
        "needs_tracking": bool(raw_intent.get("needs_tracking", False)),
        "raw_query": query,
        "parser": raw_intent.get("parser", "gemini")
    }

async def understand_user_query(query: str, user_role: str = "fisherman") -> Dict[str, Any]:
    """
    High-level entry point:
    1. Tries Gemini query understanding
    2. Falls back to deterministic parsing if needed
    3. Validates and sanitizes structure
    """
    gemini_result = await parse_user_query_gemini(query, user_role=user_role)
    if gemini_result:
        gemini_result["parser"] = "gemini"
        return validate_and_sanitize_intent(gemini_result, query)

    det_result = parse_user_query_deterministic(query, user_role=user_role)
    return validate_and_sanitize_intent(det_result, query)
