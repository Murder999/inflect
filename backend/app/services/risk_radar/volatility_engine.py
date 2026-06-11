"""
Behavioral Volatility Engine — Part 15

Measures instability in creator performance metrics across snapshot history.
High volatility = unpredictable behavior = higher brand partnership risk.

Detects:
- ER variance (coefficient of variation)
- Follower growth variance
- Score volatility (fraud_score, brand_fit_score changes)
- Posting consistency proxy (avg_views variance)
"""
from __future__ import annotations

import statistics

from app.services.risk_radar.schemas import (
    RiskDimension, AnomalyEvent,
    CONF_LOW, CONF_MEDIUM, CONF_HIGH,
    TRAJ_DECLINING, TRAJ_STABLE, TRAJ_RISING,
    DIM_VOLATILITY, DIMENSION_LABELS, score_to_level,
)


def _coefficient_of_variation(values: list[float]) -> float:
    """CV = stdev / mean. Returns 0 if mean is 0."""
    if len(values) < 2:
        return 0.0
    mean = statistics.mean(values)
    if mean == 0:
        return 0.0
    return statistics.stdev(values) / abs(mean)


def analyze_volatility(snapshots: list) -> tuple[RiskDimension, list[AnomalyEvent]]:
    """
    Compute behavioral volatility risk from snapshot time series.

    Returns (RiskDimension, [AnomalyEvent])
    """
    anomaly_events: list[AnomalyEvent] = []

    if len(snapshots) < 2:
        return RiskDimension(
            name=DIM_VOLATILITY,
            label=DIMENSION_LABELS[DIM_VOLATILITY],
            score=0,
            level="low",
            trend=TRAJ_STABLE,
            signals=["Yetersiz snapshot — volatilite analizi yapılamıyor"],
            confidence=CONF_LOW,
        ), anomaly_events

    snaps = sorted(snapshots, key=lambda s: s.captured_at)

    er_values      = [s.engagement_rate for s in snaps]
    follower_vals  = [float(s.followers) for s in snaps]
    fraud_vals     = [float(s.fraud_score) for s in snaps]
    brand_fit_vals = [float(s.brand_fit_score) for s in snaps]
    views_vals     = [float(s.avg_views) for s in snaps]

    er_cv     = _coefficient_of_variation(er_values)
    fol_cv    = _coefficient_of_variation(follower_vals)
    fraud_cv  = _coefficient_of_variation(fraud_vals)
    views_cv  = _coefficient_of_variation(views_vals)

    signals: list[str] = []
    score = 0

    # ER volatility (most important)
    if er_cv > 0.60:
        score += 35
        signals.append(f"ER yüksek dalgalanma: CV={er_cv:.2f} — tutarsız etkileşim performansı")
        anomaly_events.append(AnomalyEvent(
            anomaly_type="er_high_volatility",
            description=f"Engagement rate coefficient of variation = {er_cv:.2f} (eşik: 0.60)",
            severity="high",
            period="tüm analiz penceresi",
        ))
    elif er_cv > 0.30:
        score += 18
        signals.append(f"ER orta düzey dalgalanma: CV={er_cv:.2f}")
    else:
        signals.append(f"ER stabil: CV={er_cv:.2f}")

    # Follower growth volatility
    if fol_cv > 0.50:
        score += 20
        signals.append(f"Takipçi büyümesi tutarsız: CV={fol_cv:.2f}")
    elif fol_cv > 0.25:
        score += 10

    # Views/content volatility (proxy for posting consistency)
    if views_cv > 0.70:
        score += 15
        signals.append(f"İçerik görüntülenmesi yüksek dalgalı: CV={views_cv:.2f} — posting tutarsızlığı")
    elif views_cv > 0.40:
        score += 8

    # Score volatility (fraud and brand_fit changes)
    if fraud_cv > 0.30:
        score += 15
        signals.append("Fraud score dalgalı — tutarsız kalite sinyali")
    if brand_fit_cv := _coefficient_of_variation(brand_fit_vals):
        if brand_fit_cv > 0.25:
            score += 10
            signals.append("Brand fit score değişken — içerik tutarsızlığı")

    score = min(score, 95)
    if not signals:
        signals.append("Metrik volatilitesi düşük — stabil davranış")

    # Trend: compare early vs late ER variance
    mid  = len(er_values) // 2
    if len(er_values) >= 4:
        early_cv = _coefficient_of_variation(er_values[:mid])
        late_cv  = _coefficient_of_variation(er_values[mid:])
        if late_cv > early_cv + 0.15:
            trend = TRAJ_RISING
        elif late_cv < early_cv - 0.15:
            trend = TRAJ_DECLINING
        else:
            trend = TRAJ_STABLE
    else:
        trend = TRAJ_STABLE

    n = len(snaps)
    conf = CONF_HIGH if n >= 6 else CONF_MEDIUM if n >= 3 else CONF_LOW

    return RiskDimension(
        name=DIM_VOLATILITY,
        label=DIMENSION_LABELS[DIM_VOLATILITY],
        score=score,
        level=score_to_level(score),
        trend=trend,
        signals=signals,
        confidence=conf,
    ), anomaly_events
