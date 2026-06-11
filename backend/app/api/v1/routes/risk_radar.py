"""
Risk Radar API Routes — Part 16

POST /risk-radar/scan              — archive-independent query scan (NEW)
POST /risk-radar/scan/{profile_id} — scan by known profile_id
GET  /risk-radar/report/{profile_id}  — get cached report, 0 credits
GET  /risk-radar/alerts               — list recent alerts, 0 credits
GET  /risk-radar/high-risk            — admin: list high-risk profiles

Credit policy (Part 16):
  - Credits are ONLY charged after a successful scan, never before.
  - Cost comes from IntelligenceFeature DB table (dynamic, admin-configurable).
  - Report mode determines cost: limited=1, standard=1, full=2.
  - Admins: free_for_admin=True → no credit deducted.
  - Failed scans: 0 credits charged, failure logged.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.influencer_archive import InfluencerProfile
from app.models.risk_radar import RiskAlert

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/risk-radar", tags=["risk-radar"])


# ── Request body ──────────────────────────────────────────────────────────────

class QueryScanBody(BaseModel):
    query:          str             # username / @handle / profile URL
    platform:       Optional[str]  = None   # instagram | tiktok | youtube
    window_days:    int            = 90
    force_refresh:  bool           = False


# ── Serialiser ────────────────────────────────────────────────────────────────

def _report_to_dict(result) -> dict:
    return {
        "profile_id":      result.profile_id,
        "username":        result.username,
        "platform":        result.platform,
        "category":        result.category,
        "window_days":     result.window_days,
        "generated_at":    result.generated_at.isoformat(),
        "is_mock":         result.is_mock,
        "overall_score":   result.overall_score,
        "overall_level":   result.overall_level,
        "risk_trajectory": result.risk_trajectory,
        "confidence":      result.confidence,
        "snapshot_count":  result.snapshot_count,
        "dimensions": {
            k: {
                "name":       d.name,
                "label":      d.label,
                "score":      d.score,
                "level":      d.level,
                "trend":      d.trend,
                "signals":    d.signals,
                "confidence": d.confidence,
            }
            for k, d in result.dimensions.items()
        },
        "anomaly_events": [
            {
                "anomaly_type": a.anomaly_type,
                "description":  a.description,
                "severity":     a.severity,
                "period":       a.period,
            }
            for a in result.anomaly_events
        ],
        "evidence_summary": result.evidence_summary,
        "limitations":      result.limitations,
        "note":             result.note,
    }


def _determine_report_mode(snapshot_count: int, window_days: int, resolution_source: str = "archive") -> str:
    if resolution_source == "mock":
        return "mock_limited"
    if resolution_source == "archive_fallback":
        return "archive_fallback"
    if snapshot_count >= 7 and window_days >= 30:
        return "full"
    if snapshot_count >= 3 and window_days >= 7:
        return "standard"
    return "limited"


# ── NEW: Archive-independent query scan ───────────────────────────────────────

@router.post("/scan")
async def scan_by_query(
    body: QueryScanBody,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
):
    """
    Scan any influencer by username, @handle, or profile URL.
    No archive required — the resolve pipeline creates a profile if missing.

    Structured failure responses (HTTP 422 with failure_code):
      needs_platform           — platform could not be detected
      provider_not_configured  — API keys missing
      provider_unavailable     — provider rate-limited / down
      profile_not_found        — profile does not exist or is private
      feature_disabled         — feature disabled by admin
      plan_not_allowed         — user plan has no access
      insufficient_credits     — not enough credits
      internal_error           — unexpected failure
    """
    from app.services.intelligence_billing import can_use_feature, charge_feature_usage, record_failed_usage
    from app.services.influencers.resolve import resolve_influencer_for_intelligence
    from app.services.risk_radar.engine import scan_influencer as _scan

    FEATURE = "risk_radar_scan"

    # 1. Resolve identity → InfluencerProfile
    resolved = await resolve_influencer_for_intelligence(
        db=db,
        query=body.query,
        platform=body.platform,
        create_if_missing=True,
        force_refresh=body.force_refresh,
        purpose="risk_radar",
    )

    if not resolved.success:
        await record_failed_usage(
            db, user, FEATURE,
            failure_code=resolved.failure_code or "internal_error",
            metadata={"query": body.query, "platform": body.platform},
        )
        return {
            "ok":           False,
            "failure_code": resolved.failure_code or "internal_error",
            "message":      resolved.failure_message or "Profil çözümlenemedi.",
            "next_action":  resolved.next_action,
        }

    profile_id = resolved.profile_id

    # Archive fallback scans are limited mode
    is_archive_fallback = resolved.status == "archive_fallback"
    is_mock_result      = resolved.resolution_source == "mock"

    # 2. Check billing
    pre_mode = "limited" if (is_archive_fallback or is_mock_result) else "standard"
    usage = await can_use_feature(db, user, FEATURE, pre_mode)

    if not usage.can_use and not is_mock_result:
        await record_failed_usage(
            db, user, FEATURE,
            failure_code=usage.reason,
            metadata={"query": body.query, "profile_id": profile_id},
        )
        if usage.reason == "insufficient_credits":
            raise HTTPException(
                status_code=402,
                detail=f"Yetersiz kredi. Bu tarama {usage.credit_cost} kredi gerektirir.",
            )
        if usage.reason == "feature_disabled":
            raise HTTPException(status_code=403, detail="Risk Radar özelliği şu an devre dışı.")
        raise HTTPException(status_code=403, detail="Bu özelliğe erişim planınızda mevcut değil.")

    # 3. Run scan
    try:
        result = await _scan(
            db=db,
            profile_id=profile_id,
            window_days=body.window_days,
            user_id=user.id,
            force=body.force_refresh,
        )
    except Exception as exc:
        logger.error("Risk scan failed profile_id=%d query=%s: %s", profile_id, body.query, exc)
        await record_failed_usage(
            db, user, FEATURE,
            failure_code="internal_error",
            metadata={"query": body.query, "profile_id": profile_id},
        )
        return {
            "ok":           False,
            "failure_code": "internal_error",
            "message":      "Risk analizi tamamlanamadı. Lütfen tekrar deneyin.",
        }

    # 4. Determine actual report mode from snapshot count, then charge
    actual_mode = _determine_report_mode(
        result.snapshot_count if hasattr(result, "snapshot_count") else 1,
        body.window_days,
        resolved.resolution_source or "archive",
    )
    cost_decision = await can_use_feature(db, user, FEATURE, actual_mode)
    credits_to_charge = cost_decision.credit_cost if cost_decision.can_use else usage.credit_cost

    if not usage.is_free:
        await charge_feature_usage(
            db, user, FEATURE,
            credits=credits_to_charge,
            report_mode=actual_mode,
            metadata={
                "query":      body.query,
                "profile_id": profile_id,
                "platform":   resolved.platform,
            },
        )

    report_dict = _report_to_dict(result)
    report_dict["report_mode"] = actual_mode

    return {
        "ok":                  True,
        "report":              report_dict,
        "resolved":            {
            "status":          resolved.status,
            "username":        resolved.username,
            "platform":        resolved.platform,
            "display_name":    resolved.display_name,
            "profile_image_url": resolved.profile_image_url,
            "avatar_status":   resolved.avatar_status,
            "followers":       resolved.followers,
            "resolution_source": resolved.resolution_source,
        },
        "report_mode":         actual_mode,
        "warnings":            resolved.warnings,
        "limitations":         resolved.limitations,
        "credits_charged":     credits_to_charge if not usage.is_free else 0,
        "credits_remaining":   user.credits_remaining,
    }


# ── Existing: scan by known profile_id ────────────────────────────────────────

@router.post("/scan/{profile_id}")
async def scan_influencer(
    profile_id:  int,
    window_days: int  = Query(90, ge=14, le=365),
    force:       bool = Query(False),
    db:          AsyncSession = Depends(get_db),
    user:        User = Depends(get_current_user),
):
    """
    Scan a known archive profile. Credits charged only on success.
    """
    from app.services.intelligence_billing import can_use_feature, charge_feature_usage, record_failed_usage
    from app.services.risk_radar.engine import scan_influencer as _scan

    FEATURE = "risk_radar_scan"

    prof_res = await db.execute(
        select(InfluencerProfile).where(InfluencerProfile.id == profile_id)
    )
    if not prof_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Influencer profili bulunamadı.")

    usage = await can_use_feature(db, user, FEATURE, "standard")
    if not usage.can_use:
        if usage.reason == "insufficient_credits":
            raise HTTPException(
                status_code=402,
                detail=f"Yetersiz kredi. Bu tarama {usage.credit_cost} kredi gerektirir.",
            )
        raise HTTPException(status_code=403, detail="Bu özelliğe erişim planınızda mevcut değil.")

    try:
        result = await _scan(db=db, profile_id=profile_id, window_days=window_days,
                             user_id=user.id, force=force)
    except Exception as exc:
        logger.error("Risk scan failed for profile_id=%d: %s", profile_id, exc)
        await record_failed_usage(db, user, FEATURE, "internal_error",
                                  metadata={"profile_id": profile_id})
        raise HTTPException(status_code=500, detail="Risk analizi tamamlanamadı. Lütfen tekrar deneyin.")

    actual_mode = _determine_report_mode(
        getattr(result, "snapshot_count", 1),
        window_days,
    )
    if not usage.is_free:
        cost_dec = await can_use_feature(db, user, FEATURE, actual_mode)
        await charge_feature_usage(
            db, user, FEATURE,
            credits=cost_dec.credit_cost,
            report_mode=actual_mode,
            metadata={"profile_id": profile_id},
        )

    report_dict = _report_to_dict(result)
    report_dict["report_mode"] = actual_mode

    return {
        "ok":                True,
        "report":            report_dict,
        "report_mode":       actual_mode,
        "credits_remaining": user.credits_remaining,
    }


@router.get("/report/{profile_id}")
async def get_report(
    profile_id:  int,
    window_days: int = Query(90, ge=14, le=365),
    db:          AsyncSession = Depends(get_db),
    user:        User = Depends(get_current_user),
):
    """Return the latest cached risk report. 0 credits."""
    prof_res = await db.execute(
        select(InfluencerProfile).where(InfluencerProfile.id == profile_id)
    )
    if not prof_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Influencer profili bulunamadı.")

    from app.services.risk_radar.engine import get_latest_report
    result = await get_latest_report(db, profile_id, window_days)

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Bu profil için henüz risk raporu üretilmemiş. POST /risk-radar/scan ile başlatın.",
        )

    return {"ok": True, "report": _report_to_dict(result)}


@router.get("/alerts")
async def get_alerts(
    resolved: bool = Query(False),
    limit:    int  = Query(20, ge=1, le=100),
    db:       AsyncSession = Depends(get_db),
    user:     User = Depends(get_current_user),
):
    """List recent risk alerts. 0 credits."""
    q = select(RiskAlert).where(RiskAlert.resolved == resolved)
    res = await db.execute(q.order_by(desc(RiskAlert.created_at)).limit(limit))
    alerts = list(res.scalars().all())

    return {
        "ok":     True,
        "count":  len(alerts),
        "alerts": [
            {
                "id":         a.id,
                "profile_id": a.profile_id,
                "alert_type": a.alert_type,
                "severity":   a.severity,
                "message":    a.message,
                "details":    a.details,
                "resolved":   a.resolved,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ],
    }


@router.get("/high-risk")
async def get_high_risk(
    limit: int = Query(20, ge=1, le=100),
    db:    AsyncSession = Depends(get_db),
    user:  User = Depends(get_current_user),
):
    """Admin only: list profiles with HIGH or CRITICAL risk."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    from app.models.risk_radar import InfluencerRiskReport
    res = await db.execute(
        select(InfluencerRiskReport)
        .where(InfluencerRiskReport.overall_level.in_(["high", "critical"]))
        .order_by(desc(InfluencerRiskReport.generated_at))
        .limit(limit)
    )
    rows = list(res.scalars().all())

    results = []
    for row in rows:
        p_res = await db.execute(
            select(InfluencerProfile).where(InfluencerProfile.id == row.profile_id)
        )
        p = p_res.scalar_one_or_none()
        results.append({
            "profile_id":    row.profile_id,
            "username":      p.username if p else "unknown",
            "platform":      p.platform if p else "unknown",
            "overall_score": row.overall_score,
            "overall_level": row.overall_level,
            "trajectory":    row.risk_trajectory,
            "confidence":    row.confidence,
            "is_mock":       row.is_mock,
            "generated_at":  row.generated_at.isoformat(),
        })

    return {"ok": True, "count": len(results), "profiles": results}
