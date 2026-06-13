"""Brand Analysis Snapshot model — Part 22"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BrandAnalysisSnapshot(Base):
    __tablename__ = "brand_analysis_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Input
    input_value: Mapped[str] = mapped_column(String(500), nullable=False)
    normalized_input: Mapped[str] = mapped_column(String(500), nullable=False)

    # Domain resolution
    resolved_domain: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    resolver_status: Mapped[str] = mapped_column(String(50), nullable=False, default="domain_unresolved")
    resolver_confidence: Mapped[str] = mapped_column(String(20), nullable=False, default="low")

    # Website fetch
    fetch_status: Mapped[str] = mapped_column(String(50), nullable=False, default="not_attempted")
    fetch_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    final_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    fetched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Extracted evidence (summary fields — full data returned in API response)
    verified_evidence: Mapped[bool] = mapped_column(Boolean, default=False)
    extracted_title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    extracted_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extracted_language: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    evidence_quality: Mapped[str] = mapped_column(String(20), nullable=False, default="none")

    # Report metadata
    report_status: Mapped[str] = mapped_column(String(50), nullable=False, default="domain_unresolved")
    redaction_level: Mapped[str] = mapped_column(String(20), nullable=False, default="full")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
