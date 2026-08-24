import asyncio
from models.schemas import GeoLocation, DecisionResult, MarineConditions, Location
from modules.decision_store import (
    create_and_store_decision,
    get_decision,
    list_decisions,
    cancel_decision,
    clear_decisions
)
from modules.decision_engine import evaluate_decision
from models.schemas import ZoneInfo

def test_decision_store_lifecycle():
    print("==================================================")
    print("RUNNING ORCA PHASE 4 DECISION OBJECT LIFECYCLE TESTS")
    print("==================================================")

    # 0. Clear store for isolated test
    clear_decisions()
    assert len(list_decisions()) == 0

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
        wave_direction_deg=220.0,
        wind_speed_kmh=12.5,
        wind_direction_deg=210.0,
        current_speed_ms=0.3,
        visibility_km=10.0,
        sst_celsius=27.8,
        data_source="demo"
    )

    eval_result = evaluate_decision(zone_b, initial_conditions, boundary_violations=[])

    # TEST 1: Create Decision Object and persist
    print("\n[TEST 1 - Create and Persist Decision Object]")
    decision_obj = create_and_store_decision(
        decision_result=eval_result,
        origin=origin,
        user_id="user_fisherman_raju",
        user_name="Raju",
        language="en",
        planned_start="2026-08-26T06:00:00Z",
        planned_return="2026-08-26T14:00:00Z",
        original_query="Where should I go fishing tomorrow morning?"
    )
    dec_id = decision_obj.decision_id
    print(f"Created Decision ID: {dec_id} | Status: {decision_obj.lifecycle_status}")
    assert dec_id.startswith("ORCA-DEC-")
    assert decision_obj.lifecycle_status == "TRACKING"
    assert decision_obj.tracking_enabled is True
    print("✓ Test 1 Passed: Decision Object created and assigned lifecycle status TRACKING.")

    # TEST 2: Retrieve Decision Object by ID
    print("\n[TEST 2 - Retrieve Decision Object from SQLite]")
    retrieved = get_decision(dec_id)
    assert retrieved is not None
    assert retrieved["decision_id"] == dec_id
    assert retrieved["mission"]["zone_id"] == "zone_b"
    assert retrieved["original_decision"]["status"] == "GO"
    print(f"Retrieved Zone: {retrieved['mission']['zone_name']} | Verdict: {retrieved['original_decision']['status']} | Score: {retrieved['original_decision']['score']}")
    print("✓ Test 2 Passed: Full object accurately deserialized from database.")

    # TEST 3: Original Conditions Immutability Check
    print("\n[TEST 3 - Condition Immutability Snapshot Test]")
    original_wave = retrieved["original_conditions"]["wave_height_m"]
    assert original_wave == 1.35, f"Expected 1.35m, got {original_wave}"
    
    # Simulate a new evaluation for another zone or newer rough sea state (3.0m)
    rough_conditions = initial_conditions.model_copy(update={"wave_height_m": 3.0})
    _ = evaluate_decision(zone_b, rough_conditions, boundary_violations=[])

    # Verify original Decision Object in database STILL retains 1.35m
    retrieved_again = get_decision(dec_id)
    assert retrieved_again["original_conditions"]["wave_height_m"] == 1.35
    print(f"Original Wave in Snapshot: {retrieved_again['original_conditions']['wave_height_m']}m (Protected from overwrite)")
    print("✓ Test 3 Passed: Snapshot of original decision conditions remains strictly immutable.")

    # TEST 4: List Tracked Decisions
    print("\n[TEST 4 - List Tracked Decisions]")
    dec_list = list_decisions()
    print(f"Total Decisions in Store: {len(dec_list)}")
    assert len(dec_list) == 1
    print("✓ Test 4 Passed: list_decisions returned valid records.")

    # TEST 5: Cancel / Stop Tracking
    print("\n[TEST 5 - Cancel / Stop Tracking]")
    cancelled = cancel_decision(dec_id)
    assert cancelled["lifecycle_status"] == "CANCELLED"
    assert cancelled["tracking_enabled"] is False
    print(f"Updated Lifecycle Status: {cancelled['lifecycle_status']} | Tracking: {cancelled['tracking_enabled']}")
    print("✓ Test 5 Passed: Decision tracking cancellation executed successfully.")

    print("\n==================================================")
    print("ALL PHASE 4 DECISION OBJECT LIFECYCLE TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_decision_store_lifecycle()
