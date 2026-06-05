"""Dev Agent — Kod değişiklik planlaması, risk analizi, dosya önerisi. (Part 3: öneri üretir, gerçek değişiklik yapmaz)"""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult


class DevAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("code_change_plan", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {
            "steps": ["impact_analysis", "file_mapping", "risk_classification", "implementation_steps"],
            "estimated_latency_ms": 310,
            "note": "Part 3: Yalnızca plan üretir. Gerçek dosya değişikliği yapmaz.",
        }

    async def execute(self, task) -> AgentResult:
        kw = self._keywords(task)

        # Değişiklik etki analizi
        files_to_change = []
        risks = []
        implementation_steps = []

        if any(w in kw for w in ("agent", "orchestrat")):
            files_to_change += [
                {"path": "backend/app/services/agents/", "reason": "Agent logic güncellemesi", "risk": "medium"},
                {"path": "backend/app/api/v1/routes/agents.py", "reason": "Yeni endpoint eklenebilir", "risk": "low"},
                {"path": "frontend/lib/agents-api.ts", "reason": "TypeScript tipler güncellenmeli", "risk": "low"},
            ]
        if any(w in kw for w in ("api", "provider", "claude", "openai")):
            files_to_change += [
                {"path": "backend/app/services/agents/agent_factory.py", "reason": "Gerçek provider eklentisi", "risk": "high"},
                {"path": "backend/app/services/agent_mock_provider.py", "reason": "Fallback provider güncellemesi", "risk": "low"},
                {"path": "backend/.env", "reason": "API key eklenmesi gerekiyor", "risk": "medium"},
            ]
        if any(w in kw for w in ("database", "model", "tablo", "migration")):
            files_to_change += [
                {"path": "backend/app/models/agent.py", "reason": "Model değişikliği", "risk": "high"},
                {"path": "backend/app/models/__init__.py", "reason": "Import güncellemesi", "risk": "low"},
            ]
            risks.append("Veritabanı schema değişikliği — mevcut veriler etkilenebilir. Migration gerekebilir.")

        if not files_to_change:
            files_to_change = [
                {"path": "backend/app/", "reason": "Genel backend değişikliği", "risk": "medium"},
                {"path": "frontend/app/(app)/", "reason": "Genel frontend değişikliği", "risk": "low"},
            ]

        # Risk analizi
        high_risk_files = [f for f in files_to_change if f["risk"] == "high"]
        if high_risk_files:
            risks.append(f"{len(high_risk_files)} yüksek riskli dosya değişikliği planlandı.")
        if any(w in kw for w in ("production", "deploy", "canlı")):
            risks.append("Production değişikliği — staging'de test zorunlu.")
            risks.append("Rollback planı hazır olmalı.")

        # Uygulama adımları
        implementation_steps = [
            "1. Feature branch oluştur (git checkout -b feature/agent-update)",
            "2. Değişiklikleri staging ortamında uygula",
            "3. QA Agent checklist'ini tamamla",
            "4. Legal Agent onayını al (gerekliyse)",
            "5. Admin review sonrası production'a merge",
        ]

        risk_level = "high" if len(high_risk_files) >= 2 or any(w in kw for w in ("production", "schema")) else "medium"

        summary = (
            f"Kod değişiklik planı hazırlandı. "
            f"{len(files_to_change)} dosya etkilenecek, "
            f"{len(high_risk_files)} yüksek riskli. "
            f"⚠ Bu ajan GERÇEK değişiklik yapmaz — yalnızca plan üretir."
        )

        msgs = [
            self.create_conversation_message("Kod etki analizi ve değişiklik planı hazırlanıyor…", "instruction"),
            self.create_conversation_message(summary, "result"),
        ]
        if risks:
            msgs.append(self.create_conversation_message(
                "Risk uyarısı: " + " | ".join(risks[:2]), "warning"
            ))

        return AgentResult(
            success=True,
            output={
                "files_to_change":       files_to_change,
                "risks":                 risks,
                "implementation_steps":  implementation_steps,
                "time_estimate":         "2-4 saat (bağımsız değişiklik)",
                "requires_review":       True,
                "note":                  "Part 3: Yalnızca plan. Gerçek dosya değişikliği yok.",
            },
            summary=summary,
            risk_level=risk_level,
            requires_approval=self._needs_approval(risk_level),
            conversation_messages=msgs,
        )
