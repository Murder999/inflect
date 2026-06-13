"""
Influencer Risk Radar™ — DB Models (Part 15 + Part 17)

Part 17 changes to RiskAlert:
  - Replaced resolved (bool) with status (open|acknowledged|dismissed|resolved)
  - Added source, platform, score tracking, explanation, evidence, acknowledged_by
  - Added updated_at
Added: RiskScanLog — tracks scheduled scan runs
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, String, Text,
)

from app.core.database import Base


class AlertStatus(str, enum.Enum):
    OPEN         = "open"
    ACKNOWLEDGED = "acknowledged"
    DISMISSED    = "dismissed"
    RESOLVED     = "resolved"


class AlertSource(str, enum.Enum):
    SCHEDULED_SCAN   = "scheduled_scan"
    MANUAL_SCAN      = "manual_scan"
    CAMPAIGN_MONITOR = "campaign_monitor"


class InfluencerRiskReport(Base):
    """
    Cached risk analysis for an influencer profile.
    Full report stored as JSON for fast retrieval.
    """
    __tablename__ = "influencer_risk_reports"

    id                   = Column(Integer, primary_key=True, index=True)
    profile_id           = Column(Integer, ForeignKey("influencer_profiles.id",
                                   ondelete="CASCADE"), nullable=False, index=True)
    window_days          = Column(Integer, nullable=False, default=90)
    is_mock              = Column(Boolean, nullable=False, default=True)
    overall_score        = Column(Integer, nullable=False, default=0)      # 0-100
    overall_level        = Column(String(20), nullable=False, default="low")   # low|medium|high|critical
    risk_trajectory      = Column(String(20), nullable=False, default="stable")
    confidence           = Column(String(10), nullable=False, default="low")
    generated_by_user_id = Column(Integer, nullable=True)
    report_json          = Column(JSON, nullable=False, default=dict)
    generated_at         = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    expires_at           = Column(DateTime, nullable=True)


class RiskAlert(Base):
    """
    Triggered when a creator's risk score crosses a threshold or trajectory worsens.

    Lifecycle:  open → acknowledged → dismissed | resolved

    Status values:
        open          — newly created, unreviewed
        acknowledged  — admin has seen it, under observation
        dismissed     — not actionable, closed without resolution
        resolved      — root cause addressed

    Source values:
        scheduled_scan   — created by daily background scanner
        manual_scan      — created from a user-triggered scan
        campaign_monitor — created by campaign monitoring agent
    """
    __tablename__ = "risk_alerts"

    id         = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("influencer_profiles.id",
                         ondelete="CASCADE"), nullable=False, index=True)

    # Classification
    alert_type = Column(String(60), nullable=False, index=True)
    severity   = Column(String(20), nullable=False, default="medium", index=True)  # low|medium|high|critical

    # Status lifecycle (replaces old resolved bool)
    status = Column(String(20), nullable=False, default=AlertStatus.OPEN.value, index=True)
    source = Column(String(50), nullable=False, default=AlertSource.MANUAL_SCAN.value, index=True)

    # Profile context
    platform = Column(String(50), nullable=True, index=True)

    # Score tracking
    previous_score = Column(Float, nullable=True)
    current_score  = Column(Float, nullable=True)
    delta          = Column(Float, nullable=True)

    # Content
    message     = Column(String(500), nullable=False, default="")
    explanation = Column(Text, nullable=True)
    details     = Column(JSON, nullable=True)   # backwards-compat JSON blob
    evidence    = Column(JSON, nullable=True)   # list[str] — human-readable evidence lines

    # Audit trail
    acknowledged_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at     = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime,
                        default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class RiskScanLog(Base):
    """
    Audit log for each scheduled or manual risk scan run.
    One row per scan batch; never modified after completion.
    """
    __tablename__ = "risk_scan_logs"

    id                 = Column(Integer, primary_key=True, index=True)
    started_at         = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                                nullable=False, index=True)
    completed_at       = Column(DateTime, nullable=True)
    trigger_source     = Column(String(50), nullable=False, default="scheduled")  # scheduled|manual
    profiles_scanned   = Column(Integer, default=0)
    profiles_succeeded = Column(Integer, default=0)
    profiles_failed    = Column(Integer, default=0)
    alerts_created     = Column(Integer, default=0)
    alerts_updated     = Column(Integer, default=0)
    error_message      = Column(Text, nullable=True)
    metadata_json      = Column(JSON, nullable=True)
