"""
Confidence Engine — Part 15

Points-based confidence from evidence quantity and quality.
Same pattern as Digital Twin confidence engine.
"""
from __future__ import annotations

from app.services.risk_radar.schemas import CONF_LOW, CONF_MEDIUM, CONF_HIGH


def compute_confidence(snapshots: list, window_days: int) -> str:
    """
    Points system:
    - snapshot_count:  0 snaps=0, 1-2=1, 3-5=2, 6+=3
    - days_coverage:   <30d=0, 30-60d=1, 60-90d=2, 90d+=3
    - consistency:     all scores populated=1, some missing=0
    Total:
    - 5-6 → HIGH
    - 3-4 → MEDIUM
    - 0-2 → LOW
    """
    pts = 0

    n = len(snapshots)
    if n >= 6:
        pts += 3
    elif n >= 3:
        pts += 2
    elif n >= 1:
        pts += 1

    if window_days >= 90:
        pts += 3
    elif window_days >= 60:
        pts += 2
    elif window_days >= 30:
        pts += 1

    # Consistency: check if key scores are non-zero
    if snapshots:
        non_zero = sum(
            1 for s in snapshots
            if s.fraud_score > 0 and s.brand_fit_score > 0 and s.engagement_quality_score > 0
        )
        if non_zero >= n * 0.8:
            pts += 1

    if pts >= 5:
        return CONF_HIGH
    if pts >= 3:
        return CONF_MEDIUM
    return CONF_LOW
