import asyncio
from models.schemas import GeoLocation, MarineConditions, ZoneInfo
from modules.decision_store import create_and_store_decision, get_decision, clear_decisions
from modules.decision_engine import evaluate_decision
from modules.decision_watch import check_decision_conditions

async def run_phase5_tests():
    print("==================================================")
    print("RUNNING ORCA PHASE 5 DECISION WATCH & CHANGE TESTS")
    print("==================================================")

    clear_decisions()
    origin = GeoLocation(lat=9.966, lon=76.267, name="Kochi Port")

    zone_b = ZoneInfo(
        zone_id="zone_b",
        zone_name="Zone B (Offshore West)",
        pfz_score=86,
        pfz_label="High",
        centroid=GeoLocation(lat=10.05, lon=75.95),
        distance_km=18.0
    )

    # Initial calm conditions
    calm_baseline = {
        "wave_height_m": 1.35,
        "wind_speed_kmh": 12.0,
        "current_speed_ms": 0.3,
        "visibility_km": 10.0,
        "weather_code": 1,
        "lightning_alert": False,
        "cyclone_alert": False,
        "sst_celsius": 27.8
    }

    initial_safe_conditions = MarineConditions(
        timestamp="2026-08-26T06:00:00Z",
        location=zone_b.centroid,
        **calm_baseline,
        data_source="demo"
    )

    eval_result = evaluate_decision(zone_b, initial_safe_conditions, boundary_violations=[])
    assert eval_result.status == "GO"

    dec_obj = create_and_store_decision(
        decision_result=eval_result,
        origin=origin,
        user_id="user_fisherman",
        user_name="Raju",
        language="en",
        planned_start="2026-08-26T06:00:00Z",
        original_query="Is Zone B safe?"
    )
    dec_id = dec_obj.decision_id
    print(f"Base Tracked Decision: {dec_id} (Status: {dec_obj.original_decision.status}, Score: {dec_obj.original_decision.score})")

    # -------------------------------------------------------------
    # TEST 1: Recheck with safe conditions -> affected = False
    # -------------------------------------------------------------
    print("\n[TEST 1 - Recheck with Safe Conditions (Wave 1.35m, Wind 12 km/h)]")
    res1 = await check_decision_conditions(dec_id, override_conditions=dict(calm_baseline))
    print(f"Affected: {res1.affected} | Status: {res1.current_status} | Summary: {res1.summary}")
    assert res1.affected is False
    assert res1.current_status == "GO"
    print("✓ Test 1 Passed: Safe conditions do not affect decision.")

    # -------------------------------------------------------------
    # TEST 2: Wave crosses safety threshold (1.35m -> 2.8m) -> affected = True
    # -------------------------------------------------------------
    print("\n[TEST 2 - Wave Crosses Safety Threshold (1.35m -> 2.8m)]")
    res2 = await check_decision_conditions(dec_id, override_conditions={**calm_baseline, "wave_height_m": 2.8})
    print(f"Affected: {res2.affected} | Previous: {res2.previous_status} -> Current: {res2.current_status}")
    print(f"Changed Factor: {res2.changed_factors[0].factor} ({res2.changed_factors[0].previous_value} -> {res2.changed_factors[0].current_value})")
    assert res2.affected is True
    assert res2.current_status in ["CAUTION", "WAIT"]
    assert res2.changed_factors[0].threshold_crossed is True
    print("✓ Test 2 Passed: Wave threshold crossing detected and marked affected.")

    # -------------------------------------------------------------
    # TEST 3: Wind crosses threshold (12 km/h -> 52 km/h) -> affected = True
    # -------------------------------------------------------------
    print("\n[TEST 3 - Wind Escalates to Storm Level (52 km/h)]")
    res3 = await check_decision_conditions(dec_id, override_conditions={**calm_baseline, "wind_speed_kmh": 52.0})
    print(f"Affected: {res3.affected} | Status: {res3.current_status}")
    assert res3.affected is True
    assert res3.current_status == "WAIT"
    print("✓ Test 3 Passed: Hazardous wind escalation detected.")

    # -------------------------------------------------------------
    # TEST 4: Small numerical change in safe range (12 -> 13 km/h) -> affected = False
    # -------------------------------------------------------------
    print("\n[TEST 4 - Minor Numerical Change Within Safe Category (12 -> 13 km/h)]")
    res4 = await check_decision_conditions(dec_id, override_conditions={**calm_baseline, "wind_speed_kmh": 13.0})
    print(f"Affected: {res4.affected} | Status: {res4.current_status}")
    assert res4.affected is False
    assert res4.current_status == "GO"
    print("✓ Test 4 Passed: Minor non-material change ignored.")

    # -------------------------------------------------------------
    # TEST 5: Severe Weather / Lightning Hard Stop -> affected = True
    # -------------------------------------------------------------
    print("\n[TEST 5 - Convective Lightning Storm Alert]")
    res5 = await check_decision_conditions(dec_id, override_conditions={**calm_baseline, "lightning_alert": True})
    print(f"Affected: {res5.affected} | Status: {res5.current_status}")
    assert res5.affected is True
    assert res5.current_status == "WAIT"
    print("✓ Test 5 Passed: Severe weather alert forces WAIT status.")

    # -------------------------------------------------------------
    # IMMUTABILITY & HISTORY VERIFICATION
    # -------------------------------------------------------------
    print("\n[VERIFICATION - Snapshot Immutability & History Accumulation]")
    stored_final = get_decision(dec_id)
    orig_snapshot_wave = stored_final["original_conditions"]["wave_height_m"]
    orig_snapshot_status = stored_final["original_decision"]["status"]
    history_count = len(stored_final["change_history"])

    print(f"Original Wave in Snapshot: {orig_snapshot_wave}m (Expected 1.35m)")
    print(f"Original Status in Snapshot: {orig_snapshot_status} (Expected GO)")
    print(f"Total Change History Records Logged: {history_count}")

    assert orig_snapshot_wave == 1.35
    assert orig_snapshot_status == "GO"
    assert history_count == 5
    print("✓ Verification Passed: Original conditions remain untouched and 5 checks recorded in history.")

    print("\n==================================================")
    print("ALL PHASE 5 DECISION WATCH TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_phase5_tests())
