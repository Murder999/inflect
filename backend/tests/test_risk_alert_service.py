"""
Risk Alert Service Tests — Part 17

Tests the core business logic without requiring a live database.
All DB interactions are mocked with AsyncMock / MagicMock.

Run with:
    cd backend
    python -m pytest tests/test_risk_alert_service.py -v
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call

from app.models.risk_radar import RiskAlert, AlertStatus, AlertSource
from app.services.risk_alert_service import (
    create_or_update_alert,
    acknowledge_alert,
    dismiss_alert,
    resolve_alert,
    alert_to_dict,
    list_alerts,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_alert(**kwargs) -> RiskAlert:
    """Factory for RiskAlert instances with sensible defaults."""
    defaults = dict(
        id=1,
        profile_id=42,
        alert_type="risk_threshold",
        severity="high",
        status=AlertStatus.OPEN.value,
        source=AlertSource.MANUAL_SCAN.value,
        platform="instagram",
        previous_score=45.0,
        current_score=78.0,
        delta=33.0,
        message="Risk skoru 78/100 (HIGH)",
        explanation="Fraud risk yüksek",
        evidence=["Takipçi artışı anormal"],
        details={"is_mock": True},
        acknowledged_by=None,
        acknowledged_at=None,
        resolved_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    defaults.update(kwargs)
    alert = RiskAlert()
    for k, v in defaults.items():
        setattr(alert, k, v)
    return alert


def _make_db(existing_alert=None) -> AsyncMock:
    """Create a mock AsyncSession."""
    db = AsyncMock()

    # Mock scalars().scalar_one_or_none()
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none = MagicMock(return_value=existing_alert)
    db.execute = AsyncMock(return_value=scalar_result)
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


# ── create_or_update_alert ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_new_alert_when_no_existing():
    """When no open alert exists for (profile_id, alert_type), a new one is created."""
    db = _make_db(existing_alert=None)

    alert, created = await create_or_update_alert(
        db=db,
        profile_id=42,
        alert_type="risk_threshold",
        severity="high",
        message="Risk skoru 78/100",
        source=AlertSource.SCHEDULED_SCAN.value,
        platform="instagram",
        previous_score=45.0,
        current_score=78.0,
    )

    assert created is True
    assert alert.profile_id == 42
    assert alert.alert_type == "risk_threshold"
    assert alert.severity == "high"
    assert alert.status == AlertStatus.OPEN.value
    assert alert.source == AlertSource.SCHEDULED_SCAN.value
    assert alert.delta == pytest.approx(33.0, abs=0.01)
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_update_existing_open_alert_no_duplicate():
    """When an open alert exists, it is updated rather than creating a new row."""
    existing = _make_alert(id=99, current_score=60.0)
    db = _make_db(existing_alert=existing)

    alert, created = await create_or_update_alert(
        db=db,
        profile_id=42,
        alert_type="risk_threshold",
        severity="critical",
        message="Risk skoru 85/100 — worsened",
        source=AlertSource.SCHEDULED_SCAN.value,
        current_score=85.0,
        previous_score=60.0,
    )

    assert created is False
    assert alert is existing
    assert alert.severity == "critical"
    assert alert.current_score == 85.0
    assert alert.delta == pytest.approx(25.0, abs=0.01)
    # No new row inserted
    db.add.assert_called_once_with(existing)


@pytest.mark.asyncio
async def test_delta_computed_correctly():
    """Delta = current_score - previous_score."""
    db = _make_db(existing_alert=None)

    alert, _ = await create_or_update_alert(
        db=db,
        profile_id=1,
        alert_type="risk_threshold",
        severity="medium",
        message="test",
        current_score=70.0,
        previous_score=50.0,
    )

    assert alert.delta == pytest.approx(20.0, abs=0.01)


@pytest.mark.asyncio
async def test_delta_none_when_scores_missing():
    """Delta is None if either score is not provided."""
    db = _make_db(existing_alert=None)

    alert, _ = await create_or_update_alert(
        db=db,
        profile_id=1,
        alert_type="risk_threshold",
        severity="medium",
        message="test",
    )

    assert alert.delta is None


# ── Status transitions ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_acknowledge_open_alert():
    """Open alert can be acknowledged by admin."""
    alert = _make_alert(status=AlertStatus.OPEN.value)
    db = _make_db(existing_alert=alert)

    result = await acknowledge_alert(db, alert_id=1, user_id=7)

    assert result.status == AlertStatus.ACKNOWLEDGED.value
    assert result.acknowledged_by == 7
    assert result.acknowledged_at is not None


@pytest.mark.asyncio
async def test_acknowledge_resolved_alert_raises():
    """Cannot acknowledge an already resolved alert."""
    alert = _make_alert(status=AlertStatus.RESOLVED.value)
    db = _make_db(existing_alert=alert)

    with pytest.raises(ValueError, match="Çözümlenen"):
        await acknowledge_alert(db, alert_id=1, user_id=7)


@pytest.mark.asyncio
async def test_dismiss_acknowledged_alert():
    """Acknowledged alert can be dismissed."""
    alert = _make_alert(status=AlertStatus.ACKNOWLEDGED.value)
    db = _make_db(existing_alert=alert)

    result = await dismiss_alert(db, alert_id=1, user_id=7)

    assert result.status == AlertStatus.DISMISSED.value
    assert result.acknowledged_by == 7


@pytest.mark.asyncio
async def test_dismiss_resolved_alert_raises():
    """Cannot dismiss a resolved alert."""
    alert = _make_alert(status=AlertStatus.RESOLVED.value)
    db = _make_db(existing_alert=alert)

    with pytest.raises(ValueError, match="iptal"):
        await dismiss_alert(db, alert_id=1, user_id=7)


@pytest.mark.asyncio
async def test_resolve_open_alert():
    """Open alert can be resolved."""
    alert = _make_alert(status=AlertStatus.OPEN.value)
    db = _make_db(existing_alert=alert)

    result = await resolve_alert(db, alert_id=1, user_id=7)

    assert result.status == AlertStatus.RESOLVED.value
    assert result.resolved_at is not None
    assert result.acknowledged_by == 7


@pytest.mark.asyncio
async def test_resolve_already_resolved_raises():
    """Cannot resolve an already resolved alert."""
    alert = _make_alert(status=AlertStatus.RESOLVED.value)
    db = _make_db(existing_alert=alert)

    with pytest.raises(ValueError, match="zaten çözümlenmiş"):
        await resolve_alert(db, alert_id=1, user_id=7)


# ── alert_to_dict ─────────────────────────────────────────────────────────────

def test_alert_to_dict_shape():
    """alert_to_dict returns all expected keys."""
    alert = _make_alert()
    d = alert_to_dict(alert)

    required_keys = {
        "id", "profile_id", "alert_type", "severity", "status", "source",
        "platform", "previous_score", "current_score", "delta",
        "message", "explanation", "evidence", "details",
        "acknowledged_by", "acknowledged_at", "resolved_at",
        "created_at", "updated_at",
    }
    assert required_keys.issubset(d.keys())


def test_alert_to_dict_evidence_defaults_to_list():
    """evidence=None serializes as an empty list."""
    alert = _make_alert(evidence=None)
    d = alert_to_dict(alert)
    assert d["evidence"] == []


def test_alert_to_dict_iso_timestamps():
    """Datetime fields are serialized as ISO strings."""
    alert = _make_alert()
    d = alert_to_dict(alert)
    assert isinstance(d["created_at"], str)
    assert "T" in d["created_at"]


# ── Admin permission ──────────────────────────────────────────────────────────

def test_non_admin_cannot_list_alerts():
    """The route handler should raise 403 for non-admins."""
    from app.api.v1.routes.risk_alerts import _require_admin
    from fastapi import HTTPException

    non_admin = MagicMock()
    non_admin.is_admin = False

    with pytest.raises(HTTPException) as exc_info:
        _require_admin(non_admin)

    assert exc_info.value.status_code == 403


def test_admin_can_access():
    """Admin user passes _require_admin without exception."""
    from app.api.v1.routes.risk_alerts import _require_admin

    admin = MagicMock()
    admin.is_admin = True

    _require_admin(admin)  # must not raise
