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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("  Inflect API v6.0  |  ENV: %s", settings.APP_ENV)
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

    logger.info("✓ Inflect API v6.0 hazır — http://0.0.0.0:8000")
    yield

    # Stop scheduler on shutdown
    try:
        from app.services.agent_scheduler import stop_scheduler
        stop_scheduler()
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

            pkg_count = (await session.execute(select(func.count(Package.id)))).scalar() or 0
            if pkg_count == 0:
                for p in _default_packages():
                    session.add(p)
                logger.info("✓ Varsayılan paketler oluşturuldu")

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
    return [
        Package(slug="free",     name="Ücretsiz", price_monthly=0,    price_annual=0,     credits=5,    sort_order=0, is_active=True, features={"analyses": 5,    "discovery": True, "campaigns": False}),
        Package(slug="starter",  name="Starter",  price_monthly=2900, price_annual=29000, credits=50,   sort_order=1, is_active=True, features={"analyses": 50,   "discovery": True, "campaigns": True}),
        Package(slug="pro",      name="Pro",       price_monthly=7900, price_annual=79000, credits=200,  sort_order=2, is_active=True, features={"analyses": 200,  "discovery": True, "campaigns": True,  "team": True}),
        Package(slug="business", name="Business",  price_monthly=19900,price_annual=199000,credits=1000, sort_order=3, is_active=True, features={"analyses": 1000, "discovery": True, "campaigns": True,  "team": True, "api_access": True}),
    ]


# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Inflect API",
    description="Influencer Intelligence Platform + AI Orchestrator",
    version="6.0.0",
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


@app.get("/")
def root():
    return {"name": "Inflect API", "version": "8.2.0", "status": "online", "ai": "part-16-intelligence-billing"}


@app.get("/api/v1/health")
def health(request: Request):
    db_ok = getattr(request.app.state, "db_ok", True)
    return {"status": "ok" if db_ok else "db_error", "version": "5.0.0", "env": settings.APP_ENV, "ai_orchestrator": "part-11"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Hata: %s %s — %s: %s", request.method, request.url, type(exc).__name__, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Sunucu hatası."})
