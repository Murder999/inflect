"""Part 19 — Campaign Intelligence: simulation_result column

Revision ID: 0004_part19_campaign_simulation_result
Revises: 0003_part18_agency_enterprise_plans
Create Date: 2026-06-13

Changes:
  campaigns table:
    - Add simulation_result (JSONB nullable) column
      Stores the full SimResultV2 snapshot when a campaign is saved
      from the Campaign Intelligence simulation screen.

  No destructive changes. Safe to run on existing data.
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_part19_campaign_sim"
down_revision = "0003_part18_plans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column("simulation_result", sa.JSON, nullable=True),
    )

    # Partial index: only index rows that actually have a simulation result
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_campaigns_has_simulation
        ON campaigns (id)
        WHERE simulation_result IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_campaigns_has_simulation")
    op.drop_column("campaigns", "simulation_result")
