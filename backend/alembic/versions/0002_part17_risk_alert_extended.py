"""Part 17 — Extended RiskAlert + RiskScanLog

Revision ID: 0002_part17_risk_alert_extended
Revises: 0001_initial_full_schema
Create Date: 2026-06-13

Changes:
  risk_alerts:
    - Add status VARCHAR(20) NOT NULL DEFAULT 'open'   (replaces resolved bool)
    - Add source VARCHAR(50) NOT NULL DEFAULT 'manual_scan'
    - Add platform VARCHAR(50) NULL
    - Add previous_score FLOAT NULL
    - Add current_score FLOAT NULL
    - Add delta FLOAT NULL
    - Add explanation TEXT NULL
    - Add evidence JSON NULL
    - Add acknowledged_by INTEGER NULL (FK users.id)
    - Add acknowledged_at TIMESTAMP NULL
    - Add updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    - Add alert_type index
    - Add severity index
    - Add status index
    - Add source index
    - Migrate: resolved=True → status='resolved'
    - Drop resolved BOOLEAN (replaced by status)

  NEW TABLE: risk_scan_logs
    - Audit log for each daily scan batch
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_part17_risk_alert_extended"
down_revision: Union[str, None] = "0001_initial_full_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add new columns to risk_alerts ────────────────────────────────────
    op.add_column("risk_alerts", sa.Column("status", sa.String(20), nullable=True))
    op.add_column("risk_alerts", sa.Column("source", sa.String(50), nullable=True))
    op.add_column("risk_alerts", sa.Column("platform", sa.String(50), nullable=True))
    op.add_column("risk_alerts", sa.Column("previous_score", sa.Float(), nullable=True))
    op.add_column("risk_alerts", sa.Column("current_score", sa.Float(), nullable=True))
    op.add_column("risk_alerts", sa.Column("delta", sa.Float(), nullable=True))
    op.add_column("risk_alerts", sa.Column("explanation", sa.Text(), nullable=True))
    op.add_column("risk_alerts", sa.Column("evidence", sa.JSON(), nullable=True))
    op.add_column("risk_alerts",
                  sa.Column("acknowledged_by", sa.Integer(),
                            sa.ForeignKey("users.id", ondelete="SET NULL"),
                            nullable=True))
    op.add_column("risk_alerts", sa.Column("acknowledged_at", sa.DateTime(), nullable=True))
    op.add_column("risk_alerts",
                  sa.Column("updated_at", sa.DateTime(), nullable=True,
                            server_default=sa.func.now()))

    # ── 2. Migrate data: resolved bool → status string ────────────────────────
    op.execute(
        "UPDATE risk_alerts SET status = 'resolved', source = 'manual_scan' "
        "WHERE resolved = TRUE"
    )
    op.execute(
        "UPDATE risk_alerts SET status = 'open', source = 'manual_scan' "
        "WHERE resolved = FALSE OR resolved IS NULL"
    )
    # Set updated_at for existing rows
    op.execute(
        "UPDATE risk_alerts SET updated_at = created_at WHERE updated_at IS NULL"
    )

    # ── 3. Make status / source NOT NULL now that data is populated ───────────
    op.alter_column("risk_alerts", "status", nullable=False, server_default="open")
    op.alter_column("risk_alerts", "source", nullable=False, server_default="manual_scan")
    op.alter_column("risk_alerts", "updated_at", nullable=False, server_default=sa.func.now())

    # ── 4. Add indexes ────────────────────────────────────────────────────────
    op.create_index("ix_risk_alerts_status",     "risk_alerts", ["status"])
    op.create_index("ix_risk_alerts_source",     "risk_alerts", ["source"])
    op.create_index("ix_risk_alerts_severity",   "risk_alerts", ["severity"])
    op.create_index("ix_risk_alerts_platform",   "risk_alerts", ["platform"])
    op.create_index("ix_risk_alerts_alert_type", "risk_alerts", ["alert_type"])

    # ── 5. Drop the legacy resolved column ───────────────────────────────────
    op.drop_column("risk_alerts", "resolved")

    # ── 6. Create risk_scan_logs table ────────────────────────────────────────
    op.create_table(
        "risk_scan_logs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("started_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now(), index=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("trigger_source", sa.String(50), nullable=False,
                  server_default="scheduled"),
        sa.Column("profiles_scanned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("profiles_succeeded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("profiles_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("alerts_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("alerts_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    # ── Drop risk_scan_logs ───────────────────────────────────────────────────
    op.drop_table("risk_scan_logs")

    # ── Drop new indexes ──────────────────────────────────────────────────────
    op.drop_index("ix_risk_alerts_alert_type", table_name="risk_alerts")
    op.drop_index("ix_risk_alerts_platform",   table_name="risk_alerts")
    op.drop_index("ix_risk_alerts_severity",   table_name="risk_alerts")
    op.drop_index("ix_risk_alerts_source",     table_name="risk_alerts")
    op.drop_index("ix_risk_alerts_status",     table_name="risk_alerts")

    # ── Restore resolved column ───────────────────────────────────────────────
    op.add_column("risk_alerts",
                  sa.Column("resolved", sa.Boolean(), nullable=True,
                            server_default=sa.false()))
    op.execute(
        "UPDATE risk_alerts SET resolved = TRUE WHERE status = 'resolved'"
    )
    op.execute(
        "UPDATE risk_alerts SET resolved = FALSE WHERE status != 'resolved'"
    )
    op.alter_column("risk_alerts", "resolved", nullable=False)

    # ── Drop new columns ──────────────────────────────────────────────────────
    op.drop_column("risk_alerts", "updated_at")
    op.drop_column("risk_alerts", "acknowledged_at")
    op.drop_column("risk_alerts", "acknowledged_by")
    op.drop_column("risk_alerts", "evidence")
    op.drop_column("risk_alerts", "explanation")
    op.drop_column("risk_alerts", "delta")
    op.drop_column("risk_alerts", "current_score")
    op.drop_column("risk_alerts", "previous_score")
    op.drop_column("risk_alerts", "platform")
    op.drop_column("risk_alerts", "source")
    op.drop_column("risk_alerts", "status")
