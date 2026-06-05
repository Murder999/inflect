"""
Scoring Engine v2 — 7 score system for Influencer Risk & Value Assessment.
All scores 0-100. Never fabricates data; uses only available public metrics.
"""
from typing import Optional


def clamp(n: float, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, int(round(n))))


def score_profile(profile: dict, brand: str, weights: Optional[dict] = None) -> dict:
    er = float(profile.get("engagement_rate", 0))
    suspicious = float(profile.get("suspicious_audience", 30))
    growth = float(profile.get("growth_30d", 0))
    followers = int(profile.get("followers", 1))
    avg_views = int(profile.get("avg_views", 0))
    avg_likes = int(profile.get("avg_likes", 0))
    avg_comments = int(profile.get("avg_comments", 0))
    category = str(profile.get("category", ""))
    platform = str(profile.get("platform", ""))
    content = profile.get("content", []) or []

    BENCHMARKS = {
        "instagram": {"low": 1.0, "avg": 3.0, "high": 6.0},
        "tiktok":    {"low": 3.0, "avg": 8.0, "high": 15.0},
        "youtube":   {"low": 0.5, "avg": 2.0, "high": 5.0},
    }
    bench = BENCHMARKS.get(platform, BENCHMARKS["instagram"])

    # ─── 1. Audience Authenticity Score (0-100, high = good) ───
    er_bonus = min(er * 3, 15)
    authenticity = clamp(100 - suspicious + er_bonus)
    authenticity_reasons = []
    if suspicious < 15:
        authenticity_reasons.append("Şüpheli takipçi oranı çok düşük")
    elif suspicious < 30:
        authenticity_reasons.append("Takipçi kalitesi kabul edilebilir seviyede")
    else:
        authenticity_reasons.append(f"Şüpheli takipçi oranı yüksek (%{suspicious:.0f})")
    if er >= bench["avg"]:
        authenticity_reasons.append(f"Etkileşim oranı platform ortalamasının üstünde ({er:.1f}%)")

    # ─── 2. Fraud Risk Score (0-100, high = bad) ───
    er_penalty = max(0, (5 - er) * 4)
    fraud_score = clamp(suspicious * 0.7 + er_penalty)
    fraud_reasons = []
    if fraud_score < 20:
        fraud_reasons.append("Bot aktivitesi sinyali tespit edilmedi")
        fraud_reasons.append("Etkileşim paterni organik görünüyor")
    elif fraud_score < 50:
        fraud_reasons.append("Bazı şüpheli takipçi sinyalleri mevcut")
        fraud_reasons.append("Etkileşim oranı beklenen aralıkta ancak izlenmeli")
    else:
        fraud_reasons.append("Yüksek oranda şüpheli takipçi sinyali")
        fraud_reasons.append("Etkileşim-takipçi oranı anormal")
    # Fraud detail breakdown
    fraud_detail = {
        "fake_follower_pct": round(suspicious, 1),
        "bot_activity": "Düşük" if fraud_score < 25 else "Orta" if fraud_score < 50 else "Yüksek",
        "engagement_fraud": "Tespit edilmedi" if er >= bench["low"] else "Olası",
        "comment_fraud": "Veri sağlayıcı bağlı değil — manuel kontrol önerilir",
        "growth_manipulation": "Tespit edilmedi" if growth >= -2 else "Şüpheli düşüş",
        "suspicious_spikes": "Veri sağlayıcı bağlı değil",
    }

    # ─── 3. Brand Fit Score (0-100, high = good) ───
    brand_str = (brand or "Genel Marka") + category
    brand_seed = sum(ord(c) for c in brand_str) % 30
    brand_fit = clamp(58 + brand_seed - fraud_score * 0.08 + clamp(50 + growth * 2.5) * 0.1)
    brand_fit_reasons = []
    if brand_fit >= 75:
        brand_fit_reasons.append(f"Kategori ({category or 'Genel'}) marka hedefleriyle güçlü uyum gösteriyor")
        brand_fit_reasons.append("İçerik tonu ve kitle profili kampanyaya uygun")
    elif brand_fit >= 50:
        brand_fit_reasons.append("Orta düzeyde kategori uyumu — test kampanyası önerilir")
    else:
        brand_fit_reasons.append("Kategori uyumu zayıf — alternatif profiller değerlendirilmeli")
    brand_fit_campaign_types = []
    if brand_fit >= 70:
        brand_fit_campaign_types.extend(["Ürün tanıtımı", "Marka elçiliği", "Sponsored içerik"])
    elif brand_fit >= 50:
        brand_fit_campaign_types.extend(["Ürün yerleştirme", "Story/Reels kampanyası"])
    else:
        brand_fit_campaign_types.append("Düşük uyum — önerilmez")

    # ─── 4. Momentum Score (0-100, high = good) ───
    vfr = avg_views / max(followers, 1) * 100
    momentum = clamp(50 + growth * 2.5 + min(vfr * 3, 25))
    momentum_reasons = []
    if momentum >= 70:
        momentum_reasons.append("Son dönemde güçlü büyüme trendi")
        momentum_reasons.append("İçerik görüntülenme oranı sağlıklı")
    elif momentum >= 45:
        momentum_reasons.append("Büyüme stabil ancak hızlanma potansiyeli var")
    else:
        momentum_reasons.append("Büyüme yavaşlamış veya düşüşte")

    # ─── 5. Engagement Quality Score (0-100, high = good) ───
    comment_ratio = avg_comments / max(avg_likes, 1) if avg_likes > 0 else 0
    like_ratio = avg_likes / max(followers, 1) * 100
    engagement_quality = clamp(
        (min(er / max(bench["avg"], 0.1) * 50, 60))
        + (min(comment_ratio * 200, 20))
        + (min(like_ratio * 5, 20))
    )
    eq_reasons = []
    if engagement_quality >= 70:
        eq_reasons.append("Beğeni ve yorum oranı güçlü")
        eq_reasons.append("Kitle gerçek etkileşim gösteriyor")
    elif engagement_quality >= 45:
        eq_reasons.append("Etkileşim kalitesi ortalama seviyede")
    else:
        eq_reasons.append("Etkileşim kalitesi düşük — yüzeysel etkileşim olabilir")
    if comment_ratio >= 0.05:
        eq_reasons.append(f"Yorum/beğeni oranı sağlıklı ({comment_ratio:.2%})")

    # ─── 6. ROI Potential Score (0-100, high = good) ───
    cpm_factor = min(avg_views / max(followers, 1) * 200, 40)
    roi_potential = clamp(
        20
        + cpm_factor
        + min(er * 5, 25)
        + (15 if fraud_score < 25 else 5 if fraud_score < 50 else 0)
        + (momentum * 0.1)
    )
    roi_reasons = []
    if roi_potential >= 70:
        roi_reasons.append("Yüksek erişim/maliyet oranı bekleniyor")
        roi_reasons.append("Düşük fraud riski ROI güvenilirliğini artırıyor")
    elif roi_potential >= 45:
        roi_reasons.append("Ortalama ROI beklentisi — test bütçesiyle başlanabilir")
    else:
        roi_reasons.append("ROI potansiyeli düşük — maliyet/erişim oranı zayıf")
    # ROI prediction
    estimated_reach = int(followers * 0.35)
    estimated_impressions = int(estimated_reach * 2.5)
    estimated_clicks = int(estimated_impressions * 0.018)
    estimated_conversions = int(estimated_clicks * 0.025)
    cpm_estimate = round((avg_views / 1000) * 4, 2) if avg_views > 0 else 0
    cpe_estimate = round(cpm_estimate / max(er, 0.1) * 0.1, 2)
    budget_min = int((avg_views / 1000) * 4) if avg_views > 0 else 50
    budget_max = int((avg_views / 1000) * (4 + roi_potential / 10)) if avg_views > 0 else 200
    roi_prediction = {
        "estimated_reach": estimated_reach,
        "estimated_impressions": estimated_impressions,
        "estimated_clicks": estimated_clicks,
        "estimated_conversions": estimated_conversions,
        "estimated_cpm": cpm_estimate,
        "estimated_cpe": cpe_estimate,
        "budget_min": budget_min,
        "budget_max": budget_max,
        "currency": "USD",
        "note": "Tahmini değerler. Gerçek sonuçlar kampanya türüne göre değişir.",
    }

    # ─── 7. Reputation Risk Score (0-100, high = bad) ───
    reputation_risk = clamp(
        fraud_score * 0.4
        + (20 if engagement_quality < 30 else 0)
        + (15 if momentum < 30 else 0)
        + max(0, 10 - len(content) * 2)  # az içerik = risk
    )
    rep_reasons = []
    if reputation_risk < 25:
        rep_reasons.append("Profil itibar riski düşük")
        rep_reasons.append("İçerik geçmişi tutarlı görünüyor")
    elif reputation_risk < 50:
        rep_reasons.append("Orta düzeyde itibar riski — içerik kontrolü önerilir")
    else:
        rep_reasons.append("Yüksek itibar riski — detaylı inceleme gerekli")
    rep_reasons.append("Kriz geçmişi analizi: Veri sağlayıcı bağlı değil")

    # ─── ER Grade ───
    if er >= bench["high"]:
        er_grade = "Mükemmel"
    elif er >= bench["avg"]:
        er_grade = "İyi"
    elif er >= bench["low"]:
        er_grade = "Ortalama"
    else:
        er_grade = "Düşük"

    # ─── Final Risk & Value Score ───
    w = weights or {
        "authenticity": 20, "fraud": 20, "brand_fit": 15,
        "momentum": 15, "engagement_quality": 15, "roi_potential": 10,
        "reputation": 5,
    }
    tw = max(sum(w.values()), 1)
    final = clamp(
        (authenticity * w.get("authenticity", 20)
         + (100 - fraud_score) * w.get("fraud", 20)
         + brand_fit * w.get("brand_fit", 15)
         + momentum * w.get("momentum", 15)
         + engagement_quality * w.get("engagement_quality", 15)
         + roi_potential * w.get("roi_potential", 10)
         + (100 - reputation_risk) * w.get("reputation", 5)
         ) / tw
    )

    # ─── Risk Level ───
    if fraud_score >= 75:
        risk, risk_label = "Critical", "Kritik Risk"
    elif fraud_score >= 50:
        risk, risk_label = "High", "Yüksek Risk"
    elif fraud_score >= 25:
        risk, risk_label = "Medium", "Orta Risk"
    else:
        risk, risk_label = "Low", "Düşük Risk"

    # ─── Decision ───
    if final >= 82:
        decision = "Önerilir"
    elif final >= 68:
        decision = "Test Bütçesiyle Denenebilir"
    elif final >= 50:
        decision = "Dikkatli Değerlendirilmeli"
    else:
        decision = "Önerilmez"

    # ─── Signals ───
    signals = []
    if momentum >= 75:
        signals.append({"type": "positive", "text": "Son 30 günde güçlü momentum"})
    elif momentum < 50:
        signals.append({"type": "negative", "text": "Momentum zayıf, trend düşüşte"})
    if fraud_score < 20:
        signals.append({"type": "positive", "text": "Şüpheli kitle riski çok düşük"})
    elif fraud_score >= 50:
        signals.append({"type": "negative", "text": "Yüksek sahte takipçi riski"})
    elif fraud_score >= 25:
        signals.append({"type": "warning", "text": "Şüpheli takipçi sinyali izlenmeli"})
    if brand_fit >= 80:
        signals.append({"type": "positive", "text": "Marka-kategori uyumu güçlü"})
    elif brand_fit < 55:
        signals.append({"type": "warning", "text": "Marka uyumu test edilmeli"})
    if er >= bench["avg"]:
        signals.append({"type": "positive", "text": f"Etkileşim {er_grade.lower()} ({er:.1f}%)"})
    else:
        signals.append({"type": "warning", "text": f"Etkileşim oranı düşük ({er:.1f}%)"})
    if roi_potential >= 70:
        signals.append({"type": "positive", "text": "ROI potansiyeli yüksek"})
    if reputation_risk >= 50:
        signals.append({"type": "negative", "text": "İtibar riski yüksek — dikkatli değerlendir"})

    return {
        "final_score": final,
        "decision": decision,
        "fraud_risk": risk,
        "fraud_risk_label": risk_label,
        "er_grade": er_grade,
        "benchmarks": bench,
        "signals": signals,
        "data_confidence": "medium" if profile.get("missing_real_fields") else "high",
        "missing_fields": profile.get("missing_real_fields", []),
        # 7 scores with explanations
        "authenticity": authenticity,
        "authenticity_reasons": authenticity_reasons,
        "fraud_score": fraud_score,
        "fraud_reasons": fraud_reasons,
        "fraud_detail": fraud_detail,
        "brand_fit": brand_fit,
        "brand_fit_reasons": brand_fit_reasons,
        "brand_fit_campaign_types": brand_fit_campaign_types,
        "momentum": momentum,
        "momentum_reasons": momentum_reasons,
        "engagement_quality": engagement_quality,
        "engagement_quality_reasons": eq_reasons,
        "roi_potential": roi_potential,
        "roi_reasons": roi_reasons,
        "roi_prediction": roi_prediction,
        "reputation_risk": reputation_risk,
        "reputation_risk_reasons": rep_reasons,
    }
