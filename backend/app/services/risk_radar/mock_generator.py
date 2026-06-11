"""
Mock Generator — Part 15

Deterministic synthetic risk reports for MOCK mode.
Same input → same output (SHA-256 seeded). All outputs labeled [MOCK].
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Optional

from app.services.risk_radar.schemas import (
    RiskDimension, RiskReportResult, AnomalyEvent,
    DIM_FRAUD_ANOMALY, DIM_GROWTH_ANOMALY, DIM_ENGAGEMENT_QUALITY,
    DIM_BRAND_ALIGNMENT, DIM_VOLATILITY, DIM_SENTIMENT,
    DIMENSION_LABELS, score_to_level,
    CONF_LOW, CONF_MEDIUM, CONF_HIGH,
    TRAJ_DECLINING, TRAJ_STABLE, TRAJ_RISING, TRAJ_SPIKE,
    RISK_LOW, RISK_MEDIUM, RISK_HIGH, RISK_CRITICAL,
)


def _hash(text: str) -> int:
    return int(hashlib.sha256(text.encode()).hexdigest(), 16)


def _pick(seed: int, options: list):
    return options[seed % len(options)]


def _int_range(seed: int, lo: int, hi: int) -> int:
    return lo + (seed % (hi - lo + 1))


def generate_mock_report(
    profile_id: int,
    username: str,
    platform: str,
    category: Optional[str],
    window_days: int = 90,
) -> RiskReportResult:
    """Deterministic mock risk report. No random values — same creator → same output."""
    seed = _hash(f"{username}:{platform}".lower())

    # ── Dimension scores (deterministic) ──────────────────────────────────────
    dim_scores = {
        DIM_FRAUD_ANOMALY:      _int_range(seed >> 1, 5, 85),
        DIM_GROWTH_ANOMALY:     _int_range(seed >> 2, 5, 80),
        DIM_ENGAGEMENT_QUALITY: _int_range(seed >> 3, 5, 70),
        DIM_BRAND_ALIGNMENT:    _int_range(seed >> 4, 10, 75),
        DIM_VOLATILITY:         _int_range(seed >> 5, 5, 65),
        DIM_SENTIMENT:          _int_range(seed >> 6, 5, 60),
    }

    _trajectories = [TRAJ_STABLE, TRAJ_RISING, TRAJ_DECLINING, TRAJ_STABLE, TRAJ_STABLE]
    _confs        = [CONF_MEDIUM, CONF_LOW, CONF_MEDIUM, CONF_HIGH]

    dimensions: dict[str, RiskDimension] = {}
    for i, (name, score) in enumerate(dim_scores.items()):
        dimensions[name] = RiskDimension(
            name=name,
            label=DIMENSION_LABELS[name],
            score=score,
            level=score_to_level(score),
            trend=_pick(seed >> (i + 7), _trajectories),
            signals=[f"[MOCK] {DIMENSION_LABELS[name]} — deterministik örnek sinyal"],
            confidence=_pick(seed >> (i + 13), _confs),
        )

    # Composite
    from app.services.risk_radar.risk_scoring import compute_composite_score, compute_trajectory
    overall_score = compute_composite_score(dimensions)
    trajectory    = compute_trajectory([], dimensions)

    # Mock anomalies
    anomaly_events: list[AnomalyEvent] = []
    if dim_scores[DIM_GROWTH_ANOMALY] > 45:
        anomaly_events.append(AnomalyEvent(
            anomaly_type="growth_spike",
            description="[MOCK] Anormal büyüme spike'ı tespit edildi",
            severity="medium",
            period="[MOCK] 2026-03",
        ))

    return RiskReportResult(
        profile_id=profile_id,
        username=username,
        platform=platform,
        category=category,
        window_days=window_days,
        generated_at=datetime.now(timezone.utc),
        is_mock=True,
        overall_score=overall_score,
        overall_level=score_to_level(overall_score),
        risk_trajectory=trajectory,
        confidence=CONF_MEDIUM,
        snapshot_count=0,
        dimensions=dimensions,
        anomaly_events=anomaly_events,
        evidence_summary=[
            f"[MOCK] {username}@{platform} için deterministik mock rapor üretildi.",
            "[MOCK] Tüm skorlar SHA-256 hash bazlı sabittir — gerçek veri içermez.",
        ],
        limitations=[
            "[MOCK] Bu raporun tüm verisi sentetik ve eğitim amaçlıdır.",
            "Gerçek analiz için AGENTS_MODE=live ve archive'da yeterli snapshot verisi gereklidir.",
            "Sistem siyasi kimlik, ideoloji, din veya korunan özellik çıkarımı yapmaz.",
        ],
        note=(
            "[MOCK] Risk Radar raporu MOCK modunda üretildi. "
            "Gerçek davranışsal marka güvenliği analizi için archive snapshot verisi ve "
            "AGENTS_MODE=live gereklidir."
        ),
    )
