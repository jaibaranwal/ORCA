import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple

from models.schemas import (
    DecisionObject,
    DecisionResult,
    DecisionSnapshot,
    MarineConditions,
    ChangedFactor,
    ChangeHistoryEntry,
    RecheckResponse,
    GeoLocation
)
from modules.decision_store import get_decision, save_decision
from modules.decision_engine import evaluate_decision, load_thresholds
from modules.data_collection import collect_marine_conditions, calculate_haversine_distance
from adapters.pfz_adapter import PFZAdapter
from adapters.boundary_adapter import BoundaryAdapter
from modules.explanation import explain_decision

logger = logging.getLogger("orca.decision_watch")

pfz_adapter = PFZAdapter()
boundary_adapter = BoundaryAdapter()

def detect_meaningful_changes(
    orig_cond: Dict[str, Any],
    curr_cond: MarineConditions,
    orig_dec: Dict[str, Any],
    curr_dec: DecisionResult,
    thresholds: Dict[str, Any]
) -> Tuple[bool, List[ChangedFactor], str]:
    """
    Deterministic Change Detection & Impact Analyzer.
    Determines if new conditions cross safety thresholds or alter the decision validity.
    """
    changed_factors: List[ChangedFactor] = []
    affected = False

    wave_safe = thresholds.get("wave_height_safe_m", 1.5)
    wave_caution = thresholds.get("wave_height_caution_m", 2.5)
    wind_safe = thresholds.get("wind_speed_safe_kmh", 30.0)
    wind_caution = thresholds.get("wind_speed_caution_kmh", 50.0)
    current_caution = thresholds.get("current_speed_caution_ms", 1.0)
    vis_min = thresholds.get("visibility_min_km", 2.0)

    # 1. Wave Height Check
    orig_wave = float(orig_cond.get("wave_height_m", 1.4))
    curr_wave = float(curr_cond.wave_height_m)
    orig_wave_cat = "safe" if orig_wave <= wave_safe else "caution" if orig_wave <= wave_caution else "unsafe"
    curr_wave_cat = "safe" if curr_wave <= wave_safe else "caution" if curr_wave <= wave_caution else "unsafe"

    if curr_wave_cat != orig_wave_cat or abs(curr_wave - orig_wave) >= 0.5:
        crossed = curr_wave > wave_caution if orig_wave <= wave_caution else curr_wave > wave_safe
        impact_desc = "Wave height increased significantly and crossed safety limit" if crossed else f"Wave height shifted from {orig_wave}m to {curr_wave}m"
        changed_factors.append(ChangedFactor(
            factor="Wave Height",
            field_name="wave_height_m",
            previous_value=orig_wave,
            current_value=curr_wave,
            threshold_value=wave_caution,
            threshold_crossed=crossed,
            impact=impact_desc
        ))
        if curr_wave > wave_caution:
            affected = True

    # 2. Wind Speed Check
    orig_wind = float(orig_cond.get("wind_speed_kmh", 12.0))
    curr_wind = float(curr_cond.wind_speed_kmh)
    orig_wind_cat = "safe" if orig_wind <= wind_safe else "caution" if orig_wind <= wind_caution else "unsafe"
    curr_wind_cat = "safe" if curr_wind <= wind_safe else "caution" if curr_wind <= wind_caution else "unsafe"

    if curr_wind_cat != orig_wind_cat or abs(curr_wind - orig_wind) >= 15.0:
        crossed = curr_wind > wind_caution if orig_wind <= wind_caution else curr_wind > wind_safe
        changed_factors.append(ChangedFactor(
            factor="Wind Speed",
            field_name="wind_speed_kmh",
            previous_value=orig_wind,
            current_value=curr_wind,
            threshold_value=wind_caution,
            threshold_crossed=crossed,
            impact="Wind speed escalated into hazardous range" if crossed else f"Wind changed from {orig_wind} to {curr_wind} km/h"
        ))
        if curr_wind > wind_caution:
            affected = True

    # 3. Ocean Current Check
    orig_curr = float(orig_cond.get("current_speed_ms", 0.3))
    curr_curr = float(curr_cond.current_speed_ms)
    if (orig_curr <= current_caution and curr_curr > current_caution) or abs(curr_curr - orig_curr) >= 0.6:
        crossed = curr_curr > current_caution
        changed_factors.append(ChangedFactor(
            factor="Ocean Current Velocity",
            field_name="current_speed_ms",
            previous_value=orig_curr,
            current_value=curr_curr,
            threshold_value=current_caution,
            threshold_crossed=crossed,
            impact=f"Ocean drift current velocity increased to {curr_curr} m/s"
        ))
        if crossed:
            affected = True

    # 4. Visibility Check
    orig_vis = float(orig_cond.get("visibility_km", 10.0))
    curr_vis = float(curr_cond.visibility_km)
    if (orig_vis >= vis_min and curr_vis < vis_min) or abs(curr_vis - orig_vis) >= 4.0:
        crossed = curr_vis < vis_min
        changed_factors.append(ChangedFactor(
            factor="Navigational Visibility",
            field_name="visibility_km",
            previous_value=orig_vis,
            current_value=curr_vis,
            threshold_value=vis_min,
            threshold_crossed=crossed,
            impact=f"Visibility dropped to {curr_vis} km"
        ))
        if crossed:
            affected = True

    # 5. Severe Weather & Lightning / Cyclone Checks
    if curr_cond.lightning_alert and not orig_cond.get("lightning_alert", False):
        changed_factors.append(ChangedFactor(
            factor="Lightning Warning",
            field_name="lightning_alert",
            previous_value=False,
            current_value=True,
            threshold_crossed=True,
            impact="Active lightning thunderstorm detected in maritime zone"
        ))
        affected = True

    if curr_cond.cyclone_alert and not orig_cond.get("cyclone_alert", False):
        changed_factors.append(ChangedFactor(
            factor="Cyclone Warning",
            field_name="cyclone_alert",
            previous_value=False,
            current_value=True,
            threshold_crossed=True,
            impact="Severe cyclone advisory active"
        ))
        affected = True

    # 6. Verdict Comparison Check
    orig_status = orig_dec.get("status", "GO")
    curr_status = curr_dec.status
    if orig_status != curr_status:
        if orig_status == "GO" and curr_status in ["CAUTION", "WAIT"]:
            affected = True
        elif orig_status == "CAUTION" and curr_status == "WAIT":
            affected = True

    # 7. Summary Construction
    if affected:
        summary = f"Decision affected: Conditions changed from {orig_status} to {curr_status}. Safety limits exceeded."
    elif len(changed_factors) > 0:
        summary = f"Minor condition updates detected, but decision remains {curr_status}."
    else:
        summary = f"Conditions verified stable. Original {orig_status} decision remains valid."

    return (affected, changed_factors, summary)

async def check_decision_conditions(
    decision_id: str,
    override_conditions: Optional[Dict[str, Any]] = None
) -> RecheckResponse:
    """
    Executes the Living Decision Watch Cycle:
    1. Loads saved Decision Object
    2. Gathers new conditions (or applies controlled demo overrides)
    3. Re-runs deterministic Decision Engine
    4. Compares against immutable original conditions
    5. Updates change history without corrupting original snapshot
    """
    raw_decision = get_decision(decision_id)
    if not raw_decision:
        raise ValueError(f"Decision '{decision_id}' not found in database.")

    zone_id = raw_decision["mission"]["zone_id"]
    origin_dict = raw_decision["user"]["origin"]
    origin = GeoLocation(
        lat=origin_dict.get("lat", 9.966),
        lon=origin_dict.get("lon", 76.267),
        name=origin_dict.get("name", "Kochi Port")
    )

    zone_info = pfz_adapter.get_zone_info(zone_id)
    if not zone_info:
        raise ValueError(f"Zone '{zone_id}' not found.")

    zone_info.distance_km = calculate_haversine_distance(
        origin.lat, origin.lon,
        zone_info.centroid.lat, zone_info.centroid.lon
    )

    # 1. Gather latest conditions
    new_conditions = await collect_marine_conditions(
        zone_info.centroid.lat,
        zone_info.centroid.lon,
        zone_id=zone_id,
        origin_lat=origin.lat,
        origin_lon=origin.lon
    )

    # 2. Inject Controlled Demo Overrides if provided
    if override_conditions:
        cond_dict = new_conditions.model_dump()
        cond_dict.update(override_conditions)
        cond_dict["data_source"] = "demo_simulation"
        new_conditions = MarineConditions(**cond_dict)

    # 3. Check boundaries
    is_violated_pt, pt_reasons = boundary_adapter.check_point_boundary(
        zone_info.centroid.lat, zone_info.centroid.lon
    )
    is_violated_poly, poly_reasons = boundary_adapter.check_polygon_boundary(
        zone_info.polygon or []
    )
    all_violations = pt_reasons + poly_reasons

    # 4. Re-run EXISTING deterministic decision engine
    new_eval_result = evaluate_decision(
        zone=zone_info,
        conditions=new_conditions,
        boundary_violations=all_violations
    )

    # 5. Compare old vs new
    orig_dec = raw_decision["original_decision"]
    orig_cond = raw_decision["original_conditions"]
    thresholds = raw_decision.get("thresholds_snapshot", load_thresholds())

    affected, changed_factors, summary = detect_meaningful_changes(
        orig_cond=orig_cond,
        curr_cond=new_conditions,
        orig_dec=orig_dec,
        curr_dec=new_eval_result,
        thresholds=thresholds
    )

    # 6. Generate grounded explanation
    lang = raw_decision.get("user", {}).get("language", "en")
    is_hindi = lang in ["hi", "hinglish"]

    if affected:
        changed_details = ", ".join([f"{f.factor} {f.previous_value} -> {f.current_value}" for f in changed_factors])
        if is_hindi:
            explanation_text = f"⚠️ Alert: {raw_decision['mission']['zone_name']} ke conditions badal gaye hain ({changed_details}). Original {orig_dec['status']} plan ab suitable nahi hai. Current status: {new_eval_result.status}."
        else:
            explanation_text = f"⚠️ Alert: Conditions for {raw_decision['mission']['zone_name']} have changed ({changed_details}). The original {orig_dec['status']} recommendation is no longer safe. Current status is {new_eval_result.status}."
    else:
        if is_hindi:
            explanation_text = f"✓ {raw_decision['mission']['zone_name']} ke conditions recheck kiye gaye hain. Sea state stable hai aur original {orig_dec['status']} decision valid hai."
        else:
            explanation_text = f"✓ Conditions rechecked for {raw_decision['mission']['zone_name']}. Sea state is stable and the original {orig_dec['status']} plan remains valid."

    # 7. Update Decision Object State without corrupting original snapshot
    now_iso = datetime.utcnow().isoformat() + "Z"
    new_lifecycle_status = "ALERT" if affected else "TRACKING"

    history_entry = ChangeHistoryEntry(
        checked_at=now_iso,
        previous_status=orig_dec["status"],
        new_status=new_eval_result.status,
        previous_score=orig_dec["score"],
        new_score=new_eval_result.score,
        affected=affected,
        changed_factors=changed_factors,
        summary=summary,
        explanation=explanation_text,
        conditions_snapshot=new_conditions
    )

    history_list = raw_decision.get("change_history", [])
    history_list.insert(0, history_entry.model_dump())

    raw_decision["last_checked_at"] = now_iso
    raw_decision["updated_at"] = now_iso
    raw_decision["lifecycle_status"] = new_lifecycle_status
    raw_decision["current_status"] = new_eval_result.status if not affected else "ALERT"
    raw_decision["latest_decision"] = DecisionSnapshot(
        status=new_eval_result.status,
        score=new_eval_result.score,
        safety_score=new_eval_result.safety_score,
        fishing_score=new_eval_result.fishing_score,
        effort_score=new_eval_result.effort_score,
        boundary_violation=new_eval_result.boundary_violation,
        hard_stop=new_eval_result.hard_stop,
        reasons=new_eval_result.reasons,
        explanation=explanation_text
    ).model_dump()
    raw_decision["latest_conditions"] = new_conditions.model_dump()
    raw_decision["change_history"] = history_list

    save_decision(raw_decision)
    updated_obj = DecisionObject(**raw_decision)

    return RecheckResponse(
        decision_id=decision_id,
        affected=affected,
        previous_status=orig_dec["status"],
        current_status=new_eval_result.status,
        previous_score=orig_dec["score"],
        current_score=new_eval_result.score,
        changed_factors=changed_factors,
        summary=summary,
        explanation=explanation_text,
        last_checked_at=now_iso,
        decision=updated_obj
    )
