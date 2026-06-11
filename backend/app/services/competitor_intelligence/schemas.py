"""
Competitor Intelligence Schemas — Part 13
Pure data types; no DB dependencies.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

# ── Confidence ────────────────────────────────────────────────────────────────
CONFIDENCE_HIGH   = "high"
CONFIDENCE_MEDIUM = "medium"
CONFIDENCE_LOW    = "low"

# ── Creator tiers (by follower count) ─────────────────────────────────────────
TIER_MEGA  = "mega"    # > 1 M
TIER_MACRO = "macro"   # 500 K – 1 M
TIER_MID   = "mid"     # 50 K – 500 K
TIER_MICRO = "micro"   # 10 K – 50 K
TIER_NANO  = "nano"    # < 10 K

# ── Momentum / Aggression ─────────────────────────────────────────────────────
MOMENTUM_INCREASING = "increasing"
MOMENTUM_STABLE     = "stable"
MOMENTUM_DECLINING  = "declining"

AGGRESSION_HIGH   = "high"
AGGRESSION_MEDIUM = "medium"
AGGRESSION_LOW    = "low"

# ── Signal types ──────────────────────────────────────────────────────────────
SIGNAL_BRAND_ANALYSIS  = "brand_analysis"    # user ran analysis for this brand + creator
SIGNAL_CATEGORY_MATCH  = "category_match"    # creator category ≈ brand industry
SIGNAL_HASHTAG         = "sponsored_hashtag" # detected sponsored hashtag pattern
SIGNAL_CAMPAIGN_RECORD = "campaign_record"   # explicit campaign record in DB


def get_creator_tier(followers: int) -> str:
    if followers >= 1_000_000: return TIER_MEGA
    if followers >= 500_000:   return TIER_MACRO
    if followers >= 50_000:    return TIER_MID
    if followers >= 10_000:    return TIER_MICRO
    return TIER_NANO


# ── Dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class CreatorSignal:
    influencer_profile_id: int
    username:  str
    platform:  str
    followers: int
    category:  str
    tier:      str
    signal_type:     str
    signal_strength: float   # 0.0 – 1.0
    confidence:      str     # low | medium | high
    evidence:        list[str] = field(default_factory=list)


@dataclass
class SpendEstimate:
    range_low_tl:  int
    range_high_tl: int
    confidence:    str
    methodology:   list[str] = field(default_factory=list)
    limitations:   list[str] = field(default_factory=list)


@dataclass
class CategoryDominance:
    category:      str
    creator_count: int
    percentage:    float
    rank:          int


@dataclass
class PlatformBreakdown:
    platform:      str
    creator_count: int
    percentage:    float


@dataclass
class TierBreakdown:
    tier:          str
    creator_count: int
    percentage:    float


@dataclass
class StrategicOpportunity:
    opportunity_type: str   # category_gap | tier_gap | platform_gap | creator_fatigue | market_entry
    title:            str
    description:      str
    evidence:         list[str] = field(default_factory=list)
    priority:         str = "medium"   # high | medium | low
    confidence:       str = CONFIDENCE_MEDIUM


@dataclass
class CampaignPattern:
    pattern_type: str
    description:  str
    count:        int
    confidence:   str


@dataclass
class CompetitorReportResult:
    competitor_id:   int
    competitor_name: str
    analysis_window_days: int
    generated_at:    datetime

    # Executive summary
    creator_count:            int
    dominant_platform:        str
    dominant_category:        str
    avg_creator_followers:    int
    estimated_creator_tier:   str
    creator_momentum:         str   # increasing | stable | declining
    campaign_aggression:      str   # high | medium | low
    confidence:               str
    is_mock:                  bool

    # Details
    creator_signals:    list[CreatorSignal]    = field(default_factory=list)
    spend_estimate:     Optional[SpendEstimate] = None
    category_dominance: list[CategoryDominance] = field(default_factory=list)
    platform_breakdown: list[PlatformBreakdown] = field(default_factory=list)
    tier_breakdown:     list[TierBreakdown]     = field(default_factory=list)
    opportunities:      list[StrategicOpportunity] = field(default_factory=list)
    campaign_patterns:  list[CampaignPattern]   = field(default_factory=list)

    # Explainability
    evidence_summary: list[str] = field(default_factory=list)
    limitations:      list[str] = field(default_factory=list)
    note:             str = ""
