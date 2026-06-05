"""
Discovery — Kullanıcının analiz geçmişinden filtrelenmiş & sıralanmış influencer feed'i.
Gerçek veri: sahte/seed veri kullanılmaz.
Archive fallback: kullanıcının hiç analizi yoksa platform genelindeki archive'dan göster.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.analysis import Analysis
from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot

router = APIRouter(prefix="/discover", tags=["discover"])


# ─── Serializers ─────────────────────────────────────────────────────────────

def _to_card(a: Analysis) -> dict:
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
        "bio": (pd.get("bio", "") or "")[:200],
        "followers": a.followers,
        "engagement_rate": a.engagement_rate,
        "avg_views": a.avg_views,
        "final_score": a.final_score,
        "fraud_score": a.fraud_score,
        "fraud_risk": a.fraud_risk,
        "brand_fit_score": a.brand_fit_score,
        "roi_potential_score": a.roi_potential_score,
        "momentum_score": a.momentum_score,
        "engagement_quality_score": a.engagement_quality_score,
        "reputation_risk_score": a.reputation_risk_score,
        "decision": a.decision,
        "created_at": a.created_at.isoformat() if a.created_at else "",
        "source": "analysis",
    }


def _to_card_from_archive(p: InfluencerProfile, s: InfluencerSnapshot) -> dict:
    """Archive profilini discovery card formatına çevirir."""
    return {
        "id": -(p.id),          # Negatif ID: archive kaynağını belirtir
        "username": p.username,
        "display_name": p.display_name or p.username,
        "platform": p.platform,
        "platform_label": p.platform.capitalize(),
        "avatar": p.profile_image_url or "",
        "category": p.category or "",
        "country": p.country or "",
        "bio": (p.bio or "")[:200],
        "followers": s.followers,
        "engagement_rate": s.engagement_rate,
        "avg_views": s.avg_views,
        "final_score": s.final_score,
        "fraud_score": s.fraud_score,
        "fraud_risk": s.fraud_risk,
        "brand_fit_score": s.brand_fit_score,
        "roi_potential_score": s.roi_potential_score,
        "momentum_score": s.momentum_score,
        "engagement_quality_score": s.engagement_quality_score,
        "reputation_risk_score": s.reputation_risk_score,
        "decision": s.decision,
        "created_at": s.captured_at.isoformat() if s.captured_at else "",
        "source": "archive",
    }


# ─── Archive helpers ──────────────────────────────────────────────────────────

async def _archive_top(
    db: AsyncSession,
    order_col,
    n: int = 10,
    extra_where=None,
    asc: bool = False,
) -> list:
    """Archive'dan metrik sıralamasına göre en iyi snapshot'lara sahip profilleri döndürür."""
    q = (
        select(InfluencerProfile, InfluencerSnapshot)
        .join(InfluencerSnapshot, InfluencerSnapshot.influencer_id == InfluencerProfile.id)
    )
    if extra_where is not None:
        q = q.where(extra_where)
    col = order_col.asc() if asc else order_col.desc()
    q = q.order_by(col).limit(n)
    rows = (await db.execute(q)).all()
    return [_to_card_from_archive(p, s) for p, s in rows]


async def _archive_feed_fallback(
    db: AsyncSession,
    platform: Optional[str],
    search: Optional[str],
    limit: int,
) -> list:
    """Kullanıcının analizi yokken archive'dan göster."""
    q = (
        select(InfluencerProfile, InfluencerSnapshot)
        .join(InfluencerSnapshot, InfluencerSnapshot.influencer_id == InfluencerProfile.id)
        .order_by(desc(InfluencerSnapshot.final_score))
        .limit(limit)
    )
    if platform and platform != "all":
        q = q.where(InfluencerProfile.platform == platform)
    if search:
        q = q.where(
            (InfluencerProfile.username.ilike(f"%{search}%")) |
            (InfluencerProfile.display_name.ilike(f"%{search}%"))
        )
    rows = (await db.execute(q)).all()
    return [_to_card_from_archive(p, s) for p, s in rows]


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/feed")
async def discovery_feed(
    platform: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    min_followers: int = Query(0, ge=0),
    max_followers: int = Query(999_000_000, ge=0),
    min_engagement: float = Query(0, ge=0),
    max_fraud: int = Query(100, ge=0, le=100),
    min_brand_fit: int = Query(0, ge=0, le=100),
    min_momentum: int = Query(0, ge=0, le=100),
    min_roi: int = Query(0, ge=0, le=100),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Filtered discovery feed — kendi analizler, yoksa archive fallback."""
    q = select(Analysis).where(Analysis.user_id == user.id)

    if platform and platform != "all":
        from app.models.analysis import Platform as PlatEnum
        try:
            q = q.where(Analysis.platform == PlatEnum(platform))
        except ValueError:
            pass

    if max_fraud < 100:
        q = q.where(Analysis.fraud_score <= max_fraud)
    if min_brand_fit > 0:
        q = q.where(Analysis.brand_fit_score >= min_brand_fit)
    if min_momentum > 0:
        q = q.where(Analysis.momentum_score >= min_momentum)
    if min_roi > 0:
        q = q.where(Analysis.roi_potential_score >= min_roi)
    if min_followers > 0:
        q = q.where(Analysis.followers >= min_followers)
    if max_followers < 999_000_000:
        q = q.where(Analysis.followers <= max_followers)
    if min_engagement > 0:
        q = q.where(Analysis.engagement_rate >= min_engagement)

    q = q.order_by(Analysis.final_score.desc()).limit(limit)
    all_analyses = (await db.execute(q)).scalars().all()

    cards = []
    for a in all_analyses:
        pd = a.profile_data or {}
        a_cat     = (pd.get("category", "") or "").lower()
        a_country = (pd.get("country", "") or "").lower()
        a_username = (a.username or "").lower()
        a_name    = (pd.get("display_name", "") or "").lower()

        if category and category.lower() not in a_cat:
            continue
        if country and country.lower() not in a_country:
            continue
        if search and search.lower() not in a_username and search.lower() not in a_name:
            continue
        cards.append(_to_card(a))

    # Archive fallback — yalnızca kişisel sonuç yoksa
    note = "Discovery, analiz yaptığınız influencer'lardan oluşur. Daha fazla analiz → daha zengin keşif."
    if not cards:
        archive_cards = await _archive_feed_fallback(db, platform, search, limit)
        if archive_cards:
            cards = archive_cards
            note = "Henüz bu filtreyle kişisel analiz bulunamadı. Aşağıdaki profiller platform archive'ından geliyor."

    return {
        "items": cards,
        "total": len(cards),
        "has_data": len(cards) > 0,
        "note": note,
    }


@router.get("/sections")
async def discovery_sections(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Top-N sections — kendi analizler, yoksa archive fallback."""
    base = select(Analysis).where(Analysis.user_id == user.id)
    N = 10

    async def top(order_col, extra_where=None, asc=False):
        q = base
        if extra_where is not None:
            q = q.where(extra_where)
        col = order_col.asc() if asc else order_col.desc()
        res = await db.execute(q.order_by(col).limit(N))
        return [_to_card(a) for a in res.scalars().all()]

    rising      = await top(Analysis.momentum_score)
    brand_fit   = await top(Analysis.brand_fit_score)
    roi         = await top(Analysis.roi_potential_score)
    micro       = await top(Analysis.final_score, Analysis.followers < 100_000)
    macro       = await top(Analysis.final_score, Analysis.followers >= 500_000)
    lowest_risk = await top(Analysis.fraud_score, asc=True)

    total_q = await db.execute(
        select(func.count(Analysis.id)).where(Analysis.user_id == user.id)
    )
    total = total_q.scalar() or 0

    # Archive fallback — kullanıcının hiç analizi yoksa
    archive_note = None
    if total == 0:
        archive_note = "Henüz analiz yapmadınız. Aşağıdaki profiller platform archive'ından geliyor — gerçek analizlerden oluşturuldu."
        rising      = await _archive_top(db, InfluencerSnapshot.momentum_score, N)
        brand_fit   = await _archive_top(db, InfluencerSnapshot.brand_fit_score, N)
        roi         = await _archive_top(db, InfluencerSnapshot.roi_potential_score, N)
        micro       = await _archive_top(
            db, InfluencerSnapshot.final_score, N,
            InfluencerSnapshot.followers < 100_000,
        )
        macro       = await _archive_top(
            db, InfluencerSnapshot.final_score, N,
            InfluencerSnapshot.followers >= 500_000,
        )
        lowest_risk = await _archive_top(db, InfluencerSnapshot.fraud_score, N, asc=True)

    has_data = total > 0 or bool(rising or brand_fit or roi or lowest_risk)

    return {
        "has_data":       has_data,
        "total_analyses": total,
        "rising":         rising,
        "brand_fit":      brand_fit,
        "roi":            roi,
        "micro":          micro,
        "macro":          macro,
        "lowest_risk":    lowest_risk,
        "note": archive_note or "Veriler kendi analiz geçmişinizden gelmektedir.",
    }


@router.get("/similar/{analysis_id}")
async def similar_influencers(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Kullanıcının analiz geçmişinden benzer profiller."""
    res = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    source = res.scalar_one_or_none()
    if not source:
        return {"items": [], "total": 0}

    src_cat = (source.profile_data or {}).get("category", "") or ""

    result = await db.execute(
        select(Analysis).where(
            Analysis.user_id == user.id,
            Analysis.id != analysis_id,
            Analysis.platform == source.platform,
        ).order_by(Analysis.final_score.desc()).limit(20)
    )
    candidates = result.scalars().all()

    similar = []
    for c in candidates:
        c_cat = (c.profile_data or {}).get("category", "") or ""
        if source.followers > 0:
            follower_ratio = c.followers / source.followers
            if follower_ratio < 0.1 or follower_ratio > 10:
                continue
        score_delta = abs(c.final_score - source.final_score)
        cat_match = (
            src_cat.lower() in c_cat.lower() or c_cat.lower() in src_cat.lower()
            if src_cat and c_cat else False
        )
        similarity = max(0, 100 - score_delta // 2 + (20 if cat_match else 0))
        card = _to_card(c)
        card["similarity"] = min(similarity, 99)
        card["similarity_reason"] = _similarity_reason(source, c, cat_match)
        similar.append(card)

    similar.sort(key=lambda x: x["similarity"], reverse=True)
    return {"items": similar[:10], "total": len(similar)}


def _similarity_reason(source: Analysis, candidate: Analysis, cat_match: bool) -> str:
    reasons = []
    plat = source.platform.value if hasattr(source.platform, "value") else str(source.platform)
    reasons.append(f"Aynı platform ({plat.capitalize()})")
    if cat_match:
        cat = (source.profile_data or {}).get("category", "")
        reasons.append(f"Benzer kategori ({cat})")
    if abs(source.final_score - candidate.final_score) < 15:
        reasons.append("Yakın risk & value skoru")
    if abs(source.fraud_score - candidate.fraud_score) < 20:
        reasons.append("Benzer fraud profili")
    return ", ".join(reasons[:3])
