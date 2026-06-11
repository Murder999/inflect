"""
Influencer Lookup API — Part 12 UX Fix
GET /api/v1/influencers/lookup — username/URL search with twin status.
No credits consumed for lookup.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.influencers import lookup as lookup_service

router = APIRouter(prefix="/influencers", tags=["Influencers"])


@router.get("/lookup", summary="Influencer ara (username / URL)")
async def lookup_influencer(
    q: str = Query(min_length=1, max_length=300, description="username, @handle veya profil URL"),
    platform: Optional[str] = Query(default=None, description="instagram | tiktok | youtube"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Search the archive for influencers by username, @handle, or social profile URL.

    - No credit is consumed.
    - Includes twin status and data sufficiency for each result.
    - Supports: cristiano, @cristiano, instagram:cristiano,
      https://www.instagram.com/cristiano/,
      https://www.tiktok.com/@khaby.lame,
      https://www.youtube.com/@mkbhd
    """
    q = q.strip()
    if not q:
        raise HTTPException(status_code=422, detail="Arama sorgusu boş olamaz.")

    result = await lookup_service.search(db=db, query=q, platform=platform)
    return result
