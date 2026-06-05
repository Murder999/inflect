"""
Influencer Archive — Platform'un cross-user influencer kayıt sistemi.
Tüm metrikler gerçek analizlerden gelir; fake veri üretilmez.
"""
from __future__ import annotations

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    DateTime, Float, ForeignKey, Integer,
    String, Text, UniqueConstraint,
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SyncStatus(str, enum.Enum):
    PENDING    = "pending"      # Henüz hiç sync yapılmadı
    SYNCED     = "synced"       # En son sync başarılı
    NEEDS_SYNC = "needs_sync"   # Güncellenmesi gerekiyor (eski veri)
    ERROR      = "error"        # Son sync başarısız
    FAILED     = "failed"       # Seed'den gelen başarısız durum (legacy uyumluluk)


# ─── InfluencerProfile ────────────────────────────────────────────────────────

class InfluencerProfile(Base):
    """
    Platform genelinde influencer kimlik kaydı.
    Metrik içermez — kimlik ve meta bilgisi saklar.
    """
    __tablename__ = "influencer_profiles"
    __table_args__ = (
        UniqueConstraint("username", "platform", name="uq_influencer_username_platform"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Kimlik
    username: Mapped[str]               = mapped_column(String(255), nullable=False, index=True)
    platform: Mapped[str]               = mapped_column(String(50),  nullable=False, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Meta
    category:          Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    country:           Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    city:              Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bio:               Mapped[Optional[str]] = mapped_column(Text,        nullable=True)
    profile_image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    # Durum
    sync_status: Mapped[SyncStatus] = mapped_column(
        SAEnum(SyncStatus, native_enum=False, length=20),
        default=SyncStatus.SYNCED,
        nullable=False,
        index=True,
    )

    # Zaman
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )


# ─── InfluencerSnapshot ──────────────────────────────────────────────────────

class InfluencerSnapshot(Base):
    """
    Bir zaman anındaki metrik ve skor kaydı.
    Gerçek analizden veya provider sync'ten oluşturulur — fake veri yok.
    """
    __tablename__ = "influencer_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    influencer_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("influencer_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Kaynak (gerçek veri güvencesi)
    source_analysis_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Sync kaynağı: "analysis" | "provider_sync" | "provider_analyze"
    source_type: Mapped[str] = mapped_column(String(30), default="analysis", nullable=False)

    # Metrikler — gerçek analizden / provider'dan kopyalanır
    followers:       Mapped[int]   = mapped_column(Integer, default=0)
    following:       Mapped[int]   = mapped_column(Integer, default=0)
    avg_views:       Mapped[int]   = mapped_column(Integer, default=0)
    avg_likes:       Mapped[int]   = mapped_column(Integer, default=0)
    avg_comments:    Mapped[int]   = mapped_column(Integer, default=0)
    engagement_rate: Mapped[float] = mapped_column(Float,   default=0.0)

    # Skorlar — gerçek analizden / score_engine'den kopyalanır
    final_score:              Mapped[int] = mapped_column(Integer, default=0)
    fraud_score:              Mapped[int] = mapped_column(Integer, default=0)
    authenticity_score:       Mapped[int] = mapped_column(Integer, default=0)
    momentum_score:           Mapped[int] = mapped_column(Integer, default=0)
    brand_fit_score:          Mapped[int] = mapped_column(Integer, default=0)
    roi_potential_score:      Mapped[int] = mapped_column(Integer, default=0)
    engagement_quality_score: Mapped[int] = mapped_column(Integer, default=0)
    reputation_risk_score:    Mapped[int] = mapped_column(Integer, default=0)
    fraud_risk: Mapped[str]  = mapped_column(String(20),  default="Low")
    decision:   Mapped[str]  = mapped_column(String(100), default="")


# ─── InfluencerImportLog ──────────────────────────────────────────────────────

class InfluencerImportLog(Base):
    """JSON import işlemlerinin log kaydı."""
    __tablename__ = "influencer_import_logs"

    id:               Mapped[int]           = mapped_column(Integer, primary_key=True, index=True)
    filename:         Mapped[str]           = mapped_column(String(500), nullable=False)
    total_records:    Mapped[int]           = mapped_column(Integer, default=0)
    created_count:    Mapped[int]           = mapped_column(Integer, default=0)
    updated_count:    Mapped[int]           = mapped_column(Integer, default=0)
    skipped_count:    Mapped[int]           = mapped_column(Integer, default=0)
    error_count:      Mapped[int]           = mapped_column(Integer, default=0)
    created_at:       Mapped[datetime]      = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
