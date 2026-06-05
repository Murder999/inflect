"""
Archive Sync Service — Provider'dan gerçek veri çeker, archive'ı günceller.

Kurallar:
- Fake metrik üretilmez.
- Provider veri döndürmezse hata kaydedilir, 0 yazılmaz.
- Tüm provider çağrıları asyncio.to_thread() ile thread pool'da çalışır.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.influencer_archive import (
    InfluencerProfile, InfluencerSnapshot, SyncStatus,
)

logger = logging.getLogger(__name__)


# ─── Provider fetch (thread pool) ────────────────────────────────────────────

async def _fetch(username: str, platform: str, cfg: dict) -> dict:
    """Provider çağrısını thread pool'da çalıştır (senkron → async)."""
    from app.services.data_provider import get_profile
    return await asyncio.to_thread(get_profile, username, platform, cfg)


# ─── Profile update helper ───────────────────────────────────────────────────

def _apply_provider_to_profile(profile: InfluencerProfile, data: dict) -> None:
    """Provider'dan gelen veriyi profile metadata'ya uygula."""
    if data.get("display_name"):
        profile.display_name = data["display_name"]
    if data.get("bio"):
        profile.bio = (data["bio"] or "")[:1000]
    avatar = data.get("profile_image_url") or data.get("avatar")
    if avatar:
        profile.profile_image_url = avatar
    cat = data.get("category")
    if cat and cat not in ("", "N/A", "TikTok Creator", "Instagram Creator"):
        profile.category = cat
    country = data.get("country")
    if country and country != "Bilinmiyor":
        profile.country = country
    city = data.get("city")
    if city and city != "Bilinmiyor":
        profile.city = city


# ─── Get latest snapshot ─────────────────────────────────────────────────────

async def _latest_snap(db: AsyncSession, profile_id: int) -> Optional[InfluencerSnapshot]:
    q = (
        select(InfluencerSnapshot)
        .where(InfluencerSnapshot.influencer_id == profile_id)
        .order_by(InfluencerSnapshot.captured_at.desc())
        .limit(1)
    )
    return (await db.execute(q)).scalar_one_or_none()


# ─── Sync: metadata + metrics, skor güncellenmez ─────────────────────────────

async def sync_profile_by_id(
    db: AsyncSession,
    profile_id: int,
    cfg: Optional[dict] = None,
) -> dict:
    """
    Tek profil sync: provider'dan avatar/bio/followers günceller,
    yeni InfluencerSnapshot oluşturur (önceki skorları korur).
    Score_engine çalıştırmaz.
    """
    cfg = cfg or {}

    result = await db.execute(
        select(InfluencerProfile).where(InfluencerProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return {"success": False, "error": "Profil bulunamadı.", "profile_id": profile_id}

    profile.sync_status = SyncStatus.PENDING
    await db.flush()

    try:
        data = await _fetch(profile.username, profile.platform, cfg)
    except HTTPException as e:
        profile.sync_status = SyncStatus.ERROR
        profile.updated_at  = datetime.now(timezone.utc)
        logger.warning(
            "Sync başarısız: profile=%d (%s/%s) — %s",
            profile_id, profile.platform, profile.username, e.detail,
        )
        return {
            "success":    False,
            "profile_id": profile_id,
            "username":   profile.username,
            "platform":   profile.platform,
            "error":      str(e.detail),
            "error_code": e.status_code,
        }
    except Exception as e:
        profile.sync_status = SyncStatus.ERROR
        profile.updated_at  = datetime.now(timezone.utc)
        logger.error("Sync beklenmedik hata: profile=%d — %s", profile_id, e, exc_info=True)
        return {
            "success":    False,
            "profile_id": profile_id,
            "username":   profile.username,
            "platform":   profile.platform,
            "error":      str(e)[:300],
        }

    # Metadata güncelle
    _apply_provider_to_profile(profile, data)
    profile.sync_status    = SyncStatus.SYNCED
    profile.last_synced_at = datetime.now(timezone.utc)
    profile.updated_at     = datetime.now(timezone.utc)

    # Önceki snapshot'ın skorlarını koru
    prev = await _latest_snap(db, profile_id)

    followers      = int(data.get("followers", 0) or 0)
    following      = int(data.get("following", 0) or 0)
    avg_views      = int(data.get("avg_views", 0) or 0)
    avg_likes      = int(data.get("avg_likes", 0) or 0)
    avg_comments   = int(data.get("avg_comments", 0) or 0)
    engagement_rate = float(data.get("engagement_rate", 0) or 0)

    snap = InfluencerSnapshot(
        influencer_id=profile_id,
        captured_at=datetime.now(timezone.utc),
        source_analysis_id=None,
        source_type="provider_sync",
        followers=followers,
        following=following,
        avg_views=avg_views,
        avg_likes=avg_likes,
        avg_comments=avg_comments,
        engagement_rate=engagement_rate,
        # Önceki skorları koru — sadece metrikler güncellendi
        final_score=              prev.final_score              if prev else 0,
        fraud_score=              prev.fraud_score              if prev else 0,
        authenticity_score=       prev.authenticity_score       if prev else 0,
        momentum_score=           prev.momentum_score           if prev else 0,
        brand_fit_score=          prev.brand_fit_score          if prev else 0,
        roi_potential_score=      prev.roi_potential_score      if prev else 0,
        engagement_quality_score= prev.engagement_quality_score if prev else 0,
        reputation_risk_score=    prev.reputation_risk_score    if prev else 0,
        fraud_risk= prev.fraud_risk if prev else "Low",
        decision=   prev.decision   if prev else "",
    )
    db.add(snap)
    await db.flush()

    return {
        "success":         True,
        "profile_id":      profile_id,
        "username":        profile.username,
        "platform":        profile.platform,
        "followers":       followers,
        "engagement_rate": round(engagement_rate, 2),
        "avg_views":       avg_views,
        "source":          data.get("source", "unknown"),
        "snapshot_id":     snap.id,
    }


# ─── Analyze: tam provider fetch + score_engine ──────────────────────────────

async def analyze_profile_by_id(
    db: AsyncSession,
    profile_id: int,
    brand: str = "Genel Marka",
    cfg: Optional[dict] = None,
) -> dict:
    """
    Tam analiz: provider'dan güncel veri çek + score_engine çalıştır.
    Hem metrikler hem skorlar içeren yeni bir InfluencerSnapshot oluşturur.
    """
    cfg = cfg or {}

    result = await db.execute(
        select(InfluencerProfile).where(InfluencerProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return {"success": False, "error": "Profil bulunamadı.", "profile_id": profile_id}

    profile.sync_status = SyncStatus.PENDING
    await db.flush()

    try:
        data = await _fetch(profile.username, profile.platform, cfg)
    except HTTPException as e:
        profile.sync_status = SyncStatus.ERROR
        profile.updated_at  = datetime.now(timezone.utc)
        return {
            "success":    False,
            "profile_id": profile_id,
            "username":   profile.username,
            "platform":   profile.platform,
            "error":      str(e.detail),
            "error_code": e.status_code,
        }
    except Exception as e:
        profile.sync_status = SyncStatus.ERROR
        profile.updated_at  = datetime.now(timezone.utc)
        return {
            "success":    False,
            "profile_id": profile_id,
            "username":   profile.username,
            "platform":   profile.platform,
            "error":      str(e)[:300],
        }

    # Score engine — provider verisini skora çevir
    from app.services.score_engine import score_profile
    scores = score_profile(data, brand)

    # Metadata güncelle
    _apply_provider_to_profile(profile, data)
    profile.sync_status    = SyncStatus.SYNCED
    profile.last_synced_at = datetime.now(timezone.utc)
    profile.updated_at     = datetime.now(timezone.utc)

    snap = InfluencerSnapshot(
        influencer_id=profile_id,
        captured_at=datetime.now(timezone.utc),
        source_analysis_id=None,
        source_type="provider_analyze",
        followers=      int(data.get("followers", 0) or 0),
        following=      int(data.get("following", 0) or 0),
        avg_views=      int(data.get("avg_views", 0) or 0),
        avg_likes=      int(data.get("avg_likes", 0) or 0),
        avg_comments=   int(data.get("avg_comments", 0) or 0),
        engagement_rate=float(data.get("engagement_rate", 0) or 0),
        # Gerçek skorlar
        final_score=              scores["final_score"],
        fraud_score=              scores["fraud_score"],
        authenticity_score=       scores["authenticity"],
        momentum_score=           scores["momentum"],
        brand_fit_score=          scores["brand_fit"],
        roi_potential_score=      scores["roi_potential"],
        engagement_quality_score= scores["engagement_quality"],
        reputation_risk_score=    scores["reputation_risk"],
        fraud_risk= scores["fraud_risk"],
        decision=   scores["decision"],
    )
    db.add(snap)
    await db.flush()

    return {
        "success":         True,
        "profile_id":      profile_id,
        "username":        profile.username,
        "platform":        profile.platform,
        "followers":       snap.followers,
        "engagement_rate": round(snap.engagement_rate, 2),
        "avg_views":       snap.avg_views,
        "final_score":     snap.final_score,
        "fraud_score":     snap.fraud_score,
        "decision":        snap.decision,
        "brand":           brand,
        "source":          data.get("source", "unknown"),
        "snapshot_id":     snap.id,
    }
