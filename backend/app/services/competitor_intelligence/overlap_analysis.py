"""
Overlap Analysis — Creators used by both the competitor and the current user.
Uses the user's campaign history and analysis history to find overlapping creators.
"""
from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.influencer_archive import InfluencerProfile
from app.services.competitor_intelligence.schemas import CreatorSignal


async def find_overlapping_creators(
    db: AsyncSession,
    competitor_signals: list[CreatorSignal],
    user_id: int,
) -> list[dict]:
    """
    Return the subset of competitor's creators that the current user has also
    analyzed or included in their campaigns.
    """
    if not competitor_signals:
        return []

    competitor_profile_ids = {s.influencer_profile_id for s in competitor_signals}

    # Check Analysis records for this user
    try:
        from app.models.analysis import Analysis

        usernames_in_competitor = {
            s.username.lower()
            for s in competitor_signals
        }

        user_analysis_res = await db.execute(
            select(Analysis.username, Analysis.platform)
            .where(Analysis.user_id == user_id)
            .distinct()
        )
        user_analyzed = {
            (row.username.lower(), row.platform if not hasattr(row.platform, "value")
             else row.platform.value)
            for row in user_analysis_res.all()
        }

        overlap = []
        for signal in competitor_signals:
            key = (signal.username.lower(), signal.platform)
            if key in user_analyzed:
                overlap.append({
                    "profile_id": signal.influencer_profile_id,
                    "username":   signal.username,
                    "platform":   signal.platform,
                    "followers":  signal.followers,
                    "tier":       signal.tier,
                    "category":   signal.category,
                    "overlap_type": "analyzed",
                })
        return overlap

    except Exception:
        return []
