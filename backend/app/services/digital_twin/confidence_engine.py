"""
Confidence Engine — Evidence-based confidence scoring.
Confidence is derived from data quality metrics, not hardcoded or randomized.
"""
from __future__ import annotations

from app.services.digital_twin.schemas import (
    Confidence, DataQualityResult, TrendResult, VolatilityResult,
)
from app.services.digital_twin.data_quality import (
    MIN_SNAPSHOTS_FOR_HIGH, MIN_SNAPSHOTS_FOR_MEDIUM,
    MIN_DAYS_FOR_HIGH, MIN_DAYS_FOR_MEDIUM,
)


def score(
    quality: DataQualityResult,
    trend: TrendResult,
    volatility: VolatilityResult,
) -> tuple[str, str]:
    """
    Returns (confidence_level, evidence_strength) tuple.
    confidence_level: insufficient / low / medium / high
    evidence_strength: weak / moderate / strong
    """
    if not quality.is_sufficient:
        return Confidence.INSUFFICIENT, "weak"

    n = quality.snapshot_count
    days = quality.days_coverage

    # Start from HIGH and penalize down
    points = 0  # 0 = low, 1 = medium, 2 = high

    # Snapshot count points
    if n >= MIN_SNAPSHOTS_FOR_HIGH:
        points += 2
    elif n >= MIN_SNAPSHOTS_FOR_MEDIUM:
        points += 1

    # Days coverage points
    if days >= MIN_DAYS_FOR_HIGH:
        points += 2
    elif days >= MIN_DAYS_FOR_MEDIUM:
        points += 1

    # Volatility penalty
    if volatility.volatility_label == "high":
        points -= 2
    elif volatility.volatility_label == "medium":
        points -= 1

    # Missing data penalty: if we have spikes without explanation
    if volatility.spike_count >= 3:
        points -= 1

    # Determine level
    if points >= 4:
        level = Confidence.HIGH
    elif points >= 2:
        level = Confidence.MEDIUM
    else:
        level = Confidence.LOW

    # Evidence strength
    if level == Confidence.HIGH and n >= MIN_SNAPSHOTS_FOR_HIGH:
        strength = "strong"
    elif level in (Confidence.MEDIUM, Confidence.HIGH):
        strength = "moderate"
    else:
        strength = "weak"

    return level, strength


def explain(
    level: str,
    quality: DataQualityResult,
    trend: TrendResult,
    volatility: VolatilityResult,
) -> list[str]:
    """Generate human-readable confidence explanation lines."""
    reasons: list[str] = []

    if level == Confidence.HIGH:
        reasons.append(
            f"High confidence because {quality.snapshot_count} snapshots "
            f"span {quality.days_coverage} days of history."
        )
        if volatility.volatility_label == "low":
            reasons.append("Follower growth pattern is smooth and consistent.")
        if not trend.engagement_decay_detected:
            reasons.append("Engagement rate shows no significant decay.")

    elif level == Confidence.MEDIUM:
        reasons.append(
            f"Medium confidence — {quality.snapshot_count} snapshots "
            f"over {quality.days_coverage} days."
        )
        if volatility.volatility_label in ("medium", "high"):
            reasons.append(
                "Volatility detected reduces forecast precision. "
                "Projections should be treated as directional."
            )

    elif level == Confidence.LOW:
        reasons.append(
            f"Low confidence — only {quality.snapshot_count} snapshots "
            f"spanning {quality.days_coverage} days."
        )
        reasons.append(
            "More data points collected over a longer timeframe will improve accuracy."
        )
        if volatility.volatility_label == "high":
            reasons.append("High volatility makes precise forecasting unreliable.")

    else:  # insufficient
        reasons.append("Insufficient data — forecast cannot be generated.")

    return reasons
