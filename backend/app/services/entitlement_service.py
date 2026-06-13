"""
Entitlement Service — Part 18

Central feature-level access control.
Separates plan entitlement (which features) from quota (how many credits).

Usage in routes:
    from app.services.entitlement_service import require_feature
    @router.post("/endpoint")
    async def handler(user: User = Depends(require_feature("digital_twin_forecast")), ...):
        ...

The check order:
  1. Admin/superadmin → always allowed, bypass all plan gates.
  2. Load Package record for user's plan from DB.
  3. Check if feature_key is in Package.features["feature_keys"].
  4. If no Package record found, fall back to hardcoded FEATURE_MIN_PLAN map.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)


# ── Plan ordering ──────────────────────────────────────────────────────────────

PLAN_ORDER: dict[str, int] = {
    "free": 0, "starter": 1, "pro": 2, "business": 2,  # business = legacy pro
    "agency": 3, "enterprise": 4,
}

# ── Canonical feature definitions ────────────────────────────────────────────
# feature_key → minimum plan slug (fallback when Package DB record is missing)

FEATURE_MIN_PLAN: dict[str, str] = {
    # ─ Available to all ─
    "basic_analysis":          "free",
    "basic_profile_view":      "free",
    "basic_risk_score":        "free",
    "basic_brand_match":       "free",
    "archive_limited":         "free",
    # ─ Brand Match advanced (Part 22) ─
    "advanced_brand_match":    "pro",
    # ─ Starter+ ─
    "campaign_roi_simulation": "starter",
    # ─ Pro+ ─
    "advanced_risk_radar":     "pro",
    "risk_evidence":           "pro",
    "pdf_export":              "pro",
    "watchlist_alerts":        "pro",
    # ─ Agency+ ─
    "digital_twin_forecast":   "agency",
    "competitor_intelligence": "agency",
    "shareable_report":        "agency",
    "batch_analysis":          "agency",
    "scheduled_scan":          "agency",
    "risk_alert_management":   "agency",
    "advanced_filters":        "agency",
    "team_workspace":          "agency",
    "multi_client_workspace":  "agency",
    "white_label_reports":     "agency",
    "priority_processing":     "agency",
    # ─ Enterprise only ─
    "api_access":              "enterprise",
    # ─ Admin/system (plan-independent; admin-gated separately) ─
    "provider_health":         "free",
    "migration_health":        "free",
    "scan_logs":               "free",
    "admin_intelligence":      "free",
}

# ── Upgrade copy per feature ──────────────────────────────────────────────────

FEATURE_COPY: dict[str, dict[str, str]] = {
    "digital_twin_forecast": {
        "title":   "Digital Twin™ Forecast",
        "message": "90 günlük büyüme ve risk tahmini hazır. Davranış modelini görmek için Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "competitor_intelligence": {
        "title":   "Competitor Intelligence™",
        "message": "Rakip markaların influencer stratejisini görün ve fırsatları tespit edin. Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "advanced_risk_radar": {
        "title":   "Gelişmiş Risk Radar™",
        "message": "6 boyutlu derinlemesine risk analizi ve tarihsel anomaly tespiti için Pro paketine geçin.",
        "cta":     "Pro'ya Geç",
    },
    "risk_evidence": {
        "title":   "Risk Kanıtları",
        "message": "Kritik risk sinyallerinin detaylı kanıtlarını görmek için Pro paketine geçin.",
        "cta":     "Pro'ya Geç",
    },
    "pdf_export": {
        "title":   "PDF Rapor",
        "message": "Bu raporu PDF olarak indirin ve müşterinizle paylaşın. Pro paketine geçin.",
        "cta":     "Pro'ya Geç",
    },
    "shareable_report": {
        "title":   "Müşteri Rapor Bağlantısı",
        "message": "Müşterinizle paylaşılabilir rapor bağlantısı oluşturun. Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "batch_analysis": {
        "title":   "Toplu Analiz",
        "message": "Onlarca influencer'ı tek seferde tarayın ve karşılaştırın. Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "scheduled_scan": {
        "title":   "Zamanlanmış Tarama",
        "message": "Influencer portföyünüzü otomatik günlük izleyin. Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "watchlist_alerts": {
        "title":   "İzleme Uyarıları",
        "message": "Risk değişikliklerinde ve eşik aşımlarında anında uyarı alın. Pro paketine geçin.",
        "cta":     "Pro'ya Geç",
    },
    "campaign_roi_simulation": {
        "title":   "Kampanya ROI Simülasyonu",
        "message": "Kampanya ROI'nizi yayına almadan tahmin edin. Starter paketine geçin.",
        "cta":     "Starter'a Geç",
    },
    "api_access": {
        "title":   "API Erişimi",
        "message": "Inflect'i kendi sistemlerinize entegre edin. Enterprise paketine geçin.",
        "cta":     "Enterprise'a Geç",
    },
    "risk_alert_management": {
        "title":   "Risk Alert Yönetimi",
        "message": "Tüm portföyünüz için risk alertlerini yönetin. Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "team_workspace": {
        "title":   "Ekip Çalışma Alanı",
        "message": "Ekibinizle birlikte çalışın, analiz paylaşın. Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "white_label_reports": {
        "title":   "White-Label Raporlar",
        "message": "Kendi markanızla özelleştirilmiş müşteri raporları oluşturun. Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "advanced_filters": {
        "title":   "Gelişmiş Filtreler",
        "message": "Kategori, tier, risk skoru ve daha fazlası ile gelişmiş filtreleme. Agency paketine geçin.",
        "cta":     "Agency'ye Geç",
    },
    "pdf_export": {
        "title":   "PDF Export",
        "message": "Profesyonel PDF raporları indirin. Pro paketine geçin.",
        "cta":     "Pro'ya Geç",
    },
}


# ── Feature lists per plan (used for seed) ────────────────────────────────────

FREE_FEATURES: list[str] = [
    "basic_analysis", "basic_profile_view", "basic_risk_score",
    "basic_brand_match", "archive_limited",
]
STARTER_FEATURES: list[str] = FREE_FEATURES + ["campaign_roi_simulation"]
PRO_FEATURES: list[str] = STARTER_FEATURES + [
    "advanced_risk_radar", "risk_evidence", "pdf_export", "watchlist_alerts",
    "advanced_brand_match",
]
AGENCY_FEATURES: list[str] = PRO_FEATURES + [
    "digital_twin_forecast", "competitor_intelligence", "shareable_report",
    "batch_analysis", "scheduled_scan", "risk_alert_management",
    "advanced_filters", "team_workspace", "multi_client_workspace",
    "white_label_reports", "priority_processing",
]
ENTERPRISE_FEATURES: list[str] = AGENCY_FEATURES + ["api_access"]

PLAN_FEATURES: dict[str, list[str]] = {
    "free":       FREE_FEATURES,
    "starter":    STARTER_FEATURES,
    "pro":        PRO_FEATURES,
    "business":   PRO_FEATURES,   # legacy alias
    "agency":     AGENCY_FEATURES,
    "enterprise": ENTERPRISE_FEATURES,
}


# ── Result types ──────────────────────────────────────────────────────────────

@dataclass
class FeatureAccessResult:
    allowed:          bool
    feature_key:      str
    current_plan:     str
    required_plan:    str
    is_admin:         bool
    upgrade_title:    str = ""
    upgrade_message:  str = ""
    cta_label:        str = ""
    preview_available: bool = True


def _plan_slug(user: User) -> str:
    return user.plan.value if hasattr(user.plan, "value") else str(user.plan)


# ── Core check ────────────────────────────────────────────────────────────────

async def check_feature_access(
    db: AsyncSession,
    user: User,
    feature_key: str,
) -> FeatureAccessResult:
    """
    Check whether user can use feature_key.
    Admin bypass → always allowed.
    Otherwise: loads user's Package from DB; checks feature_keys list.
    Falls back to FEATURE_MIN_PLAN if Package not found.
    """
    from app.models.admin_models import Package   # local import avoids circular

    if user.is_admin:
        return FeatureAccessResult(
            allowed=True, feature_key=feature_key,
            current_plan=_plan_slug(user), required_plan="free",
            is_admin=True,
        )

    current_plan = _plan_slug(user)

    # Try to load Package from DB for admin-configurable overrides
    pkg_res = await db.execute(
        select(Package).where(Package.slug == current_plan)
    )
    pkg = pkg_res.scalar_one_or_none()

    if pkg and pkg.features and isinstance(pkg.features, dict):
        pkg_keys: list[str] = pkg.features.get("feature_keys", [])
        allowed = feature_key in pkg_keys
    else:
        # Fallback: hardcoded FEATURE_MIN_PLAN
        required_plan = FEATURE_MIN_PLAN.get(feature_key, "free")
        current_order  = PLAN_ORDER.get(current_plan, 0)
        required_order = PLAN_ORDER.get(required_plan, 0)
        allowed = current_order >= required_order

    required_plan_fallback = FEATURE_MIN_PLAN.get(feature_key, "free")
    copy = FEATURE_COPY.get(feature_key, {})

    return FeatureAccessResult(
        allowed=allowed,
        feature_key=feature_key,
        current_plan=current_plan,
        required_plan=required_plan_fallback,
        is_admin=False,
        upgrade_title=copy.get("title", feature_key.replace("_", " ").title()),
        upgrade_message=copy.get(
            "message",
            f"Bu özellik {required_plan_fallback} paketi veya üstünü gerektirir.",
        ),
        cta_label=copy.get("cta", "Paketi Yükselt"),
        preview_available=True,
    )


def get_locked_response_body(result: FeatureAccessResult) -> dict:
    """Standard FEATURE_LOCKED response body for HTTP 403 responses."""
    return {
        "error_code":       "FEATURE_LOCKED",
        "feature_key":      result.feature_key,
        "required_plan":    result.required_plan,
        "current_plan":     result.current_plan,
        "upgrade_title":    result.upgrade_title,
        "upgrade_message":  result.upgrade_message,
        "preview_available": result.preview_available,
        "cta_label":        result.cta_label,
        "cta_url":          "/pricing",
    }


async def get_user_entitlements(db: AsyncSession, user: User) -> dict[str, bool]:
    """Return {feature_key: allowed} for every known feature."""
    results: dict[str, bool] = {}
    for key in FEATURE_MIN_PLAN:
        r = await check_feature_access(db, user, key)
        results[key] = r.allowed
    return results


# ── FastAPI dependency factory ────────────────────────────────────────────────

def require_feature(feature_key: str):
    """
    Factory that returns a FastAPI dependency.
    Raises 403 with FEATURE_LOCKED detail if the user's plan does not include
    feature_key. Admin users always pass.

    Usage:
        @router.post("/my-endpoint")
        async def handler(
            _user: User = Depends(require_feature("digital_twin_forecast")),
            user:  User = Depends(get_current_user),
            db:    AsyncSession = Depends(get_db),
        ):
    """
    async def _dep(
        db:   AsyncSession = Depends(get_db),
        user: User         = Depends(get_current_user),
    ) -> User:
        result = await check_feature_access(db, user, feature_key)
        if not result.allowed:
            raise HTTPException(
                status_code=403,
                detail=get_locked_response_body(result),
            )
        return user

    return _dep
