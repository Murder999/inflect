"""
Risk Alert Service — Part 17

Manages the full lifecycle of RiskAlert records:
  create_or_update_alert  — dedup-safe creation; updates existing open alert
  list_alerts             — filterable admin query
  get_alert               — single record fetch
  acknowledge_alert       — marks alert as acknowledged by an admin user
  dismiss_alert           — marks alert as dismissed (not actionable)
  resolve_alert           — marks alert as resolved (root cause addressed)

Duplicate prevention rule:
  If an open alert already exists for the same (profile_id, alert_type),
  the existing record is updated (score, delta, message, updated_at)
  instead of creating a new row.  This prevents alert spam from repeated scans.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.risk_radar import RiskAlert, AlertStatus, AlertSource

logger = logging.getLogger(__name__)


# ── Alert creation / update ───────────────────────────────────────────────────

async def create_or_update_alert(
    db:             AsyncSession,
    profile_id:     int,
    alert_type:     str,
    severity:       str,
    message:        str,
    source:         str = AlertSource.MANUAL_SCAN.value,
    platform:       Optional[str] = None,
    previous_score: Optional[float] = None,
    current_score:  Optional[float] = None,
    explanation:    Optional[str] = None,
    evidence:       Optional[list] = None,
    details:        Optional[dict] = None,
) -> tuple[RiskAlert, bool]:
    """
    Create or update a RiskAlert.

    Returns (alert, created) where created=True means a new row was inserted.

    Dedup rule: if an OPEN alert for (profile_id, alert_type) already exists,
    update it instead of inserting a duplicate.
    """
    now = datetime.now(timezone.utc)

    # Compute delta
    delta: Optional[float] = None
    if previous_score is not None and current_score is not None:
        delta = round(current_score - previous_score, 2)

    # Check for existing open alert
    existing_res = await db.execute(
        select(RiskAlert).where(
            and_(
                RiskAlert.profile_id == profile_id,
                RiskAlert.alert_type == alert_type,
                RiskAlert.status == AlertStatus.OPEN.value,
            )
        ).order_by(desc(RiskAlert.created_at)).limit(1)
    )
    existing = existing_res.scalar_one_or_none()

    if existing is not None:
        # Update existing open alert — avoid spam
        existing.severity       = severity
        existing.message        = message
        existing.source         = source
        existing.platform       = platform or existing.platform
        existing.previous_score = previous_score
        existing.current_score  = current_score
        existing.delta          = delta
        existing.explanation    = explanation or existing.explanation
        if evidence is not None:
            existing.evidence = evidence
        if details is not None:
            existing.details = details
        existing.updated_at = now
        db.add(existing)
        logger.debug(
            "RiskAlert updated (dedup): id=%d profile_id=%d type=%s severity=%s",
            existing.id, profile_id, alert_type, severity,
        )
        return existing, False

    # Create new alert
    alert = RiskAlert(
        profile_id=profile_id,
        alert_type=alert_type,
        severity=severity,
        status=AlertStatus.OPEN.value,
        source=source,
        platform=platform,
        previous_score=previous_score,
        current_score=current_score,
        delta=delta,
        message=message,
        explanation=explanation,
        evidence=evidence,
        details=details,
        created_at=now,
        updated_at=now,
    )
    db.add(alert)
    logger.info(
        "RiskAlert created: profile_id=%d type=%s severity=%s source=%s",
        profile_id, alert_type, severity, source,
    )
    return alert, True


# ── Status transitions ────────────────────────────────────────────────────────

async def acknowledge_alert(
    db:       AsyncSession,
    alert_id: int,
    user_id:  int,
) -> RiskAlert:
    """Transition alert from open/acknowledged → acknowledged."""
    alert = await _get_or_404(db, alert_id)
    if alert.status == AlertStatus.RESOLVED.value:
        raise ValueError("Çözümlenen alert tekrar onaylanamaz.")
    if alert.status == AlertStatus.DISMISSED.value:
        raise ValueError("İptal edilen alert onaylanamaz.")

    now = datetime.now(timezone.utc)
    alert.status          = AlertStatus.ACKNOWLEDGED.value
    alert.acknowledged_by = user_id
    alert.acknowledged_at = now
    alert.updated_at      = now
    db.add(alert)
    return alert


async def dismiss_alert(
    db:       AsyncSession,
    alert_id: int,
    user_id:  int,
) -> RiskAlert:
    """Transition alert → dismissed (not actionable)."""
    alert = await _get_or_404(db, alert_id)
    if alert.status == AlertStatus.RESOLVED.value:
        raise ValueError("Çözümlenen alert iptal edilemez.")

    now = datetime.now(timezone.utc)
    alert.status          = AlertStatus.DISMISSED.value
    alert.acknowledged_by = user_id
    alert.acknowledged_at = alert.acknowledged_at or now
    alert.updated_at      = now
    db.add(alert)
    return alert


async def resolve_alert(
    db:       AsyncSession,
    alert_id: int,
    user_id:  int,
) -> RiskAlert:
    """Transition alert → resolved (root cause addressed)."""
    alert = await _get_or_404(db, alert_id)
    if alert.status == AlertStatus.RESOLVED.value:
        raise ValueError("Alert zaten çözümlenmiş.")

    now = datetime.now(timezone.utc)
    alert.status          = AlertStatus.RESOLVED.value
    alert.resolved_at     = now
    alert.acknowledged_by = user_id
    alert.acknowledged_at = alert.acknowledged_at or now
    alert.updated_at      = now
    db.add(alert)
    return alert


# ── Queries ───────────────────────────────────────────────────────────────────

async def get_alert(
    db:       AsyncSession,
    alert_id: int,
) -> Optional[RiskAlert]:
    res = await db.execute(select(RiskAlert).where(RiskAlert.id == alert_id))
    return res.scalar_one_or_none()


async def list_alerts(
    db:          AsyncSession,
    *,
    severity:    Optional[str] = None,
    status:      Optional[str] = None,
    platform:    Optional[str] = None,
    source:      Optional[str] = None,
    profile_id:  Optional[int] = None,
    from_date:   Optional[datetime] = None,
    to_date:     Optional[datetime] = None,
    limit:       int = 50,
    offset:      int = 0,
) -> tuple[list[RiskAlert], int]:
    """
    Return (rows, total_count) with all filters applied.
    """
    from sqlalchemy import func

    filters = []
    if severity:
        filters.append(RiskAlert.severity == severity)
    if status:
        filters.append(RiskAlert.status == status)
    if platform:
        filters.append(RiskAlert.platform == platform)
    if source:
        filters.append(RiskAlert.source == source)
    if profile_id:
        filters.append(RiskAlert.profile_id == profile_id)
    if from_date:
        filters.append(RiskAlert.created_at >= from_date)
    if to_date:
        filters.append(RiskAlert.created_at <= to_date)

    base_q = select(RiskAlert)
    if filters:
        base_q = base_q.where(and_(*filters))

    count_res = await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )
    total = count_res.scalar() or 0

    rows_res = await db.execute(
        base_q.order_by(desc(RiskAlert.created_at)).offset(offset).limit(limit)
    )
    rows = list(rows_res.scalars().all())
    return rows, total


# ── Serialisation helper ──────────────────────────────────────────────────────

def alert_to_dict(alert: RiskAlert) -> dict:
    return {
        "id":             alert.id,
        "profile_id":     alert.profile_id,
        "alert_type":     alert.alert_type,
        "severity":       alert.severity,
        "status":         alert.status,
        "source":         alert.source,
        "platform":       alert.platform,
        "previous_score": alert.previous_score,
        "current_score":  alert.current_score,
        "delta":          alert.delta,
        "message":        alert.message,
        "explanation":    alert.explanation,
        "evidence":       alert.evidence or [],
        "details":        alert.details,
        "acknowledged_by": alert.acknowledged_by,
        "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        "resolved_at":    alert.resolved_at.isoformat() if alert.resolved_at else None,
        "created_at":     alert.created_at.isoformat() if alert.created_at else None,
        "updated_at":     alert.updated_at.isoformat() if alert.updated_at else None,
    }


# ── Internal ──────────────────────────────────────────────────────────────────

async def _get_or_404(db: AsyncSession, alert_id: int) -> RiskAlert:
    alert = await get_alert(db, alert_id)
    if alert is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Alert #{alert_id} bulunamadı.")
    return alert
