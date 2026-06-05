import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.user import User, PlanType
from app.models.analysis import Analysis
from app.models.campaign import Campaign
from app.models.admin_models import AuditLog, SupportTicket, Package, Payment
from app.services.audit import log_action

router = APIRouter(prefix="/admin", tags=["admin"])

# ─── Plan fiyatları (USD cents) ───
PLAN_PRICES = {"free": 0, "starter": 2900, "pro": 7900, "business": 19900}
# ─── Tahmini analiz başı API maliyeti (USD cents) ───
API_COST_PER_ANALYSIS = {"youtube": 0.2, "instagram": 0.5, "tiktok": 0.5, "avg": 0.4}


class CreditUpdate(BaseModel):
    credits: int
    action: str = "add"   # add / set / subtract

class PlanUpdate(BaseModel):
    plan: str
    credits_total: Optional[int] = None


# ──────────────────── 1. Global Dashboard ────────────────────

@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    total_users   = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users  = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar() or 0
    total_analyses = (await db.execute(select(func.count(Analysis.id)))).scalar() or 0
    total_campaigns = (await db.execute(select(func.count(Campaign.id)))).scalar() or 0
    total_credits_used = (await db.execute(select(func.sum(User.credits_total - User.credits_remaining)))).scalar() or 0

    # Plan breakdown
    plan_q = await db.execute(select(User.plan, func.count(User.id)).group_by(User.plan))
    plans = {(r[0].value if hasattr(r[0], "value") else str(r[0])): r[1] for r in plan_q.all()}

    # MRR hesaplama
    mrr_cents = sum(PLAN_PRICES.get(plan, 0) * count for plan, count in plans.items())
    mrr = round(mrr_cents / 100, 2)
    arr = round(mrr * 12, 2)

    # API maliyet tahmini
    plat_q = await db.execute(
        select(Analysis.platform, func.count(Analysis.id)).group_by(Analysis.platform)
    )
    plat_data = {(r[0].value if hasattr(r[0], "value") else str(r[0])): r[1] for r in plat_q.all()}
    total_api_cost = sum(API_COST_PER_ANALYSIS.get(p, 0.4) * c for p, c in plat_data.items()) / 100  # USD

    # Platform stats
    platforms = {(r[0].value if hasattr(r[0], "value") else str(r[0])): r[1] for r in plat_q.all()}

    # Bu ay
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.created_at >= month_start)
    )).scalar() or 0

    # New users this month
    new_users = (await db.execute(
        select(func.count(User.id)).where(User.created_at >= month_start)
    )).scalar() or 0

    return {
        "total_users":        total_users,
        "active_users":       active_users,
        "new_users_month":    new_users,
        "total_analyses":     total_analyses,
        "this_month_analyses": this_month,
        "total_campaigns":    total_campaigns,
        "total_credits_used": total_credits_used,
        "plans":              plans,
        "platforms":          platforms,
        "mrr":                mrr,
        "arr":                arr,
        "estimated_revenue":  mrr,
        "estimated_api_cost": round(total_api_cost, 2),
        "estimated_net":      round(mrr - total_api_cost, 2),
    }


# ──────────────────── 2. Customer Management ────────────────────

@router.get("/users")
async def admin_users(
    limit: int = 50, offset: int = 0,
    search: Optional[str] = None,
    plan: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    q = select(User).order_by(User.created_at.desc())
    count_q = select(func.count(User.id))
    if search:
        term = f"%{search}%"
        filt = (User.email.ilike(term)) | (User.full_name.ilike(term)) | (User.company.ilike(term))
        q = q.where(filt)
        count_q = count_q.where(filt)
    if plan:
        try:
            q = q.where(User.plan == PlanType(plan))
            count_q = count_q.where(User.plan == PlanType(plan))
        except ValueError:
            pass
    total = (await db.execute(count_q)).scalar() or 0
    result = await db.execute(q.limit(limit).offset(offset))
    now = datetime.now(timezone.utc)
    users = []
    for u in result.scalars().all():
        a_count = (await db.execute(select(func.count(Analysis.id)).where(Analysis.user_id == u.id))).scalar() or 0
        credits_used = u.credits_total - u.credits_remaining
        credits_pct  = (credits_used / max(u.credits_total, 1)) * 100

        # Health score
        health = _calc_health_score(u, a_count, now)
        # Churn risk
        churn_risk, churn_reason = _calc_churn_risk(u, a_count, now)

        users.append({
            "id": u.id, "email": u.email,
            "full_name": u.full_name, "company": u.company,
            "plan": u.plan.value if hasattr(u.plan, "value") else str(u.plan),
            "credits_remaining": u.credits_remaining, "credits_total": u.credits_total,
            "credits_used": credits_used, "credits_pct": round(credits_pct, 1),
            "is_active": u.is_active, "is_admin": u.is_admin,
            "analyses_count": a_count,
            "health_score": health,
            "churn_risk": churn_risk, "churn_reason": churn_reason,
            "created_at": u.created_at.isoformat() if u.created_at else "",
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        })

    total_q = select(func.count(User.id))
    if search:
        term2 = f"%{search}%"
        total_q = total_q.where(
            (User.email.ilike(term2)) | (User.full_name.ilike(term2)) | (User.company.ilike(term2))
        )
    if plan:
        try: total_q = total_q.where(User.plan == PlanType(plan))
        except ValueError: pass
    total = (await db.execute(total_q)).scalar() or 0
    return {"users": users, "total": total}


def _calc_health_score(u: User, analyses: int, now: datetime) -> int:
    score = 50
    # Credits kullanımı
    used_pct = (u.credits_total - u.credits_remaining) / max(u.credits_total, 1) * 100
    if used_pct > 80:   score += 25
    elif used_pct > 40: score += 10
    # Son giriş
    if u.last_login_at:
        days = (now - u.last_login_at.replace(tzinfo=timezone.utc) if u.last_login_at.tzinfo is None else now - u.last_login_at).days
        if days < 3:    score += 20
        elif days < 14: score += 10
        elif days > 30: score -= 20
    # Analiz sayısı
    if analyses > 10:  score += 10
    elif analyses < 2: score -= 10
    # Aktif mi?
    if not u.is_active: score -= 50
    return max(0, min(100, score))


def _calc_churn_risk(u: User, analyses: int, now: datetime) -> tuple[str, str]:
    if not u.is_active:
        return "critical", "Hesap askıya alınmış"
    if u.last_login_at:
        days = (now - (u.last_login_at.replace(tzinfo=timezone.utc) if u.last_login_at.tzinfo is None else u.last_login_at)).days
        if days > 30:  return "high",   f"{days} gündür giriş yok"
        if days > 14:  return "medium", f"{days} gündür giriş yok"
    used_pct = (u.credits_total - u.credits_remaining) / max(u.credits_total, 1) * 100
    if used_pct < 10 and analyses < 2:
        return "medium", "Çok düşük kullanım"
    return "low", "Normal kullanım"


@router.post("/users/{user_id}/credits")
async def update_credits(
    user_id: int, body: CreditUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    old_credits = target.credits_remaining
    if body.action == "add":
        target.credits_remaining += body.credits
        target.credits_total     += body.credits
    elif body.action == "subtract":
        target.credits_remaining = max(0, target.credits_remaining - body.credits)
    elif body.action == "set":
        target.credits_remaining = body.credits
        target.credits_total = max(target.credits_total, body.credits)

    await log_action(db, "credit_updated", user_id=user_id, admin_id=admin.id,
                     resource_type="user", resource_id=user_id,
                     details={"action": body.action, "amount": body.credits, "old": old_credits, "new": target.credits_remaining},
                     ip_address=request.client.host if request.client else None)
    await db.flush()
    return {"success": True, "credits_remaining": target.credits_remaining, "credits_total": target.credits_total}


@router.post("/users/{user_id}/plan")
async def update_plan(
    user_id: int, body: PlanUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    old_plan = target.plan.value if hasattr(target.plan, "value") else str(target.plan)
    credits_map = {"free": 5, "starter": 50, "pro": 200, "business": 1000}
    try:
        target.plan = PlanType(body.plan)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Geçersiz plan: {body.plan}")

    new_credits = body.credits_total or credits_map.get(body.plan, 5)
    target.credits_total = new_credits
    target.credits_remaining = new_credits

    await log_action(db, "plan_changed", user_id=user_id, admin_id=admin.id,
                     details={"old_plan": old_plan, "new_plan": body.plan, "credits": new_credits},
                     ip_address=request.client.host if request.client else None)
    await db.flush()
    return {"success": True, "plan": body.plan, "credits_total": new_credits}


@router.post("/users/{user_id}/toggle")
async def toggle_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı değiştiremezsiniz.")

    target.is_active = not target.is_active
    await log_action(db, "user_toggled", user_id=user_id, admin_id=admin.id,
                     details={"is_active": target.is_active},
                     ip_address=request.client.host if request.client else None)
    await db.flush()
    return {"success": True, "is_active": target.is_active}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    target = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz.")

    email = target.email
    await log_action(db, "user_deleted", admin_id=admin.id, details={"email": email},
                     ip_address=request.client.host if request.client else None)
    await db.delete(target)
    return {"success": True}


# ──────────────────── 5. Customer Intelligence ────────────────────

@router.get("/customer-intelligence")
async def customer_intelligence(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.is_active == True).limit(100))
    now = datetime.now(timezone.utc)
    users = result.scalars().all()

    intel = []
    for u in users:
        a_count = (await db.execute(select(func.count(Analysis.id)).where(Analysis.user_id == u.id))).scalar() or 0
        plat_q = await db.execute(
            select(Analysis.platform, func.count(Analysis.id))
            .where(Analysis.user_id == u.id).group_by(Analysis.platform).order_by(func.count(Analysis.id).desc())
        )
        top_platform = next(iter({(r[0].value if hasattr(r[0], "value") else str(r[0])): r[1] for r in plat_q.all()}), None)

        health = _calc_health_score(u, a_count, now)
        churn_risk, churn_reason = _calc_churn_risk(u, a_count, now)
        credits_used = u.credits_total - u.credits_remaining
        days_since_login = None
        if u.last_login_at:
            ll = u.last_login_at.replace(tzinfo=timezone.utc) if u.last_login_at.tzinfo is None else u.last_login_at
            days_since_login = (now - ll).days

        intel.append({
            "user_id": u.id, "email": u.email,
            "full_name": u.full_name, "company": u.company,
            "plan": u.plan.value if hasattr(u.plan, "value") else str(u.plan),
            "health_score": health, "churn_risk": churn_risk, "churn_reason": churn_reason,
            "analyses_count": a_count, "top_platform": top_platform,
            "credits_used": credits_used, "credits_total": u.credits_total,
            "days_since_login": days_since_login,
        })

    intel.sort(key=lambda x: x["health_score"])
    return {"users": intel, "total": len(intel)}


# ──────────────────── 6. Churn Prediction ────────────────────

@router.get("/churn-risks")
async def churn_risks(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(User).where(User.is_active == True))
    now = datetime.now(timezone.utc)
    at_risk = []

    for u in result.scalars().all():
        a_count = (await db.execute(select(func.count(Analysis.id)).where(Analysis.user_id == u.id))).scalar() or 0
        churn_risk, reason = _calc_churn_risk(u, a_count, now)
        if churn_risk in ("high", "critical", "medium"):
            days_since = None
            if u.last_login_at:
                ll = u.last_login_at.replace(tzinfo=timezone.utc) if u.last_login_at.tzinfo is None else u.last_login_at
                days_since = (now - ll).days
            at_risk.append({
                "user_id": u.id, "email": u.email,
                "full_name": u.full_name,
                "plan": u.plan.value if hasattr(u.plan, "value") else str(u.plan),
                "churn_risk": churn_risk, "reason": reason,
                "days_since_login": days_since,
                "analyses_count": a_count,
            })

    priority = {"critical": 0, "high": 1, "medium": 2}
    at_risk.sort(key=lambda x: priority.get(x["churn_risk"], 3))
    return {"at_risk": at_risk, "total": len(at_risk)}


# ──────────────────── 7. API Cost Center ────────────────────

@router.get("/cost-center")
async def cost_center(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    plat_q = await db.execute(
        select(Analysis.platform, func.count(Analysis.id)).group_by(Analysis.platform)
    )
    plat_data = {(r[0].value if hasattr(r[0], "value") else str(r[0])): r[1] for r in plat_q.all()}

    total_analyses = sum(plat_data.values())
    breakdown = {}
    total_cost = 0.0
    for plat, count in plat_data.items():
        cost_per = API_COST_PER_ANALYSIS.get(plat, 0.4)
        cost = count * cost_per / 100
        breakdown[plat] = {"analyses": count, "cost_per_analysis_cents": cost_per, "total_cost_usd": round(cost, 4)}
        total_cost += cost

    # User count for per-user cost
    user_count = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar() or 1

    return {
        "breakdown": breakdown,
        "total_analyses": total_analyses,
        "total_cost_usd": round(total_cost, 4),
        "cost_per_analysis_usd": round(total_cost / max(total_analyses, 1), 4),
        "cost_per_user_usd": round(total_cost / user_count, 4),
        "estimated_monthly_cost": round(total_cost, 2),
        "note": "Tahminler platform başı ortalama API maliyetine dayanır. Gerçek maliyet API faturanızda görünür.",
        "providers": {
            "youtube": {"cost_per_call_cents": 0.2, "description": "YouTube Data API v3"},
            "instagram": {"cost_per_call_cents": 0.5, "description": "Apify Instagram actor"},
            "tiktok": {"cost_per_call_cents": 0.5, "description": "Apify TikTok actor"},
        },
    }


# ──────────────────── 8. Provider Health Check ────────────────────

@router.get("/health-check")
async def provider_health(
    admin: User = Depends(get_current_admin),
):
    from app.core.config import settings
    providers = {}

    # YouTube API
    yt_key = settings.YOUTUBE_API_KEY
    if yt_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    "https://www.googleapis.com/youtube/v3/videos",
                    params={"part": "id", "chart": "mostPopular", "maxResults": 1, "key": yt_key},
                )
            providers["youtube"] = {"status": "healthy" if r.status_code == 200 else "warning", "code": r.status_code, "message": "API key geçerli" if r.status_code == 200 else f"HTTP {r.status_code}"}
        except Exception as e:
            providers["youtube"] = {"status": "down", "message": str(e)[:100]}
    else:
        providers["youtube"] = {"status": "not_configured", "message": "API key girilmemiş"}

    # Apify
    apify_token = settings.APIFY_TOKEN
    if apify_token:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get("https://api.apify.com/v2/users/me", params={"token": apify_token})
            providers["apify"] = {"status": "healthy" if r.status_code == 200 else "warning", "code": r.status_code, "message": "Token geçerli" if r.status_code == 200 else f"HTTP {r.status_code}"}
        except Exception as e:
            providers["apify"] = {"status": "down", "message": str(e)[:100]}
    else:
        providers["apify"] = {"status": "not_configured", "message": "Token girilmemiş"}

    # Stripe
    stripe_key = settings.STRIPE_SECRET_KEY
    if stripe_key and not stripe_key.startswith("sk_test_placeholder"):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5, headers={"Authorization": f"Bearer {stripe_key}"}) as client:
                r = await client.get("https://api.stripe.com/v1/balance")
            providers["stripe"] = {"status": "healthy" if r.status_code == 200 else "warning", "message": "Bağlantı başarılı" if r.status_code == 200 else f"HTTP {r.status_code}"}
        except Exception as e:
            providers["stripe"] = {"status": "down", "message": str(e)[:100]}
    else:
        providers["stripe"] = {"status": "not_configured", "message": "API key girilmemiş veya test placeholder"}

    # Database — her zaman çalışıyor (bu endpoint'e ulaştıysa)
    providers["database"] = {"status": "healthy", "message": "PostgreSQL bağlantısı aktif"}
    providers["redis"]    = {"status": "not_tested", "message": "Redis test edilmedi (aktif kullanımda değil)"}

    # OpenAI
    openai_key = getattr(settings, "OPENAI_API_KEY", "")
    if openai_key and not openai_key.startswith("change"):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {openai_key}"},
                )
            providers["openai"] = {
                "status": "healthy" if r.status_code == 200 else "warning",
                "code": r.status_code,
                "message": "API key geçerli" if r.status_code == 200 else f"HTTP {r.status_code}",
            }
        except Exception as e:
            providers["openai"] = {"status": "down", "message": str(e)[:100]}
    else:
        providers["openai"] = {"status": "not_configured", "message": "OPENAI_API_KEY girilmemiş"}

    # Anthropic Claude
    claude_key = getattr(settings, "ANTHROPIC_API_KEY", "")
    if claude_key and not claude_key.startswith("change"):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": claude_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={"model": "claude-3-haiku-20240307", "max_tokens": 1,
                          "messages": [{"role": "user", "content": "ping"}]},
                )
            providers["claude"] = {
                "status": "healthy" if r.status_code == 200 else "warning",
                "code": r.status_code,
                "message": "API key geçerli" if r.status_code == 200 else f"HTTP {r.status_code}",
            }
        except Exception as e:
            providers["claude"] = {"status": "down", "message": str(e)[:100]}
    else:
        providers["claude"] = {"status": "not_configured", "message": "ANTHROPIC_API_KEY girilmemiş"}

    # DeepSeek
    deepseek_key = getattr(settings, "DEEPSEEK_API_KEY", "")
    if deepseek_key and not deepseek_key.startswith("change"):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get(
                    "https://api.deepseek.com/v1/models",
                    headers={"Authorization": f"Bearer {deepseek_key}"},
                )
            providers["deepseek"] = {
                "status": "healthy" if r.status_code == 200 else "warning",
                "code": r.status_code,
                "message": "API key geçerli" if r.status_code == 200 else f"HTTP {r.status_code}",
            }
        except Exception as e:
            providers["deepseek"] = {"status": "down", "message": str(e)[:100]}
    else:
        providers["deepseek"] = {"status": "not_configured", "message": "DEEPSEEK_API_KEY girilmemiş"}

    overall = "healthy"
    if any(p.get("status") == "down" for p in providers.values()):
        overall = "degraded"
    elif any(p.get("status") == "warning" for p in providers.values()):
        overall = "warning"

    return {"overall": overall, "providers": providers}


# ──────────────────── 9. Queue Monitor ────────────────────

@router.get("/queue-monitor")
async def queue_monitor(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    now = datetime.now(timezone.utc)
    last_hour = now - timedelta(hours=1)
    last_day  = now - timedelta(days=1)

    recent_hour = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.created_at >= last_hour)
    )).scalar() or 0
    recent_day = (await db.execute(
        select(func.count(Analysis.id)).where(Analysis.created_at >= last_day)
    )).scalar() or 0
    total = (await db.execute(select(func.count(Analysis.id)))).scalar() or 0

    # Son 10 analiz
    recent_q = await db.execute(
        select(Analysis).order_by(Analysis.created_at.desc()).limit(10)
    )
    recent = []
    for a in recent_q.scalars().all():
        recent.append({
            "id": a.id, "username": a.username,
            "platform": a.platform.value if hasattr(a.platform, "value") else str(a.platform),
            "final_score": a.final_score,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        })

    return {
        "status": "operational",
        "recent_hour": recent_hour,
        "recent_day": recent_day,
        "total_processed": total,
        "avg_per_day": round(total / max((datetime.now(timezone.utc) - datetime(2024, 1, 1, tzinfo=timezone.utc)).days, 1), 2),
        "recent_analyses": recent,
        "note": "Kuyruk sistemi gerçek zamanlı değil. Analizler senkron işlenir.",
    }


# ──────────────────── 10. Credit Abuse Detection ────────────────────

@router.get("/abuse-detection")
async def abuse_detection(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    now = datetime.now(timezone.utc)
    last_day  = now - timedelta(days=1)
    last_hour = now - timedelta(hours=1)
    alerts = []

    # Saatte çok fazla analiz yapan kullanıcılar (> 10)
    heavy_q = await db.execute(
        select(Analysis.user_id, func.count(Analysis.id).label("cnt"))
        .where(Analysis.created_at >= last_hour)
        .group_by(Analysis.user_id)
        .having(func.count(Analysis.id) > 10)
    )
    for row in heavy_q.all():
        u = (await db.execute(select(User).where(User.id == row[0]))).scalar_one_or_none()
        if u:
            alerts.append({
                "type": "high_volume", "severity": "warning",
                "user_id": row[0], "email": u.email,
                "message": f"Son 1 saatte {row[1]} analiz yapıldı",
                "count": row[1],
            })

    # Aynı kullanıcı adını tekrar tekrar analiz eden kullanıcılar
    repeat_q = await db.execute(
        select(Analysis.user_id, Analysis.username, func.count(Analysis.id).label("cnt"))
        .where(Analysis.created_at >= last_day)
        .group_by(Analysis.user_id, Analysis.username)
        .having(func.count(Analysis.id) >= 5)
    )
    for row in repeat_q.all():
        u = (await db.execute(select(User).where(User.id == row[0]))).scalar_one_or_none()
        if u:
            alerts.append({
                "type": "repeat_analysis", "severity": "info",
                "user_id": row[0], "email": u.email,
                "message": f"@{row[1]} son 24 saatte {row[2]} kez analiz edildi",
                "count": row[2], "username": row[1],
            })

    return {"alerts": alerts, "total": len(alerts), "scanned_period_hours": 24}


# ──────────────────── 11. Support Tickets ────────────────────

@router.get("/tickets")
async def admin_tickets(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    q = select(SupportTicket).order_by(SupportTicket.updated_at.desc())
    if status:
        q = q.where(SupportTicket.status == status)
    result = await db.execute(q.limit(100))
    tickets = []
    for t in result.scalars().all():
        u = (await db.execute(select(User).where(User.id == t.user_id))).scalar_one_or_none()
        tickets.append({
            "id": t.id, "subject": t.subject,
            "status": t.status, "priority": t.priority, "category": t.category,
            "messages_count": len(t.messages or []),
            "user_email": u.email if u else None,
            "user_name": u.full_name if u else None,
            "created_at": t.created_at.isoformat() if t.created_at else "",
            "updated_at": t.updated_at.isoformat() if t.updated_at else "",
        })
    count = (await db.execute(select(func.count(SupportTicket.id)))).scalar() or 0
    return {"tickets": tickets, "total": count}


@router.patch("/tickets/{ticket_id}")
async def admin_update_ticket(
    ticket_id: int, status: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    t = (await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket bulunamadı.")
    t.status = status
    await db.flush()
    return {"success": True, "status": status}


@router.post("/tickets/{ticket_id}/reply")
async def admin_reply_ticket(
    ticket_id: int,
    message: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    t = (await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Ticket bulunamadı.")
    msgs = list(t.messages or [])
    msgs.append({
        "sender": "admin", "sender_name": admin.full_name or "Admin",
        "message": message, "created_at": datetime.now(timezone.utc).isoformat()
    })
    t.messages = msgs
    t.status = "in_progress"
    await db.flush()
    return {"success": True}


# ──────────────────── 12. Audit Logs ────────────────────

@router.get("/audit-logs")
async def audit_logs(
    limit: int = 50, offset: int = 0,
    action: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    if action:
        q = q.where(AuditLog.action == action)
    result = await db.execute(q)
    logs = []
    for log in result.scalars().all():
        u = None
        if log.user_id:
            u = (await db.execute(select(User).where(User.id == log.user_id))).scalar_one_or_none()
        a = None
        if log.admin_id and log.admin_id != log.user_id:
            a = (await db.execute(select(User).where(User.id == log.admin_id))).scalar_one_or_none()
        logs.append({
            "id": log.id, "action": log.action,
            "user_email": u.email if u else None,
            "admin_email": a.email if a else None,
            "resource_type": log.resource_type, "resource_id": log.resource_id,
            "details": log.details, "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else "",
        })
    count = (await db.execute(select(func.count(AuditLog.id)))).scalar() or 0
    return {"logs": logs, "total": count}


# ──────────────────── Package Manager ────────────────────

class PackageCreateRequest(BaseModel):
    slug: str
    name: str
    price_monthly: int
    price_annual: int
    credits: int
    features: Optional[dict] = None
    is_active: bool = True
    sort_order: int = 0


@router.get("/packages")
async def admin_packages(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(select(Package).order_by(Package.sort_order))
    pkgs = result.scalars().all()
    return {"packages": [_pkg_dict(p) for p in pkgs]}


@router.post("/packages")
async def create_package(
    body: PackageCreateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    pkg = Package(
        slug=body.slug, name=body.name,
        price_monthly=body.price_monthly, price_annual=body.price_annual,
        credits=body.credits, features=body.features,
        is_active=body.is_active, sort_order=body.sort_order,
    )
    db.add(pkg)
    await db.flush()
    return {"success": True, "package": _pkg_dict(pkg)}


@router.patch("/packages/{pkg_id}")
async def update_package(
    pkg_id: int, body: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    pkg = (await db.execute(select(Package).where(Package.id == pkg_id))).scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Paket bulunamadı.")
    for k, v in body.items():
        if hasattr(pkg, k):
            setattr(pkg, k, v)
    await db.flush()
    return {"success": True, "package": _pkg_dict(pkg)}


def _pkg_dict(p: Package) -> dict:
    return {
        "id": p.id, "slug": p.slug, "name": p.name,
        "price_monthly": p.price_monthly, "price_annual": p.price_annual,
        "price_monthly_usd": round(p.price_monthly / 100, 2),
        "price_annual_usd": round(p.price_annual / 100, 2),
        "credits": p.credits, "features": p.features or {},
        "stripe_price_id_monthly": p.stripe_price_id_monthly,
        "stripe_price_id_annual": p.stripe_price_id_annual,
        "is_active": p.is_active, "sort_order": p.sort_order,
    }
