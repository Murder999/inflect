"""
Brand Match API — Part 22

POST /api/v1/intelligence/brand-match/analyze
  - Authenticates user (JWT required)
  - Requires basic_brand_match feature (free+)
  - Resolves brand input to official domain
  - Fetches website and extracts evidence
  - Persists BrandAnalysisSnapshot
  - Returns evidence + statuses + plan-based locked_sections

No AI enrichment here — AI signals are optionally added by the
Next.js API route (/api/intelligence/brand/analyze) which the
frontend calls separately when BRAND_ANALYSIS_PROVIDER is configured.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.brand_analysis import BrandAnalysisSnapshot
from app.models.user import User
from app.services.brand_domain_resolver import (
    RESOLVER_RESOLVED,
    RESOLVER_DOMAIN_UNRESOLVED,
    resolve_brand_domain,
)
from app.services.brand_website_fetcher import fetch_brand_website

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/intelligence/brand-match", tags=["brand-match"])


# ── Plan-based redaction ──────────────────────────────────────────────────────

_LOCKED_SECTIONS_BY_PLAN: dict[str, list[str]] = {
    "free":       ["creator_matches", "portfolio", "insights", "export"],
    "starter":    ["portfolio", "export"],
    "pro":        ["export"],
    "business":   ["export"],
    "agency":     [],
    "enterprise": [],
}


def _locked_sections(user: User) -> list[str]:
    if user.is_admin:
        return []
    plan = user.plan.value if hasattr(user.plan, "value") else str(user.plan)
    return _LOCKED_SECTIONS_BY_PLAN.get(plan, ["creator_matches", "portfolio", "insights", "export"])


def _redaction_level(user: User) -> str:
    if user.is_admin:
        return "none"
    plan = user.plan.value if hasattr(user.plan, "value") else str(user.plan)
    if plan in ("agency", "enterprise"):
        return "none"
    if plan == "pro":
        return "export_only"
    if plan == "starter":
        return "partial"
    return "basic"


# ── Request / Response schemas ────────────────────────────────────────────────

class BrandMatchAnalyzeRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=500, description="Brand name, domain, or full URL")
    target_market: str = Field(default="Global", max_length=50)


class EvidenceResponse(BaseModel):
    url: str
    fetchStatus: str
    fetchError: Optional[str] = None
    httpStatus: Optional[int] = None
    finalUrl: Optional[str] = None
    responseTimeMs: Optional[int] = None
    pageTitle: Optional[str] = None
    metaDescription: Optional[str] = None
    ogTitle: Optional[str] = None
    ogDescription: Optional[str] = None
    h1s: list[str] = []
    h2s: list[str] = []
    bodySnippets: list[str] = []
    keywordHints: list[str] = []
    socialLinks: list[str] = []
    language: Optional[str] = None
    aiUsed: bool = False
    targetMarket: Optional[str] = None
    evidenceQuality: str = "none"


_MIN_CREATOR_POOL = 20


class BrandMatchAnalyzeResponse(BaseModel):
    analysis_id: Optional[int] = None
    input: str
    resolved_domain: Optional[str] = None
    resolved_url: Optional[str] = None
    resolver_status: str
    resolver_confidence: str
    resolver_note: Optional[str] = None
    fetch_status: str
    report_status: str
    verified_report: bool
    evidence: Optional[EvidenceResponse] = None
    domain_candidates: list[dict] = []
    locked_sections: list[str] = []
    redaction_level: str = "basic"
    user_message: Optional[str] = None
    # Section readiness (Post-Audit / Final Patch)
    brand_dna_ready: bool = False
    ai_enrichment_ready: bool = False
    min_creator_pool: int = _MIN_CREATOR_POOL
    # creator_matching_ready is always False from backend (pool is computed client-side)
    creator_matching_ready: bool = False
    trust_scores_ready: bool = False
    blocked_sections: list[str] = []
    blocked_reasons: dict[str, str] = {}


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=BrandMatchAnalyzeResponse)
async def analyze_brand(
    body: BrandMatchAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BrandMatchAnalyzeResponse:
    """
    Resolve brand domain, fetch website evidence, and return verified status.

    The brand DNA scoring, creator matching, and portfolio analysis still run
    client-side in brand-match-engine.ts using the evidence returned here.
    This endpoint ensures domain resolution is backend-verified and
    evidence is persisted before the client engine runs.
    """
    raw_input = body.input.strip()
    if not raw_input:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Boş giriş")

    locked = _locked_sections(current_user)
    redact = _redaction_level(current_user)

    # ── 1. Domain resolution ─────────────────────────────────────────────────
    resolution = await resolve_brand_domain(raw_input)

    if resolution.resolver_status != RESOLVER_RESOLVED:
        snap = BrandAnalysisSnapshot(
            user_id=current_user.id,
            input_value=raw_input,
            normalized_input=resolution.normalized_input,
            resolver_status=resolution.resolver_status,
            resolver_confidence=resolution.resolver_confidence,
            fetch_status="not_attempted",
            report_status="domain_unresolved",
            redaction_level=redact,
        )
        db.add(snap)
        await db.commit()
        await db.refresh(snap)

        return BrandMatchAnalyzeResponse(
            analysis_id=snap.id,
            input=raw_input,
            resolver_status=resolution.resolver_status,
            resolver_confidence=resolution.resolver_confidence,
            resolver_note=resolution.resolver_note,
            fetch_status="not_attempted",
            report_status="domain_unresolved",
            verified_report=False,
            domain_candidates=[
                {"domain": c.domain, "url": c.url, "confidence": c.confidence}
                for c in resolution.candidates
            ],
            locked_sections=locked,
            redaction_level=redact,
            user_message=resolution.resolver_note or (
                f'"{raw_input}" için resmi domain bulunamadı. '
                f"Lütfen resmi web sitesi adresini girin (örn: {raw_input}.com)."
            ),
            brand_dna_ready=False,
            ai_enrichment_ready=False,
            min_creator_pool=_MIN_CREATOR_POOL,
            creator_matching_ready=False,
            trust_scores_ready=False,
            blocked_sections=["brand_genome_dna", "genome_confidence", "creator_matches", "expansion", "insights"],
            blocked_reasons={
                "brand_genome_dna": "Domain çözümlenemedi",
                "genome_confidence": "Domain çözümlenemedi",
                "creator_matches": "Domain çözümlenemedi",
                "expansion": "Domain çözümlenemedi",
                "insights": "Domain çözümlenemedi",
            },
        )

    # ── 2. Website fetch ──────────────────────────────────────────────────────
    fetch_url = resolution.resolved_url or f"https://{resolution.resolved_domain}"
    evidence = await fetch_brand_website(fetch_url)
    fetched_at = datetime.now(timezone.utc)

    fetch_ok = evidence.fetch_status == "success"
    verified = fetch_ok and evidence.evidence_quality not in ("none",)

    # Determine report_status
    if not fetch_ok:
        report_status = "fetch_failed"
    elif not verified:
        report_status = "insufficient_web_evidence"
    else:
        report_status = "verified"

    # ── 3. Persist snapshot ───────────────────────────────────────────────────
    snap = BrandAnalysisSnapshot(
        user_id=current_user.id,
        input_value=raw_input,
        normalized_input=resolution.normalized_input,
        resolved_domain=resolution.resolved_domain,
        resolver_status=resolution.resolver_status,
        resolver_confidence=resolution.resolver_confidence,
        fetch_status=evidence.fetch_status,
        fetch_error=evidence.fetch_error,
        http_status=evidence.http_status,
        final_url=evidence.final_url,
        fetched_at=fetched_at,
        verified_evidence=verified,
        extracted_title=evidence.page_title,
        extracted_description=evidence.meta_description,
        extracted_language=evidence.language,
        evidence_quality=evidence.evidence_quality,
        report_status=report_status,
        redaction_level=redact,
    )
    db.add(snap)
    await db.commit()
    await db.refresh(snap)

    # ── 4. Build evidence response ────────────────────────────────────────────
    ev_resp = EvidenceResponse(
        url=evidence.url,
        fetchStatus=evidence.fetch_status,
        fetchError=evidence.fetch_error,
        httpStatus=evidence.http_status,
        finalUrl=evidence.final_url,
        responseTimeMs=evidence.response_time_ms,
        pageTitle=evidence.page_title,
        metaDescription=evidence.meta_description,
        ogTitle=evidence.og_title,
        ogDescription=evidence.og_description,
        h1s=evidence.h1s,
        h2s=evidence.h2s,
        bodySnippets=evidence.body_snippets,
        keywordHints=evidence.keyword_hints,
        socialLinks=evidence.social_links,
        language=evidence.language,
        aiUsed=False,
        targetMarket=body.target_market,
        evidenceQuality=evidence.evidence_quality,
    )

    user_message = None
    if not fetch_ok:
        user_message = (
            f"Web sitesi alınamadı ({evidence.fetch_error or evidence.fetch_status}). "
            f"Doğrulanmış rapor üretilmedi."
        )
    elif not verified:
        user_message = (
            "Web sitesinden yeterli içerik çıkarılamadı. "
            "Rapor doğrulanmış veri içermeyebilir."
        )

    return BrandMatchAnalyzeResponse(
        analysis_id=snap.id,
        input=raw_input,
        resolved_domain=resolution.resolved_domain,
        resolved_url=resolution.resolved_url,
        resolver_status=resolution.resolver_status,
        resolver_confidence=resolution.resolver_confidence,
        resolver_note=resolution.resolver_note,
        fetch_status=evidence.fetch_status,
        report_status=report_status,
        verified_report=verified,
        evidence=ev_resp,
        domain_candidates=[
            {"domain": c.domain, "url": c.url, "confidence": c.confidence}
            for c in resolution.candidates
        ],
        locked_sections=locked,
        redaction_level=redact,
        user_message=user_message,
        brand_dna_ready=verified,
        ai_enrichment_ready=False,
        min_creator_pool=_MIN_CREATOR_POOL,
        creator_matching_ready=False,  # always False from backend; computed client-side
        trust_scores_ready=verified,
        blocked_sections=[] if verified else ["brand_genome_dna", "genome_confidence"],
        blocked_reasons={} if verified else {
            "brand_genome_dna": "Web sitesi verisi doğrulanamadı",
            "genome_confidence": "Web sitesi verisi doğrulanamadı",
        },
    )
