"""
YouTube Discovery Provider — Part 24

Uses YouTube Data API v3 to discover creator channels.
Requires YOUTUBE_API_KEY environment variable.
Gracefully disabled (not faked) when API key is absent.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.core.config import settings
from app.services.influencer_discovery.base import (
    CreatorCandidate,
    CreatorEvidence,
    DiscoveryQuery,
    InfluencerDiscoveryProvider,
)
from app.services.influencer_discovery.normalizer import evidence_quality_from_fields

logger = logging.getLogger(__name__)

_YT_API_BASE = "https://www.googleapis.com/youtube/v3"
_TIMEOUT = 10.0
_MAX_RESULTS = 25


class YouTubeDiscoveryProvider(InfluencerDiscoveryProvider):
    """
    YouTube Data API v3 provider.
    Searches channels by keyword and enriches with subscriber/view stats.
    Disabled when YOUTUBE_API_KEY is not configured.
    """
    name = "youtube"
    platform = "youtube"

    def __init__(self) -> None:
        self._api_key: Optional[str] = getattr(settings, "YOUTUBE_API_KEY", None)
        if not self._api_key:
            logger.info("YouTubeDiscoveryProvider: YOUTUBE_API_KEY not set — provider disabled")

    async def is_available(self) -> bool:
        return bool(self._api_key)

    async def search_creators(
        self,
        query: DiscoveryQuery,
        market: str,
        category: str,
        limit: int = 20,
    ) -> list[CreatorCandidate]:
        if not self._api_key:
            logger.info("YouTube provider disabled — no API key")
            return []

        search_term = " ".join(query.keywords[:3])
        if query.locale_hints:
            search_term = f"{query.locale_hints[0]} {search_term}"

        params = {
            "part": "snippet",
            "type": "channel",
            "q": search_term,
            "maxResults": min(limit, _MAX_RESULTS),
            "key": self._api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(f"{_YT_API_BASE}/search", params=params)
                if resp.status_code != 200:
                    logger.warning("YouTube search API error %d: %s", resp.status_code, resp.text[:200])
                    return []

                data = resp.json()
                items = data.get("items", [])
                candidates: list[CreatorCandidate] = []

                channel_ids = [
                    item["snippet"].get("channelId") or item["id"].get("channelId", "")
                    for item in items
                    if item.get("id", {}).get("kind") == "youtube#channel"
                    or item.get("snippet", {}).get("channelId")
                ]

                # Batch enrich with channel statistics
                stats_map = await self._fetch_channel_stats(channel_ids[:limit])

                for item in items:
                    snippet = item.get("snippet", {})
                    channel_id = (
                        item.get("id", {}).get("channelId")
                        or snippet.get("channelId", "")
                    )
                    if not channel_id:
                        continue

                    stats = stats_map.get(channel_id, {})
                    subscribers = stats.get("subscriberCount")
                    view_count = stats.get("viewCount")

                    handle = snippet.get("customUrl") or channel_id
                    profile_url = f"https://www.youtube.com/@{handle.lstrip('@')}" if handle else f"https://www.youtube.com/channel/{channel_id}"
                    display_name = snippet.get("title", "")
                    bio = snippet.get("description", "")

                    candidates.append(CreatorCandidate(
                        handle=handle.lstrip("@"),
                        display_name=display_name,
                        platform="youtube",
                        profile_url=profile_url,
                        bio=bio[:500] if bio else None,
                        avatar_url=(snippet.get("thumbnails", {}).get("default", {}) or {}).get("url"),
                        follower_count=int(subscribers) if subscribers else None,
                        engagement_hint=None,  # requires video-level data
                        category_hint=category or None,
                        location_hint=snippet.get("country") or market or None,
                        source="youtube_api",
                        source_confidence="high" if subscribers else "medium",
                        raw={
                            "channel_id": channel_id,
                            "subscriber_count": subscribers,
                            "view_count": view_count,
                            "video_count": stats.get("videoCount"),
                            "description": bio,
                        },
                    ))

                logger.info("YouTube provider found %d candidates for query '%s'", len(candidates), search_term)
                return candidates

        except httpx.TimeoutException:
            logger.warning("YouTube search timed out for query: %s", search_term)
            return []
        except Exception as exc:
            logger.error("YouTube provider error: %s", exc, exc_info=True)
            return []

    async def enrich_creator(self, candidate: CreatorCandidate) -> CreatorEvidence:
        if not self._api_key:
            return CreatorEvidence(
                profile_url=candidate.profile_url,
                platform="youtube",
                fetched_at=datetime.now(timezone.utc),
                evidence_quality="none",
            )

        channel_id = candidate.raw.get("channel_id", "")
        if not channel_id:
            return CreatorEvidence(
                profile_url=candidate.profile_url,
                platform="youtube",
                fetched_at=datetime.now(timezone.utc),
                evidence_quality="none",
            )

        stats_map = await self._fetch_channel_stats([channel_id])
        stats = stats_map.get(channel_id, {})

        fields = {
            "followers":     int(stats["subscriberCount"]) if stats.get("subscriberCount") else None,
            "posts_or_videos": int(stats["videoCount"]) if stats.get("videoCount") else None,
            "bio":           candidate.bio,
            "category_hints": [candidate.category_hint] if candidate.category_hint else [],
            "location_hints": [candidate.location_hint] if candidate.location_hint else [],
        }

        quality = evidence_quality_from_fields({**fields, "avg_views": stats.get("viewCount")})

        return CreatorEvidence(
            profile_url=candidate.profile_url,
            platform="youtube",
            bio=candidate.bio,
            followers=fields["followers"],
            posts_or_videos=fields["posts_or_videos"],
            category_hints=fields["category_hints"],
            location_hints=fields["location_hints"],
            fetched_at=datetime.now(timezone.utc),
            evidence_quality=quality,
        )

    async def _fetch_channel_stats(self, channel_ids: list[str]) -> dict[str, dict]:
        if not channel_ids or not self._api_key:
            return {}
        ids_param = ",".join(channel_ids[:50])
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    f"{_YT_API_BASE}/channels",
                    params={"part": "statistics,snippet", "id": ids_param, "key": self._api_key},
                )
                if resp.status_code != 200:
                    return {}
                items = resp.json().get("items", [])
                return {
                    item["id"]: item.get("statistics", {})
                    for item in items
                }
        except Exception as exc:
            logger.warning("YouTube channel stats fetch failed: %s", exc)
            return {}
