"""Part 20 — Campaign Intelligence: report metadata columns

Revision ID: 0005_part20_campaign_report_metadata
Revises: 0004_part19_campaign_simulation_result
Create Date: 2026-06-13

Changes:
  campaigns table:
    - report_source VARCHAR(50)       — server_provider_discovery | client_simulation_preview | insufficient_data
    - data_confidence VARCHAR(20)     — low | medium | high
    - provider_status VARCHAR(30)     — available | unavailable | partial
    - discovery_sources JSON          — list of source identifiers
    - report_generated_at TIMESTAMPTZ — when the report was generated
    - redaction_level VARCHAR(20)     — none | pro | basic | full

  No destructive changes. Safe to run on existing data.
  Existing campaigns will have NULL for all new columns.
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_part20_campaign_meta"
down_revision = "0004_part19_campaign_sim"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("report_source", sa.String(50), nullable=True))
    op.add_column("campaigns", sa.Column("data_confidence", sa.String(20), nullable=True))
    op.add_column("campaigns", sa.Column("provider_status", sa.String(30), nullable=True))
    op.add_column("campaigns", sa.Column("discovery_sources", sa.JSON, nullable=True))
    op.add_column("campaigns", sa.Column("report_generated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaigns", sa.Column("redaction_level", sa.String(20), nullable=True))

    # Back-fill: existing rows with simulation_result → client_simulation_preview
    op.execute("""
        UPDATE campaigns
        SET report_source = 'client_simulation_preview',
            data_confidence = 'medium',
            provider_status = NULL,
            report_generated_at = updated_at
        WHERE simulation_result IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_column("campaigns", "redaction_level")
    op.drop_column("campaigns", "report_generated_at")
    op.drop_column("campaigns", "discovery_sources")
    op.drop_column("campaigns", "provider_status")
    op.drop_column("campaigns", "data_confidence")
    op.drop_column("campaigns", "report_source")
