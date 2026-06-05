"""
Stripe Service — Subscription & Payment management.
Requires STRIPE_SECRET_KEY in .env
"""
import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


def create_customer(email: str, name: str | None = None) -> str | None:
    """Stripe customer oluştur, customer_id döndür."""
    if not settings.STRIPE_SECRET_KEY:
        return None
    customer = stripe.Customer.create(email=email, name=name or email)
    return customer.id


def create_checkout_session(
    customer_id: str,
    price_id: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """Checkout session URL'i döndür."""
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return session.url


def cancel_subscription(subscription_id: str) -> bool:
    """Aboneliği iptal et."""
    try:
        stripe.Subscription.delete(subscription_id)
        return True
    except stripe.error.StripeError:
        return False


def verify_webhook(payload: bytes, sig_header: str) -> dict | None:
    """Webhook imzasını doğrula ve event döndür."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        return None
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
        return event
    except (stripe.error.SignatureVerificationError, ValueError):
        return None
