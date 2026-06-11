"""
Agent Task Engine — Part 3 güncellemesi.
Artık gerçek agent class'larını çalıştırır.
Mock provider fallback olarak kalır.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.models.agent import (
    Agent, AgentTask, AgentRun,
    AgentStatus, TaskStatus, TaskPriority, RiskLevel,
)
from app.services.agents.agent_factory import get_agent_class_for_slug
from app.services.agent_mock_provider import mock_agent_response   # fallback
from app.services.agents.provider_client import _get_key

logger = logging.getLogger(__name__)


async def create_task(
    session: AsyncSession,
    agent_id: int,
    title: str,
    task_type: str = "general",
    description: Optional[str] = None,
    input_data: Optional[dict[str, Any]] = None,
    priority: TaskPriority = TaskPriority.NORMAL,
    risk_level: RiskLevel = RiskLevel.LOW,
    requires_approval: bool = False,
    created_by_user_id: Optional[int] = None,
    parent_task_id: Optional[int] = None,
) -> AgentTask:
    task = AgentTask(
        agent_id=agent_id,
        parent_task_id=parent_task_id,
        created_by_user_id=created_by_user_id,
        title=title,
        description=description,
        task_type=task_type,
        status=TaskStatus.PENDING,
        priority=priority,
        risk_level=risk_level,
        requires_approval=requires_approval,
        input_data=input_data or {},
    )
    session.add(task)
    await session.flush()
    return task


async def run_task(session: AsyncSession, task_id: int) -> Optional[AgentRun]:
    """
    Görevi çalıştırır.
    1. Agent slug'ına göre gerçek agent class'ını yükle.
    2. Bulunamazsa mock provider'a düş.
    """
    t_result = await session.execute(select(AgentTask).where(AgentTask.id == task_id))
    task = t_result.scalar_one_or_none()
    if not task:
        raise ValueError(f"Task {task_id} bulunamadı.")

    a_result = await session.execute(select(Agent).where(Agent.id == task.agent_id))
    agent = a_result.scalar_one_or_none()
    if not agent:
        raise ValueError(f"Agent {task.agent_id} bulunamadı.")

    # Onay gerekiyorsa
    if task.requires_approval and task.approval_id is None:
        task.status = TaskStatus.WAITING_APPROVAL
        await session.flush()
        return None

    # Running
    task.status = TaskStatus.RUNNING
    task.started_at = datetime.now(timezone.utc)
    agent.status = AgentStatus.ACTIVE
    agent.last_run_at = datetime.now(timezone.utc)
    await session.flush()

    try:
        from app.core.config import settings
        # Real mode'da key kontrolü — sessiz mock düşmesini engelle
        if settings.AGENTS_MODE in ("real", "live"):
            _KEY_MAP = {
                "claude":   "ANTHROPIC_API_KEY",
                "openai":   "OPENAI_API_KEY",
                "deepseek": "DEEPSEEK_API_KEY",
                "gemini":   "GEMINI_API_KEY",
            }
            prov = agent.model_provider.value
            env_var = _KEY_MAP.get(prov)
            if env_var and not _get_key(env_var):
                raise ValueError(
                    f"{env_var} eksik — {prov} provider AGENTS_MODE=real modunda çalışamaz. "
                    f"Provider'ı 'mock' olarak değiştirin veya ilgili API key'i ekleyin."
                )

        AgentClass = get_agent_class_for_slug(agent.slug)

        if AgentClass:
            # ── Gerçek agent çalıştır ─────────────────────────────────────────
            agent_instance = AgentClass(agent_record=agent, db=session)
            result = await agent_instance.execute(task)

            _is_mock = agent.model_provider.value == "mock"
            run = AgentRun(
                agent_id=agent.id,
                task_id=task.id,
                provider=agent.model_provider.value,
                model=f"structured-{agent.role}-v1",
                status="completed" if result.success else "failed",
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                cost_estimate=0.0,
                latency_ms=result.latency_ms,
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                is_mock=_is_mock,
                mode_used=agent.model_provider.value,
                output_summary=str(result.summary)[:400] if result.summary else None,
                metadata_={"agent_role": agent.role, "is_mock": _is_mock},
            )
            session.add(run)

            task.status = TaskStatus.COMPLETED if result.success else TaskStatus.FAILED
            task.completed_at = datetime.now(timezone.utc)
            task.output_data = {
                "summary": result.summary,
                "risk_level": result.risk_level,
                "requires_approval": result.requires_approval,
                **result.output,
            }
            task.risk_level = RiskLevel(result.risk_level)

        else:
            # ── Mock fallback ─────────────────────────────────────────────────
            logger.info("Agent class bulunamadı %s — mock fallback kullanılıyor.", agent.slug)
            mock_resp = mock_agent_response(
                agent_slug=agent.slug,
                agent_role=agent.role,
                task_type=task.task_type,
                prompt=task.description or task.title,
            )
            run = AgentRun(
                agent_id=agent.id,
                task_id=task.id,
                provider=mock_resp.provider.value,
                model=mock_resp.model,
                status="completed",
                input_tokens=mock_resp.input_tokens,
                output_tokens=mock_resp.output_tokens,
                cost_estimate=0.0,
                latency_ms=mock_resp.latency_ms,
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                is_mock=True,
                mode_used="mock",
                output_summary=str(mock_resp.content)[:400] if mock_resp.content else None,
                metadata_=mock_resp.metadata,
            )
            session.add(run)
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.now(timezone.utc)
            task.output_data = {"response": mock_resp.content, "provider": "mock"}

        agent.status = AgentStatus.IDLE
        await session.flush()

        logger.info("Task #%d tamamlandı — Agent: %s | %s",
                    task.id, agent.slug, "structured" if AgentClass else "mock")
        return run

    except Exception as exc:
        logger.error("Task #%d başarısız: %s", task_id, exc, exc_info=True)
        task.status = TaskStatus.FAILED
        task.completed_at = datetime.now(timezone.utc)
        task.output_data = {"error": str(exc)}
        agent.status = AgentStatus.ERROR
        await session.flush()

        run = AgentRun(
            agent_id=agent.id,
            task_id=task.id,
            provider=agent.model_provider.value,
            model="error",
            status="failed",
            error_message=str(exc)[:500],
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        session.add(run)
        await session.flush()
        return run


async def list_tasks(
    session: AsyncSession,
    agent_id: Optional[int] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AgentTask], int]:
    q = select(AgentTask).order_by(desc(AgentTask.created_at))
    if agent_id:
        q = q.where(AgentTask.agent_id == agent_id)
    if status:
        try:
            q = q.where(AgentTask.status == TaskStatus(status))
        except ValueError:
            pass

    count_q = select(func.count(AgentTask.id))
    if agent_id:
        count_q = count_q.where(AgentTask.agent_id == agent_id)
    if status:
        try:
            count_q = count_q.where(AgentTask.status == TaskStatus(status))
        except ValueError:
            pass

    total = (await session.execute(count_q)).scalar() or 0
    result = await session.execute(q.limit(limit).offset(offset))
    return list(result.scalars().all()), total


async def list_runs(
    session: AsyncSession,
    agent_id: Optional[int] = None,
    limit: int = 50,
) -> list[AgentRun]:
    q = select(AgentRun).order_by(desc(AgentRun.id)).limit(limit)
    if agent_id:
        q = q.where(AgentRun.agent_id == agent_id)
    result = await session.execute(q)
    return list(result.scalars().all())
