"""
Risk Scan Scheduler — Part 17

Daily background job that scans all watchlisted and active-campaign influencer
profiles through the Risk Radar engine.

Design principles:
  - Runs independently of the agent scheduler (no Agent DB record needed)
  - One DB session per profile to isolate failures
  - Per-profile errors do NOT crash the entire batch
  - Scheduled scans do NOT deduct user credits (logged as NOT_CHARGED)
  - Dedup: create_or_update_alert prevents alert spam
  - One RiskScanLog row per batch for full audit trail

Start/stop API mirrors agent_scheduler for consistency:
    start_risk_scanner(get_session)
    stop_risk_scanner()
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Callable

from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_scanner_task: asyncio.Task | None = None
_running = False

# Run 24 hours after startup, then every 24 hours
_SCAN_INTERVAL_SECONDS = 86_400   # 24 h
_STARTUP_DELAY_SECONDS = 300      # 5-minute grace period on startup


# ── Main entry points ─────────────────────────────────────────────────────────

def start_risk_scanner(get_session: Callable) -> None:
    """Start the risk scan background loop. Call from lifespan startup."""
    global _scanner_task, _running
    if _scanner_task and not _scanner_task.done():
        logger.warning("Risk scanner already running.")
        return
    _running = True
    _scanner_task = asyncio.create_task(_scanner_loop(get_session))
    logger.info("✓ Risk scan scheduler started (interval: 24 h).")


def stop_risk_scanner() -> None:
    """Stop the risk scan background loop. Call from lifespan shutdown."""
    global _scanner_task, _running
    _running = False
    if _scanner_task and not _scanner_task.done():
        _scanner_task.cancel()
        logger.info("Risk scan scheduler stopped.")


async def trigger_risk_scan_now(get_session: Callable) -> dict:
    """
    Manually trigger a full scan immediately (admin action).
    Returns a summary dict.
    """
    return await _run_scan_batch(get_session, trigger_source="manual")


# ── Internal loop ─────────────────────────────────────────────────────────────

async def _scanner_loop(get_session: Callable) -> None:
    global _running
    logger.info("Risk scanner: waiting %ds before first scan.", _STARTUP_DELAY_SECONDS)
    await asyncio.sleep(_STARTUP_DELAY_SECONDS)

    while _running:
        try:
            summary = await _run_scan_batch(get_session, trigger_source="scheduled")
            logger.info(
                "Risk scan complete: scanned=%d ok=%d failed=%d "
                "alerts_created=%d alerts_updated=%d",
                summary["profiles_scanned"],
                summary["profiles_succeeded"],
                summary["profiles_failed"],
                summary["alerts_created"],
                summary["alerts_updated"],
            )
        except Exception as exc:
            logger.error("Risk scan batch error: %s", exc, exc_info=True)

        if _running:
            await asyncio.sleep(_SCAN_INTERVAL_SECONDS)


# ── Batch scan logic ──────────────────────────────────────────────────────────

async def _run_scan_batch(
    get_session:    Callable,
    trigger_source: str = "scheduled",
) -> dict:
    """
    Scan all watchlisted and active-campaign influencer profiles.

    Returns:
        dict with profiles_scanned, profiles_succeeded, profiles_failed,
             alerts_created, alerts_updated
    """
    from app.models.watchlist import WatchlistItem
    from app.models.campaign import Campaign, CampaignStatus
    from app.models.risk_radar import RiskScanLog
    from app.models.intelligence_billing import IntelligenceUsageLog, UsageStatus

    started_at = datetime.now(timezone.utc)
    log_id: int | None = None

    # ── Collect profile IDs to scan ───────────────────────────────────────────
    profile_ids: set[int] = set()

    async with get_session() as session:
        # Watchlisted influencers that have an archive profile
        from app.models.influencer_archive import InfluencerProfile
        wl_res = await session.execute(
            select(InfluencerProfile.id)
            .join(
                WatchlistItem,
                (WatchlistItem.username == InfluencerProfile.username) &
                (WatchlistItem.platform == InfluencerProfile.platform),
            )
            .distinct()
        )
        profile_ids.update(r[0] for r in wl_res.all())

        # Profiles referenced in active campaigns (handles field → username lookup)
        active_campaigns_res = await session.execute(
            select(Campaign).where(Campaign.status == CampaignStatus.ACTIVE)
        )
        for campaign in active_campaigns_res.scalars().all():
            handles = campaign.handles or []
            for handle in handles:
                if isinstance(handle, dict):
                    username = handle.get("username", "")
                    platform = handle.get("platform", "")
                elif isinstance(handle, str):
                    username = handle.lstrip("@")
                    platform = ""
                else:
                    continue

                if not username:
                    continue

                q = select(InfluencerProfile.id).where(
                    InfluencerProfile.username == username
                )
                if platform:
                    q = q.where(InfluencerProfile.platform == platform)
                res = await session.execute(q.limit(1))
                row = res.scalar_one_or_none()
                if row:
                    profile_ids.add(row)

        # Create scan log row
        scan_log = RiskScanLog(
            started_at=started_at,
            trigger_source=trigger_source,
            profiles_scanned=len(profile_ids),
        )
        session.add(scan_log)
        await session.commit()
        await session.refresh(scan_log)
        log_id = scan_log.id

    if not profile_ids:
        logger.info("Risk scanner: no profiles to scan.")
        return {
            "profiles_scanned":   0,
            "profiles_succeeded": 0,
            "profiles_failed":    0,
            "alerts_created":     0,
            "alerts_updated":     0,
        }

    logger.info("Risk scanner: scanning %d profiles.", len(profile_ids))

    succeeded   = 0
    failed      = 0
    total_created = 0
    total_updated = 0

    # ── Scan each profile in its own session ──────────────────────────────────
    for profile_id in profile_ids:
        if not _running and trigger_source == "scheduled":
            logger.info("Risk scanner: stop requested, halting mid-batch.")
            break

        try:
            alerts_created, alerts_updated = await _scan_single_profile(
                get_session, profile_id, trigger_source
            )
            succeeded    += 1
            total_created += alerts_created
            total_updated += alerts_updated
        except Exception as exc:
            failed += 1
            logger.error(
                "Risk scan failed for profile_id=%d: %s",
                profile_id, exc, exc_info=True,
            )

    # ── Update scan log ───────────────────────────────────────────────────────
    if log_id is not None:
        async with get_session() as session:
            res = await session.execute(
                select(RiskScanLog).where(RiskScanLog.id == log_id)
            )
            scan_log = res.scalar_one_or_none()
            if scan_log:
                scan_log.completed_at       = datetime.now(timezone.utc)
                scan_log.profiles_scanned   = len(profile_ids)
                scan_log.profiles_succeeded = succeeded
                scan_log.profiles_failed    = failed
                scan_log.alerts_created     = total_created
                scan_log.alerts_updated     = total_updated
                session.add(scan_log)
                await session.commit()

    return {
        "profiles_scanned":   len(profile_ids),
        "profiles_succeeded": succeeded,
        "profiles_failed":    failed,
        "alerts_created":     total_created,
        "alerts_updated":     total_updated,
    }


async def _scan_single_profile(
    get_session:    Callable,
    profile_id:     int,
    trigger_source: str,
) -> tuple[int, int]:
    """
    Scan one profile.  Returns (alerts_created, alerts_updated).

    Uses its own DB session so a crash here doesn't affect the batch.
    Logs the scan as NOT_CHARGED (system job, no user credit deduction).
    """
    from app.services.risk_radar.engine import scan_influencer, _check_and_create_alerts
    from app.services.intelligence_billing import record_failed_usage
    from app.models.intelligence_billing import IntelligenceUsageLog, UsageStatus

    source = "scheduled_scan" if trigger_source == "scheduled" else "manual_scan"

    async with get_session() as session:
        # Fetch previous score for delta calculation
        from app.models.risk_radar import InfluencerRiskReport
        from sqlalchemy import desc
        prev_res = await session.execute(
            select(InfluencerRiskReport.overall_score)
            .where(InfluencerRiskReport.profile_id == profile_id)
            .order_by(desc(InfluencerRiskReport.generated_at))
            .limit(1)
        )
        previous_score = prev_res.scalar_one_or_none()

        # Run risk scan (may use cached result if not expired)
        result = await scan_influencer(
            db=session,
            profile_id=profile_id,
            window_days=90,
            user_id=None,   # system job — no user
            force=False,
        )

        # Create/update alerts
        alerts_created, alerts_updated = await _check_and_create_alerts(
            db=session,
            profile_id=profile_id,
            result=result,
            previous_score=previous_score,
            source=source,
        )

        # Log as NOT_CHARGED system usage
        log = IntelligenceUsageLog(
            user_id=0,              # 0 = system / no user
            feature_slug="risk_radar_scan",
            credits_charged=0,
            report_mode="scheduled",
            status=UsageStatus.NOT_CHARGED.value,
            failure_code=None,
            metadata_json={
                "profile_id":   profile_id,
                "trigger":      trigger_source,
                "overall_level": result.overall_level,
                "is_mock":      result.is_mock,
            },
        )
        session.add(log)
        await session.commit()

        logger.debug(
            "Risk scan ok: profile_id=%d score=%d level=%s created=%d updated=%d",
            profile_id, result.overall_score, result.overall_level,
            alerts_created, alerts_updated,
        )
        return alerts_created, alerts_updated
