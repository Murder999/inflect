"""
Agent Orchestrator — Çok ajanlı koordinasyon ve mock run senaryosu.
Part 1: Tüm çalışmalar simüle edilir.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.agent import (
    Agent, AgentTask, AgentConversation,
    SenderType, MessageType, TaskStatus, TaskPriority, RiskLevel,
)
from app.services.agent_registry import get_agent_by_slug
from app.services.agent_task_engine import create_task, run_task
from app.services.agent_conversation_service import create_conversation, add_message

logger = logging.getLogger(__name__)


async def run_mock_scenario(
    session: AsyncSession,
    triggered_by_user_id: Optional[int] = None,
) -> dict[str, Any]:
    """
    Mock multi-agent konuşma senaryosu.
    Belirtilen konuşma akışını oluşturur, task ve run kayıtları üretir.
    """
    # ─── Ajanları yükle ───────────────────────────────────────────────────────
    slugs = ["ceo-orchestrator", "ops-agent", "product-manager", "legal-compliance-agent"]
    agents: dict[str, Agent] = {}
    for slug in slugs:
        agent = await get_agent_by_slug(session, slug)
        if agent:
            agents[slug] = agent

    if not agents:
        return {"error": "Ajanlar henüz seed edilmemiş. Sistemi yeniden başlatın."}

    ceo   = agents.get("ceo-orchestrator")
    ops   = agents.get("ops-agent")
    pm    = agents.get("product-manager")
    legal = agents.get("legal-compliance-agent")

    # ─── Ana görev ────────────────────────────────────────────────────────────
    main_task = await create_task(
        session=session,
        agent_id=ceo.id if ceo else list(agents.values())[0].id,
        title="Sistem Sağlık Kontrolü ve AI Agents MVP Değerlendirmesi",
        task_type="orchestration",
        description="Multi-agent koordinasyon: sistem sağlığı, ürün değerlendirmesi ve yasal onay.",
        priority=TaskPriority.NORMAL,
        risk_level=RiskLevel.LOW,
        requires_approval=False,
        created_by_user_id=triggered_by_user_id,
        input_data={"trigger": "manual_mock_run", "scenario": "system_health_check"},
    )

    # ─── Konuşma ──────────────────────────────────────────────────────────────
    conv = await create_conversation(
        session=session,
        title="System Health Check & MVP Review — Mock Run",
        source="mock_run",
        related_task_id=main_task.id,
    )

    # ─── Mesajları sırayla ekle ───────────────────────────────────────────────
    script = [
        {
            "agent": ceo,
            "slug": "ceo-orchestrator",
            "sender_type": SenderType.AGENT,
            "message_type": MessageType.INSTRUCTION,
            "content": "Ops Agent, sistem sağlığını kontrol et.",
        },
        {
            "agent": ops,
            "slug": "ops-agent",
            "sender_type": SenderType.AGENT,
            "message_type": MessageType.RESULT,
            "content": "Backend, frontend ve database aktif görünüyor. Provider health kontrol ediliyor.",
        },
        {
            "agent": pm,
            "slug": "product-manager",
            "sender_type": SenderType.AGENT,
            "message_type": MessageType.RESULT,
            "content": "AI Agents Center için ilk MVP hazırlandıktan sonra QA kontrolü öneriyorum.",
        },
        {
            "agent": legal,
            "slug": "legal-compliance-agent",
            "sender_type": SenderType.AGENT,
            "message_type": MessageType.DECISION,
            "content": "Dış platformlarda otomatik işlem yapılmadığı için mevcut mock run güvenli.",
        },
        {
            "agent": ceo,
            "slug": "ceo-orchestrator",
            "sender_type": SenderType.AGENT,
            "message_type": MessageType.DECISION,
            "content": "Görev tamamlandı. İnsan onayı gerekmiyor.",
        },
    ]

    message_ids = []
    for step in script:
        agent_obj = step.get("agent")
        msg = await add_message(
            session=session,
            conversation_id=conv.id,
            sender_name=agent_obj.name if agent_obj else step["slug"],
            content=step["content"],
            sender_type=step["sender_type"],
            message_type=step["message_type"],
            agent_id=agent_obj.id if agent_obj else None,
            metadata={"slug": step["slug"], "mock": True},
        )
        message_ids.append(msg.id)

    # ─── Task'ı çalıştır (mock) ───────────────────────────────────────────────
    run = await run_task(session=session, task_id=main_task.id)

    # ─── Sub-tasks: her ajan için bir kayıt ──────────────────────────────────
    sub_task_ids = []
    sub_agents = [ops, pm, legal]
    sub_titles = [
        "Sistem sağlık raporu hazırla",
        "MVP gereksinimlerini değerlendir",
        "Yasal uyumluluk kontrolü",
    ]
    for agent_obj, title in zip(sub_agents, sub_titles):
        if not agent_obj:
            continue
        sub = await create_task(
            session=session,
            agent_id=agent_obj.id,
            title=title,
            task_type="sub_task",
            priority=TaskPriority.NORMAL,
            risk_level=RiskLevel.LOW,
            requires_approval=False,
            created_by_user_id=triggered_by_user_id,
            parent_task_id=main_task.id,
        )
        await run_task(session=session, task_id=sub.id)
        sub_task_ids.append(sub.id)

    await session.flush()

    return {
        "success": True,
        "scenario": "system_health_check",
        "conversation_id": conv.id,
        "main_task_id": main_task.id,
        "sub_task_ids": sub_task_ids,
        "message_count": len(message_ids),
        "run_id": run.id if run else None,
        "agents_involved": [a.slug for a in agents.values()],
        "note": "Part 1 mock run — gerçek API çağrısı yapılmadı.",
    }


async def get_system_overview(session: AsyncSession) -> dict[str, Any]:
    """Orchestrator genel durum özeti."""
    from sqlalchemy import func
    from app.models.agent import AgentRun, AgentTask, AgentConversation, AgentApproval, ApprovalStatus

    agents_total = (await session.execute(select(func.count(Agent.id)))).scalar() or 0
    agents_enabled = (await session.execute(
        select(func.count(Agent.id)).where(Agent.is_enabled == True)
    )).scalar() or 0
    tasks_total = (await session.execute(select(func.count(AgentTask.id)))).scalar() or 0
    runs_total = (await session.execute(select(func.count(AgentRun.id)))).scalar() or 0
    convs_total = (await session.execute(select(func.count(AgentConversation.id)))).scalar() or 0
    pending_approvals = (await session.execute(
        select(func.count(AgentApproval.id)).where(AgentApproval.status == ApprovalStatus.PENDING)
    )).scalar() or 0

    return {
        "agents_total": agents_total,
        "agents_enabled": agents_enabled,
        "tasks_total": tasks_total,
        "runs_total": runs_total,
        "conversations_total": convs_total,
        "pending_approvals": pending_approvals,
        "system_status": "operational",
        "provider_mode": "mock",
    }
