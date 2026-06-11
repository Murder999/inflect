"""
Explainability — Part 13

Generates human-readable evidence summaries and limitation disclosures.
"""
from __future__ import annotations

from app.services.competitor_intelligence.schemas import (
    CreatorSignal, CategoryDominance, PlatformBreakdown, TierBreakdown,
    SpendEstimate,
    SIGNAL_BRAND_ANALYSIS, SIGNAL_CATEGORY_MATCH,
    CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, CONFIDENCE_LOW,
)
from app.services.competitor_intelligence.spend_estimation import format_spend_tl


def build_evidence_summary(
    signals:    list[CreatorSignal],
    categories: list[CategoryDominance],
    platforms:  list[PlatformBreakdown],
    confidence: str,
) -> list[str]:
    """Return a concise list of evidence bullet points for the report header."""
    evidence: list[str] = []

    explicit = sum(1 for s in signals if s.signal_type == SIGNAL_BRAND_ANALYSIS)
    total    = len(signals)

    if explicit > 0:
        evidence.append(
            f"{explicit} creator için doğrudan marka analizi kaydı tespit edildi "
            f"(yüksek güven sinyali)."
        )
    if total > explicit:
        cat_signals = total - explicit
        evidence.append(
            f"{cat_signals} creator kategori eşleşmesiyle ilişkilendirildi "
            f"(düşük güven sinyali)."
        )

    if categories:
        top_cats = ", ".join(c.category for c in categories[:3])
        evidence.append(f"Dominant kategoriler: {top_cats}.")

    if platforms:
        top_platform = platforms[0].platform.title()
        evidence.append(f"En aktif platform: {top_platform} (%{platforms[0].percentage:.0f}).")

    evidence.append(
        f"Toplam {total} creator tespit edildi. "
        f"Güven seviyesi: {_confidence_label(confidence)}."
    )
    return evidence


def build_limitations(
    signals:     list[CreatorSignal],
    confidence:  str,
    is_mock:     bool,
    window_days: int,
) -> list[str]:
    """Return standardized limitation disclosures."""
    limitations = [
        "Creator-marka ilişkileri dolaylı sinyallerden çıkarılmıştır; "
        "doğrudan ticari anlaşma verisi mevcut değildir.",
        "Rakip creator harcamaları gerçek sözleşme değerlerini yansıtmaz; "
        "tahminler yönlendirici niteliktedir.",
        f"Analiz {window_days} günlük pencereyi kapsamaktadır.",
    ]

    if is_mock:
        limitations.insert(
            0,
            "[MOCK] Bu rapor gerçek bir analiz motoru tarafından üretilmemiştir. "
            "Gösterilen değerler sentetik ve eğitim amaçlıdır.",
        )

    if confidence == CONFIDENCE_LOW:
        limitations.append(
            "Düşük güven seviyesi: sinyallerin büyük çoğunluğu zayıf kategori "
            "eşleşmelerine dayanmaktadır."
        )
    elif confidence == CONFIDENCE_MEDIUM:
        limitations.append(
            "Orta güven seviyesi: bazı doğrudan marka analizi sinyalleri mevcut "
            "ancak örneklem sınırlıdır."
        )

    return limitations


def _confidence_label(c: str) -> str:
    return {"high": "Yüksek", "medium": "Orta", "low": "Düşük"}.get(c, c)
