"""
Discovery cache layer — Part 24

Checks existing influencer_discovery_candidates for cached results.
Archive results (InfluencerProfile) may be used as candidate seeds but
are always labelled "cached", never "live".
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 24  # candidates older than this are considered stale


async def get_cached_candidates(
    db: AsyncSession,
    platform: str,
    category: str,
    market: str,
    limit: int = 50,
) -> list[dict]:
    """
    Return previously-discovered candidates from the DB that match the criteria.
    Returns list of dicts with cache_status="cached".
    """
    try:
        from app.models.influencer_discovery import InfluencerDiscoveryCandidate
        cutoff = datetime.now(timezone.utc) - timedelta(hours=CACHE_TTL_HOURS)

        stmt = (
            select(InfluencerDiscoveryCandidate)
            .where(
                and_(
                    InfluencerDiscoveryCandidate.created_at >= cutoff,
                    InfluencerDiscoveryCandidate.evidence_quality.in_(["strong", "moderate", "weak"]),
                )
            )
            .order_by(InfluencerDiscoveryCandidate.overall_score.desc().nulls_last())
            .limit(limit)
        )
        results = (await db.execute(stmt)).scalars().all()

        cached = []
        for r in results:
            # Filter by platform/category/market if candidate has the data
            if platform and platform != "all" and r.platform != platform:
                continue
            cached.append({
                "handle":           r.handle,
                "display_name":     r.display_name,
                "platform":         r.platform,
                "profile_url":      r.profile_url,
                "source_provider":  r.source_provider,
                "evidence_quality": r.evidence_quality,
                "overall_score":    r.overall_score,
                "cache_status":     "cached",
                "raw_evidence":     r.raw_evidence or {},
            })

        logger.info("Cache hit: %d cached candidates for platform=%s", len(cached), platform)
        return cached

    except Exception as exc:
        logger.warning("Cache lookup failed: %s", exc)
        return []


async def save_candidates_to_cache(
    db: AsyncSession,
    run_id: int,
    candidates: list[dict],
) -> None:
    """Persist new discovery candidates to DB."""
    try:
        from app.models.influencer_discovery import InfluencerDiscoveryCandidate
        for c in candidates:
            existing_stmt = select(InfluencerDiscoveryCandidate).where(
                and_(
                    InfluencerDiscoveryCandidate.platform == c.get("platform", ""),
                    InfluencerDiscoveryCandidate.handle == c.get("handle", ""),
                )
            )
            existing = (await db.execute(existing_stmt)).scalar_one_or_none()
            if existing:
                # Update if evidence is better
                if _rank_quality(c.get("evidence_quality", "none")) > _rank_quality(existing.evidence_quality or "none"):
                    existing.evidence_quality = c.get("evidence_quality")
                    existing.overall_score = c.get("overall_score")
                    existing.raw_evidence = c.get("raw_evidence", {})
                    db.add(existing)
            else:
                candidate = InfluencerDiscoveryCandidate(
                    run_id=run_id,
                    platform=c.get("platform", "unknown"),
                    handle=c.get("handle", ""),
                    profile_url=c.get("profile_url", ""),
                    display_name=c.get("display_name"),
                    source_provider=c.get("source_provider", "unknown"),
                    evidence_quality=c.get("evidence_quality", "none"),
                    relevance_score=c.get("relevance_score"),
                    market_match_score=c.get("market_match_score"),
                    category_match_score=c.get("category_match_score"),
                    overall_score=c.get("overall_score"),
                    raw_evidence=c.get("raw_evidence", {}),
                    cache_status="live",
                )
                db.add(candidate)
        await db.commit()
        logger.info("Saved %d candidates to cache (run_id=%d)", len(candidates), run_id)
    except Exception as exc:
        logger.warning("Failed to save candidates to cache: %s", exc)
        await db.rollback()


def _rank_quality(q: str) -> int:
    return {"strong": 3, "moderate": 2, "weak": 1, "none": 0}.get(q, 0)
