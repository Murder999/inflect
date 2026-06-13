"""
Influencer Discovery API — Part 24

POST /api/v1/influencers/discover/live
  - Initiates live discovery from configured providers
  - Returns discovery_run_id, provider_status, candidates, next_actions
  - Returns provider_missing status (not fake data) when providers unavailable

GET /api/v1/influencers/discover/runs/{run_id}
  - Returns run status and candidates

POST /api/v1/influencers/discover/candidates/{candidate_id}/enrich
  - Triggers enrichment for a specific candidate
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.influencer_discovery.discovery_orchestrator import get_orchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/influencers/discover", tags=["influencer-discovery"])


# ── Request / Response schemas ────────────────────────────────────────────────

class DiscoverLiveRequest(BaseModel):
    brand_name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=100)
    target_market: str = Field(default="Global", max_length=100)
    platforms: list[str] = Field(default_factory=lambda: ["youtube"])
    limit: int = Field(default=20, ge=1, le=100)
    product_signals: Optional[list[str]] = None
    audience_signals: Optional[list[str]] = None
    language: Optional[str] = None
    campaign_id: Optional[int] = None
    brand_analysis_id: Optional[int] = None
    mode: Optional[str] = None  # override per-request (not honoured in disabled mode)


class ProviderStatusOut(BaseModel):
    name: str
    platform: str
    available: bool
    disabled_reason: Optional[str] = None
    error: Optional[str] = None
    candidates_found: int = 0


class CandidateOut(BaseModel):
    handle: str
    display_name: Optional[str]
    platform: str
    profile_url: str
    bio: Optional[str]
    avatar_url: Optional[str]
    follower_count: Optional[int]
    engagement_hint: Optional[float]
    category_hint: Optional[str]
    location_hint: Optional[str]
    source: str
    source_confidence: str
    evidence_quality: str = "none"


class QueryPlanOut(BaseModel):
    platform: str
    keywords: list[str]
    hashtags: list[str]
    source_reason: str


class DiscoverLiveResponse(BaseModel):
    status: str   # provider_missing|discovery_completed|discovery_partial|discovery_failed
    discovery_run_id: Optional[int]
    provider_statuses: list[ProviderStatusOut]
    query_plan: list[QueryPlanOut]
    candidates: list[CandidateOut]
    verified_candidates_count: int
    insufficient_data: bool
    blocked_reason: Optional[str]
    next_actions: list[str]
    generated_at: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/live", response_model=DiscoverLiveResponse)
async def discover_live(
    body: DiscoverLiveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DiscoverLiveResponse:
    """
    Initiate live influencer discovery from configured providers.

    Returns real discovery candidates from YouTube/Search providers.
    When no providers are configured, returns provider_missing status — not fake data.
    Archive is never the primary source.
    """
    orchestrator = get_orchestrator()

    result = await orchestrator.discover(
        brand_name=body.brand_name,
        brand_category=body.category,
        target_market=body.target_market,
        platforms=body.platforms,
        limit=body.limit,
        product_signals=body.product_signals,
        audience_signals=body.audience_signals,
        language=body.language,
        db=db,
        user_id=current_user.id,
        campaign_id=body.campaign_id,
        brand_analysis_id=body.brand_analysis_id,
    )

    return DiscoverLiveResponse(
        status=result.status,
        discovery_run_id=result.run_id,
        provider_statuses=[
            ProviderStatusOut(
                name=ps.name,
                platform=ps.platform,
                available=ps.available,
                disabled_reason=ps.disabled_reason,
                error=ps.error,
                candidates_found=ps.candidates_found,
            )
            for ps in result.provider_statuses
        ],
        query_plan=[
            QueryPlanOut(
                platform=q.platform,
                keywords=q.keywords,
                hashtags=q.hashtags,
                source_reason=q.source_reason,
            )
            for q in result.query_plan
        ],
        candidates=[
            CandidateOut(
                handle=c.handle,
                display_name=c.display_name,
                platform=c.platform,
                profile_url=c.profile_url,
                bio=c.bio,
                avatar_url=c.avatar_url,
                follower_count=c.follower_count,
                engagement_hint=c.engagement_hint,
                category_hint=c.category_hint,
                location_hint=c.location_hint,
                source=c.source,
                source_confidence=c.source_confidence,
                evidence_quality="weak" if c.follower_count else "none",
            )
            for c in result.candidates
        ],
        verified_candidates_count=result.verified_candidates_count,
        insufficient_data=result.insufficient_data,
        blocked_reason=result.blocked_reason,
        next_actions=result.next_actions,
        generated_at=result.generated_at,
    )


@router.get("/runs/{run_id}")
async def get_discovery_run(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return status and candidates for a discovery run."""
    try:
        from sqlalchemy import select
        from app.models.influencer_discovery import InfluencerDiscoveryRun, InfluencerDiscoveryCandidate

        run = (await db.execute(
            select(InfluencerDiscoveryRun).where(InfluencerDiscoveryRun.id == run_id)
        )).scalar_one_or_none()

        if not run:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discovery run bulunamadı")

        if run.user_id and run.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erişim yetkisi yok")

        candidates = (await db.execute(
            select(InfluencerDiscoveryCandidate)
            .where(InfluencerDiscoveryCandidate.run_id == run_id)
            .order_by(InfluencerDiscoveryCandidate.overall_score.desc().nulls_last())
        )).scalars().all()

        return {
            "run_id":                   run.id,
            "status":                   run.status,
            "candidates_count":         run.candidates_count,
            "verified_candidates_count": run.verified_candidates_count,
            "provider_status":          run.provider_status or {},
            "query_plan":               run.query_plan or [],
            "input_payload":            run.input_payload or {},
            "created_at":               run.created_at.isoformat() if run.created_at else None,
            "completed_at":             run.completed_at.isoformat() if run.completed_at else None,
            "candidates": [
                {
                    "id":               c.id,
                    "handle":           c.handle,
                    "display_name":     c.display_name,
                    "platform":         c.platform,
                    "profile_url":      c.profile_url,
                    "source_provider":  c.source_provider,
                    "evidence_quality": c.evidence_quality,
                    "overall_score":    c.overall_score,
                    "cache_status":     c.cache_status,
                }
                for c in candidates
            ],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("get_discovery_run error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Sunucu hatası")


@router.post("/candidates/{candidate_id}/enrich")
async def enrich_candidate(
    candidate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Trigger enrichment for a specific candidate.
    Fetches detailed evidence from the candidate's platform provider.
    """
    try:
        from sqlalchemy import select
        from app.models.influencer_discovery import InfluencerDiscoveryCandidate
        from app.services.influencer_discovery.base import CreatorCandidate

        cand = (await db.execute(
            select(InfluencerDiscoveryCandidate).where(InfluencerDiscoveryCandidate.id == candidate_id)
        )).scalar_one_or_none()

        if not cand:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate bulunamadı")

        orchestrator = get_orchestrator()
        await orchestrator._ensure_initialized()

        # Find matching provider
        provider = next(
            (p for p in orchestrator._providers if p.platform == cand.platform and await p.is_available()),
            None,
        )

        if not provider:
            return {
                "candidate_id":    candidate_id,
                "enriched":        False,
                "evidence_quality": cand.evidence_quality,
                "reason":          f"No available provider for platform '{cand.platform}'",
            }

        stub = CreatorCandidate(
            handle=cand.handle,
            platform=cand.platform,
            profile_url=cand.profile_url,
            source=cand.source_provider,
            source_confidence="medium",
            raw=cand.raw_evidence or {},
        )
        evidence = await provider.enrich_creator(stub)

        cand.evidence_quality = evidence.evidence_quality
        cand.cache_status = "live"
        if evidence.followers:
            raw = dict(cand.raw_evidence or {})
            raw["followers"] = evidence.followers
            raw["engagement_rate"] = evidence.engagement_rate
            cand.raw_evidence = raw
        db.add(cand)
        await db.commit()

        return {
            "candidate_id":    candidate_id,
            "enriched":        True,
            "evidence_quality": evidence.evidence_quality,
            "followers":       evidence.followers,
            "engagement_rate": evidence.engagement_rate,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("enrich_candidate error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Sunucu hatası")
