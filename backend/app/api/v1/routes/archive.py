"""
Archive Routes — Influencer Archive API.
GET  /archive              — list profiles
GET  /archive/{id}         — profil detayı + snapshot geçmişi
POST /archive/seed         — admin: analizlerden archive doldur
POST /archive/import-json  — admin: JSON dosyasından toplu import
POST /archive/sync         — admin: tüm pending/needs_sync profilleri sync et (toplu)
POST /archive/sync/{id}    — admin: tek profil sync (provider'dan metrik güncelle)
POST /archive/analyze/{id} — admin: tek profil tam analiz (provider + score_engine)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin
from app.models.user import User
from app.models.analysis import Analysis
from app.models.influencer_archive import (
    InfluencerProfile, InfluencerSnapshot, SyncStatus, InfluencerImportLog,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/archive", tags=["archive"])


# ─── Serializers ─────────────────────────────────────────────────────────────

def _profile_dict(p: InfluencerProfile, snap: Optional[InfluencerSnapshot] = None) -> dict:
    base = {
        "id":                p.id,
        "username":          p.username,
        "platform":          p.platform,
        "display_name":      p.display_name or p.username,
        "category":          p.category or "",
        "country":           p.country or "",
        "city":              p.city or "",
        "bio":               (p.bio or "")[:300],
        "profile_image_url": p.profile_image_url or "",
        "avatar":            p.profile_image_url or "",
        "sync_status":       p.sync_status.value if hasattr(p.sync_status, "value") else str(p.sync_status),
        "last_synced_at":    p.last_synced_at.isoformat() if p.last_synced_at else None,
        "created_at":        p.created_at.isoformat() if p.created_at else "",
        "updated_at":        p.updated_at.isoformat() if p.updated_at else "",
        "has_snapshot":      snap is not None,
    }
    if snap:
        base.update({
            "followers":               snap.followers,
            "following":               snap.following,
            "avg_views":               snap.avg_views,
            "avg_likes":               snap.avg_likes,
            "avg_comments":            snap.avg_comments,
            "engagement_rate":         snap.engagement_rate,
            "final_score":             snap.final_score,
            "fraud_score":             snap.fraud_score,
            "authenticity_score":      snap.authenticity_score,
            "momentum_score":          snap.momentum_score,
            "brand_fit_score":         snap.brand_fit_score,
            "roi_potential_score":     snap.roi_potential_score,
            "engagement_quality_score": snap.engagement_quality_score,
            "reputation_risk_score":   snap.reputation_risk_score,
            "fraud_risk":              snap.fraud_risk,
            "decision":                snap.decision,
            "captured_at":             snap.captured_at.isoformat() if snap.captured_at else "",
        })
    else:
        # Snapshot yok — metrik alanlar yok, sıfır değil NULL gibi davranır
        for field in ("followers", "engagement_rate", "final_score", "fraud_score"):
            base[field] = None
    return base


# ─── GET /archive ─────────────────────────────────────────────────────────────

@router.get("")
async def list_archive(
    platform: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search:   Optional[str] = Query(None),
    limit:    int = Query(50, ge=1, le=200),
    offset:   int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Archive listesi. Her profil için en son snapshot'ı birleştirir.
    Metrik gerektiren filtreler yalnızca snapshot'ı olan profillere uygulanır.
    """
    q = select(InfluencerProfile).order_by(desc(InfluencerProfile.updated_at))

    if platform and platform != "all":
        q = q.where(InfluencerProfile.platform == platform)
    if category:
        q = q.where(InfluencerProfile.category.ilike(f"%{category}%"))
    if search:
        q = q.where(
            (InfluencerProfile.username.ilike(f"%{search}%")) |
            (InfluencerProfile.display_name.ilike(f"%{search}%"))
        )

    total_q = select(func.count(InfluencerProfile.id))
    if platform and platform != "all":
        total_q = total_q.where(InfluencerProfile.platform == platform)
    if category:
        total_q = total_q.where(InfluencerProfile.category.ilike(f"%{category}%"))
    if search:
        total_q = total_q.where(
            (InfluencerProfile.username.ilike(f"%{search}%")) |
            (InfluencerProfile.display_name.ilike(f"%{search}%"))
        )
    total = (await db.execute(total_q)).scalar() or 0

    profiles = (await db.execute(q.limit(limit).offset(offset))).scalars().all()

    # Her profil için en son snapshot'ı al
    results = []
    for p in profiles:
        snap_q = (
            select(InfluencerSnapshot)
            .where(InfluencerSnapshot.influencer_id == p.id)
            .order_by(desc(InfluencerSnapshot.captured_at))
            .limit(1)
        )
        snap = (await db.execute(snap_q)).scalar_one_or_none()
        results.append(_profile_dict(p, snap))

    return {"items": results, "total": total, "limit": limit, "offset": offset}


# ─── GET /archive/seed (sabit path önce) ─────────────────────────────────────

@router.post("/seed")
async def seed_archive(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Mevcut analiz kayıtlarından archive doldurur.
    Admin-only. Fake veri üretilmez — yalnızca gerçek Analysis kayıtları kullanılır.
    """
    # Tüm analizleri yükle
    analyses_q = await db.execute(
        select(Analysis).order_by(Analysis.created_at.asc())
    )
    analyses = analyses_q.scalars().all()

    created_profiles = 0
    created_snapshots = 0
    skipped = 0

    for analysis in analyses:
        pd = analysis.profile_data or {}
        platform = (
            analysis.platform.value
            if hasattr(analysis.platform, "value")
            else str(analysis.platform)
        )
        username = analysis.username

        # InfluencerProfile var mı?
        existing_q = await db.execute(
            select(InfluencerProfile).where(
                InfluencerProfile.username == username,
                InfluencerProfile.platform == platform,
            )
        )
        profile = existing_q.scalar_one_or_none()

        if not profile:
            profile = InfluencerProfile(
                username=username,
                platform=platform,
                display_name=pd.get("display_name") or username,
                category=pd.get("category") or None,
                country=pd.get("country") or None,
                city=pd.get("city") or None,
                bio=(pd.get("bio") or "")[:1000] or None,
                profile_image_url=(
                    pd.get("profile_image_url") or pd.get("avatar") or None
                ),
                sync_status=SyncStatus.SYNCED,
            )
            db.add(profile)
            await db.flush()   # ID almak için
            created_profiles += 1
        else:
            # Profil varsa görsel/meta güncelle
            if not profile.profile_image_url:
                profile.profile_image_url = pd.get("profile_image_url") or pd.get("avatar") or None
            if not profile.category and pd.get("category"):
                profile.category = pd.get("category")
            if not profile.display_name or profile.display_name == username:
                profile.display_name = pd.get("display_name") or username
            profile.updated_at = datetime.now(timezone.utc)

        # Bu analize ait snapshot zaten var mı?
        snap_exists_q = await db.execute(
            select(InfluencerSnapshot).where(
                InfluencerSnapshot.influencer_id == profile.id,
                InfluencerSnapshot.source_analysis_id == analysis.id,
            )
        )
        if snap_exists_q.scalar_one_or_none():
            skipped += 1
            continue

        # Snapshot oluştur — gerçek analiz verisi
        snap = InfluencerSnapshot(
            influencer_id=profile.id,
            captured_at=analysis.created_at or datetime.now(timezone.utc),
            source_analysis_id=analysis.id,
            # Metrikler
            followers=analysis.followers or 0,
            following=int(pd.get("following", 0) or 0),
            avg_views=analysis.avg_views or 0,
            avg_likes=int(pd.get("avg_likes", 0) or 0),
            avg_comments=int(pd.get("avg_comments", 0) or 0),
            engagement_rate=float(analysis.engagement_rate or 0),
            # Skorlar
            final_score=analysis.final_score or 0,
            fraud_score=analysis.fraud_score or 0,
            authenticity_score=analysis.authenticity_score or 0,
            momentum_score=analysis.momentum_score or 0,
            brand_fit_score=analysis.brand_fit_score or 0,
            roi_potential_score=analysis.roi_potential_score or 0,
            engagement_quality_score=analysis.engagement_quality_score or 0,
            reputation_risk_score=analysis.reputation_risk_score or 0,
            fraud_risk=analysis.fraud_risk or "Low",
            decision=analysis.decision or "",
        )
        db.add(snap)
        created_snapshots += 1

    await db.flush()

    return {
        "success": True,
        "scanned_analyses": len(analyses),
        "created_profiles":  created_profiles,
        "created_snapshots": created_snapshots,
        "skipped_snapshots": skipped,
        "note": "Tüm veriler gerçek analizlerden alındı. Fake metrik üretilmedi.",
    }


# ─── POST /archive/import-json ───────────────────────────────────────────────

@router.post("/import-json")
async def import_json_file(
    file: UploadFile = File(..., description="filtered_influencers_combined.json gibi dosya"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    JSON dosyasından influencer toplu import.
    Beklenen yapı: { influencers: [...] }
    Her kayıtta: handle, name, platform, categories, followers, profile_image_url

    Dedup: username + platform unique key.
    - Varsa: display_name / category / image güncelle, sync_status=needs_sync
    - Yoksa: yeni InfluencerProfile oluştur
    Snapshot: followers null değilse oluşturulur; null ise atlanır.
    Admin-only.
    """
    raw = await file.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Geçersiz JSON: {exc}")

    influencers = data.get("influencers", [])
    if not isinstance(influencers, list):
        raise HTTPException(status_code=400, detail="JSON içinde 'influencers' dizisi bulunamadı.")

    created = updated = skipped = errors = 0

    for item in influencers:
        try:
            # ── Handle / username ──────────────────────────────────────────
            raw_handle = str(item.get("handle") or "").strip().lstrip("@")
            if not raw_handle:
                skipped += 1
                continue

            username = raw_handle

            # ── Platform normalize ────────────────────────────────────────
            raw_platform = str(item.get("platform") or "").strip().lower()
            if "youtube" in raw_platform:
                platform = "youtube"
            elif "tiktok" in raw_platform and "instagram" in raw_platform:
                # combined → instagram, orijinal bilgi categories/meta'da
                platform = "instagram"
            elif "tiktok" in raw_platform:
                platform = "tiktok"
            elif "instagram" in raw_platform:
                platform = "instagram"
            elif raw_platform:
                platform = raw_platform
            else:
                platform = "instagram"

            # ── Metadata ──────────────────────────────────────────────────
            display_name = str(item.get("name") or "").strip() or username
            categories   = item.get("categories") or []
            category     = str(categories[0]).strip() if categories else None
            img_url      = (item.get("profile_image_url") or item.get("avatar") or "").strip() or None

            # ── Dedup ─────────────────────────────────────────────────────
            existing = (await db.execute(
                select(InfluencerProfile).where(
                    InfluencerProfile.username == username,
                    InfluencerProfile.platform == platform,
                )
            )).scalar_one_or_none()

            if existing:
                existing.display_name = display_name
                if category:
                    existing.category = category
                if img_url:
                    existing.profile_image_url = img_url
                existing.sync_status = SyncStatus.NEEDS_SYNC
                existing.updated_at  = datetime.now(timezone.utc)
                profile = existing
                updated += 1
            else:
                profile = InfluencerProfile(
                    username=username,
                    platform=platform,
                    display_name=display_name,
                    category=category,
                    profile_image_url=img_url,
                    sync_status=SyncStatus.NEEDS_SYNC,
                )
                db.add(profile)
                await db.flush()   # ID almak için
                created += 1

            # ── Snapshot (followers null ise oluşturma) ───────────────────
            followers_raw = item.get("followers")
            if followers_raw is not None:
                try:
                    followers_int = int(float(followers_raw))
                    snap = InfluencerSnapshot(
                        influencer_id=profile.id,
                        source_type="json_import",
                        followers=followers_int,
                        # Diğer metrikler ve skorlar varsayılan 0 — fake değil, henüz bilinmiyor
                    )
                    db.add(snap)
                except (ValueError, TypeError):
                    pass  # sayıya çevrilemeyen followers atlanır

        except Exception as exc:
            logger.warning("JSON import hata — handle=%s: %s", item.get("handle", "?"), exc)
            errors += 1
            continue

    # ── Import log ────────────────────────────────────────────────────────────
    log = InfluencerImportLog(
        filename=file.filename or "upload.json",
        total_records=len(influencers),
        created_count=created,
        updated_count=updated,
        skipped_count=skipped,
        error_count=errors,
        created_by_user_id=admin.id,
    )
    db.add(log)
    await db.commit()

    return {
        "success": True,
        "filename": file.filename or "upload.json",
        "total":   len(influencers),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "errors":  errors,
    }


# ─── GET /archive/{id} ───────────────────────────────────────────────────────

@router.get("/{profile_id}")
async def get_archive_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Profil detayı + tüm snapshot geçmişi."""
    p_q = await db.execute(
        select(InfluencerProfile).where(InfluencerProfile.id == profile_id)
    )
    profile = p_q.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profil bulunamadı.")

    snaps_q = await db.execute(
        select(InfluencerSnapshot)
        .where(InfluencerSnapshot.influencer_id == profile_id)
        .order_by(desc(InfluencerSnapshot.captured_at))
        .limit(20)
    )
    snapshots = snaps_q.scalars().all()
    latest = snapshots[0] if snapshots else None

    return {
        **_profile_dict(profile, latest),
        "snapshot_count": len(snapshots),
        "snapshot_history": [
            {
                "id":             s.id,
                "captured_at":    s.captured_at.isoformat() if s.captured_at else "",
                "followers":      s.followers,
                "engagement_rate": s.engagement_rate,
                "final_score":    s.final_score,
                "fraud_score":    s.fraud_score,
                "decision":       s.decision,
                "source_type":    getattr(s, "source_type", "analysis"),
            }
            for s in snapshots
        ],
    }


# ─── POST /archive/sync ───────────────────────────────────────────────

@router.post("/sync")
async def sync_all_pending(
    limit: int = Query(5, ge=1, le=20,
                       description="Provider timeout nedeniyle max 10 önerilir"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Toplu sync: sync_status=pending/needs_sync olan profilleri önce dener.
    Bu profil yoksa en uzun süre güncellenmemiş profilleri alır.
    Admin-only. Her provider çağrısı gerçek API key gerektirir.
    """
    from app.services.archive_sync import sync_profile_by_id

    q = (
        select(InfluencerProfile)
        .where(InfluencerProfile.sync_status.in_(["pending", "needs_sync"]))
        .order_by(InfluencerProfile.updated_at.asc())
        .limit(limit)
    )
    profiles = (await db.execute(q)).scalars().all()

    # Bekleyen profil yoksa en eskiden güncellenmiş profilleri al
    if not profiles:
        q2 = (
            select(InfluencerProfile)
            .order_by(InfluencerProfile.updated_at.asc())
            .limit(limit)
        )
        profiles = (await db.execute(q2)).scalars().all()

    cfg: dict = {}
    results = []
    for p in profiles:
        r = await sync_profile_by_id(db, p.id, cfg)
        results.append(r)

    success = sum(1 for r in results if r.get("success"))
    return {
        "processed":  len(results),
        "success":    success,
        "failed":     len(results) - success,
        "results":    results,
        "note":       "Provider API key yoksa sync başarısız olur — env vars kontrol edin.",
    }


# ─── POST /archive/sync/{id} ────────────────────────────────────────────

@router.post("/sync/{profile_id}")
async def sync_one(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Tek profil sync: provider'dan avatar/bio/followers çeker.
    Score güncellenmez. Provider API key gerektirir.
    """
    from app.services.archive_sync import sync_profile_by_id
    return await sync_profile_by_id(db, profile_id, cfg={})


# ─── POST /archive/analyze/{id} ───────────────────────────────────────────

@router.post("/analyze/{profile_id}")
async def analyze_one(
    profile_id: int,
    brand: str = Query("Genel Marka", description="Marka adı (skor hesabında kullanılır)"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Tek profil tam analiz: provider verisi + score_engine.
    Yeni bir InfluencerSnapshot oluşturur (metrik + skor).
    Provider API key gerektirir.
    """
    from app.services.archive_sync import analyze_profile_by_id
    return await analyze_profile_by_id(db, profile_id, brand=brand, cfg={})
