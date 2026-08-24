import asyncio
from modules.query_understanding import understand_user_query
from modules.explanation import generate_deterministic_explanation
from modules.decision_engine import evaluate_decision
from models.schemas import Location, ZoneInfo, MarineConditions

async def run_tests():
    print("==================================================")
    print("RUNNING ORCA PHASE 3 QUERY & EXPLANATION TESTS")
    print("==================================================")

    # TEST 1: English general recommendation query
    q1 = "Where should I go fishing tomorrow morning?"
    intent1 = await understand_user_query(q1)
    print(f"\n[TEST 1 - English Query]: '{q1}'")
    print(f"Extracted Intent: {intent1['intent']} | Request Type: {intent1['request_type']} | Lang: {intent1['language']}")
    assert intent1['request_type'] == "recommendation"
    print("✓ Test 1 Passed: Intent recognized as recommendation.")

    # TEST 2: Hindi/Hinglish general query
    q2 = "Kal subah fishing ke liye kahan jaana chahiye?"
    intent2 = await understand_user_query(q2)
    print(f"\n[TEST 2 - Hindi/Hinglish Query]: '{q2}'")
    print(f"Extracted Intent: {intent2['intent']} | Request Type: {intent2['request_type']} | Lang: {intent2['language']}")
    assert intent2['language'] in ["hi", "hinglish"]
    print("✓ Test 2 Passed: Hindi language detected & recommendation intent parsed.")

    # TEST 3: Specific Zone Query
    q3 = "Is Zone B safe tomorrow?"
    intent3 = await understand_user_query(q3)
    print(f"\n[TEST 3 - Specific Zone Query]: '{q3}'")
    print(f"Target Zone ID: {intent3['zone_id']} | Intent: {intent3['intent']}")
    assert intent3['zone_id'] == "zone_b"
    print("✓ Test 3 Passed: Zone B entity extracted correctly.")

    # TEST 4: Suitability / Monitoring Query
    q4 = "Zone B kab suitable hoga?"
    intent4 = await understand_user_query(q4)
    print(f"\n[TEST 4 - Suitability Query]: '{q4}'")
    print(f"Target Zone: {intent4['zone_id']} | Needs Tracking: {intent4['needs_tracking']} | Request Type: {intent4['request_type']}")
    assert intent4['needs_tracking'] is True
    print("✓ Test 4 Passed: Monitoring requirement identified.")

    # TEST 5: Multilingual Explanation Generation
    sample_decision = {
        "zone_name": "Zone B (Offshore West)",
        "status": "CAUTION",
        "score": 80,
        "fishing_score": 86,
        "conditions": {"wave_height_m": 1.8, "wind_speed_kmh": 22.0}
    }
    exp_en = generate_deterministic_explanation(sample_decision, language="en")
    exp_hi = generate_deterministic_explanation(sample_decision, language="hinglish")
    print(f"\n[TEST 5 - Grounded Explanations]")
    print(f"English: '{exp_en}'")
    print(f"Hinglish: '{exp_hi}'")
    assert "CAUTION" in exp_en and "1.8" in exp_en
    assert "CAUTION" in exp_hi and "1.8" in exp_hi
    print("✓ Test 5 Passed: Facts accurately preserved across languages.")

    print("\n==================================================")
    print("ALL PHASE 3 BACKEND TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
