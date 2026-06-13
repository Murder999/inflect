"""
Provider abstraction for live influencer discovery.

All providers must implement InfluencerDiscoveryProvider.
No fake/mock data is ever generated — missing providers return proper status.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class DiscoveryQuery:
    platform: str
    keywords: list[str]
    hashtags: list[str]
    negative_keywords: list[str]
    locale_hints: list[str]
    source_reason: str  # explains why this query was generated


@dataclass
class CreatorCandidate:
    handle: str
    platform: str
    profile_url: str
    source: str           # provider name
    source_confidence: str  # "high" | "medium" | "low"
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    follower_count: Optional[int] = None
    engagement_hint: Optional[float] = None
    category_hint: Optional[str] = None
    location_hint: Optional[str] = None
    raw: dict = field(default_factory=dict)


@dataclass
class CreatorEvidence:
    profile_url: str
    platform: str
    fetched_at: datetime
    evidence_quality: str   # "strong" | "moderate" | "weak" | "none"
    bio: Optional[str] = None
    followers: Optional[int] = None
    following: Optional[int] = None
    posts_or_videos: Optional[int] = None
    avg_views: Optional[float] = None
    avg_likes: Optional[float] = None
    avg_comments: Optional[float] = None
    engagement_rate: Optional[float] = None
    recent_content_signals: list[str] = field(default_factory=list)
    audience_hints: list[str] = field(default_factory=list)
    location_hints: list[str] = field(default_factory=list)
    category_hints: list[str] = field(default_factory=list)
    external_links: list[str] = field(default_factory=list)


@dataclass
class ProviderStatus:
    name: str
    platform: str
    available: bool
    disabled_reason: Optional[str] = None
    error: Optional[str] = None
    candidates_found: int = 0


@dataclass
class DiscoveryResult:
    """Result returned by the discovery orchestrator."""
    status: str                           # provider_missing | discovery_running | discovery_completed | discovery_partial | discovery_failed
    provider_statuses: list[ProviderStatus]
    candidates: list[CreatorCandidate]
    query_plan: list[DiscoveryQuery]
    run_id: Optional[int] = None
    verified_candidates_count: int = 0
    insufficient_data: bool = False
    blocked_reason: Optional[str] = None
    next_actions: list[str] = field(default_factory=list)
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class InfluencerDiscoveryProvider(ABC):
    """
    Abstract base for all discovery providers.
    Every concrete provider must implement search_creators().
    enrich_creator() is optional — providers that support it override it.
    """
    name: str
    platform: str

    @abstractmethod
    async def search_creators(
        self,
        query: DiscoveryQuery,
        market: str,
        category: str,
        limit: int = 20,
    ) -> list[CreatorCandidate]:
        """
        Search for creator candidates matching the query.
        Returns empty list (not fake data) if no results found.
        """
        ...

    async def enrich_creator(self, candidate: CreatorCandidate) -> CreatorEvidence:
        """
        Fetch detailed evidence for a candidate.
        Returns evidence_quality="none" if enrichment fails.
        """
        return CreatorEvidence(
            profile_url=candidate.profile_url,
            platform=candidate.platform,
            fetched_at=datetime.now(timezone.utc),
            evidence_quality="none",
        )

    async def is_available(self) -> bool:
        """Returns True if the provider has valid credentials and can operate."""
        return True
