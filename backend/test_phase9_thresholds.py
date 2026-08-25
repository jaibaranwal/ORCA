"""
Test Suite for Phase 9: Live Threshold Configurator & Dynamic Engine Adaptation
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app
from models.schemas import ZoneInfo, MarineConditions, GeoLocation
from modules.decision_engine import evaluate_decision

client = TestClient(app)

def test_threshold_endpoints():
    print("Testing Threshold Config Endpoints...")
    
    # 1. Get current thresholds
    res = client.get("/api/config/thresholds")
    assert res.status_code == 200
    initial_config = res.json()
    assert "wave_height_safe_m" in initial_config
    print(f"✓ Initial Wave Safe Limit: {initial_config['wave_height_safe_m']}m")

    # 2. Modify threshold (tighten wave limit to 1.1m)
    update_res = client.post("/api/config/thresholds", json={"wave_height_safe_m": 1.1})
    assert update_res.status_code == 200
    updated_config = update_res.json()["config"]
    assert updated_config["wave_height_safe_m"] == 1.1
    print("✓ Updated Wave Safe Limit to 1.1m dynamically.")

    # 3. Test dynamic evaluation response with tightened threshold
    sample_zone = ZoneInfo(
        zone_id="zone_b",
        zone_name="Zone B (Offshore West)",
        pfz_score=85,
        pfz_label="High Potential",
        distance_km=14.5,
        centroid={"lat": 10.05, "lon": 75.95, "name": "Centroid B"}
    )
    # Wave is 1.35m (safe under 1.5m, but caution/wait under 1.1m)
    sample_cond = MarineConditions(
        location=GeoLocation(lat=10.05, lon=75.95, name="Zone B"),
        wave_height_m=1.35,
        wind_speed_kmh=12.0,
        current_speed_ms=0.3,
        visibility_km=10.0,
        data_source="TEST"
    )

    decision = evaluate_decision(sample_zone, sample_cond)
    print(f"✓ Evaluated Decision with tightened threshold: Verdict={decision.status}, Score={decision.score}")
    # Under 1.1m limit, 1.35m wave cannot be GO (should be CAUTION)
    assert decision.status in ["CAUTION", "WAIT"], f"Expected CAUTION or WAIT with 1.1m limit, got {decision.status}"

    # 4. Reset thresholds to defaults
    reset_res = client.post("/api/config/thresholds/reset")
    assert reset_res.status_code == 200
    restored_config = reset_res.json()["config"]
    assert restored_config["wave_height_safe_m"] == 1.5
    print("✓ Restored Wave Safe Limit to default 1.5m.")

    # 5. Re-evaluate with default threshold
    default_decision = evaluate_decision(sample_zone, sample_cond)
    print(f"✓ Re-evaluated Decision with default threshold: Verdict={default_decision.status}, Score={default_decision.score}")
    assert default_decision.status == "GO", f"Expected GO with 1.5m limit, got {default_decision.status}"

if __name__ == "__main__":
    test_threshold_endpoints()
    print("\n🎉 ALL PHASE 9 LIVE THRESHOLD TESTS PASSED SUCCESSFULLY!")
