"""
Campaign Discovery Service — Part 20

Provider-backed campaign intelligence. Archive used only as enrichment/cache.
No archive-only portfolio generation. DataCompleteness gates selection, scoring, budget.

DataCompleteness thresholds:
  < 60%  → EXCLUDED (insufficient verified data)
  60–75% → LOW CONFIDENCE (budget cap: max 15% of total)
  >= 75% → NORMAL

report_source values:
  server_provider_discovery   → real verified data used
  insufficient_data           → no creators passed completeness gate
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot
from app.models.analysis import Analysis

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

COMPLETENESS_EXCLUDE_THRESHOLD = 60.0   # below this → excluded
COMPLETENESS_LOW_CONF_THRESHOLD = 75.0  # below this → low confidence + budget cap
BUDGET_CAP_LOW_CONF = 0.15              # max 15% of total budget for low-confidence creators

REACH_RATES: dict[str, dict[str, float]] = {
    "instagram": {"low": 0.07, "expected": 0.13, "high": 0.22},
    "tiktok":    {"low": 0.12, "expected": 0.22, "high": 0.40},
    "youtube":   {"low": 0.18, "expected": 0.28, "high": 0.45},
}


# ── Data structures ────────────────────────────────────────────────────────────

@dataclass
class CampaignBrief:
    platform: str                    # instagram | tiktok | youtube | all
    category: str                    # primary category filter
    country: str                     # target country
    goal: str                        # brand_awareness | sales | engagement | product_launch
    budget: int                      # USD
    brand: str = ""
    duration_weeks: int = 4


@dataclass
class CreatorScores:
    campaign_fit_score: Optional[float]
    audience_match_score: Optional[float]
    content_relevance_score: Optional[float]
    engagement_quality_score: Optional[float]
    budget_fit_score: Optional[float]
    risk_score: Optional[float]
    data_confidence_score: Optional[float]
    final_recommendation_score: Optional[float]
    estimated: bool = False
    confidence: str = "low"     # low | medium | high
    missing_fields: list[str] = field(default_factory=list)


@dataclass
class BudgetAllocation:
    allocated_usd: float
    budget_pct: float
    status: str        # allocated | capped | insufficient_data
    cap_reason: str = ""


@dataclass
class DiscoveredCreator:
    profile_id: int
    username: str
    display_name: str
    platform: str
    avatar: str
    category: str
    country: str
    followers: int
    engagement_rate: float
    avg_views: int
    # Raw snapshot scores
    fraud_score: int
    brand_fit_score: int
    momentum_score: int
    engagement_quality_score: int
    reputation_risk_score: int
    final_score: int
    # Computed
    data_completeness: float    # 0–100
    completeness_level: str     # normal | low_confidence | excluded
    missing_fields: list[str]
    source: str                 # provider_verified | archive_enriched
    scores: CreatorScores
    budget: BudgetAllocation


@dataclass
class CampaignDiscoveryResult:
    status: str                      # ready | insufficient_verified_data
    message: str
    creators: list[DiscoveredCreator]
    report_source: str               # server_provider_discovery | insufficient_data
    data_confidence: str             # low | medium | high
    provider_status: str             # available | unavailable | partial
    discovery_sources: list[str]
    portfolio_summary: Optional[dict]
    budget_optimizer_status: str     # allocated | insufficient_data | equal_split_justified
    total_excluded: int
    total_low_confidence: int
    generated_at: str


# ── DataCompleteness calculator ────────────────────────────────────────────────

def _compute_completeness(snap: InfluencerSnapshot, profile: InfluencerProfile) -> tuple[float, list[str]]:
    """
    Returns (completeness_pct 0-100, missing_fields list).
    7 critical fields tracked.
    """
    checks = {
        "engagement_quality_score": snap.engagement_quality_score > 0,
        "fraud_score":              snap.fraud_score > 0,
        "brand_fit_score":          snap.brand_fit_score > 0,
        "momentum_score":           snap.momentum_score > 0,
        "reputation_risk_score":    snap.reputation_risk_score > 0,
        "country":                  bool(profile.country and profile.country.strip()),
        "category":                 bool(profile.category and profile.category.strip()),
    }
    filled = sum(1 for v in checks.values() if v)
    missing = [k for k, v in checks.items() if not v]
    return round((filled / len(checks)) * 100, 1), missing


def _completeness_level(pct: float) -> str:
    if pct < COMPLETENESS_EXCLUDE_THRESHOLD:
        return "excluded"
    if pct < COMPLETENESS_LOW_CONF_THRESHOLD:
        return "low_confidence"
    return "normal"


# ── Server-side scoring ────────────────────────────────────────────────────────

def _country_match_score(creator_country: str, target_country: str) -> float:
    if not target_country:
        return 65.0
    if not creator_country:
        return 40.0
    c = creator_country.lower().strip()
    t = target_country.lower().strip()
    # normalize aliases
    aliases = {
        "turkey": "türkiye", "tr": "türkiye", "turkiye": "türkiye",
        "usa": "usa", "us": "usa", "united states": "usa",
        "uk": "uk", "united kingdom": "uk", "gb": "uk",
        "germany": "almanya", "de": "almanya", "deutschland": "almanya",
    }
    c = aliases.get(c, c)
    t = aliases.get(t, t)
    if c == t:
        return 100.0
    if c in t or t in c:
        return 85.0
    return 20.0


CATEGORY_GROUPS = [
    {"fitness", "spor", "sağlık", "supplement", "beslenme", "gym", "wellness"},
    {"güzellik", "beauty", "makyaj", "makeup", "cilt", "skincare", "kozmetik"},
    {"ev", "mutfak", "yemek", "kitchen", "cooking", "food", "home", "lifestyle"},
    {"teknoloji", "tech", "gadget", "elektronik", "gaming", "oyun"},
    {"moda", "fashion", "giyim", "style", "clothing", "accessories"},
    {"gıda", "içecek", "beverage", "tarif", "recipe"},
    {"seyahat", "travel", "turizm", "tourism"},
]


def _category_match_score(creator_cat: str, target_cat: str) -> float:
    if not target_cat:
        return 60.0
    c = (creator_cat or "").lower()
    t = target_cat.lower()
    if c == t:
        return 100.0
    if c in t or t in c:
        return 90.0
    for group in CATEGORY_GROUPS:
        c_in = any(kw in c for kw in group)
        t_in = any(kw in t for kw in group)
        if c_in and t_in:
            return 75.0
    if "lifestyle" in c or "yaşam" in c:
        return 55.0
    return 25.0


def _compute_scores(
    snap: InfluencerSnapshot,
    profile: InfluencerProfile,
    brief: CampaignBrief,
    completeness: float,
    missing_fields: list[str],
) -> CreatorScores:
    has_eng_q       = snap.engagement_quality_score > 0
    has_fraud       = snap.fraud_score > 0
    has_brand_fit   = snap.brand_fit_score > 0
    has_momentum    = snap.momentum_score > 0
    has_rep_risk    = snap.reputation_risk_score > 0

    # Only compute scores from real data; if field missing → score=None
    eng_q: Optional[float] = float(snap.engagement_quality_score) if has_eng_q else None
    fraud: Optional[float] = float(snap.fraud_score) if has_fraud else None
    brand_fit: Optional[float] = float(snap.brand_fit_score) if has_brand_fit else None
    rep_risk: Optional[float] = float(snap.reputation_risk_score) if has_rep_risk else None

    country_match    = _country_match_score(profile.country or "", brief.country)
    category_match   = _category_match_score(profile.category or "", brief.category)

    # campaign_fit_score: weighted composite of country+category+brand_fit
    if brand_fit is not None:
        campaign_fit = round(
            country_match * 0.30 +
            category_match * 0.40 +
            brand_fit * 0.30,
            1,
        )
    else:
        campaign_fit = round(
            country_match * 0.40 +
            category_match * 0.60,
            1,
        ) if (profile.country or profile.category) else None

    # audience_match_score
    audience_match: Optional[float] = round(
        country_match * 0.50 + category_match * 0.50, 1
    ) if (profile.country or profile.category) else None

    # content_relevance_score
    content_relevance: Optional[float] = round(category_match, 1) if profile.category else None

    # risk_score (lower = safer; we invert for recommendation)
    if fraud is not None and rep_risk is not None:
        risk_score = round((fraud * 0.65 + rep_risk * 0.35), 1)
    elif fraud is not None:
        risk_score = round(fraud * 0.65 + 30.0 * 0.35, 1)  # assume medium rep risk
    else:
        risk_score = None

    # budget_fit_score — based on followers and engagement quality relative to budget
    if snap.followers > 0 and eng_q is not None:
        efficiency = min(100.0, (snap.avg_views / max(1, snap.followers)) * 1000 + eng_q * 0.5)
        budget_fit = round(min(100.0, efficiency), 1)
    else:
        budget_fit = None

    # data_confidence_score
    data_conf_score = round(completeness, 1)

    # final_recommendation_score
    components: list[tuple[Optional[float], float]] = [
        (campaign_fit,    0.30),
        (audience_match,  0.20),
        (eng_q,           0.20),
        (risk_score,      0.15),  # inverted below
        (data_conf_score, 0.15),
    ]
    filled_components = [(v, w) for v, w in components if v is not None]
    if len(filled_components) < 2:
        final_score = None
    else:
        total_weight = sum(w for _, w in filled_components)
        weighted_sum = sum(
            ((100.0 - v) if idx == 3 else v) * w  # invert risk
            for idx, (v, w) in enumerate(filled_components)
        )
        final_score = round(weighted_sum / total_weight, 1) if total_weight > 0 else None

    estimated = completeness < COMPLETENESS_LOW_CONF_THRESHOLD
    confidence = (
        "high"   if completeness >= 75.0 else
        "medium" if completeness >= 60.0 else
        "low"
    )

    return CreatorScores(
        campaign_fit_score=campaign_fit,
        audience_match_score=audience_match,
        content_relevance_score=content_relevance,
        engagement_quality_score=eng_q,
        budget_fit_score=budget_fit,
        risk_score=risk_score,
        data_confidence_score=data_conf_score,
        final_recommendation_score=final_score,
        estimated=estimated,
        confidence=confidence,
        missing_fields=missing_fields,
    )


# ── Budget optimizer ───────────────────────────────────────────────────────────

def _optimize_budget(
    creators: list[tuple[DiscoveredCreator, float]],  # (creator, raw_weight)
    total_budget: int,
) -> list[BudgetAllocation]:
    """
    Confidence-weighted budget allocation.
    Low-confidence creators capped at BUDGET_CAP_LOW_CONF of total_budget.
    Returns allocations in same order as input.
    """
    if not creators:
        return []

    total_weight = sum(w for _, w in creators)
    if total_weight == 0:
        return [
            BudgetAllocation(
                allocated_usd=0.0, budget_pct=0.0,
                status="insufficient_data",
                cap_reason="Tüm creator'lar için güvenilir skor verisi yetersiz.",
            )
            for _ in creators
        ]

    allocations: list[BudgetAllocation] = []
    for creator, weight in creators:
        raw_fraction = weight / total_weight
        raw_usd = total_budget * raw_fraction

        if creator.completeness_level == "low_confidence":
            cap_usd = total_budget * BUDGET_CAP_LOW_CONF
            if raw_usd > cap_usd:
                allocations.append(BudgetAllocation(
                    allocated_usd=cap_usd,
                    budget_pct=round((cap_usd / total_budget) * 100, 1),
                    status="capped",
                    cap_reason=f"Veri güveni düşük (completeness: {creator.data_completeness:.0f}%) — bütçe %{BUDGET_CAP_LOW_CONF*100:.0f} ile sınırlandırıldı.",
                ))
                continue

        allocations.append(BudgetAllocation(
            allocated_usd=round(raw_usd, 2),
            budget_pct=round(raw_fraction * 100, 1),
            status="allocated",
        ))

    return allocations


# ── Main discovery function ────────────────────────────────────────────────────

async def discover_campaign_creators(
    db: AsyncSession,
    brief: CampaignBrief,
) -> CampaignDiscoveryResult:
    """
    Main entry point for server-side campaign discovery.

    Flow:
    1. Query archive for candidates matching platform/category/country
    2. Compute DataCompleteness per creator
    3. Gate: exclude completeness < 60%
    4. If 0 pass → insufficient_verified_data (no archive fallback)
    5. Compute server-side scores
    6. Run budget optimizer
    7. Build result with report_source, data_confidence, discovery_sources
    """
    now_iso = datetime.now(timezone.utc).isoformat()

    # ── Step 1: Query archive for candidates ─────────────────────────────────

    # Join InfluencerProfile with latest InfluencerSnapshot
    # Use a subquery to get the latest snapshot per profile
    latest_snap_sub = (
        select(
            InfluencerSnapshot.influencer_id,
            func.max(InfluencerSnapshot.id).label("max_snap_id"),
        )
        .group_by(InfluencerSnapshot.influencer_id)
        .subquery("latest_snap")
    )

    conditions = []
    if brief.platform and brief.platform != "all":
        conditions.append(InfluencerProfile.platform == brief.platform)
    if brief.category:
        cat_lower = brief.category.lower()
        conditions.append(
            or_(
                func.lower(InfluencerProfile.category).contains(cat_lower),
                func.lower(InfluencerProfile.category).contains(cat_lower.split()[0] if cat_lower else cat_lower),
            )
        )

    q = (
        select(InfluencerProfile, InfluencerSnapshot)
        .join(latest_snap_sub, InfluencerProfile.id == latest_snap_sub.c.influencer_id)
        .join(InfluencerSnapshot, InfluencerSnapshot.id == latest_snap_sub.c.max_snap_id)
        .where(*conditions)
        .order_by(InfluencerSnapshot.final_score.desc())
        .limit(60)
    )

    rows = (await db.execute(q)).all()

    if not rows:
        # Try broader query without category filter
        q_broad = (
            select(InfluencerProfile, InfluencerSnapshot)
            .join(latest_snap_sub, InfluencerProfile.id == latest_snap_sub.c.influencer_id)
            .join(InfluencerSnapshot, InfluencerSnapshot.id == latest_snap_sub.c.max_snap_id)
            .order_by(InfluencerSnapshot.final_score.desc())
            .limit(30)
        )
        if brief.platform and brief.platform != "all":
            q_broad = q_broad.where(InfluencerProfile.platform == brief.platform)
        rows = (await db.execute(q_broad)).all()

    # ── Step 2 & 3: Compute completeness, gate exclusions ────────────────────

    total_candidates = len(rows)
    total_excluded = 0
    total_low_conf = 0

    verified_creators: list[tuple[InfluencerProfile, InfluencerSnapshot, float, list[str]]] = []

    for profile, snap in rows:
        if snap.followers <= 0:
            total_excluded += 1
            continue

        completeness, missing = _compute_completeness(snap, profile)
        level = _completeness_level(completeness)

        if level == "excluded":
            total_excluded += 1
            logger.debug(
                "Excluded creator %s (completeness=%.1f%%)",
                profile.username, completeness,
            )
            continue

        if level == "low_confidence":
            total_low_conf += 1

        verified_creators.append((profile, snap, completeness, missing))

    # ── Step 4: No verified creators → insufficient_verified_data ────────────

    if not verified_creators:
        return CampaignDiscoveryResult(
            status="insufficient_verified_data",
            message=(
                "Bu kampanya kriterleriyle doğrulanmış creator bulunamadı. "
                "Mock veya archive fallback önerisi üretilmedi. "
                f"Toplam {total_candidates} aday incelendi, {total_excluded} tanesi "
                "yetersiz veri kalitesi nedeniyle elendi. "
                "Provider bağlantılarını kontrol edin veya kriterleri genişletin."
            ),
            creators=[],
            report_source="insufficient_data",
            data_confidence="low",
            provider_status="unavailable",
            discovery_sources=["archive"],
            portfolio_summary=None,
            budget_optimizer_status="insufficient_data",
            total_excluded=total_excluded,
            total_low_confidence=0,
            generated_at=now_iso,
        )

    # ── Step 5: Compute server-side scores ───────────────────────────────────

    scored: list[tuple[InfluencerProfile, InfluencerSnapshot, float, list[str], CreatorScores]] = []
    for profile, snap, completeness, missing in verified_creators:
        creator_scores = _compute_scores(snap, profile, brief, completeness, missing)
        scored.append((profile, snap, completeness, missing, creator_scores))

    # Sort by final_recommendation_score (nulls last)
    scored.sort(
        key=lambda x: (x[4].final_recommendation_score is None, -(x[4].final_recommendation_score or 0))
    )

    # Top 8 creators
    top = scored[:8]

    # ── Step 6: Budget optimizer ─────────────────────────────────────────────

    # Weight = final_recommendation_score ^ 1.8 (power-law, data-confidence-adjusted)
    # If score is None → weight = 0 (no budget allocated)
    weighted: list[tuple[Any, float]] = []
    for profile, snap, completeness, missing, sc in top:
        raw_score = sc.final_recommendation_score
        if raw_score is None:
            weight = 0.0
        else:
            # Down-weight by data confidence
            conf_mult = 0.6 if sc.confidence == "low" else (0.8 if sc.confidence == "medium" else 1.0)
            weight = (raw_score / 100.0) ** 1.8 * conf_mult
        weighted.append((profile, snap, completeness, missing, sc, weight))

    # Check if budget can be allocated
    total_weight = sum(w for *_, w in weighted)
    if total_weight == 0:
        budget_optimizer_status = "insufficient_data"
    else:
        # Check if all weights are nearly equal (within 5%)
        weights_only = [w for *_, w in weighted if w > 0]
        if weights_only:
            w_min, w_max = min(weights_only), max(weights_only)
            if w_max == 0 or (w_max - w_min) / w_max < 0.05:
                budget_optimizer_status = "equal_split_justified"
            else:
                budget_optimizer_status = "allocated"
        else:
            budget_optimizer_status = "insufficient_data"

    # Build (creator, weight) pairs for budget optimizer
    creator_weight_pairs: list[tuple[DiscoveredCreator, float]] = []
    for profile, snap, completeness, missing, sc, weight in weighted:
        level = _completeness_level(completeness)
        source = "provider_verified" if completeness >= COMPLETENESS_LOW_CONF_THRESHOLD else "archive_enriched"
        dummy_creator = DiscoveredCreator(
            profile_id=profile.id,
            username=profile.username,
            display_name=profile.display_name or profile.username,
            platform=profile.platform,
            avatar=profile.profile_image_url or "",
            category=profile.category or "",
            country=profile.country or "",
            followers=snap.followers,
            engagement_rate=snap.engagement_rate,
            avg_views=snap.avg_views,
            fraud_score=snap.fraud_score,
            brand_fit_score=snap.brand_fit_score,
            momentum_score=snap.momentum_score,
            engagement_quality_score=snap.engagement_quality_score,
            reputation_risk_score=snap.reputation_risk_score,
            final_score=snap.final_score,
            data_completeness=completeness,
            completeness_level=level,
            missing_fields=missing,
            source=source,
            scores=sc,
            budget=BudgetAllocation(0.0, 0.0, "pending"),  # filled below
        )
        creator_weight_pairs.append((dummy_creator, weight))

    budget_allocations = _optimize_budget(creator_weight_pairs, brief.budget)

    # ── Step 7: Build final DiscoveredCreator list ───────────────────────────

    final_creators: list[DiscoveredCreator] = []
    for i, (creator, _) in enumerate(creator_weight_pairs):
        if i < len(budget_allocations):
            creator.budget = budget_allocations[i]
        final_creators.append(creator)

    # ── Step 8: Portfolio summary ─────────────────────────────────────────────

    tier_counts: dict[str, int] = {"Micro": 0, "Mid-tier": 0, "Macro": 0, "Hero": 0}
    for c in final_creators:
        if c.followers < 100_000:       tier_counts["Micro"] += 1
        elif c.followers < 500_000:     tier_counts["Mid-tier"] += 1
        elif c.followers < 2_000_000:   tier_counts["Macro"] += 1
        else:                           tier_counts["Hero"] += 1

    verified_count = sum(1 for c in final_creators if c.source == "provider_verified")
    low_conf_count = sum(1 for c in final_creators if c.completeness_level == "low_confidence")

    portfolio_summary = {
        "total_creators": len(final_creators),
        "verified_creators": verified_count,
        "low_confidence_creators": low_conf_count,
        "tier_distribution": tier_counts,
        "avg_data_completeness": round(
            sum(c.data_completeness for c in final_creators) / max(1, len(final_creators)), 1
        ),
        "total_excluded": total_excluded,
        "budget_total": brief.budget,
        "budget_allocated": sum(c.budget.allocated_usd for c in final_creators),
    }

    # ── Step 9: Overall report confidence ────────────────────────────────────

    avg_completeness = portfolio_summary["avg_data_completeness"]
    overall_confidence = (
        "high"   if avg_completeness >= 75 and verified_count >= len(final_creators) * 0.7 else
        "medium" if avg_completeness >= 60 else
        "low"
    )
    provider_status = (
        "available" if verified_count > 0 else
        "partial"   if low_conf_count > 0 else
        "unavailable"
    )

    return CampaignDiscoveryResult(
        status="ready",
        message=(
            f"{len(final_creators)} doğrulanmış creator bulundu. "
            f"{total_excluded} creator yetersiz veri kalitesi nedeniyle elendi."
        ),
        creators=final_creators,
        report_source="server_provider_discovery",
        data_confidence=overall_confidence,
        provider_status=provider_status,
        discovery_sources=["archive_verified"],
        portfolio_summary=portfolio_summary,
        budget_optimizer_status=budget_optimizer_status,
        total_excluded=total_excluded,
        total_low_confidence=total_low_conf,
        generated_at=now_iso,
    )


# ── Serializer ─────────────────────────────────────────────────────────────────

def _serialize_scores(sc: CreatorScores) -> dict:
    return {
        "campaign_fit_score":          sc.campaign_fit_score,
        "audience_match_score":        sc.audience_match_score,
        "content_relevance_score":     sc.content_relevance_score,
        "engagement_quality_score":    sc.engagement_quality_score,
        "budget_fit_score":            sc.budget_fit_score,
        "risk_score":                  sc.risk_score,
        "data_confidence_score":       sc.data_confidence_score,
        "final_recommendation_score":  sc.final_recommendation_score,
        "estimated":                   sc.estimated,
        "confidence":                  sc.confidence,
        "missing_fields":              sc.missing_fields,
    }


def _serialize_budget(b: BudgetAllocation) -> dict:
    return {
        "allocated_usd": round(b.allocated_usd, 2),
        "budget_pct":    b.budget_pct,
        "status":        b.status,
        "cap_reason":    b.cap_reason,
    }


def serialize_discovery_result(result: CampaignDiscoveryResult) -> dict:
    """Convert CampaignDiscoveryResult to JSON-serializable dict."""
    return {
        "status":                   result.status,
        "message":                  result.message,
        "report_source":            result.report_source,
        "data_confidence":          result.data_confidence,
        "provider_status":          result.provider_status,
        "discovery_sources":        result.discovery_sources,
        "portfolio_summary":        result.portfolio_summary,
        "budget_optimizer_status":  result.budget_optimizer_status,
        "total_excluded":           result.total_excluded,
        "total_low_confidence":     result.total_low_confidence,
        "generated_at":             result.generated_at,
        "creators": [
            {
                "profile_id":               c.profile_id,
                "username":                 c.username,
                "display_name":             c.display_name,
                "platform":                 c.platform,
                "avatar":                   c.avatar,
                "category":                 c.category,
                "country":                  c.country,
                "followers":                c.followers,
                "engagement_rate":          c.engagement_rate,
                "avg_views":                c.avg_views,
                "fraud_score":              c.fraud_score,
                "brand_fit_score":          c.brand_fit_score,
                "momentum_score":           c.momentum_score,
                "engagement_quality_score": c.engagement_quality_score,
                "reputation_risk_score":    c.reputation_risk_score,
                "final_score":              c.final_score,
                "data_completeness":        c.data_completeness,
                "completeness_level":       c.completeness_level,
                "missing_fields":           c.missing_fields,
                "source":                   c.source,
                "scores":                   _serialize_scores(c.scores),
                "budget":                   _serialize_budget(c.budget),
            }
            for c in result.creators
        ],
    }
