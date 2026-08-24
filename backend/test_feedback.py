from models.schemas import GeoLocation, MarineConditions, ZoneInfo, MissionFeedback
from modules.decision_store import create_and_store_decision, get_decision, clear_decisions
from modules.decision_engine import evaluate_decision
from modules.decision_feedback import record_mission_feedback, get_mission_feedback

def test_feedback_lifecycle():
    print("==================================================")
    print("RUNNING ORCA PHASE 7 LIVING FEEDBACK & OUTCOME TESTS")
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

    initial_conditions = MarineConditions(
        timestamp="2026-08-26T06:00:00Z",
        location=zone_b.centroid,
        wave_height_m=1.35,
        wind_speed_kmh=12.5,
        current_speed_ms=0.3,
        visibility_km=10.0,
        weather_code=1,
        sst_celsius=27.8,
        data_source="demo"
    )

    eval_result = evaluate_decision(zone_b, initial_conditions, boundary_violations=[])
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
    print(f"Base Tracked Decision: {dec_id} (Predicted Wave: {initial_conditions.wave_height_m}m, Wind: {initial_conditions.wind_speed_kmh} km/h)")

    # -------------------------------------------------------------
    # TEST 1: Feedback submission works & returns comparisons
    # -------------------------------------------------------------
    print("\n[TEST 1 - Submit Mission Feedback]")
    feedback_data = MissionFeedback(
        actual_wave_height_m=1.40,
        actual_wind_speed_kmh=14.0,
        fishing_outcome="Good",
        comment="Great catch of Indian Mackerel at the shelf edge!"
    )
    fb_res = record_mission_feedback(dec_id, feedback_data)
    
    assert fb_res.status == "COMPLETED"
    assert len(fb_res.comparisons) == 2
    print(f"Feedback Submission Result: {fb_res.status} | Comparisons Count: {len(fb_res.comparisons)}")
    print("✓ Test 1 Passed: Feedback recorded and comparisons generated.")

    # -------------------------------------------------------------
    # TEST 2: Prediction vs Actual Comparisons logic
    # -------------------------------------------------------------
    print("\n[TEST 2 - Verify Prediction vs Actual Comparison Accuracy]")
    wave_comp = next((c for c in fb_res.comparisons if c.metric == "Wave Height"), None)
    wind_comp = next((c for c in fb_res.comparisons if c.metric == "Wind Speed"), None)

    assert wave_comp is not None
    assert wind_comp is not None

    print(f"Wave: Pred={wave_comp.predicted}m, Actual={wave_comp.actual}m, Diff={wave_comp.difference}m -> Verdict='{wave_comp.verdict}'")
    print(f"Wind: Pred={wind_comp.predicted} km/h, Actual={wind_comp.actual} km/h, Diff={wind_comp.difference} km/h -> Verdict='{wind_comp.verdict}'")

    assert wave_comp.verdict == "Close to prediction"
    assert wind_comp.verdict == "Close to prediction"
    print("✓ Test 2 Passed: Comparison verdicts computed accurately.")

    # -------------------------------------------------------------
    # TEST 3: Decision is marked COMPLETED and tracking disabled
    # -------------------------------------------------------------
    print("\n[TEST 3 - Verify COMPLETED Lifecycle State]")
    stored = get_decision(dec_id)
    assert stored["lifecycle_status"] == "COMPLETED"
    assert stored["current_status"] == "COMPLETED"
    assert stored["tracking_enabled"] is False
    print(f"Stored Lifecycle Status: {stored['lifecycle_status']} | Tracking Enabled: {stored['tracking_enabled']}")
    print("✓ Test 3 Passed: Mission marked as completed in database.")

    # -------------------------------------------------------------
    # TEST 4 & 5: Immutability of Original Decision & Conditions
    # -------------------------------------------------------------
    print("\n[TEST 4 & 5 - Verify Snapshot Immutability]")
    assert stored["original_decision"]["status"] == "GO"
    assert stored["original_decision"]["score"] == 96
    assert stored["original_conditions"]["wave_height_m"] == 1.35
    assert stored["original_conditions"]["wind_speed_kmh"] == 12.5
    print(f"Original Decision in Snapshot: {stored['original_decision']['status']} (Score {stored['original_decision']['score']})")
    print(f"Original Wave in Snapshot: {stored['original_conditions']['wave_height_m']}m")
    print("✓ Test 4 & 5 Passed: Original conditions and decisions remain strictly immutable.")

    # -------------------------------------------------------------
    # TEST 6: Feedback is Persisted and Retrievable
    # -------------------------------------------------------------
    print("\n[TEST 6 - Retrieve Feedback via get_mission_feedback]")
    retrieved_fb = get_mission_feedback(dec_id)
    assert retrieved_fb is not None
    assert retrieved_fb.feedback.fishing_outcome == "Good"
    assert retrieved_fb.feedback.actual_wave_height_m == 1.40
    print(f"Retrieved Fishing Outcome: {retrieved_fb.feedback.fishing_outcome} | Comment: '{retrieved_fb.feedback.comment}'")
    print("✓ Test 6 Passed: Feedback successfully retrieved from persistence layer.")

    # -------------------------------------------------------------
    # TEST 7: Invalid Decision ID is Handled Safely
    # -------------------------------------------------------------
    print("\n[TEST 7 - Invalid Decision ID Handling]")
    try:
        record_mission_feedback("INVALID-ID-9999", feedback_data)
        assert False, "Should have raised ValueError for invalid ID"
    except ValueError as e:
        print(f"Correctly caught error: {e}")
        print("✓ Test 7 Passed: Invalid decision ID rejected safely.")

    print("\n==================================================")
    print("ALL PHASE 7 LIVING FEEDBACK TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_feedback_lifecycle()
