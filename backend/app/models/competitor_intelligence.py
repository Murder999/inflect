"""
Competitor Intelligence Models — Part 13
Competitor brand profiles and detected creator-brand campaign signals.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class CompetitorProfile(Base):
    """
    A competitor brand entity. Created once per brand, reused across analyses.
    """
    __tablename__ = "competitor_profiles"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(200), nullable=False)
    normalized_name = Column(String(200), nullable=False, index=True)
    industry        = Column(String(100), nullable=True)
    country         = Column(String(10), nullable=False, default="TR")
    aliases         = Column(JSON, nullable=True)        # list[str]

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    signals      = relationship("CompetitorCampaignSignal", back_populates="competitor",
                                cascade="all, delete-orphan", lazy="noload")
    report_cache = relationship("CompetitorReportCache", back_populates="competitor",
                                cascade="all, delete-orphan", lazy="noload")

    __table_args__ = (
        UniqueConstraint("normalized_name", name="uq_competitor_normalized_name"),
    )


class CompetitorCampaignSignal(Base):
    """
    A detected signal linking a competitor brand to a creator / campaign.
    signal_strength: 0.0 (very weak) → 1.0 (explicit confirmed partnership)
    """
    __tablename__ = "competitor_campaign_signals"

    id                    = Column(Integer, primary_key=True, index=True)
    competitor_id         = Column(Integer, ForeignKey("competitor_profiles.id",
                                   ondelete="CASCADE"), nullable=False, index=True)
    influencer_profile_id = Column(Integer, ForeignKey("influencer_profiles.id",
                                   ondelete="SET NULL"), nullable=True, index=True)

    platform        = Column(String(30), nullable=False)
    signal_type     = Column(String(60), nullable=False)   # brand_analysis | category_match | sponsored_hashtag | ...
    signal_strength = Column(Float, nullable=False, default=0.5)
    confidence      = Column(String(10), nullable=False, default="low")  # low | medium | high

    detected_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    campaign_name = Column(String(200), nullable=True)
    hashtags      = Column(JSON, nullable=True)   # list[str]
    evidence_json = Column(JSON, nullable=True)   # list[str] — human-readable evidence lines
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    competitor = relationship("CompetitorProfile", back_populates="signals", lazy="noload")


class CompetitorReportCache(Base):
    """
    Cached generated competitor intelligence reports.
    Full report JSON stored for fast retrieval. Expires after 24 hours by default.
    """
    __tablename__ = "competitor_report_cache"

    id            = Column(Integer, primary_key=True, index=True)
    competitor_id = Column(Integer, ForeignKey("competitor_profiles.id",
                           ondelete="CASCADE"), nullable=False, index=True)
    window_days   = Column(Integer, nullable=False, default=90)
    is_mock       = Column(Boolean, nullable=False, default=True)
    report_json   = Column(JSON, nullable=False)
    generated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    expires_at    = Column(DateTime, nullable=True)

    competitor = relationship("CompetitorProfile", back_populates="report_cache", lazy="noload")
