import sqlite3
import json
import os
from typing import Optional, List, Dict, Any
from datetime import datetime
from models.schemas import (
    DecisionObject, 
    DecisionResult, 
    UserProfile, 
    MissionDetails, 
    DecisionSnapshot, 
    GeoLocation
)

DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "decisions.db"))

def get_db_connection():
    db_dir = os.path.dirname(DATABASE_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if table exists and has lifecycle_status column
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='decisions'")
    table_exists = cursor.fetchone() is not None

    if table_exists:
        cursor.execute("PRAGMA table_info(decisions)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "lifecycle_status" not in columns:
            cursor.execute("DROP TABLE decisions")
            table_exists = False

    if not table_exists:
        cursor.execute("""
        CREATE TABLE decisions (
            decision_id      TEXT PRIMARY KEY,
            created_at       TEXT NOT NULL,
            updated_at       TEXT NOT NULL,
            user_id          TEXT NOT NULL,
            zone_id          TEXT NOT NULL,
            lifecycle_status TEXT NOT NULL,
            tracking_enabled INTEGER NOT NULL,
            data             TEXT NOT NULL
        )
        """)
    conn.commit()
    conn.close()

def generate_decision_id() -> str:
    now = datetime.utcnow()
    date_str = now.strftime("%Y%m%d")
    timestamp_suffix = int(now.timestamp()) % 10000
    return f"ORCA-DEC-{date_str}-{timestamp_suffix:04d}"

def create_and_store_decision(
    decision_result: DecisionResult,
    origin: Optional[GeoLocation] = None,
    user_id: str = "user_demo_fisherman",
    user_name: str = "Raju (Fisherman)",
    language: str = "en",
    planned_start: Optional[str] = None,
    planned_return: Optional[str] = None,
    original_query: Optional[str] = None
) -> DecisionObject:
    """
    Creates and persists a living Decision Object with an IMMUTABLE snapshot of the
    conditions, thresholds, and safety rules at decision evaluation time.
    """
    init_db()
    now_iso = datetime.utcnow().isoformat() + "Z"
    decision_id = generate_decision_id()

    base_origin = origin or GeoLocation(lat=9.966, lon=76.267, name="Kochi Port")
    start_time = planned_start or now_iso
    end_time = planned_return or datetime.fromtimestamp(datetime.utcnow().timestamp() + 8*3600).isoformat() + "Z"

    decision_obj = DecisionObject(
        decision_id=decision_id,
        created_at=now_iso,
        updated_at=now_iso,
        last_checked_at=now_iso,
        user=UserProfile(
            user_id=user_id,
            user_role="fisherman",
            name=user_name,
            language=language,
            origin=base_origin
        ),
        mission=MissionDetails(
            purpose="fishing",
            zone_id=decision_result.zone_id,
            zone_name=decision_result.zone_name,
            destination=decision_result.conditions.location,
            planned_start=start_time,
            planned_return=end_time,
            original_query=original_query
        ),
        original_decision=DecisionSnapshot(
            status=decision_result.status,
            score=decision_result.score,
            safety_score=decision_result.safety_score,
            fishing_score=decision_result.fishing_score,
            effort_score=decision_result.effort_score,
            boundary_violation=decision_result.boundary_violation,
            hard_stop=decision_result.hard_stop,
            reasons=decision_result.reasons,
            explanation=decision_result.explanation
        ),
        # IMMUTABLE SNAPSHOT OF CONDITIONS AT DECISION TIME
        original_conditions=decision_result.conditions.model_copy(deep=True),
        thresholds_snapshot=dict(decision_result.thresholds_used),
        lifecycle_status="TRACKING",
        tracking_enabled=True,
        current_status="TRACKING",
        change_history=[],
        repair_options=[]
    )

    save_decision(decision_obj.model_dump())
    return decision_obj

def save_decision(decision_dict: Dict[str, Any]) -> str:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    decision_id = decision_dict.get("decision_id", generate_decision_id())
    
    cursor.execute("""
    INSERT OR REPLACE INTO decisions 
    (decision_id, created_at, updated_at, user_id, zone_id, lifecycle_status, tracking_enabled, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        decision_id,
        decision_dict.get("created_at", now),
        now,
        decision_dict.get("user", {}).get("user_id", "user_demo"),
        decision_dict.get("mission", {}).get("zone_id", ""),
        decision_dict.get("lifecycle_status", "TRACKING"),
        1 if decision_dict.get("tracking_enabled", True) else 0,
        json.dumps(decision_dict)
    ))
    conn.commit()
    conn.close()
    return decision_id

def get_decision(decision_id: str) -> Optional[Dict[str, Any]]:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM decisions WHERE decision_id = ?", (decision_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return json.loads(row["data"])
    return None

def list_decisions(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT data FROM decisions WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    else:
        cursor.execute("SELECT data FROM decisions ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [json.loads(row["data"]) for row in rows]

def cancel_decision(decision_id: str) -> Optional[Dict[str, Any]]:
    decision_data = get_decision(decision_id)
    if not decision_data:
        return None
    decision_data["lifecycle_status"] = "CANCELLED"
    decision_data["current_status"] = "CANCELLED"
    decision_data["tracking_enabled"] = False
    decision_data["updated_at"] = datetime.utcnow().isoformat() + "Z"
    save_decision(decision_data)
    return decision_data

def clear_decisions():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM decisions")
    conn.commit()
    conn.close()
