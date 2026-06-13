"""
Alembic migration environment — Part 17
Async-compatible (asyncpg / SQLAlchemy 2.0).

Usage on EXISTING databases (created via create_all()):
    alembic stamp 0001_initial_full_schema
    alembic upgrade head

Usage on FRESH databases:
    alembic upgrade head
"""
from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Put backend/ on sys.path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import Base and all models so SQLAlchemy knows about every table
from app.core.database import Base          # noqa: E402
import app.models                           # noqa: E402, F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_url() -> str:
    """Return DATABASE_URL from env (preferred) or alembic.ini fallback."""
    return (
        os.environ.get("DATABASE_URL")
        or config.get_main_option("sqlalchemy.url", "")
    )


# ── Offline mode (generates SQL script without connecting) ────────────────────

def run_migrations_offline() -> None:
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode (connects to DB and runs migrations) ──────────────────────────

def _do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def _run_migrations_online() -> None:
    url = _get_url()
    connectable = create_async_engine(url, poolclass=pool.NullPool)

    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(_run_migrations_online())
