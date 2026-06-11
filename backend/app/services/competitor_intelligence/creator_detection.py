"""
Creator Detection — Extract creator-brand relationship signals from the archive.

Signal types and their confidence levels:
  brand_analysis   (HIGH)   — user ran analysis with this brand name for a creator
  sponsored_hashtag (MEDIUM) — creator's caption contains sponsored brand hashtag patterns
  category_match   (LOW)    — creator category aligns with competitor's industry
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot
from app.models.competitor_intelligence import CompetitorProfile
from app.services.competitor_intelligence.brand_lookup import get_brand_categories
from app.services.competitor_intelligence.schemas import (
    CreatorSignal,
    SIGNAL_BRAND_ANALYSIS, SIGNAL_CATEGORY_MATCH,
    CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, CONFIDENCE_LOW,
    get_creator_tier,
)

logger = logging.getLogger(__name__)

_MAX_CATEGORY_SIGNALS = 30   # cap low-confidence signals to avoid noise


async def detect_creator_signals(
    db: AsyncSession,
    competitor: CompetitorProfile,
    window_days: int = 90,
) -> list[CreatorSignal]:
    """
    Scan the archive and analysis history for creator-brand signals.
    Returns a deduplicated list sorted by signal_strength descending.
    """
    signals: list[CreatorSignal] = []
    seen_profile_ids: set[int] = set()
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

    # ── Signal 1: Analysis records with matching brand name ───────────────────
    try:
        from app.models.analysis import Analysis

        brand_term = competitor.name.lower()
        normalized_term = competitor.normalized_name.replace("_", " ")

        analysis_res = await db.execute(
            select(Analysis)
            .where(
                func.lower(Analysis.brand).contains(brand_term)
                | func.lower(Analysis.brand).contains(normalized_term)
            )
            .where(Analysis.created_at >= cutoff)
            .limit(150)
        )
        analyses = list(analysis_res.scalars().all())

        for analysis in analyses:
            username = analysis.username
            platform = (
                analysis.platform.value
                if hasattr(analysis.platform, "value")
                else str(analysis.platform)
            )

            profile_res = await db.execute(
                select(InfluencerProfile).where(
                    func.lower(InfluencerProfile.username) == username.lower(),
                    InfluencerProfile.platform == platform,
                )
            )
            profile = profile_res.scalar_one_or_none()

            if not profile:
                continue

            if profile.id in seen_profile_ids:
                continue
            seen_profile_ids.add(profile.id)

            snap = await _latest_snap(db, profile.id)
            followers = snap.followers if snap else (analysis.followers or 0)

            signals.append(CreatorSignal(
                influencer_profile_id=profile.id,
                username=username,
                platform=platform,
                followers=followers,
                category=profile.category or "unknown",
                tier=get_creator_tier(followers),
                signal_type=SIGNAL_BRAND_ANALYSIS,
                signal_strength=0.85,
                confidence=CONFIDENCE_HIGH,
                evidence=[f"Marka analizi kaydı: {competitor.name}"],
            ))
    except Exception as exc:
        logger.warning("Brand analysis signal extraction failed: %s", exc)

    # ── Signal 2: Category-based matching (weak signal) ──────────────────────
    try:
        brand_categories = get_brand_categories(competitor)
        added_cat = 0

        for cat in brand_categories:
            if added_cat >= _MAX_CATEGORY_SIGNALS:
                break

            cat_res = await db.execute(
                select(InfluencerProfile)
                .where(InfluencerProfile.category.ilike(f"%{cat}%"))
                .limit(15)
            )
            cat_profiles = list(cat_res.scalars().all())

            for profile in cat_profiles:
                if profile.id in seen_profile_ids:
                    continue
                if added_cat >= _MAX_CATEGORY_SIGNALS:
                    break

                snap = await _latest_snap(db, profile.id)
                followers = snap.followers if snap else 0

                if followers < 5_000:
                    continue

                seen_profile_ids.add(profile.id)
                added_cat += 1

                signals.append(CreatorSignal(
                    influencer_profile_id=profile.id,
                    username=profile.username,
                    platform=profile.platform,
                    followers=followers,
                    category=profile.category or cat,
                    tier=get_creator_tier(followers),
                    signal_type=SIGNAL_CATEGORY_MATCH,
                    signal_strength=0.25,
                    confidence=CONFIDENCE_LOW,
                    evidence=[f"Kategori eşleşmesi: {profile.category} ↔ {competitor.name} ({cat})"],
                ))
    except Exception as exc:
        logger.warning("Category signal extraction failed: %s", exc)

    # Sort by signal strength descending
    signals.sort(key=lambda s: s.signal_strength, reverse=True)
    return signals


async def _latest_snap(db: AsyncSession, profile_id: int) -> Any:
    res = await db.execute(
        select(InfluencerSnapshot)
        .where(InfluencerSnapshot.influencer_id == profile_id)
        .order_by(InfluencerSnapshot.captured_at.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()
