from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── App ──
    APP_NAME: str = "Inflect"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-this-in-production-use-random-64-char-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    API_V1_PREFIX: str = "/api/v1"

    # ── Database ──
    DATABASE_URL: str = "postgresql+asyncpg://inflect:inflect@localhost:5432/inflect_db"

    # ── Redis ──
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Data Providers ──
    APIFY_TOKEN: str = ""
    YOUTUBE_API_KEY: str = ""
    INSTAGRAM_ACTOR: str = "apify/instagram-profile-scraper"
    TIKTOK_ACTOR: str = "clockworks/tiktok-scraper"

    # ── AI Providers ──
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # ── Agent Configuration ──
    # mock: API key olmadan simüle çıktı üretir
    # real/live: gerçek API çağrısı yapar (key zorunlu)
    AGENTS_MODE: str = "mock"
    # false: dış işlem yok (email/DM/reklam) — production default
    AGENTS_ALLOW_EXTERNAL_ACTIONS: bool = False
    # true: yüksek riskli aksiyonlar human approval bekler
    AGENTS_REQUIRE_HUMAN_APPROVAL: bool = True

    # ── Stripe ──
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # ── Email ──
    SMTP_HOST: str = "smtp.resend.com"
    SMTP_PORT: int = 465
    SMTP_USER: str = "resend"
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = "noreply@inflect.io"
    FROM_NAME: str = "Inflect"

    # ── Frontend ──
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Admin ──
    ADMIN_EMAIL: str = "admin@inflect.io"
    ADMIN_PASSWORD: str = "change-this-admin-password"

    # ── Plan credits ──
    PLAN_STARTER_CREDITS: int = 50
    PLAN_PRO_CREDITS: int = 200
    PLAN_BUSINESS_CREDITS: int = 1000

    # ── Pricing (USD cents) ──
    PRICE_STARTER: int = 2900
    PRICE_PRO: int = 7900
    PRICE_BUSINESS: int = 19900

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def CORS_ORIGINS(self) -> List[str]:
        """
        Development: tüm localhost portlarına ve 127.0.0.1'e izin ver.
        Production: sadece FRONTEND_URL'ye izin ver.
        """
        if not self.is_production:
            origins = [
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:8080",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://127.0.0.1:8080",
            ]
            # FRONTEND_URL farklıysa ekle
            if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
                origins.append(self.FRONTEND_URL)
            return origins
        # Production
        origins = [self.FRONTEND_URL]
        if self.FRONTEND_URL.startswith("https://www."):
            origins.append(self.FRONTEND_URL.replace("https://www.", "https://"))
        elif self.FRONTEND_URL.startswith("https://"):
            origins.append(self.FRONTEND_URL.replace("https://", "https://www."))
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
