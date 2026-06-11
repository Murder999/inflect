"""
Influencer Digital Twin™ Models — Part 12
Evidence-based behavioral forecasting. No fake data.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer,
    String, Text, JSON, UniqueConstraint,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConfidenceLevel(str, enum.Enum):
    INSUFFICIENT = "insufficient"   # < 3 snapshots or < 30 day coverage
    LOW          = "low"            # 3-5 snapshots or high volatility
    MEDIUM       = "medium"         # 4-7 snapshots, moderate data quality
    HIGH         = "high"           # 6+ snapshots, 90+ day coverage, low volatility


class RiskTrend(str, enum.Enum):
    DECLINING  = "declining"   # Risk is going down — improving
    STABLE     = "stable"      # No significant change
    INCREASING = "increasing"  # Risk is growing


class StabilityTrend(str, enum.Enum):
    IMPROVING  = "improving"
    STABLE     = "stable"
    DECLINING  = "declining"


class CampaignReadiness(str, enum.Enum):
    READY           = "ready"           # Good momentum, low risk
    CONDITIONAL     = "conditional"     # Possible but with caveats
    CAUTION         = "caution"         # Declining metrics, short-term only
    NOT_RECOMMENDED = "not_recommended" # Poor data or high risk


# ─── InfluencerDigitalTwin ────────────────────────────────────────────────────

class InfluencerDigitalTwin(Base):
    """
    Master Digital Twin record for an influencer.
    One active (is_latest=True) twin per profile at any time.
    """
    __tablename__ = "influencer_digital_twins"
    __table_args__ = (
        UniqueConstraint("influencer_profile_id", "is_latest",
                         name="uq_twin_latest_per_profile"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    influencer_profile_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("influencer_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    forecast_version: Mapped[str] = mapped_column(
        String(20), default="1.0", nullable=False
    )

    # Snapshot basis
    snapshot_count: Mapped[int]      = mapped_column(Integer, default=0)
    snapshot_days_coverage: Mapped[int] = mapped_column(Integer, default=0)
    oldest_snapshot_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    newest_snapshot_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Overall confidence
    confidence: Mapped[ConfidenceLevel] = mapped_column(
        SAEnum(ConfidenceLevel, native_enum=False, length=20),
        default=ConfidenceLevel.INSUFFICIENT,
        nullable=False,
    )
    evidence_strength: Mapped[str] = mapped_column(
        String(20), default="weak", nullable=False
    )  # weak / moderate / strong

    # Forecast unavailability
    is_forecast_available: Mapped[bool] = mapped_column(Boolean, default=False)
    unavailability_reason: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )

    # Version management
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    is_mock: Mapped[bool] = mapped_column(Boolean, default=True)


# ─── TwinForecast ─────────────────────────────────────────────────────────────

class TwinForecast(Base):
    """
    Forecast data for a specific horizon (30/90/180/365 days).
    All projections are computed from real snapshot history.
    """
    __tablename__ = "twin_forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    digital_twin_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("influencer_digital_twins.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    horizon_days: Mapped[int] = mapped_column(Integer, nullable=False)  # 30, 90, 180, 365

    # ─ Growth forecast ────────────────────────────────────────────────────────
    followers_projection_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    followers_current: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    followers_projected: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    followers_range_low_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    followers_range_high_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ─ Engagement forecast ───────────────────────────────────────────────────
    engagement_projection_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    engagement_current: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    engagement_projected: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    engagement_decay_risk: Mapped[bool] = mapped_column(Boolean, default=False)

    # ─ Risk & stability ──────────────────────────────────────────────────────
    risk_trend: Mapped[RiskTrend] = mapped_column(
        SAEnum(RiskTrend, native_enum=False, length=20),
        default=RiskTrend.STABLE,
        nullable=False,
    )
    stability_trend: Mapped[StabilityTrend] = mapped_column(
        SAEnum(StabilityTrend, native_enum=False, length=20),
        default=StabilityTrend.STABLE,
        nullable=False,
    )

    # ─ Campaign readiness ────────────────────────────────────────────────────
    campaign_readiness: Mapped[CampaignReadiness] = mapped_column(
        SAEnum(CampaignReadiness, native_enum=False, length=30),
        default=CampaignReadiness.CONDITIONAL,
        nullable=False,
    )
    campaign_recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ─ Evidence & explainability ─────────────────────────────────────────────
    confidence: Mapped[ConfidenceLevel] = mapped_column(
        SAEnum(ConfidenceLevel, native_enum=False, length=20),
        default=ConfidenceLevel.INSUFFICIENT,
    )
    limitations: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    evidence_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    raw_signals_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


# ─── TwinSignal ───────────────────────────────────────────────────────────────

class TwinSignal(Base):
    """
    Extracted historical feature/signal from a snapshot.
    Immutable once written.
    """
    __tablename__ = "twin_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    digital_twin_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("influencer_digital_twins.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    source_snapshot_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("influencer_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    signal_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # follower_growth_rate, er_delta, fraud_score_delta, etc.

    signal_value: Mapped[float] = mapped_column(Float, nullable=False)
    weight: Mapped[float] = mapped_column(Float, default=1.0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
