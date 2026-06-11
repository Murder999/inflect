"""
Competitor Intelligence Engine — Part 13

Main orchestration layer. Coordinates all sub-modules:
  brand_lookup → creator_detection → category_analysis →
  spend_estimation → overlap_analysis → opportunity_engine →
  confidence_engine → explainability → cache

AGENTS_MODE=mock  → deterministic synthetic report (no DB queries beyond brand lookup)
AGENTS_MODE=live  → real archive scan (requires populated InfluencerProfile data)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.competitor_intelligence import (
    CompetitorProfile,
    CompetitorCampaignSignal,
    CompetitorReportCache,
)
from app.services.competitor_intelligence.schemas import CompetitorReportResult
from app.services.competitor_intelligence.brand_lookup import (
    find_or_create_competitor,
    normalize_brand_name,
    infer_industry,
)
from app.services.competitor_intelligence.creator_detection import (
    detect_creator_signals,
)
from app.services.competitor_intelligence.spend_estimation import estimate_spend
from app.services.competitor_intelligence.category_analysis import (
    analyze_categories,
    analyze_platforms,
    analyze_tiers,
)
from app.services.competitor_intelligence.overlap_analysis import (
    find_overlapping_creators,
)
from app.services.competitor_intelligence.opportunity_engine import (
    detect_opportunities,
)
from app.services.competitor_intelligence.confidence_engine import (
    score_confidence,
    detect_creator_momentum,
    detect_campaign_aggression,
)
from app.services.competitor_intelligence.explainability import (
    build_evidence_summary,
    build_limitations,
)
from app.services.competitor_intelligence.mock_generator import generate_mock_report

# Cache TTL: 24 hours in LIVE, 1 hour in MOCK
_CACHE_TTL_LIVE  = timedelta(hours=24)
_CACHE_TTL_MOCK  = timedelta(hours=1)


async def lookup_competitor(
    db: AsyncSession,
    brand_name: str,
) -> dict:
    """
    Look up or create a competitor record. Returns basic profile info.
    No credit cost — used for autocomplete / validation.
    """
    competitor = await find_or_create_competitor(db, brand_name)
    industry   = infer_industry(competitor.normalized_name)

    return {
        "id":              competitor.id,
        "name":            competitor.name,
        "normalized_name": competitor.normalized_name,
        "industry":        industry,
        "aliases":         competitor.aliases or [],
        "created_at":      competitor.created_at.isoformat() if competitor.created_at else None,
    }


async def generate_report(
    db:          AsyncSession,
    brand_name:  str,
    window_days: int = 90,
    user_id:     Optional[int] = None,
    force:       bool = False,
) -> CompetitorReportResult:
    """
    Generate (or return cached) competitor intelligence report.

    Mode is read from settings.AGENTS_MODE:
      - "mock" → deterministic synthetic report
      - "live" → real archive scan
    """
    is_mock = (getattr(settings, "AGENTS_MODE", "mock").lower() == "mock")

    competitor = await find_or_create_competitor(db, brand_name)
    industry   = infer_industry(competitor.normalized_name)

    # ── Cache check ──────────────────────────────────────────────────────────
    if not force:
        cached = await _get_cached_report(db, competitor.id, window_days, is_mock)
        if cached:
            return cached

    # ── Generate ─────────────────────────────────────────────────────────────
    if is_mock:
        result = generate_mock_report(
            competitor_id=competitor.id,
            competitor_name=competitor.name,
            industry=industry,
            window_days=window_days,
        )
    else:
        result = await _generate_live_report(
            db=db,
            competitor=competitor,
            industry=industry,
            window_days=window_days,
            user_id=user_id,
        )

    # ── Persist cache ─────────────────────────────────────────────────────────
    await _cache_report(db, competitor.id, window_days, is_mock, result)

    # ── Fire events ───────────────────────────────────────────────────────────
    await _fire_events(db, competitor, result)

    return result


async def get_cached_report(
    db:          AsyncSession,
    brand_name:  str,
    window_days: int = 90,
) -> Optional[CompetitorReportResult]:
    """Return cached report if available (does not trigger generation)."""
    is_mock     = (getattr(settings, "AGENTS_MODE", "mock").lower() == "mock")
    competitor  = await find_or_create_competitor(db, brand_name)
    return await _get_cached_report(db, competitor.id, window_days, is_mock)


async def get_opportunities(
    db:          AsyncSession,
    brand_name:  str,
    window_days: int = 90,
) -> list[dict]:
    """
    Return opportunities for a competitor. Generates report if none cached.
    Lightweight view — does not re-run full report.
    """
    report = await generate_report(db, brand_name, window_days)
    return [
        {
            "opportunity_type": o.opportunity_type,
            "title":            o.title,
            "description":      o.description,
            "evidence":         o.evidence,
            "priority":         o.priority,
            "confidence":       o.confidence,
        }
        for o in report.opportunities
    ]


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _generate_live_report(
    db:         AsyncSession,
    competitor: CompetitorProfile,
    industry:   Optional[str],
    window_days: int,
    user_id:    Optional[int],
) -> CompetitorReportResult:
    """Real archive scan — only called in AGENTS_MODE=live."""

    # 1. Detect creator signals from archive
    signals = await detect_creator_signals(
        db=db,
        competitor=competitor,
        window_days=window_days,
    )

    # 2. Analyze composition
    categories = analyze_categories(signals)
    platforms  = analyze_platforms(signals)
    tiers      = analyze_tiers(signals)

    # 3. Confidence
    confidence = score_confidence(signals)

    # 4. Spend estimate (range-based, never fake precision)
    spend_est  = estimate_spend(signals, window_days) if signals else None

    # 5. Opportunities
    opportunities = detect_opportunities(signals, categories, platforms, tiers)

    # 6. Momentum & aggression
    momentum    = detect_creator_momentum(signals, confidence)
    aggression  = detect_campaign_aggression(signals, window_days)

    # 7. Overlap (if user context available)
    overlapping: list[dict] = []
    if user_id:
        overlapping = await find_overlapping_creators(db, signals, user_id)

    # 8. Explainability
    evidence_summary = build_evidence_summary(signals, categories, platforms, confidence)
    limitations      = build_limitations(signals, confidence, is_mock=False, window_days=window_days)

    # 9. Dominant platform / category
    dom_platform = platforms[0].platform if platforms else "unknown"
    dom_category = categories[0].category if categories else "unknown"
    avg_followers = (
        sum(s.followers for s in signals) // max(len(signals), 1)
        if signals else 0
    )
    est_tier     = tiers[0].tier if tiers else "mid"

    return CompetitorReportResult(
        competitor_id=competitor.id,
        competitor_name=competitor.name,
        analysis_window_days=window_days,
        generated_at=datetime.now(timezone.utc),
        creator_count=len(signals),
        dominant_platform=dom_platform,
        dominant_category=dom_category,
        avg_creator_followers=avg_followers,
        estimated_creator_tier=est_tier,
        creator_momentum=momentum,
        campaign_aggression=aggression,
        confidence=confidence,
        is_mock=False,
        creator_signals=signals,
        spend_estimate=spend_est,
        category_dominance=categories,
        platform_breakdown=platforms,
        tier_breakdown=tiers,
        opportunities=opportunities,
        evidence_summary=evidence_summary,
        limitations=limitations,
        note="" if signals else "Yeterli creator sinyali bulunamadı. Archive veri tabanını zenginleştirin.",
    )


async def _get_cached_report(
    db:          AsyncSession,
    competitor_id: int,
    window_days:  int,
    is_mock:      bool,
) -> Optional[CompetitorReportResult]:
    now   = datetime.now(timezone.utc)
    res   = await db.execute(
        select(CompetitorReportCache)
        .where(
            CompetitorReportCache.competitor_id == competitor_id,
            CompetitorReportCache.window_days   == window_days,
            CompetitorReportCache.is_mock       == is_mock,
            CompetitorReportCache.expires_at    > now,
        )
        .order_by(CompetitorReportCache.generated_at.desc())
        .limit(1)
    )
    row = res.scalar_one_or_none()
    if row is None:
        return None
    return _deserialize_report(row.report_json)


async def _cache_report(
    db:           AsyncSession,
    competitor_id: int,
    window_days:  int,
    is_mock:      bool,
    result:       CompetitorReportResult,
) -> None:
    ttl = _CACHE_TTL_MOCK if is_mock else _CACHE_TTL_LIVE
    now = datetime.now(timezone.utc)
    cache_row = CompetitorReportCache(
        competitor_id=competitor_id,
        window_days=window_days,
        is_mock=is_mock,
        report_json=_serialize_report(result),
        generated_at=now,
        expires_at=now + ttl,
    )
    db.add(cache_row)
    try:
        await db.commit()
    except Exception:
        await db.rollback()


async def _fire_events(
    db:         AsyncSession,
    competitor: CompetitorProfile,
    result:     CompetitorReportResult,
) -> None:
    try:
        from app.services.event_bus import publish as publish_event

        await publish_event(
            session=db,
            event_type="competitor.report.generated",
            payload={
                "competitor_id":   competitor.id,
                "competitor_name": competitor.name,
                "is_mock":         result.is_mock,
                "creator_count":   result.creator_count,
                "confidence":      result.confidence,
            },
            source="competitor_intelligence_engine",
        )

        if result.opportunities:
            await publish_event(
                session=db,
                event_type="opportunity.detected",
                payload={
                    "competitor_id":       competitor.id,
                    "opportunity_count":   len(result.opportunities),
                    "top_opportunity":     result.opportunities[0].opportunity_type
                                          if result.opportunities else None,
                },
                source="competitor_intelligence_engine",
            )
    except Exception:
        pass   # Events are best-effort; never crash the main flow


# ── Serialization helpers ─────────────────────────────────────────────────────

def _serialize_report(result: CompetitorReportResult) -> dict:
    """Convert dataclass tree to JSON-serializable dict."""
    from dataclasses import asdict
    d = asdict(result)
    # datetime → ISO string
    if isinstance(d.get("generated_at"), datetime):
        d["generated_at"] = d["generated_at"].isoformat()
    return d


def _deserialize_report(data: dict) -> CompetitorReportResult:
    """Reconstruct CompetitorReportResult from cached JSON dict."""
    from app.services.competitor_intelligence.schemas import (
        CreatorSignal, SpendEstimate, CategoryDominance,
        PlatformBreakdown, TierBreakdown, StrategicOpportunity, CampaignPattern,
    )

    def _signal(d: dict) -> CreatorSignal:
        return CreatorSignal(**d)

    def _spend(d: Optional[dict]) -> Optional[SpendEstimate]:
        return SpendEstimate(**d) if d else None

    def _cat(d: dict)  -> CategoryDominance:  return CategoryDominance(**d)
    def _plat(d: dict) -> PlatformBreakdown:  return PlatformBreakdown(**d)
    def _tier(d: dict) -> TierBreakdown:      return TierBreakdown(**d)
    def _opp(d: dict)  -> StrategicOpportunity: return StrategicOpportunity(**d)
    def _pat(d: dict)  -> CampaignPattern:    return CampaignPattern(**d)

    generated_at = data.get("generated_at")
    if isinstance(generated_at, str):
        generated_at = datetime.fromisoformat(generated_at)

    return CompetitorReportResult(
        competitor_id=data["competitor_id"],
        competitor_name=data["competitor_name"],
        analysis_window_days=data["analysis_window_days"],
        generated_at=generated_at,
        creator_count=data["creator_count"],
        dominant_platform=data["dominant_platform"],
        dominant_category=data["dominant_category"],
        avg_creator_followers=data["avg_creator_followers"],
        estimated_creator_tier=data["estimated_creator_tier"],
        creator_momentum=data["creator_momentum"],
        campaign_aggression=data["campaign_aggression"],
        confidence=data["confidence"],
        is_mock=data["is_mock"],
        creator_signals=[_signal(s) for s in data.get("creator_signals", [])],
        spend_estimate=_spend(data.get("spend_estimate")),
        category_dominance=[_cat(c) for c in data.get("category_dominance", [])],
        platform_breakdown=[_plat(p) for p in data.get("platform_breakdown", [])],
        tier_breakdown=[_tier(t) for t in data.get("tier_breakdown", [])],
        opportunities=[_opp(o) for o in data.get("opportunities", [])],
        campaign_patterns=[_pat(p) for p in data.get("campaign_patterns", [])],
        evidence_summary=data.get("evidence_summary", []),
        limitations=data.get("limitations", []),
        note=data.get("note", ""),
    )
