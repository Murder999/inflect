"""
Forecast Engine — Deterministic projection computations for each horizon.
All projections are derived from observed trends and volatility.
No random values, no hardcoded patterns.
"""
from __future__ import annotations

from app.services.digital_twin.schemas import (
    SnapshotPoint, TrendResult, VolatilityResult, RiskProjection,
    HorizonForecast, FORECAST_HORIZONS, Confidence,
)
from app.services.digital_twin.confidence_engine import score as confidence_score
from app.services.digital_twin.campaign_readiness import assess as campaign_assess
from app.services.digital_twin import explainability as explain_mod
from app.services.digital_twin.data_quality import DataQualityResult

# Dampening factor: long horizons have more uncertainty
# Each doubling of horizon increases dampening
HORIZON_DAMPENING = {
    30:  1.0,
    90:  0.85,
    180: 0.70,
    365: 0.55,
}

# Range width based on volatility label
RANGE_MULTIPLIER = {
    "low":               0.30,  # ±30% of projection
    "medium":            0.55,
    "high":              0.85,
    "insufficient_data": 1.0,
}


def project_all(
    snapshots: list[SnapshotPoint],
    trend: TrendResult,
    volatility: VolatilityResult,
    risk: RiskProjection,
    quality: DataQualityResult,
) -> list[HorizonForecast]:
    """
    Generate HorizonForecast for each standard horizon.
    """
    conf_level, _ = confidence_score(quality, trend, volatility)

    results: list[HorizonForecast] = []
    current_followers = snapshots[-1].followers if snapshots else 0

    for horizon in FORECAST_HORIZONS:
        hf = _project_horizon(
            horizon=horizon,
            current_followers=current_followers,
            trend=trend,
            volatility=volatility,
            risk=risk,
            quality=quality,
            conf_level=conf_level,
        )
        results.append(hf)

    return results


def _project_horizon(
    horizon: int,
    current_followers: int,
    trend: TrendResult,
    volatility: VolatilityResult,
    risk: RiskProjection,
    quality: DataQualityResult,
    conf_level: str,
) -> HorizonForecast:

    dampening = HORIZON_DAMPENING.get(horizon, 0.60)
    range_mult = RANGE_MULTIPLIER.get(volatility.volatility_label, 0.80)

    # ── Follower projection ──────────────────────────────────────────────────
    effective_rate = trend.weighted_daily_growth_rate * dampening
    followers_pct  = effective_rate * horizon * 100
    followers_proj = int(current_followers * (1 + effective_rate * horizon))

    # Range: symmetric around projection, scaled by volatility
    range_half = abs(followers_pct) * range_mult + (range_mult * 5)  # base ± buffer
    followers_range_low  = followers_pct - range_half
    followers_range_high = followers_pct + range_half

    # ── Engagement projection ────────────────────────────────────────────────
    current_er  = trend.er_current
    er_pct_change = (trend.er_slope * horizon * dampening) / max(current_er, 0.1) * 100
    projected_er  = max(current_er + trend.er_slope * horizon * dampening, 0.0)

    # ── Risk & stability ─────────────────────────────────────────────────────
    risk_trend_val      = risk.overall_trend
    stability_trend_val = _stability_from_signals(trend, volatility)

    # ── Campaign readiness ───────────────────────────────────────────────────
    readiness, rec = campaign_assess(trend, volatility, risk)

    # ── Limitations ──────────────────────────────────────────────────────────
    limitations = list(quality.limitations)
    if horizon >= 180 and conf_level != Confidence.HIGH:
        limitations.append(
            f"180-day forecast has wider uncertainty margins with {conf_level} confidence."
        )
    if conf_level == Confidence.LOW:
        limitations.append(
            "Low confidence — treat projections as directional only."
        )

    # ── Evidence ─────────────────────────────────────────────────────────────
    evidence = {
        "growth":   explain_mod.growth_evidence(trend, volatility, horizon, followers_pct),
        "engagement": explain_mod.engagement_evidence(trend, horizon, er_pct_change),
        "risk":     explain_mod.risk_evidence(risk),
        "campaign": explain_mod.campaign_evidence(trend, risk, readiness, rec),
    }

    return HorizonForecast(
        horizon_days=horizon,
        followers_current=current_followers,
        followers_projected=max(followers_proj, 0),
        followers_projection_pct=round(followers_pct, 2),
        followers_range_low_pct=round(followers_range_low, 2),
        followers_range_high_pct=round(followers_range_high, 2),
        engagement_current=round(current_er, 4),
        engagement_projected=round(projected_er, 4),
        engagement_projection_pct=round(er_pct_change, 2),
        engagement_decay_risk=trend.engagement_decay_detected,
        risk_trend=risk_trend_val,
        stability_trend=stability_trend_val,
        campaign_readiness=readiness,
        campaign_recommendation=rec,
        confidence=conf_level,
        limitations=limitations,
        evidence=evidence,
    )


def _stability_from_signals(
    trend: TrendResult,
    volatility: VolatilityResult,
) -> str:
    score = 0
    if trend.growth_direction == "positive":
        score += 1
    if volatility.volatility_label == "low":
        score += 2
    elif volatility.volatility_label == "high":
        score -= 2
    if trend.momentum_direction == "improving":
        score += 1
    elif trend.momentum_direction == "declining":
        score -= 1

    if score >= 3:
        return "improving"
    elif score >= 1:
        return "stable"
    else:
        return "declining"
