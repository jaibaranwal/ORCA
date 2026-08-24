import json
import os
from typing import Dict, Any, List
from models.schemas import MarineConditions, ZoneInfo, DecisionResult

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")
THRESHOLDS_FILE = os.path.join(CONFIG_DIR, "thresholds.json")

def load_thresholds() -> Dict[str, Any]:
    if os.path.exists(THRESHOLDS_FILE):
        with open(THRESHOLDS_FILE, "r") as f:
            return json.load(f)
    return {
        "wave_height_safe_m": 1.5,
        "wave_height_caution_m": 2.5,
        "wind_speed_safe_kmh": 30.0,
        "wind_speed_caution_kmh": 50.0,
        "current_speed_caution_ms": 1.0,
        "visibility_min_km": 2.0,
        "score_go_threshold": 75,
        "score_caution_threshold": 50,
        "weights": {
            "safety": 0.50,
            "fishing": 0.30,
            "effort": 0.20
        }
    }

def evaluate_decision(
    zone: ZoneInfo,
    conditions: MarineConditions,
    boundary_violations: List[str] = None
) -> DecisionResult:
    """
    Deterministic Decision Engine.
    Evaluates safety conditions, fishing potential (PFZ), and travel effort against thresholds.
    NOTE: Gemini is NEVER used for safety-critical decisions. This module is 100% deterministic code.
    """
    thresholds = load_thresholds()
    weights = thresholds.get("weights", {"safety": 0.50, "fishing": 0.30, "effort": 0.20})
    reasons = []

    # -------------------------------------------------------------
    # TIER 1: HARD STOPS (Immediate WAIT, overrides all scores)
    # -------------------------------------------------------------
    has_boundary_violation = bool(boundary_violations and len(boundary_violations) > 0)
    if has_boundary_violation:
        for v in boundary_violations:
            reasons.append(f"⛔ RESTRICTED BOUNDARY: {v}")
        return DecisionResult(
            zone_id=zone.zone_id,
            zone_name=zone.zone_name,
            status="WAIT",
            score=0,
            safety_score=0,
            fishing_score=zone.pfz_score,
            effort_score=0,
            boundary_violation=True,
            hard_stop=True,
            reasons=reasons,
            explanation=f"Vessel venture strictly prohibited: Boundary restriction detected in {zone.zone_name}.",
            conditions=conditions,
            thresholds_used=thresholds,
            data_source=conditions.data_source
        )

    if conditions.cyclone_alert:
        reasons.append("⛔ CYCLONE ALERT: Active severe weather alert issued by maritime authorities.")
        return DecisionResult(
            zone_id=zone.zone_id,
            zone_name=zone.zone_name,
            status="WAIT",
            score=0,
            safety_score=0,
            fishing_score=zone.pfz_score,
            effort_score=0,
            boundary_violation=False,
            hard_stop=True,
            reasons=reasons,
            explanation="Severe cyclone advisory active. All fishing operations must be suspended.",
            conditions=conditions,
            thresholds_used=thresholds,
            data_source=conditions.data_source
        )

    if conditions.lightning_alert:
        reasons.append("⚡ LIGHTNING WARNING: Severe thunderstorm activity detected in maritime cell.")
        return DecisionResult(
            zone_id=zone.zone_id,
            zone_name=zone.zone_name,
            status="WAIT",
            score=20,
            safety_score=10,
            fishing_score=zone.pfz_score,
            effort_score=50,
            boundary_violation=False,
            hard_stop=True,
            reasons=reasons,
            explanation="High risk of lightning strikes on open water. Delay departure until storm passes.",
            conditions=conditions,
            thresholds_used=thresholds,
            data_source=conditions.data_source
        )

    if conditions.wave_height_m >= 4.0:
        reasons.append(f"🌊 EXTREME SEA STATE: Wave height {conditions.wave_height_m}m exceeds critical safety threshold (4.0m).")
        return DecisionResult(
            zone_id=zone.zone_id,
            zone_name=zone.zone_name,
            status="WAIT",
            score=15,
            safety_score=0,
            fishing_score=zone.pfz_score,
            effort_score=30,
            boundary_violation=False,
            hard_stop=True,
            reasons=reasons,
            explanation=f"Dangerous sea state with wave heights of {conditions.wave_height_m}m. Sea venture unsafe.",
            conditions=conditions,
            thresholds_used=thresholds,
            data_source=conditions.data_source
        )

    # -------------------------------------------------------------
    # TIER 2: DETAILED SAFETY SCORING (0-100)
    # -------------------------------------------------------------
    wave_safe = thresholds.get("wave_height_safe_m", 1.5)
    wave_caution = thresholds.get("wave_height_caution_m", 2.5)
    wind_safe = thresholds.get("wind_speed_safe_kmh", 30.0)
    wind_caution = thresholds.get("wind_speed_caution_kmh", 50.0)
    current_caution = thresholds.get("current_speed_caution_ms", 1.0)
    vis_min = thresholds.get("visibility_min_km", 2.0)

    has_caution_factor = False
    has_unsafe_factor = False

    # 1. Wave Height Score
    if conditions.wave_height_m <= wave_safe:
        wave_score = 100
        reasons.append(f"✓ Wave height {conditions.wave_height_m}m is calm and safe (<= {wave_safe}m).")
    elif conditions.wave_height_m <= wave_caution:
        wave_score = 60
        has_caution_factor = True
        reasons.append(f"⚠️ Wave height {conditions.wave_height_m}m is moderate ({wave_safe}m - {wave_caution}m). Exercise caution.")
    else:
        wave_score = 10
        has_unsafe_factor = True
        reasons.append(f"⚠️ Wave height {conditions.wave_height_m}m is rough (exceeds {wave_caution}m limit).")

    # 2. Wind Speed Score
    if conditions.wind_speed_kmh <= wind_safe:
        wind_score = 100
        reasons.append(f"✓ Wind speed {conditions.wind_speed_kmh} km/h is favourable (<= {wind_safe} km/h).")
    elif conditions.wind_speed_kmh <= wind_caution:
        wind_score = 55
        has_caution_factor = True
        reasons.append(f"⚠️ Wind speed {conditions.wind_speed_kmh} km/h is gusty ({wind_safe}-{wind_caution} km/h).")
    else:
        wind_score = 10
        has_unsafe_factor = True
        reasons.append(f"⚠️ Wind speed {conditions.wind_speed_kmh} km/h is high (exceeds {wind_caution} km/h).")

    # 3. Ocean Current Score
    if conditions.current_speed_ms <= current_caution:
        current_score = 100
        reasons.append(f"✓ Ocean current velocity {conditions.current_speed_ms} m/s is mild.")
    else:
        current_score = 40
        has_caution_factor = True
        reasons.append(f"⚠️ Ocean drift current {conditions.current_speed_ms} m/s is strong (> {current_caution} m/s).")

    # 4. Visibility Score
    if conditions.visibility_km >= 5.0:
        vis_score = 100
        reasons.append(f"✓ Navigational visibility {conditions.visibility_km} km is clear.")
    elif conditions.visibility_km >= vis_min:
        vis_score = 60
        has_caution_factor = True
        reasons.append(f"⚠️ Visibility reduced to {conditions.visibility_km} km.")
    else:
        vis_score = 20
        has_unsafe_factor = True
        reasons.append(f"⚠️ Poor visibility {conditions.visibility_km} km (< {vis_min} km limit).")

    safety_score = int(round((wave_score * 0.40) + (wind_score * 0.30) + (current_score * 0.15) + (vis_score * 0.15)))

    # -------------------------------------------------------------
    # TIER 3: FISHING POTENTIAL SCORE (0-100)
    # -------------------------------------------------------------
    fishing_score = int(zone.pfz_score)
    if fishing_score >= 80:
        reasons.append(f"✓ High Potential Fishing Zone (PFZ Score {fishing_score}/100, SST {conditions.sst_celsius}°C).")
    elif fishing_score >= 60:
        reasons.append(f"✓ Moderate Fishing Potential (PFZ Score {fishing_score}/100).")
    else:
        reasons.append(f"⚠️ Low Fishing Potential detected (PFZ Score {fishing_score}/100).")

    # -------------------------------------------------------------
    # TIER 4: TRAVEL / ECONOMIC EFFORT SCORE (0-100)
    # -------------------------------------------------------------
    dist = zone.distance_km
    if dist <= 20.0:
        effort_score = 100
        reasons.append(f"✓ Distance {dist} km is short with low fuel burn.")
    elif dist <= 45.0:
        effort_score = 75
        reasons.append(f"✓ Distance {dist} km is moderate.")
    elif dist <= 80.0:
        effort_score = 45
        reasons.append(f"⚠️ Long travel distance {dist} km requires significant fuel commitment.")
    else:
        effort_score = 20
        reasons.append(f"⚠️ Distant zone {dist} km with heavy fuel expenditure.")

    # -------------------------------------------------------------
    # FINAL WEIGHTED EVALUATION & STATUS DETERMINATION
    # -------------------------------------------------------------
    final_score = int(round(
        (safety_score * weights.get("safety", 0.50)) +
        (fishing_score * weights.get("fishing", 0.30)) +
        (effort_score * weights.get("effort", 0.20))
    ))

    # Priority Rule Overrides
    if has_unsafe_factor or safety_score < 40:
        status = "WAIT"
        reasons.insert(0, "🛑 OVERRIDE: Unsafe meteorological or ocean state overrides fishing opportunities.")
    elif has_caution_factor:
        status = "CAUTION"
        reasons.insert(0, "⚠️ CAUTION: Marginal sea/weather parameters detected. Heightened vigilance required.")
    elif final_score >= thresholds.get("score_go_threshold", 75) and safety_score >= 85:
        status = "GO"
    elif final_score >= thresholds.get("score_caution_threshold", 50):
        status = "CAUTION"
    else:
        status = "WAIT"

    explanation = f"{zone.zone_name} evaluated as {status} (Score {final_score}/100) based on Safety {safety_score}%, Fishing Potential {fishing_score}%, and Travel Effort {effort_score}%."

    return DecisionResult(
        zone_id=zone.zone_id,
        zone_name=zone.zone_name,
        status=status,
        score=final_score,
        safety_score=safety_score,
        fishing_score=fishing_score,
        effort_score=effort_score,
        boundary_violation=False,
        hard_stop=False,
        reasons=reasons,
        explanation=explanation,
        conditions=conditions,
        thresholds_used=thresholds,
        data_source=conditions.data_source
    )
