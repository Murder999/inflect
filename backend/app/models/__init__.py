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
]
