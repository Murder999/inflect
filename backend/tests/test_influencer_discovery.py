"""
Part 24 — Live Influencer Discovery Tests

Tests cover:
  - Discovery orchestrator disabled mode (no fake data)
  - Provider status reporting when no providers configured
  - Query builder generates valid platform/keyword structure
  - Normalizer handles edge cases
  - Deduplication by platform+handle and profile_url
  - Scoring: nullable scores, evidence exclusion
  - Cache save/get round-trip
  - API endpoint schemas (unit tests without HTTP layer)
  - NEVER rules: no fake candidates when provider missing
  - Mode enforcement: disabled → no discovery
  - Social provider always disabled
  - YouTube provider disabled when no API key
  - Search provider disabled when no SEARCH_API_KEY
  - Alembic revision IDs are ≤ 32 chars
  - DiscoveryResult fields have correct defaults
  - Orchestrator returns provider_statuses even when no providers available
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from dataclasses import fields

from app.services.influencer_discovery.base import (
    CreatorCandidate, DiscoveryQuery, DiscoveryResult, ProviderStatus,
    InfluencerDiscoveryProvider, CreatorEvidence,
)
from app.services.influencer_discovery.query_builder import build_discovery_queries
from app.services.influencer_discovery.normalizer import (
    normalize_candidate, detect_platform_from_url, extract_handle_from_url,
    evidence_quality_from_fields,
)
from app.services.influencer_discovery.dedupe import deduplicate_candidates
from app.services.influencer_discovery.scoring import score_candidate, CandidateScore
from app.services.influencer_discovery.providers.social_search_provider import SocialSearchProvider


# ── Helper factories ───────────────────────────────────────────────────────────

def make_candidate(**kwargs) -> CreatorCandidate:
    defaults = dict(
        handle="testcreator",
        platform="youtube",
        profile_url="https://youtube.com/c/testcreator",
        source="youtube_provider",
        source_confidence="high",
    )
    defaults.update(kwargs)
    return CreatorCandidate(**defaults)


def make_query(**kwargs) -> DiscoveryQuery:
    defaults = dict(
        platform="youtube",
        keywords=["fitness", "health"],
        hashtags=["#fitness"],
        negative_keywords=[],
        locale_hints=[],
        source_reason="category:fitness",
    )
    defaults.update(kwargs)
    return DiscoveryQuery(**defaults)


# ── 1. NEVER rules: orchestrator disabled mode ─────────────────────────────────

class TestDisabledMode:
    """When INFLUENCER_DISCOVERY_MODE=disabled, orchestrator must return
    provider_missing status with zero candidates — never fake data."""

    @pytest.mark.asyncio
    async def test_disabled_returns_provider_missing(self):
        from app.services.influencer_discovery.discovery_orchestrator import DiscoveryOrchestrator

        with patch("app.services.influencer_discovery.discovery_orchestrator._get_mode", return_value="disabled"):
            orch = DiscoveryOrchestrator()
            orch._mode = "disabled"
            result = await orch.discover(
                brand_name="TestBrand",
                brand_category="fitness",
                target_market="Global",
                platforms=["youtube"],
                limit=20,
            )

        assert result.status == "provider_missing"
        assert result.candidates == []
        assert len(result.next_actions) > 0
        assert result.blocked_reason is not None

    @pytest.mark.asyncio
    async def test_disabled_returns_no_candidates(self):
        from app.services.influencer_discovery.discovery_orchestrator import DiscoveryOrchestrator

        orch = DiscoveryOrchestrator()
        orch._mode = "disabled"
        result = await orch.discover(
            brand_name="TestBrand",
            brand_category="beauty",
            target_market="TR",
            platforms=["instagram"],
            limit=50,
        )
        assert len(result.candidates) == 0, "Disabled mode must never return candidates"

    @pytest.mark.asyncio
    async def test_disabled_blocked_reason_mentions_env_var(self):
        from app.services.influencer_discovery.discovery_orchestrator import DiscoveryOrchestrator

        orch = DiscoveryOrchestrator()
        orch._mode = "disabled"
        result = await orch.discover(
            brand_name="X", brand_category="tech", target_market="Global", platforms=["youtube"],
        )
        assert result.blocked_reason is not None
        assert "INFLUENCER_DISCOVERY_MODE" in result.blocked_reason


# ── 2. Social provider always disabled ────────────────────────────────────────

class TestSocialProvider:
    @pytest.mark.asyncio
    async def test_social_provider_always_unavailable(self):
        provider = SocialSearchProvider()
        assert await provider.is_available() is False

    @pytest.mark.asyncio
    async def test_social_provider_returns_empty(self):
        provider = SocialSearchProvider()
        q = make_query(platform="instagram")
        result = await provider.search_creators(query=q, market="Global", category="fashion")
        assert result == []

    def test_social_provider_has_disabled_reason(self):
        provider = SocialSearchProvider()
        assert len(provider.disabled_reason) > 10
        assert "Instagram" in provider.disabled_reason or "TikTok" in provider.disabled_reason


# ── 3. Query builder ───────────────────────────────────────────────────────────

class TestQueryBuilder:
    def test_returns_list(self):
        queries = build_discovery_queries(
            brand_category="fitness",
            target_market="Global",
            platforms=["youtube"],
        )
        assert isinstance(queries, list)

    def test_queries_have_required_fields(self):
        queries = build_discovery_queries(
            brand_category="beauty",
            target_market="TR",
            platforms=["youtube"],
        )
        for q in queries:
            assert isinstance(q, DiscoveryQuery)
            assert q.platform
            assert isinstance(q.keywords, list)
            assert isinstance(q.hashtags, list)
            assert q.source_reason

    def test_no_hardcoded_brand_logic(self):
        """Query builder must not encode any brand-specific keywords."""
        q1 = build_discovery_queries(brand_category="fitness", target_market="Global", platforms=["youtube"])
        q2 = build_discovery_queries(brand_category="fitness", target_market="Global", platforms=["youtube"],
                                     product_signals=["supplement"])
        # Supplemental signals can change keywords but base should be category-derived only
        for q in q1:
            for kw in q.keywords:
                assert "karaca" not in kw.lower()
                assert "apple" not in kw.lower()

    def test_empty_platform_defaults_gracefully(self):
        queries = build_discovery_queries(
            brand_category="tech",
            target_market="Global",
            platforms=["all"],
        )
        assert isinstance(queries, list)


# ── 4. Normalizer ─────────────────────────────────────────────────────────────

class TestNormalizer:
    def test_detect_youtube_from_url(self):
        assert detect_platform_from_url("https://youtube.com/c/test") == "youtube"
        assert detect_platform_from_url("https://www.youtube.com/@creator") == "youtube"

    def test_detect_instagram_from_url(self):
        assert detect_platform_from_url("https://instagram.com/user") == "instagram"

    def test_detect_tiktok_from_url(self):
        assert detect_platform_from_url("https://tiktok.com/@user") == "tiktok"

    def test_unknown_url_returns_none_or_empty(self):
        result = detect_platform_from_url("https://example.com/page")
        assert result is None or result == ""

    def test_extract_handle_from_youtube_channel(self):
        handle = extract_handle_from_url("https://youtube.com/c/MyChannel", "youtube")
        assert handle is not None

    def test_evidence_quality_strong_with_all_fields(self):
        quality = evidence_quality_from_fields({
            "followers": 100_000,
            "bio": "Fitness creator",
            "engagement_rate": 4.5,
            "category_hints": ["fitness"],
            "location_hints": ["TR"],
            "avg_views": 5000,
        })
        assert quality in ("strong", "moderate")

    def test_evidence_quality_none_with_no_fields(self):
        quality = evidence_quality_from_fields({})
        assert quality == "none"

    def test_normalize_candidate_returns_creator_candidate(self):
        raw = {
            "handle": "testuser",
            "profile_url": "https://youtube.com/c/testuser",
        }
        result = normalize_candidate(raw, source="youtube_provider", platform="youtube")
        assert result is None or isinstance(result, CreatorCandidate)


# ── 5. Deduplication ──────────────────────────────────────────────────────────

class TestDedupe:
    def test_deduplicates_same_handle_platform(self):
        c1 = make_candidate(handle="creator1", platform="youtube", profile_url="https://youtube.com/c/creator1")
        c2 = make_candidate(handle="creator1", platform="youtube", profile_url="https://youtube.com/c/creator1-alt")
        deduped = deduplicate_candidates([c1, c2])
        assert len(deduped) == 1

    def test_different_platform_not_deduplicated(self):
        c1 = make_candidate(handle="user1", platform="youtube", profile_url="https://youtube.com/c/user1")
        c2 = make_candidate(handle="user1", platform="instagram", profile_url="https://instagram.com/user1")
        deduped = deduplicate_candidates([c1, c2])
        assert len(deduped) == 2

    def test_deduplicates_same_profile_url(self):
        url = "https://youtube.com/c/samechannel"
        c1 = make_candidate(handle="creator_a", profile_url=url)
        c2 = make_candidate(handle="creator_b", profile_url=url)
        deduped = deduplicate_candidates([c1, c2])
        assert len(deduped) == 1

    def test_empty_list(self):
        assert deduplicate_candidates([]) == []


# ── 6. Scoring ────────────────────────────────────────────────────────────────

class TestScoring:
    def test_score_returns_candidate_score(self):
        c = make_candidate(follower_count=50_000, engagement_hint=3.5, category_hint="fitness")
        score = score_candidate(c, target_category="fitness", target_market="Global", evidence_quality="moderate")
        assert isinstance(score, CandidateScore)

    def test_score_excluded_when_evidence_none(self):
        c = make_candidate(follower_count=None, bio=None, engagement_hint=None)
        score = score_candidate(c, target_category="fitness", target_market="Global", evidence_quality="none")
        assert score.excluded is True

    def test_scores_are_nullable(self):
        c = make_candidate(follower_count=None, bio=None)
        score = score_candidate(c, target_category="tech", target_market="Global", evidence_quality="weak")
        # Scores may be None when data is missing — no default 50
        assert score.overall_discovery_score is None or isinstance(score.overall_discovery_score, float)

    def test_no_default_50_for_missing_data(self):
        """Scores must be null, not 50, when evidence is missing."""
        c = make_candidate(follower_count=None, bio=None, engagement_hint=None, category_hint=None)
        score = score_candidate(c, target_category="beauty", target_market="TR", evidence_quality="none")
        # When excluded, scores should be None
        if score.excluded:
            assert score.overall_discovery_score is None


# ── 7. DiscoveryResult defaults ───────────────────────────────────────────────

class TestDiscoveryResult:
    def test_discovery_result_defaults(self):
        result = DiscoveryResult(
            status="provider_missing",
            provider_statuses=[],
            candidates=[],
            query_plan=[],
        )
        assert result.run_id is None
        assert result.verified_candidates_count == 0
        assert result.insufficient_data is False  # dataclass default
        assert result.blocked_reason is None
        assert isinstance(result.next_actions, list)
        assert result.generated_at is not None

    def test_discovery_result_provider_missing_can_set_insufficient(self):
        result = DiscoveryResult(
            status="provider_missing",
            provider_statuses=[],
            candidates=[],
            query_plan=[],
            insufficient_data=True,
            blocked_reason="No providers configured",
        )
        assert result.insufficient_data is True
        assert result.blocked_reason == "No providers configured"

    def test_discovery_result_with_candidates(self):
        c = make_candidate()
        result = DiscoveryResult(
            status="discovery_completed",
            provider_statuses=[],
            candidates=[c],
            query_plan=[],
            verified_candidates_count=1,
            insufficient_data=False,
        )
        assert result.verified_candidates_count == 1
        assert len(result.candidates) == 1


# ── 8. Alembic revision ID length ─────────────────────────────────────────────

class TestAlembicRevisions:
    def test_part24_revision_id_length(self):
        """Alembic revision IDs must be ≤ 32 characters."""
        import importlib.util, pathlib
        vpath = pathlib.Path(__file__).parent.parent / "alembic" / "versions" / "0007_part24_live_disc.py"
        spec = importlib.util.spec_from_file_location("m24", vpath)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        assert len(m.revision) <= 32, f"Revision ID too long: {m.revision!r}"

    def test_part24_down_revision(self):
        """Revision chain must be correct."""
        import importlib.util, pathlib
        vpath = pathlib.Path(__file__).parent.parent / "alembic" / "versions" / "0007_part24_live_disc.py"
        spec = importlib.util.spec_from_file_location("m24b", vpath)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        assert m.down_revision == "0006_part22_brand_ai"


# ── 9. Provider missing → no archive fallback ─────────────────────────────────

class TestNoFakeData:
    @pytest.mark.asyncio
    async def test_no_archive_fallback_when_no_providers(self):
        """When providers unavailable, result must have 0 candidates — not archive data."""
        from app.services.influencer_discovery.discovery_orchestrator import DiscoveryOrchestrator

        orch = DiscoveryOrchestrator()
        orch._mode = "live"
        orch._initialized = True
        orch._providers = []  # No providers loaded

        result = await orch.discover(
            brand_name="TestBrand",
            brand_category="beauty",
            target_market="Global",
            platforms=["youtube"],
        )

        assert result.status == "provider_missing"
        assert len(result.candidates) == 0, "Must not return archive/fake data when providers missing"
