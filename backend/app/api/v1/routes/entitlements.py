"""
Entitlement & Pricing Routes — Part 18

Public:
  GET  /pricing/plans                   — all plans with features (no auth)

Authenticated:
  GET  /entitlements/me                 — current user's feature access map
  GET  /entitlements/feature/{key}      — single feature access check
  POST /events/premium                  — conversion event tracking

Admin:
  GET  /admin/plans                     — plan list with features
  GET  /admin/plans/feature-matrix      — feature × plan matrix
  PUT  /admin/plans/{slug}/features     — update plan feature_keys
  PUT  /admin/plans/{slug}/limits       — update plan credits/price
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin
from app.models.admin_models import Package
from app.models.user import User
from app.services.entitlement_service import (
    check_feature_access,
    get_user_entitlements,
    get_locked_response_body,
    FEATURE_MIN_PLAN,
    FEATURE_COPY,
    PLAN_FEATURES,
)
from app.services.audit import log_action

router = APIRouter(tags=["entitlements"])
logger = logging.getLogger(__name__)


# ── Public plan / pricing data ─────────────────────────────────────────────────

PLAN_META: dict[str, dict] = {
    "free": {
        "name":            "Ücretsiz",
        "slug":            "free",
        "price_monthly":   0,
        "price_annual":    0,
        "price_annual_mo": 0,
        "credits":         5,
        "sort_order":      0,
        "badge":           None,
        "tagline":         "Platformu deneyin",
        "cta_label":       "Ücretsiz Başla",
        "cta_href":        "/register",
        "highlight":       False,
    },
    "starter": {
        "name":            "Starter",
        "slug":            "starter",
        "price_monthly":   4900,
        "price_annual":    46800,   # $39 × 12
        "price_annual_mo": 3900,
        "credits":         100,
        "sort_order":      1,
        "badge":           None,
        "tagline":         "Küçük işletme başlangıcı",
        "cta_label":       "İlk Analizlerini Aç",
        "cta_href":        "/register?plan=starter",
        "highlight":       False,
    },
    "pro": {
        "name":            "Pro",
        "slug":            "pro",
        "price_monthly":   14900,
        "price_annual":    142800,  # $119 × 12
        "price_annual_mo": 11900,
        "credits":         500,
        "sort_order":      2,
        "badge":           "En Popüler",
        "tagline":         "Ana satış paketi",
        "cta_label":       "Tüm İçgörüleri Aç",
        "cta_href":        "/register?plan=pro",
        "highlight":       True,
    },
    "agency": {
        "name":            "Agency",
        "slug":            "agency",
        "price_monthly":   39900,
        "price_annual":    358800,  # $299 × 12
        "price_annual_mo": 29900,
        "credits":         2000,
        "sort_order":      3,
        "badge":           "Ajanslar İçin",
        "tagline":         "Çoklu müşteri yönetimi",
        "cta_label":       "Ajans Panelini Başlat",
        "cta_href":        "/register?plan=agency",
        "highlight":       False,
    },
    "enterprise": {
        "name":            "Enterprise",
        "slug":            "enterprise",
        "price_monthly":   0,    # Custom
        "price_annual":    0,
        "price_annual_mo": 0,
        "credits":         -1,   # unlimited
        "sort_order":      4,
        "badge":           "Kurumsal",
        "tagline":         "Büyük marka & özel ihtiyaç",
        "cta_label":       "Demo Planla",
        "cta_href":        "/contact?plan=enterprise",
        "highlight":       False,
    },
}

FEATURE_DISPLAY: list[dict] = [
    {"key": "basic_analysis",          "label": "Temel Influencer Analizi"},
    {"key": "basic_profile_view",      "label": "Profil Görüntüleme"},
    {"key": "basic_risk_score",        "label": "Temel Risk Skoru"},
    {"key": "basic_brand_match",       "label": "Temel Marka Uyumu"},
    {"key": "archive_limited",         "label": "Arşiv Erişimi"},
    {"key": "campaign_roi_simulation", "label": "Kampanya ROI Simülasyonu"},
    {"key": "advanced_risk_radar",     "label": "Gelişmiş Risk Radar™"},
    {"key": "risk_evidence",           "label": "Risk Kanıtları & Anomaly Detayı"},
    {"key": "pdf_export",              "label": "PDF Rapor İndirme"},
    {"key": "watchlist_alerts",        "label": "İzleme Listesi Uyarıları"},
    {"key": "digital_twin_forecast",   "label": "Digital Twin™ Forecast"},
    {"key": "competitor_intelligence", "label": "Competitor Intelligence™"},
    {"key": "shareable_report",        "label": "Müşteri Rapor Bağlantısı"},
    {"key": "batch_analysis",          "label": "Toplu Analiz"},
    {"key": "scheduled_scan",          "label": "Zamanlanmış Risk Taraması"},
    {"key": "risk_alert_management",   "label": "Risk Alert Yönetimi"},
    {"key": "advanced_filters",        "label": "Gelişmiş Filtreler"},
    {"key": "team_workspace",          "label": "Ekip Çalışma Alanı"},
    {"key": "multi_client_workspace",  "label": "Multi-Client Workspace"},
    {"key": "white_label_reports",     "label": "White-Label Raporlar"},
    {"key": "priority_processing",     "label": "Öncelikli İşlem"},
    {"key": "api_access",              "label": "API Erişimi"},
]


def _plan_meta_with_features(slug: str) -> dict:
    meta = dict(PLAN_META.get(slug, {}))
    meta["feature_keys"] = PLAN_FEATURES.get(slug, [])
    return meta


@router.get("/pricing/plans")
async def get_pricing_plans(db: AsyncSession = Depends(get_db)):
    """
    Public endpoint — returns all plan metadata including features.
    Used by pricing page and upgrade modal.
    """
    ordered = sorted(PLAN_META.values(), key=lambda p: p["sort_order"])
    plans = []
    for pm in ordered:
        slug = pm["slug"]
        merged = dict(pm)

        # Merge DB pricing if available
        pkg_res = await db.execute(select(Package).where(Package.slug == slug))
        pkg = pkg_res.scalar_one_or_none()
        if pkg:
            merged["price_monthly"] = pkg.price_monthly
            merged["price_annual"]  = pkg.price_annual
            merged["credits"]       = pkg.credits
            if pkg.features and isinstance(pkg.features, dict):
                merged["feature_keys"] = pkg.features.get(
                    "feature_keys", PLAN_FEATURES.get(slug, [])
                )
            else:
                merged["feature_keys"] = PLAN_FEATURES.get(slug, [])
        else:
            merged["feature_keys"] = PLAN_FEATURES.get(slug, [])

        plans.append(merged)

    return {
        "ok":      True,
        "plans":   plans,
        "features": FEATURE_DISPLAY,
    }


# ── Authenticated: current user entitlements ──────────────────────────────────

@router.get("/entitlements/me")
async def get_my_entitlements(
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
):
    """Return complete feature access map for the authenticated user."""
    entitlements = await get_user_entitlements(db, user)
    return {
        "ok":           True,
        "plan":         user.plan.value if hasattr(user.plan, "value") else str(user.plan),
        "is_admin":     user.is_admin,
        "entitlements": entitlements,
    }


@router.get("/entitlements/feature/{feature_key}")
async def check_single_feature(
    feature_key: str,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
):
    """Check access to a single feature."""
    if feature_key not in FEATURE_MIN_PLAN:
        raise HTTPException(status_code=404, detail=f"Bilinmeyen özellik: {feature_key}")

    result = await check_feature_access(db, user, feature_key)
    if not result.allowed:
        return {
            "ok":      False,
            "allowed": False,
            **get_locked_response_body(result),
        }
    return {"ok": True, "allowed": True, "feature_key": feature_key}


# ── Conversion event tracking ─────────────────────────────────────────────────

class PremiumEventRequest(BaseModel):
    event_type:  str                    # e.g. "upgrade_modal_opened"
    feature_key: Optional[str] = None
    context:     Optional[dict] = None


@router.post("/events/premium")
async def track_premium_event(
    req:  PremiumEventRequest,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
):
    """Log a frontend conversion/engagement event for analytics."""
    ALLOWED_EVENTS = {
        "premium_locked_card_viewed", "premium_locked_card_clicked",
        "upgrade_modal_opened",       "upgrade_cta_clicked",
        "checkout_started",           "checkout_completed",
        "feature_blocked_by_plan",    "quota_limit_reached",
    }
    if req.event_type not in ALLOWED_EVENTS:
        raise HTTPException(status_code=400, detail=f"Geçersiz event: {req.event_type}")

    await log_action(
        db,
        action=req.event_type,
        user_id=user.id,
        resource_type="premium_event",
        details={
            "feature_key": req.feature_key,
            "plan":        user.plan.value if hasattr(user.plan, "value") else str(user.plan),
            **(req.context or {}),
        },
    )
    return {"ok": True}


# ── Admin: plan management ─────────────────────────────────────────────────────

@router.get("/admin/plans")
async def admin_list_plans(
    db:   AsyncSession = Depends(get_db),
    _:    User         = Depends(get_current_admin),
):
    """Admin: list all plans with current DB configuration."""
    pkgs_res = await db.execute(select(Package).order_by(Package.sort_order))
    pkgs = pkgs_res.scalars().all()
    return {
        "ok":    True,
        "plans": [
            {
                "id":                     p.id,
                "slug":                   p.slug,
                "name":                   p.name,
                "price_monthly":          p.price_monthly,
                "price_annual":           p.price_annual,
                "credits":                p.credits,
                "is_active":              p.is_active,
                "sort_order":             p.sort_order,
                "features":               p.features or {},
                "feature_keys":           (p.features or {}).get("feature_keys", PLAN_FEATURES.get(p.slug, [])),
                "stripe_price_id_monthly":p.stripe_price_id_monthly,
                "stripe_price_id_annual": p.stripe_price_id_annual,
            }
            for p in pkgs
        ],
    }


@router.get("/admin/plans/feature-matrix")
async def admin_feature_matrix(
    db: AsyncSession = Depends(get_db),
    _:  User         = Depends(get_current_admin),
):
    """Admin: feature × plan matrix for display and editing."""
    pkgs_res = await db.execute(select(Package).order_by(Package.sort_order))
    pkgs = pkgs_res.scalars().all()

    plan_feature_map: dict[str, list[str]] = {}
    for p in pkgs:
        fk = (p.features or {}).get("feature_keys", PLAN_FEATURES.get(p.slug, []))
        plan_feature_map[p.slug] = fk

    matrix = []
    for fd in FEATURE_DISPLAY:
        row = {"key": fd["key"], "label": fd["label"], "plans": {}}
        for p in pkgs:
            row["plans"][p.slug] = fd["key"] in plan_feature_map.get(p.slug, [])
        matrix.append(row)

    return {
        "ok":     True,
        "plans":  [{"slug": p.slug, "name": p.name} for p in pkgs],
        "matrix": matrix,
    }


class UpdatePlanFeaturesRequest(BaseModel):
    feature_keys: list[str]


@router.put("/admin/plans/{slug}/features")
async def admin_update_plan_features(
    slug: str,
    req:  UpdatePlanFeaturesRequest,
    db:   AsyncSession = Depends(get_db),
    admin: User        = Depends(get_current_admin),
):
    """Admin: update which feature_keys are enabled for a plan."""
    # Validate all keys
    unknown = [k for k in req.feature_keys if k not in FEATURE_MIN_PLAN]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Bilinmeyen özellik anahtarları: {unknown}")

    pkg_res = await db.execute(select(Package).where(Package.slug == slug))
    pkg = pkg_res.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Paket bulunamadı: {slug}")

    existing = dict(pkg.features or {})
    existing["feature_keys"] = req.feature_keys
    pkg.features = existing
    db.add(pkg)

    await log_action(db, "plan_features_updated", user_id=admin.id,
                     resource_type="package", resource_id=pkg.id,
                     details={"slug": slug, "feature_keys": req.feature_keys})
    await db.commit()

    return {"ok": True, "slug": slug, "feature_keys": req.feature_keys}


class UpdatePlanLimitsRequest(BaseModel):
    price_monthly:          Optional[int] = None
    price_annual:           Optional[int] = None
    credits:                Optional[int] = None
    stripe_price_id_monthly:Optional[str] = None
    stripe_price_id_annual: Optional[str] = None
    is_active:              Optional[bool] = None


@router.put("/admin/plans/{slug}/limits")
async def admin_update_plan_limits(
    slug:  str,
    req:   UpdatePlanLimitsRequest,
    db:    AsyncSession = Depends(get_db),
    admin: User         = Depends(get_current_admin),
):
    """Admin: update plan pricing and credit quota."""
    pkg_res = await db.execute(select(Package).where(Package.slug == slug))
    pkg = pkg_res.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail=f"Paket bulunamadı: {slug}")

    changes: dict = {}
    if req.price_monthly is not None:
        pkg.price_monthly = req.price_monthly;  changes["price_monthly"] = req.price_monthly
    if req.price_annual is not None:
        pkg.price_annual  = req.price_annual;   changes["price_annual"]  = req.price_annual
    if req.credits is not None:
        pkg.credits       = req.credits;        changes["credits"]       = req.credits
    if req.stripe_price_id_monthly is not None:
        pkg.stripe_price_id_monthly = req.stripe_price_id_monthly
        changes["stripe_price_id_monthly"] = req.stripe_price_id_monthly
    if req.stripe_price_id_annual is not None:
        pkg.stripe_price_id_annual = req.stripe_price_id_annual
        changes["stripe_price_id_annual"] = req.stripe_price_id_annual
    if req.is_active is not None:
        pkg.is_active = req.is_active;          changes["is_active"]     = req.is_active

    db.add(pkg)
    await log_action(db, "plan_limits_updated", user_id=admin.id,
                     resource_type="package", resource_id=pkg.id,
                     details={"slug": slug, **changes})
    await db.commit()

    return {"ok": True, "slug": slug, "changes": changes}
