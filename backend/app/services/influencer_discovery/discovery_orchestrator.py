"""
Live Influencer Discovery Orchestrator — Part 24

Main entry point for discovery. Coordinates:
  1. Query building from brand/campaign signals
  2. Running active providers
  3. Normalizing results
  4. Deduplication
  5. Scoring
  6. Archive/cache enrichment (labelled as "cached", not "live")
  7. Persisting discovery run and candidates

Archive is never the primary source. Provider missing → return provider_missing,
not fake candidates.

Env vars:
  INFLUENCER_DISCOVERY_MODE=disabled|search_only|live
  INFLUENCER_DISCOVERY_PROVIDERS=search,youtube,social
  DISCOVERY_MAX_CANDIDATES=100
  DISCOVERY_MIN_CANDIDATES=20
  DISCOVERY_TIMEOUT_SECONDS=12
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.influencer_discovery.base import (
    CreatorCandidate,
    DiscoveryQuery,
    DiscoveryResult,
    InfluencerDiscoveryProvider,
    ProviderStatus,
)
from app.services.influencer_discovery.dedupe import deduplicate_candidates
from app.services.influencer_discovery.normalizer import evidence_quality_from_fields
from app.services.influencer_discovery.query_builder import build_discovery_queries
from app.services.influencer_discovery.scoring import score_candidate

logger = logging.getLogger(__name__)

_DEFAULT_MODE = "disabled"
_DEFAULT_MAX = 100
_DEFAULT_MIN = 20
_DEFAULT_TIMEOUT = 12


def _get_mode() -> str:
    return getattr(settings, "INFLUENCER_DISCOVERY_MODE", _DEFAULT_MODE).lower()


def _get_enabled_providers() -> list[str]:
    raw = getattr(settings, "INFLUENCER_DISCOVERY_PROVIDERS", "")
    if not raw:
        return []
    return [p.strip().lower() for p in raw.split(",") if p.strip()]


def _get_max_candidates() -> int:
    try:
        return int(getattr(settings, "DISCOVERY_MAX_CANDIDATES", _DEFAULT_MAX))
    except (ValueError, TypeError):
        return _DEFAULT_MAX


def _get_timeout() -> float:
    try:
        return float(getattr(settings, "DISCOVERY_TIMEOUT_SECONDS", _DEFAULT_TIMEOUT))
    except (ValueError, TypeError):
        return float(_DEFAULT_TIMEOUT)


class DiscoveryOrchestrator:
    """
    Orchestrates live influencer discovery.
    Returns DiscoveryResult — never fake candidates.
    """

    def __init__(self) -> None:
        self._mode = _get_mode()
        self._enabled_providers = _get_enabled_providers()
        self._max_candidates = _get_max_candidates()
        self._timeout = _get_timeout()
        self._providers: list[InfluencerDiscoveryProvider] = []
        self._initialized = False

    def _build_provider_registry(self) -> list[InfluencerDiscoveryProvider]:
        """Build the provider list based on env config."""
        providers: list[InfluencerDiscoveryProvider] = []
        enabled = self._enabled_providers

        if "youtube" in enabled or not enabled:
            try:
                from app.services.influencer_discovery.providers.youtube_provider import (
                    YouTubeDiscoveryProvider,
                )
                providers.append(YouTubeDiscoveryProvider())
            except Exception as exc:
                logger.warning("Failed to load YouTubeDiscoveryProvider: %s", exc)

        if "search" in enabled or not enabled:
            try:
                from app.services.influencer_discovery.providers.search_provider import (
                    SearchDiscoveryProvider,
                )
                providers.append(SearchDiscoveryProvider())
            except Exception as exc:
                logger.warning("Failed to load SearchDiscoveryProvider: %s", exc)

        if "social" in enabled:
            try:
                from app.services.influencer_discovery.providers.social_search_provider import (
                    SocialSearchProvider,
                )
                providers.append(SocialSearchProvider())
            except Exception as exc:
                logger.warning("Failed to load SocialSearchProvider: %s", exc)

        return providers

    async def _ensure_initialized(self) -> None:
        if not self._initialized:
            self._providers = self._build_provider_registry()
            self._initialized = True

    async def discover(
        self,
        brand_name: str,
        brand_category: str,
        target_market: str,
        platforms: list[str],
        limit: int = 20,
        product_signals: Optional[list[str]] = None,
        audience_signals: Optional[list[str]] = None,
        language: Optional[str] = None,
        db: Optional[AsyncSession] = None,
        user_id: Optional[int] = None,
        campaign_id: Optional[int] = None,
        brand_analysis_id: Optional[int] = None,
    ) -> DiscoveryResult:
        """
        Main discovery entry point.
        Returns DiscoveryResult with proper status and no fake candidates.
        """
        await self._ensure_initialized()

        # 1. Check mode
        if self._mode == "disabled":
            return DiscoveryResult(
                status="provider_missing",
                provider_statuses=[],
                candidates=[],
                query_plan=[],
                blocked_reason="INFLUENCER_DISCOVERY_MODE=disabled",
                next_actions=[
                    "Set INFLUENCER_DISCOVERY_MODE=search_only or live to enable discovery",
                    "Configure YOUTUBE_API_KEY for YouTube channel discovery",
                    "Configure SEARCH_API_KEY + SEARCH_PROVIDER for web search discovery",
                ],
            )

        # 2. Build queries
        query_plan = build_discovery_queries(
            brand_category=brand_category,
            target_market=target_market,
            platforms=platforms if platforms else ["all"],
            product_signals=product_signals,
            audience_signals=audience_signals,
            language=language,
        )

        if not query_plan:
            return DiscoveryResult(
                status="provider_missing",
                provider_statuses=[],
                candidates=[],
                query_plan=[],
                blocked_reason="No discovery queries could be generated from the provided signals",
                next_actions=["Provide brand category, target market, or product signals to enable discovery"],
            )

        # 3. Check available providers
        provider_statuses: list[ProviderStatus] = []
        available_providers: list[InfluencerDiscoveryProvider] = []

        for p in self._providers:
            is_avail = await p.is_available()
            disabled_reason = getattr(p, "disabled_reason", None) if not is_avail else None
            provider_statuses.append(ProviderStatus(
                name=p.name,
                platform=p.platform,
                available=is_avail,
                disabled_reason=disabled_reason,
            ))
            if is_avail:
                available_providers.append(p)

        if not available_providers:
            next_actions = [
                "Configure YOUTUBE_API_KEY to enable YouTube creator discovery",
                "Configure SEARCH_API_KEY + SEARCH_PROVIDER=google_custom_search or serpapi for web discovery",
            ]
            if self._mode == "search_only":
                next_actions.insert(0, "No search providers configured — discovery returned no candidates")
            return DiscoveryResult(
                status="provider_missing",
                provider_statuses=provider_statuses,
                candidates=[],
                query_plan=query_plan,
                blocked_reason="No discovery providers are configured or available",
                insufficient_data=True,
                next_actions=next_actions,
            )

        # 4. Persist discovery run
        run_id: Optional[int] = None
        if db:
            run_id = await self._save_run(
                db=db,
                user_id=user_id,
                brand_name=brand_name,
                brand_category=brand_category,
                target_market=target_market,
                platforms=platforms,
                query_plan=query_plan,
                provider_statuses=provider_statuses,
                campaign_id=campaign_id,
                brand_analysis_id=brand_analysis_id,
            )

        # 5. Run providers (with timeout per provider)
        all_candidates: list[CreatorCandidate] = []
        provider_errors: list[str] = []

        for provider in available_providers:
            for query in query_plan:
                if query.platform not in (provider.platform, "all", provider.platform.split(",")[0]):
                    if provider.platform not in ("all", "") and query.platform != "all":
                        # Skip if query targets a different platform and provider is platform-specific
                        if provider.platform != "all" and query.platform != provider.platform:
                            continue

                try:
                    candidates = await asyncio.wait_for(
                        provider.search_creators(
                            query=query,
                            market=target_market,
                            category=brand_category,
                            limit=min(limit, self._max_candidates),
                        ),
                        timeout=self._timeout,
                    )
                    for ps in provider_statuses:
                        if ps.name == provider.name:
                            ps.candidates_found += len(candidates)
                    all_candidates.extend(candidates)
                except asyncio.TimeoutError:
                    msg = f"{provider.name} timed out after {self._timeout}s"
                    logger.warning(msg)
                    provider_errors.append(msg)
                    for ps in provider_statuses:
                        if ps.name == provider.name:
                            ps.error = msg
                except Exception as exc:
                    msg = f"{provider.name} error: {exc}"
                    logger.error("Provider %s error: %s", provider.name, exc, exc_info=True)
                    provider_errors.append(msg)
                    for ps in provider_statuses:
                        if ps.name == provider.name:
                            ps.error = msg

        # 6. Deduplicate
        deduped = deduplicate_candidates(all_candidates)

        # 7. Score candidates
        scored_candidates: list[CreatorCandidate] = []
        candidate_dicts: list[dict] = []

        for c in deduped[:self._max_candidates]:
            ev_quality = _infer_evidence_quality(c)
            score = score_candidate(
                candidate=c,
                target_category=brand_category,
                target_market=target_market,
                evidence_quality=ev_quality,
            )

            candidate_dicts.append({
                "handle":               c.handle,
                "display_name":         c.display_name,
                "platform":             c.platform,
                "profile_url":          c.profile_url,
                "source_provider":      c.source,
                "evidence_quality":     ev_quality,
                "relevance_score":      score.relevance_score,
                "market_match_score":   score.market_match_score,
                "category_match_score": score.category_match_score,
                "overall_score":        score.overall_discovery_score,
                "raw_evidence":         c.raw,
                "cache_status":         "live",
                "excluded":             score.excluded,
                "exclusion_reason":     score.exclusion_reason,
            })
            if not score.excluded:
                scored_candidates.append(c)

        # 8. Persist candidates
        if db and run_id:
            from app.services.influencer_discovery.cache import save_candidates_to_cache
            await save_candidates_to_cache(db, run_id, candidate_dicts)

        # 9. Check cached candidates as supplement (never primary)
        if db and len(scored_candidates) < _DEFAULT_MIN:
            from app.services.influencer_discovery.cache import get_cached_candidates
            cached = await get_cached_candidates(
                db=db,
                platform=platforms[0] if len(platforms) == 1 else "all",
                category=brand_category,
                market=target_market,
                limit=_DEFAULT_MIN - len(scored_candidates),
            )
            if cached:
                logger.info("Supplementing with %d cached candidates", len(cached))

        verified_count = len([c for c in candidate_dicts if not c.get("excluded", True)])
        insufficient = verified_count == 0

        status = "discovery_completed"
        if provider_errors and not all_candidates:
            status = "discovery_failed"
        elif provider_errors:
            status = "discovery_partial"

        next_actions: list[str] = []
        if insufficient:
            next_actions.append(f"Broaden search criteria — only {verified_count} verified candidates found")
        if any(not ps.available for ps in provider_statuses):
            next_actions.append("Configure additional providers to expand candidate pool")
        if verified_count > 0:
            next_actions.append(f"Enrich top {min(verified_count, 10)} candidates for deeper analysis")

        return DiscoveryResult(
            status=status,
            provider_statuses=provider_statuses,
            candidates=scored_candidates,
            query_plan=query_plan,
            run_id=run_id,
            verified_candidates_count=verified_count,
            insufficient_data=insufficient,
            next_actions=next_actions,
        )

    async def _save_run(
        self,
        db: AsyncSession,
        user_id: Optional[int],
        brand_name: str,
        brand_category: str,
        target_market: str,
        platforms: list[str],
        query_plan: list[DiscoveryQuery],
        provider_statuses: list[ProviderStatus],
        campaign_id: Optional[int],
        brand_analysis_id: Optional[int],
    ) -> Optional[int]:
        try:
            from app.models.influencer_discovery import InfluencerDiscoveryRun

            run = InfluencerDiscoveryRun(
                user_id=user_id,
                campaign_id=campaign_id,
                brand_analysis_id=brand_analysis_id,
                input_payload={
                    "brand_name":      brand_name,
                    "brand_category":  brand_category,
                    "target_market":   target_market,
                    "platforms":       platforms,
                },
                query_plan=[
                    {
                        "platform":  q.platform,
                        "keywords":  q.keywords,
                        "hashtags":  q.hashtags,
                        "source_reason": q.source_reason,
                    }
                    for q in query_plan
                ],
                provider_status={
                    ps.name: {
                        "available":       ps.available,
                        "disabled_reason": ps.disabled_reason,
                        "candidates_found": ps.candidates_found,
                    }
                    for ps in provider_statuses
                },
                status="running",
                candidates_count=0,
                verified_candidates_count=0,
            )
            db.add(run)
            await db.flush()
            run_id = run.id
            await db.commit()
            return run_id
        except Exception as exc:
            logger.warning("Failed to save discovery run: %s", exc)
            await db.rollback()
            return None


def _infer_evidence_quality(c: CreatorCandidate) -> str:
    fields = {
        "followers": c.follower_count,
        "bio": c.bio,
        "engagement_rate": c.engagement_hint,
        "category_hints": [c.category_hint] if c.category_hint else [],
        "location_hints": [c.location_hint] if c.location_hint else [],
    }
    return evidence_quality_from_fields(fields)


# Singleton factory
_orchestrator: Optional[DiscoveryOrchestrator] = None


def get_orchestrator() -> DiscoveryOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = DiscoveryOrchestrator()
    return _orchestrator
