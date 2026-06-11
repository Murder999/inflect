"""
Growth & Engagement Anomaly Detection — Part 15

Analyses InfluencerSnapshot time-series to detect:
- Abnormal follower growth spikes (inorganic velocity)
- Engagement rate drops inconsistent with follower growth
- Score deterioration events

All detection is deterministic and evidence-based.
No external LLM calls.
"""
from __future__ import annotations

import math
import statistics
from typing import Optional

from app.services.risk_radar.schemas import (
    AnomalyEvent, RiskDimension,
    CONF_LOW, CONF_MEDIUM, CONF_HIGH,
    RISK_LOW, RISK_MEDIUM, RISK_HIGH, RISK_CRITICAL,
    TRAJ_DECLINING, TRAJ_STABLE, TRAJ_RISING, TRAJ_SPIKE,
    DIM_GROWTH_ANOMALY,
    DIMENSION_LABELS, score_to_level,
)


def _growth_rate(prev: int, curr: int) -> float:
    """Follower growth rate between two snapshots. Returns 0 if prev=0."""
    if prev <= 0:
        return 0.0
    return (curr - prev) / prev


def analyze_growth_anomalies(
    snapshots: list,
) -> tuple[RiskDimension, list[AnomalyEvent]]:
    """
    Analyse snapshot follower growth for anomalous patterns.

    Returns:
        dimension: RiskDimension for growth anomaly
        events:    list of detected AnomalyEvent
    """
    anomaly_events: list[AnomalyEvent] = []

    if len(snapshots) < 2:
        return RiskDimension(
            name=DIM_GROWTH_ANOMALY,
            label=DIMENSION_LABELS[DIM_GROWTH_ANOMALY],
            score=0,
            level=RISK_LOW,
            trend=TRAJ_STABLE,
            signals=["Yetersiz snapshot verisi — growth analizi yapılamıyor"],
            confidence=CONF_LOW,
        ), anomaly_events

    # Sort by captured_at ascending
    snaps = sorted(snapshots, key=lambda s: s.captured_at)

    # Compute period-over-period growth rates
    growth_rates: list[float] = []
    for i in range(1, len(snaps)):
        rate = _growth_rate(snaps[i - 1].followers, snaps[i].followers)
        growth_rates.append(rate)

    if not growth_rates:
        return RiskDimension(
            name=DIM_GROWTH_ANOMALY,
            label=DIMENSION_LABELS[DIM_GROWTH_ANOMALY],
            score=0,
            level=RISK_LOW,
            trend=TRAJ_STABLE,
            signals=["Büyüme hızı hesaplanamadı"],
            confidence=CONF_LOW,
        ), anomaly_events

    mean_rate = statistics.mean(growth_rates)
    stdev     = statistics.stdev(growth_rates) if len(growth_rates) > 1 else 0.0

    # Anomaly threshold: 2 standard deviations above mean
    threshold = mean_rate + 2 * stdev if stdev > 0 else mean_rate * 3

    # Detect spikes
    spike_count   = 0
    large_spike   = False
    total_growth  = snaps[-1].followers - snaps[0].followers
    max_growth_rate = max(growth_rates)

    for i, rate in enumerate(growth_rates):
        if rate > threshold and rate > 0.10:   # >10% and anomalous vs baseline
            spike_count += 1
            snap_label = snaps[i + 1].captured_at.strftime("%Y-%m") if hasattr(snaps[i + 1].captured_at, "strftime") else "bilinmiyor"
            period_desc = f"{snap_label} dönemi"
            anomaly_events.append(AnomalyEvent(
                anomaly_type="growth_spike",
                description=f"Olağandışı büyüme hızı: +{rate * 100:.1f}% (ortalama: {mean_rate * 100:.1f}%)",
                severity="high" if rate > threshold * 1.5 else "medium",
                period=period_desc,
            ))
            if rate > threshold * 2:
                large_spike = True

    # Detect significant follower loss
    for i, rate in enumerate(growth_rates):
        if rate < -0.05:   # >5% follower loss
            snap_label = snaps[i + 1].captured_at.strftime("%Y-%m") if hasattr(snaps[i + 1].captured_at, "strftime") else "bilinmiyor"
            anomaly_events.append(AnomalyEvent(
                anomaly_type="follower_loss",
                description=f"Takipçi kaybı: {rate * 100:.1f}%",
                severity="medium" if rate > -0.15 else "high",
                period=snap_label,
            ))

    # Score derivation
    score = 0
    signals: list[str] = []

    if spike_count == 0:
        score = 5
        signals.append(f"Büyüme hızı stabil — ortalama {mean_rate * 100:.1f}%/dönem")
    elif spike_count == 1:
        score = 30
        signals.append("1 anormal büyüme spike'ı tespit edildi")
    elif spike_count == 2:
        score = 55
        signals.append(f"{spike_count} anormal büyüme spike'ı tespit edildi")
    else:
        score = 70
        signals.append(f"{spike_count} anormal büyüme döngüsü — inorganik aktivite sinyali")

    if large_spike:
        score = min(score + 20, 95)
        signals.append("Büyük ölçekli spike: ortalama 2 kat üzeri — yüksek inorganik risk")

    if max_growth_rate > 0.50:   # >50% in a single period
        score = min(score + 15, 95)
        signals.append(f"Maksimum büyüme hızı {max_growth_rate * 100:.0f}% — tespit eşiğinin üzerinde")

    # Trend: compare first half vs second half growth rates
    mid = len(growth_rates) // 2
    early_avg = statistics.mean(growth_rates[:mid]) if growth_rates[:mid] else 0.0
    late_avg  = statistics.mean(growth_rates[mid:]) if growth_rates[mid:] else 0.0
    if late_avg > early_avg + 0.05:
        trend = TRAJ_RISING
    elif late_avg < early_avg - 0.05:
        trend = TRAJ_DECLINING
    else:
        trend = TRAJ_STABLE

    n_snaps = len(snaps)
    confidence = CONF_HIGH if n_snaps >= 6 else CONF_MEDIUM if n_snaps >= 3 else CONF_LOW

    return RiskDimension(
        name=DIM_GROWTH_ANOMALY,
        label=DIMENSION_LABELS[DIM_GROWTH_ANOMALY],
        score=score,
        level=score_to_level(score),
        trend=trend,
        signals=signals,
        confidence=confidence,
    ), anomaly_events


def analyze_engagement_anomalies(snapshots: list) -> list[AnomalyEvent]:
    """
    Detect engagement rate drops that are inconsistent with follower growth.
    E.g. followers growing fast but ER collapsing → inorganic audience signal.
    """
    events: list[AnomalyEvent] = []
    if len(snapshots) < 3:
        return events

    snaps = sorted(snapshots, key=lambda s: s.captured_at)

    # Compare first-third vs last-third ER
    third = max(1, len(snaps) // 3)
    early_er = statistics.mean(s.engagement_rate for s in snaps[:third])
    late_er  = statistics.mean(s.engagement_rate for s in snaps[-third:])

    early_followers = statistics.mean(s.followers for s in snaps[:third])
    late_followers  = statistics.mean(s.followers for s in snaps[-third:])

    follower_growth = _growth_rate(early_followers, late_followers)
    er_change       = late_er - early_er

    if follower_growth > 0.20 and er_change < -0.5:   # grew > 20%, ER dropped > 0.5pp
        events.append(AnomalyEvent(
            anomaly_type="engagement_er_follower_mismatch",
            description=(
                f"Takipçi artarken ER düşüyor: takipçi +{follower_growth * 100:.0f}%, "
                f"ER {early_er:.1f}% → {late_er:.1f}% — inorganik kitle sinyali"
            ),
            severity="high" if er_change < -1.5 else "medium",
            period="analiz penceresi",
        ))

    return events
