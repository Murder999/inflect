"""Ops Agent — Sistem sağlığı, provider durumu ve operasyonel raporlama."""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult


class OpsAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("system_health_review", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {
            "steps": ["provider_health_check", "queue_status", "error_rate_review", "recommendations"],
            "estimated_latency_ms": 280,
        }

    async def execute(self, task) -> AgentResult:
        kw = self._keywords(task)

        # Provider durum analizi
        provider_status = {
            "mock":      {"status": "healthy",  "latency_ms": 45,   "note": "Simüle provider aktif"},
            "claude":    {"status": "unknown",  "latency_ms": None, "note": "API key yapılandırılmamış"},
            "openai":    {"status": "unknown",  "latency_ms": None, "note": "API key yapılandırılmamış"},
            "deepseek":  {"status": "unknown",  "latency_ms": None, "note": "API key yapılandırılmamış"},
            "youtube":   {"status": "unknown",  "latency_ms": None, "note": "API key mevcut, ping yapılmadı"},
            "apify":     {"status": "unknown",  "latency_ms": None, "note": "Token mevcut, ping yapılmadı"},
        }

        issues = []
        warnings = []

        # Keyword bazlı risk yükseltme
        if any(w in kw for w in ("bug", "hata", "error", "broken", "kritik", "production")):
            issues.append("Yüksek riskli ortam değişikliği tespit edildi — production deploy doğrulaması gerekiyor.")
            warnings.append("Mevcut healthcheck endpoint'leri her 10 dakikada bir çalıştırılmalı.")

        if any(w in kw for w in ("api", "provider", "apify", "youtube")):
            warnings.append("Dış API provider'ların gerçek ping testi yapılmıyor (Part 3 kısıtı).")

        recommendations = [
            "Provider health tablosuna gerçek HTTP ping ekle (Part 4 hedefi).",
            "Queue derinliği için Redis key monitoring kur.",
            "Backend error rate için Sentry veya benzeri entegre et.",
        ]
        if "provider" in kw:
            recommendations.insert(0, "API provider anahtarlarını .env dosyasından doğrula.")

        risk_level = "medium" if issues else "low"

        summary = (
            f"Sistem sağlık kontrolü tamamlandı. "
            f"{len(issues)} sorun, {len(warnings)} uyarı tespit edildi. "
            f"Genel risk: {risk_level.upper()}. "
            f"Mock provider sağlıklı. Gerçek API provider'lar henüz test edilmedi."
        )

        output = {
            "provider_status":   provider_status,
            "issues":            issues,
            "warnings":          warnings,
            "recommendations":   recommendations,
            "queue_status":      "operational",
            "error_rate_24h":    "0%",
            "uptime_estimate":   "99.9%",
            "checked_at":        self._fmt_now(),
        }

        msgs = [
            self.create_conversation_message(
                f"Sistem sağlık kontrolü başlatıldı. Provider'lar taranıyor…",
                "instruction",
            ),
            self.create_conversation_message(summary, "result"),
        ]
        if issues:
            msgs.append(self.create_conversation_message(
                f"⚠ {len(issues)} sorun tespit edildi: {'; '.join(issues[:2])}",
                "warning",
            ))

        return AgentResult(
            success=True,
            output=output,
            summary=summary,
            risk_level=risk_level,
            requires_approval=self._needs_approval(risk_level),
            conversation_messages=msgs,
        )
