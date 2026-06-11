"""
Influencer Risk Radar™ — DB Models (Part 15)
Stores evidence-based behavioral brand safety analysis results.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, String, UniqueConstraint,
)

from app.core.database import Base


class InfluencerRiskReport(Base):
    """
    Cached risk analysis for an influencer profile.
    Full report stored as JSON for fast retrieval.
    """
    __tablename__ = "influencer_risk_reports"

    id                  = Column(Integer, primary_key=True, index=True)
    profile_id          = Column(Integer, ForeignKey("influencer_profiles.id",
                                  ondelete="CASCADE"), nullable=False, index=True)
    window_days         = Column(Integer, nullable=False, default=90)
    is_mock             = Column(Boolean, nullable=False, default=True)
    overall_score       = Column(Integer, nullable=False, default=0)   # 0-100
    overall_level       = Column(String(20), nullable=False, default="low")  # low|medium|high|critical
    risk_trajectory     = Column(String(20), nullable=False, default="stable")
    confidence          = Column(String(10), nullable=False, default="low")
    generated_by_user_id = Column(Integer, nullable=True)
    report_json         = Column(JSON, nullable=False, default=dict)
    generated_at        = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    expires_at          = Column(DateTime, nullable=True)


class RiskAlert(Base):
    """
    Triggered when a creator's risk score crosses a threshold or trajectory worsens.
    """
    __tablename__ = "risk_alerts"

    id           = Column(Integer, primary_key=True, index=True)
    profile_id   = Column(Integer, ForeignKey("influencer_profiles.id",
                           ondelete="CASCADE"), nullable=False, index=True)
    alert_type   = Column(String(60), nullable=False)   # risk_threshold|trajectory_spike|brand_alignment_decline
    severity     = Column(String(20), nullable=False, default="medium")  # low|medium|high|critical
    message      = Column(String(500), nullable=False, default="")
    details      = Column(JSON, nullable=True)
    resolved     = Column(Boolean, nullable=False, default=False)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    resolved_at  = Column(DateTime, nullable=True)
