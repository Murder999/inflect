"""
Risk Alert Management Routes — Part 17

Admin-only endpoints for managing RiskAlert lifecycle:

  GET  /admin/risk-alerts                   — list with filters
  GET  /admin/risk-alerts/{id}              — get single alert
  POST /admin/risk-alerts/{id}/acknowledge  — mark as acknowledged
  POST /admin/risk-alerts/{id}/dismiss      — dismiss (not actionable)
  POST /admin/risk-alerts/{id}/resolve      — resolve (root cause addressed)

All endpoints require is_admin=True.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.risk_alert_service import (
    list_alerts, get_alert, acknowledge_alert, dismiss_alert, resolve_alert,
    alert_to_dict,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["risk-alerts"])


def _require_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")


# ── List alerts ───────────────────────────────────────────────────────────────

@router.get("/admin/risk-alerts")
async def list_risk_alerts(
    severity:   Optional[str] = Query(None, description="low|medium|high|critical"),
    status:     Optional[str] = Query(None, description="open|acknowledged|dismissed|resolved"),
    platform:   Optional[str] = Query(None, description="instagram|tiktok|youtube"),
    source:     Optional[str] = Query(None,
                                      description="scheduled_scan|manual_scan|campaign_monitor"),
    profile_id: Optional[int] = Query(None, description="Specific influencer profile ID"),
    from_date:  Optional[datetime] = Query(None, description="Filter from date (ISO 8601)"),
    to_date:    Optional[datetime] = Query(None, description="Filter to date (ISO 8601)"),
    limit:      int = Query(50, ge=1, le=200),
    offset:     int = Query(0, ge=0),
    db:         AsyncSession = Depends(get_db),
    user:       User         = Depends(get_current_user),
):
    """List risk alerts with optional filters. Admin only."""
    _require_admin(user)

    alerts, total = await list_alerts(
        db,
        severity=severity,
        status=status,
        platform=platform,
        source=source,
        profile_id=profile_id,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    return {
        "ok":     True,
        "total":  total,
        "count":  len(alerts),
        "offset": offset,
        "limit":  limit,
        "alerts": [alert_to_dict(a) for a in alerts],
    }


# ── Single alert ──────────────────────────────────────────────────────────────

@router.get("/admin/risk-alerts/{alert_id}")
async def get_risk_alert(
    alert_id: int,
    db:       AsyncSession = Depends(get_db),
    user:     User         = Depends(get_current_user),
):
    """Get a single risk alert by ID. Admin only."""
    _require_admin(user)
    alert = await get_alert(db, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert #{alert_id} bulunamadı.")
    return {"ok": True, "alert": alert_to_dict(alert)}


# ── Status transitions ────────────────────────────────────────────────────────

@router.post("/admin/risk-alerts/{alert_id}/acknowledge")
async def acknowledge_risk_alert(
    alert_id: int,
    db:       AsyncSession = Depends(get_db),
    user:     User         = Depends(get_current_user),
):
    """Acknowledge a risk alert. Sets status to 'acknowledged'. Admin only."""
    _require_admin(user)
    try:
        alert = await acknowledge_alert(db, alert_id, user.id)
        await db.commit()
        logger.info("Alert #%d acknowledged by user #%d", alert_id, user.id)
        return {"ok": True, "alert": alert_to_dict(alert)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/admin/risk-alerts/{alert_id}/dismiss")
async def dismiss_risk_alert(
    alert_id: int,
    db:       AsyncSession = Depends(get_db),
    user:     User         = Depends(get_current_user),
):
    """Dismiss a risk alert (not actionable). Sets status to 'dismissed'. Admin only."""
    _require_admin(user)
    try:
        alert = await dismiss_alert(db, alert_id, user.id)
        await db.commit()
        logger.info("Alert #%d dismissed by user #%d", alert_id, user.id)
        return {"ok": True, "alert": alert_to_dict(alert)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/admin/risk-alerts/{alert_id}/resolve")
async def resolve_risk_alert(
    alert_id: int,
    db:       AsyncSession = Depends(get_db),
    user:     User         = Depends(get_current_user),
):
    """Resolve a risk alert (root cause addressed). Sets status to 'resolved'. Admin only."""
    _require_admin(user)
    try:
        alert = await resolve_alert(db, alert_id, user.id)
        await db.commit()
        logger.info("Alert #%d resolved by user #%d", alert_id, user.id)
        return {"ok": True, "alert": alert_to_dict(alert)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
