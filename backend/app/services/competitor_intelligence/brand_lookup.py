"""
Brand Lookup — Competitor name normalization, alias resolution, and DB operations.
"""
from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import cast, func, or_, select
from sqlalchemy.types import Text as SAText
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.competitor_intelligence import CompetitorProfile

# Suffixes stripped during normalization (Turkish + English common brand suffixes)
_STRIP_SUFFIXES = [
    r"\s+(tr|türkiye|turkey|global|beauty|care|shop|official|store|market|online|group|co|ltd)\b",
]

# Known brand → industry mapping for auto-categorization
_BRAND_INDUSTRY: dict[str, str] = {
    "watsons":      "beauty_health",
    "gratis":       "beauty_health",
    "sephora":      "beauty",
    "mac":          "beauty",
    "loreal":       "beauty",
    "garnier":      "beauty",
    "nivea":        "beauty_health",
    "pantene":      "beauty",
    "lc_waikiki":   "fashion",
    "zara":         "fashion",
    "hm":           "fashion",
    "bershka":      "fashion",
    "stradivarius":  "fashion",
    "reebok":       "fashion_sports",
    "nike":         "fashion_sports",
    "adidas":       "fashion_sports",
    "migros":       "food_retail",
    "bim":          "food_retail",
    "a101":         "food_retail",
    "teknosa":      "electronics",
    "mediamarkt":   "electronics",
    "apple":        "technology",
    "samsung":      "technology",
}

# Industry → likely creator categories
INDUSTRY_CATEGORIES: dict[str, list[str]] = {
    "beauty_health":   ["beauty", "skincare", "health", "lifestyle", "wellness"],
    "beauty":          ["beauty", "skincare", "makeup", "lifestyle"],
    "fashion":         ["fashion", "lifestyle", "ootd", "style"],
    "fashion_sports":  ["fashion", "sports", "fitness", "lifestyle"],
    "food_retail":     ["food", "recipe", "lifestyle", "mom"],
    "electronics":     ["tech", "gaming", "review", "lifestyle"],
    "technology":      ["tech", "gaming", "review", "business"],
    "general":         ["lifestyle"],
}


def normalize_brand_name(name: str) -> str:
    """Normalize brand name to a consistent slug for deduplication."""
    cleaned = name.strip().lower()
    for pattern in _STRIP_SUFFIXES:
        cleaned = re.sub(pattern, "", cleaned)
    cleaned = re.sub(r"[^\w\s]", "", cleaned)
    cleaned = re.sub(r"\s+", "_", cleaned.strip())
    return cleaned


def infer_industry(normalized_name: str) -> Optional[str]:
    """Return industry for known brands, or None for unknown brands."""
    for key, industry in _BRAND_INDUSTRY.items():
        if key in normalized_name:
            return industry
    return None


def get_brand_categories(competitor: CompetitorProfile) -> list[str]:
    """Return creator category keywords associated with this competitor's industry."""
    industry = competitor.industry or "general"
    return INDUSTRY_CATEGORIES.get(industry, INDUSTRY_CATEGORIES["general"])


async def find_or_create_competitor(
    db: AsyncSession,
    name: str,
) -> CompetitorProfile:
    """
    Find an existing CompetitorProfile by normalized name or alias.
    Creates a new one if not found.
    """
    normalized = normalize_brand_name(name)

    # Try exact normalized name
    res = await db.execute(
        select(CompetitorProfile).where(CompetitorProfile.normalized_name == normalized)
    )
    competitor = res.scalar_one_or_none()
    if competitor:
        return competitor

    # Try case-insensitive name match (catch aliased variants)
    res2 = await db.execute(
        select(CompetitorProfile).where(
            func.lower(CompetitorProfile.name) == name.strip().lower()
        )
    )
    competitor = res2.scalar_one_or_none()
    if competitor:
        return competitor

    # Create new
    industry = infer_industry(normalized)
    competitor = CompetitorProfile(
        name=name.strip(),
        normalized_name=normalized,
        industry=industry,
        country="TR",
        aliases=[name.strip()],
    )
    db.add(competitor)
    await db.flush()
    return competitor


async def search_competitors(
    db: AsyncSession,
    query: str,
    limit: int = 10,
) -> list[dict]:
    """
    Full-text search for autocomplete. Returns dicts (not ORM objects).
    Includes `has_active_campaigns` and `last_campaign_at` from report cache.
    """
    from datetime import datetime, timezone
    from app.models.competitor_intelligence import CompetitorReportCache
    from sqlalchemy import desc

    lower_q = query.lower()
    res = await db.execute(
        select(CompetitorProfile)
        .where(
            or_(
                func.lower(CompetitorProfile.name).like(f"%{lower_q}%"),
                func.lower(cast(CompetitorProfile.aliases, SAText)).like(f"%{lower_q}%"),
            )
        )
        .order_by(CompetitorProfile.name.asc())
        .limit(limit)
    )
    competitors = list(res.scalars().all())

    results = []
    for c in competitors:
        # Check if there's a fresh cached report → has_active_campaigns
        cache_res = await db.execute(
            select(CompetitorReportCache)
            .where(CompetitorReportCache.competitor_id == c.id)
            .order_by(desc(CompetitorReportCache.generated_at))
            .limit(1)
        )
        cache_row = cache_res.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        has_active = False
        last_at = None
        if cache_row:
            expires = cache_row.expires_at
            if expires and expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            has_active = (expires is not None and expires > now)
            last_at = cache_row.generated_at.isoformat() if cache_row.generated_at else None

        results.append({
            "competitor_id":       c.id,
            "name":                c.name,
            "normalized_name":     c.normalized_name,
            "aliases":             c.aliases or [],
            "industry":            c.industry,
            "country":             c.country or "TR",
            "has_active_campaigns": has_active,
            "last_campaign_at":    last_at,
        })

    return results
