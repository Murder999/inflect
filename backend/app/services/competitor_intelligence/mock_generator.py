"""
Mock Generator — Part 13

Produces deterministic synthetic competitor reports for MOCK mode.
Same input → same output (no random values). All outputs clearly labeled.

Uses SHA-256 hashing of the competitor name as seed for determinism.
"""
from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from typing import Optional

from app.services.competitor_intelligence.schemas import (
    CompetitorReportResult, CreatorSignal, SpendEstimate,
    CategoryDominance, PlatformBreakdown, TierBreakdown,
    StrategicOpportunity, CampaignPattern,
    TIER_MEGA, TIER_MACRO, TIER_MID, TIER_MICRO, TIER_NANO,
    CONFIDENCE_MEDIUM, CONFIDENCE_LOW,
    SIGNAL_BRAND_ANALYSIS, SIGNAL_CATEGORY_MATCH,
    get_creator_tier,
)
from app.services.competitor_intelligence.spend_estimation import (
    format_spend_tl, _round_to_50k,
)


# ── Deterministic helpers ─────────────────────────────────────────────────────

def _hash(text: str) -> int:
    return int(hashlib.sha256(text.encode()).hexdigest(), 16)


def _pick(seed: int, options: list) -> any:
    return options[seed % len(options)]


def _int_range(seed: int, lo: int, hi: int) -> int:
    return lo + (seed % (hi - lo + 1))


# ── Fixture data pools ────────────────────────────────────────────────────────

_PLATFORMS        = ["instagram", "tiktok", "youtube"]
_CATEGORIES       = ["Beauty", "Skincare", "Lifestyle", "Fashion", "Fitness",
                     "Food", "Tech", "Gaming", "Travel", "Mom/Baby"]
_INDUSTRY_CATS = {
    "beauty_health":  ["Beauty", "Skincare", "Wellness", "Lifestyle"],
    "beauty":         ["Beauty", "Skincare", "Makeup"],
    "fashion":        ["Fashion", "Lifestyle", "Style"],
    "fashion_sports": ["Sports", "Fitness", "Fashion"],
    "food_retail":    ["Food", "Recipe", "Lifestyle"],
    "electronics":    ["Tech", "Gaming", "Review"],
    "technology":     ["Tech", "Gaming", "Business"],
}
_MOCK_USERNAMES   = [
    "lifestyle_queen", "beauty_guru_tr", "fashionista_ist", "techreview_tr",
    "wellness_coach_tr", "foodie_istanbul", "fitness_motivation_tr", "momlife_tr",
    "skincare_expert", "travel_turkey", "gaming_pro_tr", "beauty_secrets_tr",
    "urban_style_tr", "healthyliving_tr", "makeup_artist_tr", "diy_crafts_tr",
    "fitness_daily", "recipe_master_tr", "fashion_week_tr", "skincare_tips_tr",
    "influencer_tr_1", "creator_istanbul", "content_creator_tr", "digital_native_tr",
    "socialite_tr", "beauty_blogger_tr", "fashion_content", "lifestyle_inspire",
    "wellness_guru", "beauty_fanatic_tr", "style_guide_tr", "fitness_coach",
]
_OPPORTUNITY_TEMPLATES = [
    ("tier_gap",     "Micro Creator Segmentinde Boşluk",
     "Rakip macro creator'lara ağırlık verirken micro segmentinde görece az yatırım yapıyor."),
    ("platform_gap", "TikTok Creator Stratejisi Zayıf",
     "Rakibin TikTok creator aktivitesi Instagram'ın çok gerisinde kalıyor."),
    ("category_gap", "Wellness Kategorisinde Fırsat",
     "Beauty kategorisi aşırı doymuş; wellness ve self-care segmenti açıkta."),
    ("creator_fatigue", "Creator Tekrarı Yüksek",
     "Aynı creator'lar birden fazla kampanyada kullanılmış; yeni keşif oranı düşük."),
    ("market_entry", "Erken Yatırım Fırsatı",
     "Rakibin henüz keşfetmediği yükselen creator segmentleri mevcut."),
]


def generate_mock_report(
    competitor_id:   int,
    competitor_name: str,
    industry:        Optional[str],
    window_days:     int = 90,
) -> CompetitorReportResult:
    """
    Build a deterministic mock report. Never random — same competitor → same output.
    """
    seed = _hash(competitor_name.lower())

    # ── Creator count ─────────────────────────────────────────────────────────
    creator_count = _int_range(seed >> 1, 18, 72)

    # ── Platform distribution ─────────────────────────────────────────────────
    dom_platform = _pick(seed >> 2, _PLATFORMS)
    dom_platform2 = _pick(seed >> 5, [p for p in _PLATFORMS if p != dom_platform])

    # ── Categories ────────────────────────────────────────────────────────────
    cats = _INDUSTRY_CATS.get(industry or "general", _CATEGORIES[:4])
    dom_category = _pick(seed >> 3, cats)

    # ── Build creator signals (deterministic) ─────────────────────────────────
    signals: list[CreatorSignal] = []
    tier_dist = _build_tier_dist(seed, creator_count)

    username_pool = _MOCK_USERNAMES.copy()
    platforms_cycle = [dom_platform] * 6 + [dom_platform2] * 3 + [
        p for p in _PLATFORMS if p not in (dom_platform, dom_platform2)
    ] * 1

    for i in range(creator_count):
        s_seed = _hash(f"{competitor_name}:{i}")
        tier = _pick_tier_from_dist(tier_dist, i)
        followers = _mock_followers(tier, s_seed)
        username  = username_pool[i % len(username_pool)] + f"_{i}"
        platform  = platforms_cycle[i % len(platforms_cycle)]
        category  = _pick(s_seed >> 2, cats)

        # Mix of signal types: first 20% brand_analysis, rest category_match
        sig_type = SIGNAL_BRAND_ANALYSIS if i < max(1, creator_count // 5) else SIGNAL_CATEGORY_MATCH
        strength = 0.80 if sig_type == SIGNAL_BRAND_ANALYSIS else 0.25
        conf     = "medium" if sig_type == SIGNAL_BRAND_ANALYSIS else "low"

        signals.append(CreatorSignal(
            influencer_profile_id=-(i + 1),   # negative IDs = mock records
            username=username,
            platform=platform,
            followers=followers,
            category=category,
            tier=tier,
            signal_type=sig_type,
            signal_strength=strength,
            confidence=conf,
            evidence=[f"[MOCK] {category} kategorisi creator — {competitor_name}"],
        ))

    # ── Categories analysis ────────────────────────────────────────────────────
    from collections import Counter
    cat_counter = Counter(s.category for s in signals)
    total = len(signals) or 1
    categories = [
        CategoryDominance(cat, cnt, round(cnt / total * 100, 1), rank)
        for rank, (cat, cnt) in enumerate(cat_counter.most_common(6), 1)
    ]

    # ── Platform breakdown ────────────────────────────────────────────────────
    plat_counter = Counter(s.platform for s in signals)
    platforms_bd = [
        PlatformBreakdown(p, c, round(c / total * 100, 1))
        for p, c in plat_counter.most_common()
    ]

    # ── Tier breakdown ────────────────────────────────────────────────────────
    tier_counter = Counter(s.tier for s in signals)
    tier_order   = {TIER_MEGA: 0, TIER_MACRO: 1, TIER_MID: 2, TIER_MICRO: 3, TIER_NANO: 4}
    tiers_bd = [
        TierBreakdown(t, c, round(c / total * 100, 1))
        for t, c in sorted(tier_counter.items(), key=lambda x: tier_order.get(x[0], 9))
    ]

    # ── Avg followers ─────────────────────────────────────────────────────────
    avg_followers = sum(s.followers for s in signals) // max(len(signals), 1)

    # ── Spend estimate ────────────────────────────────────────────────────────
    spend_low  = _round_to_50k(sum(
        _mock_spend_per_creator(s.tier, s.signal_strength, window_days)[0]
        for s in signals
    ))
    spend_high = _round_to_50k(sum(
        _mock_spend_per_creator(s.tier, s.signal_strength, window_days)[1]
        for s in signals
    ))

    spend_estimate = SpendEstimate(
        range_low_tl=spend_low,
        range_high_tl=spend_high,
        confidence=CONFIDENCE_MEDIUM,
        methodology=[
            f"[MOCK] {creator_count} creator, tier bazlı piyasa oranları.",
            f"{window_days} günlük pencere, aylık ortalama posting sıklığı.",
            "Sonuçlar 50.000 TL hassasiyetine yuvarlandı.",
        ],
        limitations=[
            "[MOCK] Bu tahmin gerçek harcama verilerine dayanmamaktadır.",
            "Gerçek ticari anlaşma değerleri doğrudan erişilebilir değildir.",
        ],
    )

    # ── Opportunities ─────────────────────────────────────────────────────────
    picked_opps = [
        _OPPORTUNITY_TEMPLATES[(seed >> (i + 4)) % len(_OPPORTUNITY_TEMPLATES)]
        for i in range(3)
    ]
    # Deduplicate by type
    seen_types = set()
    opportunities = []
    for otype, title, desc in picked_opps:
        if otype not in seen_types:
            seen_types.add(otype)
            opportunities.append(StrategicOpportunity(
                opportunity_type=otype,
                title=title,
                description=desc,
                evidence=["[MOCK] Deterministic örnek evidence"],
                priority=_pick(seed >> (7 + len(seen_types)), ["high", "medium", "low"]),
                confidence=CONFIDENCE_LOW,
            ))

    # ── Campaign patterns ─────────────────────────────────────────────────────
    campaign_patterns = [
        CampaignPattern(
            pattern_type="seasonal_surge",
            description=f"[MOCK] Ayda ortalama {_int_range(seed >> 8, 8, 25)} creator aktif",
            count=_int_range(seed >> 8, 8, 25),
            confidence=CONFIDENCE_LOW,
        ),
    ]

    # ── Momentum ──────────────────────────────────────────────────────────────
    momentum    = _pick(seed >> 9, ["increasing", "stable", "stable", "declining"])
    aggression  = _pick(seed >> 10, ["high", "medium", "medium", "low"])

    return CompetitorReportResult(
        competitor_id=competitor_id,
        competitor_name=competitor_name,
        analysis_window_days=window_days,
        generated_at=datetime.now(timezone.utc),
        creator_count=creator_count,
        dominant_platform=dom_platform,
        dominant_category=dom_category,
        avg_creator_followers=avg_followers,
        estimated_creator_tier=tiers_bd[0].tier if tiers_bd else "mid",
        creator_momentum=momentum,
        campaign_aggression=aggression,
        confidence=CONFIDENCE_MEDIUM,
        is_mock=True,
        creator_signals=signals,
        spend_estimate=spend_estimate,
        category_dominance=categories,
        platform_breakdown=platforms_bd,
        tier_breakdown=tiers_bd,
        opportunities=opportunities,
        campaign_patterns=campaign_patterns,
        evidence_summary=[
            f"[MOCK] {creator_count} sentetik creator sinyali üretildi.",
            f"[MOCK] Dominant platform: {dom_platform.title()}.",
            "[MOCK] Bu rapor gerçek veri içermemektedir.",
        ],
        limitations=[
            "[MOCK] Bu raporun tüm verisi sentetik ve eğitim amaçlıdır.",
            "Gerçek analiz için AGENTS_MODE=live ve yeterli archive verisi gereklidir.",
        ],
        note=(
            "[MOCK] Competitor Intelligence raporu MOCK modunda üretildi. "
            "Gerçek rakip analizi için archive'da yeterli creator verisi ve "
            "AGENTS_MODE=live gereklidir."
        ),
    )


# ── Internal helpers ──────────────────────────────────────────────────────────

def _build_tier_dist(seed: int, total: int) -> dict:
    mega  = max(0, _int_range(seed >> 11, 0, 3))
    macro = max(0, _int_range(seed >> 12, 2, 8))
    micro = max(0, _int_range(seed >> 13, 3, 15))
    nano  = max(0, _int_range(seed >> 14, 2, 10))
    mid   = max(1, total - mega - macro - micro - nano)
    return {TIER_MEGA: mega, TIER_MACRO: macro, TIER_MID: mid,
            TIER_MICRO: micro, TIER_NANO: nano}


def _pick_tier_from_dist(dist: dict, index: int) -> str:
    cumulative = 0
    for tier in [TIER_MEGA, TIER_MACRO, TIER_MID, TIER_MICRO, TIER_NANO]:
        cumulative += dist.get(tier, 0)
        if index < cumulative:
            return tier
    return TIER_MID


def _mock_followers(tier: str, seed: int) -> int:
    ranges = {
        TIER_MEGA:  (1_000_000, 5_000_000),
        TIER_MACRO: (500_000,   1_000_000),
        TIER_MID:   (50_000,    500_000),
        TIER_MICRO: (10_000,    50_000),
        TIER_NANO:  (1_000,     10_000),
    }
    lo, hi = ranges.get(tier, (10_000, 100_000))
    # Round to nearest 1000 to avoid fake precision
    raw = lo + (seed % (hi - lo + 1))
    return round(raw / 1000) * 1000


def _mock_spend_per_creator(
    tier: str,
    strength: float,
    window_days: int,
) -> tuple[int, int]:
    rates = {
        TIER_MEGA:  (25_000, 80_000),
        TIER_MACRO: (10_000, 40_000),
        TIER_MID:   (2_000,  12_000),
        TIER_MICRO: (400,    2_500),
        TIER_NANO:  (100,    600),
    }
    posts_per_month = {
        TIER_MEGA: (1, 2), TIER_MACRO: (2, 3), TIER_MID: (2, 4),
        TIER_MICRO: (1, 3), TIER_NANO: (1, 2),
    }
    rate_lo, rate_hi       = rates.get(tier, (1_000, 5_000))
    posts_lo, posts_hi     = posts_per_month.get(tier, (2, 3))
    months = window_days / 30.0
    return (
        int(math.floor(posts_lo * months) * rate_lo),
        int(math.ceil(posts_hi * months) * rate_hi),
    )
