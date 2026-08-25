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
from modules.explanation import explain_decision, answer_conversational_query
from modules.decision_watch import check_decision_conditions
from modules.decision_repair import generate_repair_options, apply_repair_selection
from modules.decision_feedback import record_mission_feedback, get_mission_feedback
from adapters.pfz_adapter import PFZAdapter
from adapters.boundary_adapter import BoundaryAdapter
from adapters.sst_adapter import sst_adapter

router = APIRouter(prefix="/api")

pfz_adapter = PFZAdapter()
boundary_adapter = BoundaryAdapter()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="ORCA Marine Decision Support Engine",
        version="1.0.0-phase8",
        timestamp=datetime.utcnow().isoformat() + "Z",
        phase="Phase 8 - SST NOAA ERDDAP Layer & Geocoding Active",
        details={
            "database": "SQLite Decision Store Active",
            "decision_engine": "Deterministic Rules Active (GO/CAUTION/WAIT)",
            "boundary_checker": "Shapely Point-in-Polygon Active",
            "query_understanding": "Gemini 2.5 Flash + Multilingual Fallback",
            "decision_watch": "Living Decision Watch & Meaningful Change Detector Active",
            "repair_engine": "Deterministic Repair & Wait Strategy Generator Active",
            "feedback_engine": "Prediction vs Actual Comparison & Outcome Capture Active",
            "sst_adapter": "NOAA ERDDAP + Thermal Front Detector Active",
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

    if intent.get("intent") in ["greeting", "general_query"]:
        explanation_text = await answer_conversational_query(req.message, language=lang)
        return QueryResponse(
            message=req.message,
            intent=intent,
            decision=None,
            all_evaluations=[],
            explanation=explanation_text,
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

@router.get("/sst")
async def get_sea_surface_temperature(force_refresh: bool = Query(False)):
    """
    Returns Sea Surface Temperature grid and thermal front detections
    from NOAA CoastWatch ERDDAP with 1-hour cache and demo fallback.
    """
    return sst_adapter.get_sst_grid(force_refresh=force_refresh)

CURATED_COASTAL_PORTS = [
    {"name": "Kochi Port, Kerala", "lat": 9.966, "lon": 76.267, "state": "Kerala", "type": "Major Port"},
    {"name": "Munambam Harbour, Kerala", "lat": 10.182, "lon": 76.175, "state": "Kerala", "type": "Fishing Harbour"},
    {"name": "Beypore Port, Kozhikode", "lat": 11.164, "lon": 75.808, "state": "Kerala", "type": "Fishing Harbour"},
    {"name": "Neendakara Port, Kollam", "lat": 8.937, "lon": 76.536, "state": "Kerala", "type": "Fishing Harbour"},
    {"name": "Vizhinjam Port, Thiruvananthapuram", "lat": 8.375, "lon": 76.992, "state": "Kerala", "type": "Deepwater Port"},
    {"name": "Mangalore Old Port, Karnataka", "lat": 12.853, "lon": 74.836, "state": "Karnataka", "type": "Fishing Harbour"},
    {"name": "Malpe Fishing Port, Udupi", "lat": 13.351, "lon": 74.704, "state": "Karnataka", "type": "Fishing Harbour"},
    {"name": "Mormugao Port, Goa", "lat": 15.416, "lon": 73.799, "state": "Goa", "type": "Major Port"},
    {"name": "Sassoon Docks, Mumbai", "lat": 18.915, "lon": 72.825, "state": "Maharashtra", "type": "Major Fishing Docks"},
    {"name": "Kanyakumari Harbour, Tamil Nadu", "lat": 8.082, "lon": 77.553, "state": "Tamil Nadu", "type": "Fishing Harbour"},
    {"name": "Tuticorin Port, Tamil Nadu", "lat": 8.756, "lon": 78.188, "state": "Tamil Nadu", "type": "Major Port"}
]

@router.get("/geocode")
async def geocode_location(q: str = Query(..., min_length=1)):
    """
    Nominatim Geocoding Endpoint for coastal ports and locations.
    Checks curated Indian fishing ports first, then falls back to Nominatim with 3s timeout.
    """
    query_clean = q.lower().strip()
    
    # 1. Check curated ports
    matched = [
        p for p in CURATED_COASTAL_PORTS
        if query_clean in p["name"].lower() or query_clean in p.get("state", "").lower()
    ]
    if matched:
        return {"query": q, "source": "CURATED_PORTS", "results": matched}

    # 2. Try Nominatim live query
    try:
        import urllib.parse
        import urllib.request
        encoded_q = urllib.parse.quote(f"{q}, India")
        url = f"https://nominatim.openstreetmap.org/search?q={encoded_q}&format=json&limit=5&countrycodes=in"
        req = urllib.request.Request(url, headers={"User-Agent": "ORCA-Marine-Decision-Support/1.0 (sih2026@orca.internal)"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status == 200:
                raw_results = json.loads(resp.read().decode("utf-8"))
                formatted = [
                    {
                        "name": r.get("display_name", q),
                        "lat": float(r.get("lat")),
                        "lon": float(r.get("lon")),
                        "type": r.get("type", "coastal_location"),
                        "state": "India"
                    }
                    for r in raw_results if "lat" in r and "lon" in r
                ]
                if formatted:
                    return {"query": q, "source": "NOMINATIM_LIVE", "results": formatted}
    except Exception:
        pass

    # 3. Fallback: closest default port
    return {
        "query": q,
        "source": "FALLBACK_PORTS",
        "results": CURATED_COASTAL_PORTS[:4]
    }

# -------------------------------------------------------------
# PHASE 9: LIVE THRESHOLDS CONFIGURATOR (SIH JUDGE DEMO)
# -------------------------------------------------------------

DEFAULT_THRESHOLDS = {
    "config_version": "prototype_v1",
    "disclaimer": "PROTOTYPE THRESHOLDS ONLY. Not official maritime safety standards.",
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

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")
THRESHOLDS_FILE = os.path.join(CONFIG_DIR, "thresholds.json")

@router.get("/config/thresholds")
async def get_thresholds_config():
    """Returns current active safety thresholds and scoring weights."""
    if os.path.exists(THRESHOLDS_FILE):
        try:
            with open(THRESHOLDS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_THRESHOLDS

@router.post("/config/thresholds")
async def update_thresholds_config(new_config: Dict[str, Any] = Body(...)):
    """Updates active thresholds dynamically in memory and persists to thresholds.json."""
    current = DEFAULT_THRESHOLDS.copy()
    if os.path.exists(THRESHOLDS_FILE):
        try:
            with open(THRESHOLDS_FILE, "r") as f:
                current = json.load(f)
        except Exception:
            pass
    
    current.update(new_config)
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(THRESHOLDS_FILE, "w") as f:
        json.dump(current, f, indent=2)
        
    return {
        "status": "success",
        "message": "Safety thresholds updated successfully.",
        "config": current
    }

@router.post("/config/thresholds/reset")
async def reset_thresholds_config():
    """Resets safety thresholds back to default SIH values."""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(THRESHOLDS_FILE, "w") as f:
        json.dump(DEFAULT_THRESHOLDS, f, indent=2)
    return {
        "status": "success",
        "message": "Safety thresholds reset to SIH defaults.",
        "config": DEFAULT_THRESHOLDS
    }


