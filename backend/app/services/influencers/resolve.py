"""
Influencer Resolve Pipeline — Part 16

Resolves any username / @handle / URL into a ready InfluencerProfile + snapshot.
Enables archive-independent intelligence scanning (Risk Radar, etc.).

Flow:
  1. normalize_handle  → username + platform
  2. DB lookup         → existing InfluencerProfile
  3. found  → use existing profile (optionally refresh avatar)
  4. missing, mock     → create deterministic synthetic profile + snapshot
  5. missing, live     → try provider fetch → create real profile + snapshot
  6. Return ResolvedInfluencer
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot, SyncStatus
from app.services.influencers.identity import (
    normalize_handle,
    normalize_platform,
    PLATFORM_INSTAGRAM,
    PLATFORM_TIKTOK,
    PLATFORM_YOUTUBE,
)

logger = logging.getLogger(__name__)


# ─── Result ───────────────────────────────────────────────────────────────────

@dataclass
class ResolvedInfluencer:
    success: bool
    # found_archive | created_mock | created_from_provider |
    # needs_platform | not_found | provider_unavailable | provider_not_configured
    status: str

    profile_id:        Optional[int]  = None
    username:          Optional[str]  = None
    platform:          Optional[str]  = None
    display_name:      Optional[str]  = None
    profile_image_url: Optional[str]  = None
    avatar_status:     str            = "fallback"
    avatar_source:     str            = "initials"
    followers:         int            = 0
    snapshot_created:  bool           = False
    resolution_source: str            = "archive"   # archive | provider | mock
    provider:          Optional[str]  = None
    warnings:          list[str]      = field(default_factory=list)
    limitations:       list[str]      = field(default_factory=list)
    next_action:       Optional[str]  = None
    failure_code:      Optional[str]  = None
    failure_message:   Optional[str]  = None


# ─── Entry point ──────────────────────────────────────────────────────────────

async def resolve_influencer_for_intelligence(
    db: AsyncSession,
    query: str,
    platform: Optional[str] = None,
    *,
    create_if_missing: bool = True,
    force_refresh: bool = False,
    purpose: str = "risk_radar",
) -> ResolvedInfluencer:
    """
    Resolves any username/URL/handle into an InfluencerProfile ready for
    intelligence analysis. Creates a profile if not found in the archive.
    """
    is_mock = getattr(settings, "AGENTS_MODE", "mock").lower() == "mock"

    # 1. Normalize
    username, detected_platform = normalize_handle(query.strip())
    effective_platform = normalize_platform(platform) or detected_platform

    if not username:
        return ResolvedInfluencer(
            success=False, status="not_found",
            failure_code="invalid_query",
            failure_message="Geçerli bir kullanıcı adı, @handle veya profil URL'si girin.",
        )

    # 2. DB lookup
    profile = await _find_in_db(db, username, effective_platform)

    if profile:
        # Avatar refresh if missing
        if not (profile.profile_image_url or "").startswith("http"):
            await _try_resolve_avatar(db, profile, is_mock)

        has_avatar = bool(
            profile.profile_image_url and profile.profile_image_url.startswith("http")
        )

        # Optional fresh snapshot on force_refresh
        new_snap_created = False
        if force_refresh:
            new_snap_created = await _append_snapshot(db, profile, is_mock)

        followers = await _latest_followers(db, profile.id)

        return ResolvedInfluencer(
            success=True,
            status="found_archive",
            profile_id=profile.id,
            username=profile.username,
            platform=profile.platform,
            display_name=profile.display_name or profile.username,
            profile_image_url=profile.profile_image_url,
            avatar_status="existing" if has_avatar else "fallback",
            avatar_source="profile" if has_avatar else "initials",
            followers=followers,
            snapshot_created=new_snap_created,
            resolution_source="archive",
            limitations=(
                ["Profil archive'dan alındı. Geçmiş veri sınırlı olabilir."]
                if not force_refresh else []
            ),
        )

    # 3. Not in archive
    if not create_if_missing:
        return ResolvedInfluencer(
            success=False, status="not_found",
            failure_code="profile_not_found",
            failure_message=f"'{username}' archive'da bulunamadı.",
        )

    if is_mock:
        # Mock mode: ALWAYS produce a profile — never fail with provider error.
        return await _create_mock_profile(db, username, effective_platform)

    # Real mode: try provider first, then fall back gracefully
    result = await _create_from_provider(db, username, effective_platform, purpose)

    # If provider failed but not "not found" — try any archive match as fallback
    if not result.success and result.failure_code not in ("profile_not_found", "invalid_query"):
        archive_fallback = await _archive_fallback(db, username, result)
        if archive_fallback:
            return archive_fallback

    return result


# ─── Archive fallback ────────────────────────────────────────────────────────

async def _archive_fallback(
    db: AsyncSession,
    username: str,
    original_failure: ResolvedInfluencer,
) -> Optional[ResolvedInfluencer]:
    """
    When real-mode provider fails, look for ANY profile matching username
    in the DB (ignoring platform). If found, return a stale/archive report
    instead of a total failure.
    """
    from sqlalchemy import func as sqlfunc

    res = await db.execute(
        select(InfluencerProfile).where(
            sqlfunc.lower(InfluencerProfile.username) == username.lower(),
        ).limit(1)
    )
    profile = res.scalar_one_or_none()
    if profile is None:
        return None

    has_avatar = bool(
        profile.profile_image_url and profile.profile_image_url.startswith("http")
    )
    followers = await _latest_followers(db, profile.id)

    return ResolvedInfluencer(
        success=True,
        status="archive_fallback",
        profile_id=profile.id,
        username=profile.username,
        platform=profile.platform,
        display_name=profile.display_name or profile.username,
        profile_image_url=profile.profile_image_url,
        avatar_status="existing" if has_avatar else "fallback",
        avatar_source="profile" if has_avatar else "initials",
        followers=followers,
        snapshot_created=False,
        resolution_source="archive",
        warnings=[
            f"Canlı veri sağlayıcısı yanıt vermedi: {original_failure.failure_message or 'provider_unavailable'}",
            "Archive'daki mevcut veriyle sınırlı rapor üretildi.",
        ],
        limitations=[
            "Archive verisi gerçek zamanlı değil — güncellik garantisi yok.",
            "Live provider yapılandırılana kadar sınırlı kanıt mevcut.",
            "Risk skoru son mevcut snapshot'a dayanmaktadır.",
        ],
    )


# ─── DB helpers ───────────────────────────────────────────────────────────────

async def _find_in_db(
    db: AsyncSession,
    username: str,
    platform: Optional[str],
) -> Optional[InfluencerProfile]:
    from sqlalchemy import func as sqlfunc

    if platform:
        res = await db.execute(
            select(InfluencerProfile).where(
                sqlfunc.lower(InfluencerProfile.username) == username.lower(),
                InfluencerProfile.platform == platform,
            ).limit(1)
        )
    else:
        res = await db.execute(
            select(InfluencerProfile).where(
                sqlfunc.lower(InfluencerProfile.username) == username.lower(),
            ).limit(1)
        )
    return res.scalar_one_or_none()


async def _latest_followers(db: AsyncSession, profile_id: int) -> int:
    from sqlalchemy import func as sqlfunc
    res = await db.execute(
        select(InfluencerSnapshot.followers)
        .where(InfluencerSnapshot.influencer_id == profile_id)
        .order_by(InfluencerSnapshot.captured_at.desc())
        .limit(1)
    )
    row = res.scalar_one_or_none()
    return row or 0


async def _append_snapshot(
    db: AsyncSession,
    profile: InfluencerProfile,
    is_mock: bool,
) -> bool:
    """Create a minimal snapshot to mark a refresh point. Returns True on success."""
    try:
        existing_followers = await _latest_followers(db, profile.id)
        snap = InfluencerSnapshot(
            influencer_id=profile.id,
            captured_at=datetime.now(timezone.utc),
            source_type="provider_refresh" if not is_mock else "mock_refresh",
            followers=existing_followers,
        )
        db.add(snap)
        await db.commit()
        return True
    except Exception as exc:
        logger.warning("Could not append snapshot for profile %d: %s", profile.id, exc)
        await db.rollback()
        return False


async def _try_resolve_avatar(
    db: AsyncSession,
    profile: InfluencerProfile,
    is_mock: bool,
) -> None:
    if is_mock:
        return
    try:
        from app.services.avatar_resolver import resolve_profile_image
        result = await resolve_profile_image(profile.platform, profile.username, settings)
        url = result.get("profile_image_url", "")
        if result.get("ok") and isinstance(url, str) and url.startswith("http"):
            profile.profile_image_url = url
            db.add(profile)
            await db.commit()
    except Exception:
        pass


# ─── Mock profile ─────────────────────────────────────────────────────────────

async def _create_mock_profile(
    db: AsyncSession,
    username: str,
    platform: Optional[str],
) -> ResolvedInfluencer:
    """Deterministic mock InfluencerProfile + snapshot (AGENTS_MODE=mock)."""
    seed = int(hashlib.sha256(
        f"mock:{username}:{platform or 'auto'}".encode()
    ).hexdigest()[:8], 16)

    effective_platform = platform or PLATFORM_INSTAGRAM
    followers    = 50_000 + (seed % 900_000)
    er           = round(2.0 + (seed % 60) / 10, 2)
    fraud_score  = 10  + (seed % 35)
    auth_score   = 100 - fraud_score
    momentum     = 40  + (seed % 40)
    brand_fit    = 55  + (seed % 35)

    try:
        profile = InfluencerProfile(
            username=username,
            platform=effective_platform,
            display_name=username.replace("_", " ").replace(".", " ").title(),
            sync_status=SyncStatus.SYNCED,
        )
        db.add(profile)
        await db.flush()

        snap = InfluencerSnapshot(
            influencer_id=profile.id,
            captured_at=datetime.now(timezone.utc),
            source_type="mock_resolve",
            followers=followers,
            engagement_rate=er,
            fraud_score=fraud_score,
            authenticity_score=auth_score,
            momentum_score=momentum,
            brand_fit_score=brand_fit,
            roi_potential_score=50 + (seed % 30),
            engagement_quality_score=50 + (seed % 40),
            reputation_risk_score=fraud_score,
            fraud_risk="Low" if fraud_score < 30 else ("Medium" if fraud_score < 60 else "High"),
        )
        db.add(snap)
        await db.commit()

        return ResolvedInfluencer(
            success=True,
            status="created_mock",
            profile_id=profile.id,
            username=username,
            platform=effective_platform,
            display_name=profile.display_name,
            profile_image_url=None,
            avatar_status="fallback",
            avatar_source="initials",
            followers=followers,
            snapshot_created=True,
            resolution_source="mock",
            warnings=[
                "[MOCK] Profil sentetik veriyle oluşturuldu. "
                "Gerçek analiz için AGENTS_MODE=live ve API anahtarları gereklidir."
            ],
            limitations=[
                "Bu profil mock modda deterministik olarak oluşturulmuştur.",
                "Gerçek follower/engagement verileri yoktur.",
                "Risk skorları kanıta değil, sentetik veriye dayanmaktadır.",
            ],
        )
    except Exception as exc:
        await db.rollback()
        logger.error("Mock profile creation failed for %s: %s", username, exc)
        return ResolvedInfluencer(
            success=False, status="not_found",
            failure_code="internal_error",
            failure_message="Profil oluşturulamadı. Lütfen tekrar deneyin.",
        )


# ─── Live provider profile ────────────────────────────────────────────────────

async def _create_from_provider(
    db: AsyncSession,
    username: str,
    platform: Optional[str],
    purpose: str,
) -> ResolvedInfluencer:
    """Fetch live profile from provider and create DB records."""
    if platform is None:
        return ResolvedInfluencer(
            success=False, status="needs_platform",
            failure_code="needs_platform",
            failure_message=(
                "Platform belirlenemedi. Lütfen platform seçin "
                "(Instagram / TikTok / YouTube) veya profil URL'si girin."
            ),
            next_action="select_platform",
        )

    provider_name = _provider_for_platform(platform)
    if provider_name is None:
        return ResolvedInfluencer(
            success=False, status="not_found",
            failure_code="unsupported_platform",
            failure_message=f"'{platform}' platformu henüz desteklenmiyor.",
        )

    try:
        from app.services.data_provider import get_profile as _gp
        profile_data = await _gp(username, platform)
    except NotImplementedError:
        return _not_configured(username, platform, provider_name)
    except Exception as exc:
        msg = str(exc).lower()
        if any(k in msg for k in ("key", "configured", "token", "apify", "api")):
            return _not_configured(username, platform, provider_name)
        if any(k in msg for k in ("not found", "404", "no user", "private")):
            return ResolvedInfluencer(
                success=False, status="not_found",
                failure_code="profile_not_found",
                failure_message=(
                    f"'{username}' ({platform}) profili bulunamadı veya gizli hesap."
                ),
            )
        logger.warning("Provider fetch failed for %s/%s: %s", platform, username, exc)
        return ResolvedInfluencer(
            success=False, status="provider_unavailable",
            failure_code="provider_unavailable",
            failure_message=(
                f"{_provider_label(provider_name)} yanıt vermedi. "
                "Lütfen birkaç dakika sonra tekrar deneyin."
            ),
            next_action="retry",
        )

    if not profile_data:
        return ResolvedInfluencer(
            success=False, status="not_found",
            failure_code="profile_not_found",
            failure_message=f"'{username}' profili bulunamadı.",
        )

    try:
        uname      = str(profile_data.get("username") or username)
        disp       = str(profile_data.get("display_name") or profile_data.get("full_name") or uname)
        followers  = int(profile_data.get("followers") or profile_data.get("follower_count") or 0)
        er         = float(profile_data.get("engagement_rate") or 0.0)
        avatar_url = str(profile_data.get("profile_image_url") or profile_data.get("avatar") or "")
        if not avatar_url.startswith("http"):
            avatar_url = ""

        profile = InfluencerProfile(
            username=uname,
            platform=platform,
            display_name=disp,
            profile_image_url=avatar_url or None,
            sync_status=SyncStatus.SYNCED,
        )
        db.add(profile)
        await db.flush()

        fraud_raw = int(profile_data.get("fraud_score") or 0)
        snap = InfluencerSnapshot(
            influencer_id=profile.id,
            captured_at=datetime.now(timezone.utc),
            source_type="provider_resolve",
            followers=followers,
            engagement_rate=er,
            fraud_score=fraud_raw,
            authenticity_score=int(profile_data.get("authenticity_score") or (100 - fraud_raw)),
            brand_fit_score=int(profile_data.get("brand_fit_score") or 0),
            avg_likes=int(profile_data.get("avg_likes") or 0),
            avg_comments=int(profile_data.get("avg_comments") or 0),
            avg_views=int(profile_data.get("avg_views") or 0),
            fraud_risk=(
                "Low" if fraud_raw < 30 else ("Medium" if fraud_raw < 60 else "High")
            ),
        )
        db.add(snap)
        await db.commit()

        has_avatar = bool(avatar_url)
        return ResolvedInfluencer(
            success=True,
            status="created_from_provider",
            profile_id=profile.id,
            username=profile.username,
            platform=profile.platform,
            display_name=profile.display_name,
            profile_image_url=avatar_url or None,
            avatar_status="resolved" if has_avatar else "fallback",
            avatar_source="provider" if has_avatar else "initials",
            followers=followers,
            snapshot_created=True,
            resolution_source="provider",
            provider=provider_name,
            warnings=[
                "Profil canlı veriden oluşturuldu. Archive geçmişi henüz yok."
            ],
            limitations=[
                "Yalnızca 1 snapshot — historical trend ve anomaly baseline mevcut değil.",
                "Risk skoru sınırlı kanıta dayanmaktadır (limited mode).",
                "Zaman içinde ek snapshot'lar oluştuğunda doğruluk artar.",
            ],
        )

    except Exception as exc:
        await db.rollback()
        logger.error("Profile creation from provider failed %s/%s: %s", platform, username, exc)
        return ResolvedInfluencer(
            success=False, status="provider_unavailable",
            failure_code="internal_error",
            failure_message="Profil kaydedilemedi. Lütfen tekrar deneyin.",
        )


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _provider_for_platform(platform: Optional[str]) -> Optional[str]:
    return {
        PLATFORM_INSTAGRAM: "apify_instagram",
        PLATFORM_TIKTOK:    "apify_tiktok",
        PLATFORM_YOUTUBE:   "youtube_data_api",
    }.get(platform or "")


def _provider_label(provider: str) -> str:
    return {
        "apify_instagram":  "Instagram sağlayıcısı (Apify)",
        "apify_tiktok":     "TikTok sağlayıcısı (Apify)",
        "youtube_data_api": "YouTube Data API",
    }.get(provider, provider)


def _not_configured(
    username: str,
    platform: str,
    provider: str,
) -> ResolvedInfluencer:
    return ResolvedInfluencer(
        success=False, status="provider_unavailable",
        failure_code="provider_not_configured",
        failure_message=(
            f"{_provider_label(provider)} yapılandırılmamış. "
            "API anahtarlarını .env dosyasına ekleyin veya AGENTS_MODE=mock kullanın."
        ),
        next_action="configure_provider",
    )
