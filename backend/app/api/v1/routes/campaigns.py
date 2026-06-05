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

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


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


class CampaignUpdateRequest(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[int] = None
    notes: Optional[str] = None
    analysis_ids: Optional[List[int]] = None


def _to_dict(c: Campaign) -> dict:
    return {
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
        "recommended_influencers": c.recommended_influencers or [],
        "roi_estimates": c.roi_estimates or {},
        "total_reach": c.total_reach,
        "estimated_budget": c.estimated_budget,
        "created_at": c.created_at.isoformat() if c.created_at else "",
        "updated_at": c.updated_at.isoformat() if c.updated_at else "",
    }


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
    return {"items": [_to_dict(c) for c in campaigns], "total": count_q.scalar() or 0}


@router.post("")
async def create_campaign(
    req: CampaignCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # AI önerisi: kullanıcının analiz geçmişinden uygun profiller bul
    recommended, roi = await _build_recommendations(db, user.id, req)

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
        total_reach=roi.get("total_reach", 0),
        estimated_budget=roi.get("suggested_budget", 0),
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
    return _to_dict(campaign)


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

    if req.name is not None:     campaign.name = req.name
    if req.brand is not None:    campaign.brand = req.brand
    if req.budget is not None:   campaign.budget = req.budget
    if req.notes is not None:    campaign.notes = req.notes
    if req.status is not None:
        try: campaign.status = CampaignStatus(req.status)
        except ValueError: pass

    if req.analysis_ids is not None:
        campaign.analysis_ids = req.analysis_ids
        # Recalculate ROI estimates
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
    # Load campaign
    c_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user.id)
    )
    campaign = c_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı.")

    # Load analysis
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


# ─── AI Recommendation Helpers ───

async def _build_recommendations(db: AsyncSession, user_id: int, req: CampaignCreateRequest):
    """Find best matching analyses from user history for this campaign."""
    q = select(Analysis).where(Analysis.user_id == user_id)
    if req.platform:
        from app.models.analysis import Platform as PlatEnum
        try: q = q.where(Analysis.platform == PlatEnum(req.platform))
        except ValueError: pass
    q = q.order_by(Analysis.brand_fit_score.desc(), Analysis.fraud_score.asc()).limit(10)
    result = await db.execute(q)
    analyses = result.scalars().all()

    # Filter by category if given
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
