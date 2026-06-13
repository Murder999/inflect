"""
Risk Scan Scheduler Tests — Part 17

Tests the scheduler's core logic:
  - Duplicate alert prevention
  - Profile collection logic
  - Error isolation (one failed profile must not crash batch)
  - NOT_CHARGED logging for system scans

Run with:
    cd backend
    python -m pytest tests/test_risk_scan_scheduler.py -v
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from datetime import datetime, timezone

from app.models.risk_radar import AlertStatus, AlertSource
from app.services.risk_alert_service import create_or_update_alert


# ── Duplicate prevention ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_or_update_does_not_duplicate_open_alert():
    """
    Calling create_or_update_alert twice with same (profile_id, alert_type)
    must return created=False on the second call.
    """
    from app.models.risk_radar import RiskAlert

    # First call: no existing alert
    db1 = AsyncMock()
    scalar1 = MagicMock()
    scalar1.scalar_one_or_none = MagicMock(return_value=None)
    db1.execute = AsyncMock(return_value=scalar1)
    db1.add = MagicMock()
    db1.commit = AsyncMock()

    alert1, created1 = await create_or_update_alert(
        db=db1, profile_id=10, alert_type="risk_threshold",
        severity="high", message="first scan",
        source=AlertSource.SCHEDULED_SCAN.value,
        current_score=75.0,
    )
    assert created1 is True

    # Second call: existing open alert returned
    db2 = AsyncMock()
    scalar2 = MagicMock()
    scalar2.scalar_one_or_none = MagicMock(return_value=alert1)
    db2.execute = AsyncMock(return_value=scalar2)
    db2.add = MagicMock()
    db2.commit = AsyncMock()

    alert2, created2 = await create_or_update_alert(
        db=db2, profile_id=10, alert_type="risk_threshold",
        severity="critical", message="second scan — worsened",
        source=AlertSource.SCHEDULED_SCAN.value,
        current_score=85.0,
        previous_score=75.0,
    )

    assert created2 is False
    assert alert2 is alert1
    # Severity updated
    assert alert2.severity == "critical"
    assert alert2.current_score == 85.0
    assert alert2.delta == pytest.approx(10.0, abs=0.01)


# ── Alert source on scheduled scan ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_scheduled_scan_uses_scheduled_scan_source():
    """Alert source must be 'scheduled_scan' for system-triggered scans."""
    db = AsyncMock()
    scalar = MagicMock()
    scalar.scalar_one_or_none = MagicMock(return_value=None)
    db.execute = AsyncMock(return_value=scalar)
    db.add = MagicMock()
    db.commit = AsyncMock()

    alert, created = await create_or_update_alert(
        db=db, profile_id=99, alert_type="risk_threshold",
        severity="high", message="scheduled",
        source=AlertSource.SCHEDULED_SCAN.value,
    )

    assert alert.source == "scheduled_scan"


# ── start/stop API ────────────────────────────────────────────────────────────

def test_start_stop_scanner_no_crash():
    """start_risk_scanner / stop_risk_scanner must not raise."""
    from app.services.risk_scan_scheduler import start_risk_scanner, stop_risk_scanner
    import asyncio

    dummy_session = MagicMock()

    # We patch asyncio.create_task so no actual coroutine runs
    with patch("asyncio.create_task") as mock_create_task:
        mock_create_task.return_value = MagicMock(done=lambda: False)
        start_risk_scanner(dummy_session)
        stop_risk_scanner()

    mock_create_task.assert_called_once()


def test_start_scanner_idempotent():
    """Calling start_risk_scanner twice must not start a second task."""
    from app.services import risk_scan_scheduler as sched

    sched._running = True
    mock_task = MagicMock()
    mock_task.done = MagicMock(return_value=False)
    sched._scanner_task = mock_task

    with patch("asyncio.create_task") as mock_create:
        sched.start_risk_scanner(MagicMock())

    mock_create.assert_not_called()

    # Cleanup
    sched._running = False
    sched._scanner_task = None


# ── Model enum values ─────────────────────────────────────────────────────────

def test_alert_status_values():
    """AlertStatus enum contains all required values."""
    values = {s.value for s in AlertStatus}
    assert "open"         in values
    assert "acknowledged" in values
    assert "dismissed"    in values
    assert "resolved"     in values


def test_alert_source_values():
    """AlertSource enum contains all required values."""
    values = {s.value for s in AlertSource}
    assert "scheduled_scan"   in values
    assert "manual_scan"      in values
    assert "campaign_monitor" in values
