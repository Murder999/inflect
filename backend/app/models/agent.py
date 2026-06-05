"""
AI Orchestrator — Agent Models (Part 1)
Tüm agent tablolarını tanımlar. Mevcut modellere dokunulmaz.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey,
    Integer, String, Text,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


# ─── Enums ───────────────────────────────────────────────────────────────────

class AgentStatus(str, enum.Enum):
    ACTIVE           = "active"
    IDLE             = "idle"
    ERROR            = "error"
    DISABLED         = "disabled"
    WAITING_APPROVAL = "waiting_approval"


class ModelProvider(str, enum.Enum):
    MOCK      = "mock"
    CLAUDE    = "claude"
    OPENAI    = "openai"
    DEEPSEEK  = "deepseek"
    GEMINI    = "gemini"    # Google Gemini — Part 2


class RiskLevel(str, enum.Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"


class TaskStatus(str, enum.Enum):
    PENDING          = "pending"
    RUNNING          = "running"
    COMPLETED        = "completed"
    FAILED           = "failed"
    WAITING_APPROVAL = "waiting_approval"
    CANCELLED        = "cancelled"


class TaskPriority(str, enum.Enum):
    LOW    = "low"
    NORMAL = "normal"
    HIGH   = "high"
    URGENT = "urgent"


class SenderType(str, enum.Enum):
    AGENT  = "agent"
    SYSTEM = "system"
    ADMIN  = "admin"
    USER   = "user"


class MessageType(str, enum.Enum):
    INSTRUCTION      = "instruction"
    RESULT           = "result"
    WARNING          = "warning"
    APPROVAL_REQUEST = "approval_request"
    DECISION         = "decision"
    LOG              = "log"


class ApprovalStatus(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED  = "expired"


class ProviderHealthStatus(str, enum.Enum):
    HEALTHY  = "healthy"
    DEGRADED = "degraded"
    DOWN     = "down"
    UNKNOWN  = "unknown"


# ─── JSON column helper (SQLAlchemy native JSON) ──────────────────────────────
from sqlalchemy import JSON


# ─── 1. agents ───────────────────────────────────────────────────────────────

class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(String(100))          # orchestrator / analyst / ops / etc.
    status: Mapped[AgentStatus] = mapped_column(
        SAEnum(AgentStatus), default=AgentStatus.IDLE
    )
    model_provider: Mapped[ModelProvider] = mapped_column(
        SAEnum(ModelProvider, native_enum=False, length=20), default=ModelProvider.MOCK
    )
    model_name: Mapped[str] = mapped_column(String(100), default="mock-v1")
    risk_level: Mapped[RiskLevel] = mapped_column(
        SAEnum(RiskLevel), default=RiskLevel.LOW
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ─── 2. agent_tasks ──────────────────────────────────────────────────────────

class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("agents.id", ondelete="CASCADE"), index=True
    )
    parent_task_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True
    )
    created_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    task_type: Mapped[str] = mapped_column(String(100), default="general")
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus), default=TaskStatus.PENDING, index=True
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority), default=TaskPriority.NORMAL
    )
    input_data: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    output_data: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    risk_level: Mapped[RiskLevel] = mapped_column(
        SAEnum(RiskLevel), default=RiskLevel.LOW
    )
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    approval_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ─── 3. agent_runs ───────────────────────────────────────────────────────────

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("agents.id", ondelete="CASCADE"), index=True
    )
    task_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True
    )
    provider: Mapped[str] = mapped_column(String(50), default="mock")
    model: Mapped[str] = mapped_column(String(100), default="mock-v1")
    status: Mapped[str] = mapped_column(String(50), default="completed")
    input_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost_estimate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[Any]] = mapped_column(
        "metadata", JSON, nullable=True
    )


# ─── 4. agent_conversations ──────────────────────────────────────────────────

class AgentConversation(Base):
    __tablename__ = "agent_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(100), default="system")
    status: Mapped[str] = mapped_column(String(50), default="active")
    related_task_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ─── 5. agent_messages ───────────────────────────────────────────────────────

class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("agent_conversations.id", ondelete="CASCADE"), index=True
    )
    agent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    sender_type: Mapped[SenderType] = mapped_column(
        SAEnum(SenderType), default=SenderType.AGENT
    )
    sender_name: Mapped[str] = mapped_column(String(255))
    message_type: Mapped[MessageType] = mapped_column(
        SAEnum(MessageType), default=MessageType.LOG
    )
    content: Mapped[str] = mapped_column(Text)
    metadata_: Mapped[Optional[Any]] = mapped_column(
        "metadata", JSON, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


# ─── 6. agent_approvals ──────────────────────────────────────────────────────

class AgentApproval(Base):
    __tablename__ = "agent_approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    task_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True
    )
    requested_by_agent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    action_type: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_level: Mapped[RiskLevel] = mapped_column(
        SAEnum(RiskLevel), default=RiskLevel.MEDIUM
    )
    payload: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    status: Mapped[ApprovalStatus] = mapped_column(
        SAEnum(ApprovalStatus), default=ApprovalStatus.PENDING, index=True
    )
    reviewed_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ─── 7. agent_memory ─────────────────────────────────────────────────────────

class AgentMemory(Base):
    __tablename__ = "agent_memory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("agents.id", ondelete="CASCADE"), index=True
    )
    memory_type: Mapped[str] = mapped_column(String(100), default="fact")
    key: Mapped[str] = mapped_column(String(500), index=True)
    value: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ─── 8. agent_provider_health ────────────────────────────────────────────────

class AgentProviderHealth(Base):
    __tablename__ = "agent_provider_health"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    status: Mapped[ProviderHealthStatus] = mapped_column(
        SAEnum(ProviderHealthStatus), default=ProviderHealthStatus.UNKNOWN
    )
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[Any]] = mapped_column(
        "metadata", JSON, nullable=True
    )
