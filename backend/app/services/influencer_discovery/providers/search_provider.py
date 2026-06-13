"""
Search-Based Creator Discovery Provider — Part 24

Discovers creator profiles through web search APIs.
Supports: Google Custom Search API, SerpAPI (configured via env).
Returns empty list (not fake data) when provider not configured.

Env vars:
  SEARCH_PROVIDER=google_custom_search|serpapi|none
  SEARCH_API_KEY=...
  GOOGLE_SEARCH_CX=...  (for Google Custom Search)
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.services.influencer_discovery.base import (
    CreatorCandidate,
    DiscoveryQuery,
    InfluencerDiscoveryProvider,
)
from app.services.influencer_discovery.normalizer import (
    detect_platform_from_url,
    extract_handle_from_url,
)

logger = logging.getLogger(__name__)

_TIMEOUT = 10.0
_MAX_RESULTS = 10

# Profile URL patterns for scoring search results
_PROFILE_INDICATORS = [
    r"youtube\.com/(channel|c|user|@)",
    r"instagram\.com/[\w.]+/?$",
    r"tiktok\.com/@[\w.]+/?$",
]


class SearchDiscoveryProvider(InfluencerDiscoveryProvider):
    """
    Web search-based creator discovery.
    Finds creator profile pages via search engine results.
    Search results alone give low confidence; enrichment is needed for high confidence.
    """
    name = "web_search"
    platform = "all"  # discovers across platforms

    def __init__(self) -> None:
        self._provider: str = getattr(settings, "SEARCH_PROVIDER", "none")
        self._api_key: Optional[str] = getattr(settings, "SEARCH_API_KEY", None)
        self._cx: Optional[str] = getattr(settings, "GOOGLE_SEARCH_CX", None)

        if self._provider == "none" or not self._api_key:
            logger.info("SearchDiscoveryProvider: provider=%s key=%s — disabled",
                        self._provider, "set" if self._api_key else "missing")

    async def is_available(self) -> bool:
        return self._provider != "none" and bool(self._api_key)

    async def search_creators(
        self,
        query: DiscoveryQuery,
        market: str,
        category: str,
        limit: int = 20,
    ) -> list[CreatorCandidate]:
        if not await self.is_available():
            logger.info("Search provider disabled")
            return []

        search_term = self._build_search_term(query)

        if self._provider == "google_custom_search":
            raw_results = await self._google_search(search_term, min(limit, _MAX_RESULTS))
        elif self._provider == "serpapi":
            raw_results = await self._serpapi_search(search_term, min(limit, _MAX_RESULTS))
        else:
            logger.warning("Unknown SEARCH_PROVIDER=%s", self._provider)
            return []

        candidates = []
        for item in raw_results:
            candidate = self._parse_result(item, category, market)
            if candidate:
                candidates.append(candidate)

        logger.info("Search provider found %d candidates for '%s'", len(candidates), search_term[:60])
        return candidates

    def _build_search_term(self, query: DiscoveryQuery) -> str:
        base = " ".join(query.keywords[:3])
        locale = query.locale_hints[0] if query.locale_hints else ""
        terms = [locale, base, "site:youtube.com OR site:instagram.com OR site:tiktok.com"]
        return " ".join(t for t in terms if t)

    def _parse_result(
        self,
        item: dict,
        category: str,
        market: str,
    ) -> Optional[CreatorCandidate]:
        url = item.get("link") or item.get("url", "")
        if not url:
            return None

        platform = detect_platform_from_url(url)
        if not platform:
            return None

        handle = extract_handle_from_url(url, platform)
        if not handle:
            return None

        snippet = item.get("snippet") or item.get("description") or ""
        title = item.get("title") or ""

        # Extract follower hint from snippet (e.g. "1.2M subscribers")
        follower_hint = _parse_follower_hint(snippet or title)

        # Confidence is low for search results — enrichment needed
        confidence = "medium" if follower_hint else "low"

        return CreatorCandidate(
            handle=handle,
            display_name=_clean_title(title, platform),
            platform=platform,
            profile_url=url,
            bio=snippet[:300] if snippet else None,
            follower_count=follower_hint,
            engagement_hint=None,
            category_hint=category or None,
            location_hint=market or None,
            source=f"{self._provider}",
            source_confidence=confidence,
            raw=item,
        )

    async def _google_search(self, query: str, num: int) -> list[dict]:
        if not self._cx:
            logger.warning("GOOGLE_SEARCH_CX not set — Google Custom Search disabled")
            return []
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    "https://customsearch.googleapis.com/customsearch/v1",
                    params={"key": self._api_key, "cx": self._cx, "q": query, "num": num},
                )
                if resp.status_code != 200:
                    logger.warning("Google Custom Search error %d", resp.status_code)
                    return []
                return resp.json().get("items", [])
        except httpx.TimeoutException:
            logger.warning("Google Custom Search timeout")
            return []
        except Exception as exc:
            logger.error("Google Custom Search error: %s", exc)
            return []

    async def _serpapi_search(self, query: str, num: int) -> list[dict]:
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    "https://serpapi.com/search.json",
                    params={"engine": "google", "q": query, "num": num, "api_key": self._api_key},
                )
                if resp.status_code != 200:
                    logger.warning("SerpAPI error %d", resp.status_code)
                    return []
                data = resp.json()
                # Convert SerpAPI format to common format
                return [
                    {
                        "link": r.get("link"),
                        "title": r.get("title"),
                        "snippet": r.get("snippet"),
                    }
                    for r in data.get("organic_results", [])
                ]
        except httpx.TimeoutException:
            logger.warning("SerpAPI timeout")
            return []
        except Exception as exc:
            logger.error("SerpAPI error: %s", exc)
            return []


def _parse_follower_hint(text: str) -> Optional[int]:
    """Extract follower/subscriber count from text like '1.2M subscribers'."""
    if not text:
        return None
    m = re.search(r"([\d,.]+)\s*([KkMmBb])?\s*(?:subscribers?|followers?|takipçi)", text, re.I)
    if not m:
        return None
    try:
        num = float(m.group(1).replace(",", ""))
        suffix = (m.group(2) or "").upper()
        if suffix == "K":
            return int(num * 1_000)
        if suffix == "M":
            return int(num * 1_000_000)
        if suffix == "B":
            return int(num * 1_000_000_000)
        return int(num)
    except (ValueError, TypeError):
        return None


def _clean_title(title: str, platform: str) -> Optional[str]:
    if not title:
        return None
    # Remove platform suffix noise
    for suffix in [" - YouTube", " (@", " • Instagram", " | TikTok"]:
        if suffix in title:
            title = title.split(suffix)[0]
    return title.strip() or None
