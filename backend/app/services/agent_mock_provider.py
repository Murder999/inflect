"""
Agent Mock Provider — Part 11
All outputs clearly labeled is_mock=True.
Latency is estimated (not measured). Token counts are approximations.
No random confidence scores — mock outputs carry no confidence claim.
"""
from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

from app.models.agent import ModelProvider


def _estimated_latency() -> int:
    """Simulated latency for mock runs (not real measurement)."""
    return random.randint(80, 400)


def _estimated_tokens(prompt: str) -> tuple[int, int]:
    """Approximate token count — not an accurate measurement."""
    input_t  = max(10, len(prompt.split()) * 4 // 3)
    output_t = random.randint(50, 300)
    return input_t, output_t


def _mock_cost(input_t: int, output_t: int, provider: str = "mock") -> float:
    """Estimated cost (USD) — 0 for mock runs."""
    if provider == "mock":
        return 0.0
    rates = {
        "openai":   (0.01 / 1000, 0.03 / 1000),
        "claude":   (0.008 / 1000, 0.024 / 1000),
        "deepseek": (0.002 / 1000, 0.006 / 1000),
    }
    ri, ro = rates.get(provider, (0.0, 0.0))
    return round(input_t * ri + output_t * ro, 6)


class MockAgentResponse:
    """
    Result of a single mock agent execution.
    All fields labeled as mock/estimated — not real measurements.
    """

    def __init__(
        self,
        content: str,
        agent_slug: str,
        task_type: str = "general",
        success: bool = True,
    ):
        self.content     = content
        self.agent_slug  = agent_slug
        self.task_type   = task_type
        self.success     = success
        self.provider    = ModelProvider.MOCK
        self.model       = "mock-v1"
        self.is_mock     = True                  # Always True — never a real run
        self.latency_ms  = _estimated_latency()  # Estimated, not measured
        prompt_hint      = f"{agent_slug} {task_type} {content[:50]}"
        self.input_tokens, self.output_tokens = _estimated_tokens(prompt_hint)
        self.cost_estimate = 0.0
        self.started_at    = datetime.now(timezone.utc)
        self.completed_at  = datetime.now(timezone.utc)
        self.metadata: dict[str, Any] = {
            "provider":      "mock",
            "is_mock":       True,
            "latency_note":  "estimated, not measured",
            "tokens_note":   "approximation, not real API count",
        }


# ── Role-based mock responses ─────────────────────────────────────────────────
# These are template outputs for dev/test. They do not represent real analysis.

MOCK_RESPONSES: dict[str, list[str]] = {
    "orchestrator": [
        "Tüm sistemler kontrol edildi. Görev dağılımı tamamlandı.",
        "Alt ajanlardan raporlar alındı. İnsan onayı gerektiren işlem tespit edilmedi.",
        "Pipeline durumu normal. Kritik anomali yok.",
    ],
    "operations": [
        "DB bağlantısı aktif. Mock provider %100 uptime.",
        "Sistem metrikleri normal sınırlar içinde.",
        "Servis durumu: Backend OK, DB OK, Mock Provider OK.",
    ],
    "product": [
        "Roadmap değerlendirmesi tamamlandı. Öncelikli özellikler belirlendi.",
        "Kullanıcı geri bildirimleri analiz edildi. 3 yüksek öncelikli geliştirme önerildi.",
        "MVP kapsamı netleştirildi. Sonraki sprint için görev listesi hazır.",
    ],
    "qa": [
        "Mevcut test kapsamı değerlendirildi. Kritik gap tespit edilmedi.",
        "Mock run senaryosu doğrulandı. Edge case'ler kayıt altına alındı.",
        "Approval flow testi tamamlandı. Geçişler doğru çalışıyor.",
    ],
    "legal": [
        "Uyumluluk kontrolü tamamlandı. Kritik risk bulunamadı.",
        "Veri saklama politikaları gözden geçirildi.",
        "GDPR: kullanıcı verisi aktarımı öncesinde onay mekanizması yerinde.",
    ],
    "fraud": [
        "Profil analizi tamamlandı. Fraud skoru: 22/100 — düşük risk.",
        "Bot aktivitesi sinyali yok. Etkileşim deseni organik görünüyor.",
        "Analiz tamamlandı. Sahte takipçi oranı düşük.",
    ],
    "analysis": [
        "Influencer analiz raporu hazırlandı.",
        "Engagement kalitesi değerlendirildi.",
        "Veri yeterli değil — gerçek API verisi gerekiyor.",
    ],
    "brand_fit": [
        "Marka-influencer uyumu değerlendirildi.",
        "Kategori uyumu analizi tamamlandı.",
        "Hedef kitle örtüşmesi hesaplandı.",
    ],
    "roi": [
        "ROI tahmin analizi tamamlandı.",
        "CPM ve erişim metrikleri değerlendirildi.",
        "Bütçe optimizasyonu önerisi hazırlandı.",
    ],
    "report": [
        "Rapor taslağı oluşturuldu.",
        "Executive summary hazırlandı.",
        "Aylık performans özeti tamamlandı.",
    ],
    "support": [
        "Açık destek talepleri incelendi.",
        "Yaygın sorunlar tespit edildi ve kategorize edildi.",
        "Yanıt şablonları güncellendi.",
    ],
    "finance": [
        "Finansal özet hazırlandı.",
        "API maliyet analizi tamamlandı.",
        "Fiyatlandırma analizi: mevcut plan yapısı değerlendirildi.",
    ],
    "campaign": [
        "Kampanya planı taslağı oluşturuldu.",
        "Creator mix ve bütçe dağılımı önerildi.",
        "Kampanya hedefleri ve KPI'lar tanımlandı.",
    ],
    "discovery": [
        "Benzer creator önerileri hazırlandı.",
        "İlgili hesaplar tespit edildi.",
        "Discovery kriterleri uygulandı.",
    ],
    "seo": [
        "SEO denetimi tamamlandı. İyileştirme önerileri hazırlandı.",
        "Keyword cluster analizi yapıldı.",
        "Teknik SEO checklist oluşturuldu.",
    ],
    "ads": [
        "Reklam kopyaları oluşturuldu.",
        "Hedef kitle segmentleri önerildi.",
        "Kampanya ayarları için tavsiyeler hazırlandı.",
    ],
    "lead_finder": [
        "ICP tanımı güncellendi.",
        "Lead scoring kriterleri belirlendi.",
        "Segment önceliklendirmesi tamamlandı.",
    ],
    "sales": [
        "Satış mesajı taslağı oluşturuldu. Gönderim için onay gerekiyor.",
        "Teklif taslağı hazırlandı.",
        "Müşteri segmenti analizi tamamlandı.",
    ],
    "growth": [
        "Büyüme stratejisi değerlendirmesi tamamlandı.",
        "Growth kanalları analiz edildi.",
        "Öncelikli büyüme metrikleri belirlendi.",
    ],
    "archive_ai": [
        "Archive analizi tamamlandı.",
        "Profil kategorilendirmesi yapıldı.",
        "Trend tespiti tamamlandı.",
    ],
    "intel": [
        "Rakip analizi özeti hazırlandı.",
        "Fırsat tespiti tamamlandı.",
        "Influencer gap analizi yapıldı.",
    ],
    "general": [
        "Görev tamamlandı.",
        "Analiz hazır.",
        "İşlem başarılı.",
    ],
}


def mock_agent_response(
    agent_slug: str,
    agent_role: str,
    task_type: str = "general",
    prompt: str = "",
) -> MockAgentResponse:
    """Return a mock response labeled is_mock=True. Not a real agent execution."""
    role_responses = MOCK_RESPONSES.get(agent_role, MOCK_RESPONSES["general"])
    content = random.choice(role_responses)
    return MockAgentResponse(
        content=content,
        agent_slug=agent_slug,
        task_type=task_type,
        success=True,
    )
