"""
Analyze Routes — Part 4 güncellemesi.
Mevcut akış: get_profile → score_engine → ai_report → return
Yeni eklenen: opsiyonel agent_insights (sadece ?with_insights=true ise)
Mevcut endpointler bozulmaz.
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.core.database import get_db
from app.core.deps import get_current_user, require_credits
from app.models.user import User
from app.models.analysis import Analysis
from app.schemas.analysis import AnalyzeRequest, DiscoveryRequest, AnalysisSummary
from app.services.data_provider import get_profile, discovery_profiles
from app.services.score_engine import score_profile
from app.services.ai_report import generate_report

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("")
async def analyze(
    req: AnalyzeRequest,
    with_insights: bool = Query(False, description="Agent AI insight eklensin mi? (daha yavaş)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_credits()),
):
    try:
        cfg     = _build_cfg()
        profile = await asyncio.to_thread(get_profile, req.username, req.platform, cfg)
        scores  = score_profile(profile, req.brand or "Genel Marka")
        report  = generate_report(profile, scores, req.brand or "Genel Marka")

        analysis = Analysis(
            user_id=user.id,
            username=profile.get("username", req.username),
            platform=req.platform,
            brand=req.brand,
            profile_data=profile,
            final_score=scores["final_score"],
            authenticity_score=scores["authenticity"],
            fraud_score=scores["fraud_score"],
            momentum_score=scores["momentum"],
            brand_fit_score=scores["brand_fit"],
            engagement_quality_score=scores["engagement_quality"],
            roi_potential_score=scores["roi_potential"],
            reputation_risk_score=scores["reputation_risk"],
            fraud_risk=scores["fraud_risk"],
            decision=scores["decision"],
            report_data=report,
            followers=profile.get("followers", 0),
            engagement_rate=profile.get("engagement_rate", 0),
            avg_views=profile.get("avg_views", 0),
        )
        db.add(analysis)
        user.credits_remaining = max(0, user.credits_remaining - 1)
        await db.flush()

        # ── Opsiyonel agent insight ───────────────────────────────────────────
        agent_insights = None
        if with_insights:
            agent_insights = await _generate_agent_insights(
                db=db,
                analysis=analysis,
                profile=profile,
                scores=scores,
                brand=req.brand or "Genel Marka",
                user=user,
            )

        return {
            "success":           True,
            "analysis_id":       analysis.id,
            "profile":           profile,
            "scores":            scores,
            "report":            report,
            "similar":           [],
            "credits_remaining": user.credits_remaining,
            "agent_insights":    agent_insights,  # None if not requested
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analiz sırasında hata: {str(e)}")


async def _generate_agent_insights(
    db: AsyncSession,
    analysis,
    profile: dict,
    scores: dict,
    brand: str,
    user: User,
) -> dict:
    """
    Mevcut analiz verisi üzerinde agent insight üretir.
    Hata olursa None döner — ana analiz etkilenmez.
    """
    try:
        from app.services.agents.agent_factory import get_agent_class_for_slug
        from app.services.agent_registry import get_agent_by_slug
        from app.services.agent_task_engine import create_task

        input_data = {"profile": profile, "scores": scores, "brand": brand}
        insights = {}

        for slug, task_type in [
            ("analysis-agent",  "analysis_insight"),
            ("fraud-agent",     "fraud_analysis"),
            ("brand-fit-agent", "brand_fit_analysis"),
            ("roi-prediction-agent", "roi_prediction"),
        ]:
            agent_record = await get_agent_by_slug(db, slug)
            AgentClass   = get_agent_class_for_slug(slug)
            if not agent_record or not AgentClass:
                continue

            task = await create_task(
                session=db,
                agent_id=agent_record.id,
                title=f"[AUTO] {slug} → analysis #{analysis.id}",
                task_type=task_type,
                input_data=input_data,
                description=f"Otomatik insight: @{profile.get('username')} analizi",
            )
            agent_instance = AgentClass(agent_record=agent_record, db=db)
            result = await agent_instance.execute(task)

            from app.models.agent import AgentRun
            from datetime import datetime, timezone
            run = AgentRun(
                agent_id=agent_record.id, task_id=task.id,
                provider="mock", model=f"insight-{slug}-v1",
                status="completed", input_tokens=result.input_tokens,
                output_tokens=result.output_tokens, cost_estimate=0.0,
                latency_ms=result.latency_ms,
                started_at=datetime.now(timezone.utc), completed_at=datetime.now(timezone.utc),
            )
            db.add(run)

            from app.models.agent import TaskStatus
            from datetime import datetime, timezone
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now(timezone.utc)
            task.output_data  = result.output

            await db.flush()
            insights[slug.replace("-agent", "")] = result.output

        return insights
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Agent insights üretilemedi: %s", exc)
        return None


@router.get("/history")
async def history(
    limit: int = 20, offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Analysis).where(Analysis.user_id == user.id)
        .order_by(desc(Analysis.created_at)).limit(limit).offset(offset)
    )
    analyses = result.scalars().all()
    count_result = await db.execute(
        select(func.count(Analysis.id)).where(Analysis.user_id == user.id)
    )
    total = count_result.scalar() or 0
    return {"items": [AnalysisSummary.model_validate(a) for a in analyses], "total": total}


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Analysis).where(Analysis.id == analysis_id, Analysis.user_id == user.id)
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analiz bulunamadı.")
    return {
        "analysis_id":  analysis.id,
        "profile":      analysis.profile_data,
        "scores": {
            "final_score":           analysis.final_score,
            "authenticity":          analysis.authenticity_score,
            "fraud_score":           analysis.fraud_score,
            "momentum":              analysis.momentum_score,
            "brand_fit":             analysis.brand_fit_score,
            "engagement_quality":    analysis.engagement_quality_score,
            "roi_potential":         analysis.roi_potential_score,
            "reputation_risk":       analysis.reputation_risk_score,
            "fraud_risk":            analysis.fraud_risk,
            "decision":              analysis.decision,
        },
        "report":       analysis.report_data,
        "created_at":   analysis.created_at.isoformat(),
    }


@router.post("/discovery")
async def discovery(
    req: DiscoveryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cfg = _build_cfg()
    raw = await asyncio.to_thread(
        discovery_profiles, req.platform, req.category, req.country, req.limit, cfg
    )
    rows = []
    for p in raw:
        s = score_profile(p, "Genel Marka")
        if (p.get("followers", 0) >= req.min_followers
                and s["fraud_score"] <= req.max_fraud
                and s["brand_fit"] >= req.min_brand_fit):
            rows.append({"profile": p, "scores": s})
    return {"items": rows, "total": len(rows)}


def _build_cfg() -> dict:
    return {}
