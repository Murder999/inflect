"""
Migration Health Endpoint Tests — Part 17

Tests the /admin/health/migrations response shape and logic
without a live database connection.

Run with:
    cd backend
    python -m pytest tests/test_migration_health.py -v
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.api.v1.routes.admin_intelligence import (
    _EXPECTED_HEAD,
    _CRITICAL_TABLES,
    _CRITICAL_INDEXES,
)


# ── Constants ─────────────────────────────────────────────────────────────────

def test_expected_head_is_part22():
    """EXPECTED_HEAD must be the Part 22 migration revision."""
    assert _EXPECTED_HEAD == "0006_part22_brand_ai"


def test_critical_tables_includes_part17():
    """risk_alerts and risk_scan_logs must be in _CRITICAL_TABLES."""
    assert "risk_alerts" in _CRITICAL_TABLES
    assert "risk_scan_logs" in _CRITICAL_TABLES


def test_critical_tables_includes_core():
    """Core tables must be in _CRITICAL_TABLES."""
    for t in ["users", "analyses", "influencer_profiles", "influencer_risk_reports"]:
        assert t in _CRITICAL_TABLES, f"{t!r} missing from _CRITICAL_TABLES"


def test_critical_indexes_covers_risk_alerts():
    """Key risk_alert indexes must be declared."""
    tables_indexes = [(t, i) for t, i in _CRITICAL_INDEXES]
    assert ("risk_alerts", "ix_risk_alerts_status") in tables_indexes
    assert ("risk_alerts", "ix_risk_alerts_severity") in tables_indexes
    assert ("risk_alerts", "ix_risk_alerts_source") in tables_indexes


# ── Response shape ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_migration_health_response_shape():
    """
    The endpoint returns all required keys in its response.
    DB calls are mocked to avoid needing a live database.
    """
    from app.api.v1.routes.admin_intelligence import get_migration_health

    # Mock admin user
    admin_user = MagicMock()
    admin_user.is_admin = True

    # Mock DB session
    db = AsyncMock()

    # Mock: alembic_version query returns expected head
    alembic_row = MagicMock()
    alembic_row.__getitem__ = MagicMock(return_value=_EXPECTED_HEAD)
    alembic_result = MagicMock()
    alembic_result.fetchone = MagicMock(return_value=alembic_row)

    # Mock: run_sync for table inspection
    async def mock_run_sync(fn):
        # Simulate all critical tables present
        if "get_table_names" in str(fn) or callable(fn):
            return _CRITICAL_TABLES
        return {}

    db.execute = AsyncMock(return_value=alembic_result)
    db.run_sync = AsyncMock(side_effect=mock_run_sync)

    response = await get_migration_health(db=db, current_user=admin_user)

    assert response["ok"] is True
    assert "current_revision" in response
    assert "expected_head" in response
    assert "is_up_to_date" in response
    assert "missing_tables" in response
    assert "missing_indexes" in response
    assert "schema_ready" in response
    assert "checked_at" in response
    assert response["expected_head"] == _EXPECTED_HEAD


@pytest.mark.asyncio
async def test_migration_health_non_admin_raises_403():
    """Non-admin user gets HTTP 403."""
    from fastapi import HTTPException
    from app.api.v1.routes.admin_intelligence import get_migration_health

    non_admin = MagicMock()
    non_admin.is_admin = False

    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await get_migration_health(db=db, current_user=non_admin)

    assert exc_info.value.status_code == 403


# ── Scan log endpoint ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_scan_logs_non_admin_raises_403():
    """Non-admin user gets HTTP 403 from /admin/health/scan-logs."""
    from fastapi import HTTPException
    from app.api.v1.routes.admin_intelligence import get_scan_logs

    non_admin = MagicMock()
    non_admin.is_admin = False
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await get_scan_logs(limit=20, db=db, current_user=non_admin)

    assert exc_info.value.status_code == 403
