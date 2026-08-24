from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class Location(BaseModel):
    lat: float
    lon: float
    name: Optional[str] = None

class MarineConditions(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    location: Location
    wave_height_m: float
    wave_direction_deg: float = 0.0
    wave_period_s: float = 0.0
    wind_speed_kmh: float
    wind_direction_deg: float = 0.0
    current_speed_ms: float = 0.0
    weather_code: int = 0
    visibility_km: float = 10.0
    lightning_alert: bool = False
    cyclone_alert: bool = False
    sst_celsius: Optional[float] = None
    data_source: str = "demo"  # "live" | "cache" | "demo"

class ZoneInfo(BaseModel):
    zone_id: str
    zone_name: str
    pfz_score: int
    pfz_label: str
    centroid: Location
    polygon: Optional[List[List[float]]] = None
    distance_km: float = 0.0
    boundary_violation: bool = False
    restricted: bool = False

class DecisionRequest(BaseModel):
    user_id: str = "user_demo_fisherman"
    zone_id: str
    planned_start: str
    planned_return: str
    user_role: str = "fisherman"
    origin: Location

class DecisionResult(BaseModel):
    zone_id: str
    zone_name: str
    status: str  # "GO" | "CAUTION" | "WAIT"
    score: int
    safety_score: int
    fishing_score: int
    effort_score: int
    boundary_violation: bool = False
    hard_stop: bool = False
    reasons: List[str] = []
    explanation: Optional[str] = None
    conditions: MarineConditions
    thresholds_used: Dict[str, Any] = {}
    data_source: str = "demo"

class QueryRequest(BaseModel):
    message: str
    user_id: str = "user_demo_fisherman"
    language: str = "en"

class QueryResponse(BaseModel):
    intent: str
    zone: Optional[str] = None
    time_reference: Optional[str] = None
    resolved_datetime: Optional[str] = None
    user_role: str = "fisherman"
    language: str = "en"
    constraints: List[str] = []
    raw_query: str
    suggested_action: str

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    phase: str
    details: Dict[str, Any]
