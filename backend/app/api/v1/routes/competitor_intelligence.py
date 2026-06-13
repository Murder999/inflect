"""
Competitor Intelligence Routes — Part 13 (Final Production)

GET  /competitor-intelligence/lookup?q=&limit=10    — autocomplete, 0 credits
POST /competitor-intelligence/report                 — generate, 1 credit
GET  /competitor-intelligence/report/{id}            — cached fetch, 0 credits
GET  /competitor-intelligence/opportunities?brand=   — opportunities feed, 0 credits
"""
from __future__ import annotations

import logging

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.entitlement_service import require_feature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/competitor-intelligence", tags=["competitor-intelligence"])


# ── Request models ────────────────────────────────────────────────────────────

class GenerateReportRequest(BaseModel):
    brand_name:  str  = Field(..., min_length=1, max_length=120)
    window_days: int  = Field(90, ge=14, le=365)
    force:       bool = False


# ── Serializer ────────────────────────────────────────────────────────────────

def _report_to_dict(result) -> dict:
    return {
        "is_mock":               result.is_mock,
        "competitor_id":         result.competitor_id,
        "competitor_name":       result.competitor_name,
        "analysis_window_days":  result.analysis_window_days,
        "generated_at":          result.generated_at.isoformat(),
        "creator_count":         result.creator_count,
        "dominant_platform":     result.dominant_platform,
        "dominant_category":     result.dominant_category,
        "avg_creator_followers": result.avg_creator_followers,
        "estimated_creator_tier": result.estimated_creator_tier,
        "creator_momentum":      result.creator_momentum,
        "campaign_aggression":   result.campaign_aggression,
        "confidence":            result.confidence,
        "spend_estimate": {
            "range_low_tl":  result.spend_estimate.range_low_tl,
            "range_high_tl": result.spend_estimate.range_high_tl,
            "confidence":    result.spend_estimate.confidence,
            "methodology":   result.spend_estimate.methodology,
            "limitations":   result.spend_estimate.limitations,
        } if result.spend_estimate else None,
        "category_dominance": [
            {"category": c.category, "creator_count": c.creator_count,
             "percentage": c.percentage, "rank": c.rank}
            for c in result.category_dominance
        ],
        "platform_breakdown": [
            {"platform": p.platform, "creator_count": p.creator_count,
             "percentage": p.percentage}
            for p in result.platform_breakdown
        ],
        "tier_breakdown": [
            {"tier": t.tier, "creator_count": t.creator_count,
             "percentage": t.percentage}
            for t in result.tier_breakdown
        ],
        "opportunities": [
            {"opportunity_type": o.opportunity_type, "title": o.title,
             "description": o.description, "evidence": o.evidence,
             "priority": o.priority, "confidence": o.confidence}
            for o in result.opportunities
        ],
        "campaign_patterns": [
            {"pattern_type": p.pattern_type, "description": p.description,
             "count": p.count, "confidence": p.confidence}
            for p in result.campaign_patterns
        ],
        "creator_signals": [
            {"username": s.username, "platform": s.platform,
             "followers": s.followers, "category": s.category,
             "tier": s.tier, "signal_type": s.signal_type,
             "signal_strength": round(s.signal_strength, 2),
             "confidence": s.confidence, "evidence": s.evidence}
            for s in result.creator_signals[:50]
        ],
        "evidence_summary": result.evidence_summary,
        "limitations":      result.limitations,
        "note":             result.note,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/lookup")
async def lookup_competitors(
    q:        str            = Query(..., min_length=1, max_length=120, description="Partial brand name for autocomplete"),
    platform: Optional[str] = Query(None, description="Optional platform filter (instagram|tiktok|youtube)"),
    limit:    int            = Query(10, ge=1, le=30),
    db:       AsyncSession   = Depends(get_db),
    user:     User           = Depends(get_current_user),
):
    """
    Autocomplete endpoint for competitor brand search. 0 credits.
    Returns up to `limit` matching CompetitorProfile records.
    Format: [{competitor_id, name, aliases, industry, country, has_active_campaigns, last_campaign_at}]
    """
    try:
        from app.services.competitor_intelligence.brand_lookup import search_competitors
        results = await search_competitors(db, q.strip(), limit=limit)
        return results
    except Exception as exc:
        logger.error("Competitor lookup error for q=%r: %s", q, exc)
        return []   # Always return array — never 500 on autocomplete


@router.post("/report")
async def generate_report(
    body: GenerateReportRequest,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
    _ent: User         = Depends(require_feature("competitor_intelligence")),
):
    """
    Generate a Competitor Intelligence report. Costs 1 credit.
    MOCK mode: deterministic synthetic data (AGENTS_MODE=mock).
    LIVE mode: real archive scan (AGENTS_MODE=live).
    """
    if user.credits_remaining < 1:
        raise HTTPException(status_code=402, detail="Yetersiz kredi.")

    try:
        from app.services.competitor_intelligence.engine import generate_report as _generate
        result = await _generate(
            db=db,
            brand_name=body.brand_name,
            window_days=body.window_days,
            user_id=user.id,
            force=body.force,
        )
    except Exception as exc:
        logger.error("Report generation failed for brand=%r: %s", body.brand_name, exc)
        raise HTTPException(
            status_code=500,
            detail="Rapor üretilemedi. Lütfen tekrar deneyin.",
        )

    user.credits_remaining -= 1
    db.add(user)
    await db.commit()

    return {
        "ok":               True,
        "report":           _report_to_dict(result),
        "credits_remaining": user.credits_remaining,
    }


@router.get("/report/{competitor_id}")
async def get_report(
    competitor_id: int,
    window_days:   int = Query(90, ge=14, le=365),
    db:    AsyncSession = Depends(get_db),
    user:  User = Depends(get_current_user),
):
    """
    Fetch the latest cached report for a competitor. 0 credits.
    Returns 404 if no cached report exists.
    """
    from sqlalchemy import select
    from app.models.competitor_intelligence import CompetitorProfile
    from app.services.competitor_intelligence.engine import _get_cached_report
    from app.core.config import settings

    comp_res = await db.execute(
        select(CompetitorProfile).where(CompetitorProfile.id == competitor_id)
    )
    if not comp_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Rakip bulunamadı.")

    is_mock = (getattr(settings, "AGENTS_MODE", "mock").lower() == "mock")
    result  = await _get_cached_report(db, competitor_id, window_days, is_mock)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Bu rakip için rapor henüz üretilmemiş. POST /competitor-intelligence/report ile rapor oluşturun.",
        )

    return {"ok": True, "report": _report_to_dict(result)}


@router.get("/opportunities")
async def get_opportunities(
    brand:       str = Query(..., min_length=1, max_length=120),
    window_days: int = Query(90, ge=14, le=365),
    db:   AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Return strategic opportunities for a brand. 0 credits if cached, else 1 credit to generate.
    """
    if user.credits_remaining < 1:
        raise HTTPException(status_code=402, detail="Yetersiz kredi.")

    try:
        from app.services.competitor_intelligence.engine import get_opportunities as _get_opps
        opportunities = await _get_opps(db, brand, window_days)
    except Exception as exc:
        logger.error("Opportunities error for brand=%r: %s", brand, exc)
        raise HTTPException(status_code=500, detail="Fırsatlar alınamadı.")

    return {"ok": True, "brand": brand, "opportunities": opportunities}
