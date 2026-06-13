"""Initial full schema — Parts 1-16

Revision ID: 0001_initial_full_schema
Revises:
Create Date: 2026-06-13

NOTE FOR EXISTING INSTALLATIONS
================================
If your database was already created with SQLAlchemy create_all() (Parts 1-16),
do NOT run this migration as-is — the tables already exist.
Instead, mark it as applied without running it:

    cd backend
    DATABASE_URL=<your_url> alembic stamp 0001_initial_full_schema
    DATABASE_URL=<your_url> alembic upgrade head

For FRESH databases, simply run:

    DATABASE_URL=<your_url> alembic upgrade head
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial_full_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. users ─────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("plan", sa.String(20), nullable=False, server_default="free"),
        sa.Column("credits_remaining", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("credits_total", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("credits_reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True, unique=True),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
        sa.Column("api_keys_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── 2. packages ──────────────────────────────────────────────────────────
    op.create_table(
        "packages",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("slug", sa.String(50), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("price_monthly", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("price_annual", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credits", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("features", sa.JSON(), nullable=True),
        sa.Column("stripe_price_id_monthly", sa.String(100), nullable=True),
        sa.Column("stripe_price_id_annual", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 3. payments ──────────────────────────────────────────────────────────
    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True, unique=True),
        sa.Column("stripe_invoice_id", sa.String(255), nullable=True),
        sa.Column("amount", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(10), nullable=False, server_default="usd"),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("plan", sa.String(50), nullable=True),
        sa.Column("period", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 4. support_tickets ───────────────────────────────────────────────────
    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("messages", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 5. audit_logs ────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"),
                  nullable=True, index=True),
        sa.Column("admin_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now(), index=True),
    )

    # ── 6. analyses ──────────────────────────────────────────────────────────
    op.create_table(
        "analyses",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("username", sa.String(255), nullable=False, index=True),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("brand", sa.String(255), nullable=True),
        sa.Column("profile_data", sa.JSON(), nullable=True),
        sa.Column("report_data", sa.JSON(), nullable=True),
        sa.Column("final_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("authenticity_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fraud_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("momentum_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("brand_fit_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("engagement_quality_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("roi_potential_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reputation_risk_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fraud_risk", sa.String(20), nullable=False, server_default="Low"),
        sa.Column("decision", sa.String(100), nullable=False, server_default=""),
        sa.Column("followers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("engagement_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("avg_views", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 7. campaigns ─────────────────────────────────────────────────────────
    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("brand", sa.String(255), nullable=True),
        sa.Column("platform", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("budget", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(255), nullable=True),
        sa.Column("target_country", sa.String(255), nullable=True),
        sa.Column("target_audience", sa.String(500), nullable=True),
        sa.Column("goal", sa.String(100), nullable=True),
        sa.Column("notes", sa.String(1000), nullable=True),
        sa.Column("handles", sa.JSON(), nullable=True),
        sa.Column("analysis_ids", sa.JSON(), nullable=True),
        sa.Column("items", sa.JSON(), nullable=True),
        sa.Column("recommended_influencers", sa.JSON(), nullable=True),
        sa.Column("roi_estimates", sa.JSON(), nullable=True),
        sa.Column("total_reach", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_views", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_budget", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_roi", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 8. watchlist_items ───────────────────────────────────────────────────
    op.create_table(
        "watchlist_items",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("analysis_id", sa.Integer(), sa.ForeignKey("analyses.id"), nullable=True),
        sa.Column("username", sa.String(255), nullable=False, index=True),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("avatar", sa.String(500), nullable=True),
        sa.Column("category", sa.String(255), nullable=True),
        sa.Column("followers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("final_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fraud_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("brand_fit_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 9. agents ────────────────────────────────────────────────────────────
    op.create_table(
        "agents",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("role", sa.String(100), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="idle"),
        sa.Column("mode", sa.String(20), nullable=False, server_default="mock"),
        sa.Column("model_provider", sa.String(20), nullable=False, server_default="mock"),
        sa.Column("model_name", sa.String(100), nullable=False, server_default="mock-v1"),
        sa.Column("risk_level", sa.String(20), nullable=False, server_default="low"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("is_scheduled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("schedule_cron", sa.String(100), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("autonomy_level", sa.String(50), nullable=False, server_default="supervised"),
        sa.Column("requires_approval_for", sa.String(255), nullable=True),
        sa.Column("health_status", sa.String(50), nullable=False, server_default="unknown"),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 10. agent_tasks ──────────────────────────────────────────────────────
    op.create_table(
        "agent_tasks",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("parent_task_id", sa.Integer(),
                  sa.ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("task_type", sa.String(100), nullable=False, server_default="general"),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending", index=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("input_data", sa.JSON(), nullable=True),
        sa.Column("output_data", sa.JSON(), nullable=True),
        sa.Column("risk_level", sa.String(20), nullable=False, server_default="low"),
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("approval_id", sa.Integer(), nullable=True),
        sa.Column("trigger_type", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("event_id", sa.Integer(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("timeout_seconds", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("locked_by", sa.String(255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 11. agent_runs ───────────────────────────────────────────────────────
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("agent_tasks.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("provider", sa.String(50), nullable=False, server_default="mock"),
        sa.Column("model", sa.String(100), nullable=False, server_default="mock-v1"),
        sa.Column("status", sa.String(50), nullable=False, server_default="completed"),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("cost_estimate", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("mode_used", sa.String(20), nullable=True),
        sa.Column("input_summary", sa.String(500), nullable=True),
        sa.Column("output_summary", sa.String(500), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
    )

    # ── 12. agent_conversations ──────────────────────────────────────────────
    op.create_table(
        "agent_conversations",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("source", sa.String(100), nullable=False, server_default="system"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("related_task_id", sa.Integer(),
                  sa.ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 13. agent_messages ───────────────────────────────────────────────────
    op.create_table(
        "agent_messages",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("conversation_id", sa.Integer(),
                  sa.ForeignKey("agent_conversations.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("agent_id", sa.Integer(),
                  sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sender_type", sa.String(20), nullable=False, server_default="agent"),
        sa.Column("sender_name", sa.String(255), nullable=False),
        sa.Column("message_type", sa.String(30), nullable=False, server_default="log"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 14. agent_approvals ──────────────────────────────────────────────────
    op.create_table(
        "agent_approvals",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("task_id", sa.Integer(),
                  sa.ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requested_by_agent_id", sa.Integer(),
                  sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action_type", sa.String(100), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("risk_level", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending", index=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("expected_impact", sa.String(500), nullable=True),
        sa.Column("rollback_plan", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by_user_id", sa.Integer(),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── 15. agent_memory ─────────────────────────────────────────────────────
    op.create_table(
        "agent_memory",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("agent_id", sa.Integer(), sa.ForeignKey("agents.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("memory_type", sa.String(100), nullable=False, server_default="fact"),
        sa.Column("key", sa.String(500), nullable=False, index=True),
        sa.Column("value", sa.JSON(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 16. agent_provider_health ────────────────────────────────────────────
    op.create_table(
        "agent_provider_health",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("provider", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
    )

    # ── 17. agent_events ─────────────────────────────────────────────────────
    op.create_table(
        "agent_events",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("event_type", sa.String(100), nullable=False, index=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("source", sa.String(100), nullable=False, server_default="system"),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending", index=True),
        sa.Column("related_agent_id", sa.Integer(),
                  sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("related_task_id", sa.Integer(),
                  sa.ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    # ── 18. influencer_profiles ──────────────────────────────────────────────
    op.create_table(
        "influencer_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("username", sa.String(255), nullable=False, index=True),
        sa.Column("platform", sa.String(50), nullable=False, index=True),
        sa.Column("display_name", sa.String(500), nullable=True),
        sa.Column("category", sa.String(255), nullable=True, index=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("profile_image_url", sa.String(2048), nullable=True),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="synced",
                  index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("username", "platform", name="uq_influencer_username_platform"),
    )

    # ── 19. influencer_snapshots ─────────────────────────────────────────────
    op.create_table(
        "influencer_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("influencer_id", sa.Integer(),
                  sa.ForeignKey("influencer_profiles.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("source_analysis_id", sa.Integer(), nullable=True),
        sa.Column("source_type", sa.String(30), nullable=False, server_default="analysis"),
        sa.Column("followers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("following", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_views", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_likes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_comments", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("engagement_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("final_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fraud_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("authenticity_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("momentum_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("brand_fit_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("roi_potential_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("engagement_quality_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reputation_risk_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fraud_risk", sa.String(20), nullable=False, server_default="Low"),
        sa.Column("decision", sa.String(100), nullable=False, server_default=""),
    )

    # ── 20. influencer_import_logs ───────────────────────────────────────────
    op.create_table(
        "influencer_import_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("total_records", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
    )

    # ── 21. influencer_digital_twins ─────────────────────────────────────────
    op.create_table(
        "influencer_digital_twins",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("influencer_profile_id", sa.Integer(),
                  sa.ForeignKey("influencer_profiles.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("forecast_version", sa.String(20), nullable=False, server_default="1.0"),
        sa.Column("snapshot_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("snapshot_days_coverage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("oldest_snapshot_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("newest_snapshot_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confidence", sa.String(20), nullable=False, server_default="insufficient"),
        sa.Column("evidence_strength", sa.String(20), nullable=False, server_default="weak"),
        sa.Column("is_forecast_available", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("unavailability_reason", sa.String(500), nullable=True),
        sa.Column("is_latest", sa.Boolean(), nullable=False, server_default=sa.true(), index=True),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("influencer_profile_id", "is_latest",
                            name="uq_twin_latest_per_profile"),
    )

    # ── 22. twin_forecasts ───────────────────────────────────────────────────
    op.create_table(
        "twin_forecasts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("digital_twin_id", sa.Integer(),
                  sa.ForeignKey("influencer_digital_twins.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("followers_projection_pct", sa.Float(), nullable=True),
        sa.Column("followers_current", sa.Integer(), nullable=True),
        sa.Column("followers_projected", sa.Integer(), nullable=True),
        sa.Column("followers_range_low_pct", sa.Float(), nullable=True),
        sa.Column("followers_range_high_pct", sa.Float(), nullable=True),
        sa.Column("engagement_projection_pct", sa.Float(), nullable=True),
        sa.Column("engagement_current", sa.Float(), nullable=True),
        sa.Column("engagement_projected", sa.Float(), nullable=True),
        sa.Column("engagement_decay_risk", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("risk_trend", sa.String(20), nullable=False, server_default="stable"),
        sa.Column("stability_trend", sa.String(20), nullable=False, server_default="stable"),
        sa.Column("campaign_readiness", sa.String(30), nullable=False,
                  server_default="conditional"),
        sa.Column("campaign_recommendation", sa.Text(), nullable=True),
        sa.Column("confidence", sa.String(20), nullable=False, server_default="insufficient"),
        sa.Column("limitations", sa.JSON(), nullable=True),
        sa.Column("evidence_json", sa.JSON(), nullable=True),
        sa.Column("raw_signals_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 23. twin_signals ─────────────────────────────────────────────────────
    op.create_table(
        "twin_signals",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("digital_twin_id", sa.Integer(),
                  sa.ForeignKey("influencer_digital_twins.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("source_snapshot_id", sa.Integer(),
                  sa.ForeignKey("influencer_snapshots.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("signal_type", sa.String(100), nullable=False),
        sa.Column("signal_value", sa.Float(), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 24. competitor_profiles ──────────────────────────────────────────────
    op.create_table(
        "competitor_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("normalized_name", sa.String(200), nullable=False, index=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("country", sa.String(10), nullable=False, server_default="TR"),
        sa.Column("aliases", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
        sa.UniqueConstraint("normalized_name", name="uq_competitor_normalized_name"),
    )

    # ── 25. competitor_campaign_signals ──────────────────────────────────────
    op.create_table(
        "competitor_campaign_signals",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("competitor_id", sa.Integer(),
                  sa.ForeignKey("competitor_profiles.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("influencer_profile_id", sa.Integer(),
                  sa.ForeignKey("influencer_profiles.id", ondelete="SET NULL"),
                  nullable=True, index=True),
        sa.Column("platform", sa.String(30), nullable=False),
        sa.Column("signal_type", sa.String(60), nullable=False),
        sa.Column("signal_strength", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("confidence", sa.String(10), nullable=False, server_default="low"),
        sa.Column("detected_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now(), index=True),
        sa.Column("campaign_name", sa.String(200), nullable=True),
        sa.Column("hashtags", sa.JSON(), nullable=True),
        sa.Column("evidence_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 26. competitor_report_cache ──────────────────────────────────────────
    op.create_table(
        "competitor_report_cache",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("competitor_id", sa.Integer(),
                  sa.ForeignKey("competitor_profiles.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("window_days", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("report_json", sa.JSON(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now(), index=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
    )

    # ── 27. intelligence_features ────────────────────────────────────────────
    op.create_table(
        "intelligence_features",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=False, server_default="intelligence"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_billable", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("free_for_admin", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("charge_on_failure", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("credit_cost", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("limited_credit_cost", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("standard_credit_cost", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("full_credit_cost", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("allowed_plans", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )

    # ── 28. intelligence_usage_logs ──────────────────────────────────────────
    op.create_table(
        "intelligence_usage_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("user_id", sa.Integer(), nullable=False, index=True),
        sa.Column("feature_slug", sa.String(100), nullable=False, index=True),
        sa.Column("credits_charged", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("report_mode", sa.String(30), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="success", index=True),
        sa.Column("failure_code", sa.String(100), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now(), index=True),
    )

    # ── 29. influencer_risk_reports ──────────────────────────────────────────
    op.create_table(
        "influencer_risk_reports",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("profile_id", sa.Integer(),
                  sa.ForeignKey("influencer_profiles.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("window_days", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("is_mock", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("overall_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overall_level", sa.String(20), nullable=False, server_default="low"),
        sa.Column("risk_trajectory", sa.String(20), nullable=False, server_default="stable"),
        sa.Column("confidence", sa.String(10), nullable=False, server_default="low"),
        sa.Column("generated_by_user_id", sa.Integer(), nullable=True),
        sa.Column("report_json", sa.JSON(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now(), index=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
    )

    # ── 30. risk_alerts (initial version — will be extended in 0002) ─────────
    op.create_table(
        "risk_alerts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("profile_id", sa.Integer(),
                  sa.ForeignKey("influencer_profiles.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("alert_type", sa.String(60), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("message", sa.String(500), nullable=False, server_default=""),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now(), index=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("risk_alerts")
    op.drop_table("influencer_risk_reports")
    op.drop_table("intelligence_usage_logs")
    op.drop_table("intelligence_features")
    op.drop_table("competitor_report_cache")
    op.drop_table("competitor_campaign_signals")
    op.drop_table("competitor_profiles")
    op.drop_table("twin_signals")
    op.drop_table("twin_forecasts")
    op.drop_table("influencer_digital_twins")
    op.drop_table("influencer_import_logs")
    op.drop_table("influencer_snapshots")
    op.drop_table("influencer_profiles")
    op.drop_table("agent_events")
    op.drop_table("agent_memory")
    op.drop_table("agent_approvals")
    op.drop_table("agent_messages")
    op.drop_table("agent_conversations")
    op.drop_table("agent_runs")
    op.drop_table("agent_tasks")
    op.drop_table("agents")
    op.drop_table("watchlist_items")
    op.drop_table("campaigns")
    op.drop_table("analyses")
    op.drop_table("audit_logs")
    op.drop_table("support_tickets")
    op.drop_table("payments")
    op.drop_table("packages")
    op.drop_table("users")
