"""
Influencer Lookup — Efficient DB search with twin status and data sufficiency.
Used by the lookup API endpoint; no external network calls.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot
from app.models.digital_twin import InfluencerDigitalTwin, ConfidenceLevel
from app.services.influencers.identity import normalize_handle, normalize_platform
from app.services.digital_twin.data_quality import (
    MIN_SNAPSHOTS_FOR_FORECAST, MIN_DAYS_COVERAGE,
)

MAX_RESULTS = 20


async def search(
    db: AsyncSession,
    query: str,
    platform: Optional[str] = None,
) -> dict[str, Any]:
    """
    Search InfluencerProfile by username/handle, with optional platform filter.
    Returns structured lookup response including twin status and data sufficiency.
    """
    username, detected_platform = normalize_handle(query)
    effective_platform = normalize_platform(platform) or detected_platform

    # ── Build profile query ───────────────────────────────────────────────────
    # Priority order: exact platform+username > exact username > ilike username
    profiles = await _fetch_profiles(db, username, effective_platform)

    if not profiles:
        return {
            "query": query,
            "normalized_username": username,
            "detected_platform": effective_platform,
            "results": [],
        }

    # ── Enrich each profile ───────────────────────────────────────────────────
    results = []
    for profile in profiles[:MAX_RESULTS]:
        enriched = await _enrich(db, profile)
        results.append(enriched)

    # Sort: exact match first, then by snapshot count desc, then followers desc
    results.sort(
        key=lambda r: (
            -(r["username"] == username and (effective_platform is None or r["platform"] == effective_platform)),
            -(r["username"] == username),
            -r["snapshot_count"],
            -r["followers"],
        )
    )

    return {
        "query": query,
        "normalized_username": username,
        "detected_platform": effective_platform,
        "results": results,
    }


async def _fetch_profiles(
    db: AsyncSession,
    username: str,
    platform: Optional[str],
) -> list[InfluencerProfile]:
    """
    Fetch profiles matching the username.
    Tries: exact → case-insensitive exact → ilike prefix.
    """
    from sqlalchemy import func as sqlfunc

    conditions = []

    if platform:
        # Exact platform + username
        exact_q = select(InfluencerProfile).where(
            and_(
                sqlfunc.lower(InfluencerProfile.username) == username.lower(),
                InfluencerProfile.platform == platform,
            )
        ).limit(MAX_RESULTS)
    else:
        # Username across all platforms
        exact_q = select(InfluencerProfile).where(
            sqlfunc.lower(InfluencerProfile.username) == username.lower()
        ).limit(MAX_RESULTS)

    res = await db.execute(exact_q)
    profiles = list(res.scalars().all())
    if profiles:
        return profiles

    # Fallback: partial match (startswith)
    if platform:
        like_q = select(InfluencerProfile).where(
            and_(
                sqlfunc.lower(InfluencerProfile.username).like(f"{username.lower()}%"),
                InfluencerProfile.platform == platform,
            )
        ).limit(MAX_RESULTS)
    else:
        like_q = select(InfluencerProfile).where(
            sqlfunc.lower(InfluencerProfile.username).like(f"{username.lower()}%")
        ).limit(MAX_RESULTS)

    res2 = await db.execute(like_q)
    profiles = list(res2.scalars().all())
    if profiles:
        return profiles

    # Fallback: display_name partial match
    name_q = select(InfluencerProfile).where(
        sqlfunc.lower(InfluencerProfile.display_name).like(f"%{username.lower()}%")
    ).limit(MAX_RESULTS)
    res3 = await db.execute(name_q)
    return list(res3.scalars().all())


async def _enrich(
    db: AsyncSession,
    profile: InfluencerProfile,
) -> dict[str, Any]:
    """Fetch snapshot stats + twin status and build the result dict."""

    # ── Snapshot aggregates ────────────────────────────────────────────────────
    snap_agg = await db.execute(
        select(
            func.count(InfluencerSnapshot.id).label("cnt"),
            func.min(InfluencerSnapshot.captured_at).label("first_at"),
            func.max(InfluencerSnapshot.captured_at).label("last_at"),
        ).where(InfluencerSnapshot.influencer_id == profile.id)
    )
    row = snap_agg.one()
    snap_count   = row.cnt or 0
    first_snap   = row.first_at
    last_snap    = row.last_at

    # Latest snapshot for followers/ER
    latest_snap_res = await db.execute(
        select(InfluencerSnapshot)
        .where(InfluencerSnapshot.influencer_id == profile.id)
        .order_by(InfluencerSnapshot.captured_at.desc())
        .limit(1)
    )
    latest_snap = latest_snap_res.scalar_one_or_none()

    followers       = latest_snap.followers if latest_snap else 0
    engagement_rate = latest_snap.engagement_rate if latest_snap else 0.0

    # History days
    history_days = 0
    if first_snap and last_snap:
        fs = first_snap.replace(tzinfo=timezone.utc) if first_snap.tzinfo is None else first_snap
        ls = last_snap.replace(tzinfo=timezone.utc)  if last_snap.tzinfo  is None else last_snap
        history_days = (ls - fs).days

    # ── Digital Twin status ───────────────────────────────────────────────────
    twin_res = await db.execute(
        select(InfluencerDigitalTwin)
        .where(
            InfluencerDigitalTwin.influencer_profile_id == profile.id,
            InfluencerDigitalTwin.is_latest == True,
        )
    )
    twin = twin_res.scalar_one_or_none()

    # ── Avatar status ──────────────────────────────────────────────────────────
    has_avatar = bool(
        profile.profile_image_url
        and profile.profile_image_url.startswith("http")
    )
    avatar_status = "existing" if has_avatar else "fallback"
    avatar_source = "profile" if has_avatar else "initials"

    # ── Data sufficiency ──────────────────────────────────────────────────────
    is_sufficient = (
        snap_count >= MIN_SNAPSHOTS_FOR_FORECAST
        and history_days >= MIN_DAYS_COVERAGE
    )
    sufficiency_reason: Optional[str] = None
    missing: list[str] = []
    if not is_sufficient:
        if snap_count < MIN_SNAPSHOTS_FOR_FORECAST:
            rem = MIN_SNAPSHOTS_FOR_FORECAST - snap_count
            sufficiency_reason = (
                f"Sadece {snap_count} snapshot mevcut "
                f"(en az {MIN_SNAPSHOTS_FOR_FORECAST} gerekli)."
            )
            missing.append(f"{rem} daha fazla snapshot gerekli")
        if history_days < MIN_DAYS_COVERAGE:
            rem = MIN_DAYS_COVERAGE - history_days
            if not sufficiency_reason:
                sufficiency_reason = (
                    f"Snapshot geçmişi {history_days} gün kapsıyor "
                    f"(en az {MIN_DAYS_COVERAGE} gün gerekli)."
                )
            missing.append(f"{rem} gün daha gerekli")

    # estimated_ready_at: first_snapshot_at + MIN_DAYS_COVERAGE
    estimated_ready_at: Optional[str] = None
    if first_snap is not None:
        first_dt = (
            first_snap.replace(tzinfo=timezone.utc)
            if first_snap.tzinfo is None else first_snap
        )
        estimated_ready_at = (first_dt + timedelta(days=MIN_DAYS_COVERAGE)).isoformat()

    return {
        "profile_id":        profile.id,
        "username":          profile.username,
        "display_name":      profile.display_name or profile.username,
        "platform":          profile.platform,
        "profile_image_url": profile.profile_image_url or "",
        "avatar_status":     avatar_status,
        "avatar_source":     avatar_source,
        "category":          profile.category or "",
        "country":           profile.country or "",

        # Latest metrics
        "followers":       followers,
        "engagement_rate": engagement_rate,

        # Snapshot history
        "snapshot_count":  snap_count,
        "first_snapshot_at": first_snap.isoformat() if first_snap else None,
        "last_snapshot_at":  last_snap.isoformat()  if last_snap  else None,
        "history_days":    history_days,

        # Digital Twin status
        "has_digital_twin":  twin is not None,
        "latest_twin_id":    twin.id if twin else None,
        "twin_confidence":   twin.confidence.value if (twin and twin.confidence) else None,
        "twin_generated_at": twin.generated_at.isoformat() if twin else None,
        "twin_is_mock":      twin.is_mock if twin else None,

        # Data sufficiency
        "data_sufficiency": {
            "is_sufficient":      is_sufficient,
            "required_snapshots": MIN_SNAPSHOTS_FOR_FORECAST,
            "actual_snapshots":   snap_count,
            "required_days":      MIN_DAYS_COVERAGE,
            "actual_days":        history_days,
            "reason":             sufficiency_reason,
            "estimated_ready_at": estimated_ready_at,
            "missing":            missing,
        },
    }
