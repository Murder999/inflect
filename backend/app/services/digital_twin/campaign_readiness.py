"""
Campaign Readiness — Determine partnership timing recommendation.
Based on growth momentum, engagement health, and risk trajectory.
"""
from __future__ import annotations

from app.services.digital_twin.schemas import TrendResult, VolatilityResult, RiskProjection


def assess(
    trend: TrendResult,
    volatility: VolatilityResult,
    risk: RiskProjection,
) -> tuple[str, str]:
    """
    Returns (readiness_code, recommendation_text).
    readiness_code: ready / conditional / caution / not_recommended
    """
    # Score-based logic (deterministic)
    score = 0

    # Growth direction
    if trend.growth_direction == "positive":
        score += 2
    elif trend.growth_direction == "flat":
        score += 1

    # Engagement health
    if not trend.engagement_decay_detected:
        score += 2
    elif trend.er_direction == "declining":
        score -= 1

    # Volatility
    if volatility.volatility_label == "low":
        score += 1
    elif volatility.volatility_label == "high":
        score -= 2

    # Risk trend
    if risk.overall_trend == "declining":
        score += 1
    elif risk.overall_trend == "increasing":
        score -= 2

    # Hard penalties
    if risk.sponsorship_overload_risk:
        score -= 2
    if risk.volatility_risk and volatility.spike_count >= 3:
        score -= 1

    # Map to readiness
    if score >= 4:
        readiness = "ready"
        rec = (
            "Creator is in a positive growth phase with stable engagement. "
            "Recommended for both short-term campaigns and longer collaborations. "
            "Prioritize within the next 60 days while momentum is strong."
        )
    elif score >= 2:
        readiness = "conditional"
        caveats: list[str] = []
        if trend.engagement_decay_detected:
            caveats.append("engagement is declining")
        if volatility.volatility_label == "medium":
            caveats.append("moderate follower volatility")
        if risk.sponsorship_overload_risk:
            caveats.append("possible sponsorship saturation")
        caveat_str = (", ".join(caveats) or "some risk signals present")
        rec = (
            f"Creator has positive signals but {caveat_str}. "
            "Short-term campaigns are appropriate. "
            "Avoid long-term exclusivity agreements until metrics stabilize."
        )
    elif score >= 0:
        readiness = "caution"
        rec = (
            "Creator metrics show concerning trends. "
            "Only consider short, lower-commitment campaigns. "
            "Monitor for improvements before committing long-term budget."
        )
    else:
        readiness = "not_recommended"
        rec = (
            "Multiple risk signals detected. "
            "Engagement decay, high volatility, or rising risk make this "
            "creator unsuitable for campaign investment at this time. "
            "Re-evaluate when metrics improve."
        )

    return readiness, rec
