"""
Agent Factory — Slug'a göre doğru agent class'ını döndürür.
Part 4: Tüm 18 ajan + ek ajanlar kayıtlı.
"""
from __future__ import annotations
from typing import TYPE_CHECKING, Optional, Type

if TYPE_CHECKING:
    from app.services.agents.base_agent import BaseAgent

# Lazy import — circular import önlemi
_REGISTRY: dict[str, str] = {
    # ── Part 3 core agents ───────────────────────────────────────────────────
    "ceo-orchestrator":       "app.services.agents.ceo_agent:CeoAgent",
    "product-manager":        "app.services.agents.product_manager_agent:ProductManagerAgent",
    "ops-agent":              "app.services.agents.ops_agent:OpsAgent",
    "dev-agent":              "app.services.agents.dev_agent:DevAgent",
    "qa-test-agent":          "app.services.agents.qa_agent:QaAgent",
    "legal-compliance-agent": "app.services.agents.legal_agent:LegalAgent",
    "finance-pricing-agent":  "app.services.agents.finance_agent:FinanceAgent",

    # ── Part 4 analysis agents ───────────────────────────────────────────────
    "analysis-agent":         "app.services.agents.analysis_agents:AnalysisAgent",
    "fraud-agent":            "app.services.agents.analysis_agents:FraudAgent",
    "audience-agent":         "app.services.agents.analysis_agents:AudienceAgent",
    "brand-fit-agent":        "app.services.agents.analysis_agents:BrandFitAgent",
    "roi-prediction-agent":   "app.services.agents.analysis_agents:RoiAgent",

    # ── Part 4 campaign/report agents ────────────────────────────────────────
    "campaign-planner-agent": "app.services.agents.campaign_agents:CampaignPlannerAgent",
    "similar-creator-agent":  "app.services.agents.campaign_agents:SimilarCreatorAgent",
    "report-agent":           "app.services.agents.campaign_agents:ReportAgent",

    # ── Part 4 growth agents ──────────────────────────────────────────────────
    "growth-director-agent":  "app.services.agents.growth_agents:GrowthDirectorAgent",
    "seo-agent":              "app.services.agents.growth_agents:SeoAgent",
    "ads-agent":              "app.services.agents.growth_agents:AdsAgent",
    "lead-finder-agent":      "app.services.agents.growth_agents:LeadFinderAgent",
    "sales-agent":            "app.services.agents.growth_agents:SalesAgent",
    "support-agent":          "app.services.agents.growth_agents:SupportAiAgent",
    # ── Part 2 archive AI + competitor intel ───────────────────────────────────────────
    "archive-category-agent": "app.services.agents.archive_ai_agents:ArchiveCategoryAgent",
    "archive-trend-agent":    "app.services.agents.archive_ai_agents:ArchiveTrendAgent",
    "archive-classifier":     "app.services.agents.archive_ai_agents:InfluencerClassifierAgent",
    "archive-cleaner-agent":  "app.services.agents.archive_ai_agents:ArchiveCleanerAgent",
    "competitor-intel-agent": "app.services.agents.campaign_agents:CompetitorIntelAgent",
    # ── Part 11 new agents ────────────────────────────────────────────────────────
    "security-agent":         "app.services.agents.security_agent:SecurityAgent",
    "cto-agent":              "app.services.agents.cto_agent:CtoAgent",
    "data-quality-agent":     "app.services.agents.data_quality_agent:DataQualityAgent",
    # ── Part 12 Digital Twin ──────────────────────────────────────────────────────
    "digital-twin-agent":     "app.services.agents.digital_twin_agent:DigitalTwinAgent",
    # ── Part 13 Competitor Intelligence ──────────────────────────────────────────
    "competitor-intelligence-agent": "app.services.agents.competitor_intelligence_agent:CompetitorIntelligenceAgent",
    # ── Part 15 Risk Radar ────────────────────────────────────────────────────────
    "risk-radar-agent":              "app.services.agents.risk_radar_agent:RiskRadarAgent",
}

# Provider assignment (model routing guide)
PROVIDER_MAP: dict[str, str] = {
    # Claude — complex reasoning, final decisions
    "ceo-orchestrator":       "claude",
    "product-manager":        "claude",
    "dev-agent":              "claude",
    "qa-test-agent":          "claude",
    "report-agent":           "claude",
    "legal-compliance-agent": "claude",
    # OpenAI — user-facing, conversational
    "sales-agent":            "openai",
    "support-agent":          "openai",
    "seo-agent":              "openai",
    "ads-agent":              "openai",
    "brand-fit-agent":        "openai",
    "campaign-planner-agent": "openai",
    # DeepSeek — bulk, cost-efficient
    "analysis-agent":         "deepseek",
    "fraud-agent":            "deepseek",
    "audience-agent":         "deepseek",
    "roi-prediction-agent":   "deepseek",
    "lead-finder-agent":      "deepseek",
    "similar-creator-agent":  "deepseek",
    # Internal logic (no LLM needed)
    "ops-agent":              "mock",
    "finance-pricing-agent":  "mock",
    "growth-director-agent":  "mock",
    # Archive AI (no external LLM — rule-based)
    "archive-category-agent": "mock",
    "archive-trend-agent":    "mock",
    "archive-classifier":     "mock",
    "archive-cleaner-agent":  "mock",
    # Competitor Intel — Gemini (cost-efficient for analysis)
    "competitor-intel-agent": "gemini",
    # Part 11 — new agents
    "security-agent":         "claude",
    "cto-agent":              "claude",
    "data-quality-agent":     "mock",   # uses real DB, no LLM needed
    # Part 12 — Digital Twin (pure computation, no external LLM)
    "digital-twin-agent":     "mock",
    # Part 13 — Competitor Intelligence (archive-based, no external LLM in mock mode)
    "competitor-intelligence-agent": "mock",
    # Part 15 — Risk Radar (archive-based, no external LLM)
    "risk-radar-agent": "mock",
}


def get_agent_class_for_slug(slug: str) -> "Optional[Type[BaseAgent]]":
    """Slug'a göre agent class'ını dinamik olarak yükler."""
    path = _REGISTRY.get(slug)
    if not path:
        return None
    try:
        module_path, class_name = path.rsplit(":", 1)
        import importlib
        module = importlib.import_module(module_path)
        return getattr(module, class_name)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Agent class yüklenemedi %s: %s", slug, exc)
        return None


def get_provider_for_slug(slug: str) -> str:
    """Slug'a göre önerilen AI provider adını döndürür."""
    return PROVIDER_MAP.get(slug, "mock")


def get_supported_slugs() -> list[str]:
    return list(_REGISTRY.keys())
