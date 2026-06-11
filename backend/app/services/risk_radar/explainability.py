"""
Explainability Engine — Part 15

Generates human-readable evidence summaries and limitation disclosures.
Every claim is traceable to a specific data source and computation.
"""
from __future__ import annotations

from app.services.risk_radar.schemas import (
    RiskDimension, RiskReportResult,
    CONF_HIGH, CONF_MEDIUM,
    RISK_HIGH, RISK_CRITICAL,
    TRAJ_RISING, TRAJ_SPIKE,
)


def build_evidence_summary(
    dimensions: dict[str, RiskDimension],
    snapshot_count: int,
    overall_score: int,
    trajectory: str,
) -> list[str]:
    evidence: list[str] = []

    evidence.append(f"Analiz temeli: {snapshot_count} snapshot kaydı kullanıldı.")

    # High-risk dimensions
    high_dims = [
        d for d in dimensions.values()
        if d.level in (RISK_HIGH, RISK_CRITICAL)
    ]
    if high_dims:
        names = ", ".join(d.label for d in high_dims)
        evidence.append(f"Yüksek risk tespiti: {names}.")

    # Trajectory
    if trajectory in (TRAJ_RISING, TRAJ_SPIKE):
        evidence.append("Risk trendi yükseliyor — birden fazla boyutta bozulma sinyali tespit edildi.")
    elif trajectory == "declining":
        evidence.append("Risk trendi iyileşiyor — performans metrikleri pozitif yönde.")

    # Confidence-based note
    high_conf_dims = [d for d in dimensions.values() if d.confidence == CONF_HIGH]
    if high_conf_dims:
        evidence.append(f"{len(high_conf_dims)} boyutta yüksek güvenilirlik (6+ snapshot).")
    elif any(d.confidence == CONF_MEDIUM for d in dimensions.values()):
        evidence.append("Orta güvenilirlik — daha fazla snapshot daha güvenilir sonuç üretir.")

    # Overall score context
    if overall_score >= 80:
        evidence.append("Genel risk skoru KRİTİK eşiğinde — acil marka güvenliği değerlendirmesi önerilir.")
    elif overall_score >= 60:
        evidence.append("Genel risk skoru YÜKSEK — marka ortaklık öncesi detaylı inceleme önerilir.")

    return evidence


def build_limitations(
    snapshot_count: int,
    is_mock: bool,
    window_days: int,
) -> list[str]:
    limitations: list[str] = []

    if is_mock:
        limitations.append("[MOCK] Bu rapor gerçek veri içermemektedir. Tüm değerler sentetik ve deterministiktir.")

    limitations.append(
        "Risk analizi yönlendirici istihbarattır. Sistem siyasi kimlik, ideoloji, din veya "
        "korunan özellik çıkarımı yapmaz."
    )

    if snapshot_count < 3:
        limitations.append(
            f"Yalnızca {snapshot_count} snapshot mevcut. Minimum 3 snapshot analiz güvenilirliğini artırır."
        )

    if window_days < 60:
        limitations.append(
            f"Analiz penceresi {window_days} gün. 90+ günlük veri trend analizini güçlendirir."
        )

    limitations.append(
        "Tahmini harcama ve sponsorluk yoğunluğu doğrudan erişilebilir değildir; "
        "dolaylı sinyallerden çıkarılmaktadır."
    )

    limitations.append(
        "Creator'ın gerçek içerik metni, yorum analizi ve hashtag verisi mevcut olmadığında "
        "içerik bazlı risk boyutları hesaplanamamaktadır."
    )

    return limitations
