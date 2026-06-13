"""
Creator candidate scoring — Part 24

Scores candidates based on available evidence.
Returns null scores for missing fields — never defaults to 50.
A candidate with insufficient evidence is excluded from recommendations.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from app.services.influencer_discovery.base import CreatorCandidate

logger = logging.getLogger(__name__)

MIN_EVIDENCE_QUALITY_FOR_RECOMMENDATION = "weak"  # candidates below this are excluded


@dataclass
class CandidateScore:
    relevance_score: Optional[float]           # 0-100 or null if uncomputable
    category_match_score: Optional[float]
    market_match_score: Optional[float]
    engagement_quality_score: Optional[float]
    fraud_risk_score: Optional[float]          # 0-100 where 100=high risk
    evidence_quality_score: Optional[float]
    brand_fit_score: Optional[float]           # null until enrich
    overall_discovery_score: Optional[float]   # null if insufficient evidence
    evidence_quality: str                      # strong|moderate|weak|none
    excluded: bool = False
    exclusion_reason: str = ""
    score_basis: list[str] = field(default_factory=list)


_EVIDENCE_QUALITY_WEIGHT = {
    "strong":   1.0,
    "moderate": 0.75,
    "weak":     0.50,
    "none":     0.0,
}

_QUALITY_RANK = {"strong": 3, "moderate": 2, "weak": 1, "none": 0}


def score_candidate(
    candidate: CreatorCandidate,
    target_category: str,
    target_market: str,
    evidence_quality: str = "none",
) -> CandidateScore:
    """
    Score a candidate against target parameters.
    Returns null for scores that cannot be computed from available data.
    """
    basis: list[str] = []

    # Category match (0-100 or null)
    cat_score: Optional[float] = None
    if candidate.category_hint and target_category:
        cat_score = _category_similarity(candidate.category_hint, target_category)
        basis.append(f"category_match={cat_score:.0f}")
    elif not candidate.category_hint:
        basis.append("category_hint=missing")

    # Market match (0-100 or null)
    market_score: Optional[float] = None
    if candidate.location_hint and target_market:
        market_score = _market_similarity(candidate.location_hint, target_market)
        basis.append(f"market_match={market_score:.0f}")
    elif not candidate.location_hint:
        basis.append("location_hint=missing")

    # Engagement quality (null if no data)
    eng_score: Optional[float] = None
    if candidate.engagement_hint is not None:
        eng_score = min(100.0, candidate.engagement_hint * 10)  # e.g. 5% ER → 50
        basis.append(f"engagement_hint={candidate.engagement_hint:.2f}%")

    # Evidence quality numeric
    ev_score = _EVIDENCE_QUALITY_WEIGHT.get(evidence_quality, 0.0) * 100
    basis.append(f"evidence_quality={evidence_quality}")

    # Relevance = category + market (null if both null)
    relevance: Optional[float] = None
    if cat_score is not None or market_score is not None:
        parts = [s for s in [cat_score, market_score] if s is not None]
        relevance = sum(parts) / len(parts)

    # Overall only if minimum evidence
    overall: Optional[float] = None
    excluded = False
    exclusion_reason = ""

    if _QUALITY_RANK.get(evidence_quality, 0) < _QUALITY_RANK.get(MIN_EVIDENCE_QUALITY_FOR_RECOMMENDATION, 0):
        excluded = True
        exclusion_reason = f"evidence_quality={evidence_quality} below minimum threshold"
    elif relevance is not None and ev_score > 0:
        # Weight: relevance 50%, evidence quality 30%, engagement 20%
        components = [relevance * 0.50, ev_score * 0.30]
        weight = 0.80
        if eng_score is not None:
            components.append(eng_score * 0.20)
            weight += 0.20
        overall = sum(components) / weight

    return CandidateScore(
        relevance_score=round(relevance, 1) if relevance is not None else None,
        category_match_score=round(cat_score, 1) if cat_score is not None else None,
        market_match_score=round(market_score, 1) if market_score is not None else None,
        engagement_quality_score=round(eng_score, 1) if eng_score is not None else None,
        fraud_risk_score=None,  # requires full analysis pipeline
        evidence_quality_score=round(ev_score, 1),
        brand_fit_score=None,   # requires brand genome analysis
        overall_discovery_score=round(overall, 1) if overall is not None else None,
        evidence_quality=evidence_quality,
        excluded=excluded,
        exclusion_reason=exclusion_reason,
        score_basis=basis,
    )


def _category_similarity(creator_cat: str, target_cat: str) -> float:
    c = creator_cat.lower()
    t = target_cat.lower()
    if c == t:
        return 100.0
    if c in t or t in c:
        return 85.0
    # Check related groups
    _GROUPS = [
        {"fitness", "gym", "workout", "health", "wellness", "spor", "sağlık"},
        {"beauty", "makeup", "skincare", "güzellik", "makyaj"},
        {"food", "cooking", "recipe", "yemek", "gıda"},
        {"tech", "technology", "teknoloji", "gadget"},
        {"fashion", "style", "moda", "giyim"},
        {"travel", "seyahat", "turizm"},
        {"lifestyle", "yaşam"},
        {"home", "ev", "interior", "decor"},
    ]
    for group in _GROUPS:
        if any(kw in c for kw in group) and any(kw in t for kw in group):
            return 65.0
    return 20.0


def _market_similarity(creator_location: str, target_market: str) -> float:
    cl = creator_location.lower().strip()
    tm = target_market.lower().strip()
    _ALIASES = {
        "turkey": "türkiye", "tr": "türkiye", "turkiye": "türkiye",
        "usa": "usa", "us": "usa", "united states": "usa",
        "uk": "uk", "united kingdom": "uk", "gb": "uk",
    }
    cl = _ALIASES.get(cl, cl)
    tm = _ALIASES.get(tm, tm)
    if cl == tm:
        return 100.0
    if cl in tm or tm in cl:
        return 80.0
    if tm == "global":
        return 60.0
    return 20.0
