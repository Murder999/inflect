"""
Competitor Intelligence Agent — Part 13

Market Intelligence department. Detects and analyses competitor influencer strategies.

MOCK mode: deterministic synthetic report (no fake certainty, clearly labeled).
ACTIVE mode: real archive scan → evidence-based report.
"""
from __future__ import annotations

import logging
from typing import Any

from app.services.agents.base_agent import BaseAgent, AgentResult
from app.models.agent import AgentTask

logger = logging.getLogger(__name__)


class CompetitorIntelligenceAgent(BaseAgent):
    """
    Analyzes competitor creator strategies and surfaces strategic opportunities.
    Integrates with the competitor_intelligence service layer.
    """

    HANDLED_TASK_TYPES = {
        "competitor_intel_report",
        "competitor_lookup",
        "competitor_opportunities",
        "competitor_intel_scan",
        "general",
    }

    async def can_handle(self, task_type: str) -> bool:
        return task_type in self.HANDLED_TASK_TYPES

    async def plan(self, task: AgentTask) -> dict[str, Any]:
        return {
            "steps": [
                "Normalize brand name and find or create competitor record",
                "Detect creator signals from archive (brand_analysis + category_match)",
                "Analyze category, platform, and tier distribution",
                "Estimate spend range (Turkish market rates, no fake precision)",
                "Score confidence based on signal quality",
                "Detect strategic opportunities (gaps, saturation)",
                "Build evidence summary and limitation disclosures",
                "Cache and return structured report",
            ],
            "requires_llm": False,
            "data_source": "competitor_intelligence_engine",
        }

    async def execute(self, task: AgentTask) -> AgentResult:
        mode = self.agent.mode.value if self.agent.mode else "mock"

        if mode == "disabled":
            return AgentResult(
                success=False,
                output={"error": "Agent devre dışı."},
                summary="Competitor Intelligence Agent is disabled.",
                risk_level="low",
            )

        is_mock = (mode == "mock")
        input_data = task.input_data or {}
        brand_name = input_data.get("brand_name") or input_data.get("competitor_name")

        if not brand_name:
            return AgentResult(
                success=False,
                output={"error": "brand_name parametresi gerekli."},
                summary="brand_name parametresi eksik.",
                risk_level="low",
                error="brand_name missing",
            )

        window_days = int(input_data.get("window_days", 90))
        user_id     = input_data.get("user_id")
        force       = bool(input_data.get("force", False))

        try:
            from app.services.competitor_intelligence.engine import generate_report
            result = await generate_report(
                db=self.db,
                brand_name=brand_name,
                window_days=window_days,
                user_id=user_id,
                force=force,
            )
        except Exception as exc:
            logger.error("Competitor intelligence report failed for %s: %s", brand_name, exc)
            return AgentResult(
                success=False,
                output={"error": "Rapor üretilemedi.", "brand_name": brand_name},
                summary=f"Competitor raporu başarısız: {brand_name}",
                risk_level="medium",
                error=str(exc),
            )

        mock_flag = "[MOCK] " if result.is_mock else ""
        output = {
            "is_mock":              result.is_mock,
            "competitor_id":        result.competitor_id,
            "competitor_name":      result.competitor_name,
            "analysis_window_days": result.analysis_window_days,
            "generated_at":         result.generated_at.isoformat(),
            "creator_count":        result.creator_count,
            "dominant_platform":    result.dominant_platform,
            "dominant_category":    result.dominant_category,
            "avg_creator_followers": result.avg_creator_followers,
            "estimated_creator_tier": result.estimated_creator_tier,
            "creator_momentum":     result.creator_momentum,
            "campaign_aggression":  result.campaign_aggression,
            "confidence":           result.confidence,
            "spend_estimate":       {
                "range_low_tl":  result.spend_estimate.range_low_tl  if result.spend_estimate else None,
                "range_high_tl": result.spend_estimate.range_high_tl if result.spend_estimate else None,
                "confidence":    result.spend_estimate.confidence     if result.spend_estimate else None,
            } if result.spend_estimate else None,
            "opportunities": [
                {
                    "type":       o.opportunity_type,
                    "title":      o.title,
                    "priority":   o.priority,
                    "confidence": o.confidence,
                }
                for o in result.opportunities
            ],
            "evidence_summary": result.evidence_summary,
            "limitations":      result.limitations,
            "note":             result.note,
        }

        return AgentResult(
            success=True,
            output=output,
            summary=(
                f"{mock_flag}Competitor Intelligence: {result.competitor_name} — "
                f"{result.creator_count} creator, {result.dominant_platform.title()} dominant, "
                f"güven: {result.confidence}, {len(result.opportunities)} fırsat tespit edildi."
            ),
            risk_level="low",
            requires_approval=False,
            conversation_messages=[
                self.create_conversation_message(
                    f"{mock_flag}Competitor raporu hazır: {result.competitor_name}. "
                    f"{result.creator_count} creator sinyali, "
                    f"spend: {result.spend_estimate.range_low_tl:,}–{result.spend_estimate.range_high_tl:,} TL."
                    if result.spend_estimate else
                    f"{mock_flag}Competitor raporu hazır: {result.competitor_name}. "
                    f"{result.creator_count} creator sinyali.",
                    "analysis",
                )
            ],
        )
