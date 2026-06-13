"""
Tüm modeller burada import edilir.
Base.metadata.create_all() tüm tabloları bu sayede görür.
"""
from app.models.user import User, PlanType
from app.models.analysis import Analysis, Platform
from app.models.campaign import Campaign, CampaignStatus
from app.models.watchlist import WatchlistItem
from app.models.admin_models import AuditLog, SupportTicket, Package, Payment

# ── AI Orchestrator (Part 1) ──────────────────────────────────────────────────
from app.models.agent import (
    Agent, AgentTask, AgentRun,
    AgentConversation, AgentMessage,
    AgentApproval, AgentMemory, AgentProviderHealth,
    AgentStatus, ModelProvider, RiskLevel,
    TaskStatus, TaskPriority,
    SenderType, MessageType,
    ApprovalStatus, ProviderHealthStatus,
)

# ── Influencer Archive (Part 2) ──────────────────────────────────────────────
from app.models.influencer_archive import (
    InfluencerProfile, InfluencerSnapshot, SyncStatus,
    InfluencerImportLog,
)

# ── Digital Twin (Part 12) ───────────────────────────────────────────────────
from app.models.digital_twin import (
    InfluencerDigitalTwin, TwinForecast, TwinSignal,
    ConfidenceLevel, RiskTrend, StabilityTrend, CampaignReadiness,
)

# ── Competitor Intelligence (Part 13) ────────────────────────────────────────
from app.models.competitor_intelligence import (
    CompetitorProfile, CompetitorCampaignSignal, CompetitorReportCache,
)

# ── Risk Radar (Part 15 + 17) ────────────────────────────────────────────────
from app.models.risk_radar import (
    InfluencerRiskReport, RiskAlert, RiskScanLog,
    AlertStatus, AlertSource,
)

# ── Intelligence Billing (Part 16) ───────────────────────────────────────────
from app.models.intelligence_billing import (
    IntelligenceFeature, IntelligenceUsageLog, UsageStatus,
)

# ── Brand Analysis (Part 22) ──────────────────────────────────────────────────
from app.models.brand_analysis import BrandAnalysisSnapshot

# ── Live Influencer Discovery (Part 24) ───────────────────────────────────────
from app.models.influencer_discovery import InfluencerDiscoveryRun, InfluencerDiscoveryCandidate

__all__ = [
    "User", "PlanType",
    "Analysis", "Platform",
    "Campaign", "CampaignStatus",
    "WatchlistItem",
    "AuditLog", "SupportTicket", "Package", "Payment",
    "Agent", "AgentTask", "AgentRun",
    "AgentConversation", "AgentMessage",
    "AgentApproval", "AgentMemory", "AgentProviderHealth",
    "AgentStatus", "ModelProvider", "RiskLevel",
    "TaskStatus", "TaskPriority",
    "SenderType", "MessageType",
    "ApprovalStatus", "ProviderHealthStatus",
    "InfluencerProfile", "InfluencerSnapshot", "SyncStatus",
    "InfluencerImportLog",
    "InfluencerDigitalTwin", "TwinForecast", "TwinSignal",
    "ConfidenceLevel", "RiskTrend", "StabilityTrend", "CampaignReadiness",
    "CompetitorProfile", "CompetitorCampaignSignal", "CompetitorReportCache",
    "InfluencerRiskReport", "RiskAlert", "RiskScanLog",
    "AlertStatus", "AlertSource",
    "IntelligenceFeature", "IntelligenceUsageLog", "UsageStatus",
    "BrandAnalysisSnapshot",
    "InfluencerDiscoveryRun", "InfluencerDiscoveryCandidate",
]
