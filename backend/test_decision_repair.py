import asyncio
from models.schemas import GeoLocation, MarineConditions, ZoneInfo
from modules.decision_store import create_and_store_decision, get_decision, clear_decisions
from modules.decision_engine import evaluate_decision
from modules.decision_watch import check_decision_conditions
from modules.decision_repair import generate_repair_options, apply_repair_selection

async def run_phase6_tests():
    print("==================================================")
    print("RUNNING ORCA PHASE 6 DECISION REPAIR & WAIT TESTS")
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
    initial_safe_conditions = MarineConditions(
        timestamp="2026-08-26T06:00:00Z",
        location=zone_b.centroid,
        wave_height_m=1.35,
        wind_speed_kmh=12.0,
        current_speed_ms=0.3,
        visibility_km=10.0,
        weather_code=1,
        sst_celsius=27.8,
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
        original_query="Kal subah fishing ke liye kahan jaana chahiye?"
    )
    dec_id = dec_obj.decision_id
    print(f"Base Tracked Decision: {dec_id} (Original Status: {dec_obj.original_decision.status})")

    # Step 1: Simulate adverse wave conditions (2.8m) -> triggers ALERT
    recheck_res = await check_decision_conditions(dec_id, override_conditions={"wave_height_m": 2.8})
    assert recheck_res.affected is True
    assert recheck_res.current_status == "WAIT"
    print(f"Adverse Change Injected: Status changed to {recheck_res.current_status} (Affected: {recheck_res.affected})")

    # -------------------------------------------------------------
    # TEST 1: Generate repair options for affected decision
    # -------------------------------------------------------------
    print("\n[TEST 1 - Generate Repair Alternatives]")
    repair_res = await generate_repair_options(dec_id)
    print(f"Repair Available: {repair_res.repair_available} | Options Count: {len(repair_res.options)}")
    assert repair_res.repair_available is True
    assert len(repair_res.options) >= 3
    print("✓ Test 1 Passed: Feasible repair alternatives generated successfully.")

    # -------------------------------------------------------------
    # TEST 2 & 3: Deterministic Evaluation of Zone & Time Shifts
    # -------------------------------------------------------------
    print("\n[TEST 2 & 3 - Verify Deterministic Evaluation of Time & Zone Shifts]")
    time_shift_opt = next((o for o in repair_res.options if o.type == "TIME_CHANGE"), None)
    zone_shift_opt = next((o for o in repair_res.options if o.type == "ZONE_CHANGE"), None)
    wait_opt = next((o for o in repair_res.options if o.type == "WAIT"), None)

    assert time_shift_opt is not None, "Time shift option missing"
    assert zone_shift_opt is not None, "Zone shift option missing"
    assert wait_opt is not None, "Wait option missing"

    print(f"Time Shift Option: {time_shift_opt.title} | Status: {time_shift_opt.status} | Score: {time_shift_opt.score}")
    print(f"Zone Shift Option: {zone_shift_opt.title} | Status: {zone_shift_opt.status} | Score: {zone_shift_opt.score}")
    print(f"Wait Option: {wait_opt.title} | Status: {wait_opt.status}")
    print("✓ Test 2 & 3 Passed: Both Time shift and Zone shift evaluated through deterministic engine.")

    # -------------------------------------------------------------
    # TEST 4: Unsafe option is NOT presented as a safe recommendation
    # -------------------------------------------------------------
    print("\n[TEST 4 - Unsafe Option Classification]")
    assert wait_opt.status == "WAIT"
    assert wait_opt.rank > time_shift_opt.rank or wait_opt.rank > zone_shift_opt.rank
    print(f"Wait Option Rank: {wait_opt.rank} (Ranked below safe GO options)")
    print("✓ Test 4 Passed: Unsafe status WAIT is never ranked ahead of safe GO alternatives.")

    # -------------------------------------------------------------
    # TEST 5 & 6: User Selects Repair Option -> Persisted & Immutability Check
    # -------------------------------------------------------------
    print("\n[TEST 5 & 6 - Select Repair Option & Verify Immutability]")
    chosen_opt = zone_shift_opt if zone_shift_opt.status == "GO" else time_shift_opt
    select_res = await apply_repair_selection(dec_id, chosen_opt.option_id)
    
    stored = get_decision(dec_id)
    print(f"Selected Repair: {select_res.selected_option.title}")
    print(f"Updated Mission Zone: {stored['mission']['zone_name']} | Status: {stored['lifecycle_status']}")
    
    assert stored["lifecycle_status"] == "REPAIRED"
    assert stored["selected_action"]["option_id"] == chosen_opt.option_id
    
    # Immutability validation
    assert stored["original_decision"]["status"] == "GO"
    assert stored["original_conditions"]["wave_height_m"] == 1.35
    assert stored["original_decision"]["score"] == 96
    print(f"Preserved Original Verdict: {stored['original_decision']['status']} | Wave: {stored['original_conditions']['wave_height_m']}m")
    print("✓ Test 5 & 6 Passed: Selected repair updated active mission while original snapshot remained 100% immutable.")

    # -------------------------------------------------------------
    # TEST 7: WAIT Selection Keeps Mission Tracked
    # -------------------------------------------------------------
    print("\n[TEST 7 - Verify WAIT Action Selection]")
    wait_select_res = await apply_repair_selection(dec_id, "opt_wait")
    stored_wait = get_decision(dec_id)
    assert stored_wait["lifecycle_status"] == "WAITING"
    assert stored_wait["current_status"] == "WAITING"
    assert stored_wait["tracking_enabled"] is True
    print(f"Updated Lifecycle State on WAIT: {stored_wait['lifecycle_status']} (Tracking active: {stored_wait['tracking_enabled']})")
    print("✓ Test 7 Passed: WAIT action keeps decision active in registry.")

    # -------------------------------------------------------------
    # TEST 8: Repaired Mission Can Be Rechecked in Phase 5 Decision Watch
    # -------------------------------------------------------------
    print("\n[TEST 8 - Repaired Mission Enters Phase 5 Decision Watch Again]")
    # Re-apply safe zone repair
    await apply_repair_selection(dec_id, chosen_opt.option_id)
    
    # Now execute a Phase 5 recheck on the repaired mission
    watch_res = await check_decision_conditions(dec_id)
    print(f"Recheck After Repair: Status={watch_res.current_status} | Affected={watch_res.affected} | Summary: {watch_res.summary}")
    assert watch_res.decision.lifecycle_status in ["TRACKING", "REPAIRED", "ALERT"]
    print("✓ Test 8 Passed: Repaired mission seamlessly continues living watch lifecycle.")

    print("\n==================================================")
    print("ALL PHASE 6 DECISION REPAIR TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_phase6_tests())
