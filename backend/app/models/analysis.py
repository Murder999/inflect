from sqlalchemy import String, Integer, DateTime, Float, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from typing import Optional
import enum
from app.core.database import Base


class Platform(str, enum.Enum):
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    YOUTUBE = "youtube"


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)

    username: Mapped[str] = mapped_column(String(255), index=True)
    platform: Mapped[Platform] = mapped_column(SAEnum(Platform))
    brand: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    profile_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=None)
    report_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=None)

    # 7 Scores
    final_score: Mapped[int] = mapped_column(Integer, default=0)
    authenticity_score: Mapped[int] = mapped_column(Integer, default=0)
    fraud_score: Mapped[int] = mapped_column(Integer, default=0)
    momentum_score: Mapped[int] = mapped_column(Integer, default=0)
    brand_fit_score: Mapped[int] = mapped_column(Integer, default=0)
    engagement_quality_score: Mapped[int] = mapped_column(Integer, default=0)
    roi_potential_score: Mapped[int] = mapped_column(Integer, default=0)
    reputation_risk_score: Mapped[int] = mapped_column(Integer, default=0)

    fraud_risk: Mapped[str] = mapped_column(String(20), default="Low")
    decision: Mapped[str] = mapped_column(String(100), default="")

    # Followers snapshot
    followers: Mapped[int] = mapped_column(Integer, default=0)
    engagement_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_views: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="analyses")
