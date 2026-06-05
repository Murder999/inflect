"""
Campaign Intelligence & Report Agents.
"""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult


def _fmt(n: int) -> str:
    if n >= 1_000_000: return f"{n/1_000_000:.1f}M"
    if n >= 1_000: return f"{n/1_000:.0f}K"
    return str(n)


# ─── Campaign Planner Agent ───────────────────────────────────────────────────

class CampaignPlannerAgent(BaseAgent):
    """Kampanya için AI destekli plan özeti üretir."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("campaign_plan", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["creator_mix", "budget_split", "content_format", "risk_map"], "estimated_latency_ms": 380}

    async def execute(self, task) -> AgentResult:
        data       = task.input_data or {}
        campaign   = data.get("campaign", {})
        influencers= data.get("recommended_influencers", [])
        roi_est    = data.get("roi_estimates", {})
        brand      = campaign.get("brand") or "Belirtilmemiş"
        budget     = campaign.get("budget") or roi_est.get("suggested_budget", 0)
        goal       = campaign.get("goal") or "Marka bilinirliği"
        platform   = campaign.get("platform") or "Belirtilmemiş"
        n_creators = len(influencers)

        # Creator mix analizi
        avg_fraud = roi_est.get("avg_fraud_score", 30)
        avg_roi   = roi_est.get("avg_roi_potential", 50)
        avg_brand = roi_est.get("avg_brand_fit", 55)

        creator_tiers = {
            "low_risk":  [i for i in influencers if i.get("fraud_score", 50) < 30],
            "mid_tier":  [i for i in influencers if 30 <= i.get("fraud_score", 50) < 55],
            "high_risk": [i for i in influencers if i.get("fraud_score", 50) >= 55],
        }

        # Budget split önerisi
        budget_split = {
            "safe_creators_pct": 60,
            "test_creators_pct": 30,
            "contingency_pct":   10,
        }

        # İçerik format önerisi
        format_map = {
            "instagram": ["Reels (öncelik)", "Story (28 günlük)", "Carousel post"],
            "tiktok":    ["Native TikTok video", "TikTok Story", "Duet/Stitch challenge"],
            "youtube":   ["Dedicated video (ideal)", "Integration (60-90s)", "Shorts"],
        }
        content_formats = format_map.get(platform.lower(), ["Sponsored post", "Story", "Native içerik"])

        # Risk dağılımı
        risks = []
        if avg_fraud > 40: risks.append(f"Seçili influencerlerin ortalama fraud skoru yüksek ({avg_fraud:.0f})")
        if n_creators < 2: risks.append("Tek influencer ile kampanya riski yüksek — çeşitlendirin")
        if budget and budget < 500: risks.append("Düşük bütçe — ölçekli sonuç beklemeyin")

        summary = (
            f"'{brand}' kampanyası için AI plan: {n_creators} influencer, "
            f"ort. brand fit {avg_brand:.0f}/100, ort. ROI pot. {avg_roi:.0f}/100. "
            f"Önerilen bütçet dağılımı oluşturuldu. {len(risks)} risk faktörü tespit edildi."
        )

        return AgentResult(
            success=True,
            output={
                "campaign_summary": {
                    "brand": brand, "goal": goal, "platform": platform,
                    "budget": budget, "creator_count": n_creators,
                },
                "creator_mix": {
                    "low_risk_count":  len(creator_tiers["low_risk"]),
                    "mid_tier_count":  len(creator_tiers["mid_tier"]),
                    "high_risk_count": len(creator_tiers["high_risk"]),
                },
                "budget_split": budget_split,
                "content_formats": content_formats,
                "kpis": ["Erişim", "CTR", "Dönüşüm", "Brand awareness lift", "CPE"],
                "risks": risks,
                "timeline": "Onay → Brief → İçerik → Yayın → Ölçüm: önerilen 6-8 hafta",
            },
            summary=summary,
            risk_level="medium" if risks else "low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── Similar Creator Agent ────────────────────────────────────────────────────

class SimilarCreatorAgent(BaseAgent):
    """Benzer creator önerilerini gerekçelendirir."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("similar_creator", "general", "sub_task")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["similarity_scoring", "rationale"], "estimated_latency_ms": 180}

    async def execute(self, task) -> AgentResult:
        data   = task.input_data or {}
        similar= data.get("similar", [])
        source = data.get("source_username", "—")

        enriched = []
        for s in similar[:5]:
            enriched.append({
                **s,
                "why_similar": (
                    f"Benzer kategori ve takipçi aralığı. "
                    f"Fraud skoru {'düşük' if s.get('fraud_score', 50) < 30 else 'orta'}. "
                    f"Etkileşim oranı karşılaştırılabilir."
                ),
                "recommendation": "Önce analiz edin" if s.get("final_score", 0) < 60 else "Doğrudan deneyebilirsiniz",
            })

        summary = f"@{source} için {len(enriched)} benzer creator gerekçelendirildi."
        return AgentResult(
            success=True,
            output={"source": source, "similar_enriched": enriched},
            summary=summary,
            risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── Competitor Intelligence Agent ──────────────────────────────────────────

class CompetitorIntelAgent(BaseAgent):
    """Rakip marka analizi, fırsat tespiti ve influencer gap analizi."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("competitor_intel", "general", "sub_task")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["competitor_mapping", "gap_analysis", "opportunity_scoring"], "estimated_latency_ms": 380}

    async def execute(self, task) -> AgentResult:
        data        = task.input_data or {}
        brand       = data.get("brand", "Hedef Marka")
        competitors = data.get("competitors", ["Rakip A", "Rakip B"])
        category    = data.get("category", "Genel")
        platform    = data.get("platform", "instagram")

        gaps = [
            {"gap": f"{category} mikro influencer (10K-100K)",
             "opportunity": "Yüksek engagement, düşük CPE",
             "priority": "HIGH"},
            {"gap": "UGC içerik üreticileri",
             "opportunity": "Organik reach potansiyeli",
             "priority": "MEDIUM"},
            {"gap": f"Rakip kapsamı dışındaki bölgeler",
             "opportunity": "Kapsam boşluğu doldurmak",
             "priority": "MEDIUM"},
        ]

        opportunities = [
            f"{category} niche'inde aktif influencer havuzu genişletilmeli",
            f"{platform.capitalize()} format odaklı creator'larla deneme bütçesi planla",
            "Fraud riski düşük, engagement kalitesi yüksek profilleri öncele",
        ]

        summary = (
            f"'{brand}' için rakip analizi: {len(competitors)} rakip, "
            f"{len(gaps)} influencer gap, {len(opportunities)} fırsat tespit edildi."
        )

        return AgentResult(
            success=True,
            output={
                "brand": brand,
                "competitors": competitors,
                "category": category,
                "platform": platform,
                "influencer_gaps": gaps,
                "opportunities": opportunities,
                "recommendation": f"'{brand}' için influencer stratejisini rakiplerin boş bıraktığı niche'lere yönlendirin.",
                "note": "Gerçek rakip verisi için platförm analitik veya 3. taraf araç gereklidir.",
            },
            summary=summary, risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )

class ReportAgent(BaseAgent):
    """Premium, kurumsal dilde rapor özeti üretir."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("premium_report", "general", "sub_task", "orchestrated_review")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["executive_summary", "risk_analysis", "recommendation", "confidence"], "estimated_latency_ms": 420}

    async def execute(self, task) -> AgentResult:
        data     = task.input_data or {}
        scores   = data.get("scores", {})
        profile  = data.get("profile", {})
        report   = data.get("report", {})
        brand    = data.get("brand", "Genel Marka")

        final    = scores.get("final_score", 0)
        fraud    = scores.get("fraud_score", 0)
        brand_fit= scores.get("brand_fit", 0)
        auth     = scores.get("authenticity", 0)
        decision = scores.get("decision", "")
        username = profile.get("username", "—")
        dn       = profile.get("display_name") or username
        plat     = profile.get("platform_label", profile.get("platform", ""))
        cat      = profile.get("category", "")
        followers= profile.get("followers", 0)
        er       = profile.get("engagement_rate", 0)

        decision_map = {
            "Önerilir": "STRONG_FIT",
            "Test Bütçesiyle Denenebilir": "CONDITIONAL_FIT",
            "Dikkatli Değerlendirilmeli": "RISKY",
            "Önerilmez": "AVOID",
        }
        decision_label = decision_map.get(decision, "UNDETERMINED")
        confidence = "HIGH" if final > 0 and fraud < 30 else "MEDIUM" if final > 0 else "LOW"

        key_strengths = []
        if auth >= 70:     key_strengths.append(f"Audience authenticity score {auth}/100 — above industry threshold")
        if fraud < 25:     key_strengths.append(f"Fraud risk index {fraud}/100 — minimal bot activity detected")
        if brand_fit >= 70:key_strengths.append(f"Brand fit coefficient {brand_fit}/100 — strong category alignment with '{brand}'")
        if scores.get("momentum", 0) >= 65: key_strengths.append("Positive momentum trajectory over 30-day window")
        if scores.get("roi_potential", 0) >= 65: key_strengths.append("High ROI potential index — favorable cost-efficiency outlook")

        risk_factors = []
        if fraud >= 35:    risk_factors.append(f"Elevated fraud risk index ({fraud}/100) — pre-campaign follower audit recommended")
        if brand_fit < 50: risk_factors.append(f"Sub-optimal brand fit ({brand_fit}/100) — test engagement before full commitment")
        if scores.get("reputation_risk", 0) >= 40: risk_factors.append("Reputation risk requires manual content review")
        if not key_strengths: risk_factors.append("Insufficient positive signals for strong recommendation")

        campaign_rec = []
        if final >= 75:
            campaign_rec.extend(["Immediate onboarding — full campaign budget allocation justified", f"Recommended formats: {', '.join(scores.get('brand_fit_campaign_types', ['Sponsored content'])[:2])}"])
        elif final >= 55:
            campaign_rec.extend(["Initiate with test budget (15-20% of total)", "Track 2-3 posts before scaling", "Define KPIs: CPE, click-through, conversion rate"])
        else:
            campaign_rec.extend(["Do not allocate primary budget — high uncertainty", "Explore alternative profiles with stronger fundamentals"])

        premium_summary = {
            "creator":          f"{dn} (@{username})",
            "platform":         plat,
            "category":         cat or "General Content",
            "audience_size":    _fmt(followers),
            "engagement_rate":  f"{er:.1f}%",
            "executive_summary": (
                f"{dn} presents a {decision_label.lower().replace('_', ' ')} profile for '{brand}' campaign objectives. "
                f"With a composite score of {final}/100 and fraud risk index at {fraud}/100, "
                f"the creator demonstrates {'strong' if auth >= 70 else 'adequate'} audience authenticity "
                f"and {'excellent' if brand_fit >= 75 else 'moderate' if brand_fit >= 50 else 'insufficient'} brand alignment. "
                f"Confidence level: {confidence}."
            ),
            "key_strengths":       key_strengths or ["Insufficient data for positive signal identification"],
            "risk_factors":        risk_factors or ["No critical risk factors identified"],
            "audience_notes":      ["Demographic data not available — platform API access required"],
            "campaign_recommendation": campaign_rec,
            "decision":            decision_label,
            "confidence_level":    confidence,
        }

        summary = (
            f"Premium rapor: {dn} — {decision_label} ({confidence} confidence). "
            f"Final skor {final}/100. {len(key_strengths)} güçlü nokta, {len(risk_factors)} risk faktörü."
        )

        return AgentResult(
            success=True,
            output=premium_summary,
            summary=summary,
            risk_level="low" if final >= 70 else "medium" if final >= 50 else "high",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )
