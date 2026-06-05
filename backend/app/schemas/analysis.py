from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

Platform = Literal["instagram", "tiktok", "youtube"]


class AnalyzeRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=100)
    platform: Platform
    brand: Optional[str] = Field("Genel Marka", max_length=200)


class DiscoveryRequest(BaseModel):
    platform: Optional[Platform] = None
    category: Optional[str] = None
    country: Optional[str] = "Türkiye"
    min_followers: int = Field(default=0, ge=0)
    max_fraud: int = Field(default=100, ge=0, le=100)
    min_brand_fit: int = Field(default=0, ge=0, le=100)
    limit: int = Field(default=20, ge=1, le=50)


class CampaignCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    handles: List[str] = Field(..., min_length=1, max_length=20)
    platform: Platform
    brand: Optional[str] = Field("Genel Marka", max_length=200)


class AnalysisSummary(BaseModel):
    id: int
    username: str
    platform: str
    brand: Optional[str] = None
    final_score: int
    fraud_score: int
    decision: str
    followers: int
    engagement_rate: float
    created_at: datetime

    model_config = {"from_attributes": True}
