"""
Creator candidate deduplication — Part 24

Identifies duplicate candidates from multiple providers.
Merges sources and evidence when duplicates are found.
Deduplication key: normalized platform + handle (or canonical profile_url).
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from app.services.influencer_discovery.base import CreatorCandidate

logger = logging.getLogger(__name__)


def _normalize_handle(handle: str, platform: str) -> str:
    h = handle.lower().strip().lstrip("@")
    # Remove trailing slashes/query strings
    h = re.split(r"[/?#]", h)[0]
    return f"{platform}::{h}"


def _normalize_url(url: str) -> str:
    url = url.lower().rstrip("/")
    # Remove tracking params
    url = re.split(r"\?", url)[0]
    return url


def deduplicate_candidates(
    candidates: list[CreatorCandidate],
) -> list[CreatorCandidate]:
    """
    Deduplicate a list of CreatorCandidate objects.

    Priority when merging:
    - Use the candidate with the most data as the base
    - Accumulate all source names
    - Upgrade confidence if any source has higher confidence
    """
    seen: dict[str, CreatorCandidate] = {}
    url_seen: dict[str, str] = {}  # normalized_url -> dedup_key

    for c in candidates:
        key = _normalize_handle(c.handle, c.platform)
        url_key = _normalize_url(c.profile_url)

        # Check if this URL was seen under a different handle key
        if url_key in url_seen:
            key = url_seen[url_key]
        else:
            url_seen[url_key] = key

        if key in seen:
            existing = seen[key]
            seen[key] = _merge(existing, c)
            logger.debug("Merged duplicate: %s (sources: %s + %s)", key, existing.source, c.source)
        else:
            seen[key] = c

    result = list(seen.values())
    if len(candidates) != len(result):
        logger.info("Deduped %d → %d candidates", len(candidates), len(result))
    return result


def _merge(base: CreatorCandidate, duplicate: CreatorCandidate) -> CreatorCandidate:
    """Merge duplicate into base, preferring richer data."""
    merged_source = _merge_sources(base.source, duplicate.source)
    merged_confidence = _best_confidence(base.source_confidence, duplicate.source_confidence)

    return CreatorCandidate(
        handle=base.handle,
        display_name=base.display_name or duplicate.display_name,
        platform=base.platform,
        profile_url=base.profile_url,
        bio=_longer(base.bio, duplicate.bio),
        avatar_url=base.avatar_url or duplicate.avatar_url,
        follower_count=base.follower_count or duplicate.follower_count,
        engagement_hint=base.engagement_hint or duplicate.engagement_hint,
        category_hint=base.category_hint or duplicate.category_hint,
        location_hint=base.location_hint or duplicate.location_hint,
        source=merged_source,
        source_confidence=merged_confidence,
        raw={**duplicate.raw, **base.raw},  # base takes precedence
    )


def _merge_sources(a: str, b: str) -> str:
    sources_a = set(a.split(","))
    sources_b = set(b.split(","))
    return ",".join(sorted(sources_a | sources_b))


def _best_confidence(a: str, b: str) -> str:
    _RANK = {"high": 2, "medium": 1, "low": 0}
    return a if _RANK.get(a, 0) >= _RANK.get(b, 0) else b


def _longer(a: Optional[str], b: Optional[str]) -> Optional[str]:
    if a and b:
        return a if len(a) >= len(b) else b
    return a or b
