from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.watchlist import WatchlistItem
from app.models.analysis import Analysis

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


class AddToWatchlistRequest(BaseModel):
    analysis_id: int
    notes: Optional[str] = None


@router.get("")
async def get_watchlist(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WatchlistItem)
        .where(WatchlistItem.user_id == user.id)
        .order_by(WatchlistItem.added_at.desc())
    )
    items = result.scalars().all()
    count = await db.execute(select(func.count(WatchlistItem.id)).where(WatchlistItem.user_id == user.id))
    return {
        "items": [_to_dict(i) for i in items],
        "total": count.scalar() or 0,
    }


@router.post("")
async def add_to_watchlist(
    req: AddToWatchlistRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Load analysis
    a_result = await db.execute(
        select(Analysis).where(Analysis.id == req.analysis_id, Analysis.user_id == user.id)
    )
    analysis = a_result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analiz bulunamadı.")

    # Check already exists
    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == user.id,
            WatchlistItem.username == analysis.username,
            WatchlistItem.platform == (analysis.platform.value if hasattr(analysis.platform, "value") else str(analysis.platform)),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Bu profil zaten izleme listesinde.")

    pd = analysis.profile_data or {}
    plat = analysis.platform.value if hasattr(analysis.platform, "value") else str(analysis.platform)

    item = WatchlistItem(
        user_id=user.id,
        analysis_id=analysis.id,
        username=analysis.username,
        platform=plat,
        display_name=pd.get("display_name", analysis.username),
        avatar=pd.get("avatar", ""),
        category=pd.get("category", ""),
        followers=analysis.followers,
        final_score=analysis.final_score,
        fraud_score=analysis.fraud_score,
        brand_fit_score=analysis.brand_fit_score,
        notes=req.notes,
    )
    db.add(item)
    await db.flush()
    return {"success": True, "item": _to_dict(item)}


@router.delete("/{item_id}")
async def remove_from_watchlist(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WatchlistItem).where(WatchlistItem.id == item_id, WatchlistItem.user_id == user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="İzleme öğesi bulunamadı.")
    await db.delete(item)
    return {"success": True}


@router.get("/check/{username}/{platform}")
async def check_watchlist(
    username: str,
    platform: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == user.id,
            WatchlistItem.username == username,
            WatchlistItem.platform == platform,
        )
    )
    item = result.scalar_one_or_none()
    return {"in_watchlist": bool(item), "item_id": item.id if item else None}


def _to_dict(i: WatchlistItem) -> dict:
    return {
        "id": i.id,
        "analysis_id": i.analysis_id,
        "username": i.username,
        "platform": i.platform,
        "display_name": i.display_name,
        "avatar": i.avatar,
        "category": i.category,
        "followers": i.followers,
        "final_score": i.final_score,
        "fraud_score": i.fraud_score,
        "brand_fit_score": i.brand_fit_score,
        "notes": i.notes,
        "added_at": i.added_at.isoformat() if i.added_at else "",
    }
