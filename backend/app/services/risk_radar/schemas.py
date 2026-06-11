"""
Risk Radar Schemas — Part 15
Pure data types; no DB dependencies.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

# ── Risk levels ────────────────────────────────────────────────────────────────
RISK_LOW      = "low"
RISK_MEDIUM   = "medium"
RISK_HIGH     = "high"
RISK_CRITICAL = "critical"

# ── Trajectory ────────────────────────────────────────────────────────────────
TRAJ_DECLINING = "declining"
TRAJ_STABLE    = "stable"
TRAJ_RISING    = "rising"
TRAJ_SPIKE     = "spike"

# ── Confidence ────────────────────────────────────────────────────────────────
CONF_LOW    = "low"
CONF_MEDIUM = "medium"
CONF_HIGH   = "high"

# ── Dimension names ───────────────────────────────────────────────────────────
DIM_FRAUD_ANOMALY       = "fraud_anomaly"
DIM_GROWTH_ANOMALY      = "growth_anomaly"
DIM_ENGAGEMENT_QUALITY  = "engagement_quality"
DIM_BRAND_ALIGNMENT     = "brand_alignment"
DIM_VOLATILITY          = "volatility"
DIM_SENTIMENT           = "sentiment"

DIMENSION_LABELS: dict[str, str] = {
    DIM_FRAUD_ANOMALY:      "Fraud & Authenticity Risk",
    DIM_GROWTH_ANOMALY:     "Growth Anomaly Risk",
    DIM_ENGAGEMENT_QUALITY: "Engagement Quality Risk",
    DIM_BRAND_ALIGNMENT:    "Brand Alignment Risk",
    DIM_VOLATILITY:         "Behavioral Volatility",
    DIM_SENTIMENT:          "Audience Sentiment Risk",
}

# Weights for composite score (must sum to 1.0)
DIMENSION_WEIGHTS: dict[str, float] = {
    DIM_FRAUD_ANOMALY:      0.20,
    DIM_GROWTH_ANOMALY:     0.20,
    DIM_ENGAGEMENT_QUALITY: 0.15,
    DIM_BRAND_ALIGNMENT:    0.20,
    DIM_VOLATILITY:         0.15,
    DIM_SENTIMENT:          0.10,
}


def score_to_level(score: int) -> str:
    if score >= 80: return RISK_CRITICAL
    if score >= 60: return RISK_HIGH
    if score >= 30: return RISK_MEDIUM
    return RISK_LOW


@dataclass
class RiskDimension:
    name:       str
    label:      str
    score:      int       # 0-100 (higher = more risk)
    level:      str       # low|medium|high|critical
    trend:      str       # declining|stable|rising (of this specific risk)
    signals:    list[str] = field(default_factory=list)
    confidence: str = CONF_LOW


@dataclass
class AnomalyEvent:
    anomaly_type: str    # growth_spike|engagement_drop|score_deterioration|inorganic_velocity
    description:  str
    severity:     str    # low|medium|high
    period:       str    # human-readable time period (e.g. "2026-03 to 2026-05")


@dataclass
class RiskReportResult:
    profile_id:    int
    username:      str
    platform:      str
    category:      Optional[str]
    window_days:   int
    generated_at:  datetime
    is_mock:       bool

    # Executive summary
    overall_score:     int     # 0-100
    overall_level:     str     # low|medium|high|critical
    risk_trajectory:   str     # declining|stable|rising|spike
    confidence:        str     # low|medium|high
    snapshot_count:    int     # how many snapshots informed this report

    # 6 risk dimensions
    dimensions: dict[str, RiskDimension] = field(default_factory=dict)

    # Detected anomaly events
    anomaly_events: list[AnomalyEvent] = field(default_factory=list)

    # Explainability
    evidence_summary: list[str] = field(default_factory=list)
    limitations:      list[str] = field(default_factory=list)
    note:             str = ""
