"""
Discovery Query Builder — Part 24

Generates platform-appropriate search queries from brand/campaign signals.
No hardcoded brand or platform-specific logic.
All queries are derived from category, audience, product signals, and locale.
Each query includes source_reason for explainability.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.services.influencer_discovery.base import DiscoveryQuery

logger = logging.getLogger(__name__)

# Generic creator type terms (no brand-specific hardcoding)
_CREATOR_TERMS = ["influencer", "content creator", "creator", "blogger", "youtuber"]

# Category-to-keyword mapping (generic, not brand-specific)
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "fitness":    ["fitness influencer", "workout creator", "gym content", "health creator", "spor içerik üreticisi"],
    "beauty":     ["beauty influencer", "makeup creator", "skincare content", "güzellik influencer"],
    "food":       ["food influencer", "cooking creator", "recipe content", "yemek influencer"],
    "travel":     ["travel influencer", "seyahat içerik üreticisi", "travel creator"],
    "tech":       ["tech influencer", "technology creator", "gadget reviewer", "teknoloji influencer"],
    "fashion":    ["fashion influencer", "style creator", "moda influencer"],
    "lifestyle":  ["lifestyle influencer", "yaşam tarzı içerik üreticisi"],
    "gaming":     ["gaming creator", "streamer", "oyun içerik üreticisi"],
    "education":  ["educational creator", "eğitim içerik üreticisi"],
    "home":       ["home decor influencer", "ev dekorasyon influencer", "interior creator"],
}

_PLATFORM_TERMS: dict[str, list[str]] = {
    "youtube":   ["youtube channel", "youtuber", "youtube creator"],
    "instagram": ["instagram influencer", "instagram creator"],
    "tiktok":    ["tiktok creator", "tiktok influencer"],
    "all":       ["influencer", "content creator"],
}

_LOCALE_QUERY_HINTS: dict[str, list[str]] = {
    "türkiye":   ["türkçe", "türk influencer", "türkiye influencer", "Turkish influencer"],
    "usa":       ["US influencer", "American creator"],
    "uk":        ["UK influencer", "British creator"],
    "almanya":   ["German influencer", "Deutsche Influencer"],
    "global":    ["global influencer", "international creator"],
}

_NEGATIVE_TERMS = ["fake followers", "bot followers", "spam account"]


def build_discovery_queries(
    brand_category: str,
    target_market: str,
    platforms: list[str],
    product_signals: Optional[list[str]] = None,
    audience_signals: Optional[list[str]] = None,
    language: Optional[str] = None,
    max_queries_per_platform: int = 3,
) -> list[DiscoveryQuery]:
    """
    Generate discovery queries from brand evidence.
    No brand name in queries — category and market driven.
    Returns empty list only if no actionable signals available.
    """
    queries: list[DiscoveryQuery] = []
    product_signals = product_signals or []
    audience_signals = audience_signals or []

    cat_key = _resolve_category(brand_category)
    cat_keywords = _CATEGORY_KEYWORDS.get(cat_key, [brand_category + " influencer"])
    locale_hints = _resolve_locale(target_market)

    for platform in platforms:
        platform_terms = _PLATFORM_TERMS.get(platform, _PLATFORM_TERMS["all"])
        built = 0

        # Query 1: Category + platform search
        if cat_keywords:
            kws = cat_keywords[:2] + platform_terms[:1]
            queries.append(DiscoveryQuery(
                platform=platform,
                keywords=kws,
                hashtags=_category_hashtags(cat_key),
                negative_keywords=_NEGATIVE_TERMS,
                locale_hints=locale_hints,
                source_reason=f"Category '{brand_category}' + platform '{platform}' search",
            ))
            built += 1

        # Query 2: Locale-specific category search
        if locale_hints and built < max_queries_per_platform:
            kws = locale_hints[:1] + cat_keywords[:1]
            queries.append(DiscoveryQuery(
                platform=platform,
                keywords=kws,
                hashtags=_locale_hashtags(target_market),
                negative_keywords=_NEGATIVE_TERMS,
                locale_hints=locale_hints,
                source_reason=f"Locale '{target_market}' + category '{brand_category}' search",
            ))
            built += 1

        # Query 3: Product signals if available
        if product_signals and built < max_queries_per_platform:
            kws = product_signals[:2] + _CREATOR_TERMS[:1]
            queries.append(DiscoveryQuery(
                platform=platform,
                keywords=kws,
                hashtags=[],
                negative_keywords=_NEGATIVE_TERMS,
                locale_hints=locale_hints,
                source_reason=f"Product signal-based search: {', '.join(product_signals[:2])}",
            ))
            built += 1

    if not queries:
        logger.warning("No discovery queries generated for category=%s market=%s platforms=%s",
                       brand_category, target_market, platforms)

    logger.info("Built %d discovery queries for %d platforms", len(queries), len(platforms))
    return queries


def _resolve_category(category: str) -> str:
    cat = category.lower()
    for key in _CATEGORY_KEYWORDS:
        if key in cat:
            return key
    return "lifestyle"


def _resolve_locale(market: str) -> list[str]:
    m = market.lower()
    for key, hints in _LOCALE_QUERY_HINTS.items():
        if key in m:
            return hints
    return _LOCALE_QUERY_HINTS.get("global", [])


def _category_hashtags(cat_key: str) -> list[str]:
    _TAGS: dict[str, list[str]] = {
        "fitness":  ["#fitness", "#workout", "#gym"],
        "beauty":   ["#beauty", "#makeup", "#skincare"],
        "food":     ["#food", "#recipe", "#cooking"],
        "travel":   ["#travel", "#wanderlust"],
        "tech":     ["#tech", "#technology"],
        "fashion":  ["#fashion", "#style"],
        "lifestyle": ["#lifestyle"],
        "gaming":   ["#gaming", "#streamer"],
        "education": ["#education", "#learning"],
        "home":     ["#homedecor", "#interiordesign"],
    }
    return _TAGS.get(cat_key, [])


def _locale_hashtags(market: str) -> list[str]:
    m = market.lower()
    if "türkiye" in m or "turkey" in m or "tr" in m:
        return ["#türkiye", "#türkçeicerik"]
    return []
