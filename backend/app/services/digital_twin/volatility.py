"""
Volatility Analysis — Spike and crash detection in follower history.
Deterministic: identical inputs always produce identical outputs.
"""
from __future__ import annotations

import statistics
from app.services.digital_twin.schemas import SnapshotPoint, VolatilityResult

SPIKE_THRESHOLD  = 0.15   # >15% single-period growth = spike
CRASH_THRESHOLD  = -0.10  # <-10% single-period decline = crash
HIGH_VOL_SCORE   = 0.25
MEDIUM_VOL_SCORE = 0.12


def analyze(snapshots: list[SnapshotPoint]) -> VolatilityResult:
    """
    Compute volatility metrics from snapshot follower history.
    Requires >= 2 snapshots.
    """
    snaps = sorted(snapshots, key=lambda s: s.captured_at)
    n = len(snaps)

    if n < 2:
        return VolatilityResult(
            volatility_score=0.0,
            has_spikes=False,
            spike_count=0,
            max_spike_pct=0.0,
            has_crashes=False,
            crash_count=0,
            max_crash_pct=0.0,
            volatility_label="insufficient_data",
            evidence=["Not enough snapshots to assess volatility."],
        )

    # Compute period-over-period follower change rates
    period_rates: list[float] = []
    for i in range(1, n):
        base = snaps[i-1].followers
        if base <= 0:
            continue
        delta = snaps[i].followers - snaps[i-1].followers
        rate = delta / base
        period_rates.append(rate)

    if not period_rates:
        return VolatilityResult(
            volatility_score=0.0,
            has_spikes=False,
            spike_count=0,
            max_spike_pct=0.0,
            has_crashes=False,
            crash_count=0,
            max_crash_pct=0.0,
            volatility_label="low",
            evidence=["Follower base is zero — volatility cannot be computed."],
        )

    # Standard deviation of period rates = volatility score
    vol_score = statistics.stdev(period_rates) if len(period_rates) > 1 else abs(period_rates[0])

    # Spike and crash detection
    spikes  = [r for r in period_rates if r > SPIKE_THRESHOLD]
    crashes = [r for r in period_rates if r < CRASH_THRESHOLD]

    max_spike  = max(spikes,  default=0.0)
    max_crash  = min(crashes, default=0.0)

    # Label
    if vol_score >= HIGH_VOL_SCORE:
        label = "high"
    elif vol_score >= MEDIUM_VOL_SCORE:
        label = "medium"
    else:
        label = "low"

    # Evidence text
    evidence: list[str] = []
    if spikes:
        evidence.append(
            f"{len(spikes)} follower spike(s) detected "
            f"(max +{max_spike*100:.1f}% in single period)."
        )
    if crashes:
        evidence.append(
            f"{len(crashes)} follower drop(s) detected "
            f"(max {max_crash*100:.1f}% in single period)."
        )
    if label == "high":
        evidence.append("High follower volatility detected — growth pattern is inconsistent.")
    elif label == "medium":
        evidence.append("Moderate follower volatility — some instability present.")
    else:
        evidence.append("Follower growth is relatively smooth and consistent.")

    return VolatilityResult(
        volatility_score=vol_score,
        has_spikes=len(spikes) > 0,
        spike_count=len(spikes),
        max_spike_pct=max_spike * 100,
        has_crashes=len(crashes) > 0,
        crash_count=len(crashes),
        max_crash_pct=abs(max_crash) * 100,
        volatility_label=label,
        evidence=evidence,
    )
