"""Legal / Compliance Agent — Uyumluluk kontrolü ve zorunlu onay kuralları."""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult

# Approval zorunlu aksiyonlar
APPROVAL_REQUIRED_ACTIONS = [
    "e-posta gönderme (toplu veya otomatik)",
    "DM / mesaj gönderme (platform üzerinden)",
    "reklam yayına alma",
    "bütçe harcama veya ödeme tetikleme",
    "müşteri hesabına müdahale (plan, kredi, silme)",
    "production deploy",
    "veri silme (GDPR/KVKK kapsamında)",
    "üçüncü taraf API ile kullanıcı adına işlem",
]

SAFE_ACTIONS = [
    "veri okuma / raporlama",
    "analiz üretme (sadece görüntüleme)",
    "mock / test ortamı çalıştırma",
    "admin dashboard görüntüleme",
    "öneride bulunma (approval gerektiren işlem başlatmama)",
]


class LegalAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("compliance_review", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {
            "steps": ["action_classification", "gdpr_kvkk_check", "platform_rules_check", "approval_mapping"],
            "estimated_latency_ms": 190,
        }

    async def execute(self, task) -> AgentResult:
        kw = self._keywords(task)

        # Otomatik aksiyon tespiti
        detected_risky_actions = []
        compliance_status = "approved"

        triggers = {
            "e-posta":    "E-posta gönderme tespit edildi — insan onayı zorunlu.",
            "email":      "E-posta gönderme tespit edildi — insan onayı zorunlu.",
            "dm":         "DM gönderimi tespit edildi — platform kuralları ihlali riski.",
            "reklam":     "Reklam yayını tespit edildi — hukuki onay zorunlu.",
            "bütçe":      "Bütçe harcama tespit edildi — finans onayı zorunlu.",
            "budget":     "Bütçe harcama tespit edildi — finans onayı zorunlu.",
            "sil":        "Veri silme tespit edildi — KVKK kapsamında onay gerekli.",
            "delete":     "Veri silme tespit edildi — KVKK kapsamında onay gerekli.",
            "deploy":     "Production deploy tespit edildi — ops + legal onayı zorunlu.",
            "production": "Production ortamı değişikliği — yüksek risk.",
        }

        for trigger, message in triggers.items():
            if trigger in kw:
                detected_risky_actions.append(message)
                compliance_status = "review_needed"

        # Mock run / test → her zaman güvenli
        if any(w in kw for w in ("mock", "test", "simül", "preview", "sandbox")):
            compliance_status = "approved"
            detected_risky_actions = []

        risk_level = "high" if detected_risky_actions else "low"

        gdpr_notes = [
            "Kullanıcı verisi üçüncü taraf AI'a göndermeden önce açık rıza alınmalı.",
            "Influencer profil verisi kamuya açık kaynaklardan toplanıyor — telif riski düşük.",
            "KVKK kapsamında veri işleme kaydı yapılmalı (aktif kullanıcı sayısı 50+ ise).",
        ]

        platform_notes = [
            "YouTube ToS: Veri API limitleri içinde kullanım uygun.",
            "Instagram/TikTok: Apify üzerinden scraping — platform ToS gri alan.",
            "Otomatik DM/e-posta gönderimi platform kurallarını ihlal edebilir.",
        ]

        summary = (
            f"Uyumluluk kontrolü tamamlandı. Durum: {compliance_status.upper()}. "
            + (f"{len(detected_risky_actions)} riskli aksiyon tespit edildi."
               if detected_risky_actions
               else "Mevcut aksiyonlar güvenli sınırlar içinde.")
        )

        if compliance_status == "approved":
            decision_msg = "Dış platformlarda otomatik işlem bulunmuyor. Mock/test ortamı güvenli."
        else:
            decision_msg = (
                f"⛔ {len(detected_risky_actions)} aksiyonda insan onayı zorunlu: "
                f"{'; '.join(detected_risky_actions[:2])}"
            )

        msgs = [
            self.create_conversation_message("Uyumluluk ve hukuki risk analizi başlatıldı…", "instruction"),
            self.create_conversation_message(summary, "result"),
            self.create_conversation_message(decision_msg, "decision"),
        ]

        return AgentResult(
            success=True,
            output={
                "compliance_status":        compliance_status,
                "detected_risky_actions":   detected_risky_actions,
                "approval_required_actions": APPROVAL_REQUIRED_ACTIONS,
                "safe_actions":             SAFE_ACTIONS,
                "gdpr_kvkk_notes":          gdpr_notes,
                "platform_notes":           platform_notes,
            },
            summary=summary,
            risk_level=risk_level,
            requires_approval=self._needs_approval(risk_level),
            conversation_messages=msgs,
        )
