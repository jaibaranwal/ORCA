"""
Test Suite for Phase 8 / P1: NOAA SST Adapter, Geocoding, and Multilingual Pipeline
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from adapters.sst_adapter import sst_adapter

def test_sst_adapter():
    print("Testing SST Adapter...")
    grid = sst_adapter.get_sst_grid()
    assert "grid_points" in grid, "grid_points missing from SST grid"
    assert len(grid["grid_points"]) > 0, "grid_points is empty"
    assert "thermal_fronts" in grid, "thermal_fronts missing from SST grid"
    print(f"✓ SST Grid loaded with {len(grid['grid_points'])} grid points and {len(grid['thermal_fronts'])} thermal fronts.")
    print(f"✓ Data Source: {grid.get('data_source')}")

    # Test zone SST
    zone_b_sst = sst_adapter.get_zone_sst("zone_b", 10.05, 75.95)
    assert "sst_celsius" in zone_b_sst, "sst_celsius missing"
    print(f"✓ Zone B SST: {zone_b_sst['sst_celsius']}°C, Gradient: {zone_b_sst['gradient_c_per_km']}°C/km, Front detected: {zone_b_sst['thermal_front_detected']}")

def test_routes_via_client():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    
    # 1. Health check with phase 8
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == "1.0.0-phase8"
    print(f"✓ Health Check: version {data['version']}, phase: {data['phase']}")

    # 2. SST Endpoint
    res = client.get("/api/sst")
    assert res.status_code == 200
    sst_data = res.json()
    assert len(sst_data["grid_points"]) > 0
    print(f"✓ /api/sst returned {len(sst_data['grid_points'])} SST points.")

    # 3. Geocode Endpoint
    res = client.get("/api/geocode?q=Beypore")
    assert res.status_code == 200
    geo_data = res.json()
    assert len(geo_data["results"]) > 0
    assert "Beypore" in geo_data["results"][0]["name"]
    print(f"✓ /api/geocode found: {geo_data['results'][0]['name']}")

    # 4. Geocode Search for Mangalore
    res = client.get("/api/geocode?q=Mangalore")
    assert res.status_code == 200
    geo_data = res.json()
    assert len(geo_data["results"]) > 0
    print(f"✓ /api/geocode found: {geo_data['results'][0]['name']}")

if __name__ == "__main__":
    test_sst_adapter()
    test_routes_via_client()
    print("\n🎉 ALL PHASE 8 BACKEND TESTS PASSED SUCCESSFULLY!")
