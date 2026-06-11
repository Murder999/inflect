"""
Agent Event Bus — Part 11
DB-backed event persistence and routing to relevant agents.
Every system event is stored, routed, and traceable.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent, AgentEvent, AgentTask, AgentMode, AgentStatus
from app.models.agent import TaskPriority, RiskLevel, TaskStatus

logger = logging.getLogger(__name__)

# ── Event → Agent routing table ───────────────────────────────────────────────
# Each event type maps to a list of agent slugs that should handle it.
# Agents in DISABLED mode are skipped at dispatch time.

EVENT_ROUTING: dict[str, list[str]] = {
    # Analysis events
    "analysis.created":           ["analysis-agent", "fraud-agent"],
    "analysis.completed":         ["report-agent"],
    # Campaign events
    "campaign.created":           ["campaign-planner-agent", "roi-prediction-agent"],
    "campaign.updated":           ["campaign-planner-agent"],
    "campaign.budget_exceeded":   ["finance-pricing-agent", "ceo-orchestrator"],
    # User lifecycle
    "user.registered":            ["support-agent"],
    "user.churned":               ["sales-agent", "ceo-orchestrator"],
    # Payments
    "payment.succeeded":          ["finance-pricing-agent"],
    "payment.failed":             ["support-agent", "finance-pricing-agent"],
    # System health
    "system.health_check":        ["ops-agent"],
    "system.error_spike":         ["ops-agent", "dev-agent"],
    "provider.error":             ["ops-agent"],
    "provider.recovered":         ["ops-agent"],
    # Archive
    "archive.imported":           ["archive-category-agent", "archive-classifier"],
    "archive.stale_detected":     ["archive-cleaner-agent"],
    # Agent system
    "agent.failed":               ["ops-agent", "ceo-orchestrator"],
    "agent.approval_expired":     ["ceo-orchestrator"],
    # Security
    "security.alert":             ["legal-compliance-agent", "ceo-orchestrator"],
    "security.secret_detected":   ["legal-compliance-agent", "ops-agent"],
    # Digital Twin
    "digital_twin.generated":     ["digital-twin-agent"],
    "digital_twin.updated":       ["digital-twin-agent"],
    "digital_twin.failed":        ["ops-agent"],
    "influencer.snapshot.created": ["digital-twin-agent"],
    # Competitor Intelligence
    "competitor.detected":             ["competitor-intelligence-agent", "ceo-orchestrator"],
    "competitor.report.generated":     ["ceo-orchestrator"],
    "competitor.momentum_changed":     ["competitor-intelligence-agent", "ceo-orchestrator"],
    "creator.brand_signal_detected":   ["competitor-intelligence-agent"],
    "opportunity.detected":            ["ceo-orchestrator"],
    # Risk Radar (Part 15)
    "creator.risk_changed":            ["risk-radar-agent", "ceo-orchestrator"],
    "creator.sentiment_spike":         ["risk-radar-agent", "ceo-orchestrator"],
    "creator.growth_anomaly":          ["risk-radar-agent"],
    "creator.brand_alignment_declined":["risk-radar-agent", "ceo-orchestrator"],
    "creator.high_risk_detected":      ["risk-radar-agent", "legal-compliance-agent", "ceo-orchestrator"],
}

# ── Known event types (for validation) ───────────────────────────────────────
KNOWN_EVENT_TYPES = set(EVENT_ROUTING.keys()) | {
    "system.startup",
    "system.shutdown",
    "user.login",
    "user.password_reset",
    "campaign.completed",
    "analysis.failed",
    "archive.cleaned",
    "digital_twin.generate",
    "digital_twin.stale_detected",
    "competitor.report.requested",
    "competitor.cache.hit",
}


async def publish(
    session: AsyncSession,
    event_type: str,
    payload: Optional[dict[str, Any]] = None,
    source: str = "system",
) -> AgentEvent:
    """
    Publish an event: persists to DB and creates agent tasks for routing.
    Returns the created AgentEvent record.
    """
    event = AgentEvent(
        event_type=event_type,
        payload=payload or {},
        source=source,
        status="pending",
    )
    session.add(event)
    await session.flush()  # get event.id

    # Route to relevant agents
    target_slugs = EVENT_ROUTING.get(event_type, [])
    if not target_slugs:
        event.status = "routed"
        event.processed_at = datetime.now(timezone.utc)
        await session.flush()
        return event

    routed_count = 0
    for slug in target_slugs:
        result = await session.execute(select(Agent).where(Agent.slug == slug))
        agent = result.scalar_one_or_none()
        if not agent:
            logger.warning("Event routing: agent '%s' not found in DB.", slug)
            continue
        if not agent.is_enabled:
            logger.debug("Event routing: agent '%s' is disabled, skipping.", slug)
            continue
        if agent.mode.value == "disabled":
            logger.debug("Event routing: agent '%s' mode=DISABLED, skipping.", slug)
            continue

        task = AgentTask(
            agent_id=agent.id,
            title=f"[Event] {event_type}",
            description=f"Auto-triggered by event: {event_type} (source: {source})",
            task_type=f"event_{event_type.replace('.', '_')}",
            status=TaskStatus.PENDING,
            priority=_event_priority(event_type),
            risk_level=_event_risk(event_type),
            trigger_type="event",
            event_id=event.id,
            input_data={"event_type": event_type, "payload": payload or {}, "source": source},
            requires_approval=_requires_approval(event_type),
        )
        session.add(task)
        routed_count += 1
        logger.info("Event '%s' routed to agent '%s'.", event_type, slug)

    event.status = "routed" if routed_count > 0 else "processed"
    event.processed_at = datetime.now(timezone.utc)
    await session.flush()

    logger.info("Event '%s' published from '%s' → %d agents.", event_type, source, routed_count)
    return event


def _event_priority(event_type: str) -> TaskPriority:
    urgent = {"security.alert", "security.secret_detected", "system.error_spike",
              "payment.failed", "agent.failed", "campaign.budget_exceeded"}
    high   = {"provider.error", "user.churned", "archive.stale_detected"}
    if event_type in urgent:
        return TaskPriority.URGENT
    if event_type in high:
        return TaskPriority.HIGH
    return TaskPriority.NORMAL


def _event_risk(event_type: str) -> RiskLevel:
    critical = {"security.secret_detected", "security.alert"}
    high     = {"payment.failed", "campaign.budget_exceeded"}
    medium   = {"agent.failed", "provider.error", "system.error_spike"}
    if event_type in critical:
        return RiskLevel.CRITICAL
    if event_type in high:
        return RiskLevel.HIGH
    if event_type in medium:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _requires_approval(event_type: str) -> bool:
    return event_type in {
        "archive.stale_detected",  # cleaner agent needs approval before deleting
        "security.alert",
        "campaign.budget_exceeded",
    }


async def list_events(
    session: AsyncSession,
    limit: int = 50,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
) -> list[AgentEvent]:
    from sqlalchemy import desc
    q = select(AgentEvent).order_by(desc(AgentEvent.created_at))
    if event_type:
        q = q.where(AgentEvent.event_type == event_type)
    if status:
        q = q.where(AgentEvent.status == status)
    result = await session.execute(q.limit(limit))
    return list(result.scalars().all())
