"""
Influencer Discovery models — Part 24

Tables:
  influencer_discovery_runs      — one run per discover request
  influencer_discovery_candidates — candidates found in a run
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey,
    Integer, String, Text, JSON, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class InfluencerDiscoveryRun(Base):
    __tablename__ = "influencer_discovery_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    campaign_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True)
    brand_analysis_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Input
    input_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Query plan generated
    query_plan: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Provider results
    provider_status: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    failed_providers: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)

    # Stats
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|running|completed|failed
    candidates_count: Mapped[int] = mapped_column(Integer, default=0)
    verified_candidates_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    candidates: Mapped[list["InfluencerDiscoveryCandidate"]] = relationship(
        "InfluencerDiscoveryCandidate",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )


class InfluencerDiscoveryCandidate(Base):
    __tablename__ = "influencer_discovery_candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("influencer_discovery_runs.id", ondelete="SET NULL"), nullable=True,
    )

    # Identity
    platform: Mapped[str] = mapped_column(String(30))
    handle: Mapped[str] = mapped_column(String(255))
    profile_url: Mapped[str] = mapped_column(String(512))
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Source
    source_provider: Mapped[str] = mapped_column(String(50))
    cache_status: Mapped[str] = mapped_column(String(20), default="live")  # live|cached

    # Evidence
    evidence_quality: Mapped[str] = mapped_column(String(20), default="none")  # strong|moderate|weak|none
    raw_evidence: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Scores (nullable — no default 50 for missing data)
    relevance_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    market_match_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    category_match_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    # Relationship
    run: Mapped[Optional["InfluencerDiscoveryRun"]] = relationship(
        "InfluencerDiscoveryRun", back_populates="candidates",
    )
