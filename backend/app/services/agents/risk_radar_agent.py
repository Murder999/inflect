"""
Risk Radar Agent — Part 15
Trust & Safety Intelligence department.

MOCK mode: deterministic scan stats from DB.
ACTIVE mode: full archive-based risk scan for stale/unscanned profiles.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select, func

from app.services.agents.base_agent import BaseAgent, AgentResult
from app.models.agent import AgentTask
from app.models.influencer_archive import InfluencerProfile

logger = logging.getLogger(__name__)


class RiskRadarAgent(BaseAgent):
    """
    Monitors creator risk scores, detects high-risk profiles, and escalates alerts.
    Operates on archive snapshot data — no external LLM needed.
    """

    HANDLED_TASK_TYPES = {
        "risk_scan",
        "risk_audit",
        "risk_high_risk_scan",
        "brand_safety_check",
        "general",
    }

    async def can_handle(self, task_type: str) -> bool:
        return task_type in self.HANDLED_TASK_TYPES

    async def plan(self, task: AgentTask) -> dict[str, Any]:
        return {
            "steps": [
                "Load influencer profiles from archive",
                "Check existing risk reports — identify unscanned/stale",
                "Run risk analysis on each profile",
                "Flag high-risk and rising-trajectory creators",
                "Create alerts for threshold violations",
                "Return summary with evidence",
            ],
            "requires_llm": False,
            "data_source": "influencer_snapshots + risk_reports",
        }

    async def execute(self, task: AgentTask) -> AgentResult:
        mode = self.agent.mode.value if self.agent.mode else "mock"

        if mode == "disabled":
            return AgentResult(
                success=False,
                output={"error": "Agent DISABLED."},
                is_mock=False,
            )

        if mode == "mock":
            return await self._mock_run(task)
        return await self._active_run(task)

    async def _mock_run(self, task: AgentTask) -> AgentResult:
        db = task.db_session if hasattr(task, "db_session") else None
        profile_count = 0
        if db:
            try:
                res = await db.execute(
                    select(func.count(InfluencerProfile.id))
                )
                profile_count = res.scalar_one_or_none() or 0
            except Exception:
                pass

        return AgentResult(
            success=True,
            output={
                "is_mock":       True,
                "mode":          "mock",
                "profiles_in_archive": profile_count,
                "scanned":       0,
                "high_risk":     0,
                "alerts_created":0,
                "note":          (
                    "[MOCK] Risk Radar scan simüle edildi. "
                    "Gerçek tarama için AGENTS_MODE=live gereklidir."
                ),
            },
            requires_approval=False,
            is_mock=True,
        )

    async def _active_run(self, task: AgentTask) -> AgentResult:
        db = task.db_session if hasattr(task, "db_session") else None
        if not db:
            return AgentResult(
                success=False,
                output={"error": "DB session unavailable in active mode."},
                is_mock=False,
            )

        try:
            from app.services.risk_radar.engine import scan_influencer
            from app.models.risk_radar import InfluencerRiskReport
            from datetime import datetime, timezone, timedelta

            # Find profiles without a recent risk report
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            scanned_ids_res = await db.execute(
                select(InfluencerRiskReport.profile_id)
                .where(InfluencerRiskReport.generated_at > cutoff)
                .distinct()
            )
            scanned_ids = {r[0] for r in scanned_ids_res.fetchall()}

            # Get profiles to scan (limit to 10 per run)
            profiles_res = await db.execute(
                select(InfluencerProfile)
                .where(InfluencerProfile.id.notin_(scanned_ids))
                .limit(10)
            )
            profiles = list(profiles_res.scalars().all())

            scanned  = 0
            high_risk = 0
            for p in profiles:
                try:
                    result = await scan_influencer(db=db, profile_id=p.id)
                    scanned += 1
                    if result.overall_level in ("high", "critical"):
                        high_risk += 1
                except Exception as exc:
                    logger.warning("Risk scan failed for profile %d: %s", p.id, exc)

            return AgentResult(
                success=True,
                output={
                    "is_mock":       False,
                    "mode":          "active",
                    "scanned":       scanned,
                    "high_risk":     high_risk,
                    "note":          f"{scanned} profil tarandı, {high_risk} yüksek risk tespit edildi.",
                },
                requires_approval=high_risk > 0,
                is_mock=False,
            )

        except Exception as exc:
            logger.error("RiskRadarAgent active run failed: %s", exc)
            return AgentResult(
                success=False,
                output={"error": str(exc)},
                is_mock=False,
            )
