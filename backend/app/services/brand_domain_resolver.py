"""
Brand Domain Resolver — Part 22

Resolves brand names and partial domains to their official website URL.
Uses HTTPS probing for bare brand names (no TLD).
Never uses hardcoded brand-domain mappings as the primary path.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# TLDs probed in priority order when input has no TLD
_PROBE_TLDS = [".com", ".com.tr", ".net", ".io", ".co", ".org"]
_PROBE_TIMEOUT = 2.0   # seconds per probe (concurrent, so total ≈ 2s)
_FETCH_TIMEOUT = 8.0   # seconds for main website fetch

RESOLVER_RESOLVED          = "resolved"
RESOLVER_DOMAIN_UNRESOLVED = "domain_unresolved"
RESOLVER_AMBIGUOUS         = "ambiguous_domain"


@dataclass
class DomainCandidate:
    domain: str        # e.g. "karaca.com.tr"
    url: str           # e.g. "https://karaca.com.tr"
    final_url: str     # after redirects
    http_status: int
    confidence: str    # "high" | "medium" | "low"


@dataclass
class DomainResolution:
    input_value: str
    normalized_input: str
    resolver_status: str            # resolved | domain_unresolved | ambiguous_domain
    resolved_domain: Optional[str] = None
    resolved_url: Optional[str] = None
    resolver_confidence: str = "low"
    candidates: list[DomainCandidate] = field(default_factory=list)
    resolver_note: Optional[str] = None


def _normalize(raw: str) -> str:
    return raw.strip().lower()


def _is_full_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def _has_tld(s: str) -> bool:
    """True if input has at least one dot after stripping scheme."""
    clean = s
    if "://" in clean:
        clean = clean.split("://", 1)[1]
    clean = clean.split("/")[0].split("?")[0].split("@")[-1]
    return "." in clean


async def _probe(client: httpx.AsyncClient, url: str) -> Optional[DomainCandidate]:
    """HEAD → GET fallback. Returns DomainCandidate on 2xx/3xx."""
    domain = url.replace("https://", "").replace("http://", "").split("/")[0]
    for method in ("head", "get"):
        try:
            resp = await getattr(client, method)(url, follow_redirects=True, timeout=_PROBE_TIMEOUT)
            if resp.status_code < 400:
                return DomainCandidate(
                    domain=domain,
                    url=url,
                    final_url=str(resp.url),
                    http_status=resp.status_code,
                    confidence="high" if method == "head" else "medium",
                )
        except Exception:
            pass
    return None


async def resolve_brand_domain(raw_input: str) -> DomainResolution:
    """
    Main entry point.

    Cases:
      1. Full URL  (https://karaca.com.tr)  → normalize → resolved immediately
      2. Domain   (karaca.com.tr)           → https:// prepend → resolved immediately
      3. Bare name (karaca)                 → probe TLD candidates concurrently
    """
    normalized = _normalize(raw_input)

    # ── Case 1: full URL ──────────────────────────────────────────────────────
    if _is_full_url(normalized):
        url = normalized.replace("http://", "https://", 1)
        domain = url.replace("https://", "").split("/")[0].split("?")[0]
        return DomainResolution(
            input_value=raw_input,
            normalized_input=normalized,
            resolver_status=RESOLVER_RESOLVED,
            resolved_domain=domain,
            resolved_url=f"https://{domain}",
            resolver_confidence="high",
            resolver_note="Girilen URL normalize edildi.",
        )

    # ── Case 2: domain with TLD ───────────────────────────────────────────────
    if _has_tld(normalized):
        clean = normalized.split("/")[0].split("?")[0]
        return DomainResolution(
            input_value=raw_input,
            normalized_input=normalized,
            resolver_status=RESOLVER_RESOLVED,
            resolved_domain=clean,
            resolved_url=f"https://{clean}",
            resolver_confidence="high",
            resolver_note="Domain girişi doğrulandı.",
        )

    # ── Case 3: bare brand name → probe TLDs ─────────────────────────────────
    slug = normalized.replace(" ", "-")

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; InflectBot/1.0; +https://inflect.io/bot)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    }

    candidates: list[DomainCandidate] = []
    async with httpx.AsyncClient(headers=headers) as client:
        tasks = [_probe(client, f"https://{slug}{tld}") for tld in _PROBE_TLDS]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, DomainCandidate):
                candidates.append(r)

    if not candidates:
        return DomainResolution(
            input_value=raw_input,
            normalized_input=normalized,
            resolver_status=RESOLVER_DOMAIN_UNRESOLVED,
            resolver_confidence="low",
            resolver_note=(
                f'"{raw_input}" için resmi domain bulunamadı. '
                f"Lütfen resmi web sitesi adresini girin "
                f"(örn: {slug}.com veya {slug}.com.tr)."
            ),
        )

    # Prefer .com > .com.tr > first candidate
    for preferred_suffix in (".com", ".com.tr"):
        for cand in candidates:
            if cand.domain.endswith(preferred_suffix):
                return DomainResolution(
                    input_value=raw_input,
                    normalized_input=normalized,
                    resolver_status=RESOLVER_RESOLVED,
                    resolved_domain=cand.domain,
                    resolved_url=cand.url,
                    resolver_confidence=cand.confidence,
                    candidates=candidates,
                    resolver_note=f"TLD taraması: {cand.domain} seçildi ({len(candidates)} aday).",
                )

    # Fallback to first
    best = candidates[0]
    return DomainResolution(
        input_value=raw_input,
        normalized_input=normalized,
        resolver_status=RESOLVER_RESOLVED,
        resolved_domain=best.domain,
        resolved_url=best.url,
        resolver_confidence="low",
        candidates=candidates,
        resolver_note=f"İlk başarılı aday: {best.domain}.",
    )
