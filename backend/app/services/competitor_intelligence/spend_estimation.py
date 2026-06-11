"""
Spend Estimation Engine — Part 13

Estimates competitor creator spend as a RANGE, not a single number.
No fake precision. All outputs are directional estimates with explicit methodology.

Turkish influencer market rate assumptions (2024-2025, per sponsored post/reel):
  Mega  (>1M)       :  25,000 – 80,000 TL
  Macro (500K-1M)   :  10,000 – 40,000 TL
  Mid   (50K-500K)  :   2,000 – 12,000 TL
  Micro (10K-50K)   :     400 –  2,500 TL
  Nano  (<10K)      :     100 –    600 TL

Estimated campaign posts per creator per 30 days:
  Mega  : 1 – 2
  Macro : 2 – 3
  Mid   : 2 – 4
  Micro : 1 – 3
  Nano  : 1 – 2
"""
from __future__ import annotations

import math
from collections import Counter

from app.services.competitor_intelligence.schemas import (
    CreatorSignal, SpendEstimate,
    TIER_MEGA, TIER_MACRO, TIER_MID, TIER_MICRO, TIER_NANO,
    CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, CONFIDENCE_LOW,
    SIGNAL_BRAND_ANALYSIS,
)

# (rate_low_per_post, rate_high_per_post) in TL
_TIER_RATES: dict[str, tuple[int, int]] = {
    TIER_MEGA:  (25_000, 80_000),
    TIER_MACRO: (10_000, 40_000),
    TIER_MID:   (2_000,  12_000),
    TIER_MICRO: (400,    2_500),
    TIER_NANO:  (100,    600),
}

# (posts_per_month_low, posts_per_month_high)
_TIER_POSTS_PER_MONTH: dict[str, tuple[int, int]] = {
    TIER_MEGA:  (1, 2),
    TIER_MACRO: (2, 3),
    TIER_MID:   (2, 4),
    TIER_MICRO: (1, 3),
    TIER_NANO:  (1, 2),
}

_SPEND_LIMITATIONS = [
    "Gerçek ticari anlaşmalar doğrudan erişilebilir değildir.",
    "Bu tahmin creator tier, posting frequency ve piyasa normlarına dayalıdır.",
    "Gerçek spend bu aralığın dışında olabilir.",
    "Özel indirimler, bundle anlaşmaları ve uzun dönem kontratlar yansıtılmamıştır.",
]


def estimate_spend(
    signals: list[CreatorSignal],
    window_days: int = 90,
) -> SpendEstimate:
    """
    Compute spend range from detected creator signals.
    Only counts each unique creator once (deduplication by profile_id).
    """
    if not signals:
        return SpendEstimate(
            range_low_tl=0,
            range_high_tl=0,
            confidence=CONFIDENCE_LOW,
            methodology=["Yeterli creator sinyali bulunamadı."],
            limitations=_SPEND_LIMITATIONS,
        )

    # Deduplicate creators
    seen: set[int] = set()
    unique_signals: list[CreatorSignal] = []
    for s in signals:
        if s.influencer_profile_id not in seen:
            seen.add(s.influencer_profile_id)
            unique_signals.append(s)

    months = window_days / 30.0
    tier_counter: Counter = Counter(s.tier for s in unique_signals)

    total_low  = 0
    total_high = 0
    tier_details: list[str] = []

    for tier, count in sorted(tier_counter.items(), key=lambda x: -_tier_order(x[0])):
        rate_lo, rate_hi   = _TIER_RATES.get(tier, (0, 0))
        posts_lo, posts_hi = _TIER_POSTS_PER_MONTH.get(tier, (1, 2))

        creator_low  = count * math.floor(posts_lo * months) * rate_lo
        creator_high = count * math.ceil(posts_hi * months) * rate_hi

        total_low  += creator_low
        total_high += creator_high

        tier_details.append(
            f"{count} {tier} creator × est. {posts_lo}–{posts_hi} post/ay × "
            f"{rate_lo:,}–{rate_hi:,} TL/post"
        )

    # Round to avoid fake precision (nearest 50K)
    total_low  = _round_to_50k(total_low)
    total_high = _round_to_50k(total_high)

    # Make sure low < high
    if total_high == 0:
        total_high = max(total_low * 2, 100_000)

    # Confidence: higher if more explicit signals
    explicit_count = sum(1 for s in unique_signals if s.signal_type == SIGNAL_BRAND_ANALYSIS)
    if explicit_count >= 5:
        confidence = CONFIDENCE_MEDIUM
    elif explicit_count >= 1:
        confidence = CONFIDENCE_LOW
    else:
        confidence = CONFIDENCE_LOW

    methodology = [
        f"Toplam {len(unique_signals)} benzersiz creator tespit edildi.",
        f"Analiz penceresi: {window_days} gün ({months:.1f} ay).",
    ] + tier_details + [
        "Tier bazlı Türkiye piyasa fiyatlandırması uygulandı.",
        "Sonuçlar en yakın 50.000 TL'ye yuvarlandı.",
    ]

    return SpendEstimate(
        range_low_tl=total_low,
        range_high_tl=total_high,
        confidence=confidence,
        methodology=methodology,
        limitations=_SPEND_LIMITATIONS,
    )


def _round_to_50k(value: int) -> int:
    if value == 0:
        return 0
    return max(50_000, round(value / 50_000) * 50_000)


def _tier_order(tier: str) -> int:
    return {TIER_MEGA: 5, TIER_MACRO: 4, TIER_MID: 3, TIER_MICRO: 2, TIER_NANO: 1}.get(tier, 0)


def format_spend_tl(amount: int) -> str:
    """Format spend amount in human-readable TL string."""
    if amount >= 1_000_000:
        return f"{amount / 1_000_000:.1f}M TL"
    if amount >= 1_000:
        return f"{amount / 1_000:.0f}K TL"
    return f"{amount:,} TL"
