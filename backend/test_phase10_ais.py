"""
Test Suite for Phase 10: Coastal AIS Vessel Fleet Tracking & Traffic Endpoint
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app
from adapters.ais_adapter import ais_adapter

client = TestClient(app)

def test_ais_adapter():
    print("Testing AIS Adapter...")
    
    # 1. Retrieve all vessels
    res = ais_adapter.get_vessels()
    assert "vessels" in res
    assert len(res["vessels"]) >= 7, "Expected at least 7 simulated coastal vessels"
    print(f"✓ Loaded {res['total_vessels']} coastal AIS vessels across Kerala Corridor.")

    # 2. Filter by fishing vessels
    fishing_res = ais_adapter.get_vessels(vessel_type="fishing")
    assert len(fishing_res["vessels"]) >= 3
    assert all(v["type"] == "fishing" for v in fishing_res["vessels"])
    print(f"✓ Filtered {len(fishing_res['vessels'])} active fishing vessels (trawlers, gillnetters).")

    # 3. Filter by patrol vessels
    patrol_res = ais_adapter.get_vessels(vessel_type="patrol")
    assert len(patrol_res["vessels"]) >= 1
    assert any("ICGS" in v["name"] for v in patrol_res["vessels"])
    print(f"✓ Filtered {len(patrol_res['vessels'])} Coast Guard patrol crafts.")

    # 4. Lookup by MMSI
    vessel = ais_adapter.get_vessel_by_mmsi("419001201")
    assert vessel is not None
    assert vessel["name"] == "Matsya Jyoti"
    print(f"✓ MMSI Lookup found: {vessel['name']} ({vessel['registration']}) - {vessel['status']}")

def test_ais_endpoint():
    print("Testing /api/ais Endpoint...")
    
    # 1. Full fleet
    res = client.get("/api/ais")
    assert res.status_code == 200
    data = res.json()
    assert data["total_vessels"] > 0
    print(f"✓ /api/ais returned {data['total_vessels']} vessels.")

    # 2. Query filter
    res_fishing = client.get("/api/ais?type=fishing")
    assert res_fishing.status_code == 200
    data_fishing = res_fishing.json()
    assert all(v["type"] == "fishing" for v in data_fishing["vessels"])
    print(f"✓ /api/ais?type=fishing returned {len(data_fishing['vessels'])} fishing vessels.")

if __name__ == "__main__":
    test_ais_adapter()
    test_ais_endpoint()
    print("\n🎉 ALL PHASE 10 AIS VESSEL FLEET TESTS PASSED SUCCESSFULLY!")
