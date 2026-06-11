"""
Digital Twin Agent — Generates and monitors Influencer Digital Twins.
Part 12: Evidence-based behavioral forecasting.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select, func

from app.services.agents.base_agent import BaseAgent, AgentResult
from app.models.agent import AgentTask
from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot
from app.models.digital_twin import InfluencerDigitalTwin, TwinForecast, RiskTrend

logger = logging.getLogger(__name__)

STALE_TWIN_DAYS = 7   # regenerate if twin is older than this


class DigitalTwinAgent(BaseAgent):
    """
    Analyzes snapshot history, generates Digital Twins, and detects stale/high-risk twins.
    Works in MOCK mode (labeled) or ACTIVE mode (real DB queries + forecast engine).
    """

    HANDLED_TASK_TYPES = {
        "digital_twin_generate",
        "digital_twin_refresh",
        "digital_twin_audit",
        "digital_twin_high_risk_scan",
        "sub_digital_twin_generate",
        "general",
    }

    async def can_handle(self, task_type: str) -> bool:
        return task_type in self.HANDLED_TASK_TYPES

    async def plan(self, task: AgentTask) -> dict[str, Any]:
        return {
            "steps": [
                "Load influencer profile and snapshots",
                "Validate data quality (min snapshots, coverage)",
                "Run trend, volatility, and risk analysis",
                "Generate forecast for 30/90/180 horizons",
                "Persist twin + signals to database",
                "Return structured result with evidence",
            ],
            "requires_llm": False,
            "data_source": "influencer_snapshots",
        }

    async def execute(self, task: AgentTask) -> AgentResult:
        mode = self.agent.mode.value if self.agent.mode else "mock"

        if mode == "disabled":
            return AgentResult(
                success=False,
                output={"error": "Agent is DISABLED."},
                summary="Digital Twin Agent is disabled.",
                risk_level="low",
            )

        is_mock = mode == "mock"

        if is_mock:
            return await self._execute_mock(task)
        else:
            return await self._execute_active(task)

    async def _execute_mock(self, task: AgentTask) -> AgentResult:
        """Mock mode: scan DB but do not write twins, return labeled summary."""
        # Still run real DB queries — just don't persist
        profile_count_res = await self.db.execute(
            select(func.count()).select_from(InfluencerProfile)
        )
        profile_count = profile_count_res.scalar() or 0

        snap_count_res = await self.db.execute(
            select(func.count()).select_from(InfluencerSnapshot)
        )
        snap_count = snap_count_res.scalar() or 0

        twin_count_res = await self.db.execute(
            select(func.count())
            .select_from(InfluencerDigitalTwin)
            .where(InfluencerDigitalTwin.is_latest == True)
        )
        twin_count = twin_count_res.scalar() or 0

        avg_snaps = round(snap_count / profile_count, 1) if profile_count > 0 else 0.0
        forecasts_possible = snap_count > 0

        output = {
            "is_mock": True,
            "note": (
                "[MOCK MODE] This agent performed read-only DB queries. "
                "Switch to ACTIVE mode to generate real Digital Twins."
            ),
            "platform_summary": {
                "total_profiles": profile_count,
                "total_snapshots": snap_count,
                "avg_snapshots_per_profile": avg_snaps,
                "existing_twins": twin_count,
                "forecasting_possible": forecasts_possible,
            },
            "mock_twin_preview": {
                "confidence": "medium" if avg_snaps >= 4 else "low",
                "horizon_30d": {"followers_projection_pct": None, "note": "MOCK — not computed"},
                "horizon_90d": {"followers_projection_pct": None, "note": "MOCK — not computed"},
                "horizon_180d": {"followers_projection_pct": None, "note": "MOCK — not computed"},
            },
            "recommendation": (
                f"Platform has {profile_count} profiles with avg {avg_snaps} snapshots each. "
                f"{'Forecasting is possible for profiles with 3+ snapshots.' if forecasts_possible else 'Need more snapshot data for forecasting.'}"
            ),
        }

        return AgentResult(
            success=True,
            output=output,
            summary=(
                f"[MOCK] Digital Twin audit: {profile_count} profiles, "
                f"{snap_count} snapshots, {twin_count} existing twins. "
                f"Avg {avg_snaps} snapshots/profile."
            ),
            risk_level="low",
            requires_approval=False,
            conversation_messages=[
                self.create_conversation_message(
                    f"[MOCK] Digital Twin Agent scanned {profile_count} profiles. "
                    f"Real twin generation requires ACTIVE mode.",
                    "analysis",
                )
            ],
        )

    async def _execute_active(self, task: AgentTask) -> AgentResult:
        """Active mode: generate real twins from snapshot data."""
        from app.services.digital_twin import twin_engine

        input_data = task.input_data or {}
        profile_id = input_data.get("profile_id")

        if profile_id:
            # Single profile twin generation
            try:
                result = await twin_engine.generate(
                    db=self.db,
                    profile_id=int(profile_id),
                    is_mock=False,
                )
                return AgentResult(
                    success=True,
                    output={
                        "profile_id": profile_id,
                        "confidence": result.confidence,
                        "evidence_strength": result.evidence_strength,
                        "snapshot_count": result.snapshot_count,
                        "days_coverage": result.snapshot_days_coverage,
                        "is_forecast_available": result.is_forecast_available,
                        "unavailability_reason": result.unavailability_reason,
                        "horizon_count": len(result.horizons),
                        "is_mock": False,
                    },
                    summary=(
                        f"Digital Twin generated for profile {profile_id}. "
                        f"Confidence: {result.confidence}, "
                        f"{result.snapshot_count} snapshots, "
                        f"{result.snapshot_days_coverage} days coverage."
                    ),
                    risk_level="low",
                )
            except Exception as exc:
                logger.error("Twin generation failed for profile %s: %s", profile_id, exc)
                return AgentResult(
                    success=False,
                    output={"error": str(exc), "profile_id": profile_id},
                    summary=f"Digital Twin generation failed for profile {profile_id}: {exc}",
                    risk_level="medium",
                    error=str(exc),
                )
        else:
            # Batch: detect stale twins
            return await self._batch_stale_scan()

    async def _batch_stale_scan(self) -> AgentResult:
        """Scan for profiles with no twin or stale twins."""
        from datetime import datetime, timezone, timedelta

        stale_cutoff = datetime.now(timezone.utc) - timedelta(days=STALE_TWIN_DAYS)

        # Profiles without any twin
        existing_ids_res = await self.db.execute(
            select(InfluencerDigitalTwin.influencer_profile_id)
            .where(InfluencerDigitalTwin.is_latest == True)
        )
        existing_ids = {row[0] for row in existing_ids_res.all()}

        all_profiles_res = await self.db.execute(
            select(InfluencerProfile.id)
        )
        all_ids = {row[0] for row in all_profiles_res.all()}

        no_twin_ids = list(all_ids - existing_ids)

        # Profiles with stale twins
        stale_res = await self.db.execute(
            select(InfluencerDigitalTwin.influencer_profile_id)
            .where(
                InfluencerDigitalTwin.is_latest == True,
                InfluencerDigitalTwin.generated_at < stale_cutoff,
            )
        )
        stale_ids = [row[0] for row in stale_res.all()]

        return AgentResult(
            success=True,
            output={
                "profiles_without_twin": len(no_twin_ids),
                "profiles_with_stale_twin": len(stale_ids),
                "no_twin_profile_ids": no_twin_ids[:20],   # first 20
                "stale_profile_ids": stale_ids[:20],
                "regeneration_recommended": len(no_twin_ids) + len(stale_ids) > 0,
                "is_mock": False,
            },
            summary=(
                f"Twin audit: {len(no_twin_ids)} profiles need initial twin, "
                f"{len(stale_ids)} twins are stale (>{STALE_TWIN_DAYS}d old)."
            ),
            risk_level="low" if (len(no_twin_ids) + len(stale_ids)) < 10 else "medium",
        )
