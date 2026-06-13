"""
Admin Intelligence Billing Routes — Part 16 + Part 17 Migration Health

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


# ── Migration Health Endpoints (Part 17) ─────────────────────────────────────

# Expected Alembic head revision for Part 22
_EXPECTED_HEAD = "0006_part22_brand_ai"

# Critical tables that must exist for the application to function
_CRITICAL_TABLES = [
    "users", "analyses", "campaigns", "agents", "agent_tasks",
    "influencer_profiles", "influencer_snapshots",
    "influencer_digital_twins", "twin_forecasts",
    "competitor_profiles", "competitor_campaign_signals",
    "influencer_risk_reports", "risk_alerts", "risk_scan_logs",
    "intelligence_features", "intelligence_usage_logs",
]

# Critical indexes for performance
_CRITICAL_INDEXES = [
    ("risk_alerts", "ix_risk_alerts_status"),
    ("risk_alerts", "ix_risk_alerts_severity"),
    ("risk_alerts", "ix_risk_alerts_source"),
    ("influencer_risk_reports", "ix_influencer_risk_reports_profile_id"),
    ("intelligence_usage_logs", "ix_intelligence_usage_logs_feature_slug"),
]


@router.get("/admin/health/migrations")
async def get_migration_health(
    db:           AsyncSession  = Depends(get_db),
    current_user: User          = Depends(get_current_user),
):
    """
    Admin only: Alembic migration status and schema readiness.

    Returns:
      - current_revision   : currently applied Alembic revision (or null if none)
      - expected_head      : revision this application requires
      - is_up_to_date      : True when current == expected
      - missing_tables     : critical tables not found in DB
      - missing_indexes    : critical indexes not found in DB
      - schema_ready       : True when all critical tables and indexes exist
      - checked_at         : ISO timestamp of this check
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    from sqlalchemy import text, inspect
    from datetime import datetime, timezone

    checked_at = datetime.now(timezone.utc).isoformat()

    # ── 1. Read current Alembic revision ──────────────────────────────────────
    current_revision: Optional[str] = None
    alembic_table_exists = False
    try:
        rev_res = await db.execute(
            text("SELECT version_num FROM alembic_version LIMIT 1")
        )
        row = rev_res.fetchone()
        current_revision = row[0] if row else None
        alembic_table_exists = True
    except Exception:
        # alembic_version table doesn't exist → migrations never run
        current_revision = None
        alembic_table_exists = False

    # ── 2. Check critical tables ──────────────────────────────────────────────
    missing_tables: list[str] = []
    existing_tables: list[str] = []
    try:
        def _get_tables(conn):
            from sqlalchemy import inspect as sa_inspect
            insp = sa_inspect(conn)
            return insp.get_table_names()

        tables = await db.run_sync(_get_tables)
        for t in _CRITICAL_TABLES:
            if t in tables:
                existing_tables.append(t)
            else:
                missing_tables.append(t)
    except Exception as exc:
        logger.warning("Migration health: table check failed: %s", exc)
        missing_tables = _CRITICAL_TABLES[:]

    # ── 3. Check critical indexes ─────────────────────────────────────────────
    missing_indexes: list[dict] = []
    try:
        def _get_indexes(conn):
            from sqlalchemy import inspect as sa_inspect
            insp = sa_inspect(conn)
            result = {}
            for table in existing_tables:
                result[table] = [idx["name"] for idx in insp.get_indexes(table)]
            return result

        index_map = await db.run_sync(_get_indexes)
        for table, idx_name in _CRITICAL_INDEXES:
            if table not in index_map or idx_name not in index_map.get(table, []):
                missing_indexes.append({"table": table, "index": idx_name})
    except Exception as exc:
        logger.warning("Migration health: index check failed: %s", exc)

    is_up_to_date = (current_revision == _EXPECTED_HEAD)
    schema_ready  = (not missing_tables and not missing_indexes)

    return {
        "ok":               True,
        "current_revision": current_revision,
        "expected_head":    _EXPECTED_HEAD,
        "is_up_to_date":    is_up_to_date,
        "alembic_table_exists": alembic_table_exists,
        "missing_tables":   missing_tables,
        "missing_indexes":  missing_indexes,
        "schema_ready":     schema_ready,
        "existing_table_count": len(existing_tables),
        "checked_at":       checked_at,
        "action_required":  (
            None if (is_up_to_date and schema_ready)
            else (
                "Run: alembic upgrade head"
                if not is_up_to_date
                else "Schema has missing tables/indexes — check migration logs"
            )
        ),
    }


@router.get("/admin/health/scan-logs")
async def get_scan_logs(
    limit:        int  = Query(20, ge=1, le=100),
    db:           AsyncSession = Depends(get_db),
    current_user: User         = Depends(get_current_user),
):
    """Admin only: recent risk scan logs."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    from app.models.risk_radar import RiskScanLog
    from sqlalchemy import desc

    res = await db.execute(
        select(RiskScanLog).order_by(desc(RiskScanLog.started_at)).limit(limit)
    )
    logs = list(res.scalars().all())
    return {
        "ok":    True,
        "count": len(logs),
        "logs": [
            {
                "id":                 l.id,
                "started_at":         l.started_at.isoformat() if l.started_at else None,
                "completed_at":       l.completed_at.isoformat() if l.completed_at else None,
                "trigger_source":     l.trigger_source,
                "profiles_scanned":   l.profiles_scanned,
                "profiles_succeeded": l.profiles_succeeded,
                "profiles_failed":    l.profiles_failed,
                "alerts_created":     l.alerts_created,
                "alerts_updated":     l.alerts_updated,
                "error_message":      l.error_message,
            }
            for l in logs
        ],
    }


@router.post("/admin/risk-scan/trigger")
async def trigger_risk_scan(
    current_user: User = Depends(get_current_user),
):
    """Admin only: manually trigger a full risk scan immediately."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin yetkisi gereklidir.")

    from app.core.database import AsyncSessionLocal
    from app.services.risk_scan_scheduler import trigger_risk_scan_now

    try:
        summary = await trigger_risk_scan_now(AsyncSessionLocal)
        return {"ok": True, "summary": summary}
    except Exception as exc:
        logger.error("Manual risk scan trigger failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Tarama başlatılamadı: {exc}")
