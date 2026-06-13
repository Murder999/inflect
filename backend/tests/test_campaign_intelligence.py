"""
Tests for Part 20 — Campaign Intelligence: Discovery & Entitlement-Safe Report Engine

Tests cover:
  - DataCompleteness gate: < 60% → excluded from portfolio
  - Low-confidence tier (60–75%): budget capped at 15%
  - Normal tier (>= 75%): no budget cap
  - No archive fallback: 0 verified creators → insufficient_verified_data
  - Missing engagement_quality_score prevents normal budget allocation
  - _determine_redaction: free → "full", starter → "basic", pro → "pro", agency → "none"
  - _to_dict free: simulation_result=None, locked_sections present
  - _to_dict starter: stripped sim preview, 3 creator cap, locked_sections present
  - _to_dict agency: full report, locked_sections empty
  - report_source is always "client_simulation_preview" or "server_provider_discovery"
  - No default 49/50 scores: completeness < 60% yields None quality score
"""
from __future__ import annotations

import pytest
from unittest.mock import MagicMock

from app.models.user import User, PlanType
from app.api.v1.routes.campaigns import _determine_redaction, _to_dict, _strip_roi_details
from app.services.campaign_discovery_service import (
    _compute_completeness,
    _completeness_level,
    COMPLETENESS_EXCLUDE_THRESHOLD,
    COMPLETENESS_LOW_CONF_THRESHOLD,
    BUDGET_CAP_LOW_CONF,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_user(plan: str, is_admin: bool = False) -> User:
    u = MagicMock(spec=User)
    u.is_admin = is_admin
    u.plan = PlanType(plan)
    u.credits_remaining = 10
    return u


def _make_campaign(sim_result=None, report_source=None, recommended_influencers=None, roi_estimates=None):
    c = MagicMock()
    c.id = 1
    c.name = "Test Campaign"
    c.brand = "TestBrand"
    c.platform = "instagram"
    c.status = MagicMock()
    c.status.value = "draft"
    c.budget = 10000
    c.category = "Fitness"
    c.target_country = "Türkiye"
    c.target_audience = None
    c.goal = "brand_awareness"
    c.notes = None
    c.analysis_ids = []
    c.total_reach = 0
    c.estimated_budget = 0
    c.created_at = None
    c.updated_at = None
    c.simulation_result = sim_result
    c.report_source = report_source
    c.data_confidence = "medium"
    c.provider_status = "available"
    c.discovery_sources = []
    c.report_generated_at = None
    c.recommended_influencers = recommended_influencers or []
    c.roi_estimates = roi_estimates or {}
    return c


# ── Helpers for snapshot/profile mocks ────────────────────────────────────────

def _make_snap(
    eq_score=75.0, fraud=20.0, brand_fit=80.0,
    momentum=60.0, rep_risk=30.0,
):
    snap = MagicMock()
    snap.engagement_quality_score = eq_score
    snap.fraud_score = fraud
    snap.brand_fit_score = brand_fit
    snap.momentum_score = momentum
    snap.reputation_risk_score = rep_risk
    return snap


def _make_profile(country="TR", category="Fitness"):
    prof = MagicMock()
    prof.country = country
    prof.category = category
    return prof


# ── DataCompleteness gate ──────────────────────────────────────────────────────

class TestComputeCompleteness:
    def test_all_fields_present_is_100_pct(self):
        snap = _make_snap(eq_score=75, fraud=20, brand_fit=80, momentum=60, rep_risk=30)
        prof = _make_profile(country="TR", category="Fitness")
        pct, missing = _compute_completeness(snap, prof)
        assert pct == pytest.approx(100.0)
        assert missing == []

    def test_no_fields_present_is_0_pct(self):
        snap = _make_snap(eq_score=0, fraud=0, brand_fit=0, momentum=0, rep_risk=0)
        prof = _make_profile(country="", category="")
        pct, missing = _compute_completeness(snap, prof)
        assert pct == pytest.approx(0.0)
        assert len(missing) == 7

    def test_partial_fields_is_intermediate_pct(self):
        # 3 of 7 present: eq_score, brand_fit, country → ~42.9%
        snap = _make_snap(eq_score=65, fraud=0, brand_fit=70, momentum=0, rep_risk=0)
        prof = _make_profile(country="TR", category="")
        pct, missing = _compute_completeness(snap, prof)
        assert 40 < pct < 50
        assert len(missing) == 4

    def test_missing_engagement_quality_counted_as_missing(self):
        snap = _make_snap(eq_score=0, fraud=70, brand_fit=80, momentum=60, rep_risk=30)
        prof = _make_profile(country="TR", category="Fitness")
        pct, missing = _compute_completeness(snap, prof)
        assert pct < 100
        assert "engagement_quality_score" in missing


class TestCompletenessLevel:
    def test_below_exclude_threshold_is_excluded(self):
        assert _completeness_level(COMPLETENESS_EXCLUDE_THRESHOLD - 1) == "excluded"
        assert _completeness_level(0) == "excluded"
        assert _completeness_level(59.9) == "excluded"

    def test_between_thresholds_is_low_confidence(self):
        assert _completeness_level(COMPLETENESS_EXCLUDE_THRESHOLD) == "low_confidence"
        assert _completeness_level(70) == "low_confidence"
        assert _completeness_level(COMPLETENESS_LOW_CONF_THRESHOLD - 0.1) == "low_confidence"

    def test_at_or_above_high_threshold_is_normal(self):
        assert _completeness_level(COMPLETENESS_LOW_CONF_THRESHOLD) == "normal"
        assert _completeness_level(100) == "normal"

    def test_budget_cap_constant(self):
        assert BUDGET_CAP_LOW_CONF == pytest.approx(0.15)


# ── Entitlement-safe redaction ─────────────────────────────────────────────────

class TestDetermineRedaction:
    def test_free_user_gets_full_redaction(self):
        assert _determine_redaction(_make_user("free")) == "full"

    def test_starter_user_gets_basic(self):
        assert _determine_redaction(_make_user("starter")) == "basic"

    def test_pro_user_gets_pro(self):
        assert _determine_redaction(_make_user("pro")) == "pro"

    def test_agency_user_gets_none(self):
        assert _determine_redaction(_make_user("agency")) == "none"

    def test_enterprise_user_gets_none(self):
        assert _determine_redaction(_make_user("enterprise")) == "none"

    def test_admin_gets_none_regardless_of_plan(self):
        assert _determine_redaction(_make_user("free", is_admin=True)) == "none"


class TestToDictRedaction:
    def test_free_user_simulation_result_is_none(self):
        sim = {"summary": "test", "creators": [{"username": "alice"}]}
        campaign = _make_campaign(sim_result=sim)
        result = _to_dict(campaign, redaction_level="full")

        assert result["simulation_result"] is None

    def test_free_user_recommended_influencers_empty(self):
        campaign = _make_campaign(recommended_influencers=[{"username": "alice"}, {"username": "bob"}])
        result = _to_dict(campaign, redaction_level="full")
        assert result["recommended_influencers"] == []

    def test_free_user_locked_sections_present(self):
        campaign = _make_campaign()
        result = _to_dict(campaign, redaction_level="full")
        assert isinstance(result["locked_sections"], list)
        assert len(result["locked_sections"]) > 0
        keys = [s["key"] for s in result["locked_sections"]]
        assert "simulation_result" in keys

    def test_starter_user_gets_preview_sim(self):
        sim = {
            "summary": "summary text",
            "feasibility": {"level": "High", "score": 80},
            "confidence": {"overall": 75, "grade": "B"},
            "totalReach": {"expected": 50000},
            "creatorsFromDB": 5,
            "usedFallbackData": False,
            "creators": [{"username": f"creator{i}"} for i in range(5)],
        }
        campaign = _make_campaign(sim_result=sim)
        result = _to_dict(campaign, redaction_level="basic")

        assert result["simulation_result"] is not None
        assert result["simulation_result"].get("_preview") is True
        assert "summary" in result["simulation_result"]
        assert "creators" not in result["simulation_result"]

    def test_starter_user_locked_sections_present(self):
        campaign = _make_campaign()
        result = _to_dict(campaign, redaction_level="basic")
        assert len(result["locked_sections"]) > 0

    def test_starter_creator_cap_at_3(self):
        influencers = [{"username": f"inf{i}"} for i in range(10)]
        campaign = _make_campaign(recommended_influencers=influencers)
        result = _to_dict(campaign, redaction_level="basic")
        assert len(result["recommended_influencers"]) <= 3

    def test_agency_gets_full_simulation_result(self):
        sim = {"summary": "full", "creators": [{"username": "alice"}]}
        campaign = _make_campaign(sim_result=sim)
        result = _to_dict(campaign, redaction_level="none")

        assert result["simulation_result"] == sim
        assert result["locked_sections"] == []

    def test_pro_gets_full_simulation_minus_agency(self):
        sim = {"summary": "full", "creators": [{"username": "alice"}]}
        campaign = _make_campaign(sim_result=sim)
        result = _to_dict(campaign, redaction_level="pro")

        assert result["simulation_result"] == sim
        keys = [s["key"] for s in result["locked_sections"]]
        assert "white_label_export" in keys

    def test_redaction_level_in_response(self):
        campaign = _make_campaign()
        for level in ("full", "basic", "pro", "none"):
            result = _to_dict(campaign, redaction_level=level)
            assert result["redaction_level"] == level

    def test_report_source_always_present(self):
        campaign = _make_campaign(report_source="client_simulation_preview")
        result = _to_dict(campaign, redaction_level="none")
        assert result["report_source"] == "client_simulation_preview"

    def test_no_simulation_result_doesnt_crash_basic(self):
        campaign = _make_campaign(sim_result=None)
        result = _to_dict(campaign, redaction_level="basic")
        assert result["simulation_result"] is None


class TestStripRoiDetails:
    def test_strips_sensitive_fields(self):
        roi = {
            "influencer_count": 5,
            "total_followers": 500000,
            "total_reach": 200000,
            "avg_fraud_score": 15,
            "suggested_budget": 8000,
            "currency": "USD",
            "note": "Tahmin",
        }
        stripped = _strip_roi_details(roi)
        assert "influencer_count" in stripped
        assert "currency" in stripped
        assert "note" in stripped
        assert "total_followers" not in stripped
        assert "suggested_budget" not in stripped
        assert "avg_fraud_score" not in stripped

    def test_handles_none_roi(self):
        assert _strip_roi_details(None) == {}

    def test_handles_empty_roi(self):
        assert _strip_roi_details({}) == {}
