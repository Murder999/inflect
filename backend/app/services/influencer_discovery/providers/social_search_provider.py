"""
Social Search Provider — Part 24

Instagram/TikTok do not offer unrestricted public search APIs.
This provider is always disabled and returns proper provider_missing status.
It serves as the placeholder for when an approved official API or
third-party data provider is configured in the future.

No fake/mock social data is ever generated.
"""
from __future__ import annotations

import logging

from app.services.influencer_discovery.base import (
    CreatorCandidate,
    DiscoveryQuery,
    InfluencerDiscoveryProvider,
)

logger = logging.getLogger(__name__)

_DISABLED_REASON = (
    "Instagram/TikTok do not provide unrestricted public creator search APIs. "
    "Configure an approved third-party data provider to enable social discovery."
)


class SocialSearchProvider(InfluencerDiscoveryProvider):
    """
    Placeholder for Instagram/TikTok discovery.
    Always returns empty results with an explicit disabled reason.
    Will be activated when an approved social API provider is configured.
    """
    name = "social_search"
    platform = "instagram,tiktok"

    async def is_available(self) -> bool:
        return False

    async def search_creators(
        self,
        query: DiscoveryQuery,
        market: str,
        category: str,
        limit: int = 20,
    ) -> list[CreatorCandidate]:
        logger.info("SocialSearchProvider disabled — no approved Instagram/TikTok search API configured")
        return []

    @property
    def disabled_reason(self) -> str:
        return _DISABLED_REASON
