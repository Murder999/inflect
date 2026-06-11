"""
Digital Twin — Pydantic schemas and internal dataclasses.
All types used across the digital_twin service modules.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


# ─── Snapshot DTO (lightweight, no ORM dependency) ───────────────────────────

@dataclass
class SnapshotPoint:
    """Stripped-down snapshot used for analysis."""
    snapshot_id: int
    captured_at: datetime
    followers: int
    following: int
    engagement_rate: float
    avg_views: int
    avg_likes: int
    avg_comments: int
    fraud_score: int
    momentum_score: int
    authenticity_score: int
    final_score: int


# ─── Signal types ─────────────────────────────────────────────────────────────

SIGNAL_FOLLOWER_GROWTH_RATE    = "follower_growth_rate"    # daily rate
SIGNAL_ER_DELTA                = "er_delta"                 # per-snapshot delta
SIGNAL_FRAUD_SCORE_DELTA       = "fraud_score_delta"
SIGNAL_MOMENTUM_DELTA          = "momentum_delta"
SIGNAL_VOLATILITY              = "follower_volatility"
SIGNAL_POSTING_CONSISTENCY     = "posting_consistency"


# ─── Evidence labels ──────────────────────────────────────────────────────────

class EvidenceLabel:
    HISTORICAL_TREND    = "Historical Trend"
    VELOCITY_ANALYSIS   = "Velocity Analysis"
    VOLATILITY          = "Volatility Detection"
    SNAPSHOT_EVIDENCE   = "Snapshot Evidence"
    AUDIENCE_CONSISTENCY = "Audience Consistency"
    PLATFORM_STABILITY  = "Platform Stability"
    RISK_SIGNAL         = "Risk Signal"
    INSUFFICIENT        = "Insufficient Evidence"


# ─── Confidence levels ────────────────────────────────────────────────────────

class Confidence:
    INSUFFICIENT = "insufficient"
    LOW          = "low"
    MEDIUM       = "medium"
    HIGH         = "high"


# ─── Data quality result ──────────────────────────────────────────────────────

@dataclass
class DataQualityResult:
    is_sufficient: bool
    snapshot_count: int
    days_coverage: int
    reason: Optional[str] = None
    limitations: list[str] = field(default_factory=list)


# ─── Forecast horizons ────────────────────────────────────────────────────────

FORECAST_HORIZONS = [30, 90, 180]


# ─── Trend analysis result ───────────────────────────────────────────────────

@dataclass
class TrendResult:
    """Raw computed trends from snapshot history."""
    # Growth
    avg_daily_growth_rate: float          # average followers gained per day / follower_base
    weighted_daily_growth_rate: float     # recency-weighted
    growth_direction: str                 # "positive" / "negative" / "flat"

    # Engagement
    er_slope: float                       # linear regression slope (per day)
    er_current: float
    er_direction: str                     # "improving" / "declining" / "stable"
    engagement_decay_detected: bool

    # Momentum
    avg_momentum: float
    momentum_direction: str

    # Fraud
    avg_fraud_score: float
    fraud_trend: str                      # "improving" / "worsening" / "stable"

    # Data context
    snapshot_count: int
    days_coverage: int


# ─── Volatility result ───────────────────────────────────────────────────────

@dataclass
class VolatilityResult:
    volatility_score: float               # 0.0 = perfectly smooth, 1.0+ = highly volatile
    has_spikes: bool
    spike_count: int
    max_spike_pct: float                  # largest single-period follower change %
    has_crashes: bool
    crash_count: int
    max_crash_pct: float
    volatility_label: str                 # "low" / "medium" / "high"
    evidence: list[str] = field(default_factory=list)


# ─── Risk projection ─────────────────────────────────────────────────────────

@dataclass
class RiskProjection:
    overall_trend: str                    # "declining" / "stable" / "increasing"
    fraud_risk_trend: str
    audience_quality_decay: bool
    inactivity_risk: bool
    volatility_risk: bool
    sponsorship_overload_risk: bool
    burnout_risk: bool
    drivers: list[str] = field(default_factory=list)


# ─── Forecast for one horizon ─────────────────────────────────────────────────

@dataclass
class HorizonForecast:
    horizon_days: int

    # Growth
    followers_current: int
    followers_projected: int
    followers_projection_pct: float
    followers_range_low_pct: float
    followers_range_high_pct: float

    # Engagement
    engagement_current: float
    engagement_projected: float
    engagement_projection_pct: float
    engagement_decay_risk: bool

    # Risk & stability
    risk_trend: str
    stability_trend: str

    # Campaign
    campaign_readiness: str
    campaign_recommendation: str

    # Evidence
    confidence: str
    limitations: list[str] = field(default_factory=list)
    evidence: dict[str, Any] = field(default_factory=dict)


# ─── Complete Digital Twin result ─────────────────────────────────────────────

@dataclass
class DigitalTwinResult:
    influencer_profile_id: int
    generated_at: datetime
    forecast_version: str = "1.0"

    is_forecast_available: bool = False
    unavailability_reason: Optional[str] = None

    snapshot_count: int = 0
    snapshot_days_coverage: int = 0
    oldest_snapshot_at: Optional[datetime] = None
    newest_snapshot_at: Optional[datetime] = None

    confidence: str = Confidence.INSUFFICIENT
    evidence_strength: str = "weak"

    horizons: list[HorizonForecast] = field(default_factory=list)
    signals: list[dict[str, Any]] = field(default_factory=list)

    is_mock: bool = False
    note: str = ""
