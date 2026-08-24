from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class GeoLocation(BaseModel):
    lat: float
    lon: float
    name: Optional[str] = None

# Alias Location for backward compatibility
Location = GeoLocation

class MarineConditions(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    location: GeoLocation
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
    centroid: GeoLocation
    polygon: Optional[List[List[float]]] = None
    distance_km: float = 0.0
    boundary_violation: bool = False
    restricted: bool = False

class DecisionRequest(BaseModel):
    user_id: str = "user_demo_fisherman"
    zone_id: str
    planned_start: Optional[str] = None
    planned_return: Optional[str] = None
    user_role: str = "fisherman"
    origin: GeoLocation

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

class UserProfile(BaseModel):
    user_id: str = "user_demo_fisherman"
    user_role: str = "fisherman"
    name: str = "Raju (Fisherman)"
    language: str = "en"
    origin: GeoLocation

class MissionDetails(BaseModel):
    purpose: str = "fishing"
    zone_id: str
    zone_name: str
    destination: Optional[GeoLocation] = None
    planned_start: str
    planned_return: Optional[str] = None
    original_query: Optional[str] = None

class DecisionSnapshot(BaseModel):
    status: str  # "GO" | "CAUTION" | "WAIT"
    score: int
    safety_score: int
    fishing_score: int
    effort_score: int
    boundary_violation: bool = False
    hard_stop: bool = False
    reasons: List[str] = []
    explanation: Optional[str] = None

class ChangedFactor(BaseModel):
    factor: str
    field_name: str
    previous_value: Any
    current_value: Any
    threshold_value: Optional[Any] = None
    threshold_crossed: bool = False
    impact: str

class ChangeHistoryEntry(BaseModel):
    checked_at: str
    previous_status: str
    new_status: str
    previous_score: int
    new_score: int
    affected: bool
    changed_factors: List[ChangedFactor] = []
    summary: str
    explanation: Optional[str] = None
    conditions_snapshot: Optional[MarineConditions] = None
    action_taken: Optional[str] = None

class RepairOption(BaseModel):
    option_id: str
    type: str  # "TIME_CHANGE" | "ZONE_CHANGE" | "WAIT" | "COMBINED"
    title: str
    description: str
    zone_id: str
    zone_name: str
    planned_start: str
    status: str  # "GO" | "CAUTION" | "WAIT"
    score: int
    safety_score: int
    fishing_score: int
    effort_score: int
    reasons: List[str] = []
    explanation: Optional[str] = None
    conditions: Optional[MarineConditions] = None
    rank: int = 1

class DecisionObject(BaseModel):
    decision_id: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    last_checked_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    user: UserProfile
    mission: MissionDetails
    original_decision: DecisionSnapshot
    original_conditions: MarineConditions
    thresholds_snapshot: Dict[str, Any]
    latest_decision: Optional[DecisionSnapshot] = None
    latest_conditions: Optional[MarineConditions] = None
    lifecycle_status: str = "TRACKING"  # TRACKING | ALERT | REPAIRED | WAITING | CANCELLED
    tracking_enabled: bool = True
    current_status: str = "TRACKING"
    change_history: List[ChangeHistoryEntry] = []
    repair_options: List[RepairOption] = []
    selected_action: Optional[RepairOption] = None
    feedback: Optional[Dict[str, Any]] = None

class TrackDecisionRequest(BaseModel):
    decision_result: Optional[DecisionResult] = None
    zone_id: Optional[str] = None
    user_id: str = "user_demo_fisherman"
    user_name: str = "Raju (Fisherman)"
    language: str = "en"
    planned_start: Optional[str] = None
    planned_return: Optional[str] = None
    origin: Optional[GeoLocation] = None
    original_query: Optional[str] = None

class TrackDecisionResponse(BaseModel):
    decision_id: str
    status: str
    message: str
    decision: DecisionObject

class RecheckRequest(BaseModel):
    override_conditions: Optional[Dict[str, Any]] = None
    force_demo_change: bool = False

class RecheckResponse(BaseModel):
    decision_id: str
    affected: bool
    previous_status: str
    current_status: str
    previous_score: int
    current_score: int
    changed_factors: List[ChangedFactor]
    summary: str
    explanation: str
    last_checked_at: str
    decision: DecisionObject

class RepairResponse(BaseModel):
    decision_id: str
    original_status: str
    current_status: str
    repair_available: bool
    options: List[RepairOption]
    summary: str
    explanation: str

class SelectRepairRequest(BaseModel):
    option_id: str

class SelectRepairResponse(BaseModel):
    decision_id: str
    status: str
    message: str
    selected_option: RepairOption
    decision: DecisionObject

class QueryRequest(BaseModel):
    message: str
    user_id: str = "user_demo_fisherman"
    language: Optional[str] = None
    origin: Optional[GeoLocation] = None

class QueryResponse(BaseModel):
    message: str
    intent: Dict[str, Any]
    decision: Optional[DecisionResult] = None
    all_evaluations: Optional[List[DecisionResult]] = None
    explanation: str
    language: str = "en"
    suggested_action: str = "view_decision"

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    phase: str
    details: Dict[str, Any]
