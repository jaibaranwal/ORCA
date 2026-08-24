import sqlite3
import json
import os
from typing import Optional, List, Dict, Any
from datetime import datetime

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
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS decisions (
        decision_id     TEXT PRIMARY KEY,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        user_id         TEXT NOT NULL,
        zone_id         TEXT NOT NULL,
        current_status  TEXT NOT NULL,
        tracking_status TEXT NOT NULL,
        data            TEXT NOT NULL
    )
    """)
    conn.commit()
    conn.close()

def save_decision(decision_dict: Dict[str, Any]) -> str:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat() + "Z"
    decision_id = decision_dict.get("decision_id", f"dec_{int(datetime.utcnow().timestamp())}")
    
    cursor.execute("""
    INSERT OR REPLACE INTO decisions 
    (decision_id, created_at, updated_at, user_id, zone_id, current_status, tracking_status, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        decision_id,
        decision_dict.get("created_at", now),
        now,
        decision_dict.get("user", {}).get("user_id", "user_demo"),
        decision_dict.get("mission", {}).get("zone_id", ""),
        decision_dict.get("current_status", "WATCHING"),
        decision_dict.get("tracking_status", "WATCHING"),
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

def list_decisions() -> List[Dict[str, Any]]:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data FROM decisions ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [json.loads(row["data"]) for row in rows]

def clear_decisions():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM decisions")
    conn.commit()
    conn.close()
