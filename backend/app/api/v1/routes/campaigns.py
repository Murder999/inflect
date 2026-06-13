from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.campaign import Campaign, CampaignStatus
from app.models.analysis import Analysis
from app.services.campaign_discovery_service import (
    CampaignBrief,
    discover_campaign_creators,
    serialize_discovery_result,
)
from app.services.entitlement_service import check_feature_access

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


# ── Plan ordering for redaction ────────────────────────────────────────────────

PLAN_ORDER = {
    "free": 0, "starter": 1, "pro": 2,
    "business": 2, "agency": 3, "enterprise": 4,
}


def _plan_level(user: User) -> int:
    plan = user.plan.value if hasattr(user.plan, "value") else str(user.plan)
    return PLAN_ORDER.get(plan, 0)


# ── Request models ─────────────────────────────────────────────────────────────

class CampaignCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    brand: Optional[str] = None
    platform: Optional[str] = None
    budget: Optional[int] = None
    category: Optional[str] = None
    target_country: Optional[str] = None
    target_audience: Optional[str] = None
    goal: Optional[str] = "brand_awareness"
    notes: Optional[str] = None
    simulation_result: Optional[dict] = None
    # Report metadata from discovery
    report_source: Optional[str] = None
    data_confidence: Optional[str] = None
    provider_status: Optional[str] = None
    discovery_sources: Optional[List[str]] = None


class CampaignUpdateRequest(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[int] = None
    notes: Optional[str] = None
    analysis_ids: Optional[List[int]] = None


class CampaignDiscoverRequest(BaseModel):
    platform: str = "all"
    category: str = ""
    country: str = ""
    goal: str = "brand_awareness"
    budget: int = Field(..., ge=500)
    brand: str = ""
    duration_weeks: int = 4


# ── Serializers ────────────────────────────────────────────────────────────────

def _to_dict(c: Campaign, redaction_level: str = "none") -> dict:
    """Serialize campaign with optional redaction."""
    base = {
        "id": c.id,
        "name": c.name,
        "brand": c.brand,
        "platform": c.platform,
        "status": c.status.value if hasattr(c.status, "value") else str(c.status),
        "budget": c.budget,
        "category": c.category,
        "target_country": c.target_country,
        "target_audience": c.target_audience,
        "goal": c.goal,
        "notes": c.notes,
        "analysis_ids": c.analysis_ids or [],
        "total_reach": c.total_reach,
        "estimated_budget": c.estimated_budget,
        "created_at": c.created_at.isoformat() if c.created_at else "",
        "updated_at": c.updated_at.isoformat() if c.updated_at else "",
        # Report metadata (always public)
        "report_source": c.report_source,
        "data_confidence": c.data_confidence,
        "provider_status": c.provider_status,
        "discovery_sources": c.discovery_sources or [],
        "report_generated_at": c.report_generated_at.isoformat() if c.report_generated_at else None,
        "redaction_level": redaction_level,
    }

    if redaction_level == "full":
        # Free: only basic summary, no simulation_result, no portfolio
        base["simulation_result"] = None
        base["recommended_influencers"] = []
        base["roi_estimates"] = {}
        base["locked_sections"] = [
            {
                "key": "simulation_result",
                "title": "Kampanya Simülasyon Raporu",
                "required_plan": "starter",
                "message": "Tam simülasyon raporu için Starter veya üzeri pakete geçin.",
            },
            {
                "key": "creator_portfolio",
                "title": "Creator Portföy Analizi",
                "required_plan": "starter",
                "message": "Creator portföy detaylarını görmek için Starter pakete geçin.",
            },
            {
                "key": "budget_allocation",
                "title": "Bütçe Optimizasyonu",
                "required_plan": "pro",
                "message": "Bütçe dağılım detaylarını görmek için Pro pakete geçin.",
            },
        ]
    elif redaction_level == "basic":
        # Starter: basic preview, limited creators (3), no full scoring
        sim = c.simulation_result
        if sim and isinstance(sim, dict):
            # Show only summary fields, not full creator scores
            preview_sim = {
                "summary": sim.get("summary", ""),
                "feasibility": sim.get("feasibility", {}),
                "confidence": {"overall": sim.get("confidence", {}).get("overall"), "grade": sim.get("confidence", {}).get("grade")},
                "totalReach": sim.get("totalReach", {}),
                "creatorsFromDB": sim.get("creatorsFromDB", 0),
                "usedFallbackData": sim.get("usedFallbackData", False),
                "_preview": True,
            }
        else:
            preview_sim = None
        base["simulation_result"] = preview_sim
        base["recommended_influencers"] = (c.recommended_influencers or [])[:3]
        base["roi_estimates"] = _strip_roi_details(c.roi_estimates)
        base["locked_sections"] = [
            {
                "key": "full_simulation",
                "title": "Tam Simülasyon Raporu",
                "required_plan": "pro",
                "message": "Tüm detayları (ROI, risk analizi, bütçe optimizasyonu) Pro pakette görün.",
            }
        ]
    elif redaction_level == "pro":
        # Pro: full report except agency-specific features
        base["simulation_result"] = c.simulation_result
        base["recommended_influencers"] = c.recommended_influencers or []
        base["roi_estimates"] = c.roi_estimates or {}
        base["locked_sections"] = [
            {
                "key": "white_label_export",
                "title": "White-Label Rapor",
                "required_plan": "agency",
                "message": "Müşteriye özel white-label raporlar Agency paketinde.",
            }
        ]
    else:
        # none (agency+): full report
        base["simulation_result"] = c.simulation_result
        base["recommended_influencers"] = c.recommended_influencers or []
        base["roi_estimates"] = c.roi_estimates or {}
        base["locked_sections"] = []

    return base


def _strip_roi_details(roi: Optional[dict]) -> dict:
    """Return only non-sensitive ROI fields for Starter plan."""
    if not roi:
        return {}
    return {
        "influencer_count": roi.get("influencer_count"),
        "currency": roi.get("currency", "USD"),
        "note": roi.get("note", ""),
    }


def _determine_redaction(user: User) -> str:
    level = _plan_level(user)
    if user.is_admin or level >= 3:  # agency+
        return "none"
    if level >= 2:  # pro
        return "pro"
    if level >= 1:  # starter
        return "basic"
    return "full"  # free


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/discover")
async def discover_campaign(
    req: CampaignDiscoverRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Server-side campaign discovery:
    - Queries archive for provider-verified creators
    - Applies DataCompleteness gate (< 60% excluded)
    - Computes server-side scores and budget allocation
    - Returns insufficient_verified_data if no creators pass gate

    No archive fallback for portfolio. No mock data.
    """
    # Entitlement check: campaign_roi_simulation requires starter+
    access = await check_feature_access(db, user, "campaign_roi_simulation")
    if not access.allowed:
        raise HTTPException(status_code=403, detail={
            "error_code": "FEATURE_LOCKED",
            "feature_key": "campaign_roi_simulation",
            "required_plan": access.required_plan,
            "current_plan": access.current_plan,
            "upgrade_title": "Kampanya Keşfi",
            "upgrade_message": "Provider-backed campaign discovery Starter veya üzeri pakette kullanılabilir.",
            "cta_label": "Starter'a Geç",
            "cta_url": "/pricing",
            "preview_available": True,
        })

    brief = CampaignBrief(
        platform=req.platform,
        category=req.category,
        country=req.country,
        goal=req.goal,
        budget=req.budget,
        brand=req.brand,
        duration_weeks=req.duration_weeks,
    )

    result = await discover_campaign_creators(db, brief)
    return serialize_discovery_result(result)


@router.get("")
async def list_campaigns(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Campaign).where(Campaign.user_id == user.id)
    if status:
        try:
            q = q.where(Campaign.status == CampaignStatus(status))
        except ValueError:
            pass
    q = q.order_by(Campaign.updated_at.desc())
    result = await db.execute(q)
    campaigns = result.scalars().all()

    count_q = await db.execute(select(func.count(Campaign.id)).where(Campaign.user_id == user.id))
    redaction = _determine_redaction(user)
    return {
        "items": [_to_dict(c, redaction) for c in campaigns],
        "total": count_q.scalar() or 0,
    }


@router.post("")
async def create_campaign(
    req: CampaignCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    recommended, roi = await _build_recommendations(db, user.id, req)

    sim_result = _sanitize_sim_result(req.simulation_result)

    # Determine report_source based on what was submitted
    report_source = req.report_source or (
        "client_simulation_preview" if sim_result else "insufficient_data"
    )

    campaign = Campaign(
        user_id=user.id,
        name=req.name,
        brand=req.brand,
        platform=req.platform,
        budget=req.budget,
        category=req.category,
        target_country=req.target_country,
        target_audience=req.target_audience,
        goal=req.goal,
        notes=req.notes,
        recommended_influencers=recommended,
        roi_estimates=roi,
        simulation_result=sim_result,
        total_reach=roi.get("total_reach", 0),
        estimated_budget=roi.get("suggested_budget", 0),
        report_source=report_source,
        data_confidence=req.data_confidence or ("medium" if sim_result else None),
        provider_status=req.provider_status,
        discovery_sources=req.discovery_sources,
        report_generated_at=datetime.now(timezone.utc),
        redaction_level=None,
    )
    db.add(campaign)
    await db.flush()
    return {"success": True, "campaign": _to_dict(campaign)}


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı.")

    redaction = _determine_redaction(user)
    return _to_dict(campaign, redaction)


@router.patch("/{campaign_id}")
async def update_campaign(
    campaign_id: int,
    req: CampaignUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı.")

    if req.name is not None:   campaign.name = req.name
    if req.brand is not None:  campaign.brand = req.brand
    if req.budget is not None: campaign.budget = req.budget
    if req.notes is not None:  campaign.notes = req.notes
    if req.status is not None:
        try: campaign.status = CampaignStatus(req.status)
        except ValueError: pass

    if req.analysis_ids is not None:
        campaign.analysis_ids = req.analysis_ids
        _, roi = await _build_recommendations_from_ids(db, req.analysis_ids)
        campaign.roi_estimates = roi
        campaign.total_reach = roi.get("total_reach", 0)

    await db.flush()
    return {"success": True, "campaign": _to_dict(campaign)}


@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user.id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı.")
    await db.delete(campaign)
    return {"success": True}


@router.post("/{campaign_id}/add-influencer")
async def add_influencer(
    campaign_id: int,
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user.id)
    )
    campaign = c_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı.")

    a_result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    analysis = a_result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analiz bulunamadı.")

    ids = list(campaign.analysis_ids or [])
    if analysis_id not in ids:
        ids.append(analysis_id)
        campaign.analysis_ids = ids
        _, roi = await _build_recommendations_from_ids(db, ids)
        campaign.roi_estimates = roi
        campaign.total_reach = roi.get("total_reach", 0)
        await db.flush()

    return {"success": True, "campaign": _to_dict(campaign)}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _sanitize_sim_result(sim: Optional[dict]) -> Optional[dict]:
    """Recursively remove non-JSON-serializable values from simulation result."""
    if sim is None:
        return None
    import json
    try:
        return json.loads(json.dumps(sim, default=str))
    except Exception:
        return None


async def _build_recommendations(db: AsyncSession, user_id: int, req: CampaignCreateRequest):
    q = select(Analysis).where(Analysis.user_id == user_id)
    if req.platform:
        from app.models.analysis import Platform as PlatEnum
        try: q = q.where(Analysis.platform == PlatEnum(req.platform))
        except ValueError: pass
    q = q.order_by(Analysis.brand_fit_score.desc(), Analysis.fraud_score.asc()).limit(10)
    result = await db.execute(q)
    analyses = result.scalars().all()

    if req.category:
        cat = req.category.lower()
        analyses = [a for a in analyses if cat in ((a.profile_data or {}).get("category", "") or "").lower()]

    recommended = []
    for a in analyses[:6]:
        pd = a.profile_data or {}
        recommended.append({
            "analysis_id": a.id,
            "username": a.username,
            "display_name": pd.get("display_name", a.username),
            "platform": a.platform.value if hasattr(a.platform, "value") else str(a.platform),
            "avatar": pd.get("avatar", ""),
            "followers": a.followers,
            "engagement_rate": a.engagement_rate,
            "final_score": a.final_score,
            "fraud_score": a.fraud_score,
            "brand_fit_score": a.brand_fit_score,
            "roi_potential_score": a.roi_potential_score,
        })

    roi = _calc_roi(analyses[:6], req.budget)
    return recommended, roi


async def _build_recommendations_from_ids(db: AsyncSession, analysis_ids: list):
    if not analysis_ids:
        return [], {}
    result = await db.execute(select(Analysis).where(Analysis.id.in_(analysis_ids)))
    analyses = result.scalars().all()
    rec = []
    for a in analyses:
        pd = a.profile_data or {}
        rec.append({
            "analysis_id": a.id,
            "username": a.username,
            "display_name": pd.get("display_name", a.username),
            "platform": a.platform.value if hasattr(a.platform, "value") else str(a.platform),
            "avatar": pd.get("avatar", ""),
            "followers": a.followers,
            "engagement_rate": a.engagement_rate,
            "final_score": a.final_score,
            "fraud_score": a.fraud_score,
        })
    roi = _calc_roi(analyses, None)
    return rec, roi


def _calc_roi(analyses: list, budget: Optional[int]) -> dict:
    if not analyses:
        return {}
    total_followers = sum(a.followers for a in analyses)
    total_reach = int(total_followers * 0.35)
    total_impressions = int(total_reach * 2.5)
    total_clicks = int(total_impressions * 0.018)
    avg_fraud = int(sum(a.fraud_score for a in analyses) / len(analyses))
    avg_roi = int(sum(a.roi_potential_score for a in analyses) / len(analyses))
    avg_brand = int(sum(a.brand_fit_score for a in analyses) / len(analyses))
    avg_views = int(sum(a.avg_views for a in analyses) / len(analyses))
    suggested_budget = int((avg_views / 1000) * 4 * len(analyses)) if avg_views else 0
    return {
        "influencer_count": len(analyses),
        "total_followers": total_followers,
        "total_reach": total_reach,
        "total_impressions": total_impressions,
        "total_clicks": total_clicks,
        "avg_fraud_score": avg_fraud,
        "avg_roi_potential": avg_roi,
        "avg_brand_fit": avg_brand,
        "suggested_budget": suggested_budget if not budget else budget,
        "budget_per_influencer": suggested_budget // len(analyses) if analyses else 0,
        "currency": "USD",
        "note": "Tahminler analiz geçmişine dayalıdır. Gerçek performans kampanya sürecinde netleşir.",
    }
