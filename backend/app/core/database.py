import asyncio
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
from app.core.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,          # SQL logları development'ta da kapalı — çok kalabalık olur
    pool_pre_ping=True,  # Ölü bağlantıları otomatik yenile
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,   # 1 saatte bir bağlantıyı yenile
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency injection için veritabanı session'ı.
    Her request için ayrı session, hata durumunda rollback.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db(max_retries: int = 10, initial_delay: float = 2.0) -> None:
    """
    Veritabanı tablolarını oluştur.

    PostgreSQL container henüz hazır olmayabilir (Docker startup race condition).
    Exponential backoff ile retry yapar.
    Modellerin önceden import edilmiş olması gerekir (models/__init__.py).
    """
    delay = initial_delay
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info(f"✓ Veritabanı tabloları hazır (deneme {attempt}/{max_retries})")
            return
        except Exception as e:
            last_error = e
            if attempt == max_retries:
                break
            logger.warning(
                f"DB bağlantı denemesi {attempt}/{max_retries} başarısız: "
                f"{type(e).__name__}: {e}. "
                f"{delay:.1f}s bekleniyor..."
            )
            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 15.0)  # Max 15s bekleme

    raise RuntimeError(
        f"Veritabanına {max_retries} denemede bağlanılamadı. "
        f"Son hata: {type(last_error).__name__}: {last_error}\n"
        f"DATABASE_URL: {settings.DATABASE_URL}"
    )
