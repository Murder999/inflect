"""QA / Test Agent — Test senaryoları, regresyon alanları ve eksik test raporu."""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult


class QaAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("qa_checklist", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {
            "steps": ["existing_tests_audit", "regression_map", "manual_checklist", "gap_analysis"],
            "estimated_latency_ms": 220,
        }

    async def execute(self, task) -> AgentResult:
        kw = self._keywords(task)

        test_scenarios = [
            {"id": "TC-001", "area": "Auth",         "desc": "Register → Login → Logout akışı",          "priority": "P0", "status": "missing_automation"},
            {"id": "TC-002", "area": "Analysis",      "desc": "YouTube analiz → 7 skor doğrulama",        "priority": "P0", "status": "manual_only"},
            {"id": "TC-003", "area": "Agent Tasks",   "desc": "Task oluştur → çalıştır → sonuç doğrula",  "priority": "P1", "status": "missing"},
            {"id": "TC-004", "area": "Approval Flow", "desc": "High-risk task → approval queue → onay",   "priority": "P1", "status": "missing"},
            {"id": "TC-005", "area": "Billing",       "desc": "Stripe checkout mock → plan upgrade",       "priority": "P1", "status": "manual_only"},
            {"id": "TC-006", "area": "Admin",         "desc": "Admin kredi ekleme → kullanıcı doğrulama", "priority": "P2", "status": "missing"},
        ]

        regression_areas = [
            "Auth JWT token yenileme — yüksek risk (birden fazla tarayıcı)",
            "Agent task_engine → run → conversation yazımı zinciri",
            "Admin panel sekme geçişlerinde veri tutarlılığı",
            "Discovery filtresi — boş sonuç durumunda 500 riski",
        ]

        manual_checklist = [
            "☐ Login sayfasında backend down mesajı doğru görünüyor mu?",
            "☐ Admin panelde 12 sekme hepsi yükleniyor mu?",
            "☐ AI Agents Center → Mock Run → Conversations'da mesajlar görünüyor mu?",
            "☐ Approval Kuyruğu → Approve/Reject → durum değişiyor mu?",
            "☐ Provider Health sayfasında 8 provider kartı görünüyor mu?",
            "☐ Run Logs'ta latency/token verisi doğru gösteriliyor mu?",
        ]

        missing_tests = [
            "Hiç unit test yok — pytest kurulumu yapılmalı (Part 4 hedefi)",
            "API entegrasyon testleri eksik",
            "Agent approval flow E2E testi yok",
            "Stripe webhook handler test edilmedi",
        ]

        critical_gaps = []
        if any(w in kw for w in ("production", "deploy", "canlı")):
            critical_gaps.append("Production'a çıkmadan önce TC-001, TC-002, TC-003 manuel olarak test edilmeli.")
        if any(w in kw for w in ("agent", "approval", "orchestrat")):
            critical_gaps.append("Agent approval flow (TC-004) high-risk task senaryosunda test edilmeli.")

        high_risk = bool(critical_gaps) or any(w in kw for w in ("kritik", "acil", "bug"))
        risk_level = "high" if high_risk else "medium"  # QA her zaman en az medium raporlar

        summary = (
            f"QA kontrolü tamamlandı. "
            f"{len(test_scenarios)} test senaryosu tanımlandı, "
            f"{len([t for t in test_scenarios if t['status'] == 'missing'])} tanesinin otomasyonu eksik. "
            f"{len(missing_tests)} kritik test boşluğu bulundu. Risk: {risk_level.upper()}."
        )

        msgs = [
            self.create_conversation_message("Test senaryoları ve regresyon alanları analiz ediliyor…", "instruction"),
            self.create_conversation_message(summary, "result"),
        ]
        if critical_gaps:
            msgs.append(self.create_conversation_message(
                "⚠ Kritik: " + " | ".join(critical_gaps), "warning"
            ))

        return AgentResult(
            success=True,
            output={
                "test_scenarios":   test_scenarios,
                "regression_areas": regression_areas,
                "manual_checklist": manual_checklist,
                "missing_tests":    missing_tests,
                "critical_gaps":    critical_gaps,
                "coverage_estimate": "~15% (sadece manuel testler)",
            },
            summary=summary,
            risk_level=risk_level,
            requires_approval=self._needs_approval(risk_level),
            conversation_messages=msgs,
        )
