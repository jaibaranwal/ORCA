import asyncio
from modules.decision_engine import evaluate_decision
from models.schemas import ZoneInfo, Location, MarineConditions
from adapters.boundary_adapter import BoundaryAdapter

def test_decision_engine():
    print("==================================================")
    print("RUNNING ORCA PHASE 2 DETERMINISTIC DECISION TESTS")
    print("==================================================")

    origin = Location(lat=9.966, lon=76.267, name="Kochi Port")

    # TEST CASE 1: Standard Safe Conditions -> Should be GO
    zone_b = ZoneInfo(
        zone_id="zone_b",
        zone_name="Zone B (Offshore West)",
        pfz_score=86,
        pfz_label="High",
        centroid=Location(lat=10.05, lon=75.95, name="Zone B Center"),
        distance_km=18.0,
        restricted=False
    )
    safe_conditions = MarineConditions(
        timestamp="2026-08-26T06:00:00Z",
        location=zone_b.centroid,
        wave_height_m=1.3,
        wave_direction_deg=220.0,
        wave_period_s=7.5,
        wind_speed_kmh=12.0,
        wind_direction_deg=210.0,
        current_speed_ms=0.3,
        weather_code=1,
        visibility_km=10.0,
        sst_celsius=27.8,
        data_source="demo"
    )

    res_go = evaluate_decision(zone_b, safe_conditions, boundary_violations=[])
    print(f"\n[TEST 1 - Normal Favourable Conditions]")
    print(f"Verdict: {res_go.status} | Score: {res_go.score}/100 (Safety: {res_go.safety_score}%, PFZ: {res_go.fishing_score}%, Effort: {res_go.effort_score}%)")
    print(f"Reasons count: {len(res_go.reasons)}")
    assert res_go.status == "GO", f"Expected GO, got {res_go.status}"
    print("✓ Test 1 Passed: GO produced correctly.")

    # TEST CASE 2: High Wave Unsafe Condition -> Should be WAIT (Safety Override)
    unsafe_wave_conditions = safe_conditions.model_copy(update={"wave_height_m": 3.2})
    res_wait_wave = evaluate_decision(zone_b, unsafe_wave_conditions, boundary_violations=[])
    print(f"\n[TEST 2 - High Wave Unsafe Conditions (3.2m)]")
    print(f"Verdict: {res_wait_wave.status} | Score: {res_wait_wave.score}/100 (Safety: {res_wait_wave.safety_score}%)")
    print(f"Top Reason: {res_wait_wave.reasons[0]}")
    assert res_wait_wave.status == "WAIT", f"Expected WAIT, got {res_wait_wave.status}"
    print("✓ Test 2 Passed: Safety override forced WAIT on unsafe waves.")

    # TEST CASE 3: Restricted Maritime Boundary Violation -> Should be Hard Stop WAIT
    boundary_adapter = BoundaryAdapter()
    # Coordinates inside restricted naval zone (Lon 75.45, Lat 10.60)
    is_violated, reasons = boundary_adapter.check_point_boundary(lat=10.60, lon=75.45)
    assert is_violated is True, "Expected boundary violation"
    
    restricted_zone = ZoneInfo(
        zone_id="zone_restricted",
        zone_name="Restricted Naval Sector",
        pfz_score=95,  # High PFZ should still be blocked by boundary hard stop
        pfz_label="Very High",
        centroid=Location(lat=10.60, lon=75.45),
        distance_km=40.0
    )
    res_boundary = evaluate_decision(restricted_zone, safe_conditions, boundary_violations=reasons)
    print(f"\n[TEST 3 - Boundary Hard Stop (High PFZ in Restricted Zone)]")
    print(f"Verdict: {res_boundary.status} | Hard Stop: {res_boundary.hard_stop} | Boundary Violated: {res_boundary.boundary_violation}")
    print(f"Reason: {res_boundary.reasons[0]}")
    assert res_boundary.status == "WAIT" and res_boundary.hard_stop is True
    print("✓ Test 3 Passed: Boundary check correctly triggered Hard Stop WAIT.")

    # TEST CASE 4: Moderate/Caution Conditions -> Should be CAUTION
    caution_conditions = safe_conditions.model_copy(update={"wave_height_m": 2.2, "wind_speed_kmh": 40.0})
    res_caution = evaluate_decision(zone_b, caution_conditions, boundary_violations=[])
    print(f"\n[TEST 4 - Moderate Winds & Sea State (2.2m waves, 40 km/h wind)]")
    print(f"Verdict: {res_caution.status} | Score: {res_caution.score}/100 (Safety: {res_caution.safety_score}%)")
    assert res_caution.status == "CAUTION", f"Expected CAUTION, got {res_caution.status}"
    print("✓ Test 4 Passed: CAUTION produced correctly.")

    print("\n==================================================")
    print("ALL DETERMINISTIC DECISION ENGINE TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_decision_engine()
