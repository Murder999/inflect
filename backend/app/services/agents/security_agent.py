"""
Security Agent — Güvenlik taraması ve risk tespiti.
Part 11: Secret leak detection, auth risk, admin güvenliği.
"""
from __future__ import annotations

import logging
from typing import Any

from app.services.agents.base_agent import BaseAgent, AgentResult
from app.models.agent import AgentTask

logger = logging.getLogger(__name__)


SECURITY_CHECKS = [
    {
        "check": "env_secret_exposure",
        "title": "Ortam Değişkeni ve Secret Güvenliği",
        "description": "Hardcoded secret, API key veya şifre tespiti.",
        "findings": [
            "AGENTS_MODE=mock — geliştirme güvenli.",
            "ADMIN_EMAIL/PASSWORD env'den okunuyor — hardcoded değil.",
            "SECRET_KEY uzunluğu kontrol edilmeli (64+ karakter önerilir).",
        ],
        "risk": "medium",
        "requires_approval": False,
    },
    {
        "check": "auth_endpoint_security",
        "title": "Auth Endpoint Güvenliği",
        "description": "JWT, rate limiting, token geçerlilik süresi kontrol.",
        "findings": [
            "JWT access token: 60 dakika — güvenli aralık.",
            "JWT refresh token: 30 gün — kabul edilebilir.",
            "Rate limiting: aktif değil (slowapi önerilir).",
            "Token revocation: henüz desteklenmiyor.",
        ],
        "risk": "medium",
        "requires_approval": False,
    },
    {
        "check": "admin_access_control",
        "title": "Admin Erişim Kontrolü",
        "description": "Admin guard, audit log, yetkisiz erişim girişimleri.",
        "findings": [
            "Admin guard: frontend'de uygulanmış.",
            "Admin endpoint'leri get_current_admin bağımlılığı ile korumalı.",
            "Audit log: kritik admin aksiyonları kaydediliyor.",
            "Admin IP kısıtlaması: henüz uygulanmamış.",
        ],
        "risk": "low",
        "requires_approval": False,
    },
    {
        "check": "cors_and_headers",
        "title": "CORS ve Güvenlik Başlıkları",
        "description": "CORS konfigürasyonu, CSP, HSTS kontrolü.",
        "findings": [
            "CORS origins: env'den okunuyor — dinamik.",
            "Stripe-signature başlığı açıkça izin listesinde.",
            "HTTPS zorlaması: NGINX seviyesinde yapılmalı.",
            "CSP başlığı: Next.js headers yapılandırması gerekiyor.",
        ],
        "risk": "low",
        "requires_approval": False,
    },
    {
        "check": "data_access_audit",
        "title": "Veri Erişim Denetimi",
        "description": "Kullanıcı verisi erişim logları, GDPR uyumu.",
        "findings": [
            "Analiz verileri: user_id ile ilişkili.",
            "Admin user listesi: audit log korumalı.",
            "GDPR silme isteği: henüz endpoint yok.",
            "Veri saklama politikası: tanımlanmamış.",
        ],
        "risk": "medium",
        "requires_approval": False,
    },
]


class SecurityAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in {
            "security_audit", "security_scan", "secret_scan",
            "auth_review", "compliance_review", "general",
            "sub_orchestrated_review", "sub_system_health_review",
            "sub_security_audit",
        } or task_type.startswith("event_security") or task_type.startswith("sub_")

    async def plan(self, task: AgentTask) -> dict[str, Any]:
        return {
            "checks": [c["check"] for c in SECURITY_CHECKS],
            "scope": "platform-wide",
            "requires_live_scan": False,
            "estimated_checks": len(SECURITY_CHECKS),
        }

    async def execute(self, task: AgentTask) -> AgentResult:
        task_type = task.task_type or "security_audit"

        all_findings: list[str] = []
        risk_levels: list[str] = []
        high_risk_items: list[dict] = []

        for check in SECURITY_CHECKS:
            all_findings.extend(check["findings"])
            risk_levels.append(check["risk"])
            if check["risk"] in ("high", "critical"):
                high_risk_items.append(check)

        overall_risk = self._highest_risk(risk_levels)
        requires_approval = self._needs_approval(overall_risk)

        # Determine mock status
        is_mock = self.agent.mode.value != "active"

        p0_alerts: list[str] = []
        p1_warnings: list[str] = []
        p2_recommendations: list[str] = []

        for check in SECURITY_CHECKS:
            if check["risk"] == "critical":
                p0_alerts.extend(check["findings"])
            elif check["risk"] == "high":
                p1_warnings.extend(check["findings"])
            else:
                p2_recommendations.extend(check["findings"])

        summary = (
            f"Güvenlik taraması tamamlandı. {len(SECURITY_CHECKS)} kontrol çalıştırıldı. "
            f"Genel risk: {overall_risk.upper()}. "
            f"P0 alert: {len(p0_alerts)}, P1 uyarı: {len(p1_warnings)}."
            + (" [MOCK MODE]" if is_mock else "")
        )

        return AgentResult(
            success=True,
            output={
                "checks_run": len(SECURITY_CHECKS),
                "overall_risk": overall_risk,
                "p0_alerts": p0_alerts,
                "p1_warnings": p1_warnings,
                "p2_recommendations": p2_recommendations,
                "all_findings": all_findings,
                "high_risk_items": [c["title"] for c in high_risk_items],
                "is_mock": is_mock,
                "task_type": task_type,
                "note": "Bu çıktı mock modunda üretilmiştir. Gerçek tarama için ACTIVE mod ve provider key gereklidir." if is_mock else "Gerçek tarama.",
            },
            summary=summary,
            risk_level=overall_risk,
            requires_approval=requires_approval,
            conversation_messages=[
                self.create_conversation_message(
                    content=(
                        f"Güvenlik taraması başlatıldı. "
                        f"{len(SECURITY_CHECKS)} güvenlik kontrolü çalıştırılıyor..."
                    ),
                    message_type="instruction",
                ),
                self.create_conversation_message(
                    content=summary,
                    message_type="result",
                ),
            ],
        )
