"""
Risk Radar Engine — Part 15

Main orchestration layer. Coordinates all sub-modules:
  anomaly_detection → volatility_engine → brand_alignment →
  risk_scoring → confidence_engine → explainability → cache

AGENTS_MODE=mock  → deterministic synthetic report
AGENTS_MODE=live  → real snapshot analysis (requires archive data)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot
from app.models.risk_radar import InfluencerRiskReport, RiskAlert
from app.services.risk_radar.schemas import (
    RiskReportResult, RiskDimension, AnomalyEvent,
    DIM_FRAUD_ANOMALY, DIM_GROWTH_ANOMALY, DIM_ENGAGEMENT_QUALITY,
    DIM_BRAND_ALIGNMENT, DIM_VOLATILITY, DIM_SENTIMENT,
    score_to_level,
)
from app.services.risk_radar.anomaly_detection import (
    analyze_growth_anomalies, analyze_engagement_anomalies,
)
from app.services.risk_radar.volatility_engine import analyze_volatility
from app.services.risk_radar.brand_alignment import (
    analyze_brand_alignment, analyze_engagement_quality_risk, analyze_sentiment_risk,
)
from app.services.risk_radar.risk_scoring import (
    analyze_fraud_risk, compute_composite_score, compute_trajectory,
)
from app.services.risk_radar.confidence_engine import compute_confidence
from app.services.risk_radar.explainability import build_evidence_summary, build_limitations
from app.services.risk_radar.mock_generator import generate_mock_report

_CACHE_TTL_LIVE = timedelta(hours=24)
_CACHE_TTL_MOCK = timedelta(hours=1)


async def scan_influencer(
    db:          AsyncSession,
    profile_id:  int,
    window_days: int = 90,
    user_id:     Optional[int] = None,
    force:       bool = False,
) -> RiskReportResult:
    """
    Generate (or return cached) risk radar report for a profile.
    Mode controlled by settings.AGENTS_MODE.
    """
    is_mock = (getattr(settings, "AGENTS_MODE", "mock").lower() == "mock")

    # Load profile
    profile_res = await db.execute(
        select(InfluencerProfile).where(InfluencerProfile.id == profile_id)
    )
    profile = profile_res.scalar_one_or_none()
    if profile is None:
        raise ValueError(f"Profile not found: {profile_id}")

    # Cache check
    if not force:
        cached = await _get_cached_report(db, profile_id, window_days, is_mock)
        if cached:
            return cached

    # Generate
    if is_mock:
        result = generate_mock_report(
            profile_id=profile.id,
            username=profile.username,
            platform=profile.platform,
            category=profile.category,
            window_days=window_days,
        )
    else:
        result = await _run_live_analysis(db, profile, window_days)

    # Persist
    await _cache_report(db, profile_id, window_days, is_mock, user_id, result)

    # Alerts (with dedup; source=manual_scan for API-triggered scans)
    await _check_and_create_alerts(
        db, profile_id, result, source="manual_scan"
    )

    # Events
    await _fire_events(db, profile, result)

    return result


async def get_latest_report(
    db:          AsyncSession,
    profile_id:  int,
    window_days: int = 90,
) -> Optional[RiskReportResult]:
    """Return latest cached report without generating a new one."""
    is_mock = (getattr(settings, "AGENTS_MODE", "mock").lower() == "mock")
    return await _get_cached_report(db, profile_id, window_days, is_mock)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _run_live_analysis(
    db:          AsyncSession,
    profile:     InfluencerProfile,
    window_days: int,
) -> RiskReportResult:
    """Full evidence-based analysis from snapshot history."""
    from datetime import timezone
    from app.core.config import settings as _s

    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    snaps_res = await db.execute(
        select(InfluencerSnapshot)
        .where(
            InfluencerSnapshot.influencer_id == profile.id,
            InfluencerSnapshot.captured_at >= cutoff,
        )
        .order_by(InfluencerSnapshot.captured_at.asc())
    )
    snapshots = list(snaps_res.scalars().all())

    # ── Run all analysis modules ──────────────────────────────────────────────
    fraud_dim                          = analyze_fraud_risk(snapshots)
    growth_dim, growth_anomalies       = analyze_growth_anomalies(snapshots)
    eq_dim                             = analyze_engagement_quality_risk(snapshots)
    brand_dim, brand_anomalies         = analyze_brand_alignment(snapshots)
    volatility_dim, vol_anomalies      = analyze_volatility(snapshots)
    sentiment_dim                      = analyze_sentiment_risk(snapshots)
    engagement_anomalies               = analyze_engagement_anomalies(snapshots)

    dimensions = {
        DIM_FRAUD_ANOMALY:      fraud_dim,
        DIM_GROWTH_ANOMALY:     growth_dim,
        DIM_ENGAGEMENT_QUALITY: eq_dim,
        DIM_BRAND_ALIGNMENT:    brand_dim,
        DIM_VOLATILITY:         volatility_dim,
        DIM_SENTIMENT:          sentiment_dim,
    }

    all_anomalies: list[AnomalyEvent] = (
        growth_anomalies + brand_anomalies + vol_anomalies + engagement_anomalies
    )

    overall_score = compute_composite_score(dimensions)
    trajectory    = compute_trajectory(snapshots, dimensions)
    confidence    = compute_confidence(snapshots, window_days)
    evidence      = build_evidence_summary(dimensions, len(snapshots), overall_score, trajectory)
    limitations   = build_limitations(len(snapshots), False, window_days)

    note = "" if snapshots else (
        "Archive'da bu profil için snapshot bulunamadı. "
        "Gerçek analiz için POST /archive/import-json ile veri yükleyin."
    )

    return RiskReportResult(
        profile_id=profile.id,
        username=profile.username,
        platform=profile.platform,
        category=profile.category,
        window_days=window_days,
        generated_at=datetime.now(timezone.utc),
        is_mock=False,
        overall_score=overall_score,
        overall_level=score_to_level(overall_score),
        risk_trajectory=trajectory,
        confidence=confidence,
        snapshot_count=len(snapshots),
        dimensions=dimensions,
        anomaly_events=all_anomalies,
        evidence_summary=evidence,
        limitations=limitations,
        note=note,
    )


async def _get_cached_report(
    db:          AsyncSession,
    profile_id:  int,
    window_days: int,
    is_mock:     bool,
) -> Optional[RiskReportResult]:
    now = datetime.now(timezone.utc)
    res = await db.execute(
        select(InfluencerRiskReport)
        .where(
            InfluencerRiskReport.profile_id  == profile_id,
            InfluencerRiskReport.window_days == window_days,
            InfluencerRiskReport.is_mock     == is_mock,
            InfluencerRiskReport.expires_at  > now,
        )
        .order_by(desc(InfluencerRiskReport.generated_at))
        .limit(1)
    )
    row = res.scalar_one_or_none()
    if row is None:
        return None
    return _deserialize(row.report_json)


async def _cache_report(
    db:          AsyncSession,
    profile_id:  int,
    window_days: int,
    is_mock:     bool,
    user_id:     Optional[int],
    result:      RiskReportResult,
) -> None:
    ttl = _CACHE_TTL_MOCK if is_mock else _CACHE_TTL_LIVE
    now = datetime.now(timezone.utc)
    row = InfluencerRiskReport(
        profile_id=profile_id,
        window_days=window_days,
        is_mock=is_mock,
        overall_score=result.overall_score,
        overall_level=result.overall_level,
        risk_trajectory=result.risk_trajectory,
        confidence=result.confidence,
        generated_by_user_id=user_id,
        report_json=_serialize(result),
        generated_at=now,
        expires_at=now + ttl,
    )
    db.add(row)
    try:
        await db.commit()
    except Exception:
        await db.rollback()


async def _check_and_create_alerts(
    db:             AsyncSession,
    profile_id:     int,
    result:         RiskReportResult,
    previous_score: Optional[int] = None,
    source:         str = "manual_scan",
) -> tuple[int, int]:
    """
    Create or update RiskAlert if risk level is high/critical.

    Returns (alerts_created, alerts_updated).
    Dedup: existing open alert with same (profile_id, alert_type) is updated,
    not duplicated.
    """
    from app.services.risk_alert_service import create_or_update_alert
    from app.models.risk_radar import AlertSource

    alerts_created = 0
    alerts_updated = 0

    if result.overall_level not in ("high", "critical"):
        return alerts_created, alerts_updated

    try:
        alert, created = await create_or_update_alert(
            db=db,
            profile_id=profile_id,
            alert_type="risk_threshold",
            severity=result.overall_level,
            message=(
                f"Risk skoru {result.overall_score}/100 ({result.overall_level.upper()}) — "
                f"trajectory: {result.risk_trajectory}"
            ),
            source=source,
            platform=result.platform,
            previous_score=float(previous_score) if previous_score is not None else None,
            current_score=float(result.overall_score),
            explanation=result.evidence_summary[0] if result.evidence_summary else None,
            evidence=result.evidence_summary[:5] if result.evidence_summary else None,
            details={
                "overall_score": result.overall_score,
                "overall_level": result.overall_level,
                "trajectory":    result.risk_trajectory,
                "confidence":    result.confidence,
                "is_mock":       result.is_mock,
            },
        )
        await db.commit()
        if created:
            alerts_created += 1
        else:
            alerts_updated += 1
    except Exception as exc:
        logger.error("_check_and_create_alerts error: %s", exc, exc_info=True)
        await db.rollback()

    return alerts_created, alerts_updated


async def _fire_events(
    db:      AsyncSession,
    profile: InfluencerProfile,
    result:  RiskReportResult,
) -> None:
    try:
        from app.services.event_bus import publish as pub
        await pub(
            session=db,
            event_type="creator.risk_changed",
            payload={
                "profile_id":    profile.id,
                "username":      profile.username,
                "platform":      profile.platform,
                "overall_score": result.overall_score,
                "overall_level": result.overall_level,
                "trajectory":    result.risk_trajectory,
                "is_mock":       result.is_mock,
            },
            source="risk_radar_engine",
        )
        if result.overall_level in ("high", "critical"):
            await pub(
                session=db,
                event_type="creator.high_risk_detected",
                payload={
                    "profile_id":   profile.id,
                    "username":     profile.username,
                    "overall_level": result.overall_level,
                    "trajectory":   result.risk_trajectory,
                },
                source="risk_radar_engine",
            )
    except Exception:
        pass


# ── Serialisation ─────────────────────────────────────────────────────────────

def _serialize(result: RiskReportResult) -> dict:
    from dataclasses import asdict
    d = asdict(result)
    if isinstance(d.get("generated_at"), datetime):
        d["generated_at"] = d["generated_at"].isoformat()
    return d


def _deserialize(data: dict) -> RiskReportResult:
    generated_at = data.get("generated_at")
    if isinstance(generated_at, str):
        generated_at = datetime.fromisoformat(generated_at)

    dimensions = {}
    for k, v in (data.get("dimensions") or {}).items():
        dimensions[k] = RiskDimension(**v)

    anomaly_events = [AnomalyEvent(**a) for a in (data.get("anomaly_events") or [])]

    return RiskReportResult(
        profile_id=data["profile_id"],
        username=data["username"],
        platform=data["platform"],
        category=data.get("category"),
        window_days=data["window_days"],
        generated_at=generated_at,
        is_mock=data["is_mock"],
        overall_score=data["overall_score"],
        overall_level=data["overall_level"],
        risk_trajectory=data["risk_trajectory"],
        confidence=data["confidence"],
        snapshot_count=data.get("snapshot_count", 0),
        dimensions=dimensions,
        anomaly_events=anomaly_events,
        evidence_summary=data.get("evidence_summary", []),
        limitations=data.get("limitations", []),
        note=data.get("note", ""),
    )
