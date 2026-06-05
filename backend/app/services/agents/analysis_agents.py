"""
Analysis Intelligence Agents — score_engine çıktısını yorumlayan ajanlar.
Gerçek veri uydurmaz; sadece mevcut skorları açıklar ve zenginleştirir.
"""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult
from app.services.agents.provider_client import is_mock_mode


# ─── Ortak helper ────────────────────────────────────────────────────────────

def _score_band(score: int, thresholds=(30, 60, 80)) -> str:
    if score >= thresholds[2]: return "excellent"
    if score >= thresholds[1]: return "good"
    if score >= thresholds[0]: return "average"
    return "poor"

def _fmt(n: int) -> str:
    if n >= 1_000_000: return f"{n/1_000_000:.1f}M"
    if n >= 1_000: return f"{n/1_000:.0f}K"
    return str(n)


# ─── 1. Analysis Agent ───────────────────────────────────────────────────────

class AnalysisAgent(BaseAgent):
    """Genel influencer analiz yorumlama ve karar desteği."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("analysis_insight", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["score_interpretation", "decision_support", "next_steps"], "estimated_latency_ms": 320}

    async def execute(self, task) -> AgentResult:
        data     = task.input_data or {}
        scores   = data.get("scores", {})
        profile  = data.get("profile", {})
        brand    = data.get("brand", "Genel Marka")
        final    = scores.get("final_score", 0)
        decision = scores.get("decision", "Değerlendirilmedi")
        fraud    = scores.get("fraud_score", 0)
        brand_fit= scores.get("brand_fit", 0)
        er       = profile.get("engagement_rate", 0)
        username = profile.get("username", "—")

        strengths = []
        weaknesses = []
        if scores.get("authenticity", 0) >= 70: strengths.append("Kitle otantikliği güçlü")
        if fraud < 25:                            strengths.append("Fraud riski minimal")
        if brand_fit >= 70:                       strengths.append(f"'{brand}' için yüksek marka uyumu")
        if scores.get("momentum", 0) >= 65:       strengths.append("Pozitif büyüme trendi")
        if scores.get("engagement_quality", 0) >= 65: strengths.append("Kaliteli kitle etkileşimi")
        if fraud >= 50:   weaknesses.append("Sahte takipçi riski onaylanmadan çalışılmamalı")
        if brand_fit < 45: weaknesses.append("Marka-kategori uyumu test edilmeli")
        if scores.get("momentum", 0) < 40: weaknesses.append("Büyüme trendi yavaş — izlenmeli")

        confidence = "high" if final > 0 else "low"
        decision_label = {
            "Önerilir": "STRONG_FIT",
            "Test Bütçesiyle Denenebilir": "CONDITIONAL_FIT",
            "Dikkatli Değerlendirilmeli": "RISKY",
            "Önerilmez": "AVOID",
        }.get(decision, "UNDETERMINED")

        summary = (
            f"@{username} için AI analiz yorumu: "
            f"Final skor {final}/100, {'güçlü bir seçim' if final >= 75 else 'dikkatli değerlendirilmeli' if final >= 55 else 'önerilmez'}. "
            f"{len(strengths)} güçlü nokta, {len(weaknesses)} risk faktörü tespit edildi."
        )

        return AgentResult(
            success=True,
            output={
                "username": username,
                "brand": brand,
                "final_score": final,
                "decision_label": decision_label,
                "confidence": confidence,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "key_metrics": {
                    "final_score": final,
                    "fraud_score": fraud,
                    "brand_fit": brand_fit,
                    "engagement_rate": er,
                    "authenticity": scores.get("authenticity", 0),
                },
                "next_steps": [
                    "Test bütçesi ile 1-2 post yapın." if final >= 55 else "Alternatif profil arayın.",
                    "Son 10 içeriği manuel kalite kontrolünden geçirin.",
                    "UTM parametresi ile dönüşüm izleyin.",
                ],
                "provider_note": "mock" if is_mock_mode() else "live",
            },
            summary=summary,
            risk_level="low" if final >= 70 else "medium" if final >= 50 else "high",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── 2. Fraud Agent ──────────────────────────────────────────────────────────

class FraudAgent(BaseAgent):
    """Fraud skorlarını derinlemesine yorumlar."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("fraud_analysis", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["bot_detection", "engagement_audit", "follower_quality"], "estimated_latency_ms": 290}

    async def execute(self, task) -> AgentResult:
        data   = task.input_data or {}
        scores = data.get("scores", {})
        profile= data.get("profile", {})
        fraud  = scores.get("fraud_score", 0)
        auth   = scores.get("authenticity", 0)
        eq     = scores.get("engagement_quality", 0)
        detail = scores.get("fraud_detail", {})
        er     = profile.get("engagement_rate", 0)
        followers = profile.get("followers", 1)
        avg_likes = profile.get("avg_likes", 0)

        # Fraud signals
        signals = []
        if fraud < 20:
            signals.append({"severity": "none",   "signal": "Bot aktivitesi tespit edilmedi"})
        elif fraud < 40:
            signals.append({"severity": "low",    "signal": f"Düşük düzey şüpheli takipçi (%{detail.get('fake_follower_pct', '?')})"})
        elif fraud < 60:
            signals.append({"severity": "medium", "signal": "Orta düzey fraud riski — anlaşma öncesi manual kontrol önerilir"})
        else:
            signals.append({"severity": "high",   "signal": "Yüksek fraud riski — çalışma önerilmez"})

        # Engagement consistency
        like_ratio = avg_likes / max(followers, 1) * 100
        if like_ratio < er * 0.3:
            signals.append({"severity": "medium", "signal": "Beğeni/takipçi oranı etkileşim oranıyla tutarsız"})
        else:
            signals.append({"severity": "none", "signal": "Etkileşim tutarlılığı kabul edilebilir"})

        risk_level = "high" if fraud >= 60 else "medium" if fraud >= 35 else "low"
        summary = (
            f"Fraud analizi: Skor {fraud}/100 ({detail.get('bot_activity', 'bilinmiyor')} bot aktivitesi). "
            f"Kitle otantikliği {auth}/100. {len([s for s in signals if s['severity'] in ('high','medium')])} riskli sinyal."
        )

        return AgentResult(
            success=True,
            output={
                "fraud_score": fraud,
                "authenticity_score": auth,
                "engagement_quality": eq,
                "signals": signals,
                "detail": detail,
                "verdict": "RISKY" if fraud >= 60 else "CAUTION" if fraud >= 35 else "SAFE",
                "action": "Çalışılmamalı" if fraud >= 60 else "Manuel kontrol önerilir" if fraud >= 35 else "İlerlenebilir",
                "not_available": ["Yorum kalitesi sampling (veri sağlayıcı yok)", "Tarihsel bot spike analizi", "Platform doğrulaması"],
            },
            summary=summary,
            risk_level=risk_level,
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── 3. Audience Agent ───────────────────────────────────────────────────────

class AudienceAgent(BaseAgent):
    """Kitle zekası — gerçek veri yoksa açık NOT üretir, asla uydurmaz."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("audience_analysis", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["demographics_check", "quality_assessment", "availability_report"], "estimated_latency_ms": 180}

    async def execute(self, task) -> AgentResult:
        data    = task.input_data or {}
        profile = data.get("profile", {})
        scores  = data.get("scores", {})
        platform = profile.get("platform", "")

        # Gerçek kitle verisi mevcut değil — bu açık belirtilir
        available_data = {
            "followers": profile.get("followers", 0),
            "engagement_rate": profile.get("engagement_rate", 0),
            "avg_views": profile.get("avg_views", 0),
            "suspicious_audience_pct": profile.get("suspicious_audience", "N/A"),
        }

        not_available = [
            "Yaş/cinsiyet demografisi (platform API auth gerekli)",
            "Kitle lokasyon dağılımı (platform API auth gerekli)",
            "Kitle ilgi alanları (platform API auth gerekli)",
            "Satın alma davranışı (3rd party data gerekli)",
        ]

        quality_estimate = "high" if scores.get("authenticity", 0) >= 70 and scores.get("engagement_quality", 0) >= 60 else \
                          "medium" if scores.get("authenticity", 0) >= 45 else "low"

        summary = (
            f"Kitle analizi: Kalite tahmini '{quality_estimate}'. "
            f"Demografik veri mevcut değil (platform API bağlı değil). "
            f"Engagement tabanlı kitle kalitesi değerlendirmesi yapıldı."
        )

        return AgentResult(
            success=True,
            output={
                "available_data": available_data,
                "not_available": not_available,
                "quality_estimate": quality_estimate,
                "quality_basis": "Engagement rate + authenticity score bileşimi",
                "platform_note": f"{platform.capitalize()}: Demografik veri API erişimi gerektirir.",
                "recommendation": "Gerçek kitle verisi için platform native analytics veya onaylı 3rd party tool kullanın.",
            },
            summary=summary,
            risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── 4. Brand Fit Agent ──────────────────────────────────────────────────────

class BrandFitAgent(BaseAgent):
    """Marka-influencer uyumunu yorumlar ve brand safety uyarısı üretir."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("brand_fit_analysis", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["category_match", "content_tone", "brand_safety", "campaign_types"], "estimated_latency_ms": 240}

    async def execute(self, task) -> AgentResult:
        data     = task.input_data or {}
        scores   = data.get("scores", {})
        profile  = data.get("profile", {})
        brand    = data.get("brand", "Genel Marka")
        brand_fit= scores.get("brand_fit", 0)
        rep_risk = scores.get("reputation_risk", 0)
        cat      = profile.get("category", "Belirtilmemiş")
        username = profile.get("username", "—")

        fit_label = "güçlü" if brand_fit >= 75 else "orta" if brand_fit >= 50 else "zayıf"
        brand_safety = "SAFE" if rep_risk < 25 else "REVIEW_NEEDED" if rep_risk < 50 else "AT_RISK"

        campaign_types = scores.get("brand_fit_campaign_types", [])
        content_notes = []
        if cat:
            content_notes.append(f"Kategori '{cat}' → marka hedefleriyle {'uyumlu' if brand_fit >= 60 else 'kısmi uyum'}")
        content_notes.append("İçerik tonu manuel kontrol önerilir (son 10 post)")
        content_notes.append("Sponsorlu içerik geçmişi incelenmeli")

        summary = (
            f"@{username} × '{brand}' brand fit: {brand_fit}/100 ({fit_label}). "
            f"Brand safety: {brand_safety}. "
            f"{len(campaign_types)} uygun kampanya formatı belirlendi."
        )

        return AgentResult(
            success=True,
            output={
                "brand": brand,
                "brand_fit_score": brand_fit,
                "fit_label": fit_label,
                "brand_safety": brand_safety,
                "reputation_risk": rep_risk,
                "category": cat,
                "campaign_types": campaign_types,
                "content_notes": content_notes,
                "recommendation": (
                    f"'{brand}' için bu influencer {fit_label} uyum gösteriyor. "
                    + ("Test kampanyası önerilir." if brand_fit >= 50 else "Alternatif profiller değerlendirilmeli.")
                ),
            },
            summary=summary,
            risk_level="low" if brand_fit >= 70 else "medium" if brand_fit >= 45 else "high",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── 5. ROI Prediction Agent ─────────────────────────────────────────────────

class RoiAgent(BaseAgent):
    """ROI tahmin skorlarını kampanya bağlamında yorumlar."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("roi_prediction", "pricing_review", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["reach_estimate", "cpm_cpe", "budget_guidance", "risk_caveat"], "estimated_latency_ms": 200}

    async def execute(self, task) -> AgentResult:
        data    = task.input_data or {}
        scores  = data.get("scores", {})
        profile = data.get("profile", {})
        roi_pot = scores.get("roi_potential", 0)
        rp      = scores.get("roi_prediction", {})
        fraud   = scores.get("fraud_score", 0)
        er      = profile.get("engagement_rate", 0)
        followers = profile.get("followers", 1)

        # Adjusted estimates (fraud-discounted)
        fraud_discount = 1 - (fraud / 200)
        adj_reach = int(rp.get("estimated_reach", followers * 0.35) * fraud_discount)
        adj_impr  = int(rp.get("estimated_impressions", adj_reach * 2.5) * fraud_discount)
        adj_clicks= int(rp.get("estimated_clicks", 0) * fraud_discount)

        budget_guidance = []
        if roi_pot >= 70:
            budget_guidance.append("Bütçe genişletilebilir — yüksek ROI beklentisi")
            budget_guidance.append(f"Önerilen başlangıç: ${rp.get('budget_min', 200)}-{rp.get('budget_max', 800)}/post")
        elif roi_pot >= 45:
            budget_guidance.append("Test bütçesi ile başlayın, 2-3 post sonrası karar verin")
            budget_guidance.append(f"Önerilen: ${rp.get('budget_min', 100)}-{rp.get('budget_max', 400)}/post")
        else:
            budget_guidance.append("Bütçeyi dikkatli kullanın — düşük ROI beklentisi")

        summary = (
            f"ROI tahmini: Potansiyel {roi_pot}/100. "
            f"Fraud-düzeltilmiş erişim tahmini: {_fmt(adj_reach)}. "
            f"Bütçe önerisi: ${rp.get('budget_min', 0)}-{rp.get('budget_max', 0)}/post. "
            f"⚠ Tüm değerler tahmindir. Gerçek sonuçlar kampanya türüne göre değişir."
        )

        return AgentResult(
            success=True,
            output={
                "roi_potential": roi_pot,
                "raw_predictions": rp,
                "fraud_adjusted": {
                    "reach": adj_reach,
                    "impressions": adj_impr,
                    "clicks": adj_clicks,
                    "fraud_discount_pct": round((1 - fraud_discount) * 100, 1),
                },
                "budget_guidance": budget_guidance,
                "cpm_estimate": rp.get("estimated_cpm", 0),
                "cpe_estimate": rp.get("estimated_cpe", 0),
                "important_caveat": (
                    "Bu tahminler rule-based modeldir. Gerçek ROI; içerik kalitesi, "
                    "kampanya türü, sezonsal faktörler ve landing page dönüşümüne bağlıdır. "
                    "Karar için A/B test önerilir."
                ),
            },
            summary=summary,
            risk_level="low" if roi_pot >= 65 else "medium",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )
