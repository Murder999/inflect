"""
Digital Twin API Routes — Part 12
Influencer behavioral forecasting endpoints.
All endpoints require auth. Generate/refresh cost 1 credit.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin
from app.models.user import User
from app.models.influencer_archive import InfluencerProfile
from app.models.digital_twin import (
    InfluencerDigitalTwin, TwinForecast, TwinSignal,
    ConfidenceLevel, RiskTrend,
)
from app.services.digital_twin import twin_engine
from app.services.entitlement_service import require_feature

router = APIRouter(prefix="/digital-twin", tags=["Digital Twin"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _twin_to_dict(
    twin: InfluencerDigitalTwin,
    forecasts: list[TwinForecast],
) -> dict[str, Any]:
    return {
        "id": twin.id,
        "influencer_profile_id": twin.influencer_profile_id,
        "generated_at": twin.generated_at.isoformat(),
        "forecast_version": twin.forecast_version,
        "is_forecast_available": twin.is_forecast_available,
        "unavailability_reason": twin.unavailability_reason,
        "snapshot_count": twin.snapshot_count,
        "snapshot_days_coverage": twin.snapshot_days_coverage,
        "oldest_snapshot_at": twin.oldest_snapshot_at.isoformat() if twin.oldest_snapshot_at else None,
        "newest_snapshot_at": twin.newest_snapshot_at.isoformat() if twin.newest_snapshot_at else None,
        "confidence": twin.confidence.value if twin.confidence else "insufficient",
        "evidence_strength": twin.evidence_strength,
        "is_mock": twin.is_mock,
        "forecasts": [_forecast_to_dict(f) for f in forecasts],
    }


def _forecast_to_dict(f: TwinForecast) -> dict[str, Any]:
    return {
        "id": f.id,
        "horizon_days": f.horizon_days,
        "followers_current": f.followers_current,
        "followers_projected": f.followers_projected,
        "followers_projection_pct": f.followers_projection_pct,
        "followers_range_low_pct": f.followers_range_low_pct,
        "followers_range_high_pct": f.followers_range_high_pct,
        "engagement_current": f.engagement_current,
        "engagement_projected": f.engagement_projected,
        "engagement_projection_pct": f.engagement_projection_pct,
        "engagement_decay_risk": f.engagement_decay_risk,
        "risk_trend": f.risk_trend.value if f.risk_trend else "stable",
        "stability_trend": f.stability_trend.value if f.stability_trend else "stable",
        "campaign_readiness": f.campaign_readiness.value if f.campaign_readiness else "conditional",
        "campaign_recommendation": f.campaign_recommendation,
        "confidence": f.confidence.value if f.confidence else "insufficient",
        "limitations": f.limitations or [],
        "evidence": f.evidence_json or {},
        "raw_signals": f.raw_signals_json or {},
    }


async def _check_profile_exists(db: AsyncSession, profile_id: int) -> InfluencerProfile:
    res = await db.execute(
        select(InfluencerProfile).where(InfluencerProfile.id == profile_id)
    )
    profile = res.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail=f"Influencer profili bulunamadı: {profile_id}")
    return profile


# ─── Generate ─────────────────────────────────────────────────────────────────

@router.post("/generate/{profile_id}", summary="Influencer için Digital Twin oluştur")
async def generate_twin(
    profile_id: int,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
    _ent: User         = Depends(require_feature("digital_twin_forecast")),
) -> dict[str, Any]:
    """
    Generate a new Digital Twin for the given influencer profile.
    Costs 1 credit. Replaces previous twin if one exists.
    """
    # Credit check
    if user.credits_remaining < 1:
        raise HTTPException(
            status_code=402,
            detail="Yeterli krediniz yok. Digital Twin oluşturmak için 1 kredi gerekir.",
        )

    await _check_profile_exists(db, profile_id)

    is_mock = not user.is_admin
    try:
        result = await twin_engine.generate(db=db, profile_id=profile_id, is_mock=is_mock)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Twin generation hatası: {exc}")

    # Deduct credit only when a real forecast was produced
    if result.is_forecast_available:
        user.credits_remaining -= 1
        db.add(user)
        await db.commit()

    # Publish event
    try:
        from app.services.event_bus import publish as publish_event
        await publish_event(
            session=db,
            event_type="digital_twin.generated",
            payload={"profile_id": profile_id, "confidence": result.confidence},
            source=f"user:{user.id}",
        )
    except Exception:
        pass

    # Return the persisted twin
    twin = await twin_engine.get_latest(db, profile_id)
    if twin:
        forecasts = await twin_engine.get_forecasts_for_twin(db, twin.id)
        return {
            "success": True,
            "twin": _twin_to_dict(twin, forecasts),
            "signals_extracted": len(result.signals),
            "note": result.note,
        }

    return {
        "success": True,
        "twin": None,
        "is_forecast_available": result.is_forecast_available,
        "unavailability_reason": result.unavailability_reason,
        "snapshot_count": result.snapshot_count,
        "note": result.note,
    }


# ─── Get ──────────────────────────────────────────────────────────────────────

@router.get("/{profile_id}", summary="Mevcut Digital Twin'i getir")
async def get_twin(
    profile_id: int,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
    _ent: User         = Depends(require_feature("digital_twin_forecast")),
) -> dict[str, Any]:
    """
    Get the latest Digital Twin for a profile.
    Returns 404 if no twin has been generated yet.
    """
    await _check_profile_exists(db, profile_id)

    twin = await twin_engine.get_latest(db, profile_id)
    if not twin:
        raise HTTPException(
            status_code=404,
            detail="Bu profil için henüz Digital Twin oluşturulmamış. Önce /generate çağırın.",
        )

    forecasts = await twin_engine.get_forecasts_for_twin(db, twin.id)
    return _twin_to_dict(twin, forecasts)


# ─── Refresh ──────────────────────────────────────────────────────────────────

@router.post("/refresh/{profile_id}", summary="Digital Twin'i yenile")
async def refresh_twin(
    profile_id: int,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
    _ent: User         = Depends(require_feature("digital_twin_forecast")),
) -> dict[str, Any]:
    """
    Regenerate the Digital Twin using the latest snapshot data.
    Costs 1 credit.
    """
    if user.credits_remaining < 1:
        raise HTTPException(
            status_code=402,
            detail="Yeterli krediniz yok. Twin yenileme için 1 kredi gerekir.",
        )

    await _check_profile_exists(db, profile_id)

    is_mock = not user.is_admin
    try:
        result = await twin_engine.generate(db=db, profile_id=profile_id, is_mock=is_mock)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Twin yenileme hatası: {exc}")

    # Deduct credit only when a real forecast was produced
    if result.is_forecast_available:
        user.credits_remaining -= 1
        db.add(user)
        await db.commit()

    try:
        from app.services.event_bus import publish as publish_event
        await publish_event(
            session=db,
            event_type="digital_twin.updated",
            payload={"profile_id": profile_id, "confidence": result.confidence},
            source=f"user:{user.id}",
        )
    except Exception:
        pass

    twin = await twin_engine.get_latest(db, profile_id)
    if twin:
        forecasts = await twin_engine.get_forecasts_for_twin(db, twin.id)
        return {
            "success": True,
            "refreshed": True,
            "twin": _twin_to_dict(twin, forecasts),
            "note": result.note,
        }

    return {
        "success": True,
        "refreshed": True,
        "is_forecast_available": result.is_forecast_available,
        "unavailability_reason": result.unavailability_reason,
        "note": result.note,
    }


# ─── High Risk (admin only) ───────────────────────────────────────────────────

@router.get("/high-risk", summary="Yüksek riskli Twin listesi (admin)")
async def list_high_risk(
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> dict[str, Any]:
    """
    List influencer profiles with increasing risk trend in their Digital Twin.
    Admin only.
    """
    twins = await twin_engine.get_high_risk_twins(db, limit=limit)
    results = []
    for twin in twins:
        forecasts = await twin_engine.get_forecasts_for_twin(db, twin.id)
        results.append(_twin_to_dict(twin, forecasts))

    return {
        "total": len(results),
        "twins": results,
    }


# ─── List all twins (admin) ───────────────────────────────────────────────────

@router.get("/", summary="Tüm Digital Twin listesi (admin)")
async def list_twins(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    confidence: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
) -> dict[str, Any]:
    q = (
        select(InfluencerDigitalTwin)
        .where(InfluencerDigitalTwin.is_latest == True)
        .order_by(InfluencerDigitalTwin.generated_at.desc())
    )
    if confidence:
        try:
            q = q.where(InfluencerDigitalTwin.confidence == ConfidenceLevel(confidence))
        except ValueError:
            pass

    res = await db.execute(q.offset(offset).limit(limit))
    twins = list(res.scalars().all())

    results = []
    for twin in twins:
        forecasts = await twin_engine.get_forecasts_for_twin(db, twin.id)
        results.append(_twin_to_dict(twin, forecasts))

    return {
        "total": len(results),
        "offset": offset,
        "limit": limit,
        "twins": results,
    }
