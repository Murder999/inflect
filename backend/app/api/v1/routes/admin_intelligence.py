"""
Admin Intelligence Billing Routes — Part 16

GET  /admin/intelligence/features          — list all features
PATCH /admin/intelligence/features/{slug}  — update feature config
GET  /admin/intelligence/usage             — usage logs (filterable)
GET  /admin/intelligence/summary           — aggregate stats per feature

User-facing:
GET  /intelligence/features/me             — features + costs for current user
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.intelligence_billing import IntelligenceFeature, IntelligenceUsageLog
from app.services.intelligence_billing import get_feature_cost

logger = logging.getLogger(__name__)

router = APIRouter(tags=["intelligence-billing"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class FeaturePatch(BaseModel):
    is_enabled:           Optional[bool] = None
    is_billable:          Optional[bool] = None
    free_for_admin:       Optional[bool] = None
    charge_on_failure:    Optional[bool] = None
    credit_cost:          Optional[int]  = Field(None, ge=0)
    limited_credit_cost:  Optional[int]  = Field(None, ge=0)
    standard_credit_cost: Optional[int]  = Field(None, ge=0)
    full_credit_cost:     Optional[int]  = Field(None, ge=0)
    allowed_plans:        Optional[list[str]] = None
    description:          Optional[str]  = None


# ─── Helper ───────────────────────────────────────────────────────────────────

def _feature_to_dict(f: IntelligenceFeature) -> dict:
    return {
        "id":                   f.id,
        "slug":                 f.slug,
        "name":                 f.name,
        "description":          f.description,
        "category":             f.category,
        "is_enabled":           f.is_enabled,
        "is_billable":          f.is_billable,
        "free_for_admin":       f.free_for_admin,
        "charge_on_failure":    f.charge_on_failure,
        "credit_cost":          f.credit_cost,
        "limited_credit_cost":  f.limited_credit_cost,
        "standard_credit_cost": f.standard_credit_cost,
        "full_credit_cost":     f.full_credit_cost,
        "allowed_plans":        f.allowed_plans,
        "updated_at":           f.updated_at.isoformat(),
    }


# ─── Admin endpoints ──────────────────────────────────────────────────────────

@router.get("/admin/intelligence/features")
async def list_features(
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")
    res = await db.execute(
        select(IntelligenceFeature).order_by(IntelligenceFeature.category, IntelligenceFeature.name)
    )
    features = list(res.scalars().all())
    return {"ok": True, "count": len(features), "features": [_feature_to_dict(f) for f in features]}


@router.patch("/admin/intelligence/features/{slug}")
async def update_feature(
    slug: str,
    body: FeaturePatch,
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    res = await db.execute(
        select(IntelligenceFeature).where(IntelligenceFeature.slug == slug)
    )
    feature = res.scalar_one_or_none()
    if not feature:
        raise HTTPException(status_code=404, detail=f"Feature '{slug}' bulunamadı.")

    data = body.model_dump(exclude_none=True)
    for key, value in data.items():
        setattr(feature, key, value)

    db.add(feature)
    await db.commit()
    await db.refresh(feature)
    return {"ok": True, "feature": _feature_to_dict(feature)}


@router.get("/admin/intelligence/usage")
async def get_usage_logs(
    user_id:      Optional[int] = Query(None),
    feature_slug: Optional[str] = Query(None),
    status:       Optional[str] = Query(None),
    limit:        int           = Query(50, ge=1, le=200),
    offset:       int           = Query(0, ge=0),
    db:           AsyncSession  = Depends(get_db),
    current_user: User          = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    q = select(IntelligenceUsageLog)
    if user_id:
        q = q.where(IntelligenceUsageLog.user_id == user_id)
    if feature_slug:
        q = q.where(IntelligenceUsageLog.feature_slug == feature_slug)
    if status:
        q = q.where(IntelligenceUsageLog.status == status)

    total_res = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_res.scalar() or 0

    res = await db.execute(
        q.order_by(desc(IntelligenceUsageLog.created_at)).offset(offset).limit(limit)
    )
    logs = list(res.scalars().all())

    return {
        "ok":    True,
        "total": total,
        "logs": [
            {
                "id":              l.id,
                "user_id":         l.user_id,
                "feature_slug":    l.feature_slug,
                "credits_charged": l.credits_charged,
                "report_mode":     l.report_mode,
                "status":          l.status,
                "failure_code":    l.failure_code,
                "created_at":      l.created_at.isoformat(),
                "metadata":        l.metadata_json,
            }
            for l in logs
        ],
    }


@router.get("/admin/intelligence/summary")
async def get_usage_summary(
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(get_current_user),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    res = await db.execute(
        select(
            IntelligenceUsageLog.feature_slug,
            IntelligenceUsageLog.status,
            func.count(IntelligenceUsageLog.id).label("count"),
            func.sum(IntelligenceUsageLog.credits_charged).label("total_credits"),
        ).group_by(
            IntelligenceUsageLog.feature_slug,
            IntelligenceUsageLog.status,
        )
    )
    rows = res.all()

    summary: dict[str, dict] = {}
    for row in rows:
        slug = row.feature_slug
        if slug not in summary:
            summary[slug] = {"feature_slug": slug, "total_uses": 0, "success": 0, "failed": 0, "total_credits": 0}
        summary[slug]["total_uses"] += row.count
        summary[slug]["total_credits"] += (row.total_credits or 0)
        if row.status == "success":
            summary[slug]["success"] += row.count
        elif row.status == "failed":
            summary[slug]["failed"] += row.count

    return {"ok": True, "summary": list(summary.values())}


# ─── User-facing ──────────────────────────────────────────────────────────────

@router.get("/intelligence/features/me")
async def my_feature_costs(
    db:   AsyncSession = Depends(get_db),
    user: User         = Depends(get_current_user),
):
    """Return available features and their effective credit costs for the current user."""
    res = await db.execute(
        select(IntelligenceFeature)
        .where(IntelligenceFeature.is_enabled == True)
        .order_by(IntelligenceFeature.category, IntelligenceFeature.name)
    )
    features = list(res.scalars().all())

    user_plan = user.plan.value if hasattr(user.plan, "value") else str(user.plan)
    result = []
    for f in features:
        # Plan access check
        if f.allowed_plans and user_plan not in f.allowed_plans and not user.is_admin:
            accessible = False
        else:
            accessible = True

        cost_dec = await get_feature_cost(db, user, f.slug, "standard")

        result.append({
            "slug":         f.slug,
            "name":         f.name,
            "category":     f.category,
            "accessible":   accessible,
            "is_billable":  f.is_billable,
            "credit_cost":  cost_dec.credit_cost,
            "is_free":      cost_dec.is_free,
            "costs": {
                "limited":  f.limited_credit_cost  if not cost_dec.is_free else 0,
                "standard": f.standard_credit_cost if not cost_dec.is_free else 0,
                "full":     f.full_credit_cost      if not cost_dec.is_free else 0,
            },
        })

    return {"ok": True, "user_plan": user_plan, "features": result}


# ── Provider Health Endpoints ─────────────────────────────────────────────────

@router.get("/admin/providers/health")
async def get_providers_health(
    current_user: User = Depends(get_current_user),
):
    """Admin only: configuration + connectivity status for all providers."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    from app.services.providers.health import get_all_provider_health, get_agents_mode
    results = get_all_provider_health()

    return {
        "ok":          True,
        "agents_mode": get_agents_mode(),
        "providers": [
            {
                "provider":        r.provider,
                "status":          r.status,
                "configured":      r.configured,
                "latency_ms":      r.latency_ms,
                "error":           r.error,
                "last_checked_at": r.last_checked_at,
                "notes":           r.notes,
            }
            for r in results
        ],
    }


@router.post("/admin/providers/test/{provider}")
async def test_provider(
    provider:     str,
    current_user: User = Depends(get_current_user),
):
    """Admin only: live connectivity test for a specific provider."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    from app.services.providers.health import test_provider_connectivity, PROVIDER_CHECKERS
    if provider not in PROVIDER_CHECKERS:
        raise HTTPException(
            status_code=404,
            detail=f"Bilinmeyen provider: '{provider}'. Geçerli: {', '.join(PROVIDER_CHECKERS.keys())}",
        )

    result = await test_provider_connectivity(provider)
    return {
        "ok":            True,
        "provider":      result.provider,
        "status":        result.status,
        "configured":    result.configured,
        "latency_ms":    result.latency_ms,
        "error":         result.error,
        "last_checked_at": result.last_checked_at,
        "notes":         result.notes,
    }
