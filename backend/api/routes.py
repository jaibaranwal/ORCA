from fastapi import APIRouter, HTTPException
from datetime import datetime
import json
import os
from models.schemas import HealthResponse
from modules.decision_store import list_decisions, clear_decisions

router = APIRouter(prefix="/api")

CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")

@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="ORCA Marine Decision Support Engine",
        version="1.0.0-phase1",
        timestamp=datetime.utcnow().isoformat() + "Z",
        phase="Phase 1 - Project Foundation",
        details={
            "database": "SQLite Initialized",
            "decision_engine": "Ready for Phase 2",
            "gemini_integration": "Ready for API Key configuration",
            "environment": os.getenv("DEMO_MODE", "true")
        }
    )

@router.get("/zones")
async def get_zones():
    zones_path = os.path.join(CONFIG_DIR, "zones.json")
    if os.path.exists(zones_path):
        with open(zones_path, "r") as f:
            return json.load(f)
    return []

@router.get("/decisions")
async def get_decisions():
    return list_decisions()

@router.get("/demo/reset")
async def reset_demo():
    clear_decisions()
    return {"status": "success", "message": "Demo state reset successfully."}
