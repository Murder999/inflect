"""
Tests for entitlement_service — Part 18

Tests cover:
  - Admin bypass
  - Free user cannot access Pro/Agency features
  - Free user CAN access free features
  - Starter user accesses starter features but not Pro+
  - Pro user accesses Pro features but not Agency+
  - Agency user accesses Agency features but not Enterprise-only
  - Enterprise user accesses all features including api_access
  - get_user_entitlements returns correct map
  - Locked response body shape
  - require_feature raises 403 with FEATURE_LOCKED detail
  - Quota (credits) is independent of entitlement check
  - Plan fallback when DB has no Package record
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.user import User, PlanType
from app.services.entitlement_service import (
    check_feature_access,
    get_user_entitlements,
    get_locked_response_body,
    FeatureAccessResult,
    FEATURE_MIN_PLAN,
    PLAN_FEATURES,
    PLAN_ORDER,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(plan: str, is_admin: bool = False, credits: int = 5) -> User:
    u = MagicMock(spec=User)
    u.is_admin = is_admin
    u.plan = PlanType(plan)
    u.credits_remaining = credits
    u.credits_total = credits
    return u


def _make_db_with_package(slug: str, feature_keys: list[str]) -> AsyncMock:
    """Return a mock AsyncSession that returns a Package with given feature_keys."""
    from app.models.admin_models import Package
    pkg = MagicMock(spec=Package)
    pkg.slug = slug
    pkg.features = {"feature_keys": feature_keys}

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = pkg

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_mock)
    return db


def _make_db_no_package() -> AsyncMock:
    """Return a mock AsyncSession that returns no Package record."""
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_mock)
    return db


# ── Admin bypass ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_bypasses_all_features():
    admin = _make_user("free", is_admin=True)
    db = _make_db_no_package()

    for feature_key in FEATURE_MIN_PLAN:
        result = await check_feature_access(db, admin, feature_key)
        assert result.allowed is True, f"Admin should access {feature_key}"
        assert result.is_admin is True


# ── Free user ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_free_user_can_access_free_features():
    user = _make_user("free")
    db = _make_db_with_package("free", PLAN_FEATURES["free"])

    for key in PLAN_FEATURES["free"]:
        r = await check_feature_access(db, user, key)
        assert r.allowed is True, f"Free user should access {key}"


@pytest.mark.asyncio
async def test_free_user_blocked_from_pro_features():
    user = _make_user("free")
    db = _make_db_with_package("free", PLAN_FEATURES["free"])

    pro_only = ["advanced_risk_radar", "risk_evidence", "pdf_export", "watchlist_alerts"]
    for key in pro_only:
        r = await check_feature_access(db, user, key)
        assert r.allowed is False, f"Free user should NOT access {key}"
        assert r.required_plan in ("pro", "agency", "enterprise")


@pytest.mark.asyncio
async def test_free_user_blocked_from_agency_features():
    user = _make_user("free")
    db = _make_db_with_package("free", PLAN_FEATURES["free"])

    agency_only = ["digital_twin_forecast", "competitor_intelligence", "batch_analysis"]
    for key in agency_only:
        r = await check_feature_access(db, user, key)
        assert r.allowed is False


@pytest.mark.asyncio
async def test_free_user_blocked_from_api_access():
    user = _make_user("free")
    db = _make_db_with_package("free", PLAN_FEATURES["free"])

    r = await check_feature_access(db, user, "api_access")
    assert r.allowed is False
    assert r.required_plan == "enterprise"


# ── Starter user ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_starter_user_can_access_campaign_roi():
    user = _make_user("starter")
    db = _make_db_with_package("starter", PLAN_FEATURES["starter"])

    r = await check_feature_access(db, user, "campaign_roi_simulation")
    assert r.allowed is True


@pytest.mark.asyncio
async def test_starter_user_blocked_from_pro_features():
    user = _make_user("starter")
    db = _make_db_with_package("starter", PLAN_FEATURES["starter"])

    r = await check_feature_access(db, user, "pdf_export")
    assert r.allowed is False


# ── Pro user ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pro_user_can_access_pro_features():
    user = _make_user("pro")
    db = _make_db_with_package("pro", PLAN_FEATURES["pro"])

    pro_keys = ["advanced_risk_radar", "risk_evidence", "pdf_export", "watchlist_alerts"]
    for key in pro_keys:
        r = await check_feature_access(db, user, key)
        assert r.allowed is True, f"Pro user should access {key}"


@pytest.mark.asyncio
async def test_pro_user_blocked_from_agency_features():
    user = _make_user("pro")
    db = _make_db_with_package("pro", PLAN_FEATURES["pro"])

    r = await check_feature_access(db, user, "digital_twin_forecast")
    assert r.allowed is False

    r2 = await check_feature_access(db, user, "competitor_intelligence")
    assert r2.allowed is False


# ── Agency user ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_agency_user_can_access_agency_features():
    user = _make_user("agency")
    db = _make_db_with_package("agency", PLAN_FEATURES["agency"])

    agency_keys = ["digital_twin_forecast", "competitor_intelligence", "batch_analysis",
                   "scheduled_scan", "white_label_reports"]
    for key in agency_keys:
        r = await check_feature_access(db, user, key)
        assert r.allowed is True, f"Agency user should access {key}"


@pytest.mark.asyncio
async def test_agency_user_blocked_from_api_access():
    user = _make_user("agency")
    db = _make_db_with_package("agency", PLAN_FEATURES["agency"])

    r = await check_feature_access(db, user, "api_access")
    assert r.allowed is False


# ── Enterprise user ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_enterprise_user_accesses_all_features():
    user = _make_user("enterprise")
    db = _make_db_with_package("enterprise", PLAN_FEATURES["enterprise"])

    for key in FEATURE_MIN_PLAN:
        r = await check_feature_access(db, user, key)
        assert r.allowed is True, f"Enterprise user should access {key}"


# ── Locked response shape ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_locked_response_has_required_fields():
    user = _make_user("free")
    db = _make_db_with_package("free", PLAN_FEATURES["free"])

    result = await check_feature_access(db, user, "digital_twin_forecast")
    assert result.allowed is False

    body = get_locked_response_body(result)

    assert body["error_code"] == "FEATURE_LOCKED"
    assert body["feature_key"] == "digital_twin_forecast"
    assert body["required_plan"] == "agency"
    assert body["current_plan"] == "free"
    assert "upgrade_title" in body
    assert "upgrade_message" in body
    assert "cta_label" in body
    assert "cta_url" in body
    assert body["cta_url"] == "/pricing"


# ── get_user_entitlements ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_user_entitlements_free_user():
    user = _make_user("free")
    db = _make_db_with_package("free", PLAN_FEATURES["free"])

    entitlements = await get_user_entitlements(db, user)

    assert entitlements["basic_analysis"] is True
    assert entitlements["digital_twin_forecast"] is False
    assert entitlements["competitor_intelligence"] is False
    assert entitlements["api_access"] is False
    assert entitlements["pdf_export"] is False


@pytest.mark.asyncio
async def test_get_user_entitlements_pro_user():
    user = _make_user("pro")
    db = _make_db_with_package("pro", PLAN_FEATURES["pro"])

    entitlements = await get_user_entitlements(db, user)

    assert entitlements["advanced_risk_radar"] is True
    assert entitlements["pdf_export"] is True
    assert entitlements["digital_twin_forecast"] is False
    assert entitlements["api_access"] is False


# ── Fallback when no Package in DB ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fallback_to_hardcoded_map_when_no_package():
    user = _make_user("pro")
    db = _make_db_no_package()  # No Package record in DB

    # Should fall back to FEATURE_MIN_PLAN hardcoded map
    r_pro = await check_feature_access(db, user, "pdf_export")
    assert r_pro.allowed is True   # pro >= pro

    r_agency = await check_feature_access(db, user, "digital_twin_forecast")
    assert r_agency.allowed is False  # pro < agency


# ── Quota vs entitlement are independent ─────────────────────────────────────

@pytest.mark.asyncio
async def test_zero_credits_does_not_affect_entitlement():
    user = _make_user("pro", credits=0)
    db = _make_db_with_package("pro", PLAN_FEATURES["pro"])

    # Entitlement check does NOT look at credits — that's a separate concern
    r = await check_feature_access(db, user, "pdf_export")
    assert r.allowed is True   # Plan allows it — credits are irrelevant here


# ── require_feature dependency ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_require_feature_raises_403_for_locked_feature():
    from fastapi import HTTPException
    from app.services.entitlement_service import require_feature

    user = _make_user("free")
    db = _make_db_with_package("free", PLAN_FEATURES["free"])

    dep = require_feature("digital_twin_forecast")

    with pytest.raises(HTTPException) as exc_info:
        await dep(db=db, user=user)

    assert exc_info.value.status_code == 403
    detail = exc_info.value.detail
    assert isinstance(detail, dict)
    assert detail["error_code"] == "FEATURE_LOCKED"
    assert detail["feature_key"] == "digital_twin_forecast"


@pytest.mark.asyncio
async def test_require_feature_passes_for_allowed_feature():
    from app.services.entitlement_service import require_feature

    user = _make_user("pro")
    db = _make_db_with_package("pro", PLAN_FEATURES["pro"])

    dep = require_feature("pdf_export")
    result_user = await dep(db=db, user=user)
    assert result_user is user   # Returns user on success


@pytest.mark.asyncio
async def test_require_feature_admin_always_passes():
    from app.services.entitlement_service import require_feature

    admin = _make_user("free", is_admin=True)
    db = _make_db_no_package()

    dep = require_feature("digital_twin_forecast")
    result_user = await dep(db=db, user=admin)
    assert result_user is admin


# ── Plan ordering sanity ───────────────────────────────────────────────────────

def test_plan_order_is_monotonically_increasing():
    assert PLAN_ORDER["free"] < PLAN_ORDER["starter"]
    assert PLAN_ORDER["starter"] < PLAN_ORDER["pro"]
    assert PLAN_ORDER["pro"] < PLAN_ORDER["agency"]
    assert PLAN_ORDER["agency"] < PLAN_ORDER["enterprise"]


def test_plan_features_are_cumulative():
    free_set    = set(PLAN_FEATURES["free"])
    starter_set = set(PLAN_FEATURES["starter"])
    pro_set     = set(PLAN_FEATURES["pro"])
    agency_set  = set(PLAN_FEATURES["agency"])
    enterprise_set = set(PLAN_FEATURES["enterprise"])

    assert free_set.issubset(starter_set)
    assert starter_set.issubset(pro_set)
    assert pro_set.issubset(agency_set)
    assert agency_set.issubset(enterprise_set)
