"""
CEO / Orchestrator Agent — Alt ajanları koordine eder, sonuçları toplar.
Part 3: Task type'a göre gerçek sub-agent'ları çalıştırır.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import select

from app.services.agents.base_agent import BaseAgent, AgentResult
from app.models.agent import (
    Agent, AgentTask, AgentRun, AgentApproval,
    TaskStatus, TaskPriority, RiskLevel, AgentStatus,
    SenderType, MessageType, ApprovalStatus,
)
from app.services.agent_conversation_service import create_conversation, add_message

logger = logging.getLogger(__name__)

# Task type → hangi sub-ajanların çalışacağı
TASK_ROUTING: dict[str, list[str]] = {
    "orchestrated_review":    ["ops-agent", "product-manager", "qa-test-agent", "legal-compliance-agent", "finance-pricing-agent"],
    "system_health_review":   ["ops-agent", "qa-test-agent", "legal-compliance-agent"],
    "product_roadmap_review": ["product-manager", "legal-compliance-agent"],
    "code_change_plan":       ["dev-agent", "qa-test-agent", "legal-compliance-agent"],
    "pricing_review":         ["finance-pricing-agent"],
    "compliance_review":      ["legal-compliance-agent"],
    "qa_checklist":           ["qa-test-agent"],
    "general":                ["ops-agent"],
}


class CeoAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return True  # CEO her şeyi koordine eder

    async def plan(self, task: AgentTask) -> dict[str, Any]:
        slugs = TASK_ROUTING.get(task.task_type, TASK_ROUTING["general"])
        return {
            "sub_agents": slugs,
            "parallel":   False,
            "estimated_latency_ms": len(slugs) * 300,
        }

    async def execute(self, task: AgentTask) -> AgentResult:
        from app.services.agents.agent_factory import get_agent_class_for_slug
        from app.services.agent_task_engine import create_task

        # ─── Konuşma oluştur ────────────────────────────────────────────────
        conv = await create_conversation(
            session=self.db,
            title=f"Orchestrated: {task.title}",
            source="ceo_orchestrator",
            related_task_id=task.id,
        )

        # ─── CEO açılış mesajı ───────────────────────────────────────────────
        sub_slugs = TASK_ROUTING.get(task.task_type, TASK_ROUTING["general"])
        await add_message(
            session=self.db,
            conversation_id=conv.id,
            agent_id=self.agent.id,
            sender_name=self.agent.name,
            sender_type=SenderType.AGENT,
            message_type=MessageType.INSTRUCTION,
            content=(
                f"'{task.title}' görevi alındı. "
                f"Task type: {task.task_type}. "
                f"{len(sub_slugs)} alt ajana görev dağıtılıyor: {', '.join(sub_slugs)}."
            ),
        )

        # ─── Alt ajanları çalıştır ───────────────────────────────────────────
        sub_results: list[dict[str, Any]] = []
        all_risks: list[str] = []

        for slug in sub_slugs:
            # Ajanı DB'den yükle
            result_q = await self.db.execute(
                select(Agent).where(Agent.slug == slug)
            )
            sub_agent_record = result_q.scalar_one_or_none()
            if not sub_agent_record:
                logger.warning("Sub-agent bulunamadı: %s", slug)
                continue

            # Agent class'ını yükle
            AgentClass = get_agent_class_for_slug(slug)
            if not AgentClass:
                logger.warning("Agent class yok: %s", slug)
                continue

            # Sub-task oluştur
            sub_task = await create_task(
                session=self.db,
                agent_id=sub_agent_record.id,
                title=f"[{sub_agent_record.role.upper()}] {task.title}",
                task_type=task.task_type,
                description=task.description,
                parent_task_id=task.id,
            )

            # Sub-agent çalıştır
            sub_agent_instance = AgentClass(agent_record=sub_agent_record, db=self.db)
            try:
                sub_result = await sub_agent_instance.execute(sub_task)
            except Exception as exc:
                logger.error("Sub-agent %s hata: %s", slug, exc)
                sub_result = AgentResult(
                    success=False, output={}, summary=f"{slug} hatası: {exc}",
                    risk_level="medium", error=str(exc),
                )

            # Sub-task güncelle
            sub_task.status = TaskStatus.COMPLETED if sub_result.success else TaskStatus.FAILED
            sub_task.completed_at = datetime.now(timezone.utc)
            sub_task.output_data = sub_result.output
            if sub_result.risk_level in (r.value for r in RiskLevel):
                sub_task.risk_level = RiskLevel(sub_result.risk_level)

            # Run kaydı
            run = AgentRun(
                agent_id=sub_agent_record.id,
                task_id=sub_task.id,
                provider="mock",
                model=f"structured-{sub_agent_record.role}-v1",
                status="completed" if sub_result.success else "failed",
                input_tokens=sub_result.input_tokens,
                output_tokens=sub_result.output_tokens,
                cost_estimate=0.0,
                latency_ms=sub_result.latency_ms,
                started_at=datetime.now(timezone.utc),
                completed_at=datetime.now(timezone.utc),
                metadata_={"part": "part-3", "agent_role": sub_agent_record.role},
            )
            self.db.add(run)

            # Agent status güncelle
            sub_agent_record.status = AgentStatus.IDLE
            sub_agent_record.last_run_at = datetime.now(timezone.utc)

            # Konuşmaya sub-agent mesajlarını yaz
            for msg_data in sub_result.conversation_messages:
                await add_message(
                    session=self.db,
                    conversation_id=conv.id,
                    agent_id=msg_data.get("agent_id", sub_agent_record.id),
                    sender_name=msg_data["sender_name"],
                    sender_type=SenderType(msg_data.get("sender_type", "agent")),
                    message_type=MessageType(msg_data.get("message_type", "result")),
                    content=msg_data["content"],
                    metadata=msg_data.get("metadata"),
                )

            all_risks.append(sub_result.risk_level)
            sub_results.append({
                "agent":            slug,
                "task_id":          sub_task.id,
                "risk_level":       sub_result.risk_level,
                "summary":          sub_result.summary,
                "requires_approval": sub_result.requires_approval,
            })

            await self.db.flush()

        # ─── Risk hesapla ────────────────────────────────────────────────────
        final_risk = self._highest_risk(all_risks) if all_risks else "low"
        high_risk_agents = [r for r in sub_results if r["risk_level"] in ("high", "critical")]
        needs_approval = bool(high_risk_agents)

        # ─── Approval oluştur (high/critical) ────────────────────────────────
        approval_id: Optional[int] = None
        if needs_approval:
            approval = AgentApproval(
                task_id=task.id,
                requested_by_agent_id=self.agent.id,
                action_type="orchestrated_review_high_risk",
                title=f"Yüksek Risk Tespiti: {task.title}",
                description=(
                    f"{len(high_risk_agents)} ajan yüksek risk bildirdi: "
                    + ", ".join(r["agent"] for r in high_risk_agents)
                ),
                risk_level=RiskLevel(final_risk),
                payload={"sub_results": sub_results, "conversation_id": conv.id},
                status=ApprovalStatus.PENDING,
            )
            self.db.add(approval)
            await self.db.flush()
            approval_id = approval.id

        # ─── CEO kapanış mesajı ──────────────────────────────────────────────
        closing_msg = (
            f"{len(sub_results)} alt görev tamamlandı. "
            f"Genel risk: {final_risk.upper()}. "
            + (f"{len(high_risk_agents)} ajan yüksek risk bildirdi — "
               f"Approval #{approval_id} oluşturuldu. Admin onayı gerekiyor."
               if needs_approval
               else "İnsan onayı gerekmeden tamamlandı.")
        )

        await add_message(
            session=self.db,
            conversation_id=conv.id,
            agent_id=self.agent.id,
            sender_name=self.agent.name,
            sender_type=SenderType.AGENT,
            message_type=MessageType.DECISION,
            content=closing_msg,
        )
        await self.db.flush()

        return AgentResult(
            success=True,
            output={
                "conversation_id": conv.id,
                "sub_results":     sub_results,
                "approval_id":     approval_id,
                "total_sub_tasks": len(sub_results),
                "high_risk_count": len(high_risk_agents),
            },
            summary=closing_msg,
            risk_level=final_risk,
            requires_approval=needs_approval,
            conversation_messages=[],  # CEO mesajları direkt DB'ye yazıldı
        )
