"""
Agent Scheduler — Part 11
Asyncio-based background scheduler. Checks every 60s for agents due to run.
Uses next_run_at stored on Agent rows — no external dependency required.
Redis + ARQ migration path: replace _scheduler_loop with ARQ worker.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent, AgentTask, AgentMode
from app.models.agent import TaskPriority, RiskLevel, TaskStatus

logger = logging.getLogger(__name__)

_scheduler_task: asyncio.Task | None = None
_running = False


# ── Schedule helpers ──────────────────────────────────────────────────────────

def _next_run_from_cron(cron: str) -> datetime:
    now = datetime.now(timezone.utc)
    mapping = {
        "hourly":  timedelta(hours=1),
        "daily":   timedelta(days=1),
        "weekly":  timedelta(weeks=1),
    }
    delta = mapping.get(cron, timedelta(days=1))
    return now + delta


# ── Scheduled job definitions ─────────────────────────────────────────────────
# Each job maps to a task that gets created for the target agent.

SCHEDULED_JOBS: list[dict[str, Any]] = [
    {
        "slug":      "ops-agent",
        "title":     "[Scheduled] Sistem Sağlık Kontrolü",
        "task_type": "system_health_check",
        "priority":  TaskPriority.NORMAL,
        "risk":      RiskLevel.LOW,
        "cron":      "hourly",
        "description": "Periyodik sistem sağlık denetimi: DB bağlantısı, provider durumu, görev kuyruğu.",
    },
    {
        "slug":      "legal-compliance-agent",
        "title":     "[Scheduled] Günlük Uyumluluk Taraması",
        "task_type": "compliance_scan",
        "priority":  TaskPriority.NORMAL,
        "risk":      RiskLevel.LOW,
        "cron":      "daily",
        "description": "Günlük uyumluluk kontrolü: veri erişim logları, onay bekleyenler, yüksek riskli işlemler.",
    },
    {
        "slug":      "seo-agent",
        "title":     "[Scheduled] Günlük SEO Denetimi",
        "task_type": "seo_audit",
        "priority":  TaskPriority.LOW,
        "risk":      RiskLevel.LOW,
        "cron":      "daily",
        "description": "Platform SEO kontrolü: sayfa başlıkları, meta açıklamalar, eksik içerikler.",
    },
    {
        "slug":      "finance-pricing-agent",
        "title":     "[Scheduled] Günlük Finansal Özet",
        "task_type": "finance_summary",
        "priority":  TaskPriority.NORMAL,
        "risk":      RiskLevel.LOW,
        "cron":      "daily",
        "description": "Günlük gelir özeti, aktif abonelikler, bekleyen ödemeler.",
    },
    {
        "slug":      "ceo-orchestrator",
        "title":     "[Scheduled] Haftalık Yönetim Özeti",
        "task_type": "weekly_executive_summary",
        "priority":  TaskPriority.HIGH,
        "risk":      RiskLevel.LOW,
        "cron":      "weekly",
        "description": "Haftalık platform performansı: kullanıcı büyümesi, analiz hacmi, gelir trendi.",
    },
    {
        "slug":      "report-agent",
        "title":     "[Scheduled] Haftalık Aktivite Raporu",
        "task_type": "weekly_activity_report",
        "priority":  TaskPriority.NORMAL,
        "risk":      RiskLevel.LOW,
        "cron":      "weekly",
        "description": "Geçen haftanın tüm agent aktivitelerini özetler.",
    },
    {
        "slug":      "archive-trend-agent",
        "title":     "[Scheduled] Günlük Trend Analizi",
        "task_type": "trend_analysis",
        "priority":  TaskPriority.LOW,
        "risk":      RiskLevel.LOW,
        "cron":      "daily",
        "description": "Archive verisi üzerinden büyüme trendlerini hesaplar.",
    },
    # Part 11 new scheduled jobs
    {
        "slug":      "security-agent",
        "title":     "[Scheduled] Günlük Güvenlik Taraması",
        "task_type": "security_audit",
        "priority":  TaskPriority.HIGH,
        "risk":      RiskLevel.LOW,
        "cron":      "daily",
        "description": "Platform genelinde günlük güvenlik kontrolü: secret, auth, admin.",
    },
    {
        "slug":      "data-quality-agent",
        "title":     "[Scheduled] Günlük Veri Kalitesi Denetimi",
        "task_type": "data_quality_audit",
        "priority":  TaskPriority.LOW,
        "risk":      RiskLevel.LOW,
        "cron":      "daily",
        "description": "Archive profil kalitesi: eksik alanlar, duplicate tespiti, snapshot freshness.",
    },
    {
        "slug":      "cto-agent",
        "title":     "[Scheduled] Haftalık Teknik İnceleme",
        "task_type": "technical_review",
        "priority":  TaskPriority.NORMAL,
        "risk":      RiskLevel.LOW,
        "cron":      "weekly",
        "description": "Haftalık teknik mimari incelemesi: technical debt, API sağlığı, ölçeklenebilirlik.",
    },
]


async def _create_scheduled_task(
    session: AsyncSession,
    agent: Agent,
    job: dict[str, Any],
) -> AgentTask:
    task = AgentTask(
        agent_id=agent.id,
        title=job["title"],
        description=job["description"],
        task_type=job["task_type"],
        status=TaskStatus.PENDING,
        priority=job["priority"],
        risk_level=job["risk"],
        trigger_type="scheduled",
        input_data={"scheduled_at": datetime.now(timezone.utc).isoformat(), "cron": job["cron"]},
        requires_approval=False,
    )
    session.add(task)

    # Advance next_run_at immediately so duplicate fires don't happen
    agent.next_run_at = _next_run_from_cron(job["cron"])
    await session.flush()
    return task


async def _tick(get_session) -> None:
    """Single scheduler tick: find due agents and create tasks."""
    now = datetime.now(timezone.utc)
    # Small grace window: fire if within 90 seconds of due time
    due_before = now + timedelta(seconds=90)

    async with get_session() as session:
        result = await session.execute(
            select(Agent).where(
                Agent.is_scheduled == True,
                Agent.is_enabled == True,
                Agent.next_run_at != None,
                Agent.next_run_at <= due_before,
            )
        )
        due_agents: list[Agent] = list(result.scalars().all())

        if not due_agents:
            return

        for agent in due_agents:
            if agent.mode.value == "disabled":
                # Still advance next_run_at so we don't hammer a disabled agent
                agent.next_run_at = _next_run_from_cron(agent.schedule_cron or "daily")
                continue

            # Find matching job definition
            job = next((j for j in SCHEDULED_JOBS if j["slug"] == agent.slug), None)
            if not job:
                # No specific job definition — generic health task
                job = {
                    "title":       f"[Scheduled] {agent.name}",
                    "task_type":   "scheduled_run",
                    "priority":    TaskPriority.LOW,
                    "risk":        RiskLevel.LOW,
                    "cron":        agent.schedule_cron or "daily",
                    "description": f"Periyodik çalışma: {agent.name}",
                }

            try:
                task = await _create_scheduled_task(session, agent, job)
                logger.info("Scheduler: task #%d created for agent '%s' (%s).",
                            task.id, agent.slug, job["cron"])
            except Exception as exc:
                logger.error("Scheduler: failed to create task for '%s': %s", agent.slug, exc)
                agent.next_run_at = _next_run_from_cron(agent.schedule_cron or "daily")

        await session.commit()


async def _scheduler_loop(get_session) -> None:
    global _running
    logger.info("Agent scheduler started (interval: 60s).")
    while _running:
        try:
            await _tick(get_session)
        except Exception as exc:
            logger.error("Scheduler tick error: %s", exc, exc_info=True)
        await asyncio.sleep(60)


def start_scheduler(get_session) -> None:
    """Start the background scheduler. Call from lifespan startup."""
    global _scheduler_task, _running
    if _scheduler_task and not _scheduler_task.done():
        logger.warning("Scheduler already running.")
        return
    _running = True
    _scheduler_task = asyncio.create_task(_scheduler_loop(get_session))
    logger.info("✓ Agent scheduler task created.")


def stop_scheduler() -> None:
    """Stop the background scheduler. Call from lifespan shutdown."""
    global _scheduler_task, _running
    _running = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("Agent scheduler stopped.")


async def trigger_job_now(session: AsyncSession, agent_slug: str) -> dict:
    """Manually trigger a scheduled job immediately (admin action)."""
    from app.services.agent_registry import get_agent_by_slug
    agent = await get_agent_by_slug(session, agent_slug)
    if not agent:
        return {"error": f"Agent '{agent_slug}' bulunamadı."}
    if not agent.is_enabled:
        return {"error": f"Agent '{agent_slug}' devre dışı."}

    job = next((j for j in SCHEDULED_JOBS if j["slug"] == agent_slug), None)
    if not job:
        job = {
            "title":       f"[Manual Trigger] {agent.name}",
            "task_type":   "manual_scheduled_run",
            "priority":    TaskPriority.HIGH,
            "risk":        RiskLevel.LOW,
            "cron":        agent.schedule_cron or "daily",
            "description": f"Manuel tetikleme: {agent.name}",
        }

    task = await _create_scheduled_task(session, agent, job)
    return {
        "success": True,
        "task_id": task.id,
        "agent_slug": agent_slug,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
    }
