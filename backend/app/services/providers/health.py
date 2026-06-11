"""
Provider Health Service — Part 16 Final

Lightweight health checks for all configured data providers.
No external API calls unless explicitly requested (test mode).
Configuration checks are instant; connectivity tests add latency.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Status constants ───────────────────────────────────────────────────────────

STATUS_HEALTHY       = "healthy"
STATUS_DEGRADED      = "degraded"
STATUS_UNAVAILABLE   = "unavailable"
STATUS_NOT_CONFIGURED = "not_configured"

# ── Types ─────────────────────────────────────────────────────────────────────

@dataclass
class ProviderHealthResult:
    provider:        str
    status:          str        # healthy | degraded | unavailable | not_configured
    configured:      bool
    latency_ms:      Optional[int]   = None
    error:           Optional[str]   = None
    last_checked_at: Optional[str]   = None
    notes:           list[str]       = field(default_factory=list)


# ── Configuration checks (instant, no network) ────────────────────────────────

def _check_apify_instagram() -> ProviderHealthResult:
    token = getattr(settings, "APIFY_TOKEN", "").strip()
    actor = getattr(settings, "INSTAGRAM_ACTOR", "").strip()
    if not token:
        return ProviderHealthResult(
            provider="apify_instagram",
            status=STATUS_NOT_CONFIGURED,
            configured=False,
            notes=["APIFY_TOKEN eksik. .env dosyasına ekleyin."],
        )
    return ProviderHealthResult(
        provider="apify_instagram",
        status=STATUS_HEALTHY,
        configured=True,
        notes=[f"Actor: {actor or 'apify/instagram-profile-scraper'}"],
    )


def _check_apify_tiktok() -> ProviderHealthResult:
    token = getattr(settings, "APIFY_TOKEN", "").strip()
    actor = getattr(settings, "TIKTOK_ACTOR", "").strip()
    if not token:
        return ProviderHealthResult(
            provider="apify_tiktok",
            status=STATUS_NOT_CONFIGURED,
            configured=False,
            notes=["APIFY_TOKEN eksik."],
        )
    return ProviderHealthResult(
        provider="apify_tiktok",
        status=STATUS_HEALTHY,
        configured=True,
        notes=[f"Actor: {actor or 'clockworks/tiktok-scraper'}"],
    )


def _check_youtube() -> ProviderHealthResult:
    key = getattr(settings, "YOUTUBE_API_KEY", "").strip()
    if not key:
        return ProviderHealthResult(
            provider="youtube_data_api",
            status=STATUS_NOT_CONFIGURED,
            configured=False,
            notes=["YOUTUBE_API_KEY eksik."],
        )
    return ProviderHealthResult(
        provider="youtube_data_api",
        status=STATUS_HEALTHY,
        configured=True,
        notes=["YouTube Data API v3 yapılandırıldı."],
    )


def _check_openai() -> ProviderHealthResult:
    key = getattr(settings, "OPENAI_API_KEY", "").strip()
    if not key:
        return ProviderHealthResult(
            provider="openai",
            status=STATUS_NOT_CONFIGURED,
            configured=False,
            notes=["OPENAI_API_KEY eksik."],
        )
    return ProviderHealthResult(provider="openai", status=STATUS_HEALTHY, configured=True)


def _check_anthropic() -> ProviderHealthResult:
    key = getattr(settings, "ANTHROPIC_API_KEY", "").strip()
    if not key:
        return ProviderHealthResult(
            provider="anthropic",
            status=STATUS_NOT_CONFIGURED,
            configured=False,
            notes=["ANTHROPIC_API_KEY eksik."],
        )
    return ProviderHealthResult(provider="anthropic", status=STATUS_HEALTHY, configured=True)


def _check_deepseek() -> ProviderHealthResult:
    key = getattr(settings, "DEEPSEEK_API_KEY", "").strip()
    if not key:
        return ProviderHealthResult(
            provider="deepseek",
            status=STATUS_NOT_CONFIGURED,
            configured=False,
            notes=["DEEPSEEK_API_KEY eksik."],
        )
    return ProviderHealthResult(provider="deepseek", status=STATUS_HEALTHY, configured=True)


# ── Connectivity tests (adds network latency) ─────────────────────────────────

async def _ping_apify(timeout: float = 5.0) -> tuple[bool, int, Optional[str]]:
    """Ping Apify API to check connectivity. Returns (ok, latency_ms, error)."""
    token = getattr(settings, "APIFY_TOKEN", "").strip()
    if not token:
        return False, 0, "not_configured"
    try:
        import httpx
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                "https://api.apify.com/v2/users/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code == 200:
            return True, latency, None
        return False, latency, f"HTTP {resp.status_code}"
    except Exception as exc:
        return False, 0, str(exc)[:120]


async def _ping_youtube(timeout: float = 5.0) -> tuple[bool, int, Optional[str]]:
    """Ping YouTube Data API to check connectivity."""
    key = getattr(settings, "YOUTUBE_API_KEY", "").strip()
    if not key:
        return False, 0, "not_configured"
    try:
        import httpx
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={"part": "snippet", "q": "test", "maxResults": 1, "key": key},
            )
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code in (200, 403):   # 403 = invalid key but API is up
            ok = resp.status_code == 200
            err = None if ok else "invalid_api_key"
            return ok, latency, err
        return False, latency, f"HTTP {resp.status_code}"
    except Exception as exc:
        return False, 0, str(exc)[:120]


# ── Public API ────────────────────────────────────────────────────────────────

PROVIDER_CHECKERS = {
    "apify_instagram":  _check_apify_instagram,
    "apify_tiktok":     _check_apify_tiktok,
    "youtube_data_api": _check_youtube,
    "openai":           _check_openai,
    "anthropic":        _check_anthropic,
    "deepseek":         _check_deepseek,
}


def get_all_provider_health() -> list[ProviderHealthResult]:
    """Run configuration checks for all providers. No network I/O."""
    now = datetime.now(timezone.utc).isoformat()
    results = []
    for name, checker in PROVIDER_CHECKERS.items():
        r = checker()
        r.last_checked_at = now
        results.append(r)
    return results


def get_provider_health(provider: str) -> Optional[ProviderHealthResult]:
    """Check single provider configuration."""
    checker = PROVIDER_CHECKERS.get(provider)
    if not checker:
        return None
    r = checker()
    r.last_checked_at = datetime.now(timezone.utc).isoformat()
    return r


async def test_provider_connectivity(provider: str, timeout: float = 8.0) -> ProviderHealthResult:
    """
    Live connectivity test for a single provider.
    Makes an actual network request — only for admin diagnostics.
    """
    now = datetime.now(timezone.utc).isoformat()

    if provider in ("apify_instagram", "apify_tiktok"):
        ok, latency, err = await _ping_apify(timeout)
        if not getattr(settings, "APIFY_TOKEN", "").strip():
            return ProviderHealthResult(
                provider=provider, status=STATUS_NOT_CONFIGURED,
                configured=False, last_checked_at=now,
                notes=["APIFY_TOKEN eksik."],
            )
        status = STATUS_HEALTHY if ok else (
            STATUS_UNAVAILABLE if err and "not_configured" not in err else STATUS_NOT_CONFIGURED
        )
        return ProviderHealthResult(
            provider=provider, status=status, configured=True,
            latency_ms=latency if latency > 0 else None,
            error=err, last_checked_at=now,
        )

    if provider == "youtube_data_api":
        ok, latency, err = await _ping_youtube(timeout)
        if not getattr(settings, "YOUTUBE_API_KEY", "").strip():
            return ProviderHealthResult(
                provider=provider, status=STATUS_NOT_CONFIGURED,
                configured=False, last_checked_at=now,
                notes=["YOUTUBE_API_KEY eksik."],
            )
        status = STATUS_HEALTHY if ok else STATUS_UNAVAILABLE
        return ProviderHealthResult(
            provider=provider, status=status, configured=True,
            latency_ms=latency if latency > 0 else None,
            error=err, last_checked_at=now,
        )

    # AI providers — only configuration check, no live ping
    base = get_provider_health(provider)
    if base is None:
        return ProviderHealthResult(
            provider=provider, status=STATUS_NOT_CONFIGURED,
            configured=False, last_checked_at=now,
            notes=["Bilinmeyen provider."],
        )
    base.last_checked_at = now
    base.notes.append("AI provider — live ping desteklenmiyor.")
    return base


def get_agents_mode() -> str:
    return getattr(settings, "AGENTS_MODE", "mock").lower()


def is_mock_mode() -> bool:
    return get_agents_mode() == "mock"
