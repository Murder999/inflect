"""
Intelligence Billing Service — Part 16

Dynamic credit cost lookup and usage logging for all Intelligence features.
Nothing is hardcoded — all costs come from the IntelligenceFeature DB table.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intelligence_billing import (
    IntelligenceFeature, IntelligenceUsageLog, UsageStatus,
)
from app.models.user import User

logger = logging.getLogger(__name__)


# ─── Decision types ───────────────────────────────────────────────────────────

@dataclass
class FeatureCostDecision:
    feature_slug:  str
    credit_cost:   int
    is_billable:   bool
    is_free:       bool        # free for this user (admin / free feature)
    report_mode:   str = "standard"


@dataclass
class UsageDecision:
    can_use:     bool
    reason:      str            # ok | insufficient_credits | feature_disabled | plan_not_allowed
    credit_cost: int = 0
    is_free:     bool = False


# ─── Default feature configurations ───────────────────────────────────────────

DEFAULT_FEATURES = [
    {
        "slug": "risk_radar_scan",
        "name": "Risk Radar™ Tarama",
        "description": "Influencer risk analizi — fraud, anomaly, brand alignment, sentiment",
        "category": "risk",
        "credit_cost": 1,
        "limited_credit_cost": 1,
        "standard_credit_cost": 1,
        "full_credit_cost": 2,
        "allowed_plans": None,        # all plans
    },
    {
        "slug": "digital_twin_generate",
        "name": "Digital Twin™ Oluştur",
        "description": "Influencer davranış tahmini ve risk projeksiyonu",
        "category": "forecast",
        "credit_cost": 1,
        "limited_credit_cost": 1,
        "standard_credit_cost": 1,
        "full_credit_cost": 1,
        "allowed_plans": None,
    },
    {
        "slug": "digital_twin_refresh",
        "name": "Digital Twin™ Yenile",
        "description": "Mevcut Digital Twin'i güncelle",
        "category": "forecast",
        "credit_cost": 1,
        "limited_credit_cost": 1,
        "standard_credit_cost": 1,
        "full_credit_cost": 1,
        "allowed_plans": None,
    },
    {
        "slug": "competitor_report_generate",
        "name": "Competitor Intelligence™ Rapor",
        "description": "Rakip marka influencer analizi ve fırsat tespiti",
        "category": "competitive",
        "credit_cost": 1,
        "limited_credit_cost": 1,
        "standard_credit_cost": 1,
        "full_credit_cost": 2,
        "allowed_plans": ["starter", "pro", "business"],
    },
    {
        "slug": "brand_match_analysis",
        "name": "AI Brand Match™ Analizi",
        "description": "Marka DNA uyum analizi",
        "category": "brand",
        "credit_cost": 0,
        "limited_credit_cost": 0,
        "standard_credit_cost": 0,
        "full_credit_cost": 0,
        "is_billable": False,
        "allowed_plans": None,
    },
    {
        "slug": "campaign_intelligence_simulation",
        "name": "Campaign Intelligence Simülasyonu",
        "description": "Kampanya ROI ve erişim simülasyonu",
        "category": "campaign",
        "credit_cost": 0,
        "limited_credit_cost": 0,
        "standard_credit_cost": 0,
        "full_credit_cost": 0,
        "is_billable": False,
        "allowed_plans": None,
    },
]


# ─── Service functions ────────────────────────────────────────────────────────

async def get_feature_config(
    db: AsyncSession,
    feature_slug: str,
) -> Optional[IntelligenceFeature]:
    """Fetch feature config from DB. Returns None if not found."""
    res = await db.execute(
        select(IntelligenceFeature).where(
            IntelligenceFeature.slug == feature_slug
        )
    )
    return res.scalar_one_or_none()


async def get_feature_cost(
    db: AsyncSession,
    user: User,
    feature_slug: str,
    report_mode: str = "standard",
) -> FeatureCostDecision:
    """
    Determine effective credit cost for this user + feature + mode.
    Falls back to cost=1 if feature not found in DB.
    """
    feature = await get_feature_config(db, feature_slug)

    if feature is None:
        # Feature not seeded yet — safe default
        return FeatureCostDecision(
            feature_slug=feature_slug,
            credit_cost=1,
            is_billable=True,
            is_free=bool(user.is_admin),
            report_mode=report_mode,
        )

    if not feature.is_billable:
        return FeatureCostDecision(
            feature_slug=feature_slug,
            credit_cost=0,
            is_billable=False,
            is_free=True,
            report_mode=report_mode,
        )

    if feature.free_for_admin and user.is_admin:
        return FeatureCostDecision(
            feature_slug=feature_slug,
            credit_cost=0,
            is_billable=True,
            is_free=True,
            report_mode=report_mode,
        )

    cost_map = {
        "limited":  feature.limited_credit_cost,
        "standard": feature.standard_credit_cost,
        "full":     feature.full_credit_cost,
    }
    cost = cost_map.get(report_mode, feature.credit_cost)

    return FeatureCostDecision(
        feature_slug=feature_slug,
        credit_cost=cost,
        is_billable=True,
        is_free=False,
        report_mode=report_mode,
    )


async def can_use_feature(
    db: AsyncSession,
    user: User,
    feature_slug: str,
    report_mode: str = "standard",
) -> UsageDecision:
    """Check if user can use this feature right now."""
    feature = await get_feature_config(db, feature_slug)

    if feature is not None and not feature.is_enabled:
        return UsageDecision(can_use=False, reason="feature_disabled")

    if feature is not None and feature.allowed_plans:
        user_plan = user.plan.value if hasattr(user.plan, "value") else str(user.plan)
        if user_plan not in feature.allowed_plans and not user.is_admin:
            return UsageDecision(
                can_use=False,
                reason="plan_not_allowed",
            )

    cost_decision = await get_feature_cost(db, user, feature_slug, report_mode)

    if cost_decision.is_free or not cost_decision.is_billable:
        return UsageDecision(
            can_use=True,
            reason="ok",
            credit_cost=0,
            is_free=True,
        )

    if user.credits_remaining < cost_decision.credit_cost:
        return UsageDecision(
            can_use=False,
            reason="insufficient_credits",
            credit_cost=cost_decision.credit_cost,
        )

    return UsageDecision(
        can_use=True,
        reason="ok",
        credit_cost=cost_decision.credit_cost,
        is_free=False,
    )


async def charge_feature_usage(
    db: AsyncSession,
    user: User,
    feature_slug: str,
    credits: int,
    report_mode: str = "standard",
    metadata: Optional[dict] = None,
) -> IntelligenceUsageLog:
    """Deduct credits and log a successful usage."""
    if credits > 0:
        user.credits_remaining = max(0, user.credits_remaining - credits)
        db.add(user)

    log = IntelligenceUsageLog(
        user_id=user.id,
        feature_slug=feature_slug,
        credits_charged=credits,
        report_mode=report_mode,
        status=UsageStatus.SUCCESS,
        metadata_json=metadata or {},
    )
    db.add(log)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to write usage log: %s", exc)
    return log


async def record_failed_usage(
    db: AsyncSession,
    user: User,
    feature_slug: str,
    failure_code: str,
    metadata: Optional[dict] = None,
) -> IntelligenceUsageLog:
    """Log a failed usage WITHOUT charging credits."""
    log = IntelligenceUsageLog(
        user_id=user.id,
        feature_slug=feature_slug,
        credits_charged=0,
        status=UsageStatus.FAILED,
        failure_code=failure_code,
        metadata_json=metadata or {},
    )
    db.add(log)
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to write failure log: %s", exc)
    return log


# ─── Seeding ─────────────────────────────────────────────────────────────────

async def seed_intelligence_features(db: AsyncSession) -> None:
    """Ensure all default features exist in the DB. Idempotent."""
    for cfg in DEFAULT_FEATURES:
        slug = cfg["slug"]
        existing = await get_feature_config(db, slug)
        if existing is None:
            feature = IntelligenceFeature(
                slug=slug,
                name=cfg["name"],
                description=cfg.get("description"),
                category=cfg.get("category", "intelligence"),
                is_enabled=True,
                is_billable=cfg.get("is_billable", True),
                free_for_admin=True,
                charge_on_failure=False,
                credit_cost=cfg["credit_cost"],
                limited_credit_cost=cfg["limited_credit_cost"],
                standard_credit_cost=cfg["standard_credit_cost"],
                full_credit_cost=cfg["full_credit_cost"],
                allowed_plans=cfg.get("allowed_plans"),
            )
            db.add(feature)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
