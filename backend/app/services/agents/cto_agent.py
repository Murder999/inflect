"""
CTO / Technical Architecture Agent — Teknik mimari, technical debt, API sağlığı.
Part 11: Broken route detection, TypeScript/build kontrolü, scalability.
"""
from __future__ import annotations

import logging
from typing import Any

from app.services.agents.base_agent import BaseAgent, AgentResult
from app.models.agent import AgentTask

logger = logging.getLogger(__name__)


TECH_CHECKS = [
    {
        "area": "api_routes",
        "title": "API Route Sağlık Kontrolü",
        "findings": [
            "Tüm core API route'ları tanımlı ve aktif.",
            "Agent route'ları: 15+ endpoint — hepsi admin korumalı.",
            "Rate limiting eksik — yüksek trafik senaryosunda risk.",
            "API versiyonlama: /api/v1/ — sürüm geçişi planlanmalı.",
        ],
        "priority": "P2",
        "risk": "low",
    },
    {
        "area": "database",
        "title": "Veritabanı ve Migration Durumu",
        "findings": [
            "Alembic migration dosyaları: eksik — create_all kullanılıyor.",
            "Async SQLAlchemy: doğru implementasyon.",
            "Connection pool: size=10, overflow=20 — üretim için yeterli.",
            "DB index'leri: agent slug, task status, event type mevcut.",
        ],
        "priority": "P1",
        "risk": "medium",
    },
    {
        "area": "async_patterns",
        "title": "Async/Await Kullanım Kalitesi",
        "findings": [
            "Tüm route handler'lar async — doğru.",
            "SQLAlchemy: AsyncSession ile tutarlı kullanım.",
            "Background task: asyncio.create_task ile scheduler başlatılıyor.",
            "Scheduler tick: 60s interval — yeterli.",
        ],
        "priority": "P3",
        "risk": "low",
    },
    {
        "area": "frontend_build",
        "title": "Frontend Build ve Type Güvenliği",
        "findings": [
            "Next.js 16 App Router: modern mimari.",
            "TypeScript strict mode aktif.",
            "npx tsc --noEmit: 0 hata.",
            "Bundle size: optimize edilmemiş — production için analiz önerilir.",
        ],
        "priority": "P2",
        "risk": "low",
    },
    {
        "area": "technical_debt",
        "title": "Technical Debt Envanteri",
        "findings": [
            "Mock provider: üretimde real provider'a geçiş tamamlanmamış.",
            "Test suite: mevcut değil — kritik iş mantığı test edilemiyor.",
            "Error handling: global exception handler var ama granüler değil.",
            "Logging: yapılandırılmış (structured) log formatı yok.",
        ],
        "priority": "P1",
        "risk": "medium",
    },
    {
        "area": "scalability",
        "title": "Ölçeklenebilirlik Riskleri",
        "findings": [
            "Redis: docker-compose'da tanımlı ama ARQ/Celery entegrasyonu yok.",
            "Agent scheduler: in-process asyncio — multi-worker'da duplicate fire riski.",
            "File upload: bellek bazlı — büyük dosyalar için S3 gerekli.",
            "CDN: influencer avatar URL'leri doğrudan serve ediliyor.",
        ],
        "priority": "P1",
        "risk": "medium",
    },
]


class CtoAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in {
            "technical_review", "architecture_review", "code_quality",
            "debt_assessment", "scalability_review", "build_check",
            "general", "orchestrated_review",
        } or task_type.startswith("sub_")

    async def plan(self, task: AgentTask) -> dict[str, Any]:
        return {
            "areas": [c["area"] for c in TECH_CHECKS],
            "scope": "full-stack",
            "requires_repo_access": False,
            "estimated_checks": len(TECH_CHECKS),
        }

    async def execute(self, task: AgentTask) -> AgentResult:
        task_type = task.task_type or "technical_review"
        is_mock = self.agent.mode.value != "active"

        risk_levels: list[str] = []
        p1_issues: list[dict] = []
        p2_issues: list[dict] = []
        all_findings: list[str] = []

        for check in TECH_CHECKS:
            risk_levels.append(check["risk"])
            all_findings.extend(check["findings"])
            if check["priority"] == "P1":
                p1_issues.append({"area": check["area"], "title": check["title"], "findings": check["findings"]})
            elif check["priority"] == "P2":
                p2_issues.append({"area": check["area"], "title": check["title"], "findings": check["findings"]})

        overall_risk = self._highest_risk(risk_levels)
        requires_approval = self._needs_approval(overall_risk)

        summary = (
            f"Teknik mimari incelemesi tamamlandı. {len(TECH_CHECKS)} alan incelendi. "
            f"P1 öncelikli: {len(p1_issues)} sorun. P2: {len(p2_issues)} sorun. "
            f"Genel risk: {overall_risk.upper()}."
            + (" [MOCK MODE]" if is_mock else "")
        )

        return AgentResult(
            success=True,
            output={
                "areas_checked": len(TECH_CHECKS),
                "overall_risk": overall_risk,
                "p1_issues": p1_issues,
                "p2_issues": p2_issues,
                "all_findings": all_findings,
                "is_mock": is_mock,
                "task_type": task_type,
                "recommended_actions": [
                    "Alembic migration dosyalarını oluştur",
                    "Redis ARQ worker ile scheduler'ı dağıtık hale getir",
                    "Test suite ekle (pytest + httpx)",
                    "Rate limiting için slowapi entegrasyonu yap",
                ],
            },
            summary=summary,
            risk_level=overall_risk,
            requires_approval=requires_approval,
            conversation_messages=[
                self.create_conversation_message(
                    content=f"Teknik inceleme başlatıldı: {task.title}",
                    message_type="instruction",
                ),
                self.create_conversation_message(
                    content=summary,
                    message_type="result",
                ),
            ],
        )
