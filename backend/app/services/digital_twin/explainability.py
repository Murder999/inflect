"""
Explainability — Generate evidence-based explanations for each forecast dimension.
No generic statements. Every explanation must be traceable to actual data.
"""
from __future__ import annotations

from app.services.digital_twin.schemas import (
    TrendResult, VolatilityResult, RiskProjection,
    DataQualityResult, EvidenceLabel,
)


def growth_evidence(
    trend: TrendResult,
    volatility: VolatilityResult,
    horizon_days: int,
    projection_pct: float,
) -> dict:
    """Evidence for follower growth forecast."""
    basis: list[str] = []
    labels: list[str] = []

    direction = trend.growth_direction
    rate_pct_per_month = trend.weighted_daily_growth_rate * 30 * 100

    if direction == "positive":
        basis.append(
            f"Sustained positive growth trend across {trend.snapshot_count} snapshots."
        )
        labels.append(EvidenceLabel.HISTORICAL_TREND)
    elif direction == "negative":
        basis.append(
            "Declining follower trajectory detected across recent snapshots."
        )
        labels.append(EvidenceLabel.HISTORICAL_TREND)
    else:
        basis.append("Follower count is approximately flat — no clear directional trend.")
        labels.append(EvidenceLabel.HISTORICAL_TREND)

    basis.append(
        f"Weighted monthly growth rate: {rate_pct_per_month:+.2f}% "
        f"(recency-weighted across all periods)."
    )
    labels.append(EvidenceLabel.VELOCITY_ANALYSIS)

    if volatility.has_spikes:
        basis.append(
            f"{volatility.spike_count} spike(s) detected — these inflate the average rate. "
            f"Range projection accounts for this uncertainty."
        )
        labels.append(EvidenceLabel.VOLATILITY)

    if volatility.has_crashes:
        basis.append(
            f"{volatility.crash_count} drop(s) detected — downside risk is included in range."
        )
        labels.append(EvidenceLabel.VOLATILITY)

    return {
        "dimension": "growth",
        "projection_pct": round(projection_pct, 2),
        "horizon_days": horizon_days,
        "labels": list(dict.fromkeys(labels)),  # deduplicated, order-preserved
        "basis": basis,
    }


def engagement_evidence(
    trend: TrendResult,
    horizon_days: int,
    projection_pct: float,
) -> dict:
    """Evidence for engagement rate forecast."""
    basis: list[str] = []
    labels: list[str] = []

    basis.append(
        f"Current engagement rate: {trend.er_current:.2f}%. "
        f"Trend direction: {trend.er_direction}."
    )
    labels.append(EvidenceLabel.SNAPSHOT_EVIDENCE)

    if trend.engagement_decay_detected:
        basis.append(
            "Engagement decay detected: second half of snapshots shows lower ER "
            "than first half — audience interaction is weakening."
        )
        labels.append(EvidenceLabel.RISK_SIGNAL)
    else:
        basis.append(
            "No significant engagement decay detected across snapshot history."
        )
        labels.append(EvidenceLabel.AUDIENCE_CONSISTENCY)

    slope_per_month = trend.er_slope * 30
    if abs(slope_per_month) > 0.01:
        basis.append(
            f"Linear trend slope: {slope_per_month:+.3f} ER/month."
        )
        labels.append(EvidenceLabel.VELOCITY_ANALYSIS)

    return {
        "dimension": "engagement",
        "projection_pct": round(projection_pct, 2),
        "horizon_days": horizon_days,
        "labels": list(dict.fromkeys(labels)),
        "basis": basis,
    }


def risk_evidence(risk: RiskProjection) -> dict:
    """Evidence for risk trajectory."""
    labels: list[str] = []
    if risk.fraud_risk_trend in ("worsening",):
        labels.append(EvidenceLabel.RISK_SIGNAL)
    if risk.audience_quality_decay:
        labels.append(EvidenceLabel.AUDIENCE_CONSISTENCY)
    if risk.volatility_risk:
        labels.append(EvidenceLabel.VOLATILITY)
    if not labels:
        labels.append(EvidenceLabel.SNAPSHOT_EVIDENCE)

    return {
        "dimension": "risk",
        "overall_trend": risk.overall_trend,
        "labels": list(dict.fromkeys(labels)),
        "drivers": risk.drivers,
    }


def campaign_evidence(
    trend: TrendResult,
    risk: RiskProjection,
    readiness: str,
    recommendation: str,
) -> dict:
    """Evidence for campaign readiness recommendation."""
    basis: list[str] = []
    labels: list[str] = []

    if trend.growth_direction == "positive":
        basis.append("Positive growth trend supports near-term collaboration.")
        labels.append(EvidenceLabel.HISTORICAL_TREND)
    if trend.engagement_decay_detected:
        basis.append("Engagement decay reduces long-term campaign value.")
        labels.append(EvidenceLabel.RISK_SIGNAL)
    if risk.volatility_risk:
        basis.append("High volatility increases partnership risk.")
        labels.append(EvidenceLabel.VOLATILITY)
    if risk.sponsorship_overload_risk:
        basis.append("Possible sponsorship saturation detected.")
        labels.append(EvidenceLabel.RISK_SIGNAL)
    if not basis:
        basis.append("Metrics are stable with no elevated risk signals.")
        labels.append(EvidenceLabel.SNAPSHOT_EVIDENCE)

    return {
        "dimension": "campaign_readiness",
        "readiness": readiness,
        "recommendation": recommendation,
        "labels": list(dict.fromkeys(labels)),
        "basis": basis,
    }
