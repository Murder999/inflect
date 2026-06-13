"""
Creator candidate normalizer — Part 24

Parses raw provider results into typed CreatorCandidate objects.
Handles profile URL parsing, platform detection, and handle extraction.
"""
from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urlparse

from app.services.influencer_discovery.base import CreatorCandidate

logger = logging.getLogger(__name__)

# Platform URL patterns
_PLATFORM_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("youtube",   re.compile(r"youtube\.com/(channel|c|user|@)([\w\-]+)", re.I)),
    ("youtube",   re.compile(r"youtu\.be/([\w\-]+)", re.I)),
    ("instagram", re.compile(r"instagram\.com/([\w.]+)/?", re.I)),
    ("tiktok",    re.compile(r"tiktok\.com/@([\w.]+)/?", re.I)),
    ("twitter",   re.compile(r"(?:twitter|x)\.com/([\w_]+)/?", re.I)),
]

_YOUTUBE_CHANNEL_RE = re.compile(r"youtube\.com/(?:channel/|c/|user/|@)([\w\-@]+)", re.I)


def detect_platform_from_url(url: str) -> Optional[str]:
    """Return platform name from profile URL, or None if unrecognized."""
    for platform, pattern in _PLATFORM_PATTERNS:
        if pattern.search(url):
            return platform
    if "youtube.com" in url:
        return "youtube"
    if "instagram.com" in url:
        return "instagram"
    if "tiktok.com" in url:
        return "tiktok"
    return None


def extract_handle_from_url(url: str, platform: str) -> Optional[str]:
    """Extract username/handle from a platform profile URL."""
    try:
        if platform == "youtube":
            m = _YOUTUBE_CHANNEL_RE.search(url)
            if m:
                return m.group(1).lstrip("@")
        if platform == "instagram":
            m = re.search(r"instagram\.com/([\w.]+)/?(?:\?|$)", url, re.I)
            if m:
                return m.group(1)
        if platform == "tiktok":
            m = re.search(r"tiktok\.com/@([\w.]+)/?(?:\?|$)", url, re.I)
            if m:
                return m.group(1)
        # Generic: last path segment
        path = urlparse(url).path.rstrip("/")
        if path:
            return path.split("/")[-1].lstrip("@")
    except Exception:
        pass
    return None


def normalize_candidate(
    raw: dict,
    source: str,
    platform: str,
    source_confidence: str = "low",
) -> Optional[CreatorCandidate]:
    """
    Normalize a raw provider result dict into a CreatorCandidate.
    Returns None if critical fields (platform + handle or profile_url) are missing.
    """
    profile_url: Optional[str] = raw.get("profile_url") or raw.get("url") or raw.get("link")
    handle: Optional[str] = raw.get("handle") or raw.get("username") or raw.get("channel_id")
    display_name: Optional[str] = raw.get("display_name") or raw.get("title") or raw.get("name")
    bio: Optional[str] = raw.get("bio") or raw.get("description") or raw.get("snippet")
    avatar_url: Optional[str] = raw.get("avatar_url") or raw.get("thumbnail")

    # Derive platform from URL if not explicit
    if not platform and profile_url:
        platform = detect_platform_from_url(profile_url) or "unknown"

    # Derive handle from URL if not explicit
    if not handle and profile_url:
        handle = extract_handle_from_url(profile_url, platform)

    if not handle and not profile_url:
        logger.debug("Skipping raw result — no handle or profile_url: %s", raw)
        return None

    # Normalize profile_url
    if not profile_url and handle and platform:
        profile_url = _build_profile_url(platform, handle)

    if not profile_url:
        return None

    follower_count: Optional[int] = None
    raw_followers = raw.get("followers") or raw.get("subscriber_count") or raw.get("follower_count")
    if raw_followers is not None:
        try:
            follower_count = int(raw_followers)
        except (ValueError, TypeError):
            pass

    engagement_hint: Optional[float] = None
    raw_eng = raw.get("engagement_rate") or raw.get("engagement_hint")
    if raw_eng is not None:
        try:
            engagement_hint = float(raw_eng)
        except (ValueError, TypeError):
            pass

    return CreatorCandidate(
        handle=handle or profile_url,
        display_name=display_name,
        platform=platform,
        profile_url=profile_url,
        bio=bio[:500] if bio else None,
        avatar_url=avatar_url,
        follower_count=follower_count,
        engagement_hint=engagement_hint,
        category_hint=raw.get("category_hint") or raw.get("category"),
        location_hint=raw.get("location_hint") or raw.get("location") or raw.get("country"),
        source=source,
        source_confidence=source_confidence,
        raw=raw,
    )


def _build_profile_url(platform: str, handle: str) -> str:
    handle = handle.lstrip("@")
    if platform == "youtube":
        return f"https://www.youtube.com/@{handle}"
    if platform == "instagram":
        return f"https://www.instagram.com/{handle}/"
    if platform == "tiktok":
        return f"https://www.tiktok.com/@{handle}"
    return f"https://{platform}.com/{handle}"


def evidence_quality_from_fields(evidence: dict) -> str:
    """Compute evidence quality from available fields."""
    score = 0
    if evidence.get("followers") or evidence.get("subscriber_count"):
        score += 2
    if evidence.get("engagement_rate"):
        score += 2
    if evidence.get("avg_views"):
        score += 2
    if evidence.get("bio") and len(str(evidence.get("bio", ""))) > 20:
        score += 1
    if evidence.get("category_hints"):
        score += 1
    if evidence.get("recent_content_signals"):
        score += 1
    if evidence.get("audience_hints"):
        score += 1
    if score >= 7:
        return "strong"
    if score >= 4:
        return "moderate"
    if score >= 2:
        return "weak"
    return "none"
