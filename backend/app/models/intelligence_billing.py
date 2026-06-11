"""
Intelligence Billing Models — Part 16

IntelligenceFeature  : per-feature credit cost + plan access config
IntelligenceUsageLog : every intelligence action is logged (success or failure)
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, Integer,
    String, Text, JSON,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UsageStatus(str, enum.Enum):
    SUCCESS     = "success"
    FAILED      = "failed"
    NOT_CHARGED = "not_charged"
    BLOCKED     = "blocked"


class IntelligenceFeature(Base):
    """
    Configuration record for each Intelligence feature.
    Credit costs and plan access are managed here — nothing is hardcoded.
    """
    __tablename__ = "intelligence_features"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Identity
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="intelligence", nullable=False)

    # Billing
    is_enabled:  Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True,  nullable=False)
    free_for_admin: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    charge_on_failure: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Credit costs (integers; 0 = free)
    credit_cost:          Mapped[int] = mapped_column(Integer, default=1)
    limited_credit_cost:  Mapped[int] = mapped_column(Integer, default=1)
    standard_credit_cost: Mapped[int] = mapped_column(Integer, default=1)
    full_credit_cost:     Mapped[int] = mapped_column(Integer, default=2)

    # Access control (JSON list of plan slugs; null = all plans)
    allowed_plans: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class IntelligenceUsageLog(Base):
    """Every intelligence feature invocation — success, failure, and blocked."""
    __tablename__ = "intelligence_usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    user_id:      Mapped[int]          = mapped_column(Integer,     nullable=False, index=True)
    feature_slug: Mapped[str]          = mapped_column(String(100), nullable=False, index=True)
    credits_charged: Mapped[int]       = mapped_column(Integer,     default=0)
    report_mode:  Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    status: Mapped[UsageStatus] = mapped_column(
        SAEnum(UsageStatus, native_enum=False, length=20),
        default=UsageStatus.SUCCESS,
        nullable=False,
        index=True,
    )
    failure_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
