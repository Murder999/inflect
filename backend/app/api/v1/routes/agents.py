"""
Agent Routes — AI Orchestrator Core (Part 1-3)
Tüm endpoint'ler admin yetkisi gerektirir.

ÖNEMLİ: FastAPI path matching sıralaması kritik.
Sabit path'ler ({param} içerenlerin ÖNÜNDE olmalı.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.user import User
from app.models.agent import (
    Agent, AgentTask, AgentRun,
    AgentConversation, AgentMessage, AgentEvent,
    AgentApproval, AgentMemory, AgentProviderHealth,
    AgentStatus, AgentMode, ModelProvider, RiskLevel,
    TaskStatus, TaskPriority, ApprovalStatus,
)
from app.services.agent_registry import list_agents, get_agent_by_id, get_agent_by_slug
from app.services.agent_task_engine import create_task, run_task, list_tasks, list_runs
from app.services.agent_orchestrator import run_mock_scenario, run_orchestration, get_system_overview
from app.services.event_bus import publish as publish_event, list_events as list_agent_events
from app.services.agent_conversation_service import (
    list_conversations, get_conversation_with_messages,
)
from app.services.agent_approval_service import (
    list_approvals,
    approve as approve_action,
    reject as reject_action,
)

router = APIRouter(prefix="/agents", tags=["AI Orchestrator"])


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class TaskCreateRequest(BaseModel):
    agent_id: int
    title: str
    task_type: str = "general"
    description: Optional[str] = None
    input_data: Optional[dict[str, Any]] = None
    priority: str = "normal"
    risk_level: str = "low"
    requires_approval: bool = False


class OrchestrationRequest(BaseModel):
    """CEO Agent tarafından çalıştırılan tam orkestrasyon görevi."""
    title: str
    description: Optional[str] = None
    task_type: str = "orchestrated_review"
    priority: str = "normal"


class ApprovalReviewRequest(BaseModel):
    note: Optional[str] = None


class ProviderUpdateRequest(BaseModel):
    """Admin: ajan için provider ve model güncelle."""
    model_provider: str  # mock|claude|openai|deepseek|gemini
    model_name: Optional[str] = None
    fallback_provider: Optional[str] = None  # fallback provider slug


class CopilotRequest(BaseModel):
    """Campaign Copilot: çok ajana zincirli kampanya workflow'u."""
    brand: str
    objective: str
    platform: str = "instagram"
    category: str = "Genel"
    budget: Optional[float] = None
    competitors: list[str] = []


class AgentModeUpdateRequest(BaseModel):
    """Admin: per-agent execution mode change."""
    mode: str  # mock | active | disabled


class EventCreateRequest(BaseModel):
    """Publish a system event to the event bus."""
    event_type: str
    payload: Optional[dict[str, Any]] = None
    source: str = "admin"


# ─── Serializers ─────────────────────────────────────────────────────────────

def _agent(a: Agent) -> dict:
    return {
        "id": a.id, "slug": a.slug, "name": a.name, "description": a.description,
        "role": a.role,
        "department": a.department,
        "status": a.status.value if hasattr(a.status, "value") else str(a.status),
        "mode": a.mode.value if hasattr(a.mode, "value") else str(getattr(a, "mode", "mock")),
        "model_provider": a.model_provider.value if hasattr(a.model_provider, "value") else str(a.model_provider),
        "model_name": a.model_name,
        "risk_level": a.risk_level.value if hasattr(a.risk_level, "value") else str(a.risk_level),
        "is_enabled": a.is_enabled,
        "is_scheduled": getattr(a, "is_scheduled", False),
        "schedule_cron": getattr(a, "schedule_cron", None),
        "next_run_at": a.next_run_at.isoformat() if getattr(a, "next_run_at", None) else None,
        "autonomy_level": getattr(a, "autonomy_level", "supervised"),
        "health_status": getattr(a, "health_status", "unknown"),
        "failure_count": getattr(a, "failure_count", 0),
        "last_error": getattr(a, "last_error", None),
        "last_run_at": a.last_run_at.isoformat() if a.last_run_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else "",
        "updated_at": a.updated_at.isoformat() if a.updated_at else "",
    }


def _task(t: AgentTask) -> dict:
    return {
        "id": t.id, "agent_id": t.agent_id, "parent_task_id": t.parent_task_id,
        "title": t.title, "description": t.description, "task_type": t.task_type,
        "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
        "risk_level": t.risk_level.value if hasattr(t.risk_level, "value") else str(t.risk_level),
        "requires_approval": t.requires_approval,
        "input_data": t.input_data, "output_data": t.output_data,
        "started_at": t.started_at.isoformat() if t.started_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else "",
    }


def _run(r: AgentRun) -> dict:
    return {
        "id": r.id, "agent_id": r.agent_id, "task_id": r.task_id,
        "provider": r.provider, "model": r.model, "status": r.status,
        "is_mock": getattr(r, "is_mock", True),
        "mode_used": getattr(r, "mode_used", None),
        "input_tokens": r.input_tokens, "output_tokens": r.output_tokens,
        "cost_estimate": r.cost_estimate, "latency_ms": r.latency_ms,
        "input_summary": getattr(r, "input_summary", None),
        "output_summary": getattr(r, "output_summary", None),
        "confidence": getattr(r, "confidence", None),
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "error_message": r.error_message, "metadata": r.metadata_,
    }


def _event(e: AgentEvent) -> dict:
    return {
        "id": e.id, "event_type": e.event_type, "payload": e.payload,
        "source": e.source, "status": e.status,
        "related_agent_id": e.related_agent_id,
        "related_task_id": e.related_task_id,
        "created_at": e.created_at.isoformat() if e.created_at else "",
        "processed_at": e.processed_at.isoformat() if e.processed_at else None,
        "error_message": e.error_message,
    }


def _conv(c: AgentConversation) -> dict:
    return {
        "id": c.id, "title": c.title, "source": c.source, "status": c.status,
        "related_task_id": c.related_task_id,
        "created_at": c.created_at.isoformat() if c.created_at else "",
        "updated_at": c.updated_at.isoformat() if c.updated_at else "",
    }


def _msg(m: AgentMessage) -> dict:
    return {
        "id": m.id, "conversation_id": m.conversation_id, "agent_id": m.agent_id,
        "sender_type": m.sender_type.value if hasattr(m.sender_type, "value") else str(m.sender_type),
        "sender_name": m.sender_name,
        "message_type": m.message_type.value if hasattr(m.message_type, "value") else str(m.message_type),
        "content": m.content, "metadata": m.metadata_,
        "created_at": m.created_at.isoformat() if m.created_at else "",
    }


def _approval(a: AgentApproval) -> dict:
    return {
        "id": a.id, "task_id": a.task_id,
        "requested_by_agent_id": a.requested_by_agent_id,
        "action_type": a.action_type, "title": a.title, "description": a.description,
        "risk_level": a.risk_level.value if hasattr(a.risk_level, "value") else str(a.risk_level),
        "payload": a.payload,
        "status": a.status.value if hasattr(a.status, "value") else str(a.status),
        "reviewed_by_user_id": a.reviewed_by_user_id, "review_note": a.review_note,
        "created_at": a.created_at.isoformat() if a.created_at else "",
        "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
    }


def _health(h: AgentProviderHealth) -> dict:
    return {
        "id": h.id, "provider": h.provider,
        "status": h.status.value if hasattr(h.status, "value") else str(h.status),
        "latency_ms": h.latency_ms,
        "last_checked_at": h.last_checked_at.isoformat() if h.last_checked_at else "",
        "error_message": h.error_message, "metadata": h.metadata_,
    }


# ─── SABIT PATH'LER (FastAPI matching order) ──────────────────────────────────

@router.get("")
async def get_agents(
    enabled_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    agent_list = await list_agents(db, enabled_only=enabled_only)
    overview = await get_system_overview(db)
    from app.services.agents.provider_client import _get_key
    from app.core.config import settings
    key_status = {
        "claude":   bool(_get_key("ANTHROPIC_API_KEY")),
        "openai":   bool(_get_key("OPENAI_API_KEY")),
        "deepseek": bool(_get_key("DEEPSEEK_API_KEY")),
        "gemini":   bool(_get_key("GEMINI_API_KEY")),
    }
    return {
        "agents":      [_agent(a) for a in agent_list],
        "total":       len(agent_list),
        "overview":    overview,
        "agents_mode": settings.AGENTS_MODE,
        "key_status":  key_status,
    }


@router.get("/overview")
async def get_overview(db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    return await get_system_overview(db)


@router.get("/tasks")
async def get_tasks(
    agent_id: Optional[int] = Query(None), status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin),
):
    tasks, total = await list_tasks(db, agent_id=agent_id, status=status, limit=limit, offset=offset)
    return {"tasks": [_task(t) for t in tasks], "total": total}


@router.post("/tasks")
async def create_agent_task(
    req: TaskCreateRequest,
    db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin),
):
    ag = await get_agent_by_id(db, req.agent_id)
    if not ag:
        raise HTTPException(404, "Agent bulunamadı.")
    if not ag.is_enabled:
        raise HTTPException(400, "Agent devre dışı.")
    try:
        priority = TaskPriority(req.priority)
    except ValueError:
        priority = TaskPriority.NORMAL
    try:
        risk = RiskLevel(req.risk_level)
    except ValueError:
        risk = RiskLevel.LOW
    t = await create_task(
        session=db, agent_id=ag.id, title=req.title,
        task_type=req.task_type, description=req.description,
        input_data=req.input_data, priority=priority,
        risk_level=risk, requires_approval=req.requires_approval,
        created_by_user_id=admin.id,
    )
    return {"success": True, "task": _task(t)}


@router.get("/runs")
async def get_runs(
    agent_id: Optional[int] = Query(None), limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin),
):
    run_list = await list_runs(db, agent_id=agent_id, limit=limit)
    return {"runs": [_run(r) for r in run_list], "total": len(run_list)}


@router.get("/conversations")
async def get_conversations(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin),
):
    convs, total = await list_conversations(db, limit=limit, offset=offset)
    return {"conversations": [_conv(c) for c in convs], "total": total}


@router.get("/approvals")
async def get_approvals(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin),
):
    appr = await list_approvals(db, status=status)
    return {"approvals": [_approval(a) for a in appr], "total": len(appr)}


@router.get("/provider-health")
async def get_provider_health(db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    result = await db.execute(select(AgentProviderHealth).order_by(AgentProviderHealth.provider))
    providers = result.scalars().all()
    return {"providers": [_health(p) for p in providers], "total": len(providers), "note": "Part 3: Mock mode."}


@router.post("/mock-run")
async def mock_run(db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    """Backward-compatible mock run — returns enriched response for frontend."""
    result = await run_mock_scenario(session=db, triggered_by_user_id=admin.id)

    # Enrich response with fields expected by frontend
    conv_id = result.get("conversation_id")
    message_count = 0
    if conv_id:
        from app.services.agent_conversation_service import get_conversation_with_messages
        conv, msgs = await get_conversation_with_messages(db, conv_id)
        message_count = len(msgs)

    sub_task_ids = result.get("sub_task_ids", [])
    agents_involved: list[str] = []
    for tid in sub_task_ids:
        t_res = await db.execute(
            select(AgentTask).where(AgentTask.id == tid)
        )
        t = t_res.scalar_one_or_none()
        if t:
            a_res = await db.execute(select(Agent).where(Agent.id == t.agent_id))
            ag = a_res.scalar_one_or_none()
            if ag and ag.slug not in agents_involved:
                agents_involved.append(ag.slug)

    return {
        **result,
        "scenario": "system_health_review",
        "message_count": message_count,
        "agents_involved": agents_involved,
        "note": f"Orchestration {'MOCK' if result.get('is_mock') else 'ACTIVE'} modunda tamamlandı.",
    }


@router.post("/orchestrate")
async def orchestrate(
    req: OrchestrationRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Mode-aware orchestration via CEO Agent.
    No hardcoded scripts — runs real tasks through the task engine.
    In MOCK mode: agent responses come from role-appropriate mock templates.
    In ACTIVE mode: real LLM providers used (API keys required).
    """
    result = await run_orchestration(
        session=db,
        title=req.title,
        task_type=req.task_type,
        description=req.description,
        priority=req.priority,
        triggered_by_user_id=admin.id,
    )
    if "error" in result:
        raise HTTPException(503, result["error"])
    return result


@router.get("/events")
async def get_events(
    event_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """List persisted agent events from the event bus."""
    events = await list_agent_events(db, limit=limit, event_type=event_type, status=status)
    return {"events": [_event(e) for e in events], "total": len(events)}


@router.post("/events")
async def create_event(
    req: EventCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Publish an event to the agent event bus (admin-triggered)."""
    event = await publish_event(db, event_type=req.event_type, payload=req.payload, source=req.source)
    return {"success": True, "event": _event(event)}


# ─── PARAMETRELİ PATH'LER SONDA ───────────────────────────────────────────────

@router.get("/tasks/{task_id}")
async def get_task(task_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    result = await db.execute(select(AgentTask).where(AgentTask.id == task_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Task bulunamadı.")
    run_result = await db.execute(
        select(AgentRun).where(AgentRun.task_id == task_id).order_by(desc(AgentRun.id))
    )
    return {**_task(t), "runs": [_run(r) for r in run_result.scalars().all()]}


@router.post("/tasks/{task_id}/run")
async def run_agent_task(task_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    result = await db.execute(select(AgentTask).where(AgentTask.id == task_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Task bulunamadı.")
    if t.status not in (TaskStatus.PENDING, TaskStatus.FAILED):
        raise HTTPException(400, f"Task zaten '{t.status.value}' durumunda.")
    agentrun = await run_task(session=db, task_id=task_id)
    updated = (await db.execute(select(AgentTask).where(AgentTask.id == task_id))).scalar_one()
    return {"success": True, "task": _task(updated), "run": _run(agentrun) if agentrun else None}


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    conv, messages = await get_conversation_with_messages(db, conversation_id)
    if not conv:
        raise HTTPException(404, "Konuşma bulunamadı.")
    return {**_conv(conv), "messages": [_msg(m) for m in messages], "message_count": len(messages)}


@router.post("/approvals/{approval_id}/approve")
async def approve_request(approval_id: int, body: ApprovalReviewRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    result = await approve_action(db, approval_id, admin.id, body.note)
    if not result:
        raise HTTPException(404, "Approval bulunamadı veya zaten işlenmiş.")
    return {"success": True, "approval": _approval(result)}


@router.post("/approvals/{approval_id}/reject")
async def reject_request(approval_id: int, body: ApprovalReviewRequest, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    result = await reject_action(db, approval_id, admin.id, body.note)
    if not result:
        raise HTTPException(404, "Approval bulunamadı veya zaten işlenmiş.")
    return {"success": True, "approval": _approval(result)}


@router.get("/{agent_id}")
async def get_agent(agent_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)):
    ag = await get_agent_by_id(db, agent_id)
    if not ag:
        raise HTTPException(404, "Agent bulunamadı.")
    mem_result = await db.execute(
        select(AgentMemory).where(AgentMemory.agent_id == agent_id)
        .order_by(AgentMemory.updated_at.desc()).limit(20)
    )
    run_result = await db.execute(
        select(AgentRun).where(AgentRun.agent_id == agent_id)
        .order_by(desc(AgentRun.id)).limit(5)
    )
    return {
        **_agent(ag),
        "memories": [{"key": m.key, "value": m.value, "type": m.memory_type, "confidence": m.confidence}
                     for m in mem_result.scalars().all()],
        "recent_runs": [_run(r) for r in run_result.scalars().all()],
    }


@router.patch("/{agent_id}/mode")
async def update_agent_mode(
    agent_id: int,
    req: AgentModeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Admin: change per-agent execution mode.
    MOCK = simulated responses, no real API calls.
    ACTIVE = real LLM providers (requires API key).
    DISABLED = agent will not execute any tasks.
    """
    ag = await get_agent_by_id(db, agent_id)
    if not ag:
        raise HTTPException(404, "Agent bulunamadı.")

    valid_modes = ["mock", "active", "disabled"]
    if req.mode not in valid_modes:
        raise HTTPException(400, f"Geçersiz mode. Desteklenenler: {valid_modes}")

    from app.core.config import settings
    if req.mode == "active" and settings.AGENTS_MODE not in ("real", "live"):
        raise HTTPException(400, "ACTIVE mod için AGENTS_MODE=real gereklidir. .env dosyasını güncelleyin.")

    try:
        ag.mode = AgentMode(req.mode)
    except ValueError:
        ag.mode = AgentMode.MOCK

    if req.mode == "disabled":
        ag.is_enabled = False
    elif req.mode in ("mock", "active"):
        ag.is_enabled = True

    from datetime import datetime, timezone
    ag.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "success": True,
        "agent_id": agent_id,
        "mode": req.mode,
        "is_enabled": ag.is_enabled,
        "note": {
            "mock":     "Simüle yanıtlar. Gerçek API çağrısı yok.",
            "active":   "Gerçek LLM provider kullanılıyor. API key gerekli.",
            "disabled": "Agent devre dışı. Görev almaz.",
        }.get(req.mode, ""),
    }


@router.post("/schedule/{agent_slug}/trigger")
async def trigger_schedule_now(
    agent_slug: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Manually trigger a scheduled agent job immediately."""
    from app.services.agent_scheduler import trigger_job_now
    result = await trigger_job_now(db, agent_slug)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.patch("/{agent_id}/provider")
async def update_agent_provider(
    agent_id: int,
    req: ProviderUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Admin: Ajan için AI provider ve model ismini günceller.
    Fallback provider da saklanır (metadata_).
    """
    ag = await get_agent_by_id(db, agent_id)
    if not ag:
        raise HTTPException(404, "Agent bulunamadı.")

    # Provider geçerli mi?
    valid_providers = ["mock", "claude", "openai", "deepseek", "gemini"]
    if req.model_provider not in valid_providers:
        raise HTTPException(400, f"Geçersiz provider. Desteklenenler: {valid_providers}")

    try:
        ag.model_provider = ModelProvider(req.model_provider)
    except ValueError:
        ag.model_provider = ModelProvider.MOCK

    if req.model_name:
        ag.model_name = req.model_name

    # Fallback provider'u metadata'ya kaydet
    existing_meta = ag.__dict__.get("metadata_") or {}
    if req.fallback_provider:
        if req.fallback_provider not in valid_providers:
            raise HTTPException(400, f"Geçersiz fallback provider.")
        existing_meta["fallback_provider"] = req.fallback_provider

    from datetime import datetime, timezone
    ag.updated_at = datetime.now(timezone.utc)
    await db.flush()

    return {
        "success":          True,
        "agent_id":         agent_id,
        "model_provider":   req.model_provider,
        "model_name":       ag.model_name,
        "fallback_provider": req.fallback_provider,
        "note":             "Provider güncellendi. Mock mode'da gerçek API çağrısı yapılmaz.",
    }


@router.post("/copilot/campaign")
async def campaign_copilot(
    req: CopilotRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Campaign Copilot — Çok ajana zincirli workflow:
    Similar Creator → Analysis → Brand Fit → ROI → Campaign Planner → Report
    + Competitor Intel (opsiyonel)
    """
    from app.services.agents.agent_factory import get_agent_class_for_slug
    from app.services.agent_task_engine import create_task
    from datetime import datetime, timezone

    CHAIN = [
        ("similar-creator-agent",  "similar_creator",  "Benzer Creator Keşfi"),
        ("brand-fit-agent",        "brand_fit_analysis", "Marka Uyumu Analizi"),
        ("roi-prediction-agent",   "roi_prediction",    "ROI Tahmin"),
        ("campaign-planner-agent", "campaign_plan",     "Kampanya Planı"),
        ("report-agent",           "premium_report",    "Premium Rapor"),
    ]
    if req.competitors:
        CHAIN.insert(0, ("competitor-intel-agent", "competitor_intel", "Rakip Analizi"))

    input_data = {
        "brand":       req.brand,
        "objective":   req.objective,
        "platform":    req.platform,
        "category":    req.category,
        "budget":      req.budget,
        "competitors": req.competitors,
    }

    results   = []
    task_ids  = []
    total_cost = 0.0

    for slug, task_type, step_name in CHAIN:
        agent_record = await get_agent_by_slug(db, slug)
        AgentClass   = get_agent_class_for_slug(slug)
        if not agent_record or not AgentClass:
            results.append({"step": step_name, "slug": slug, "error": "Agent bulunamadı", "success": False})
            continue

        task = await create_task(
            session=db, agent_id=agent_record.id,
            title=f"[Copilot] {req.brand} — {step_name}",
            task_type=task_type,
            input_data={**input_data, "previous_results": results},
            created_by_user_id=admin.id,
        )

        started = datetime.now(timezone.utc)
        instance = AgentClass(agent_record=agent_record, db=db)
        result = await instance.execute(task)

        completed = datetime.now(timezone.utc)
        task.status = TaskStatus.COMPLETED if result.success else TaskStatus.FAILED
        task.output_data  = result.output
        task.started_at   = started
        task.completed_at = completed

        run = AgentRun(
            agent_id=agent_record.id, task_id=task.id,
            provider="mock", model=f"copilot-{slug}-v1",
            status="completed" if result.success else "failed",
            input_tokens=result.input_tokens, output_tokens=result.output_tokens,
            cost_estimate=0.0, latency_ms=result.latency_ms,
            started_at=started, completed_at=completed,
            metadata_={"part": "part-2", "copilot": True, "brand": req.brand},
        )
        db.add(run)
        task_ids.append(task.id)

        total_cost += 0.0  # mock
        results.append({
            "step":    step_name,
            "slug":    slug,
            "success": result.success,
            "summary": result.summary,
            "output":  result.output,
        })

        await db.flush()

    return {
        "brand":         req.brand,
        "objective":     req.objective,
        "steps_run":     len(results),
        "success_count": sum(1 for r in results if r.get("success")),
        "task_ids":      task_ids,
        "total_cost_usd": total_cost,
        "results":       results,
        "note":          "Campaign Copilot tamamlandı. Mock mode'da gerçek API çağrısı yapılmadı.",
    }
