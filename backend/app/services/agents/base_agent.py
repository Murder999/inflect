"""
Base Agent — Tüm ajanların türetildiği soyut temel sınıf.
Part 3: Structured output, real logic (still mock provider).
"""
from __future__ import annotations

import logging
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.agent import Agent, AgentTask

logger = logging.getLogger(__name__)


# ─── Structured output ────────────────────────────────────────────────────────

@dataclass
class AgentResult:
    """Her agent.execute() çağrısının döndürdüğü yapı."""
    success: bool
    output: dict[str, Any]          # Ajan'a özgü yapılandırılmış çıktı
    summary: str                     # Kısa özet (conversation message olarak kullanılır)
    risk_level: str = "low"          # low / medium / high / critical
    requires_approval: bool = False
    conversation_messages: list[dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    latency_ms: int = field(default_factory=lambda: random.randint(120, 480))
    input_tokens: int = field(default_factory=lambda: random.randint(80, 400))
    output_tokens: int = field(default_factory=lambda: random.randint(150, 800))


# ─── Supported task types ─────────────────────────────────────────────────────

SUPPORTED_TASK_TYPES = {
    "system_health_review",
    "product_roadmap_review",
    "code_change_plan",
    "qa_checklist",
    "compliance_review",
    "pricing_review",
    "orchestrated_review",
    "general",
    "sub_task",
    "orchestration",
}


# ─── Base class ───────────────────────────────────────────────────────────────

class BaseAgent(ABC):
    """
    Tüm agent sınıflarının türetildiği temel sınıf.
    Her somut ajan bu sınıfı genişletir.
    """

    def __init__(self, agent_record: "Agent", db: "AsyncSession"):
        self.agent  = agent_record
        self.db     = db
        self.logger = logging.getLogger(f"agent.{agent_record.slug}")

    # ── Abstract methods (her ajan implemente etmeli) ─────────────────────────

    @abstractmethod
    async def can_handle(self, task_type: str) -> bool:
        """Bu ajan belirtilen görev tipini işleyebilir mi?"""

    @abstractmethod
    async def plan(self, task: "AgentTask") -> dict[str, Any]:
        """Görevi analiz eder, çalışma planı döndürür."""

    @abstractmethod
    async def execute(self, task: "AgentTask") -> AgentResult:
        """Görevi çalıştırır, yapılandırılmış sonuç döndürür."""

    # ── Concrete methods (ortak davranış) ─────────────────────────────────────

    def summarize(self, result: AgentResult) -> str:
        return result.summary

    def risk_check(self, result: AgentResult) -> str:
        return result.risk_level

    def create_conversation_message(
        self,
        content: str,
        message_type: str = "result",
    ) -> dict[str, Any]:
        return {
            "agent_id":    self.agent.id,
            "sender_name": self.agent.name,
            "sender_type": "agent",
            "message_type": message_type,
            "content":     content,
            "metadata": {
                "slug": self.agent.slug,
                "role": self.agent.role,
                "part": "part-3",
            },
        }

    # ── Risk helpers ──────────────────────────────────────────────────────────

    @staticmethod
    def _highest_risk(risks: list[str]) -> str:
        order = ["critical", "high", "medium", "low"]
        for level in order:
            if level in risks:
                return level
        return "low"

    @staticmethod
    def _needs_approval(risk_level: str) -> bool:
        return risk_level in ("high", "critical")

    # ── Context helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _keywords(task: "AgentTask") -> set[str]:
        text = f"{task.title} {task.description or ''}".lower()
        return set(text.split())

    @staticmethod
    def _fmt_now() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
