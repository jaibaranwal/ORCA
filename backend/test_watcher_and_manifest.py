import asyncio
from fastapi.testclient import TestClient
from main import app
from models.schemas import GeoLocation, MarineConditions, ZoneInfo
from modules.decision_store import create_and_store_decision, clear_decisions, get_decision
from modules.decision_engine import evaluate_decision
from modules.decision_watcher_daemon import decision_watcher
from modules.safety_manifest import generate_safety_manifest, generate_manifest_html

def test_watcher_and_manifest_suite():
    print("==================================================")
    print("RUNNING DECISION WATCHER DAEMON & MANIFEST TESTS")
    print("==================================================")

    client = TestClient(app)
    clear_decisions()

    # 1. Test Watcher Daemon Status Endpoint
    print("\n[TEST 1 - Watcher Daemon Status]")
    res = client.get("/api/watcher/status")
    assert res.status_code == 200
    status_data = res.json()
    print(f"Daemon Running: {status_data['is_running']} | Interval: {status_data['interval_seconds']}s")
    assert "is_running" in status_data
    assert "interval_seconds" in status_data
    print("✓ Test 1 Passed: Daemon telemetry reported accurately.")

    # 2. Setup Tracked Mission for Monitoring Test
    print("\n[TEST 2 - Create Tracked Decision for Watcher Daemon]")
    origin = GeoLocation(lat=9.966, lon=76.267, name="Kochi Port")
    zone_b = ZoneInfo(
        zone_id="zone_b",
        zone_name="Zone B (Offshore West)",
        pfz_score=86,
        pfz_label="High",
        centroid=GeoLocation(lat=10.05, lon=75.95),
        distance_km=18.0
    )
    initial_cond = MarineConditions(
        timestamp="2026-09-13T06:00:00Z",
        location=zone_b.centroid,
        wave_height_m=1.35,
        wind_speed_kmh=12.0,
        current_speed_ms=0.4,
        visibility_km=10.0,
        weather_code=1,
        lightning_alert=False,
        cyclone_alert=False,
        sst_celsius=28.1,
        data_source="live"
    )

    eval_result = evaluate_decision(zone_b, initial_cond, boundary_violations=[])
    assert eval_result.status == "GO"

    dec_obj = create_and_store_decision(
        decision_result=eval_result,
        origin=origin,
        user_id="usr_kerala_01",
        user_name="Matsya Jyoti",
        language="en",
        planned_start="2026-09-13T06:00:00Z",
        original_query="Where can I fish safely today?"
    )
    dec_id = dec_obj.decision_id
    print(f"Created Tracked Decision: {dec_id} (Status: {dec_obj.lifecycle_status})")
    assert dec_obj.lifecycle_status == "TRACKING"
    print("✓ Test 2 Passed: Tracked decision created in SQLite store.")

    # 3. Trigger Watcher Cycle Manually
    print("\n[TEST 3 - Trigger Watcher Cycle via API]")
    trigger_res = client.post("/api/watcher/trigger-now")
    assert trigger_res.status_code == 200
    cycle_data = trigger_res.json()
    print(f"Cycle #{cycle_data['cycle_number']} Checked: {cycle_data['checked_count']} | Alerts: {cycle_data['alerts_count']}")
    assert cycle_data["checked_count"] >= 1
    print("✓ Test 3 Passed: Watcher cycle executed cleanly across tracked missions.")

    # 4. Generate Safety Clearance Manifest (JSON)
    print("\n[TEST 4 - Generate Safety Clearance Manifest JSON]")
    manifest_res = client.get(f"/api/decisions/{dec_id}/manifest")
    assert manifest_res.status_code == 200
    manifest = manifest_res.json()
    print(f"Manifest ID: {manifest['manifest_id']}")
    print(f"Checksum: {manifest['verification_checksum']}")
    print(f"Vessel: {manifest['vessel_info']['vessel_name']} | Skipper: {manifest['vessel_info']['skipper']}")
    print(f"Target Sector: {manifest['mission_plan']['destination_sector']}")
    print(f"Clearance: {manifest['clearance_verdict']['verdict']} ({manifest['clearance_verdict']['composite_score']}/100)")
    assert manifest["manifest_id"].startswith("ORCA-MAN-")
    assert len(manifest["verification_checksum"]) == 16
    assert manifest["clearance_verdict"]["verdict"] in ["GO", "CAUTION", "WAIT"]
    print("✓ Test 4 Passed: Tamper-proof JSON manifest generated successfully.")

    # 5. Generate Print-Ready HTML Certificate
    print("\n[TEST 5 - Generate Print-Ready HTML Certificate]")
    html_res = client.get(f"/api/decisions/{dec_id}/manifest?format=html")
    assert html_res.status_code == 200
    assert "text/html" in html_res.headers["content-type"]
    assert "Official Marine Voyage Safety Clearance Manifest" in html_res.text
    assert manifest["verification_checksum"] in html_res.text
    print(f"Generated HTML Certificate ({len(html_res.text)} characters)")
    print("✓ Test 5 Passed: Print-ready HTML certificate generated with verification checksum.")

    # 6. Invalid Decision ID Handling
    print("\n[TEST 6 - Manifest Error Handling for Nonexistent ID]")
    bad_res = client.get("/api/decisions/INVALID-DECISION-999/manifest")
    assert bad_res.status_code == 404
    print("✓ Test 6 Passed: Correctly returned 404 for invalid decision ID.")

    print("\n==================================================")
    print("🎉 ALL WATCHER DAEMON & MANIFEST TESTS PASSED (100%)!")
    print("==================================================")

if __name__ == "__main__":
    test_watcher_and_manifest_suite()
