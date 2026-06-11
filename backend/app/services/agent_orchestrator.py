"""
Agent Orchestrator — Part 11
Replaced hardcoded scripted dialogue with real task-based orchestration.
run_mock_scenario → run_orchestration (mode-aware, no hardcoded script).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.agent import (
    Agent, AgentTask, AgentConversation, AgentApproval,
    SenderType, MessageType, TaskStatus, TaskPriority, RiskLevel,
    ApprovalStatus, AgentMode,
)
from app.services.agent_registry import get_agent_by_slug
from app.services.agent_task_engine import create_task, run_task
from app.services.agent_conversation_service import create_conversation, add_message

logger = logging.getLogger(__name__)


# ── Sub-task definitions per orchestration type ───────────────────────────────

ORCHESTRATION_PLANS: dict[str, list[dict]] = {
    "orchestrated_review": [
        {"slug": "ops-agent",              "title": "Sistem durumu ve servis sağlığı kontrolü"},
        {"slug": "product-manager",        "title": "Ürün roadmap ve öncelik değerlendirmesi"},
        {"slug": "qa-test-agent",          "title": "Kalite kontrol ve test kapsamı analizi"},
        {"slug": "legal-compliance-agent", "title": "Uyumluluk ve risk değerlendirmesi"},
        {"slug": "finance-pricing-agent",  "title": "Finansal sürdürülebilirlik özeti"},
    ],
    "system_health_review": [
        {"slug": "ops-agent",              "title": "Sistem sağlık raporu"},
        {"slug": "qa-test-agent",          "title": "Test kapsamı değerlendirmesi"},
        {"slug": "legal-compliance-agent", "title": "Uyumluluk kontrolü"},
    ],
    "product_roadmap_review": [
        {"slug": "product-manager",        "title": "Roadmap önceliklendirmesi"},
        {"slug": "legal-compliance-agent", "title": "Yasal kısıtlamalar kontrolü"},
    ],
    "code_change_plan": [
        {"slug": "dev-agent",     "title": "Teknik değişiklik planı"},
        {"slug": "qa-test-agent", "title": "Test stratejisi"},
        {"slug": "legal-compliance-agent", "title": "Uyumluluk etkisi"},
    ],
    "pricing_review": [
        {"slug": "finance-pricing-agent", "title": "Fiyatlandırma analizi ve önerisi"},
    ],
    "compliance_review": [
        {"slug": "legal-compliance-agent", "title": "Tam uyumluluk denetimi"},
    ],
    "qa_checklist": [
        {"slug": "qa-test-agent", "title": "QA test listesi oluşturma"},
    ],
    "security_audit": [
        {"slug": "security-agent",         "title": "Platform güvenlik taraması"},
        {"slug": "legal-compliance-agent", "title": "Uyumluluk değerlendirmesi"},
        {"slug": "ops-agent",              "title": "Sistem erişim logları"},
    ],
    "technical_review": [
        {"slug": "cto-agent",              "title": "Teknik mimari incelemesi"},
        {"slug": "dev-agent",              "title": "Kod değişiklik planı"},
        {"slug": "qa-test-agent",          "title": "Test kapsamı değerlendirmesi"},
    ],
    "data_quality_audit": [
        {"slug": "data-quality-agent",     "title": "Veri kalitesi denetimi"},
        {"slug": "archive-cleaner-agent",  "title": "Stale/duplicate profil tespiti"},
        {"slug": "archive-category-agent", "title": "Kategori eksikliği taraması"},
    ],
    "weekly_executive_summary": [
        {"slug": "ceo-orchestrator",        "title": "Yönetim özeti"},
        {"slug": "finance-pricing-agent",   "title": "Finansal performans özeti"},
        {"slug": "ops-agent",               "title": "Operasyonel durum raporu"},
        {"slug": "security-agent",          "title": "Haftalık güvenlik özeti"},
    ],
}


async def run_orchestration(
    session: AsyncSession,
    title: str,
    task_type: str = "orchestrated_review",
    description: Optional[str] = None,
    priority: str = "normal",
    triggered_by_user_id: Optional[int] = None,
) -> dict[str, Any]:
    """
    Mode-aware orchestration run.
    Creates real tasks and runs them through the task engine (mock or active).
    NO hardcoded scripted dialogue — agent responses come from the actual agent execution.
    """
    ceo = await get_agent_by_slug(session, "ceo-orchestrator")
    if not ceo:
        return {"error": "CEO agent bulunamadı. Sistemi yeniden başlatın."}

    plan = ORCHESTRATION_PLANS.get(task_type, ORCHESTRATION_PLANS["orchestrated_review"])

    # Determine execution mode from CEO agent
    mode_label = ceo.mode.value.upper() if ceo else "MOCK"
    is_mock = (ceo.mode != AgentMode.ACTIVE) if ceo else True

    # ── Main task (CEO owned) ─────────────────────────────────────────────────
    main_task = await create_task(
        session=session,
        agent_id=ceo.id,
        title=title,
        task_type=task_type,
        description=description or f"Orchestrated review — type: {task_type}",
        priority=TaskPriority(priority) if priority in ("low", "normal", "high", "urgent") else TaskPriority.NORMAL,
        risk_level=RiskLevel.LOW,
        requires_approval=False,
        created_by_user_id=triggered_by_user_id,
        input_data={
            "trigger": "admin_orchestration",
            "task_type": task_type,
            "mode": mode_label,
            "is_mock": is_mock,
        },
    )

    # ── Conversation log ──────────────────────────────────────────────────────
    conv = await create_conversation(
        session=session,
        title=f"{title} — {mode_label} Mode",
        source="orchestration",
        related_task_id=main_task.id,
    )

    # CEO opening message
    await add_message(
        session=session,
        conversation_id=conv.id,
        sender_name=ceo.name,
        content=f"Orchestrated review başlatılıyor: '{title}'. Mode: {mode_label}. "
                f"{'Bu run mock modunda çalışmaktadır — gerçek API çağrısı yapılmamaktadır.' if is_mock else 'Gerçek AI sağlayıcıları kullanılmaktadır.'}",
        sender_type=SenderType.AGENT,
        message_type=MessageType.INSTRUCTION,
        agent_id=ceo.id,
        metadata={"slug": "ceo-orchestrator", "is_mock": is_mock, "mode": mode_label},
    )

    # ── Run main CEO task ─────────────────────────────────────────────────────
    ceo_run = await run_task(session=session, task_id=main_task.id)

    # ── Sub-tasks for each planned agent ─────────────────────────────────────
    sub_task_ids: list[int] = []
    risk_levels: list[str] = []
    approval_id: Optional[int] = None

    for step in plan:
        sub_agent = await get_agent_by_slug(session, step["slug"])
        if not sub_agent or not sub_agent.is_enabled:
            await add_message(
                session=session,
                conversation_id=conv.id,
                sender_name="System",
                content=f"Agent '{step['slug']}' bulunamadı veya devre dışı — adım atlandı.",
                sender_type=SenderType.SYSTEM,
                message_type=MessageType.WARNING,
                metadata={"slug": step["slug"], "skipped": True},
            )
            continue

        sub = await create_task(
            session=session,
            agent_id=sub_agent.id,
            title=step["title"],
            task_type=f"sub_{task_type}",
            priority=TaskPriority.NORMAL,
            risk_level=RiskLevel.LOW,
            requires_approval=sub_agent.risk_level.value in ("high", "critical"),
            created_by_user_id=triggered_by_user_id,
            parent_task_id=main_task.id,
            input_data={"parent_task_id": main_task.id, "orchestration_type": task_type, "is_mock": is_mock},
        )
        sub_task_ids.append(sub.id)

        sub_run = await run_task(session=session, task_id=sub.id)

        # Log agent result into conversation
        result_content = _extract_result_content(sub)
        await add_message(
            session=session,
            conversation_id=conv.id,
            sender_name=sub_agent.name,
            content=result_content,
            sender_type=SenderType.AGENT,
            message_type=MessageType.RESULT,
            agent_id=sub_agent.id,
            metadata={
                "slug": sub_agent.slug,
                "is_mock": is_mock,
                "task_id": sub.id,
                "run_id": sub_run.id if sub_run else None,
                "status": sub.status.value if sub.status else "unknown",
            },
        )
        risk_levels.append(sub.risk_level.value if sub.risk_level else "low")

        # If approval needed, log it
        if sub.status == TaskStatus.WAITING_APPROVAL:
            await add_message(
                session=session,
                conversation_id=conv.id,
                sender_name="System",
                content=f"Yüksek riskli işlem: '{step['title']}' — İnsan onayı bekleniyor.",
                sender_type=SenderType.SYSTEM,
                message_type=MessageType.APPROVAL_REQUEST,
                metadata={"task_id": sub.id, "slug": sub_agent.slug},
            )

    # ── Overall risk assessment ───────────────────────────────────────────────
    highest_risk = _highest_risk(risk_levels)
    needs_ceo_approval = highest_risk in ("high", "critical")

    if needs_ceo_approval:
        from app.services.agent_approval_service import create_approval
        approval = await create_approval(
            session=session,
            action_type="orchestration_high_risk",
            title=f"Yüksek Riskli Orchestration: {title}",
            description=f"Orchestrated review '{task_type}' yüksek riskli alt görev içeriyor.",
            risk_level=RiskLevel(highest_risk),
            task_id=main_task.id,
            requested_by_agent_id=ceo.id,
            payload={"sub_task_ids": sub_task_ids, "risk_level": highest_risk},
        )
        approval_id = approval.id

    # CEO closing summary
    summary_content = (
        f"Orchestration tamamlandı. {len(sub_task_ids)} alt görev çalıştırıldı. "
        f"En yüksek risk: {highest_risk.upper()}. "
        + (f"Onay #{approval_id} oluşturuldu." if approval_id else "Ek onay gerekmedi.")
        + (f" [MODE: {mode_label}]" if is_mock else "")
    )
    await add_message(
        session=session,
        conversation_id=conv.id,
        sender_name=ceo.name,
        content=summary_content,
        sender_type=SenderType.AGENT,
        message_type=MessageType.DECISION,
        agent_id=ceo.id,
        metadata={"slug": "ceo-orchestrator", "is_mock": is_mock, "final": True},
    )

    await session.flush()
    return {
        "success": True,
        "conversation_id": conv.id,
        "main_task_id": main_task.id,
        "sub_task_ids": sub_task_ids,
        "sub_task_count": len(sub_task_ids),
        "risk_level": highest_risk,
        "approval_id": approval_id,
        "mode": mode_label,
        "is_mock": is_mock,
        "run_id": ceo_run.id if ceo_run else None,
    }


def _extract_result_content(task: AgentTask) -> str:
    """Pull agent result from task output_data."""
    if not task.output_data:
        return f"Görev tamamlandı (çıktı yok)."
    if "response" in task.output_data:
        return str(task.output_data["response"])[:800]
    if "summary" in task.output_data:
        return str(task.output_data["summary"])[:800]
    if "error" in task.output_data:
        return f"Hata: {task.output_data['error']}"
    return f"Görev tamamlandı — durum: {task.status.value}."


def _highest_risk(risks: list[str]) -> str:
    order = ["critical", "high", "medium", "low"]
    for level in order:
        if level in risks:
            return level
    return "low"


# ── Legacy alias — kept for API backward-compatibility ────────────────────────
# The old run_mock_scenario is replaced by run_orchestration.
# External callers using `triggerMockAgentRun` in the frontend now hit
# POST /agents/mock-run which uses run_orchestration with mode awareness.

async def run_mock_scenario(
    session: AsyncSession,
    triggered_by_user_id: Optional[int] = None,
) -> dict[str, Any]:
    """Legacy alias — routes to run_orchestration. Kept for API backward-compatibility."""
    return await run_orchestration(
        session=session,
        title="Sistem Sağlık Kontrolü ve Durum Değerlendirmesi",
        task_type="system_health_review",
        description="Periyodik sistem kontrolü — tüm servislerin durumu değerlendirilir.",
        triggered_by_user_id=triggered_by_user_id,
    )


async def get_system_overview(session: AsyncSession) -> dict[str, Any]:
    """Orchestrator genel durum özeti."""
    from app.models.agent import AgentRun, AgentTask, AgentConversation

    agents_total = (await session.execute(select(func.count(Agent.id)))).scalar() or 0
    agents_enabled = (await session.execute(
        select(func.count(Agent.id)).where(Agent.is_enabled == True)
    )).scalar() or 0
    agents_scheduled = (await session.execute(
        select(func.count(Agent.id)).where(Agent.is_scheduled == True, Agent.is_enabled == True)
    )).scalar() or 0
    tasks_total = (await session.execute(select(func.count(AgentTask.id)))).scalar() or 0
    runs_total = (await session.execute(select(func.count(AgentRun.id)))).scalar() or 0
    convs_total = (await session.execute(select(func.count(AgentConversation.id)))).scalar() or 0
    pending_approvals = (await session.execute(
        select(func.count(AgentApproval.id)).where(AgentApproval.status == ApprovalStatus.PENDING)
    )).scalar() or 0
    mock_runs = (await session.execute(
        select(func.count(AgentRun.id)).where(AgentRun.is_mock == True)
    )).scalar() or 0

    # Count agents by mode
    from app.core.config import settings
    provider_mode = getattr(settings, "AGENTS_MODE", "mock")

    return {
        "agents_total":       agents_total,
        "agents_enabled":     agents_enabled,
        "agents_scheduled":   agents_scheduled,
        "tasks_total":        tasks_total,
        "runs_total":         runs_total,
        "runs_mock":          mock_runs,
        "conversations_total": convs_total,
        "pending_approvals":  pending_approvals,
        "system_status":      "operational",
        "provider_mode":      provider_mode,
    }
