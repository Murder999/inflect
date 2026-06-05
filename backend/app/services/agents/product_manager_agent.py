"""Product Manager Agent — Roadmap, önceliklendirme ve UX iyileştirme."""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult


class ProductManagerAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("product_roadmap_review", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {
            "steps": ["feature_audit", "priority_scoring", "ux_review", "roadmap_update"],
            "estimated_latency_ms": 350,
        }

    async def execute(self, task) -> AgentResult:
        kw = self._keywords(task)

        mvp_features = [
            "Agent Conversations timeline — tamamlandı ✓",
            "Approval Queue with approve/reject — tamamlandı ✓",
            "Task List with status filters — tamamlandı ✓",
            "Provider Health dashboard — tamamlandı ✓",
            "Run Logs with latency/token metrics — tamamlandı ✓",
        ]

        premium_features = [
            "Gerçek Claude/OpenAI provider entegrasyonu (Part 4)",
            "Agent bellek görselleştirmesi — agent'ın öğrendiklerini göster",
            "Kullanıcı bazlı agent erişim yetkilendirmesi",
            "Agent performans dashboard — cost/token/latency trend",
            "Webhook ile dış sistem entegrasyonu",
        ]

        later_features = [
            "Mobil admin interface",
            "Multi-tenant agent izolasyonu",
            "Agent marketplace — üçüncü taraf agent satın alma",
            "Agent versiyonlama ve rollback",
        ]

        ux_issues = []
        if any(w in kw for w in ("ux", "kullanıcı", "arayüz", "ui")):
            ux_issues.append("Conversations sayfasında mesaj arama/filtreleme eksik.")
            ux_issues.append("Task oluşturma formu daha kısa olabilir — tek modal yeterli.")

        ux_issues += [
            "Approval kuyruğu boş olduğunda motivasyonel boş durum mesajı eklenebilir.",
            "Run Logs'ta agent filtresi eksik — çok sayıda agent olunca karışıklık yaratabilir.",
        ]

        risks = ["Approval UI olmadan yüksek riskli görev onaylanamaz (Part 3 kısıtı)."]
        if any(w in kw for w in ("deployment", "deploy", "production")):
            risks.append("Production deployment için CI/CD pipeline hazır değil.")

        risk_level = "medium" if risks else "low"

        summary = (
            f"Ürün roadmap incelemesi tamamlandı. "
            f"MVP özellikleri hazır. "
            f"{len(premium_features)} premium özellik sırada. "
            f"{len(ux_issues)} UX iyileştirme fırsatı belirlendi."
        )

        output = {
            "mvp_features":     mvp_features,
            "premium_features": premium_features,
            "later_features":   later_features,
            "ux_issues":        ux_issues,
            "risks":            risks,
            "next_sprint": [
                "Part 4: Gerçek API provider entegrasyonu",
                "Agent memory görselleştirmesi",
                "Orchestrate form'a task_type açıklamaları ekle",
            ],
        }

        msgs = [
            self.create_conversation_message(
                f"Ürün roadmap incelemesi başlatıldı. Mevcut özellikler ve boşluklar değerlendiriliyor…",
                "instruction",
            ),
            self.create_conversation_message(summary, "result"),
            self.create_conversation_message(
                f"Öneri: Sonraki sprintte Part 4 (gerçek API) ve agent memory görselleştirmesine odaklanılmalı.",
                "decision",
            ),
        ]

        return AgentResult(
            success=True,
            output=output,
            summary=summary,
            risk_level=risk_level,
            requires_approval=False,
            conversation_messages=msgs,
        )
