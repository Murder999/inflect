from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, desc
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.analysis import Analysis
from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _analysis_card(a: Analysis) -> dict:
    pd = a.profile_data or {}
    return {
        "id": a.id,
        "username": a.username,
        "display_name": pd.get("display_name", a.username),
        "platform": a.platform.value if hasattr(a.platform, "value") else str(a.platform),
        "platform_label": pd.get("platform_label", ""),
        "avatar": pd.get("profile_image_url") or pd.get("avatar", ""),
        "category": pd.get("category", ""),
        "country": pd.get("country", ""),
        "followers": a.followers,
        "engagement_rate": a.engagement_rate,
        "final_score": a.final_score,
        "fraud_score": a.fraud_score,
        "fraud_risk": a.fraud_risk,
        "brand_fit_score": a.brand_fit_score,
        "roi_potential_score": a.roi_potential_score,
        "momentum_score": a.momentum_score,
        "engagement_quality_score": a.engagement_quality_score,
        "decision": a.decision,
        "created_at": a.created_at.isoformat() if a.created_at else "",
        "source": "analysis",
    }


def _archive_card(p: InfluencerProfile, s: InfluencerSnapshot) -> dict:
    return {
        "id": -(p.id),
        "username": p.username,
        "display_name": p.display_name or p.username,
        "platform": p.platform,
        "platform_label": p.platform.capitalize(),
        "avatar": p.profile_image_url or "",
        "category": p.category or "",
        "country": p.country or "",
        "followers": s.followers,
        "engagement_rate": s.engagement_rate,
        "final_score": s.final_score,
        "fraud_score": s.fraud_score,
        "fraud_risk": s.fraud_risk,
        "brand_fit_score": s.brand_fit_score,
        "roi_potential_score": s.roi_potential_score,
        "momentum_score": s.momentum_score,
        "engagement_quality_score": s.engagement_quality_score,
        "decision": s.decision,
        "created_at": s.captured_at.isoformat() if s.captured_at else "",
        "source": "archive",
    }


async def _archive_top_n(
    db: AsyncSession,
    order_col,
    n: int,
    asc: bool = False,
) -> list:
    q = (
        select(InfluencerProfile, InfluencerSnapshot)
        .join(InfluencerSnapshot, InfluencerSnapshot.influencer_id == InfluencerProfile.id)
        .order_by(order_col.asc() if asc else order_col.desc())
        .limit(n)
    )
    rows = (await db.execute(q)).all()
    return [_archive_card(p, s) for p, s in rows]


@router.get("/stats")
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_analyses = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.user_id == user.id)
    )).scalar() or 0

    this_month = (await db.execute(
        select(func.count(Analysis.id)).where(
            Analysis.user_id == user.id,
            Analysis.created_at >= month_start,
        )
    )).scalar() or 0

    risk_row = (await db.execute(
        select(
            func.count(case((Analysis.fraud_score < 25, 1))).label("low"),
            func.count(case((Analysis.fraud_score.between(25, 59), 1))).label("medium"),
            func.count(case((Analysis.fraud_score >= 60, 1))).label("high"),
        ).where(Analysis.user_id == user.id)
    )).one()

    platforms = {
        (r[0].value if hasattr(r[0], "value") else str(r[0])): r[1]
        for r in (await db.execute(
            select(Analysis.platform, func.count(Analysis.id))
            .where(Analysis.user_id == user.id)
            .group_by(Analysis.platform)
            .order_by(func.count(Analysis.id).desc())
        )).all()
    }

    recent = [
        _analysis_card(a)
        for a in (await db.execute(
            select(Analysis)
            .where(Analysis.user_id == user.id)
            .order_by(Analysis.created_at.desc())
            .limit(10)
        )).scalars().all()
    ]

    # Archive preview: kullanicinin analizi yoksa archive'dan goster
    archive_preview: list = []
    archive_count = 0
    if total_analyses == 0:
        archive_count = (await db.execute(
            select(func.count(InfluencerProfile.id))
        )).scalar() or 0
        if archive_count > 0:
            archive_preview = await _archive_top_n(db, InfluencerSnapshot.final_score, 8)

    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "company": user.company,
            "plan": user.plan.value if hasattr(user.plan, "value") else str(user.plan),
            "credits_remaining": user.credits_remaining,
            "credits_total": user.credits_total,
            "is_admin": user.is_admin,
        },
        "stats": {
            "total_analyses": total_analyses,
            "this_month": this_month,
            "credits_remaining": user.credits_remaining,
            "credits_total": user.credits_total,
            "low_risk": risk_row.low or 0,
            "medium_risk": risk_row.medium or 0,
            "high_risk": risk_row.high or 0,
        },
        "platforms": platforms,
        "recent_analyses": recent,
        "archive_preview": archive_preview,
        "archive_count": archive_count,
    }


@router.get("/leaderboards")
async def dashboard_leaderboards(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Top-10 listeler — kullanicinin analizi yoksa archive'dan."""
    base  = select(Analysis).where(Analysis.user_id == user.id)
    limit = 10

    async def top(order_by, asc=False):
        col = order_by.asc() if asc else order_by.desc()
        res = await db.execute(base.order_by(col).limit(limit))
        return [_analysis_card(a) for a in res.scalars().all()]

    lowest_risk   = await top(Analysis.fraud_score, asc=True)
    highest_brand = await top(Analysis.brand_fit_score)
    highest_roi   = await top(Analysis.roi_potential_score)
    highest_mom   = await top(Analysis.momentum_score)
    best_overall  = await top(Analysis.final_score)

    has_data     = bool(lowest_risk or best_overall)
    from_archive = False

    if not has_data:
        lowest_risk   = await _archive_top_n(db, InfluencerSnapshot.fraud_score,         limit, asc=True)
        highest_brand = await _archive_top_n(db, InfluencerSnapshot.brand_fit_score,     limit)
        highest_roi   = await _archive_top_n(db, InfluencerSnapshot.roi_potential_score, limit)
        highest_mom   = await _archive_top_n(db, InfluencerSnapshot.momentum_score,      limit)
        best_overall  = await _archive_top_n(db, InfluencerSnapshot.final_score,         limit)
        has_data      = bool(best_overall)
        from_archive  = has_data

    return {
        "lowest_risk":      lowest_risk,
        "highest_brand":    highest_brand,
        "highest_roi":      highest_roi,
        "highest_momentum": highest_mom,
        "best_overall":     best_overall,
        "has_data":         has_data,
        "from_archive":     from_archive,
    }
