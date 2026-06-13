"""Part 24 — Live Influencer Discovery: discovery runs and candidates tables

Revision ID: 0007_part24_live_disc
Revises: 0006_part22_brand_ai
Create Date: 2026-06-13

Changes:
  NEW TABLE influencer_discovery_runs:
    - id, user_id (FK users.id SET NULL), campaign_id (FK campaigns.id SET NULL)
    - brand_analysis_id (nullable int)
    - input_payload (JSON), query_plan (JSON), provider_status (JSON)
    - failed_providers (JSON), status (string)
    - candidates_count, verified_candidates_count (int)
    - created_at, completed_at

  NEW TABLE influencer_discovery_candidates:
    - id, run_id (FK influencer_discovery_runs.id SET NULL)
    - platform, handle, profile_url, display_name (strings)
    - source_provider, cache_status, evidence_quality (strings)
    - raw_evidence (JSON)
    - relevance_score, market_match_score, category_match_score, overall_score (nullable float)
    - created_at

  No changes to existing tables. Safe to run on existing data.
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_part24_live_disc"
down_revision = "0006_part22_brand_ai"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "influencer_discovery_runs",
        sa.Column("id",                      sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id",                 sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("campaign_id",             sa.Integer(), sa.ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True),
        sa.Column("brand_analysis_id",       sa.Integer(), nullable=True),
        sa.Column("input_payload",           sa.JSON(),    nullable=True),
        sa.Column("query_plan",              sa.JSON(),    nullable=True),
        sa.Column("provider_status",         sa.JSON(),    nullable=True),
        sa.Column("failed_providers",        sa.JSON(),    nullable=True),
        sa.Column("status",                  sa.String(20), nullable=False, server_default="pending"),
        sa.Column("candidates_count",        sa.Integer(), nullable=False, server_default="0"),
        sa.Column("verified_candidates_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at",              sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at",            sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "influencer_discovery_candidates",
        sa.Column("id",                   sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("run_id",               sa.Integer(), sa.ForeignKey("influencer_discovery_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("platform",             sa.String(30),  nullable=False),
        sa.Column("handle",               sa.String(255), nullable=False),
        sa.Column("profile_url",          sa.String(512), nullable=False),
        sa.Column("display_name",         sa.String(255), nullable=True),
        sa.Column("source_provider",      sa.String(50),  nullable=False),
        sa.Column("cache_status",         sa.String(20),  nullable=False, server_default="live"),
        sa.Column("evidence_quality",     sa.String(20),  nullable=False, server_default="none"),
        sa.Column("raw_evidence",         sa.JSON(),      nullable=True),
        sa.Column("relevance_score",      sa.Float(),     nullable=True),
        sa.Column("market_match_score",   sa.Float(),     nullable=True),
        sa.Column("category_match_score", sa.Float(),     nullable=True),
        sa.Column("overall_score",        sa.Float(),     nullable=True),
        sa.Column("created_at",           sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("influencer_discovery_candidates")
    op.drop_table("influencer_discovery_runs")
