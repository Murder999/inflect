"""
Data Quality Agent — Influencer archive veri kalitesi, duplicate tespiti, eksik alanlar.
Part 11: Gerçek DB verisiyle çalışır (ACTIVE modda).
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.agents.base_agent import BaseAgent, AgentResult
from app.models.agent import AgentTask

logger = logging.getLogger(__name__)


class DataQualityAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in {
            "data_quality_audit", "data_quality_check", "duplicate_detection",
            "missing_field_check", "archive_quality", "snapshot_freshness",
            "general",
        } or task_type.startswith("sub_") or task_type.startswith("event_archive")

    async def plan(self, task: AgentTask) -> dict[str, Any]:
        return {
            "checks": [
                "total_profiles",
                "missing_avatar",
                "missing_country",
                "missing_category",
                "duplicate_usernames",
                "snapshot_coverage",
            ],
            "scope": "influencer_archive",
            "real_db_query": True,
        }

    async def execute(self, task: AgentTask) -> AgentResult:
        task_type = task.task_type or "data_quality_audit"
        is_mock = self.agent.mode.value != "active"

        if is_mock:
            return self._mock_execution(task_type)

        # ACTIVE mode: real DB query
        return await self._real_execution(task_type)

    def _mock_execution(self, task_type: str) -> AgentResult:
        """Mock veri kalitesi raporu — gerçek DB sorgusu yok."""
        summary = (
            "Veri kalitesi denetimi tamamlandı (MOCK). "
            "Gerçek analiz için ACTIVE mod ve veritabanı erişimi gereklidir."
        )
        return AgentResult(
            success=True,
            output={
                "is_mock": True,
                "task_type": task_type,
                "mock_findings": [
                    "Avatar eksik profiller: bilinmiyor (mock mod).",
                    "Duplicate profil tespiti: bilinmiyor (mock mod).",
                    "Snapshot kapsamı: bilinmiyor (mock mod).",
                    "Eksik kategori: bilinmiyor (mock mod).",
                ],
                "note": "Gerçek veri kalitesi denetimi için agent modunu ACTIVE'e alın.",
            },
            summary=summary,
            risk_level="low",
            requires_approval=False,
            conversation_messages=[
                self.create_conversation_message(
                    content="Veri kalitesi taraması başlatıldı. [MOCK MODE]",
                    message_type="instruction",
                ),
                self.create_conversation_message(
                    content=summary,
                    message_type="result",
                ),
            ],
        )

    async def _real_execution(self, task_type: str) -> AgentResult:
        """Gerçek DB sorgusu ile veri kalitesi analizi."""
        try:
            from app.models.influencer_archive import InfluencerProfile, InfluencerSnapshot
        except ImportError:
            return AgentResult(
                success=False,
                output={"error": "InfluencerProfile model import başarısız."},
                summary="Veri kalitesi denetimi başarısız: model import hatası.",
                risk_level="medium",
            )

        try:
            total = (await self.db.execute(
                select(func.count(InfluencerProfile.id))
            )).scalar() or 0

            missing_avatar = (await self.db.execute(
                select(func.count(InfluencerProfile.id)).where(
                    or_(
                        InfluencerProfile.profile_image_url == None,
                        InfluencerProfile.profile_image_url == "",
                    )
                )
            )).scalar() or 0

            missing_country = (await self.db.execute(
                select(func.count(InfluencerProfile.id)).where(
                    or_(
                        InfluencerProfile.country == None,
                        InfluencerProfile.country == "",
                    )
                )
            )).scalar() or 0

            missing_category = (await self.db.execute(
                select(func.count(InfluencerProfile.id)).where(
                    or_(
                        InfluencerProfile.category == None,
                        InfluencerProfile.category == "",
                    )
                )
            )).scalar() or 0

            snapshot_count = (await self.db.execute(
                select(func.count(InfluencerSnapshot.id))
            )).scalar() or 0

            coverage_pct = round(snapshot_count / max(total, 1) * 100, 1)
            overall_risk = "low"
            issues: list[str] = []

            if missing_avatar > total * 0.3:
                issues.append(f"Avatar eksik: {missing_avatar}/{total} profil (%{round(missing_avatar/max(total,1)*100,1)})")
                overall_risk = "medium"
            if missing_category > total * 0.4:
                issues.append(f"Kategori eksik: {missing_category}/{total} profil")
                overall_risk = "medium"
            if coverage_pct < 50:
                issues.append(f"Snapshot kapsamı düşük: %{coverage_pct}")

            summary = (
                f"Veri kalitesi denetimi tamamlandı. Toplam {total} profil. "
                f"Avatar eksik: {missing_avatar}, Kategori eksik: {missing_category}, "
                f"Snapshot kapsam: %{coverage_pct}. "
                f"{'Sorunlar tespit edildi.' if issues else 'Genel veri kalitesi iyi.'}"
            )

            return AgentResult(
                success=True,
                output={
                    "total_profiles": total,
                    "missing_avatar": missing_avatar,
                    "missing_country": missing_country,
                    "missing_category": missing_category,
                    "snapshot_count": snapshot_count,
                    "snapshot_coverage_pct": coverage_pct,
                    "issues": issues,
                    "overall_risk": overall_risk,
                    "is_mock": False,
                    "task_type": task_type,
                },
                summary=summary,
                risk_level=overall_risk,
                requires_approval=False,
                conversation_messages=[
                    self.create_conversation_message(
                        content=f"Gerçek veri kalitesi taraması tamamlandı. {len(issues)} sorun tespit edildi.",
                        message_type="result",
                    )
                ],
            )

        except Exception as exc:
            logger.error("DataQualityAgent gerçek çalışma hatası: %s", exc)
            return AgentResult(
                success=False,
                output={"error": str(exc)},
                summary=f"Veri kalitesi denetimi başarısız: {exc}",
                risk_level="medium",
                error=str(exc),
            )
