"""
Billing — Stripe test mode entegrasyonu.
STRIPE_SECRET_KEY=sk_test_... ile test modunda çalışır.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import logging

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, PlanType
from app.models.admin_models import Payment
from app.core.config import settings
from app.services.audit import log_action

router = APIRouter(prefix="/billing", tags=["billing"])
logger = logging.getLogger(__name__)

PLAN_CREDITS = {"free": 5, "starter": 50, "pro": 200, "business": 1000}
PLAN_PRICES_CENTS = {"starter": 2900, "pro": 7900, "business": 19900}

# Stripe price IDs — replace with real IDs from Stripe dashboard
STRIPE_PRICE_IDS = {
    "starter_monthly":  "price_starter_monthly",
    "pro_monthly":      "price_pro_monthly",
    "business_monthly": "price_business_monthly",
}


class CheckoutRequest(BaseModel):
    plan: str
    period: str = "monthly"


@router.post("/checkout")
async def create_checkout_session(
    req: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if req.plan not in ("starter", "pro", "business"):
        raise HTTPException(status_code=400, detail="Geçersiz plan.")

    if not settings.STRIPE_SECRET_KEY or settings.STRIPE_SECRET_KEY.startswith("change"):
        # Test mode — return mock checkout URL
        return {
            "url": f"{settings.FRONTEND_URL}/pricing?success=test&plan={req.plan}",
            "mode": "test_placeholder",
            "message": "Stripe key yapılandırılmamış. Gerçek ödeme için STRIPE_SECRET_KEY ekleyin.",
        }

    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

        # Create or retrieve customer
        customer_id = user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(email=user.email, name=user.full_name or user.email)
            customer_id = customer.id
            user.stripe_customer_id = customer_id
            await db.flush()

        price_key = f"{req.plan}_{req.period}"
        price_id = STRIPE_PRICE_IDS.get(price_key)
        if not price_id:
            raise HTTPException(status_code=400, detail=f"Fiyat bulunamadı: {price_key}")

        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.FRONTEND_URL}/settings?billing=success&plan={req.plan}",
            cancel_url=f"{settings.FRONTEND_URL}/pricing",
            metadata={"user_id": str(user.id), "plan": req.plan, "period": req.period},
        )
        return {"url": session.url, "session_id": session.id, "mode": "live"}

    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Stripe hatası: {str(e)[:200]}")


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    stripe_signature: Optional[str] = Header(None, alias="stripe-signature"),
):
    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_WEBHOOK_SECRET:
        return {"received": True, "status": "skipped_no_config"}

    body = await request.body()
    try:
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY
        event = stripe.Webhook.construct_event(body, stripe_signature, settings.STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook imzası hatalı: {e}")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        user_id = metadata.get("user_id")
        plan    = metadata.get("plan")

        if user_id and plan:
            result = await db.execute(select(User).where(User.id == int(user_id)))
            user = result.scalar_one_or_none()
            if user:
                try:
                    new_plan = PlanType(plan)
                    user.plan = new_plan
                    credits = PLAN_CREDITS.get(plan, 5)
                    user.credits_total = credits
                    user.credits_remaining = credits
                    user.stripe_subscription_id = session.get("subscription")

                    # Record payment
                    payment = Payment(
                        user_id=user.id,
                        stripe_invoice_id=session.get("invoice"),
                        amount=session.get("amount_total", 0),
                        currency=session.get("currency", "usd"),
                        status="succeeded", plan=plan,
                        period=metadata.get("period", "monthly"),
                    )
                    db.add(payment)
                    await log_action(db, "payment_succeeded", user_id=user.id,
                                     details={"plan": plan, "amount": session.get("amount_total")})
                    await db.commit()
                except Exception as e:
                    logger.error(f"Webhook processing error: {e}")
                    await db.rollback()

    elif event["type"] in ("invoice.payment_failed", "customer.subscription.deleted"):
        logger.info(f"Stripe event: {event['type']}")

    return {"received": True}


@router.get("/invoices")
async def get_invoices(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc()).limit(20)
    )
    payments = result.scalars().all()
    invoices = [{
        "id": p.id, "amount_usd": round(p.amount / 100, 2),
        "currency": p.currency, "status": p.status,
        "plan": p.plan, "period": p.period,
        "stripe_invoice_id": p.stripe_invoice_id,
        "created_at": p.created_at.isoformat() if p.created_at else "",
    } for p in payments]

    return {
        "invoices": invoices,
        "total": len(invoices),
        "stripe_configured": bool(settings.STRIPE_SECRET_KEY and not settings.STRIPE_SECRET_KEY.startswith("change")),
    }


@router.get("/subscription")
async def get_subscription(
    user: User = Depends(get_current_user),
):
    return {
        "plan": user.plan.value if hasattr(user.plan, "value") else str(user.plan),
        "credits_remaining": user.credits_remaining,
        "credits_total": user.credits_total,
        "stripe_customer_id": user.stripe_customer_id,
        "stripe_subscription_id": user.stripe_subscription_id,
        "stripe_configured": bool(settings.STRIPE_SECRET_KEY and not settings.STRIPE_SECRET_KEY.startswith("change")),
    }
