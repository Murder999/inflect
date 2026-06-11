"""
Trend Analysis — Historical trend extraction from snapshot sequences.
All computations are deterministic and evidence-based.
No random values, no fake patterns.
"""
from __future__ import annotations

import statistics
from typing import Optional

from app.services.digital_twin.schemas import SnapshotPoint, TrendResult


def _linear_slope(xs: list[float], ys: list[float]) -> float:
    """Ordinary least squares slope. Returns 0.0 if not enough points."""
    n = len(xs)
    if n < 2:
        return 0.0
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den = sum((x - mean_x) ** 2 for x in xs)
    return num / den if den != 0 else 0.0


def extract(snapshots: list[SnapshotPoint]) -> TrendResult:
    """
    Extract trend signals from an ordered snapshot sequence.
    Input must have >= 2 snapshots, sorted ascending by captured_at.
    """
    assert len(snapshots) >= 2, "Need at least 2 snapshots for trend extraction"
    snaps = sorted(snapshots, key=lambda s: s.captured_at)
    n = len(snaps)

    # ── Reference timestamps (days since first snapshot) ────────────────────
    t0 = snaps[0].captured_at
    days = [(s.captured_at - t0).days for s in snaps]
    days_coverage = days[-1]

    # ── Follower growth rates ─────────────────────────────────────────────────
    growth_rates: list[float] = []
    for i in range(1, n):
        dt = (snaps[i].captured_at - snaps[i-1].captured_at).days
        if dt <= 0:
            continue
        base = snaps[i-1].followers
        if base <= 0:
            continue
        delta = snaps[i].followers - snaps[i-1].followers
        rate = delta / base / dt   # fraction per day
        growth_rates.append(rate)

    avg_daily_growth_rate: float = 0.0
    weighted_daily_growth_rate: float = 0.0
    growth_direction: str = "flat"

    if growth_rates:
        avg_daily_growth_rate = statistics.mean(growth_rates)
        # Recency-weighted: more recent intervals get higher weight
        weights = list(range(1, len(growth_rates) + 1))
        total_w = sum(weights)
        weighted_daily_growth_rate = sum(r * w for r, w in zip(growth_rates, weights)) / total_w
        if weighted_daily_growth_rate > 0.0002:    # > 0.02% per day
            growth_direction = "positive"
        elif weighted_daily_growth_rate < -0.0002:
            growth_direction = "negative"
        else:
            growth_direction = "flat"

    # ── Engagement rate trend ─────────────────────────────────────────────────
    er_values = [s.engagement_rate for s in snaps]
    er_current = er_values[-1]

    er_slope = _linear_slope([float(d) for d in days], er_values)

    if er_slope < -0.002:        # declining more than 0.002 ER/day
        er_direction = "declining"
        engagement_decay_detected = True
    elif er_slope > 0.002:
        er_direction = "improving"
        engagement_decay_detected = False
    else:
        er_direction = "stable"
        engagement_decay_detected = False

    # Rapid decay check: last half worse than first half
    if n >= 4:
        mid = n // 2
        first_half_avg = statistics.mean(er_values[:mid])
        second_half_avg = statistics.mean(er_values[mid:])
        if first_half_avg > 0 and second_half_avg < first_half_avg * 0.85:
            engagement_decay_detected = True
            er_direction = "declining"

    # ── Momentum trend ───────────────────────────────────────────────────────
    momentum_values = [float(s.momentum_score) for s in snaps]
    avg_momentum = statistics.mean(momentum_values)
    momentum_slope = _linear_slope([float(d) for d in days], momentum_values)
    if momentum_slope > 0.5:
        momentum_direction = "improving"
    elif momentum_slope < -0.5:
        momentum_direction = "declining"
    else:
        momentum_direction = "stable"

    # ── Fraud score trend ────────────────────────────────────────────────────
    fraud_values = [float(s.fraud_score) for s in snaps]
    avg_fraud_score = statistics.mean(fraud_values)
    fraud_slope = _linear_slope([float(d) for d in days], fraud_values)
    # Higher fraud_score = more fraudulent, so increasing is bad
    if fraud_slope > 1.0:
        fraud_trend = "worsening"
    elif fraud_slope < -1.0:
        fraud_trend = "improving"
    else:
        fraud_trend = "stable"

    return TrendResult(
        avg_daily_growth_rate=avg_daily_growth_rate,
        weighted_daily_growth_rate=weighted_daily_growth_rate,
        growth_direction=growth_direction,
        er_slope=er_slope,
        er_current=er_current,
        er_direction=er_direction,
        engagement_decay_detected=engagement_decay_detected,
        avg_momentum=avg_momentum,
        momentum_direction=momentum_direction,
        avg_fraud_score=avg_fraud_score,
        fraud_trend=fraud_trend,
        snapshot_count=n,
        days_coverage=days_coverage,
    )
