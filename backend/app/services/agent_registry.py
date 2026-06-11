"""
Agent Registry — Ajan kayıtlarını yönetir ve seed eder.
Part 11: Adds department, mode, schedule_cron, is_scheduled, autonomy_level.
Idempotent: mevcut slug varsa metadata günceller, yoksa ekler.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.agent import (
    Agent, AgentProviderHealth, AgentMode,
    AgentStatus, ModelProvider, RiskLevel, ProviderHealthStatus,
)

logger = logging.getLogger(__name__)

# ── Department constants ──────────────────────────────────────────────────────
DEPT_EXECUTIVE  = "executive"
DEPT_PRODUCT    = "product"
DEPT_ENGINEERING= "engineering"
DEPT_ANALYSIS   = "analysis"
DEPT_CAMPAIGN   = "campaign"
DEPT_GROWTH     = "growth"
DEPT_ARCHIVE    = "archive"
DEPT_INTEL      = "intel"

# ── All Agent Definitions ─────────────────────────────────────────────────────

ALL_AGENTS = [
    # ── Executive ─────────────────────────────────────────────────────────────
    {
        "slug": "ceo-orchestrator",
        "name": "CEO / Orchestrator Agent",
        "role": "orchestrator",
        "department": DEPT_EXECUTIVE,
        "risk_level": RiskLevel.MEDIUM,
        "model_name": "ceo-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": True,
        "schedule_cron": "weekly",
        "description": "Tüm ajanları koordine eder, görev dağılımı yapar ve final kararları verir.",
    },
    # ── Product ───────────────────────────────────────────────────────────────
    {
        "slug": "product-manager",
        "name": "Product Manager Agent",
        "role": "product",
        "department": DEPT_PRODUCT,
        "risk_level": RiskLevel.LOW,
        "model_name": "pm-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Ürün özelliklerini ve öncelikleri yönetir. Roadmap önerileri oluşturur.",
    },
    # ── Engineering ───────────────────────────────────────────────────────────
    {
        "slug": "dev-agent",
        "name": "Dev Agent",
        "role": "developer",
        "department": DEPT_ENGINEERING,
        "risk_level": RiskLevel.MEDIUM,
        "model_name": "dev-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Kod değişiklik planlaması ve teknik iyileştirme önerileri sunar.",
    },
    {
        "slug": "qa-test-agent",
        "name": "QA / Test Agent",
        "role": "qa",
        "department": DEPT_ENGINEERING,
        "risk_level": RiskLevel.LOW,
        "model_name": "qa-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Kalite kontrol ve test senaryoları oluşturur.",
    },
    {
        "slug": "ops-agent",
        "name": "Ops Agent",
        "role": "operations",
        "department": DEPT_ENGINEERING,
        "risk_level": RiskLevel.LOW,
        "model_name": "ops-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": True,
        "schedule_cron": "hourly",
        "description": "Sistem sağlığını izler ve operasyonel metrikleri raporlar.",
    },
    {
        "slug": "legal-compliance-agent",
        "name": "Legal / Compliance Agent",
        "role": "legal",
        "department": DEPT_ENGINEERING,
        "risk_level": RiskLevel.HIGH,
        "model_name": "legal-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": True,
        "schedule_cron": "daily",
        "description": "Yasal uyumluluk ve yüksek riskli işlemleri kontrol eder.",
    },
    {
        "slug": "finance-pricing-agent",
        "name": "Finance / Pricing Agent",
        "role": "finance",
        "department": DEPT_EXECUTIVE,
        "risk_level": RiskLevel.HIGH,
        "model_name": "finance-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": True,
        "schedule_cron": "daily",
        "description": "Fiyatlandırma, maliyet ve finansal analiz yapar.",
    },
    # ── Analysis ──────────────────────────────────────────────────────────────
    {
        "slug": "analysis-agent",
        "name": "Analysis Agent",
        "role": "analysis",
        "department": DEPT_ANALYSIS,
        "risk_level": RiskLevel.LOW,
        "model_name": "analysis-deepseek",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Influencer analizini yorumlar. Score engine çıktılarını zenginleştirir.",
    },
    {
        "slug": "fraud-agent",
        "name": "Fraud Detection Agent",
        "role": "fraud",
        "department": DEPT_ANALYSIS,
        "risk_level": RiskLevel.LOW,
        "model_name": "fraud-deepseek",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Sahte takipçi, bot aktivitesi ve etkileşim manipülasyonunu tespit eder.",
    },
    {
        "slug": "audience-agent",
        "name": "Audience Intelligence Agent",
        "role": "audience",
        "department": DEPT_ANALYSIS,
        "risk_level": RiskLevel.LOW,
        "model_name": "audience-deepseek",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Kitle kalitesi yorumlaması. Gerçek veri yoksa açık not üretir.",
    },
    {
        "slug": "brand-fit-agent",
        "name": "Brand Fit Agent",
        "role": "brand_fit",
        "department": DEPT_ANALYSIS,
        "risk_level": RiskLevel.LOW,
        "model_name": "brandfit-openai",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Marka-influencer uyumunu yorumlar. Brand safety uyarısı üretir.",
    },
    {
        "slug": "roi-prediction-agent",
        "name": "ROI Prediction Agent",
        "role": "roi",
        "department": DEPT_ANALYSIS,
        "risk_level": RiskLevel.LOW,
        "model_name": "roi-deepseek",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "ROI tahmin skorlarını kampanya bağlamında yorumlar.",
    },
    # ── Campaign ──────────────────────────────────────────────────────────────
    {
        "slug": "campaign-planner-agent",
        "name": "Campaign Planner Agent",
        "role": "campaign",
        "department": DEPT_CAMPAIGN,
        "risk_level": RiskLevel.LOW,
        "model_name": "campaign-openai",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Kampanya için AI plan özeti, creator mix ve budget split üretir.",
    },
    {
        "slug": "similar-creator-agent",
        "name": "Similar Creator Agent",
        "role": "discovery",
        "department": DEPT_CAMPAIGN,
        "risk_level": RiskLevel.LOW,
        "model_name": "similar-deepseek",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Benzer creator önerilerini gerekçelendirir.",
    },
    {
        "slug": "report-agent",
        "name": "Report Agent",
        "role": "report",
        "department": DEPT_CAMPAIGN,
        "risk_level": RiskLevel.LOW,
        "model_name": "report-claude",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": True,
        "schedule_cron": "weekly",
        "description": "Kurumsal premium rapor dili üretir. Executive summary + karar.",
    },
    # ── Growth ────────────────────────────────────────────────────────────────
    {
        "slug": "growth-director-agent",
        "name": "Growth Director Agent",
        "role": "growth",
        "department": DEPT_GROWTH,
        "risk_level": RiskLevel.LOW,
        "model_name": "growth-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "SEO, Ads, Lead ve Sales ajanlarını koordine eder.",
    },
    {
        "slug": "seo-agent",
        "name": "SEO Agent",
        "role": "seo",
        "department": DEPT_GROWTH,
        "risk_level": RiskLevel.LOW,
        "model_name": "seo-openai",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": True,
        "schedule_cron": "daily",
        "description": "Blog başlıkları, keyword cluster, teknik SEO checklist üretir.",
    },
    {
        "slug": "ads-agent",
        "name": "Ads Agent",
        "role": "ads",
        "department": DEPT_GROWTH,
        "risk_level": RiskLevel.MEDIUM,
        "model_name": "ads-openai",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Reklam kopyaları ve hedef kitle önerileri. Reklam yayına almaz.",
    },
    {
        "slug": "lead-finder-agent",
        "name": "Lead Finder Agent",
        "role": "lead_finder",
        "department": DEPT_GROWTH,
        "risk_level": RiskLevel.MEDIUM,
        "model_name": "lead-deepseek",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "ICP tanımı, segment önceliklendirme, lead scoring mantığı. Scraping yapmaz.",
    },
    {
        "slug": "sales-agent",
        "name": "Sales Agent",
        "role": "sales",
        "department": DEPT_GROWTH,
        "risk_level": RiskLevel.LOW,
        "model_name": "sales-openai",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Satış mesajı ve teklif taslağı. Gönderim için insan onayı gerekir.",
    },
    {
        "slug": "support-agent",
        "name": "Support Agent",
        "role": "support",
        "department": DEPT_GROWTH,
        "risk_level": RiskLevel.LOW,
        "model_name": "support-openai",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Destek talebi özetler ve yanıt taslağı üretir. Otomatik göndermez.",
    },
    # ── Archive ───────────────────────────────────────────────────────────────
    {
        "slug": "archive-category-agent",
        "name": "Archive Category Agent",
        "role": "archive_ai",
        "department": DEPT_ARCHIVE,
        "risk_level": RiskLevel.LOW,
        "model_name": "archive-cat-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Bio/username'den kategori tahmini üretir. Archive profillerini etiketler.",
    },
    {
        "slug": "archive-trend-agent",
        "name": "Archive Trend Agent",
        "role": "archive_ai",
        "department": DEPT_ARCHIVE,
        "risk_level": RiskLevel.LOW,
        "model_name": "archive-trend-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": True,
        "schedule_cron": "daily",
        "description": "Snapshot geçmişi üzerinden büyüme trendlerini tespit eder.",
    },
    {
        "slug": "archive-classifier",
        "name": "Influencer Classifier Agent",
        "role": "archive_ai",
        "department": DEPT_ARCHIVE,
        "risk_level": RiskLevel.LOW,
        "model_name": "archive-cls-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Nano/Micro/Macro/Mega tier sınıflandırması yapar.",
    },
    {
        "slug": "archive-cleaner-agent",
        "name": "Archive Cleaner Agent",
        "role": "archive_ai",
        "department": DEPT_ARCHIVE,
        "risk_level": RiskLevel.HIGH,
        "model_name": "archive-clean-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Eski/çakışan profilleri tespit eder. Silme için human approval gerektirir.",
    },
    # ── Intel ─────────────────────────────────────────────────────────────────
    {
        "slug": "competitor-intel-agent",
        "name": "Competitor Intelligence Agent",
        "role": "intel",
        "department": DEPT_INTEL,
        "risk_level": RiskLevel.LOW,
        "model_name": "intel-gemini",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": "Rakip analizi, fırsat tespiti ve influencer gap analizi.",
    },
    # ── Part 11: New Agents ────────────────────────────────────────────────────
    {
        "slug": "security-agent",
        "name": "Security Agent",
        "role": "security",
        "department": DEPT_ENGINEERING,
        "risk_level": RiskLevel.HIGH,
        "model_name": "security-claude",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": True,
        "schedule_cron": "daily",
        "description": "Secret leak tespiti, auth/rate limit/JWT riskleri, admin güvenliği ve suspicious activity izleme.",
    },
    {
        "slug": "cto-agent",
        "name": "CTO / Technical Architect Agent",
        "role": "cto",
        "department": DEPT_ENGINEERING,
        "risk_level": RiskLevel.MEDIUM,
        "model_name": "cto-claude",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": True,
        "schedule_cron": "weekly",
        "description": "Teknik mimari incelemesi, technical debt analizi, broken API tespiti, scalability riskleri.",
    },
    {
        "slug": "data-quality-agent",
        "name": "Data Quality Agent",
        "role": "data_quality",
        "department": DEPT_ARCHIVE,
        "risk_level": RiskLevel.LOW,
        "model_name": "data-quality-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "autonomous",
        "is_scheduled": True,
        "schedule_cron": "daily",
        "description": "Influencer archive veri kalitesi: duplicate tespiti, eksik avatar/country/category, snapshot freshness.",
    },
    # ── Part 12: Digital Twin ─────────────────────────────────────────────────
    {
        "slug": "digital-twin-agent",
        "name": "Digital Twin Agent",
        "role": "digital_twin",
        "department": DEPT_INTEL,
        "risk_level": RiskLevel.LOW,
        "model_name": "digital-twin-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": True,
        "schedule_cron": "daily",
        "description": "Influencer Digital Twin™: snapshot geçmişini analiz eder, büyüme/risk/engagement tahminleri üretir.",
    },
    # ── Part 13: Competitor Intelligence ──────────────────────────────────────
    {
        "slug": "competitor-intelligence-agent",
        "name": "Competitor Intelligence Agent™",
        "role": "market_intelligence",
        "department": DEPT_INTEL,
        "risk_level": RiskLevel.LOW,
        "model_name": "competitor-intel-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": False,
        "schedule_cron": None,
        "description": (
            "Rakip markaların influencer stratejilerini analiz eder. "
            "Creator portfolio, platform dağılımı, harcama tahmini (range-based, kanıta dayalı), "
            "tier gap ve stratejik fırsatları tespit eder. Mock modunda deterministik."
        ),
    },
    # ── Part 15: Risk Radar ────────────────────────────────────────────────────
    {
        "slug": "risk-radar-agent",
        "name": "Risk Radar Agent™",
        "role": "trust_safety",
        "department": "trust_safety",
        "risk_level": RiskLevel.MEDIUM,
        "model_name": "risk-radar-v1",
        "is_enabled": True,
        "mode": AgentMode.MOCK,
        "autonomy_level": "supervised",
        "is_scheduled": True,
        "schedule_cron": "daily",
        "description": (
            "Behavioral Brand Safety Intelligence: creator risk scoring, anomaly detection, "
            "brand alignment monitoring, audience quality analysis. Evidence-based, no ideology profiling. "
            "Escalates HIGH/CRITICAL risk creators to CEO. Daily scheduled scan."
        ),
    },
]

ALL_PROVIDERS = [
    "mock", "claude", "openai", "deepseek", "gemini",
    "youtube", "apify", "instagram", "tiktok",
]


def _schedule_next_run(cron: str | None) -> datetime | None:
    """Calculate next_run_at from a schedule string."""
    if not cron:
        return None
    now = datetime.now(timezone.utc)
    if cron == "hourly":
        return now + timedelta(hours=1)
    if cron == "daily":
        return now + timedelta(days=1)
    if cron == "weekly":
        return now + timedelta(weeks=1)
    # Default: 24h
    return now + timedelta(days=1)


async def seed_agents(session: AsyncSession) -> None:
    """
    Seed agents idempotently.
    Existing slugs: update department, mode, schedule fields.
    Missing slugs: insert new record.
    """
    result = await session.execute(select(Agent))
    existing: dict[str, Agent] = {a.slug: a for a in result.scalars().all()}

    added = updated = 0
    for data in ALL_AGENTS:
        slug = data["slug"]
        if slug in existing:
            agent = existing[slug]
            # Update new Part 11 fields on existing agents
            if agent.department != data.get("department"):
                agent.department = data.get("department")
                updated += 1
            if agent.is_scheduled != data.get("is_scheduled", False):
                agent.is_scheduled = data.get("is_scheduled", False)
                if agent.is_scheduled and agent.next_run_at is None:
                    agent.next_run_at = _schedule_next_run(data.get("schedule_cron"))
                updated += 1
            if agent.schedule_cron != data.get("schedule_cron"):
                agent.schedule_cron = data.get("schedule_cron")
                updated += 1
            if agent.autonomy_level != data.get("autonomy_level", "supervised"):
                agent.autonomy_level = data.get("autonomy_level", "supervised")
                updated += 1
        else:
            agent = Agent(
                slug=slug,
                name=data["name"],
                description=data.get("description"),
                role=data["role"],
                department=data.get("department"),
                status=AgentStatus.IDLE,
                mode=data.get("mode", AgentMode.MOCK),
                model_provider=ModelProvider.MOCK,
                model_name=data["model_name"],
                risk_level=data["risk_level"],
                is_enabled=data["is_enabled"],
                is_scheduled=data.get("is_scheduled", False),
                schedule_cron=data.get("schedule_cron"),
                autonomy_level=data.get("autonomy_level", "supervised"),
                health_status="unknown",
                failure_count=0,
            )
            if agent.is_scheduled:
                agent.next_run_at = _schedule_next_run(data.get("schedule_cron"))
            session.add(agent)
            added += 1

    # Provider health records
    ph_result = await session.execute(select(AgentProviderHealth.provider))
    existing_providers = {row[0] for row in ph_result.all()}
    for provider in ALL_PROVIDERS:
        if provider not in existing_providers:
            session.add(AgentProviderHealth(
                provider=provider,
                status=ProviderHealthStatus.HEALTHY if provider == "mock" else ProviderHealthStatus.UNKNOWN,
            ))

    if added or updated:
        await session.flush()
        logger.info("✓ Agents seed: %d eklendi, %d güncellendi (toplam: %d).",
                    added, updated, len(ALL_AGENTS))
    else:
        logger.info("✓ Agent seed kontrolü tamam (tüm %d agent mevcut).", len(ALL_AGENTS))


async def get_agent_by_slug(session: AsyncSession, slug: str) -> Agent | None:
    result = await session.execute(select(Agent).where(Agent.slug == slug))
    return result.scalar_one_or_none()


async def get_agent_by_id(session: AsyncSession, agent_id: int) -> Agent | None:
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    return result.scalar_one_or_none()


async def list_agents(session: AsyncSession, enabled_only: bool = False) -> list[Agent]:
    q = select(Agent).order_by(Agent.department, Agent.id)
    if enabled_only:
        q = q.where(Agent.is_enabled == True)
    result = await session.execute(q)
    return list(result.scalars().all())
