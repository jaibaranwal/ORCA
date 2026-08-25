from fastapi import APIRouter, HTTPException, Query, Path, Body
from datetime import datetime
from typing import Optional, List, Dict, Any
import json
import os

from models.schemas import (
    HealthResponse, 
    DecisionRequest, 
    DecisionResult, 
    MarineConditions,
    GeoLocation,
    ZoneInfo,
    QueryRequest,
    QueryResponse,
    TrackDecisionRequest,
    TrackDecisionResponse,
    DecisionObject,
    RecheckRequest,
    RecheckResponse,
    RepairResponse,
    SelectRepairRequest,
    SelectRepairResponse,
    MissionFeedback,
    FeedbackResponse
)
from modules.decision_store import (
    create_and_store_decision,
    get_decision,
    list_decisions,
    cancel_decision,
    clear_decisions
)
from modules.data_collection import collect_marine_conditions, calculate_haversine_distance
from modules.decision_engine import evaluate_decision
from modules.query_understanding import understand_user_query
from modules.explanation import explain_decision
from modules.decision_watch import check_decision_conditions
from modules.decision_repair import generate_repair_options, apply_repair_selection
from modules.decision_feedback import record_mission_feedback, get_mission_feedback
from adapters.pfz_adapter import PFZAdapter
from adapters.boundary_adapter import BoundaryAdapter

router = APIRouter(prefix="/api")

pfz_adapter = PFZAdapter()
boundary_adapter = BoundaryAdapter()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="ORCA Marine Decision Support Engine",
        version="1.0.0-phase7",
        timestamp=datetime.utcnow().isoformat() + "Z",
        phase="Phase 7 - Living Feedback & Outcome Capture",
        details={
            "database": "SQLite Decision Store Active",
            "decision_engine": "Deterministic Rules Active (GO/CAUTION/WAIT)",
            "boundary_checker": "Shapely Point-in-Polygon Active",
            "query_understanding": "Gemini 2.5 Flash + Multilingual Fallback",
            "decision_watch": "Living Decision Watch & Meaningful Change Detector Active",
            "repair_engine": "Deterministic Repair & Wait Strategy Generator Active",
            "feedback_engine": "Prediction vs Actual Comparison & Outcome Capture Active",
            "environment": os.getenv("DEMO_MODE", "true")
        }
    )

@router.get("/zones")
async def get_zones():
    return pfz_adapter.get_all_zones()

@router.get("/boundaries")
async def get_boundaries():
    return boundary_adapter.get_boundaries_geojson()

@router.get("/conditions")
async def get_conditions(
    zone_id: Optional[str] = Query(None, description="Optional target zone ID"),
    lat: Optional[float] = Query(None, description="Optional custom latitude"),
    lon: Optional[float] = Query(None, description="Optional custom longitude")
):
    target_lat = lat
    target_lon = lon

    if zone_id:
        zinfo = pfz_adapter.get_zone_info(zone_id)
        if zinfo:
            target_lat = zinfo.centroid.lat
            target_lon = zinfo.centroid.lon

    if target_lat is None or target_lon is None:
        target_lat, target_lon = 9.966, 76.267

    conditions = await collect_marine_conditions(target_lat, target_lon, zone_id=zone_id)
    return conditions

async def _evaluate_single_zone(zone_id: str, origin: GeoLocation) -> DecisionResult:
    zone_info = pfz_adapter.get_zone_info(zone_id)
    if not zone_info:
        raise ValueError(f"Zone '{zone_id}' not found")

    actual_dist = calculate_haversine_distance(
        origin.lat, origin.lon,
        zone_info.centroid.lat, zone_info.centroid.lon
    )
    zone_info.distance_km = actual_dist

    is_violated_pt, pt_reasons = boundary_adapter.check_point_boundary(
        zone_info.centroid.lat, zone_info.centroid.lon
    )
    is_violated_poly, poly_reasons = boundary_adapter.check_polygon_boundary(
        zone_info.polygon or []
    )
    all_boundary_violations = pt_reasons + poly_reasons

    conditions = await collect_marine_conditions(
        zone_info.centroid.lat,
        zone_info.centroid.lon,
        zone_id=zone_id,
        origin_lat=origin.lat,
        origin_lon=origin.lon
    )

    return evaluate_decision(
        zone=zone_info,
        conditions=conditions,
        boundary_violations=all_boundary_violations
    )

@router.post("/evaluate", response_model=DecisionResult)
@router.post("/decisions/evaluate", response_model=DecisionResult)
async def evaluate_zone_decision(req: DecisionRequest):
    try:
        return await _evaluate_single_zone(req.zone_id, req.origin)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/query", response_model=QueryResponse)
async def process_natural_language_query(req: QueryRequest):
    origin = req.origin or GeoLocation(lat=9.966, lon=76.267, name="Kochi Port")
    
    intent = await understand_user_query(req.message, user_role="fisherman")
    lang = req.language or intent.get("language", "en")
    target_zone_id = intent.get("zone_id")
    request_type = intent.get("request_type", "recommendation")

    all_zones = pfz_adapter.get_all_zones()
    zone_ids = [z["zone_id"] for z in all_zones]

    if intent.get("intent") == "greeting":
        is_hindi = lang in ["hi", "hinglish"]
        greeting_text = (
            "Namaste Raju! Main ORCA Marine Intelligence assistant hoon. "
            "Aap pooch sakte hain: 'Kal subah fishing ke liye kahan jaana chahiye?', 'Is Zone B safe tomorrow?', ya live map se zone select karke evaluation dekh sakte hain."
            if is_hindi else
            "Hello Raju! I am ORCA — your marine decision intelligence assistant. "
            "Ask me: 'Where should I go fishing tomorrow morning?', 'Is Zone B safe tomorrow?', or select any sector on the map to evaluate safety."
        )
        return QueryResponse(
            message=req.message,
            intent=intent,
            decision=None,
            all_evaluations=[],
            explanation=greeting_text,
            language=lang,
            suggested_action="ask_question"
        )

    if target_zone_id and target_zone_id in zone_ids:
        decision = await _evaluate_single_zone(target_zone_id, origin)
        all_evals = [decision]
        context_type = "monitor_request" if request_type == "monitor_request" else "single_zone"
    else:
        all_evals = []
        for zid in zone_ids:
            res = await _evaluate_single_zone(zid, origin)
            all_evals.append(res)

        go_zones = [r for r in all_evals if r.status == "GO"]
        if go_zones:
            decision = max(go_zones, key=lambda x: x.score)
        else:
            caution_zones = [r for r in all_evals if r.status == "CAUTION"]
            if caution_zones:
                decision = max(caution_zones, key=lambda x: x.score)
            else:
                decision = all_evals[0]

        context_type = "recommendation"

    explanation_text = await explain_decision(decision, language=lang, context_type=context_type)
    suggested_action = "track_decision" if intent.get("needs_tracking") else "view_decision"

    return QueryResponse(
        message=req.message,
        intent=intent,
        decision=decision,
        all_evaluations=all_evals,
        explanation=explanation_text,
        language=lang,
        suggested_action=suggested_action
    )

@router.post("/decisions", response_model=TrackDecisionResponse)
async def track_decision(req: TrackDecisionRequest):
    origin = req.origin or GeoLocation(lat=9.966, lon=76.267, name="Kochi Port")
    
    decision_res = req.decision_result
    if not decision_res and req.zone_id:
        try:
            decision_res = await _evaluate_single_zone(req.zone_id, origin)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    elif not decision_res:
        raise HTTPException(status_code=400, detail="Either 'decision_result' or 'zone_id' must be provided.")

    decision_obj = create_and_store_decision(
        decision_result=decision_res,
        origin=origin,
        user_id=req.user_id,
        user_name=req.user_name,
        language=req.language,
        planned_start=req.planned_start,
        planned_return=req.planned_return,
        original_query=req.original_query
    )

    return TrackDecisionResponse(
        decision_id=decision_obj.decision_id,
        status="TRACKING",
        message="Decision is now registered and saved as a living Decision Object.",
        decision=decision_obj
    )

@router.get("/decisions")
async def list_tracked_decisions(user_id: Optional[str] = Query(None)):
    return list_decisions(user_id=user_id)

@router.get("/decisions/{decision_id}")
async def get_single_decision(decision_id: str = Path(...)):
    decision_data = get_decision(decision_id)
    if not decision_data:
        raise HTTPException(status_code=404, detail=f"Decision '{decision_id}' not found.")
    return decision_data

@router.post("/decisions/{decision_id}/cancel")
async def cancel_tracked_decision(decision_id: str = Path(...)):
    updated = cancel_decision(decision_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Decision '{decision_id}' not found.")
    return {
        "status": "success",
        "message": f"Tracking for decision '{decision_id}' has been cancelled.",
        "decision": updated
    }

@router.post("/decisions/{decision_id}/check", response_model=RecheckResponse)
@router.post("/decisions/{decision_id}/watch", response_model=RecheckResponse)
async def recheck_tracked_decision(
    decision_id: str = Path(...),
    req: Optional[RecheckRequest] = Body(None)
):
    override = req.override_conditions if req else None
    try:
        return await check_decision_conditions(decision_id, override_conditions=override)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/decisions/{decision_id}/simulate-change", response_model=RecheckResponse)
async def simulate_condition_change(
    decision_id: str = Path(...),
    req: Optional[RecheckRequest] = Body(None)
):
    override = req.override_conditions if (req and req.override_conditions) else {"wave_height_m": 2.8}
    try:
        return await check_decision_conditions(decision_id, override_conditions=override)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/decisions/{decision_id}/repair", response_model=RepairResponse)
async def get_decision_repair_options(decision_id: str = Path(...)):
    try:
        return await generate_repair_options(decision_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/decisions/{decision_id}/repair/select", response_model=SelectRepairResponse)
async def select_decision_repair_option(
    decision_id: str = Path(...),
    req: SelectRepairRequest = Body(...)
):
    try:
        return await apply_repair_selection(decision_id, req.option_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# -------------------------------------------------------------
# PHASE 7: LIVING FEEDBACK & OUTCOME CAPTURE ENDPOINTS
# -------------------------------------------------------------

@router.post("/decisions/{decision_id}/feedback", response_model=FeedbackResponse)
async def submit_mission_feedback(
    decision_id: str = Path(...),
    feedback: MissionFeedback = Body(...)
):
    """
    Submits actual observed conditions and fishing experience after mission completion,
    computes prediction vs actual comparison, and records to history.
    """
    try:
        return record_mission_feedback(decision_id, feedback)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/decisions/{decision_id}/feedback", response_model=FeedbackResponse)
async def fetch_decision_feedback(decision_id: str = Path(...)):
    """Retrieves recorded feedback and prediction vs actual comparisons for a completed decision."""
    try:
        res = get_mission_feedback(decision_id)
        if not res:
            raise HTTPException(status_code=404, detail=f"No feedback recorded for decision '{decision_id}'.")
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/demo/reset")
async def reset_demo():
    clear_decisions()
    return {"status": "success", "message": "Demo state reset successfully."}

@router.get("/config/status")
async def get_config_status():
    key = os.getenv("GEMINI_API_KEY", "")
    return {
        "gemini_configured": bool(key and len(key) > 5),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    }

@router.post("/config/gemini-key")
async def set_gemini_key(payload: Dict[str, Any] = Body(...)):
    new_key = payload.get("api_key", "").strip()
    model = payload.get("model", "gemini-1.5-flash").strip()
    if new_key:
        os.environ["GEMINI_API_KEY"] = new_key
        os.environ["GEMINI_MODEL"] = model
        # Save to backend/.env
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        try:
            with open(env_path, "w") as f:
                f.write(f"GEMINI_API_KEY={new_key}\nGEMINI_MODEL={model}\n")
        except Exception as e:
            logger.warning(f"Could not persist .env: {e}")
        return {"status": "success", "message": "Gemini API key saved and activated successfully."}
    else:
        os.environ["GEMINI_API_KEY"] = ""
        return {"status": "success", "message": "Gemini API key cleared. Using deterministic fallback."}
