"""
Brand Website Fetcher — Part 22

Fetches brand websites and extracts evidence signals from HTML.
No AI calls — AI enrichment is handled by the Next.js API layer if configured.
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_FETCH_TIMEOUT = 8.0
_MAX_BYTES = 1_048_576  # 1 MB cap
_USER_AGENT = "Mozilla/5.0 (compatible; InflectBot/1.0; +https://inflect.io/bot)"


@dataclass
class WebsiteEvidence:
    url: str
    fetch_status: str                    # success | failed | timeout | blocked
    fetch_error: Optional[str] = None
    http_status: Optional[int] = None
    final_url: Optional[str] = None
    response_time_ms: Optional[int] = None

    # Extracted HTML signals
    page_title: Optional[str] = None
    meta_description: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    h1s: list[str] = field(default_factory=list)
    h2s: list[str] = field(default_factory=list)
    body_snippets: list[str] = field(default_factory=list)
    keyword_hints: list[str] = field(default_factory=list)
    social_links: list[str] = field(default_factory=list)
    language: Optional[str] = None

    # Quality
    evidence_quality: str = "none"   # strong | moderate | weak | none


# ── HTML helpers ─────────────────────────────────────────────────────────────

def _strip_tags(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


def _extract_meta(html: str, name: str) -> Optional[str]:
    for pat in [
        rf'<meta[^>]+name=["\'](?i:{re.escape(name)})["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\'](?i:{re.escape(name)})["\']',
    ]:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            return m.group(1)[:300].strip()
    return None


def _extract_og(html: str, prop: str) -> Optional[str]:
    for pat in [
        rf'<meta[^>]+property=["\']og:{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)["\']',
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:{re.escape(prop)}["\']',
    ]:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            return m.group(1)[:300].strip()
    return None


def _extract_title(html: str) -> Optional[str]:
    m = re.search(r"<title[^>]*>([\s\S]*?)</title>", html, re.IGNORECASE)
    if m:
        return re.sub(r"<[^>]+>", "", m.group(1)).strip()[:200]
    return None


def _extract_headings(html: str, tag: str) -> list[str]:
    out: list[str] = []
    for m in re.finditer(rf"<{tag}[^>]*>([\s\S]*?)</{tag}>", html, re.IGNORECASE):
        text = re.sub(r"<[^>]+>", " ", m.group(1)).strip()[:120]
        if len(text) > 2:
            out.append(text)
        if len(out) >= 8:
            break
    return out


def _extract_body_snippets(html: str) -> list[str]:
    clean = re.sub(r"<script[\s\S]*?</script>", "", html, flags=re.IGNORECASE)
    clean = re.sub(r"<style[\s\S]*?</style>",   clean, flags=re.IGNORECASE) if False else clean
    clean = re.sub(r"<style[\s\S]*?</style>",   "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"<nav[\s\S]*?</nav>",        "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"<footer[\s\S]*?</footer>",  "", clean, flags=re.IGNORECASE)
    snippets: list[str] = []
    for m in re.finditer(r"<p[^>]*>([\s\S]*?)</p>", clean, re.IGNORECASE):
        text = re.sub(r"<[^>]+>", " ", m.group(1)).strip()
        if 40 < len(text) < 500:
            snippets.append(text[:200])
        if len(snippets) >= 6:
            break
    return snippets


def _extract_keyword_hints(html: str, title: Optional[str], desc: Optional[str]) -> list[str]:
    meta_kw = _extract_meta(html, "keywords") or ""
    raw = " ".join(filter(None, [title, desc, meta_kw])).lower()
    words = re.findall(r"\b[a-zÀ-ɏ]{4,}\b", raw)
    freq: dict[str, int] = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    return [w for w, _ in sorted(freq.items(), key=lambda x: -x[1])[:20]]


def _extract_social_links(html: str) -> list[str]:
    found: set[str] = set()
    for m in re.finditer(
        r'href=["\']((https?://(www\.)?(twitter|x|instagram|facebook|tiktok|youtube|linkedin|pinterest)\.com/[^"\'?\s]{1,60}))["\']',
        html, re.IGNORECASE,
    ):
        found.add(m.group(1))
        if len(found) >= 8:
            break
    return list(found)


def _detect_language(html: str) -> Optional[str]:
    m = re.search(r'<html[^>]+lang=["\']([^"\']+)["\']', html, re.IGNORECASE)
    return m.group(1)[:10] if m else None


def _quality(ev: "WebsiteEvidence") -> str:
    if ev.fetch_status != "success":
        return "none"
    score = (
        (2 if ev.page_title else 0) +
        (2 if ev.meta_description else 0) +
        (2 if ev.h1s else 0) +
        (1 if ev.h2s else 0) +
        (2 if ev.body_snippets else 0) +
        (1 if ev.social_links else 0) +
        (1 if ev.keyword_hints else 0)
    )
    if score >= 8:
        return "strong"
    if score >= 5:
        return "moderate"
    if score >= 2:
        return "weak"
    return "none"


# ── Main fetch ────────────────────────────────────────────────────────────────

async def fetch_brand_website(url: str) -> WebsiteEvidence:
    """Fetch and parse a brand website. Always returns WebsiteEvidence."""
    start_ms = int(time.time() * 1000)
    headers = {
        "User-Agent": _USER_AGENT,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
    }

    html = ""
    fetch_status = "success"
    fetch_error: Optional[str] = None
    http_status: Optional[int] = None
    final_url: Optional[str] = url

    try:
        async with httpx.AsyncClient(
            headers=headers, follow_redirects=True, timeout=_FETCH_TIMEOUT
        ) as client:
            resp = await client.get(url)
            http_status = resp.status_code
            final_url = str(resp.url)

            if resp.status_code >= 400:
                fetch_status = "blocked" if resp.status_code in (403, 429) else "failed"
                fetch_error = f"HTTP {resp.status_code}"
            else:
                html = resp.content[:_MAX_BYTES].decode("utf-8", errors="replace")

    except httpx.TimeoutException:
        fetch_status = "timeout"
        fetch_error = f"Zaman aşımı ({int(_FETCH_TIMEOUT)}s)"
    except httpx.ConnectError as exc:
        fetch_status = "failed"
        fetch_error = f"Bağlantı hatası: {str(exc)[:200]}"
    except Exception as exc:
        fetch_status = "failed"
        fetch_error = f"Hata: {str(exc)[:200]}"

    response_time_ms = int(time.time() * 1000) - start_ms

    if fetch_status != "success" or not html:
        return WebsiteEvidence(
            url=url,
            fetch_status=fetch_status,
            fetch_error=fetch_error,
            http_status=http_status,
            final_url=final_url,
            response_time_ms=response_time_ms,
        )

    page_title      = _extract_title(html)
    meta_description = _extract_meta(html, "description")
    og_title        = _extract_og(html, "title")
    og_description  = _extract_og(html, "description")
    h1s             = _extract_headings(html, "h1")
    h2s             = _extract_headings(html, "h2")
    body_snippets   = _extract_body_snippets(html)
    keyword_hints   = _extract_keyword_hints(html, page_title, meta_description)
    social_links    = _extract_social_links(html)
    language        = _detect_language(html)

    ev = WebsiteEvidence(
        url=url,
        fetch_status="success",
        http_status=http_status,
        final_url=final_url,
        response_time_ms=response_time_ms,
        page_title=page_title,
        meta_description=meta_description,
        og_title=og_title,
        og_description=og_description,
        h1s=h1s,
        h2s=h2s,
        body_snippets=body_snippets,
        keyword_hints=keyword_hints,
        social_links=social_links,
        language=language,
    )
    ev.evidence_quality = _quality(ev)
    return ev
