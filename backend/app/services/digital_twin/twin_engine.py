"""
Digital Twin Engine — Main orchestrator for twin generation.
Coordinates all analysis modules and persists results to DB.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot
from app.models.digital_twin import (
    InfluencerDigitalTwin, TwinForecast, TwinSignal,
    ConfidenceLevel, RiskTrend, StabilityTrend, CampaignReadiness,
)
from app.services.digital_twin.schemas import (
    SnapshotPoint, DigitalTwinResult, Confidence,
    SIGNAL_FOLLOWER_GROWTH_RATE, SIGNAL_ER_DELTA,
    SIGNAL_FRAUD_SCORE_DELTA, SIGNAL_MOMENTUM_DELTA, SIGNAL_VOLATILITY,
)
from app.services.digital_twin import (
    data_quality, trend_analysis, volatility as vol_mod,
    risk_projection, confidence_engine, forecast_engine,
)

logger = logging.getLogger(__name__)

FORECAST_VERSION = "1.0"


async def generate(
    db: AsyncSession,
    profile_id: int,
    is_mock: bool = False,
) -> DigitalTwinResult:
    """
    Generate or regenerate a Digital Twin for the given influencer profile.
    Marks previous twin as not-latest, creates new records.
    """
    # ── 1. Load profile ───────────────────────────────────────────────────────
    profile_res = await db.execute(
        select(InfluencerProfile).where(InfluencerProfile.id == profile_id)
    )
    profile = profile_res.scalar_one_or_none()
    if not profile:
        raise ValueError(f"InfluencerProfile {profile_id} not found.")

    # ── 2. Load snapshots ─────────────────────────────────────────────────────
    snap_res = await db.execute(
        select(InfluencerSnapshot)
        .where(InfluencerSnapshot.influencer_id == profile_id)
        .order_by(InfluencerSnapshot.captured_at.asc())
    )
    raw_snaps = list(snap_res.scalars().all())

    # Convert to SnapshotPoint DTOs
    snap_points: list[SnapshotPoint] = [
        SnapshotPoint(
            snapshot_id=s.id,
            captured_at=s.captured_at.replace(tzinfo=timezone.utc)
            if s.captured_at.tzinfo is None else s.captured_at,
            followers=s.followers,
            following=s.following,
            engagement_rate=s.engagement_rate,
            avg_views=s.avg_views,
            avg_likes=s.avg_likes,
            avg_comments=s.avg_comments,
            fraud_score=s.fraud_score,
            momentum_score=s.momentum_score,
            authenticity_score=s.authenticity_score,
            final_score=s.final_score,
        )
        for s in raw_snaps
    ]

    now = datetime.now(timezone.utc)

    # ── 3. Data quality check ──────────────────────────────────────────────────
    quality = data_quality.check(snap_points)

    # ── 4. Retire previous twins ───────────────────────────────────────────────
    await _retire_previous_twins(db, profile_id)

    # ── 5. Create master twin record ──────────────────────────────────────────
    oldest = snap_points[0].captured_at if snap_points else None
    newest = snap_points[-1].captured_at if snap_points else None

    twin = InfluencerDigitalTwin(
        influencer_profile_id=profile_id,
        generated_at=now,
        forecast_version=FORECAST_VERSION,
        snapshot_count=quality.snapshot_count,
        snapshot_days_coverage=quality.days_coverage,
        oldest_snapshot_at=oldest,
        newest_snapshot_at=newest,
        confidence=ConfidenceLevel(Confidence.INSUFFICIENT),
        evidence_strength="weak",
        is_forecast_available=quality.is_sufficient,
        unavailability_reason=quality.reason if not quality.is_sufficient else None,
        is_latest=True,
        is_mock=is_mock,
    )
    db.add(twin)
    await db.flush()  # get twin.id

    # ── 6. Early return if insufficient data ──────────────────────────────────
    if not quality.is_sufficient:
        await db.commit()
        return DigitalTwinResult(
            influencer_profile_id=profile_id,
            generated_at=now,
            forecast_version=FORECAST_VERSION,
            is_forecast_available=False,
            unavailability_reason=quality.reason,
            snapshot_count=quality.snapshot_count,
            snapshot_days_coverage=quality.days_coverage,
            confidence=Confidence.INSUFFICIENT,
            evidence_strength="weak",
            horizons=[],
            signals=[],
            is_mock=is_mock,
            note="Insufficient snapshot history for forecasting.",
        )

    # ── 7. Run analysis pipeline ───────────────────────────────────────────────
    trend     = trend_analysis.extract(snap_points)
    vol       = vol_mod.analyze(snap_points)
    risk      = risk_projection.project(snap_points, trend, vol)
    conf_level, evidence_strength = confidence_engine.score(quality, trend, vol)

    # ── 8. Generate forecasts ─────────────────────────────────────────────────
    horizon_forecasts = forecast_engine.project_all(snap_points, trend, vol, risk, quality)

    # ── 9. Update twin with confidence ────────────────────────────────────────
    twin.confidence      = ConfidenceLevel(conf_level)
    twin.evidence_strength = evidence_strength

    # ── 10. Persist TwinForecast records ──────────────────────────────────────
    for hf in horizon_forecasts:
        tf = TwinForecast(
            digital_twin_id=twin.id,
            horizon_days=hf.horizon_days,
            followers_projection_pct=hf.followers_projection_pct,
            followers_current=hf.followers_current,
            followers_projected=hf.followers_projected,
            followers_range_low_pct=hf.followers_range_low_pct,
            followers_range_high_pct=hf.followers_range_high_pct,
            engagement_projection_pct=hf.engagement_projection_pct,
            engagement_current=hf.engagement_current,
            engagement_projected=hf.engagement_projected,
            engagement_decay_risk=hf.engagement_decay_risk,
            risk_trend=RiskTrend(hf.risk_trend),
            stability_trend=StabilityTrend(hf.stability_trend),
            campaign_readiness=CampaignReadiness(hf.campaign_readiness),
            campaign_recommendation=hf.campaign_recommendation,
            confidence=ConfidenceLevel(hf.confidence),
            limitations=hf.limitations,
            evidence_json=hf.evidence,
            raw_signals_json={
                "trend": {
                    "growth_direction": trend.growth_direction,
                    "er_direction": trend.er_direction,
                    "fraud_trend": trend.fraud_trend,
                    "momentum_direction": trend.momentum_direction,
                    "weighted_daily_growth_rate": trend.weighted_daily_growth_rate,
                },
                "volatility": {
                    "score": vol.volatility_score,
                    "label": vol.volatility_label,
                    "spike_count": vol.spike_count,
                    "crash_count": vol.crash_count,
                },
                "risk": {
                    "overall_trend": risk.overall_trend,
                    "drivers": risk.drivers,
                },
            },
        )
        db.add(tf)

    # ── 11. Persist TwinSignals ───────────────────────────────────────────────
    signal_dtos: list[dict] = []
    for i in range(1, len(snap_points)):
        prev = snap_points[i-1]
        curr = snap_points[i]
        dt = (curr.captured_at - prev.captured_at).days or 1

        # Follower growth rate
        if prev.followers > 0:
            gr = (curr.followers - prev.followers) / prev.followers / dt
            sig = TwinSignal(
                digital_twin_id=twin.id,
                source_snapshot_id=curr.snapshot_id,
                signal_type=SIGNAL_FOLLOWER_GROWTH_RATE,
                signal_value=gr,
                weight=float(i),  # recency weight
            )
            db.add(sig)
            signal_dtos.append({
                "type": SIGNAL_FOLLOWER_GROWTH_RATE,
                "value": round(gr, 6),
                "snapshot_id": curr.snapshot_id,
            })

        # ER delta
        er_d = curr.engagement_rate - prev.engagement_rate
        db.add(TwinSignal(
            digital_twin_id=twin.id,
            source_snapshot_id=curr.snapshot_id,
            signal_type=SIGNAL_ER_DELTA,
            signal_value=er_d,
            weight=float(i),
        ))
        signal_dtos.append({
            "type": SIGNAL_ER_DELTA,
            "value": round(er_d, 4),
            "snapshot_id": curr.snapshot_id,
        })

        # Fraud score delta
        fd = float(curr.fraud_score - prev.fraud_score)
        db.add(TwinSignal(
            digital_twin_id=twin.id,
            source_snapshot_id=curr.snapshot_id,
            signal_type=SIGNAL_FRAUD_SCORE_DELTA,
            signal_value=fd,
            weight=float(i),
        ))

    # ── 12. Save volatility as aggregate signal ───────────────────────────────
    if snap_points:
        db.add(TwinSignal(
            digital_twin_id=twin.id,
            source_snapshot_id=snap_points[-1].snapshot_id,
            signal_type=SIGNAL_VOLATILITY,
            signal_value=vol.volatility_score,
            weight=1.0,
        ))

    await db.commit()
    logger.info(
        "Digital Twin generated for profile %d: conf=%s, horizons=%d, mock=%s",
        profile_id, conf_level, len(horizon_forecasts), is_mock,
    )

    return DigitalTwinResult(
        influencer_profile_id=profile_id,
        generated_at=now,
        forecast_version=FORECAST_VERSION,
        is_forecast_available=True,
        snapshot_count=quality.snapshot_count,
        snapshot_days_coverage=quality.days_coverage,
        oldest_snapshot_at=oldest,
        newest_snapshot_at=newest,
        confidence=conf_level,
        evidence_strength=evidence_strength,
        horizons=horizon_forecasts,
        signals=signal_dtos,
        is_mock=is_mock,
        note=(
            f"[MOCK] Digital Twin generated in simulation mode — no real LLM inference."
            if is_mock else
            "Digital Twin generated from real historical snapshot data."
        ),
    )


async def get_latest(
    db: AsyncSession,
    profile_id: int,
) -> Optional[InfluencerDigitalTwin]:
    """Fetch the latest twin record for a profile."""
    res = await db.execute(
        select(InfluencerDigitalTwin)
        .where(
            InfluencerDigitalTwin.influencer_profile_id == profile_id,
            InfluencerDigitalTwin.is_latest == True,
        )
    )
    return res.scalar_one_or_none()


async def get_forecasts_for_twin(
    db: AsyncSession,
    twin_id: int,
) -> list[TwinForecast]:
    res = await db.execute(
        select(TwinForecast)
        .where(TwinForecast.digital_twin_id == twin_id)
        .order_by(TwinForecast.horizon_days.asc())
    )
    return list(res.scalars().all())


async def get_high_risk_twins(
    db: AsyncSession,
    limit: int = 20,
) -> list[InfluencerDigitalTwin]:
    """Return latest twins where any forecast has increasing risk trend."""
    from sqlalchemy import and_
    res = await db.execute(
        select(InfluencerDigitalTwin)
        .join(
            TwinForecast,
            and_(
                TwinForecast.digital_twin_id == InfluencerDigitalTwin.id,
                TwinForecast.risk_trend == RiskTrend.INCREASING,
            )
        )
        .where(InfluencerDigitalTwin.is_latest == True)
        .order_by(InfluencerDigitalTwin.generated_at.desc())
        .limit(limit)
    )
    return list(res.scalars().all())


async def _retire_previous_twins(db: AsyncSession, profile_id: int) -> None:
    """Mark all previous twins for this profile as not-latest."""
    res = await db.execute(
        select(InfluencerDigitalTwin)
        .where(
            InfluencerDigitalTwin.influencer_profile_id == profile_id,
            InfluencerDigitalTwin.is_latest == True,
        )
    )
    for old_twin in res.scalars().all():
        old_twin.is_latest = False
    await db.flush()
