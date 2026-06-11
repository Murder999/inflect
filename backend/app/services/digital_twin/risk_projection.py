"""
Risk Projection — Forward-looking risk trajectory from historical signals.
Evidence-based: each driver is derived from measurable data.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.services.digital_twin.schemas import (
    SnapshotPoint, TrendResult, VolatilityResult, RiskProjection,
)

# Thresholds
FRAUD_SCORE_DANGEROUS   = 60    # fraud_score above this is concerning
INACTIVITY_THRESHOLD_DAYS = 60  # if newest snapshot > 60 days old
SPONSORSHIP_RATIO_HIGH  = 0.4   # >40% sponsored posts = overload risk
BURNOUT_DECAY_THRESHOLD = 0.20  # ER dropped >20% = burnout risk


def project(
    snapshots: list[SnapshotPoint],
    trend: TrendResult,
    volatility: VolatilityResult,
) -> RiskProjection:
    """
    Derive risk trajectory from historical data signals.
    Returns a RiskProjection with labelled drivers.
    """
    drivers: list[str] = []
    risk_factors: list[str] = []  # "increasing" signals

    # ── Fraud risk ────────────────────────────────────────────────────────────
    fraud_risk_trend = trend.fraud_trend
    if trend.avg_fraud_score > FRAUD_SCORE_DANGEROUS:
        risk_factors.append("fraud_high")
        drivers.append(
            f"Average fraud score is {trend.avg_fraud_score:.0f}/100 "
            f"(above risk threshold of {FRAUD_SCORE_DANGEROUS})."
        )
    if fraud_risk_trend == "worsening":
        risk_factors.append("fraud_worsening")
        drivers.append("Fraud score is trending upward across recent snapshots.")

    # ── Audience quality decay ────────────────────────────────────────────────
    audience_quality_decay = trend.engagement_decay_detected
    if audience_quality_decay:
        risk_factors.append("engagement_decay")
        drivers.append(
            "Engagement rate is declining — audience quality or interaction is weakening."
        )

    # ── Inactivity risk ───────────────────────────────────────────────────────
    inactivity_risk = False
    if snapshots:
        latest = max(snapshots, key=lambda s: s.captured_at)
        days_since = (datetime.now(timezone.utc) - latest.captured_at).days
        if days_since > INACTIVITY_THRESHOLD_DAYS:
            inactivity_risk = True
            risk_factors.append("inactivity")
            drivers.append(
                f"Last snapshot is {days_since} days old — "
                f"activity data may be stale."
            )

    # ── Volatility risk ───────────────────────────────────────────────────────
    volatility_risk = volatility.volatility_label == "high"
    if volatility_risk:
        risk_factors.append("volatility")
        drivers.append(
            "High follower volatility detected — audience stability is uncertain."
        )
    if volatility.has_spikes and volatility.spike_count >= 2:
        if "volatility" not in risk_factors:
            risk_factors.append("volatile_spikes")
        drivers.append(
            f"{volatility.spike_count} follower spike(s) detected — "
            f"possible inorganic growth events."
        )

    # ── Sponsorship overload risk ─────────────────────────────────────────────
    # Proxy: if engagement is declining while account is growing = sponsorship saturation
    sponsorship_overload_risk = (
        trend.growth_direction == "positive"
        and trend.engagement_decay_detected
        and trend.er_current < 2.0
    )
    if sponsorship_overload_risk:
        risk_factors.append("sponsorship_overload")
        drivers.append(
            "Growing follower count with declining engagement suggests "
            "potential sponsorship saturation."
        )

    # ── Burnout risk ──────────────────────────────────────────────────────────
    # Proxy: significant ER drop across full timeline
    burnout_risk = False
    if len(snapshots) >= 3:
        sorted_snaps = sorted(snapshots, key=lambda s: s.captured_at)
        first_er = sorted_snaps[0].engagement_rate
        last_er  = sorted_snaps[-1].engagement_rate
        if first_er > 0 and (first_er - last_er) / first_er > BURNOUT_DECAY_THRESHOLD:
            burnout_risk = True
            risk_factors.append("burnout")
            drivers.append(
                f"Engagement dropped {((first_er - last_er)/first_er*100):.1f}% "
                f"over the full history — possible creator burnout."
            )

    # ── Overall trend ────────────────────────────────────────────────────────
    n_increasing = len(risk_factors)
    if n_increasing == 0:
        overall_trend = "declining"    # risk is declining = good
        if not drivers:
            drivers.append("No significant risk signals detected across historical data.")
    elif n_increasing <= 1:
        overall_trend = "stable"
    else:
        overall_trend = "increasing"

    return RiskProjection(
        overall_trend=overall_trend,
        fraud_risk_trend=fraud_risk_trend,
        audience_quality_decay=audience_quality_decay,
        inactivity_risk=inactivity_risk,
        volatility_risk=volatility_risk,
        sponsorship_overload_risk=sponsorship_overload_risk,
        burnout_risk=burnout_risk,
        drivers=drivers,
    )
