"""
Confidence Engine — Part 13

Points-based confidence scoring for competitor intelligence reports.

Points table:
  +3  ≥ 5 explicit brand_analysis signals
  +2  ≥ 1 explicit brand_analysis signal
  +2  ≥ 10 total signals
  +1  ≥ 20 total signals
  +1  multi-platform evidence (≥ 2 platforms)
  -1  all signals are category_match only (no explicit)

Score → Confidence:
  5+  → HIGH
  3-4 → MEDIUM
  0-2 → LOW
"""
from __future__ import annotations

from app.services.competitor_intelligence.schemas import (
    CreatorSignal, SIGNAL_BRAND_ANALYSIS,
    CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, CONFIDENCE_LOW,
)


def score_confidence(signals: list[CreatorSignal]) -> str:
    if not signals:
        return CONFIDENCE_LOW

    explicit = sum(1 for s in signals if s.signal_type == SIGNAL_BRAND_ANALYSIS)
    total    = len(signals)
    platforms = len({s.platform for s in signals})

    points = 0
    if explicit >= 5:
        points += 3
    elif explicit >= 1:
        points += 2

    if total >= 20:
        points += 2
    elif total >= 10:
        points += 1

    if platforms >= 2:
        points += 1

    if explicit == 0:
        points -= 1

    if points >= 5:
        return CONFIDENCE_HIGH
    if points >= 3:
        return CONFIDENCE_MEDIUM
    return CONFIDENCE_LOW


def detect_creator_momentum(
    signals: list[CreatorSignal],
    confidence: str,
) -> str:
    """
    Infer creator momentum from signal characteristics.
    Returns 'increasing' | 'stable' | 'declining'.
    NOTE: Without time-series data this is a rough proxy based on
    signal diversity and volume. Labeled as LOW-confidence inference.
    """
    if not signals:
        return "stable"

    total = len(signals)
    explicit = sum(1 for s in signals if s.signal_type == SIGNAL_BRAND_ANALYSIS)

    # Heuristic: many explicit high-confidence signals → momentum is growing/strong
    if explicit >= 10 or (explicit >= 5 and total >= 20):
        return "increasing"
    if total < 5 and explicit == 0:
        return "declining"
    return "stable"


def detect_campaign_aggression(
    signals: list[CreatorSignal],
    window_days: int = 90,
) -> str:
    """
    Estimate campaign aggression from creator volume relative to time window.
    """
    if not signals:
        return "low"

    creators_per_month = len(signals) / (window_days / 30)

    if creators_per_month >= 20:
        return "high"
    if creators_per_month >= 8:
        return "medium"
    return "low"
