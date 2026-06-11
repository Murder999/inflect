"""
Data Quality — Snapshot sufficiency validation.
Forecasts are blocked when data is insufficient.
"""
from __future__ import annotations

from app.services.digital_twin.schemas import DataQualityResult, SnapshotPoint

# Minimum requirements
MIN_SNAPSHOTS_FOR_FORECAST = 3    # absolute floor
MIN_SNAPSHOTS_FOR_MEDIUM   = 4    # floor for MEDIUM confidence
MIN_SNAPSHOTS_FOR_HIGH     = 6    # floor for HIGH confidence
MIN_DAYS_COVERAGE          = 30   # absolute floor in days
MIN_DAYS_FOR_MEDIUM        = 60
MIN_DAYS_FOR_HIGH          = 90
MAX_SNAPSHOT_STALENESS_DAYS = 180  # warn if newest snapshot is older than this


def check(snapshots: list[SnapshotPoint]) -> DataQualityResult:
    """
    Evaluate whether the snapshot set is sufficient for forecasting.
    Returns DataQualityResult with limitations list.
    """
    n = len(snapshots)
    limitations: list[str] = []

    if n == 0:
        return DataQualityResult(
            is_sufficient=False,
            snapshot_count=0,
            days_coverage=0,
            reason="No historical snapshots found for this influencer.",
            limitations=["No snapshot data available."],
        )

    # Sort by time
    sorted_snaps = sorted(snapshots, key=lambda s: s.captured_at)
    days_coverage = (sorted_snaps[-1].captured_at - sorted_snaps[0].captured_at).days

    # Freshness check
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    newest_age_days = (now - sorted_snaps[-1].captured_at).days
    if newest_age_days > MAX_SNAPSHOT_STALENESS_DAYS:
        limitations.append(
            f"Most recent snapshot is {newest_age_days} days old. "
            f"Forecast accuracy is reduced for stale data."
        )

    if n < MIN_SNAPSHOTS_FOR_FORECAST:
        return DataQualityResult(
            is_sufficient=False,
            snapshot_count=n,
            days_coverage=days_coverage,
            reason=(
                f"Insufficient historical snapshots ({n} found, "
                f"minimum {MIN_SNAPSHOTS_FOR_FORECAST} required for forecasting)."
            ),
            limitations=[
                f"Only {n} snapshot(s) available — forecast requires at least {MIN_SNAPSHOTS_FOR_FORECAST}.",
                "Capture more analyses over time to enable forecasting.",
            ],
        )

    if days_coverage < MIN_DAYS_COVERAGE:
        return DataQualityResult(
            is_sufficient=False,
            snapshot_count=n,
            days_coverage=days_coverage,
            reason=(
                f"Snapshot timeline too short ({days_coverage} days). "
                f"Minimum {MIN_DAYS_COVERAGE} days of history required."
            ),
            limitations=[
                f"Snapshot history spans only {days_coverage} days — {MIN_DAYS_COVERAGE} days required.",
                "Forecasting requires distributed snapshots over time, not burst captures.",
            ],
        )

    # Add advisory limitations
    if n < MIN_SNAPSHOTS_FOR_MEDIUM:
        limitations.append(
            f"Only {n} snapshots available. More snapshots improve forecast accuracy."
        )
    if days_coverage < MIN_DAYS_FOR_MEDIUM:
        limitations.append(
            f"Snapshot coverage is {days_coverage} days. "
            f"90+ day coverage produces more reliable forecasts."
        )
    if n < MIN_SNAPSHOTS_FOR_HIGH or days_coverage < MIN_DAYS_FOR_HIGH:
        limitations.append(
            "Forecast confidence is limited. Results should be treated as directional, "
            "not precise."
        )

    return DataQualityResult(
        is_sufficient=True,
        snapshot_count=n,
        days_coverage=days_coverage,
        limitations=limitations,
    )
