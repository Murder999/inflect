"""
Influencer Identity — username/URL normalization and platform detection.
Handles all common social profile URL formats deterministically.
"""
from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse


# ── Known platform slugs ──────────────────────────────────────────────────────
PLATFORM_INSTAGRAM = "instagram"
PLATFORM_TIKTOK    = "tiktok"
PLATFORM_YOUTUBE   = "youtube"
KNOWN_PLATFORMS    = {PLATFORM_INSTAGRAM, PLATFORM_TIKTOK, PLATFORM_YOUTUBE}


def detect_platform_from_url(raw: str) -> Optional[str]:
    """
    Extract platform name from a social media profile URL.
    Returns None if the URL is not a recognized platform.
    """
    raw = raw.strip()
    try:
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        host = parsed.hostname or ""
    except Exception:
        return None

    host = host.lower().removeprefix("www.")
    if "instagram.com" in host:
        return PLATFORM_INSTAGRAM
    if "tiktok.com" in host:
        return PLATFORM_TIKTOK
    if "youtube.com" in host or "youtu.be" in host:
        return PLATFORM_YOUTUBE
    return None


def parse_social_profile_url(raw: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a social profile URL into (platform, username).
    Returns (None, None) if the URL is not a recognized format.

    Supported formats:
      Instagram : instagram.com/{username}
      TikTok    : tiktok.com/@{username}
      YouTube   : youtube.com/@{handle}
                  youtube.com/c/{name}
                  youtube.com/channel/{id}   — returns channel_id as username
                  youtube.com/user/{legacy}
    """
    raw = raw.strip()
    platform = detect_platform_from_url(raw)
    if platform is None:
        return None, None

    try:
        parsed = urlparse(raw if "://" in raw else f"https://{raw}")
        path   = parsed.path.strip("/")
    except Exception:
        return platform, None

    if not path:
        return platform, None

    parts = path.split("/")

    if platform == PLATFORM_INSTAGRAM:
        username = parts[0] if parts else None
        return platform, clean_username(username)

    if platform == PLATFORM_TIKTOK:
        seg = parts[0] if parts else None
        return platform, clean_username(seg)

    if platform == PLATFORM_YOUTUBE:
        # /@handle
        if parts[0].startswith("@"):
            return platform, clean_username(parts[0])
        # /c/{name} or /user/{legacy}
        if len(parts) >= 2 and parts[0] in ("c", "user"):
            return platform, clean_username(parts[1])
        # /channel/{id}
        if len(parts) >= 2 and parts[0] == "channel":
            return platform, parts[1]  # keep channel ID as-is
        # Bare path as username
        return platform, clean_username(parts[0])

    return platform, None


def clean_username(raw: Optional[str]) -> Optional[str]:
    """Strip @, whitespace, and trailing slashes from a username."""
    if not raw:
        return None
    return raw.strip().lstrip("@").strip("/").lower()


def normalize_platform(raw: Optional[str]) -> Optional[str]:
    """Map common variations to canonical platform slug."""
    if not raw:
        return None
    s = raw.strip().lower()
    mapping = {
        "ig": PLATFORM_INSTAGRAM,
        "insta": PLATFORM_INSTAGRAM,
        "instagram": PLATFORM_INSTAGRAM,
        "tt": PLATFORM_TIKTOK,
        "tiktok": PLATFORM_TIKTOK,
        "yt": PLATFORM_YOUTUBE,
        "youtube": PLATFORM_YOUTUBE,
    }
    return mapping.get(s)


def normalize_handle(raw: str) -> tuple[str, Optional[str]]:
    """
    Normalize any user-provided influencer identifier.

    Accepted formats:
      cristiano
      @cristiano
      instagram:cristiano
      https://www.instagram.com/cristiano/
      https://www.tiktok.com/@khaby.lame
      https://www.youtube.com/@mkbhd

    Returns (username, platform_or_None).
    username is always lowercase, @ stripped.
    """
    raw = raw.strip()

    # URL format
    if raw.startswith("http://") or raw.startswith("https://") or "." in raw[:30]:
        platform, username = parse_social_profile_url(raw)
        if username:
            return username, platform
        # Not a recognized platform URL — treat entire thing as username
        return clean_username(raw) or raw.lower(), None

    # "platform:username" shorthand
    if ":" in raw:
        parts = raw.split(":", 1)
        plat = normalize_platform(parts[0])
        uname = clean_username(parts[1])
        if plat and uname:
            return uname, plat

    # Plain @handle or username
    return clean_username(raw) or raw.lower(), None


def is_url(raw: str) -> bool:
    return raw.strip().startswith(("http://", "https://"))
