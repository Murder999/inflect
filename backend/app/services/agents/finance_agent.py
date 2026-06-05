"""Finance / Pricing Agent — API maliyeti, kredi sistemi ve fiyatlandırma önerileri."""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult


class FinanceAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("pricing_review", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {
            "steps": ["api_cost_analysis", "credit_system_review", "pricing_optimization", "provider_cost_comparison"],
            "estimated_latency_ms": 260,
        }

    async def execute(self, task) -> AgentResult:
        kw = self._keywords(task)

        # API maliyet analizi (tahmin)
        api_costs = {
            "mock_provider":  {"cost_per_task": 0.0,    "monthly_estimate_usd": 0.0,    "note": "Şu an kullanılan"},
            "claude_haiku":   {"cost_per_task": 0.0008, "monthly_estimate_usd": 4.0,    "note": "Önerilen: hız + maliyet optimum"},
            "claude_sonnet":  {"cost_per_task": 0.006,  "monthly_estimate_usd": 30.0,   "note": "Kaliteli analiz için"},
            "gpt_4o_mini":    {"cost_per_task": 0.0003, "monthly_estimate_usd": 1.5,    "note": "En ucuz OpenAI seçeneği"},
            "gpt_4o":         {"cost_per_task": 0.005,  "monthly_estimate_usd": 25.0,   "note": "Premium görevler için"},
            "deepseek_v3":    {"cost_per_task": 0.0002, "monthly_estimate_usd": 1.0,    "note": "Bulk işlemler için ideal"},
        }

        credit_analysis = {
            "current_plans": {
                "free":     {"credits": 5,    "price_usd": 0,   "margin_pct": "N/A"},
                "starter":  {"credits": 50,   "price_usd": 29,  "margin_pct": "~85%"},
                "pro":      {"credits": 200,  "price_usd": 79,  "margin_pct": "~88%"},
                "business": {"credits": 1000, "price_usd": 199, "margin_pct": "~82%"},
            },
            "avg_cost_per_analysis_usd": 0.004,
            "avg_cost_per_agent_task_usd": 0.001,
        }

        recommendations = [
            "Claude Haiku — 7 skor analizi için önerilen. En iyi hız/kalite/maliyet dengesi.",
            "DeepSeek-V3 — Toplu influencer batch analizi için kullan. %75 daha ucuz.",
            "GPT-4o Mini — Basit agent görevleri (QA checklist, Ops health) için yeterli.",
            "Claude Sonnet — CEO Orchestrator ve Legal Agent gibi kritik kararlar için.",
            "Mevcut kredi sistemi doğru: 1 analiz = 1 kredi. Agent görevleri ek kredi düşmemeli.",
        ]

        risks = []
        if any(w in kw for w in ("maliyet", "cost", "budget", "api")):
            risks.append("Tüm agent görevlerinde Claude Sonnet kullanılırsa aylık maliyet 10x artabilir.")
        if any(w in kw for w in ("fiyat", "pricing", "plan")):
            risks.append("Business planı müşteri başı AI görev maliyeti kontrol edilmeli.")

        risk_level = "medium" if risks else "low"

        summary = (
            f"Finansal analiz tamamlandı. "
            f"Mevcut mock provider maliyetsiz çalışıyor. "
            f"Gerçek API entegrasyonu sonrası tahmini aylık maliyet: $1–30 (seçilen provider'a göre). "
            f"Mevcut kredi sistemi sürdürülebilir."
        )

        msgs = [
            self.create_conversation_message("API maliyet ve kredi sistemi analiz ediliyor…", "instruction"),
            self.create_conversation_message(summary, "result"),
            self.create_conversation_message(
                "Öneri: DeepSeek bulk analiz + Claude Haiku standart görevler. "
                "Claude Sonnet yalnızca CEO + Legal için. Aylık maliyet <$30 tutulabilir.",
                "decision",
            ),
        ]

        return AgentResult(
            success=True,
            output={
                "api_costs":         api_costs,
                "credit_analysis":   credit_analysis,
                "recommendations":   recommendations,
                "risks":             risks,
                "monthly_estimate":  {
                    "current_mock": "$0",
                    "with_haiku":   "~$4-8/ay",
                    "with_sonnet":  "~$25-50/ay",
                    "recommended":  "~$5-15/ay (mixed strategy)",
                },
            },
            summary=summary,
            risk_level=risk_level,
            requires_approval=False,
            conversation_messages=msgs,
        )
