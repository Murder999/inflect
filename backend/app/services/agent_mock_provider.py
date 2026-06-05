"""
Agent Mock Provider — Gerçek API olmadan örnek agent yanıtları üretir.
Part 2'de gerçek Claude/OpenAI provider ile değiştirilecek.
"""
from __future__ import annotations

import random
import time
from datetime import datetime, timezone
from typing import Any

from app.models.agent import ModelProvider


def _mock_latency() -> int:
    """80-400ms arası simüle latency."""
    return random.randint(80, 400)


def _mock_tokens(prompt: str) -> tuple[int, int]:
    """Yaklaşık token sayısı tahmini."""
    input_t  = max(10, len(prompt.split()) * 4 // 3)
    output_t = random.randint(50, 300)
    return input_t, output_t


def _mock_cost(input_t: int, output_t: int, provider: str = "mock") -> float:
    """Mock maliyet tahmini (USD)."""
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
    """Tek bir mock agent çalışmasının sonucu."""

    def __init__(
        self,
        content: str,
        agent_slug: str,
        task_type: str = "general",
        success: bool = True,
    ):
        self.content = content
        self.agent_slug = agent_slug
        self.task_type = task_type
        self.success = success
        self.provider = ModelProvider.MOCK
        self.model = "mock-v1"
        self.latency_ms = _mock_latency()
        prompt_hint = f"{agent_slug} {task_type} {content[:50]}"
        self.input_tokens, self.output_tokens = _mock_tokens(prompt_hint)
        self.cost_estimate = 0.0
        self.started_at = datetime.now(timezone.utc)
        self.completed_at = datetime.now(timezone.utc)
        self.metadata: dict[str, Any] = {
            "provider": "mock",
            "simulated": True,
            "part": "part-1-no-real-api",
        }


# ── Prebuilt mock yanıtları (rol bazlı) ───────────────────────────────────────

MOCK_RESPONSES: dict[str, list[str]] = {
    "orchestrator": [
        "Tüm sistemler aktif. Görev dağılımı yapılıyor. Önce Ops Agent sistem kontrolü yapacak.",
        "Görev tamamlandı. Tüm ajanlardan raporlar alındı. İnsan onayı gerekmiyor.",
        "Kritik bir anomali tespit edilmedi. Pipeline normal seyrediyor.",
    ],
    "operations": [
        "Backend, frontend ve database aktif görünüyor. Provider health kontrol ediliyor.",
        "Mock provider %100 uptime. YouTube API ve Apify durumu bilinmiyor — key girilmemiş.",
        "Sistem metrikleri normal sınırlar içinde. Kaynak kullanımı: %23 CPU, %41 RAM.",
    ],
    "product": [
        "AI Agents Center için ilk MVP hazırlandıktan sonra QA kontrolü öneriyorum.",
        "Kullanıcı deneyimi iyileştirmesi için dashboard'a agent aktivite özeti eklenebilir.",
        "Part 2 önceliği: gerçek API provider entegrasyonu ve approval flow UI'ı.",
    ],
    "qa": [
        "Mock run senaryosu başarıyla doğrulandı. Edge case'ler için ek test senaryoları öneriyorum.",
        "Approval flow test edildi. Pending → Approved → Completed geçişi doğru çalışıyor.",
        "Hata yönetimi test edildi. Timeout ve rate limit senaryoları Part 2'de kapsamlıdır.",
    ],
    "legal": [
        "Dış platformlarda otomatik işlem yapılmadığı için mevcut mock run güvenli.",
        "Gerçek API entegrasyonunda veri saklama politikaları gözden geçirilmeli.",
        "GDPR uyumluluğu: kullanıcı verisi üçüncü taraf AI'a gönderilmeden önce onay alınmalı.",
    ],
    "fraud": [
        "Seçilen profilde %28 şüpheli takipçi oranı tespit edildi. Orta risk.",
        "Bot aktivitesi sinyali: etkileşim deseni organik görünüyor. Fraud skoru: 22/100.",
        "Analiz tamamlandı. Sahte takipçi riski düşük (%12). Güvenle devam edilebilir.",
    ],
    "analysis": [
        "Influencer analiz raporu hazırlandı. Final skor: 74/100 — Önerilir.",
        "Engagement kalitesi güçlü. Yorum/beğeni oranı %7.2 — platform ortalamasının üstünde.",
        "Veri güven skoru: orta. Audience demographics için platform API gerekiyor.",
    ],
    "brand_fit": [
        "Marka-influencer uyumu güçlü. Brand fit skoru: 81/100.",
        "Kategori uyumu: Moda × Yaşam Tarzı — yüksek uyum. Kampanya türü: Sponsored içerik önerilir.",
        "Hedef kitle örtüşmesi %68. Test bütçesiyle başlanabilir.",
    ],
    "roi": [
        "Tahmini erişim: 180K. CPM: $4.20. Önerilen bütçe: $800-1200.",
        "ROI potansiyeli yüksek (78/100). Yatırım geri dönüş süresi: 2-3 kampanya döngüsü.",
        "Dönüşüm tahmini: 340 tıklama, ~9 satış. Mevcut e-ticaret conversion rate'e göre güncellenebilir.",
    ],
    "report": [
        "Executive summary hazırlandı. PDF olarak dışa aktarılabilir.",
        "Aylık performans raporu: 47 analiz, 23 düşük risk, 18 orta risk, 6 yüksek risk.",
        "Rapor tamamlandı. Bir sonraki kontrol: 30 gün içinde izleme listesindeki profillerin güncellenmesi önerilir.",
    ],
    "support": [
        "3 açık destek talebi tespit edildi. 2'si fatura, 1'i teknik konu. Öncelik sırasına konuldu.",
        "Yaygın sorun: API key yapılandırması. Otomatik yanıt şablonu hazırlandı.",
        "Kullanıcı memnuniyeti skoru: 4.2/5. Son 7 gün ortalama yanıt süresi: 2.3 saat.",
    ],
    "finance": [
        "Mevcut MRR tahmini güncellendi. Büyüme trendi pozitif.",
        "API maliyet tahmini: aylık $12-18. Mevcut plan kapsamında sürdürülebilir.",
        "Fiyatlandırma analizi: Pro plan → Business dönüşüm oranı %8.4. Upsell stratejisi önerilir.",
    ],
    "general": [
        "Görev tamamlandı. Sonuçlar kaydedildi.",
        "Analiz hazır. İncelemeniz için rapor oluşturuldu.",
        "İşlem başarılı. Sistem bekleme moduna geçiyor.",
    ],
}


def mock_agent_response(agent_slug: str, agent_role: str, task_type: str = "general", prompt: str = "") -> MockAgentResponse:
    """Rol ve görev tipine göre uygun mock yanıt döndür."""
    role_responses = MOCK_RESPONSES.get(agent_role, MOCK_RESPONSES["general"])
    content = random.choice(role_responses)
    return MockAgentResponse(
        content=content,
        agent_slug=agent_slug,
        task_type=task_type,
        success=True,
    )
