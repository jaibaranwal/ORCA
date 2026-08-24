import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from models.schemas import (
    DecisionObject,
    MissionFeedback,
    ComparisonItem,
    FeedbackResponse,
    ChangeHistoryEntry
)
from modules.decision_store import get_decision, save_decision

logger = logging.getLogger("orca.decision_feedback")

def compute_condition_comparisons(
    predicted_wave: float,
    actual_wave: float,
    predicted_wind: float,
    actual_wind: float
) -> List[ComparisonItem]:
    """
    Deterministic comparison between predicted marine conditions and actual observations.
    """
    comparisons: List[ComparisonItem] = []

    # 1. Wave Height Comparison
    wave_diff = round(actual_wave - predicted_wave, 2)
    if abs(wave_diff) <= 0.35:
        wave_verdict = "Close to prediction"
    elif wave_diff > 0.35:
        wave_verdict = "Higher than predicted"
    else:
        wave_verdict = "Lower than predicted"

    comparisons.append(ComparisonItem(
        metric="Wave Height",
        predicted=predicted_wave,
        actual=actual_wave,
        difference=wave_diff,
        verdict=wave_verdict
    ))

    # 2. Wind Speed Comparison
    wind_diff = round(actual_wind - predicted_wind, 1)
    if abs(wind_diff) <= 5.0:
        wind_verdict = "Close to prediction"
    elif wind_diff > 5.0:
        wind_verdict = "Higher than predicted"
    else:
        wind_verdict = "Lower than predicted"

    comparisons.append(ComparisonItem(
        metric="Wind Speed",
        predicted=predicted_wind,
        actual=actual_wind,
        difference=wind_diff,
        verdict=wind_verdict
    ))

    return comparisons

def record_mission_feedback(decision_id: str, feedback: MissionFeedback) -> FeedbackResponse:
    """
    Records post-mission observation feedback, computes prediction vs actual comparison,
    marks mission as COMPLETED, and preserves original decision immutability.
    """
    raw_decision = get_decision(decision_id)
    if not raw_decision:
        raise ValueError(f"Decision '{decision_id}' not found in database.")

    # Read predicted conditions from latest active conditions (or original if unchanged)
    latest_cond = raw_decision.get("latest_conditions") or raw_decision.get("original_conditions")
    predicted_wave = float(latest_cond.get("wave_height_m", 1.35))
    predicted_wind = float(latest_cond.get("wind_speed_kmh", 12.5))

    comparisons = compute_condition_comparisons(
        predicted_wave=predicted_wave,
        actual_wave=feedback.actual_wave_height_m,
        predicted_wind=predicted_wind,
        actual_wind=feedback.actual_wind_speed_kmh
    )

    now_iso = datetime.utcnow().isoformat() + "Z"
    
    # Update lifecycle state to COMPLETED
    raw_decision["lifecycle_status"] = "COMPLETED"
    raw_decision["current_status"] = "COMPLETED"
    raw_decision["tracking_enabled"] = False
    raw_decision["feedback"] = feedback.model_dump()
    raw_decision["updated_at"] = now_iso

    # Append feedback event to change_history
    wave_comp = next((c for c in comparisons if c.metric == "Wave Height"), None)
    wind_comp = next((c for c in comparisons if c.metric == "Wind Speed"), None)
    
    history_summary = (
        f"Mission Completed. Outcome: {feedback.fishing_outcome}. "
        f"Wave: {feedback.actual_wave_height_m}m ({wave_comp.verdict if wave_comp else 'Reported'}), "
        f"Wind: {feedback.actual_wind_speed_kmh} km/h ({wind_comp.verdict if wind_comp else 'Reported'})."
    )

    history_entry = ChangeHistoryEntry(
        checked_at=now_iso,
        previous_status=raw_decision["original_decision"]["status"],
        new_status="COMPLETED",
        previous_score=raw_decision["original_decision"]["score"],
        new_score=100 if feedback.fishing_outcome == "Good" else 75 if feedback.fishing_outcome == "Average" else 40,
        affected=False,
        changed_factors=[],
        summary=history_summary,
        explanation=feedback.comment or "Mission completed and feedback recorded.",
        action_taken="FEEDBACK_SUBMISSION"
    )

    history_list = raw_decision.get("change_history", [])
    history_list.insert(0, history_entry.model_dump())
    raw_decision["change_history"] = history_list

    save_decision(raw_decision)
    updated_obj = DecisionObject(**raw_decision)

    return FeedbackResponse(
        decision_id=decision_id,
        status="COMPLETED",
        message="Mission outcome recorded successfully.",
        comparisons=comparisons,
        feedback=feedback,
        decision=updated_obj
    )

def get_mission_feedback(decision_id: str) -> Optional[FeedbackResponse]:
    """Retrieves saved feedback and comparison for a completed decision."""
    raw_decision = get_decision(decision_id)
    if not raw_decision:
        raise ValueError(f"Decision '{decision_id}' not found.")

    feedback_data = raw_decision.get("feedback")
    if not feedback_data:
        return None

    feedback = MissionFeedback(**feedback_data)
    latest_cond = raw_decision.get("latest_conditions") or raw_decision.get("original_conditions")
    predicted_wave = float(latest_cond.get("wave_height_m", 1.35))
    predicted_wind = float(latest_cond.get("wind_speed_kmh", 12.5))

    comparisons = compute_condition_comparisons(
        predicted_wave=predicted_wave,
        actual_wave=feedback.actual_wave_height_m,
        predicted_wind=predicted_wind,
        actual_wind=feedback.actual_wind_speed_kmh
    )

    return FeedbackResponse(
        decision_id=decision_id,
        status=raw_decision.get("lifecycle_status", "COMPLETED"),
        message="Stored feedback retrieved.",
        comparisons=comparisons,
        feedback=feedback,
        decision=DecisionObject(**raw_decision)
    )
