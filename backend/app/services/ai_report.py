"""
AI Report Generator v2 — Executive Summary + structured report.
"""

def generate_report(profile: dict, scores: dict, brand: str) -> dict:
    dn = profile.get("display_name") or profile.get("username", "")
    plat = profile.get("platform_label", profile.get("platform", ""))
    cat = profile.get("category", "")
    followers = profile.get("followers", 0)
    er = profile.get("engagement_rate", 0)

    final = scores["final_score"]
    decision = scores["decision"]
    fraud_risk = scores["fraud_risk_label"]

    # AI Executive Summary
    brand_label = brand or "Genel Marka"
    fit_word = "yüksek" if scores["brand_fit"] >= 70 else "orta" if scores["brand_fit"] >= 45 else "düşük"
    fraud_word = "düşük" if scores["fraud_score"] < 25 else "orta" if scores["fraud_score"] < 50 else "yüksek"
    momentum_word = "güçlü" if scores["momentum"] >= 70 else "stabil" if scores["momentum"] >= 45 else "zayıf"
    roi_word = "yüksek" if scores["roi_potential"] >= 70 else "orta" if scores["roi_potential"] >= 45 else "düşük"

    executive_summary = (
        f"{dn}, {plat} platformunda {_fmt(followers)} takipçiye sahip bir {cat or 'içerik üreticisi'}. "
        f"{brand_label} için marka uyumu {fit_word} seviyede. "
        f"Kitle kalitesi {'güçlü' if scores['authenticity'] >= 70 else 'kabul edilebilir' if scores['authenticity'] >= 45 else 'zayıf'}, "
        f"fraud riski {fraud_word}. "
        f"Son dönem büyüme trendi {momentum_word}, etkileşim kalitesi "
        f"{'güçlü' if scores['engagement_quality'] >= 70 else 'orta' if scores['engagement_quality'] >= 45 else 'düşük'}. "
        f"ROI potansiyeli {roi_word}. "
    )
    if final >= 75:
        executive_summary += f"Genel değerlendirme: Kampanya için önerilir. Final skor {final}/100."
    elif final >= 55:
        executive_summary += f"Genel değerlendirme: Test bütçesiyle denenebilir. Final skor {final}/100."
    else:
        executive_summary += f"Genel değerlendirme: Dikkatli değerlendirilmeli. Final skor {final}/100."

    positive = [s["text"] for s in scores.get("signals", []) if s["type"] == "positive"]
    negative = [s["text"] for s in scores.get("signals", []) if s["type"] in ("negative", "warning")]

    rp = scores.get("roi_prediction", {})

    next_steps = []
    if scores["fraud_score"] >= 50:
        next_steps.append("Anlaşma öncesi takipçi kalitesini manuel incele.")
    next_steps.extend([
        "İlk iş birliğini test bütçesiyle başlat.",
        "UTM parametreleri ve özel kupon kodu ile dönüşüm izle.",
        "Kampanya öncesi son 10 içeriği kalite kontrolünden geçir.",
        "30. gün performans raporu ile devam kararı ver.",
    ])

    return {
        "headline": f"{dn} × {brand_label} — {decision}",
        "executive_summary": executive_summary,
        "summary": executive_summary,
        "recommendation": decision,
        "pros": positive[:5],
        "cons": negative[:5],
        "budget_estimate": {
            "min": rp.get("budget_min", 0),
            "max": rp.get("budget_max", 0),
            "currency": "USD",
            "per": "post",
            "note": rp.get("note", "Tahmini değer."),
        },
        "roi_prediction": rp,
        "reach_estimate": rp.get("estimated_reach", int(followers * 0.35)),
        "next_steps": next_steps,
        "missing_data_note": (
            "Not: Yaş/cinsiyet dağılımı, doğrulanmış fraud sampling ve satış ROI verisi "
            "bu sistemde mevcut değil. Bu veriler için platformun resmi araçlarını kullanın."
            if profile.get("missing_real_fields") else None
        ),
    }

def _fmt(n: int) -> str:
    if n >= 1_000_000: return f"{n/1_000_000:.1f}M"
    if n >= 1_000: return f"{n/1_000:.0f}K"
    return str(n)
