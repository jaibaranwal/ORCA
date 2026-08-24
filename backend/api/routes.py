from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import Optional, List, Dict, Any
import json
import os

from models.schemas import (
    HealthResponse, 
    DecisionRequest, 
    DecisionResult, 
    MarineConditions,
    Location,
    ZoneInfo
)
from modules.decision_store import list_decisions, clear_decisions
from modules.data_collection import collect_marine_conditions, calculate_haversine_distance
from modules.decision_engine import evaluate_decision
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
        version="1.0.0-phase2",
        timestamp=datetime.utcnow().isoformat() + "Z",
        phase="Phase 2 - Data Ingestion & Deterministic Decision Engine",
        details={
            "database": "SQLite Initialized",
            "decision_engine": "Deterministic Rules Active (GO/CAUTION/WAIT)",
            "boundary_checker": "Shapely Point-in-Polygon Active",
            "data_collection": "Open-Meteo + Cached Multi-Layer Adapter",
            "environment": os.getenv("DEMO_MODE", "true")
        }
    )

@router.get("/zones")
async def get_zones():
    """Returns all available fishing zones with centroids, PFZ metrics, and polygons."""
    return pfz_adapter.get_all_zones()

@router.get("/boundaries")
async def get_boundaries():
    """Returns maritime boundaries and restricted zones GeoJSON."""
    return boundary_adapter.get_boundaries_geojson()

@router.get("/conditions")
async def get_conditions(
    zone_id: Optional[str] = Query(None, description="Optional target zone ID"),
    lat: Optional[float] = Query(None, description="Optional custom latitude"),
    lon: Optional[float] = Query(None, description="Optional custom longitude")
):
    """Retrieves current marine and atmospheric conditions for a given zone or location."""
    target_lat = lat
    target_lon = lon

    if zone_id:
        zinfo = pfz_adapter.get_zone_info(zone_id)
        if zinfo:
            target_lat = zinfo.centroid.lat
            target_lon = zinfo.centroid.lon

    if target_lat is None or target_lon is None:
        target_lat, target_lon = 9.966, 76.267  # Default Kochi Port

    conditions = await collect_marine_conditions(target_lat, target_lon, zone_id=zone_id)
    return conditions

@router.post("/evaluate", response_model=DecisionResult)
@router.post("/decisions/evaluate", response_model=DecisionResult)
async def evaluate_zone_decision(req: DecisionRequest):
    """
    Evaluates safety, fishing opportunity, and travel effort for a selected zone and mission.
    Runs deterministic boundary checks, gathers marine data, and produces GO/CAUTION/WAIT.
    """
    zone_info = pfz_adapter.get_zone_info(req.zone_id)
    if not zone_info:
        raise HTTPException(status_code=404, detail=f"Zone '{req.zone_id}' not found in database.")

    # 1. Update distance from user's origin
    actual_dist = calculate_haversine_distance(
        req.origin.lat, req.origin.lon,
        zone_info.centroid.lat, zone_info.centroid.lon
    )
    zone_info.distance_km = actual_dist

    # 2. Run deterministic boundary check (Centroid point check + Polygon check)
    is_violated_pt, pt_reasons = boundary_adapter.check_point_boundary(
        zone_info.centroid.lat, zone_info.centroid.lon
    )
    is_violated_poly, poly_reasons = boundary_adapter.check_polygon_boundary(
        zone_info.polygon or []
    )
    all_boundary_violations = pt_reasons + poly_reasons

    # 3. Collect marine weather and satellite indicators
    conditions = await collect_marine_conditions(
        zone_info.centroid.lat,
        zone_info.centroid.lon,
        zone_id=req.zone_id,
        origin_lat=req.origin.lat,
        origin_lon=req.origin.lon
    )

    # 4. Evaluate deterministic decision rules
    result = evaluate_decision(
        zone=zone_info,
        conditions=conditions,
        boundary_violations=all_boundary_violations
    )

    return result

@router.get("/decisions")
async def get_decisions():
    return list_decisions()

@router.get("/demo/reset")
async def reset_demo():
    clear_decisions()
    return {"status": "success", "message": "Demo state reset successfully."}
