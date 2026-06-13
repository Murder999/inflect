"""Part 18 — Agency/Enterprise plans + feature_keys in packages

Revision ID: 0003_part18_agency_enterprise_plans
Revises: 0002_part17_risk_alert_extended
Create Date: 2026-06-13

Changes:
  users.plan enum:
    - Add 'agency' value
    - Add 'enterprise' value

  packages:
    - Seed agency and enterprise rows (handled by startup _seed, not migration)
    - feature_keys added to existing package.features JSON (startup upsert)

  No destructive changes. Downgrade is a no-op (removing enum values
  from PostgreSQL requires a full column rebuild; out of scope for dev).
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_part18_plans"
down_revision = "0002_part17_risk_alert_extended"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new plan types to the PostgreSQL enum.
    # IF NOT EXISTS prevents errors on repeated runs.
    op.execute("ALTER TYPE plantype ADD VALUE IF NOT EXISTS 'agency'")
    op.execute("ALTER TYPE plantype ADD VALUE IF NOT EXISTS 'enterprise'")

    # Index on users.plan for faster plan-based queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_plan
        ON users (plan)
    """)

    # Index on packages.slug (already unique but explicit for lookup speed)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_packages_is_active
        ON packages (is_active)
    """)


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without a full rebuild.
    # Dropping the index is safe; leave enum values in place.
    op.execute("DROP INDEX IF EXISTS ix_users_plan")
    op.execute("DROP INDEX IF EXISTS ix_packages_is_active")
