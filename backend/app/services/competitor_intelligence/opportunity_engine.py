"""
Strategic Opportunity Engine — Part 13

Detects market gaps in the competitor's creator strategy.
All opportunities are evidence-based — no invented claims.
"""
from __future__ import annotations

from collections import Counter

from app.services.competitor_intelligence.schemas import (
    CreatorSignal, CategoryDominance, PlatformBreakdown, TierBreakdown,
    StrategicOpportunity,
    TIER_MEGA, TIER_MACRO, TIER_MID, TIER_MICRO, TIER_NANO,
    CONFIDENCE_MEDIUM, CONFIDENCE_LOW,
    SIGNAL_BRAND_ANALYSIS, SIGNAL_CATEGORY_MATCH,
)

# Creator saturation threshold: if one creator tier > this %, competitor is over-reliant
_SATURATION_THRESHOLD = 0.55

# Fatigue threshold: if >30% of creators have only LOW-confidence signals, there may be creator fatigue
_FATIGUE_LOW_SIGNAL_RATIO = 0.70


def detect_opportunities(
    signals: list[CreatorSignal],
    categories: list[CategoryDominance],
    platforms: list[PlatformBreakdown],
    tiers: list[TierBreakdown],
) -> list[StrategicOpportunity]:
    """Analyze competitor's portfolio and surface strategic opportunities."""
    opportunities: list[StrategicOpportunity] = []

    if not signals:
        return [
            StrategicOpportunity(
                opportunity_type="market_entry",
                title="Sınırlı Rakip Verisi",
                description="Bu rakip için yeterli creator sinyali bulunamadı. Güçlü pazar pozisyonu veya düşük creator aktivitesi olabilir.",
                evidence=["Creator sinyal sayısı yetersiz — fırsat değerlendirmesi sınırlı"],
                priority="low",
                confidence=CONFIDENCE_LOW,
            )
        ]

    total = len(signals)
    tier_map = {t.tier: t for t in tiers}
    platform_map = {p.platform: p for p in platforms}

    # ── Opportunity 1: Tier saturation ────────────────────────────────────────
    for tier_item in tiers:
        ratio = tier_item.creator_count / total
        if ratio > _SATURATION_THRESHOLD:
            tier_label = _tier_label(tier_item.tier)
            complement = _complement_tier(tier_item.tier)
            opportunities.append(StrategicOpportunity(
                opportunity_type="tier_gap",
                title=f"{tier_label} Creator Aşırı Yoğunluğu",
                description=(
                    f"Rakip creator portföyünün %{tier_item.percentage:.0f}'ini "
                    f"{tier_label} creator'lardan oluşturuyor. "
                    f"{_tier_label(complement)} segmentinde görece boşluk mevcut."
                ),
                evidence=[
                    f"{tier_item.creator_count}/{total} creator {tier_item.tier} tier'ında",
                    f"%{tier_item.percentage:.0f} yoğunlaşma tespit edildi",
                ],
                priority="high" if ratio > 0.70 else "medium",
                confidence=CONFIDENCE_MEDIUM,
            ))

    # ── Opportunity 2: Platform gap ────────────────────────────────────────────
    present_platforms = {p.platform for p in platforms}
    all_platforms = {"instagram", "tiktok", "youtube"}
    missing_platforms = all_platforms - present_platforms
    for mp in missing_platforms:
        opportunities.append(StrategicOpportunity(
            opportunity_type="platform_gap",
            title=f"{mp.title()} Platformunda Rakip Eksik",
            description=(
                f"Rakibin {mp.title()} creator aktivitesi tespit edilemedi. "
                f"Bu platformda erken mover avantajı fırsatı olabilir."
            ),
            evidence=[f"{mp.title()} creator sinyali bulunamadı"],
            priority="medium",
            confidence=CONFIDENCE_LOW,
        ))

    # ── Opportunity 3: Category gap ────────────────────────────────────────────
    if categories:
        dominant = categories[0]
        if dominant.percentage > 60 and len(categories) > 1:
            secondary = categories[1]
            opportunities.append(StrategicOpportunity(
                opportunity_type="category_gap",
                title=f"{dominant.category} Kategorisi Aşırı Yoğun",
                description=(
                    f"Rakip creator portföyünün %{dominant.percentage:.0f}'i "
                    f"{dominant.category} kategorisinde. "
                    f"{secondary.category} ve diğer kategorilerde farklılaşma fırsatı var."
                ),
                evidence=[
                    f"{dominant.category}: %{dominant.percentage:.0f} yoğunluk",
                    f"Alternatif {secondary.category}: %{secondary.percentage:.0f}",
                ],
                priority="medium",
                confidence=CONFIDENCE_MEDIUM,
            ))

    # ── Opportunity 4: High signal confidence advantage ───────────────────────
    explicit_count = sum(1 for s in signals if s.signal_type == SIGNAL_BRAND_ANALYSIS)
    category_only  = sum(1 for s in signals if s.signal_type == SIGNAL_CATEGORY_MATCH)

    if category_only > explicit_count * 2:
        opportunities.append(StrategicOpportunity(
            opportunity_type="market_entry",
            title="Doğrulanmamış Creator Potansiyeli",
            description=(
                "Rakibin category-based creator bağlantılarının çoğu zayıf sinyal üzerinden "
                "tespit edildi. Bu segment için daha yüksek kaliteli creator partnership'ler "
                "oluşturulabilir."
            ),
            evidence=[
                f"{explicit_count} güçlü sinyal vs {category_only} zayıf kategori sinyali",
                "Güçlü partnership verileri sınırlı",
            ],
            priority="low",
            confidence=CONFIDENCE_LOW,
        ))

    # ── Deduplicate and sort by priority ──────────────────────────────────────
    opportunities.sort(key=lambda o: {"high": 0, "medium": 1, "low": 2}[o.priority])
    return opportunities[:8]   # Cap at 8 opportunities


def _tier_label(tier: str) -> str:
    labels = {
        TIER_MEGA: "Mega", TIER_MACRO: "Macro",
        TIER_MID: "Mid-tier", TIER_MICRO: "Micro", TIER_NANO: "Nano",
    }
    return labels.get(tier, tier.title())


def _complement_tier(tier: str) -> str:
    """Opposite tier for gap analysis."""
    return {
        TIER_MEGA: TIER_MID, TIER_MACRO: TIER_MICRO,
        TIER_MID: TIER_MICRO, TIER_MICRO: TIER_MID, TIER_NANO: TIER_MID,
    }.get(tier, TIER_MID)
