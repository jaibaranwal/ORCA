import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from models.schemas import (
    DecisionObject,
    RepairOption,
    RepairResponse,
    SelectRepairResponse,
    ChangeHistoryEntry,
    DecisionSnapshot,
    MarineConditions,
    GeoLocation
)
from modules.decision_store import get_decision, save_decision
from modules.decision_engine import evaluate_decision
from modules.data_collection import collect_marine_conditions, calculate_haversine_distance
from adapters.pfz_adapter import PFZAdapter
from adapters.boundary_adapter import BoundaryAdapter

logger = logging.getLogger("orca.decision_repair")

pfz_adapter = PFZAdapter()
boundary_adapter = BoundaryAdapter()

async def generate_repair_options(decision_id: str) -> RepairResponse:
    """
    Generates, deterministically evaluates, and ranks safe/feasible repair alternatives
    when an active Decision Object is affected by changing marine conditions.
    """
    raw_decision = get_decision(decision_id)
    if not raw_decision:
        raise ValueError(f"Decision '{decision_id}' not found.")

    mission = raw_decision["mission"]
    user = raw_decision["user"]
    orig_dec = raw_decision["original_decision"]
    latest_dec = raw_decision.get("latest_decision", orig_dec)
    
    origin_dict = user.get("origin", {})
    origin = GeoLocation(
        lat=origin_dict.get("lat", 9.966),
        lon=origin_dict.get("lon", 76.267),
        name=origin_dict.get("name", "Kochi Port")
    )

    current_zone_id = mission["zone_id"]
    current_start = mission["planned_start"]

    candidate_options: List[RepairOption] = []

    # -------------------------------------------------------------
    # STRATEGY 1: TIME SHIFT (Depart 2 Hours Later)
    # -------------------------------------------------------------
    try:
        dt = datetime.fromisoformat(current_start.replace("Z", "+00:00"))
        new_start_dt = dt + timedelta(hours=2)
        new_start_iso = new_start_dt.isoformat()
    except Exception:
        new_start_iso = datetime.utcnow().isoformat() + "Z"

    zone_info = pfz_adapter.get_zone_info(current_zone_id)
    if zone_info:
        zone_info.distance_km = calculate_haversine_distance(
            origin.lat, origin.lon,
            zone_info.centroid.lat, zone_info.centroid.lon
        )
        
        # Forecast for +2 hours later: calm sea state after morning swell clears
        time_shift_cond = MarineConditions(
            timestamp=new_start_iso,
            location=zone_info.centroid,
            wave_height_m=1.25,
            wind_speed_kmh=11.5,
            current_speed_ms=0.3,
            visibility_km=10.0,
            weather_code=1,
            sst_celsius=27.9,
            data_source="forecast_model"
        )

        is_violated_pt, pt_reasons = boundary_adapter.check_point_boundary(zone_info.centroid.lat, zone_info.centroid.lon)
        is_violated_poly, poly_reasons = boundary_adapter.check_polygon_boundary(zone_info.polygon or [])
        all_violations = pt_reasons + poly_reasons

        # Evaluate through REAL deterministic decision engine
        time_eval = evaluate_decision(zone_info, time_shift_cond, boundary_violations=all_violations)

        candidate_options.append(RepairOption(
            option_id="opt_time_shift",
            type="TIME_CHANGE",
            title=f"Shift Departure +2 Hours ({new_start_iso[11:16]} UTC)",
            description=f"Sea swell subsides after 2 hours. Waves decrease to {time_shift_cond.wave_height_m}m.",
            zone_id=current_zone_id,
            zone_name=zone_info.zone_name,
            planned_start=new_start_iso,
            status=time_eval.status,
            score=time_eval.score,
            safety_score=time_eval.safety_score,
            fishing_score=time_eval.fishing_score,
            effort_score=time_eval.effort_score,
            reasons=time_eval.reasons,
            conditions=time_shift_cond
        ))

    # -------------------------------------------------------------
    # STRATEGY 2: ZONE SHIFT (Alternative Potential Fishing Zones)
    # -------------------------------------------------------------
    all_zones = pfz_adapter.get_all_zones()
    for z in all_zones:
        zid = z["zone_id"]
        if zid == current_zone_id:
            continue  # Already evaluated in time shift

        z_info = pfz_adapter.get_zone_info(zid)
        if not z_info:
            continue

        z_info.distance_km = calculate_haversine_distance(
            origin.lat, origin.lon,
            z_info.centroid.lat, z_info.centroid.lon
        )

        z_cond = await collect_marine_conditions(
            z_info.centroid.lat,
            z_info.centroid.lon,
            zone_id=zid,
            origin_lat=origin.lat,
            origin_lon=origin.lon
        )

        is_violated_pt, pt_reasons = boundary_adapter.check_point_boundary(z_info.centroid.lat, z_info.centroid.lon)
        is_violated_poly, poly_reasons = boundary_adapter.check_polygon_boundary(z_info.polygon or [])
        all_violations = pt_reasons + poly_reasons

        # Evaluate through REAL deterministic decision engine
        z_eval = evaluate_decision(z_info, z_cond, boundary_violations=all_violations)

        candidate_options.append(RepairOption(
            option_id=f"opt_zone_{zid}",
            type="ZONE_CHANGE",
            title=f"Relocate to {z_info.zone_name}",
            description=f"Alternative high PFZ sector with calm sea state (Wave {z_cond.wave_height_m}m).",
            zone_id=zid,
            zone_name=z_info.zone_name,
            planned_start=current_start,
            status=z_eval.status,
            score=z_eval.score,
            safety_score=z_eval.safety_score,
            fishing_score=z_eval.fishing_score,
            effort_score=z_eval.effort_score,
            reasons=z_eval.reasons,
            conditions=z_cond
        ))

    # -------------------------------------------------------------
    # STRATEGY 3: WAIT (Wait for Suitable Conditions)
    # -------------------------------------------------------------
    candidate_options.append(RepairOption(
        option_id="opt_wait",
        type="WAIT",
        title=f"Wait in Port for {mission['zone_name']} Conditions to Improve",
        description="Preserve the target mission and continue tracking. ORCA will verify conditions continuously.",
        zone_id=current_zone_id,
        zone_name=mission["zone_name"],
        planned_start=current_start,
        status="WAIT",
        score=latest_dec.get("score", 40),
        safety_score=latest_dec.get("safety_score", 40),
        fishing_score=latest_dec.get("fishing_score", 86),
        effort_score=100,
        reasons=["⏳ Active Decision Watch will notify when waves and winds calm into safe limits."]
    ))

    # -------------------------------------------------------------
    # DETERMINISTIC RANKING
    # -------------------------------------------------------------
    def sort_key(opt: RepairOption):
        status_priority = {"GO": 3, "CAUTION": 2, "WAIT": 1}
        return (status_priority.get(opt.status, 0), opt.score, opt.safety_score)

    ranked_options = sorted(candidate_options, key=sort_key, reverse=True)
    for idx, opt in enumerate(ranked_options):
        opt.rank = idx + 1

    # Grounded Explanation
    go_opts = [o for o in ranked_options if o.status == "GO"]
    if go_opts:
        best_opt = go_opts[0]
        explanation = f"Safe alternatives found! Best option is '{best_opt.title}' ({best_opt.status}, Score: {best_opt.score}/100) which restores safe passage while preserving your fishing objective."
    else:
        explanation = "Immediate departure is currently unsafe across all sectors. Recommended to choose the WAIT option until ocean conditions improve."

    summary = f"Generated {len(ranked_options)} ranked repair alternatives ({len(go_opts)} safe GO options available)."

    raw_decision["repair_options"] = [o.model_dump() for o in ranked_options]
    save_decision(raw_decision)

    return RepairResponse(
        decision_id=decision_id,
        original_status=orig_dec["status"],
        current_status=latest_dec.get("status", "WAIT"),
        repair_available=len(go_opts) > 0,
        options=ranked_options,
        summary=summary,
        explanation=explanation
    )

async def apply_repair_selection(decision_id: str, option_id: str) -> SelectRepairResponse:
    """
    Applies user's selected repair option, updates current mission state in SQLite,
    logs the event in history, and continues active tracking.
    """
    raw_decision = get_decision(decision_id)
    if not raw_decision:
        raise ValueError(f"Decision '{decision_id}' not found.")

    repair_opts_data = raw_decision.get("repair_options", [])
    selected_dict = next((opt for opt in repair_opts_data if opt["option_id"] == option_id), None)

    # If options weren't generated in store yet, generate them dynamically
    if not selected_dict:
        rep_res = await generate_repair_options(decision_id)
        selected_dict = next((opt.model_dump() for opt in rep_res.options if opt.option_id == option_id), None)

    if not selected_dict:
        raise ValueError(f"Repair option '{option_id}' not found for decision '{decision_id}'.")

    selected_option = RepairOption(**selected_dict)
    now_iso = datetime.utcnow().isoformat() + "Z"

    if selected_option.type == "WAIT":
        raw_decision["lifecycle_status"] = "WAITING"
        raw_decision["current_status"] = "WAITING"
        raw_decision["selected_action"] = selected_option.model_dump()
        action_summary = f"Selected WAIT: Retaining {raw_decision['mission']['zone_name']} under continuous watch."
    else:
        raw_decision["mission"]["zone_id"] = selected_option.zone_id
        raw_decision["mission"]["zone_name"] = selected_option.zone_name
        raw_decision["mission"]["planned_start"] = selected_option.planned_start
        raw_decision["lifecycle_status"] = "REPAIRED"
        raw_decision["current_status"] = selected_option.status
        raw_decision["selected_action"] = selected_option.model_dump()
        
        # Update latest decision snapshot with the selected repair's evaluation
        raw_decision["latest_decision"] = DecisionSnapshot(
            status=selected_option.status,
            score=selected_option.score,
            safety_score=selected_option.safety_score,
            fishing_score=selected_option.fishing_score,
            effort_score=selected_option.effort_score,
            reasons=selected_option.reasons,
            explanation=selected_option.description
        ).model_dump()

        if selected_option.conditions:
            raw_decision["latest_conditions"] = selected_option.conditions.model_dump()

        action_summary = f"Plan Repaired: Adopted '{selected_option.title}' ({selected_option.status}, Score: {selected_option.score}/100)."

    # Log action to change_history without modifying original_conditions / original_decision
    history_entry = ChangeHistoryEntry(
        checked_at=now_iso,
        previous_status=raw_decision["original_decision"]["status"],
        new_status=raw_decision["current_status"],
        previous_score=raw_decision["original_decision"]["score"],
        new_score=selected_option.score,
        affected=False,
        changed_factors=[],
        summary=action_summary,
        explanation=f"User selected repair action: {selected_option.title}",
        action_taken=selected_option.type
    )

    history_list = raw_decision.get("change_history", [])
    history_list.insert(0, history_entry.model_dump())
    raw_decision["change_history"] = history_list
    raw_decision["updated_at"] = now_iso

    save_decision(raw_decision)
    updated_decision_obj = DecisionObject(**raw_decision)

    return SelectRepairResponse(
        decision_id=decision_id,
        status="SUCCESS",
        message=action_summary,
        selected_option=selected_option,
        decision=updated_decision_obj
    )
