"""
Risk Scoring — Part 15

Builds the fraud/authenticity dimension and computes the composite risk score.
"""
from __future__ import annotations

import statistics

from app.services.risk_radar.schemas import (
    RiskDimension, RiskReportResult,
    CONF_LOW, CONF_MEDIUM, CONF_HIGH,
    TRAJ_DECLINING, TRAJ_STABLE, TRAJ_RISING, TRAJ_SPIKE,
    DIM_FRAUD_ANOMALY, DIMENSION_LABELS,
    DIMENSION_WEIGHTS, score_to_level,
    RISK_LOW, RISK_MEDIUM, RISK_HIGH, RISK_CRITICAL,
)


def analyze_fraud_risk(snapshots: list) -> RiskDimension:
    """
    Fraud & authenticity dimension. fraud_score is already 0-100 (higher = more fraud).
    """
    if not snapshots:
        return RiskDimension(
            name=DIM_FRAUD_ANOMALY,
            label=DIMENSION_LABELS[DIM_FRAUD_ANOMALY],
            score=20,
            level=RISK_LOW,
            trend=TRAJ_STABLE,
            signals=["Snapshot yok — fraud analizi yapılamıyor"],
            confidence=CONF_LOW,
        )

    snaps = sorted(snapshots, key=lambda s: s.captured_at)
    fraud_vals = [s.fraud_score for s in snaps]
    auth_vals  = [s.authenticity_score for s in snaps]

    avg_fraud = statistics.mean(fraud_vals)
    avg_auth  = statistics.mean(auth_vals)

    # Composite: weight fraud higher
    score = round(0.65 * avg_fraud + 0.35 * (100 - avg_auth))

    signals: list[str] = []
    if avg_fraud > 60:
        signals.append(f"Yüksek fraud skoru: ortalama {avg_fraud:.0f}/100")
    elif avg_fraud > 35:
        signals.append(f"Orta fraud riski: ortalama {avg_fraud:.0f}/100")
    else:
        signals.append(f"Düşük fraud skoru: ortalama {avg_fraud:.0f}/100")

    if avg_auth < 40:
        signals.append(f"Düşük özgünlük: {avg_auth:.0f}/100 — sahte etkileşim sinyali")

    # Trend
    if len(fraud_vals) >= 4:
        mid   = len(fraud_vals) // 2
        early = statistics.mean(fraud_vals[:mid])
        late  = statistics.mean(fraud_vals[mid:])
        if late > early + 8:
            trend = TRAJ_RISING
            signals.append(f"Fraud skoru artıyor: {early:.0f} → {late:.0f}")
        elif late < early - 8:
            trend = TRAJ_DECLINING
        else:
            trend = TRAJ_STABLE
    else:
        trend = TRAJ_STABLE

    n = len(snaps)
    conf = CONF_HIGH if n >= 6 else CONF_MEDIUM if n >= 3 else CONF_LOW

    return RiskDimension(
        name=DIM_FRAUD_ANOMALY,
        label=DIMENSION_LABELS[DIM_FRAUD_ANOMALY],
        score=score,
        level=score_to_level(score),
        trend=trend,
        signals=signals,
        confidence=conf,
    )


def compute_composite_score(dimensions: dict[str, RiskDimension]) -> int:
    """Weighted average of all dimension scores → 0-100 overall risk."""
    total  = 0.0
    weight = 0.0
    for name, w in DIMENSION_WEIGHTS.items():
        dim = dimensions.get(name)
        if dim:
            total  += dim.score * w
            weight += w
    if weight == 0:
        return 0
    return round(total / weight)


def compute_trajectory(
    snapshots: list,
    dimensions: dict[str, RiskDimension],
) -> str:
    """
    Overall risk trajectory based on composite dimension trends.
    Rising trends across multiple dimensions = RISING or SPIKE.
    """
    rising_count   = sum(1 for d in dimensions.values() if d.trend == TRAJ_RISING)
    declining_count= sum(1 for d in dimensions.values() if d.trend == TRAJ_DECLINING)
    total_dims     = len(dimensions)

    if rising_count >= max(2, total_dims // 2):
        # Check for rapid deterioration
        if rising_count >= 4:
            return TRAJ_SPIKE
        return TRAJ_RISING
    elif declining_count >= max(2, total_dims // 2):
        return TRAJ_DECLINING
    return TRAJ_STABLE
