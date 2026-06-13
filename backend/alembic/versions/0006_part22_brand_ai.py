"""Part 22 — AI Brand Match: brand_analysis_snapshots table

Revision ID: 0006_part22_brand_ai
Revises: 0005_part20_campaign_meta
Create Date: 2026-06-13

Changes:
  NEW TABLE brand_analysis_snapshots:
    - id, user_id (FK users.id, SET NULL)
    - input_value, normalized_input
    - resolved_domain, resolver_status, resolver_confidence
    - fetch_status, fetch_error, http_status, final_url, fetched_at
    - verified_evidence, extracted_title, extracted_description, extracted_language
    - evidence_quality, report_status, redaction_level
    - created_at

  No changes to existing tables. Safe to run on existing data.
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_part22_brand_ai"
down_revision = "0005_part20_campaign_meta"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brand_analysis_snapshots",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),

        sa.Column("input_value",      sa.String(500), nullable=False),
        sa.Column("normalized_input", sa.String(500), nullable=False),

        sa.Column("resolved_domain",     sa.String(500), nullable=True),
        sa.Column("resolver_status",     sa.String(50),  nullable=False, server_default="domain_unresolved"),
        sa.Column("resolver_confidence", sa.String(20),  nullable=False, server_default="low"),

        sa.Column("fetch_status",  sa.String(50),             nullable=False, server_default="not_attempted"),
        sa.Column("fetch_error",   sa.Text,                   nullable=True),
        sa.Column("http_status",   sa.Integer,                nullable=True),
        sa.Column("final_url",     sa.String(500),            nullable=True),
        sa.Column("fetched_at",    sa.DateTime(timezone=True), nullable=True),

        sa.Column("verified_evidence",     sa.Boolean, nullable=False, server_default="false"),
        sa.Column("extracted_title",       sa.String(500), nullable=True),
        sa.Column("extracted_description", sa.Text,        nullable=True),
        sa.Column("extracted_language",    sa.String(20),  nullable=True),
        sa.Column("evidence_quality",      sa.String(20),  nullable=False, server_default="none"),

        sa.Column("report_status",  sa.String(50), nullable=False, server_default="domain_unresolved"),
        sa.Column("redaction_level", sa.String(20), nullable=False, server_default="full"),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("brand_analysis_snapshots")
