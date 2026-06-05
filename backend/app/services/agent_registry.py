"""
Agent Registry — Ajan kayıtlarını yönetir ve seed eder.
Idempotent: mevcut slug varsa atlar, yoksa ekler.
"""
from __future__ import annotations

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.agent import (
    Agent, AgentProviderHealth,
    AgentStatus, ModelProvider, RiskLevel, ProviderHealthStatus,
)

logger = logging.getLogger(__name__)

# ── Tüm Agent Tanımları ───────────────────────────────────────────────────────

ALL_AGENTS = [
    # ── Part 1-3 core ────────────────────────────────────────────────────────
    {"slug": "ceo-orchestrator",       "name": "CEO / Orchestrator Agent",    "role": "orchestrator", "risk_level": RiskLevel.MEDIUM, "model_name": "ceo-v1",           "is_enabled": True, "description": "Tüm ajanları koordine eder, görev dağılımı yapar ve final kararları verir."},
    {"slug": "product-manager",        "name": "Product Manager Agent",       "role": "product",      "risk_level": RiskLevel.LOW,    "model_name": "pm-v1",            "is_enabled": True, "description": "Ürün özelliklerini ve öncelikleri yönetir. Roadmap önerileri oluşturur."},
    {"slug": "dev-agent",              "name": "Dev Agent",                   "role": "developer",    "risk_level": RiskLevel.MEDIUM, "model_name": "dev-v1",           "is_enabled": True, "description": "Kod değişiklik planlaması ve teknik iyileştirme önerileri sunar."},
    {"slug": "qa-test-agent",          "name": "QA / Test Agent",             "role": "qa",           "risk_level": RiskLevel.LOW,    "model_name": "qa-v1",            "is_enabled": True, "description": "Kalite kontrol ve test senaryoları oluşturur."},
    {"slug": "ops-agent",              "name": "Ops Agent",                   "role": "operations",   "risk_level": RiskLevel.LOW,    "model_name": "ops-v1",           "is_enabled": True, "description": "Sistem sağlığını izler ve operasyonel metrikleri raporlar."},
    {"slug": "legal-compliance-agent", "name": "Legal / Compliance Agent",    "role": "legal",        "risk_level": RiskLevel.HIGH,   "model_name": "legal-v1",         "is_enabled": True, "description": "Yasal uyumluluk ve yüksek riskli işlemleri kontrol eder."},
    {"slug": "finance-pricing-agent",  "name": "Finance / Pricing Agent",     "role": "finance",      "risk_level": RiskLevel.HIGH,   "model_name": "finance-v1",       "is_enabled": True, "description": "Fiyatlandırma, maliyet ve finansal analiz yapar."},
    # ── Part 4 analysis ──────────────────────────────────────────────────────
    {"slug": "analysis-agent",         "name": "Analysis Agent",              "role": "analysis",     "risk_level": RiskLevel.LOW,    "model_name": "analysis-deepseek", "is_enabled": True, "description": "Influencer analizini yorumlar. Score engine çıktılarını zenginleştirir."},
    {"slug": "fraud-agent",            "name": "Fraud Detection Agent",       "role": "fraud",        "risk_level": RiskLevel.LOW,    "model_name": "fraud-deepseek",   "is_enabled": True, "description": "Sahte takipçi, bot aktivitesi ve etkileşim manipülasyonunu tespit eder."},
    {"slug": "audience-agent",         "name": "Audience Intelligence Agent", "role": "audience",     "risk_level": RiskLevel.LOW,    "model_name": "audience-deepseek","is_enabled": True, "description": "Kitle kalitesi yorumlaması. Gerçek veri yoksa açık not üretir."},
    {"slug": "brand-fit-agent",        "name": "Brand Fit Agent",             "role": "brand_fit",    "risk_level": RiskLevel.LOW,    "model_name": "brandfit-openai",  "is_enabled": True, "description": "Marka-influencer uyumunu yorumlar. Brand safety uyarısı üretir."},
    {"slug": "roi-prediction-agent",   "name": "ROI Prediction Agent",        "role": "roi",          "risk_level": RiskLevel.LOW,    "model_name": "roi-deepseek",     "is_enabled": True, "description": "ROI tahmin skorlarını kampanya bağlamında yorumlar."},
    # ── Part 4 campaign/report ────────────────────────────────────────────────
    {"slug": "campaign-planner-agent", "name": "Campaign Planner Agent",      "role": "campaign",     "risk_level": RiskLevel.LOW,    "model_name": "campaign-openai",  "is_enabled": True, "description": "Kampanya için AI plan özeti, creator mix ve budget split üretir."},
    {"slug": "similar-creator-agent",  "name": "Similar Creator Agent",       "role": "discovery",    "risk_level": RiskLevel.LOW,    "model_name": "similar-deepseek", "is_enabled": True, "description": "Benzer creator önerilerini gerekçelendirir."},
    {"slug": "report-agent",           "name": "Report Agent",                "role": "report",       "risk_level": RiskLevel.LOW,    "model_name": "report-claude",    "is_enabled": True, "description": "Kurumsal premium rapor dili üretir. Executive summary + karar."},
    # ── Part 4 growth ─────────────────────────────────────────────────────────
    {"slug": "growth-director-agent",  "name": "Growth Director Agent",       "role": "growth",       "risk_level": RiskLevel.LOW,    "model_name": "growth-v1",        "is_enabled": True, "description": "SEO, Ads, Lead ve Sales ajanlarını koordine eder."},
    {"slug": "seo-agent",              "name": "SEO Agent",                   "role": "seo",          "risk_level": RiskLevel.LOW,    "model_name": "seo-openai",       "is_enabled": True, "description": "Blog başlıkları, keyword cluster, teknik SEO checklist üretir."},
    {"slug": "ads-agent",              "name": "Ads Agent",                   "role": "ads",          "risk_level": RiskLevel.MEDIUM, "model_name": "ads-openai",       "is_enabled": True, "description": "Reklam kopyaları ve hedef kitle önerileri. Reklam yayına almaz."},
    {"slug": "lead-finder-agent",      "name": "Lead Finder Agent",           "role": "lead_finder",  "risk_level": RiskLevel.MEDIUM, "model_name": "lead-deepseek",    "is_enabled": True, "description": "ICP tanımı, segment önceliklendirme, lead scoring mantığı. Scraping yapmaz."},
    {"slug": "sales-agent",            "name": "Sales Agent",                 "role": "sales",        "risk_level": RiskLevel.LOW,    "model_name": "sales-openai",     "is_enabled": True, "description": "Satış mesajı ve teklif taslağı. Gönderim için insan onayı gerekir."},
    {"slug": "support-agent",          "name": "Support Agent",               "role": "support",      "risk_level": RiskLevel.LOW,    "model_name": "support-openai",   "is_enabled": True, "description": "Destek talebi özetler ve yanıt taslağı üretir. Otomatik göndermez."},
    # ── Part 2 — Archive AI + Competitor Intel + Campaign Copilot ─────────────
    {"slug": "archive-category-agent", "name": "Archive Category Agent",      "role": "archive_ai",   "risk_level": RiskLevel.LOW,    "model_name": "archive-cat-v1",   "is_enabled": True, "description": "Bio/username'den kategori tahmini üretir. Archive profillerini etiketler."},
    {"slug": "archive-trend-agent",    "name": "Archive Trend Agent",         "role": "archive_ai",   "risk_level": RiskLevel.LOW,    "model_name": "archive-trend-v1", "is_enabled": True, "description": "Snapshot geçmişi üzerinden büyüme trendlerini tespit eder."},
    {"slug": "archive-classifier",     "name": "Influencer Classifier Agent", "role": "archive_ai",   "risk_level": RiskLevel.LOW,    "model_name": "archive-cls-v1",   "is_enabled": True, "description": "Nano/Micro/Macro/Mega tier sınıflandırması yapar."},
    {"slug": "archive-cleaner-agent",  "name": "Archive Cleaner Agent",       "role": "archive_ai",   "risk_level": RiskLevel.HIGH,   "model_name": "archive-clean-v1", "is_enabled": True, "description": "Eski/çakışan profilleri tespit eder. Silme için human approval gerektirir."},
    {"slug": "competitor-intel-agent", "name": "Competitor Intelligence Agent","role": "intel",        "risk_level": RiskLevel.LOW,    "model_name": "intel-gemini",     "is_enabled": True, "description": "Rakip analizi, fırsat tespiti ve influencer gap analizi."},
]

ALL_PROVIDERS = [
    "mock", "claude", "openai", "deepseek", "gemini",
    "youtube", "apify", "instagram", "tiktok",
]


async def seed_agents(session: AsyncSession) -> None:
    """
    Tüm ajanları idempotent şekilde seed eder.
    Var olan slug'ları atlar, eksik olanları ekler.
    """
    # Mevcut slug'ları yükle
    result = await session.execute(select(Agent.slug))
    existing_slugs = {row[0] for row in result.all()}

    added = 0
    for data in ALL_AGENTS:
        if data["slug"] in existing_slugs:
            continue
        agent = Agent(
            slug=data["slug"],
            name=data["name"],
            description=data.get("description"),
            role=data["role"],
            status=AgentStatus.IDLE,
            model_provider=ModelProvider.MOCK,
            model_name=data["model_name"],
            risk_level=data["risk_level"],
            is_enabled=data["is_enabled"],
        )
        session.add(agent)
        added += 1

    # Provider health
    ph_result = await session.execute(select(AgentProviderHealth.provider))
    existing_providers = {row[0] for row in ph_result.all()}
    for provider in ALL_PROVIDERS:
        if provider not in existing_providers:
            session.add(AgentProviderHealth(
                provider=provider,
                status=ProviderHealthStatus.HEALTHY if provider == "mock" else ProviderHealthStatus.UNKNOWN,
            ))

    if added:
        await session.flush()
        logger.info("✓ %d yeni agent eklendi (toplam: %d).", added, len(ALL_AGENTS))
    else:
        logger.info("✓ Agent seed kontrolü tamam (tüm %d agent mevcut).", len(existing_slugs))


async def get_agent_by_slug(session: AsyncSession, slug: str) -> Agent | None:
    result = await session.execute(select(Agent).where(Agent.slug == slug))
    return result.scalar_one_or_none()


async def get_agent_by_id(session: AsyncSession, agent_id: int) -> Agent | None:
    result = await session.execute(select(Agent).where(Agent.id == agent_id))
    return result.scalar_one_or_none()


async def list_agents(session: AsyncSession, enabled_only: bool = False) -> list[Agent]:
    q = select(Agent).order_by(Agent.id)
    if enabled_only:
        q = q.where(Agent.is_enabled == True)
    result = await session.execute(q)
    return list(result.scalars().all())
