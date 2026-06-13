from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
import logging
import sys

from app.core.config import settings
from app.core.database import init_db
import app.models  # noqa: F401

from app.api.v1.routes import auth, analyze, dashboard, admin
from app.api.v1.routes import watchlist, discover, campaigns, alerts, billing, support
from app.api.v1.routes import agents            # Part 1-3 core agent routes
from app.api.v1.routes import agents_extended   # Part 4 growth/analysis routes
from app.api.v1.routes import archive           # Part 2 influencer archive
from app.api.v1.routes import digital_twin             # Part 12 Digital Twin
from app.api.v1.routes import influencers              # Part 12 Influencer Lookup
from app.api.v1.routes import competitor_intelligence  # Part 13 Competitor Intel
from app.api.v1.routes import risk_radar               # Part 15 Risk Radar
from app.api.v1.routes import admin_intelligence       # Part 16 Intelligence Billing
from app.api.v1.routes import risk_alerts              # Part 17 Risk Alert Management
from app.api.v1.routes import entitlements             # Part 18 Entitlement & Pricing
from app.api.v1.routes import brand_match              # Part 22 AI Brand Match
from app.api.v1.routes import influencer_discovery     # Part 24 Live Discovery

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("  Inflect API v10.4.0  |  ENV: %s", settings.APP_ENV)
    logger.info("  DATABASE : %s", settings.DATABASE_URL)
    logger.info("  CORS     : %s", settings.CORS_ORIGINS)
    logger.info("=" * 60)

    try:
        await init_db()
    except Exception as exc:
        logger.critical("Veritabanına bağlanılamadı: %s", exc)
        app.state.db_ok = False
    else:
        app.state.db_ok = True
        logger.info("✓ Veritabanı hazır")

    if app.state.db_ok:
        await _seed(app)

    # Start background agent scheduler (Part 11)
    try:
        from app.services.agent_scheduler import start_scheduler
        from app.core.database import AsyncSessionLocal
        start_scheduler(AsyncSessionLocal)
        logger.info("✓ Agent scheduler başlatıldı")
    except Exception as exc:
        logger.warning("Agent scheduler başlatılamadı: %s", exc)

    # Start daily risk scan scheduler (Part 17)
    try:
        from app.services.risk_scan_scheduler import start_risk_scanner
        from app.core.database import AsyncSessionLocal
        start_risk_scanner(AsyncSessionLocal)
        logger.info("✓ Risk scan scheduler başlatıldı (24h interval)")
    except Exception as exc:
        logger.warning("Risk scan scheduler başlatılamadı: %s", exc)

    logger.info("✓ Inflect API v10.4.0 hazır — http://0.0.0.0:8000")
    yield

    # Stop schedulers on shutdown
    try:
        from app.services.agent_scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass
    try:
        from app.services.risk_scan_scheduler import stop_risk_scanner
        stop_risk_scanner()
    except Exception:
        pass
    logger.info("Inflect API kapatılıyor…")


async def _seed(app: FastAPI) -> None:
    from app.core.database import AsyncSessionLocal
    from app.models.user import User, PlanType
    from app.models.admin_models import Package
    from app.core.security import hash_password
    from app.services.agent_registry import seed_agents

    async with AsyncSessionLocal() as session:
        try:
            admin_user = (await session.execute(
                select(User).where(User.email == settings.ADMIN_EMAIL)
            )).scalar_one_or_none()
            if not admin_user:
                session.add(User(
                    email=settings.ADMIN_EMAIL,
                    hashed_password=hash_password(settings.ADMIN_PASSWORD),
                    full_name="Admin", is_admin=True, is_active=True,
                    plan=PlanType.BUSINESS, credits_remaining=9999, credits_total=9999,
                ))
                logger.info("✓ Admin hesabı oluşturuldu: %s", settings.ADMIN_EMAIL)
            else:
                admin_user.is_admin = True
                admin_user.is_active = True
                admin_user.hashed_password = hash_password(settings.ADMIN_PASSWORD)
                logger.info("✓ Admin hesabı doğrulandı: %s", settings.ADMIN_EMAIL)

            # Upsert packages — update existing ones with new feature_keys
            default_pkgs = _default_packages()
            for pkg_def in default_pkgs:
                existing_pkg = (await session.execute(
                    select(Package).where(Package.slug == pkg_def.slug)
                )).scalar_one_or_none()
                if not existing_pkg:
                    session.add(pkg_def)
                else:
                    # Merge feature_keys into existing package (non-destructive)
                    existing_features = dict(existing_pkg.features or {})
                    new_features = dict(pkg_def.features or {})
                    # Only update feature_keys if not already customized
                    if "feature_keys" not in existing_features:
                        existing_features["feature_keys"] = new_features.get("feature_keys", [])
                        existing_pkg.features = existing_features
                        session.add(existing_pkg)
            logger.info("✓ Paketler oluşturuldu/güncellendi")

            await session.flush()
            await seed_agents(session)

            # Intelligence feature costs (Part 16)
            from app.services.intelligence_billing import seed_intelligence_features
            await seed_intelligence_features(session)

            await session.commit()

        except Exception as exc:
            logger.warning("Seed atlandı: %s", exc)
            await session.rollback()


def _default_packages():
    from app.models.admin_models import Package
    from app.services.entitlement_service import PLAN_FEATURES
    return [
        Package(
            slug="free",     name="Ücretsiz",   price_monthly=0,     price_annual=0,      credits=5,    sort_order=0, is_active=True,
            features={"analyses": 5,    "discovery": True,  "campaigns": False, "feature_keys": PLAN_FEATURES["free"]},
        ),
        Package(
            slug="starter",  name="Starter",    price_monthly=4900,  price_annual=46800,  credits=100,  sort_order=1, is_active=True,
            features={"analyses": 100,  "discovery": True,  "campaigns": True,  "feature_keys": PLAN_FEATURES["starter"]},
        ),
        Package(
            slug="pro",      name="Pro",         price_monthly=14900, price_annual=142800, credits=500,  sort_order=2, is_active=True,
            features={"analyses": 500,  "discovery": True,  "campaigns": True,  "team": True, "feature_keys": PLAN_FEATURES["pro"]},
        ),
        Package(
            slug="business", name="Business",    price_monthly=14900, price_annual=142800, credits=500,  sort_order=3, is_active=False,
            features={"analyses": 500,  "discovery": True,  "campaigns": True,  "team": True, "feature_keys": PLAN_FEATURES["business"]},
        ),
        Package(
            slug="agency",   name="Agency",      price_monthly=39900, price_annual=358800, credits=2000, sort_order=4, is_active=True,
            features={"analyses": 2000, "discovery": True,  "campaigns": True,  "team": True, "multi_client": True, "feature_keys": PLAN_FEATURES["agency"]},
        ),
        Package(
            slug="enterprise",name="Enterprise", price_monthly=0,     price_annual=0,      credits=9999, sort_order=5, is_active=True,
            features={"analyses": -1,   "discovery": True,  "campaigns": True,  "team": True, "multi_client": True, "api_access": True, "feature_keys": PLAN_FEATURES["enterprise"]},
        ),
    ]


# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Inflect API",
    description="Influencer Intelligence Platform + AI Orchestrator",
    version="9.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "stripe-signature"],
    expose_headers=["X-Total-Count"],
    max_age=600,
)

PREFIX = settings.API_V1_PREFIX

# Mevcut (bozulmaz)
app.include_router(auth.router,      prefix=PREFIX)
app.include_router(analyze.router,   prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(admin.router,     prefix=PREFIX)
app.include_router(watchlist.router, prefix=PREFIX)
app.include_router(discover.router,  prefix=PREFIX)
app.include_router(campaigns.router, prefix=PREFIX)
app.include_router(alerts.router,    prefix=PREFIX)
app.include_router(billing.router,   prefix=PREFIX)
app.include_router(support.router,   prefix=PREFIX)

# AI Orchestrator
app.include_router(agents.router,          prefix=PREFIX)  # Part 1-3
app.include_router(agents_extended.router, prefix=PREFIX)  # Part 4

# Influencer Archive (Part 2)
app.include_router(archive.router, prefix=PREFIX)

# Digital Twin (Part 12)
app.include_router(digital_twin.router, prefix=PREFIX)

# Influencer Lookup (Part 12 UX Fix)
app.include_router(influencers.router, prefix=PREFIX)

# Competitor Intelligence (Part 13)
app.include_router(competitor_intelligence.router, prefix=PREFIX)

# Risk Radar (Part 15)
app.include_router(risk_radar.router, prefix=PREFIX)

# Intelligence Billing (Part 16)
app.include_router(admin_intelligence.router, prefix=PREFIX)

# Risk Alert Management (Part 17)
app.include_router(risk_alerts.router, prefix=PREFIX)

# Entitlement & Pricing (Part 18)
app.include_router(entitlements.router, prefix=PREFIX)

# AI Brand Match (Part 22)
app.include_router(brand_match.router, prefix=PREFIX)

# Live Influencer Discovery (Part 24)
app.include_router(influencer_discovery.router, prefix=PREFIX)


@app.get("/")
def root():
    return {
        "name":    "Inflect API",
        "version": "10.4.0",
        "status":  "online",
        "ai":      "part-24-live-discovery",
    }


@app.get("/api/v1/health")
def health(request: Request):
    db_ok = getattr(request.app.state, "db_ok", True)
    return {
        "status":           "ok" if db_ok else "db_error",
        "version":          "10.5.0",
        "env":              settings.APP_ENV,
        "ai_orchestrator":  "part-11",
        "risk_scanner":     "part-17",
        "live_discovery":   "part-24",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Hata: %s %s — %s: %s", request.method, request.url, type(exc).__name__, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Sunucu hatası."})
