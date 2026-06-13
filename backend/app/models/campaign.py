from sqlalchemy import String, Integer, DateTime, Float, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from typing import Optional
import enum
from app.core.database import Base


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)

    # Temel alanlar
    name: Mapped[str] = mapped_column(String(255))
    brand: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    platform: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[CampaignStatus] = mapped_column(SAEnum(CampaignStatus), default=CampaignStatus.DRAFT)

    # Kampanya detayları (Phase 3)
    budget: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)           # USD
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_country: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_audience: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    goal: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)          # brand_awareness / sales / engagement
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Influencer handles ve analiz ID'leri
    handles: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)
    analysis_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)
    items: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)  # eski uyumluluk

    # AI tahminleri
    recommended_influencers: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)
    roi_estimates: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=None)

    # Campaign Intelligence simulation result (full SimResultV2 snapshot)
    simulation_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=None)

    # Campaign report metadata (Part 20)
    report_source: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default=None)
    # server_provider_discovery | client_simulation_preview | insufficient_data
    data_confidence: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default=None)
    # low | medium | high
    provider_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, default=None)
    # available | unavailable | partial
    discovery_sources: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)
    report_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, default=None)
    redaction_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default=None)
    # none | basic | full

    # Performans verileri
    total_reach: Mapped[int] = mapped_column(Integer, default=0)
    total_views: Mapped[int] = mapped_column(Integer, default=0)
    estimated_budget: Mapped[int] = mapped_column(Integer, default=0)
    estimated_roi: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="campaigns")
