"""
Brand Alignment Risk Engine — Part 15

Analyses brand_fit_score and reputation_risk_score trends from snapshots.
Detects brand alignment deterioration — a key signal for campaign risk.

No ideology, political, or protected-attribute inference is performed.
All signals are derived from quantitative score trends only.
"""
from __future__ import annotations

import statistics

from app.services.risk_radar.schemas import (
    RiskDimension, AnomalyEvent,
    CONF_LOW, CONF_MEDIUM, CONF_HIGH,
    TRAJ_DECLINING, TRAJ_STABLE, TRAJ_RISING,
    DIM_BRAND_ALIGNMENT, DIM_ENGAGEMENT_QUALITY, DIM_SENTIMENT,
    DIMENSION_LABELS, score_to_level,
)


def analyze_brand_alignment(snapshots: list) -> tuple[RiskDimension, list[AnomalyEvent]]:
    """
    Compute brand alignment risk from brand_fit_score and reputation_risk_score.

    A higher brand_fit_score = better brand alignment = lower risk.
    A higher reputation_risk_score = more reputational exposure = higher risk.
    """
    anomaly_events: list[AnomalyEvent] = []

    if not snapshots:
        return RiskDimension(
            name=DIM_BRAND_ALIGNMENT,
            label=DIMENSION_LABELS[DIM_BRAND_ALIGNMENT],
            score=50,
            level="medium",
            trend=TRAJ_STABLE,
            signals=["Snapshot verisi yok — varsayılan orta risk"],
            confidence=CONF_LOW,
        ), anomaly_events

    snaps = sorted(snapshots, key=lambda s: s.captured_at)

    brand_fit_vals = [s.brand_fit_score for s in snaps]
    rep_risk_vals  = [s.reputation_risk_score for s in snaps]

    avg_brand_fit  = statistics.mean(brand_fit_vals)
    avg_rep_risk   = statistics.mean(rep_risk_vals)

    # Risk score: combination of inverted brand_fit + reputation_risk
    # Both contribute equally
    risk_score = round(0.5 * (100 - avg_brand_fit) + 0.5 * avg_rep_risk)

    signals: list[str] = []

    # Brand fit level
    if avg_brand_fit < 30:
        signals.append(f"Brand fit düşük: ortalama {avg_brand_fit:.0f}/100 — marka uyumu zayıf")
    elif avg_brand_fit < 55:
        signals.append(f"Brand fit orta: ortalama {avg_brand_fit:.0f}/100")
    else:
        signals.append(f"Brand fit yeterli: ortalama {avg_brand_fit:.0f}/100")

    # Reputation risk level
    if avg_rep_risk > 65:
        signals.append(f"Yüksek itibar riski: ortalama {avg_rep_risk:.0f}/100")
    elif avg_rep_risk > 40:
        signals.append(f"Orta itibar riski: ortalama {avg_rep_risk:.0f}/100")
    else:
        signals.append(f"Düşük itibar riski: ortalama {avg_rep_risk:.0f}/100")

    # Trend: compare first half vs second half brand_fit
    if len(brand_fit_vals) >= 4:
        mid = len(brand_fit_vals) // 2
        early_fit = statistics.mean(brand_fit_vals[:mid])
        late_fit  = statistics.mean(brand_fit_vals[mid:])
        delta = late_fit - early_fit

        if delta < -8:
            trend = TRAJ_RISING   # risk is rising as brand alignment falls
            signals.append(f"Brand fit {abs(delta):.0f} puan geriledi — marka uyumu bozuluyor")
            if delta < -20:
                anomaly_events.append(AnomalyEvent(
                    anomaly_type="brand_alignment_decline",
                    description=f"Brand fit skoru {abs(delta):.0f} puan düştü (erken dönem: {early_fit:.0f} → son dönem: {late_fit:.0f})",
                    severity="high" if delta < -30 else "medium",
                    period="analiz penceresi",
                ))
        elif delta > 8:
            trend = TRAJ_DECLINING  # risk declining as alignment improves
            signals.append(f"Brand fit {delta:.0f} puan iyileşti")
        else:
            trend = TRAJ_STABLE
    else:
        trend = TRAJ_STABLE

    # Also check reputation risk trend
    if len(rep_risk_vals) >= 4:
        mid = len(rep_risk_vals) // 2
        early_rep = statistics.mean(rep_risk_vals[:mid])
        late_rep  = statistics.mean(rep_risk_vals[mid:])
        if late_rep > early_rep + 10:
            signals.append(f"İtibar riski artıyor: {early_rep:.0f} → {late_rep:.0f}")
            if trend == TRAJ_STABLE:
                trend = TRAJ_RISING

    n = len(snaps)
    conf = CONF_HIGH if n >= 6 else CONF_MEDIUM if n >= 3 else CONF_LOW

    return RiskDimension(
        name=DIM_BRAND_ALIGNMENT,
        label=DIMENSION_LABELS[DIM_BRAND_ALIGNMENT],
        score=risk_score,
        level=score_to_level(risk_score),
        trend=trend,
        signals=signals,
        confidence=conf,
    ), anomaly_events


def analyze_engagement_quality_risk(snapshots: list) -> RiskDimension:
    """
    Engagement quality risk — inverted engagement_quality_score.
    High quality engagement = low risk.
    """
    if not snapshots:
        return RiskDimension(
            name=DIM_ENGAGEMENT_QUALITY,
            label=DIMENSION_LABELS[DIM_ENGAGEMENT_QUALITY],
            score=50,
            level="medium",
            trend=TRAJ_STABLE,
            signals=["Veri yok — varsayılan orta risk"],
            confidence=CONF_LOW,
        )

    snaps = sorted(snapshots, key=lambda s: s.captured_at)
    eq_vals = [s.engagement_quality_score for s in snaps]
    avg_eq  = statistics.mean(eq_vals)
    risk    = round(100 - avg_eq)

    signals: list[str] = []
    if avg_eq < 30:
        signals.append(f"Düşük engagement kalitesi: {avg_eq:.0f}/100 — etkileşim güvenilirliği düşük")
    elif avg_eq < 60:
        signals.append(f"Orta engagement kalitesi: {avg_eq:.0f}/100")
    else:
        signals.append(f"İyi engagement kalitesi: {avg_eq:.0f}/100")

    # Trend
    if len(eq_vals) >= 4:
        mid = len(eq_vals) // 2
        early = statistics.mean(eq_vals[:mid])
        late  = statistics.mean(eq_vals[mid:])
        if late < early - 8:
            trend = TRAJ_RISING
            signals.append(f"Engagement kalitesi düşüyor: {early:.0f} → {late:.0f}")
        elif late > early + 8:
            trend = TRAJ_DECLINING
        else:
            trend = TRAJ_STABLE
    else:
        trend = TRAJ_STABLE

    n = len(snaps)
    conf = CONF_HIGH if n >= 6 else CONF_MEDIUM if n >= 3 else CONF_LOW

    return RiskDimension(
        name=DIM_ENGAGEMENT_QUALITY,
        label=DIMENSION_LABELS[DIM_ENGAGEMENT_QUALITY],
        score=risk,
        level=score_to_level(risk),
        trend=trend,
        signals=signals,
        confidence=conf,
    )


def analyze_sentiment_risk(snapshots: list) -> RiskDimension:
    """
    Audience sentiment risk from authenticity_score and fraud_risk label.
    Low authenticity + high fraud label = elevated sentiment risk.
    """
    if not snapshots:
        return RiskDimension(
            name=DIM_SENTIMENT,
            label=DIMENSION_LABELS[DIM_SENTIMENT],
            score=30,
            level="medium",
            trend=TRAJ_STABLE,
            signals=["Veri yok — varsayılan orta risk"],
            confidence=CONF_LOW,
        )

    snaps = sorted(snapshots, key=lambda s: s.captured_at)
    auth_vals  = [s.authenticity_score for s in snaps]
    avg_auth   = statistics.mean(auth_vals)

    # Count high-fraud-risk snapshots
    high_fraud_count = sum(
        1 for s in snaps
        if getattr(s, "fraud_risk", "Low").lower() in ("high", "very high")
    )
    fraud_penalty = min(30, high_fraud_count * 10)

    base_risk = round(100 - avg_auth)
    risk      = min(95, base_risk + fraud_penalty)

    signals: list[str] = []
    if avg_auth < 35:
        signals.append(f"Düşük özgünlük skoru: {avg_auth:.0f}/100 — kitle güvenilirliği şüpheli")
    elif avg_auth < 65:
        signals.append(f"Orta özgünlük: {avg_auth:.0f}/100")
    else:
        signals.append(f"Yüksek özgünlük: {avg_auth:.0f}/100")

    if high_fraud_count > 0:
        signals.append(f"{high_fraud_count} snapshot'ta yüksek fraud risk etiketi")

    # Trend
    if len(auth_vals) >= 4:
        mid  = len(auth_vals) // 2
        early = statistics.mean(auth_vals[:mid])
        late  = statistics.mean(auth_vals[mid:])
        if late < early - 8:
            trend = TRAJ_RISING
            signals.append(f"Özgünlük skoru düşüyor: {early:.0f} → {late:.0f}")
        elif late > early + 8:
            trend = TRAJ_DECLINING
        else:
            trend = TRAJ_STABLE
    else:
        trend = TRAJ_STABLE

    n = len(snaps)
    conf = CONF_HIGH if n >= 6 else CONF_MEDIUM if n >= 3 else CONF_LOW

    return RiskDimension(
        name=DIM_SENTIMENT,
        label=DIMENSION_LABELS[DIM_SENTIMENT],
        score=risk,
        level=score_to_level(risk),
        trend=trend,
        signals=signals,
        confidence=conf,
    )
