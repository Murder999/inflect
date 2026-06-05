"""
Agent Extended Routes — Part 4 Growth Intelligence Endpoints.
Tüm draft çıktılar human approval gerektirir.
Dış işlem yapılmaz.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.user import User
from app.models.agent import AgentRun, TaskStatus
from app.services.agent_registry import get_agent_by_slug
from app.services.agent_task_engine import create_task
from app.services.agents.agent_factory import get_agent_class_for_slug

router = APIRouter(prefix="/agents", tags=["AI Growth Intelligence"])


class GrowthRequest(BaseModel):
    context: Optional[str] = None
    brand:   Optional[str] = None


class AnalysisInsightRequest(BaseModel):
    brand: Optional[str] = "Genel Marka"


class SalesDraftRequest(BaseModel):
    prospect_name:    str = "Degerli Musteri"
    prospect_company: str = "Hedef Sirket"
    recommended_plan: str = "starter"


class SupportDraftRequest(BaseModel):
    ticket_id: Optional[int] = None


async def _run_agent(
    db: AsyncSession,
    slug: str,
    task_type: str,
    title: str,
    input_data: dict,
    admin: User,
) -> dict:
    """
    Helper: agent yükle → task oluştur → çalıştır → AgentRun kaydet → sonuç döndür.
    H3, H4, H5 fix: timestamp + AgentRun kaydı.
    """
    agent_record = await get_agent_by_slug(db, slug)
    if not agent_record:
        raise HTTPException(503, f"Agent '{slug}' bulunamadi. Seed kontrolu yapin.")

    AgentClass = get_agent_class_for_slug(slug)
    if not AgentClass:
        raise HTTPException(503, f"Agent class '{slug}' yuklenemedi.")

    # Task oluştur
    task = await create_task(
        session=db, agent_id=agent_record.id,
        title=title, task_type=task_type,
        input_data=input_data, created_by_user_id=admin.id,
    )

    # Timestamp: started_at (H4 fix)
    started = datetime.now(timezone.utc)
    task.started_at = started

    instance = AgentClass(agent_record=agent_record, db=db)
    result = await instance.execute(task)

    completed = datetime.now(timezone.utc)

    # Task durumu + timestamp (H4 fix)
    task.status       = TaskStatus.COMPLETED if result.success else TaskStatus.FAILED
    task.completed_at = completed
    task.output_data  = result.output

    # AgentRun kaydı (H5 fix) — Run Logs'ta görünsün
    run = AgentRun(
        agent_id=agent_record.id,
        task_id=task.id,
        provider="mock",
        model=f"extended-{agent_record.role}-v1",
        status="completed" if result.success else "failed",
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        cost_estimate=0.0,
        latency_ms=result.latency_ms,
        started_at=started,
        completed_at=completed,
        metadata_={"part": "part-4", "endpoint": "extended", "agent_role": agent_record.role},
    )
    db.add(run)

    # Agent son çalışma zamanı
    from app.models.agent import AgentStatus
    agent_record.last_run_at = completed
    agent_record.status      = AgentStatus.IDLE

    await db.flush()

    from app.core.config import settings
    allow_external = settings.AGENTS_ALLOW_EXTERNAL_ACTIONS

    return {
        "success":           result.success,
        "task_id":           task.id,
        "run_id":            run.id,
        "risk_level":        result.risk_level,
        "requires_approval": result.requires_approval,
        "summary":           result.summary,
        "output":            result.output,
        "note": (
            "AGENTS_ALLOW_EXTERNAL_ACTIONS=false — dis islem yapilmadi."
            if not allow_external
            else "External actions enabled."
        ),
    }


# ─── Analysis Deep Insight ────────────────────────────────────────────────────

@router.post("/analysis/{analysis_id}/deep-insight")
async def analysis_deep_insight(
    analysis_id: int,
    req: AnalysisInsightRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Mevcut analiz icin 4 ajandan derinlemesine insight uretir."""
    from app.models.analysis import Analysis

    r = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = r.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, "Analiz bulunamadi.")

    profile = analysis.profile_data or {}
    scores = {
        "final_score":        analysis.final_score,
        "authenticity":       analysis.authenticity_score,
        "fraud_score":        analysis.fraud_score,
        "momentum":           analysis.momentum_score,
        "brand_fit":          analysis.brand_fit_score,
        "engagement_quality": analysis.engagement_quality_score,
        "roi_potential":      analysis.roi_potential_score,
        "reputation_risk":    analysis.reputation_risk_score,
        "fraud_risk":         analysis.fraud_risk,
        "decision":           analysis.decision,
        "fraud_detail":                profile.get("fraud_detail", {}),
        "brand_fit_campaign_types":    profile.get("brand_fit_campaign_types", []),
        "roi_prediction":              profile.get("roi_prediction", {}),
    }
    input_data = {"profile": profile, "scores": scores, "brand": req.brand}

    results: dict[str, Any] = {}
    for slug, task_type in [
        ("analysis-agent",       "analysis_insight"),
        ("fraud-agent",          "fraud_analysis"),
        ("brand-fit-agent",      "brand_fit_analysis"),
        ("roi-prediction-agent", "roi_prediction"),
    ]:
        try:
            r2 = await _run_agent(
                db=db, slug=slug, task_type=task_type,
                title=f"Deep insight: analysis #{analysis_id}",
                input_data=input_data, admin=admin,
            )
            results[slug.replace("-agent", "")] = r2["output"]
        except Exception as exc:
            results[slug.replace("-agent", "")] = {"error": str(exc)}

    return {"analysis_id": analysis_id, "brand": req.brand, "insights": results}


# ─── Premium Report ───────────────────────────────────────────────────────────

@router.post("/reports/{analysis_id}/premium-summary")
async def premium_report(
    analysis_id: int,
    req: AnalysisInsightRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Report Agent ile kurumsal premium rapor uretir."""
    from app.models.analysis import Analysis

    r = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = r.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, "Analiz bulunamadi.")

    profile = analysis.profile_data or {}
    scores = {
        "final_score":        analysis.final_score,
        "fraud_score":        analysis.fraud_score,
        "brand_fit":          analysis.brand_fit_score,
        "authenticity":       analysis.authenticity_score,
        "reputation_risk":    analysis.reputation_risk_score,
        "momentum":           analysis.momentum_score,
        "roi_potential":      analysis.roi_potential_score,
        "engagement_quality": analysis.engagement_quality_score,
        "decision":           analysis.decision,
        "brand_fit_campaign_types": [],
    }

    return await _run_agent(
        db=db, slug="report-agent", task_type="premium_report",
        title=f"Premium rapor: analysis #{analysis_id}",
        input_data={"profile": profile, "scores": scores, "report": analysis.report_data or {}, "brand": req.brand},
        admin=admin,
    )


# ─── Campaign AI Plan ─────────────────────────────────────────────────────────

@router.post("/campaigns/{campaign_id}/ai-plan")
async def campaign_ai_plan(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Campaign Planner Agent ile kampanya plani uretir."""
    from app.models.campaign import Campaign

    r = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = r.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Kampanya bulunamadi.")

    campaign_dict = {
        "id": campaign.id, "name": campaign.name, "brand": campaign.brand,
        "platform": campaign.platform, "budget": campaign.budget,
        "goal": campaign.goal, "category": campaign.category,
    }
    influencers = campaign.recommended_influencers or []
    roi_est     = campaign.roi_estimates or {}

    return await _run_agent(
        db=db, slug="campaign-planner-agent", task_type="campaign_plan",
        title=f"AI plan: {campaign.name}",
        input_data={"campaign": campaign_dict, "recommended_influencers": influencers, "roi_estimates": roi_est},
        admin=admin,
    )


# ─── Growth Endpoints ─────────────────────────────────────────────────────────

@router.post("/growth/seo-plan")
async def seo_plan(
    req: GrowthRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """SEO Agent ile icerik ve keyword plani uretir."""
    return await _run_agent(
        db=db, slug="seo-agent", task_type="seo_plan",
        title="SEO Plan",
        input_data={"context": req.context, "brand": req.brand},
        admin=admin,
    )


@router.post("/growth/ad-plan")
async def ad_plan(
    req: GrowthRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Ads Agent ile reklam kampanya fikirleri uretir. Reklam yayina almaz."""
    return await _run_agent(
        db=db, slug="ads-agent", task_type="ad_plan",
        title="Ad Plan Draft",
        input_data={"context": req.context, "brand": req.brand},
        admin=admin,
    )


@router.post("/growth/lead-plan")
async def lead_plan(
    req: GrowthRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Lead Finder Agent ile potansiyel musteri segmentleri uretir."""
    return await _run_agent(
        db=db, slug="lead-finder-agent", task_type="lead_plan",
        title="Lead Plan",
        input_data={"context": req.context, "brand": req.brand},
        admin=admin,
    )


# ─── Sales Endpoint ───────────────────────────────────────────────────────────

@router.post("/sales/draft-message")
async def sales_draft(
    req: SalesDraftRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Sales Agent ile satis mesaji taslagi uretir. Gonderimi admin yapar."""
    return await _run_agent(
        db=db, slug="sales-agent", task_type="sales_draft",
        title=f"Sales Draft: {req.prospect_company}",
        input_data={
            "prospect": {"name": req.prospect_name, "company": req.prospect_company},
            "recommended_plan": req.recommended_plan,
        },
        admin=admin,
    )


# ─── Support Draft ────────────────────────────────────────────────────────────

@router.post("/support/draft-reply")
async def support_draft(
    req: SupportDraftRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Support Agent ile ticket yanit taslagi uretir. Otomatik gondermez."""
    ticket_data: dict[str, Any] = {}
    if req.ticket_id:
        from app.models.admin_models import SupportTicket
        r = await db.execute(select(SupportTicket).where(SupportTicket.id == req.ticket_id))
        ticket = r.scalar_one_or_none()
        if ticket:
            ticket_data = {
                "subject":  ticket.subject,
                "category": ticket.category,
                "messages": ticket.messages or [],
                "status":   ticket.status,
            }

    return await _run_agent(
        db=db, slug="support-agent", task_type="support_draft",
        title=f"Support Draft: ticket #{req.ticket_id or 'new'}",
        input_data={"ticket": ticket_data},
        admin=admin,
    )
