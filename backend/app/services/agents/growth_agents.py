"""
Growth Intelligence Agents — SEO, Ads, Lead, Sales, Support.
Tüm draft çıktıları human approval gerektirir. Dış işlem yapmaz.
"""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult


def _allow_external() -> bool:
    """AGENTS_ALLOW_EXTERNAL_ACTIONS env flag — runtime'da okunur."""
    from app.core.config import settings
    return settings.AGENTS_ALLOW_EXTERNAL_ACTIONS


def _require_approval() -> bool:
    """AGENTS_REQUIRE_HUMAN_APPROVAL env flag — runtime'da okunur."""
    from app.core.config import settings
    return settings.AGENTS_REQUIRE_HUMAN_APPROVAL


# ─── Growth Director Agent ────────────────────────────────────────────────────

class GrowthDirectorAgent(BaseAgent):
    """SEO + Ads + Lead + Sales ajanlarını koordine eden büyüme direktörü."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("growth_review", "orchestrated_review", "general", "sub_task")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["channel_prioritization", "resource_allocation", "growth_roadmap"], "estimated_latency_ms": 280}

    async def execute(self, task) -> AgentResult:
        kw = self._keywords(task)
        channels = []
        if any(w in kw for w in ("seo", "arama", "organik", "blog")):
            channels.append("SEO")
        if any(w in kw for w in ("reklam", "ads", "paid", "meta", "google")):
            channels.append("Paid Ads")
        if any(w in kw for w in ("lead", "musteri", "satis", "demo")):
            channels.append("Lead Generation")
        if not channels:
            channels = ["SEO", "Paid Ads", "Lead Generation"]

        allow = _allow_external()
        summary = (
            f"Buyume stratejisi ozeti: {len(channels)} kanal aktif. "
            f"Oncelik: {' -> '.join(channels)}. "
            + ("Dis aksiyonlar insan onayi gerektiriyor."
               if not allow else "Dis aksiyonlar aktif — dikkatli kullanin.")
        )

        return AgentResult(
            success=True,
            output={
                "priority_channels": channels,
                "external_actions_allowed": allow,
                "growth_roadmap": [
                    "Q1: SEO content foundation + lead scoring sistemi kur",
                    "Q2: Paid ads test budget + sales automation hazirligi",
                    "Q3: Scale winning channels",
                    "Q4: Retention + upsell campaigns",
                ],
                "quick_wins": [
                    "Case study icerigi: Influencer basari hikayeleri",
                    "LinkedIn organic outreach (manuel, spam yok)",
                    "Email nurture sequence (onay sonrasi)",
                ],
                "requires_approval": ["Her dis kanal aksiyonu (reklam, email, DM)"],
            },
            summary=summary,
            risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── SEO Agent ────────────────────────────────────────────────────────────────

class SeoAgent(BaseAgent):

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("seo_plan", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["keyword_research", "content_calendar", "technical_seo", "local_seo"], "estimated_latency_ms": 350}

    async def execute(self, task) -> AgentResult:
        blog_titles = [
            "En Iyi Influencer Analiz Araclari 2025 - Kapsamli Karsilastirma",
            "Sahte Takipci Tespiti: Markalar icin Temel Kilavuz",
            "Influencer ROI Nasil Hesaplanir? Adim Adim Rehber",
            "Micro vs Macro Influencer: Hangisi Daha Iyi ROI Saglar?",
            "TikTok Influencer Kampanya Stratejisi 2025",
        ]
        keywords = [
            {"keyword": "influencer analiz araci",       "volume_est": "1K-10K/mo",  "difficulty": "medium", "priority": "high"},
            {"keyword": "sahte takipci tespit",           "volume_est": "500-5K/mo",  "difficulty": "low",    "priority": "high"},
            {"keyword": "influencer ROI hesaplama",       "volume_est": "200-2K/mo",  "difficulty": "low",    "priority": "medium"},
            {"keyword": "influencer marketing platform",  "volume_est": "5K-50K/mo",  "difficulty": "high",   "priority": "medium"},
        ]
        technical_checklist = [
            "Core Web Vitals: LCP < 2.5s, CLS < 0.1, FID < 100ms",
            "Schema markup: SoftwareApplication ve HowTo schema ekle",
            "Sitemap.xml guncelle ve Google Search Console'a gonder",
            "Internal linking: Blog -> Landing page -> Demo",
        ]

        summary = (
            f"SEO plani hazirlandir. {len(blog_titles)} icerik onerisi, "
            f"{len(keywords)} hedef keyword, teknik SEO checklist olusturuldu."
        )

        return AgentResult(
            success=True,
            output={
                "blog_titles":         blog_titles,
                "keyword_clusters":    keywords,
                "technical_checklist": technical_checklist,
                "content_calendar": {
                    "Hafta 1": "Pillar content: 'Influencer Analiz Rehberi 2025'",
                    "Hafta 2": "Cluster: 'Sahte Takipci Tespit Yontemleri'",
                    "Hafta 3": "Case study + landing page A/B test",
                    "Hafta 4": "Link building outreach plani",
                },
                "note": "Tum icerik uretim ve yayini insan editoru gerektirir.",
            },
            summary=summary,
            risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── Ads Agent ────────────────────────────────────────────────────────────────

class AdsAgent(BaseAgent):
    """Reklam kampanya fikirleri ve metinleri uretir. Reklam yayina almaz."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("ad_plan", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["audience_targeting", "copy_variants", "ab_test_design", "budget_est"], "estimated_latency_ms": 320}

    async def execute(self, task) -> AgentResult:
        ad_copies = {
            "google_search": [
                "Influencer risk analizini saniyeler icinde yapin | Inflect ile ucretsiz deneyin",
                "Sahte takipci tespiti + ROI hesaplama | 5 ucretsiz analiz — hemen basla",
                "Influencer analiz platformu | Fraud detection + 7 puanlama | Inflect.io",
            ],
            "meta_fb_ig": [
                "Yanlis influencer ile butcenizi yakmayin. Inflect ile risk analizi yapin.",
                "100M+ takipcili influencer listesi mi? Biz kaliteyi analiz ederiz. Demo isteyin.",
            ],
            "linkedin": [
                "Marka yoneticileri icin influencer analiz platformu. Fraud tespit + ROI tahmini.",
            ],
        }
        audiences = [
            {"segment": "Marka yoneticileri",     "platform": "LinkedIn", "targeting": "Job title: Brand Manager, Marketing Director"},
            {"segment": "E-ticaret girisimcileri", "platform": "Meta",     "targeting": "Interests: ecommerce, dropshipping"},
            {"segment": "Ajanslar",                "platform": "Google",   "targeting": "Keywords: influencer marketing platform"},
        ]
        ab_tests = [
            {"variant": "A", "headline": "Risk odakli", "cta": "Ucretsiz Analiz Et"},
            {"variant": "B", "headline": "ROI odakli",  "cta": "Demo Iste"},
        ]

        # Settings'ten oku — runtime'da dogru degeri alir
        require_appr = _require_approval()
        allow = _allow_external()

        summary = (
            f"Reklam plani hazirlandi. 3 platform icin {sum(len(v) for v in ad_copies.values())} "
            f"kopya varyasyonu, {len(audiences)} kitle segmenti, {len(ab_tests)} A/B test. "
            + ("REKLAM YAYINA ALMAK HUMAN APPROVAL GEREKTIRIR."
               if require_appr else "Approval devre disi — dikkatli kullanin.")
        )

        return AgentResult(
            success=True,
            output={
                "ad_copies":    ad_copies,
                "audiences":    audiences,
                "ab_tests":     ab_tests,
                "budget_est":   {"google": "$500-2000/mo", "meta": "$300-1500/mo", "linkedin": "$1000-3000/mo"},
                "status": "DRAFT — Human approval required before launch" if require_appr else "DRAFT — Review recommended",
                "external_actions_allowed": allow,
                "blocked_reason": "AGENTS_ALLOW_EXTERNAL_ACTIONS=false" if not allow else "External actions enabled — use with caution",
            },
            summary=summary,
            risk_level="medium",
            requires_approval=require_appr,
            conversation_messages=[self.create_conversation_message(summary, "warning")],
        )


# ─── Lead Finder Agent ────────────────────────────────────────────────────────

class LeadFinderAgent(BaseAgent):
    """Potansiyel musteri arama plani uretir. Gercek scraping yapmaz."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("lead_plan", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["icp_definition", "segment_mapping", "scoring_logic"], "estimated_latency_ms": 260}

    async def execute(self, task) -> AgentResult:
        icp = {
            "company_size": "10-500 calisan",
            "industry":     "E-ticaret, Moda, Guzellik, Gida, DTC markalari",
            "role":         "CMO, Brand Manager, Growth Lead, Marketing Director",
            "pain_point":   "Influencer kampanya ROI'sini olcmekte zorlanan ekipler",
            "budget":       "$1000+/ay influencer marketing harcamasi",
        }
        segments = [
            {"name": "DTC E-ticaret",  "size_est": "5K+ TR marka",  "priority": "HIGH",   "channel": "LinkedIn + cold email"},
            {"name": "Ajanslar",        "size_est": "2K+ TR ajans",  "priority": "HIGH",   "channel": "LinkedIn DM + referral"},
            {"name": "Moda/Guzellik",   "size_est": "3K+ marka",     "priority": "MEDIUM", "channel": "Instagram + LinkedIn"},
            {"name": "FMCG/Gida",       "size_est": "1K+ marka",     "priority": "MEDIUM", "channel": "Cold email + events"},
        ]
        scoring = {
            "10 puan": "C-level veya VP role",
            "8 puan":  "Aktif influencer kampanyalari var",
            "6 puan":  "10-500 calisan sirket",
            "4 puan":  "E-ticaret altyapisi mevcut",
            "2 puan":  "TR pazarinda aktif",
        }

        summary = (
            f"Lead arama plani hazirlandi. ICP tanimlandi, {len(segments)} segment belirlendi. "
            "Gercek lead listesi icin CRM entegrasyonu ve insan onayi gerekir. "
            "Ajan scraping veya email gondermez."
        )

        return AgentResult(
            success=True,
            output={
                "icp":           icp,
                "segments":      segments,
                "scoring_logic": scoring,
                "tools_needed":  ["Apollo.io", "LinkedIn Sales Navigator", "Hunter.io"],
                "not_doing": [
                    "Otomatik scraping",
                    "Email gonderme",
                    "DM gonderme",
                    "Gercek lead verisi toplama",
                ],
                "status": "PLANNING_ONLY — External action requires approval",
                "external_actions_allowed": _allow_external(),
            },
            summary=summary,
            risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── Sales Agent ─────────────────────────────────────────────────────────────

class SalesAgent(BaseAgent):
    """Satis mesaji ve teklif taslagi uretir. Gonderim icin approval gerekir."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("sales_draft", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["prospect_research", "message_draft", "objection_prep", "offer_summary"], "estimated_latency_ms": 340}

    async def execute(self, task) -> AgentResult:
        data     = task.input_data or {}
        prospect = data.get("prospect", {"name": "Marka Yoneticisi", "company": "Hedef Marka"})
        plan_rec = data.get("recommended_plan", "starter")

        draft_messages = {
            "cold_outreach": (
                f"Merhaba {prospect.get('name', '[Isim]')},\n\n"
                f"{prospect.get('company', '[Sirket]')}'nin influencer kampanyalarini takip ediyorum. "
                f"Influencer seciminde fraud tespiti ve ROI tahmini konusunda "
                f"yeni bir yaklasim sunuyoruz.\n\n"
                f"Inflect ile 5 dakikada herhangi bir influencer'in risk skorunu gorebilirsiniz. "
                f"Bu hafta 15 dakikalik bir demo icin uygun musunuz?\n\n"
                f"Saygilarimla,\n[Imza]"
            ),
            "demo_followup": (
                f"Merhaba {prospect.get('name', '[Isim]')},\n\n"
                f"Demo'yu gorustugumus icin tesekkurler. "
                f"Fraud detection sorulariniz icin {plan_rec.capitalize()} planini oneriyorum.\n\n"
                f"Bu plan: "
                f"{{'starter': '50 analiz/ay, $29', 'pro': '200 analiz/ay, $79', 'business': '1000 analiz/ay, $199'}.get(plan_rec, 'Starter, $29')}\n\n"
                f"Devam etmek ister misiniz?\n\nIyi calismalar"
            ),
        }
        objections = [
            {"obj": "Fiyat cok yuksek",       "response": "Tek bir yanlis influencer kampanyasi bu maliyetin 10 katini kaybettirebilir."},
            {"obj": "Zaten manuel yapiyoruz",  "response": "Manuel surec kac saatinizi aliyor? Inflect, bir analizi 30 saniyeye indiriyor."},
            {"obj": "Baska arac kullaniyoruz", "response": "Fraud detection + 7 boyutlu skorlama konusunda fark gormeyi isterim."},
        ]

        # Settings'ten oku
        require_appr = _require_approval()
        allow = _allow_external()

        summary = (
            f"Satis mesaji taslagi hazirlandi: {prospect.get('company', 'hedef')} icin. "
            + ("GONDERIM HUMAN APPROVAL GEREKTIRIR. Ajan otomatik gondermez."
               if require_appr else "Approval devre disi — dikkatli kullanin.")
        )

        return AgentResult(
            success=True,
            output={
                "prospect":           prospect,
                "draft_messages":     draft_messages,
                "objection_handling": objections,
                "offer_summary": {
                    "recommended_plan":    plan_rec,
                    "trial_offer":         "14 gun ucretsiz, kredi karti gerekmez",
                    "discount_authority":  "Sales Manager onayi gerekir",
                },
                "status": "DRAFT — Human must review and send manually" if require_appr else "DRAFT — Review recommended",
                "external_actions_allowed": allow,
                "blocked_actions": ["Otomatik email gonderme", "CRM kaydi (onay bekleniyor)", "Otomatik follow-up"],
            },
            summary=summary,
            risk_level="medium",
            requires_approval=require_appr,
            conversation_messages=[self.create_conversation_message(summary, "approval_request")],
        )


# ─── Support Agent (AI) ───────────────────────────────────────────────────────

class SupportAiAgent(BaseAgent):
    """Destek talebi ozetler ve yanit taslagi uretir. Otomatik gondermez."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("support_draft", "general", "sub_task")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["ticket_summary", "intent_classification", "draft_reply"], "estimated_latency_ms": 220}

    async def execute(self, task) -> AgentResult:
        data     = task.input_data or {}
        ticket   = data.get("ticket", {})
        subject  = ticket.get("subject", "—")
        messages = ticket.get("messages", [])
        category = ticket.get("category", "other")

        intent_map = {
            "billing":   "Fatura/Odeme sorunu",
            "technical": "Teknik destek",
            "account":   "Hesap yonetimi",
            "other":     "Genel soru",
        }
        intent = intent_map.get(category, "Genel soru")

        draft = (
            f"Merhaba,\n\n"
            f"'{subject}' konusundaki talebiniz icin tesekkurler.\n\n"
            f"[AGENT DRAFT — DUZENLE VE GONDER]\n"
            f"Sorununuzu inceledim. {intent} kategorisinde degerlendiriyorum.\n\n"
            f"Cozum icin: ...\n\n"
            f"Baska sorunuz varsa bize yazabilirsiniz.\n\nSaygilarimla,\nDestek Ekibi"
        )

        # Settings'ten oku
        require_appr = _require_approval()

        summary = (
            f"Destek talebi ozetlendi: '{subject}' — {intent}. "
            "Yanit taslagi hazir. "
            + ("GONDERIM ICIN INSAN ONAYI GEREKIR." if require_appr else "Approval devre disi.")
        )

        return AgentResult(
            success=True,
            output={
                "ticket_summary":   {"subject": subject, "intent": intent, "message_count": len(messages)},
                "draft_reply":      draft,
                "suggested_status": "in_progress",
                "priority":         "high" if category == "billing" else "normal",
                "status":           "DRAFT — Agent cannot send. Human review required." if require_appr else "DRAFT — Review recommended",
                "external_actions_allowed": _allow_external(),
            },
            summary=summary,
            risk_level="low",
            requires_approval=require_appr,
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )
