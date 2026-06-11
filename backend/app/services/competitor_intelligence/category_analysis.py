"""
Category Analysis — Determine creator category dominance for a competitor.
"""
from __future__ import annotations

from collections import Counter

from app.services.competitor_intelligence.schemas import (
    CreatorSignal, CategoryDominance, PlatformBreakdown, TierBreakdown,
)


def analyze_categories(signals: list[CreatorSignal]) -> list[CategoryDominance]:
    """Return categories ranked by creator count."""
    if not signals:
        return []

    counter: Counter = Counter()
    for s in signals:
        cat = (s.category or "unknown").strip().lower()
        if cat:
            counter[cat] += 1

    total = sum(counter.values()) or 1
    results = []
    for rank, (cat, count) in enumerate(counter.most_common(10), start=1):
        results.append(CategoryDominance(
            category=cat.title(),
            creator_count=count,
            percentage=round(count / total * 100, 1),
            rank=rank,
        ))
    return results


def analyze_platforms(signals: list[CreatorSignal]) -> list[PlatformBreakdown]:
    """Return platform distribution."""
    if not signals:
        return []

    counter: Counter = Counter(s.platform for s in signals)
    total = sum(counter.values()) or 1
    return [
        PlatformBreakdown(
            platform=platform,
            creator_count=count,
            percentage=round(count / total * 100, 1),
        )
        for platform, count in counter.most_common()
    ]


def analyze_tiers(signals: list[CreatorSignal]) -> list[TierBreakdown]:
    """Return creator tier distribution."""
    if not signals:
        return []

    counter: Counter = Counter(s.tier for s in signals)
    total = sum(counter.values()) or 1

    tier_order = {"mega": 0, "macro": 1, "mid": 2, "micro": 3, "nano": 4}
    sorted_tiers = sorted(counter.items(), key=lambda x: tier_order.get(x[0], 99))

    return [
        TierBreakdown(
            tier=tier,
            creator_count=count,
            percentage=round(count / total * 100, 1),
        )
        for tier, count in sorted_tiers
    ]


def get_dominant_category(categories: list[CategoryDominance]) -> str:
    return categories[0].category if categories else "Bilinmiyor"


def get_dominant_platform(platforms: list[PlatformBreakdown]) -> str:
    return platforms[0].platform if platforms else "instagram"


def get_dominant_tier(tiers: list[TierBreakdown]) -> str:
    return tiers[0].tier if tiers else "mid"
