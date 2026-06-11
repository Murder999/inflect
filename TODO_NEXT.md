# TODO_NEXT — Part 16 Final Hardening ✅ + Sonrası

## ✅ Part 16 Final'de Tamamlanan

- [x] `services/providers/health.py` — ProviderHealthResult, get_all_provider_health(), test_provider_connectivity()
- [x] `services/influencers/resolve.py` — Mock mod her zaman mock profil döndürür. Provider başarısız → _archive_fallback() devreye girer.
- [x] `api/v1/routes/risk_radar.py` — _determine_report_mode() archive_fallback + mock_limited desteği. AND bug fix.
- [x] `api/v1/routes/admin_intelligence.py` — GET /admin/providers/health + POST /admin/providers/test/{provider}
- [x] `lib/risk-radar-api.ts` — ProviderHealthResult, providerHealthApi, archive_fallback / mock_limited ReportMode
- [x] `app/(app)/intelligence/risk-radar/page.tsx` — ReportModeBadge yeni modlar. Resolved banner → ProfileAvatar.
- [x] `app/(app)/compare/page.tsx` — Selected chips: gradient circle → ProfileAvatar
- [x] `app/(app)/admin/intelligence/page.tsx` — Provider Health tab (status, latency, live test)

## ✅ Part 16'da Tamamlanan

- [x] `services/influencers/resolve.py` — Archive-independent resolve pipeline
- [x] `models/intelligence_billing.py` — IntelligenceFeature, IntelligenceUsageLog, UsageStatus
- [x] `services/intelligence_billing.py` — get_feature_cost, can_use_feature, charge_feature_usage, record_failed_usage, seed
- [x] `api/v1/routes/admin_intelligence.py` — Admin feature management + usage logs + summary
- [x] `api/v1/routes/risk_radar.py` — POST /risk-radar/scan (query-based), fix credit charge timing, report mode
- [x] `models/__init__.py` — Added intelligence billing model imports
- [x] `main.py` — Register admin_intelligence router, seed intelligence features, v8.2.0
- [x] `lib/risk-radar-api.ts` — queryScan(), getMyFeatureCosts(), new types
- [x] `app/(app)/intelligence/risk-radar/page.tsx` — Query-based flow, RiskFailureCard, ReportModeBadge
- [x] `app/(app)/admin/intelligence/page.tsx` — Intelligence Billing admin page
- [x] `components/layout/AppShell.tsx` — Intelligence Billing nav link

## 🔜 Part 17 Adayları

### Alembic Migrations
- `alembic revision --autogenerate -m "intelligence_billing_part16"` — intelligence_features, intelligence_usage_logs tabloları
- `alembic revision --autogenerate -m "influencer_resolve_part16"` — herhangi yeni alan varsa
- Docker ortamında `alembic upgrade head` çalıştırılmalı

### Alert Management UI
- Admin panelinde risk alert listesi (risk_radar.getAlerts)
- Alert resolve butonu
- HIGH/CRITICAL profil listesi sayfası

### Report Mode in Existing Scan
- `POST /risk-radar/scan/{profile_id}` sonucu da `report_mode` içeriyor — UI'da göster
- Kullanıcı scan sonucunda "Full Evidence" varsa Premium badge

### Scheduled Scanning
- agent_scheduler.py'de günlük risk_radar_scan görevi
- Tüm aktif profillerin otomatik taranması

### Risk Comparison
- 2 influencer yan yana risk karşılaştırması

---

# TODO_NEXT — Part 15 Final: Risk Radar™ Production UX ✅ + Sonrası

## ✅ Part 15 Final UX'te Tamamlanan

- [x] `app/(app)/intelligence/risk-radar/page.tsx` — Tam premium UX yeniden yazımı
- [x] `InfoPanel` — Sayfa açılış bilgi bloğu (özellikler + risk level legend + disclaimer)
- [x] `RiskGauge` — Zone rings + büyük boyut + smooth animation
- [x] `RiskTimelineChart` — recharts AreaChart, 7 noktalı trajectory eğrisi
- [x] `SentimentSection` — Stacked bar chart + sinyal listesi
- [x] `AdminActionsPanel` — Snapshot Sync + Avatar Resolve + Zorla Yenile (admin-only)
- [x] `DimensionBar` — Renkli kart, expanded trajectory badge
- [x] `AnomalyCard` — Severity ikon + tip/dönem badgeleri
- [x] `ProfileDropdown` — Az Veri uyarısı, snapshot count, kategori pill
- [x] Hint chips — Örnek arama önerileri
- [x] SuccessBanner — Yenile onayı
- [x] Responsive grid — 900px altı tek sütun
- [x] TypeScript 0 hata

## 🔜 Part 16 Adayları

### Alembic Migration
- `alembic revision --autogenerate -m "risk_radar_part15"` — influencer_risk_reports, risk_alerts tabloları
- Docker ortamında `alembic upgrade head` çalıştırılmalı

### Gerçek Veri (AGENTS_MODE=live)
- Archive'da yeterli `InfluencerSnapshot` kaydı olduğunda `_run_live_analysis()` gerçek verilerle çalışır
- Minimum 3 snapshot, 7+ gün kapsama önerilir (confidence=HIGH için)
- Backend'den gerçek time-series dizisi döndürülürse `RiskReport.timeline` olarak eklenebilir

### Alert Management UI
- Admin panelinde risk alert listesi (risk_radar.getAlerts)
- Alert resolve butonu
- HIGH/CRITICAL profil listesi sayfası

### Scheduled Scanning
- agent_scheduler.py'de günlük risk_radar_scan görevi
- Tüm aktif profillerin otomatik taranması

### Risk Comparison
- 2 influencer yan yana risk karşılaştırması
- `/intelligence/compare-risk` sayfası

---

# TODO_NEXT — Part 15: Influencer Risk Radar™ ✅ + Sonrası

## ✅ Part 15'te Tamamlanan

- [x] `models/risk_radar.py` — InfluencerRiskReport, RiskAlert modelleri
- [x] `services/risk_radar/schemas.py` — sabitler, dataclass'lar, ağırlıklar
- [x] `services/risk_radar/anomaly_detection.py` — growth & engagement anomalileri
- [x] `services/risk_radar/volatility_engine.py` — CV tabanlı volatilite analizi
- [x] `services/risk_radar/brand_alignment.py` — brand alignment ve sentiment risk
- [x] `services/risk_radar/risk_scoring.py` — fraud risk, composite score, trajectory
- [x] `services/risk_radar/confidence_engine.py` — snapshot sayısı ve kapsama güven puanı
- [x] `services/risk_radar/explainability.py` — kanıt özeti ve sınırlama metinleri
- [x] `services/risk_radar/mock_generator.py` — SHA-256 deterministik mock
- [x] `services/risk_radar/engine.py` — ana scan() entry point, cache, event firing
- [x] `services/agents/risk_radar_agent.py` — RiskRadarAgent BaseAgent implementasyonu
- [x] `api/v1/routes/risk_radar.py` — 4 endpoint (scan, report, alerts, high-risk)
- [x] `models/__init__.py` — RiskRadarAgent model import'ları
- [x] `main.py` — risk_radar router kaydı, version 8.0.0
- [x] `agent_factory.py` — risk-radar-agent slug eklendi
- [x] `agent_registry.py` — risk-radar-agent metadata eklendi
- [x] `event_bus.py` — 5 yeni creator.risk_* event tipi
- [x] `services/agents/ceo_agent.py` — brand_safety_audit, risk_radar_scan routing
- [x] `lib/risk-radar-api.ts` — tam tipli TypeScript client
- [x] `app/(app)/intelligence/risk-radar/page.tsx` — enterprise UI (gauge, dimension bars, anomaly cards)
- [x] `AppShell.tsx` — Risk Radar™ nav linki eklendi
- [x] TypeScript 0 hata, Python syntax 0 hata

## 🔜 Part 16 Adayları

### Alembic Migration
- `alembic revision --autogenerate -m "risk_radar_part15"` — influencer_risk_reports, risk_alerts tabloları
- Docker ortamında `alembic upgrade head` çalıştırılmalı

### Gerçek Veri (AGENTS_MODE=live)
- Archive'da yeterli `InfluencerSnapshot` kaydı olduğunda `_run_live_analysis()` gerçek verilerle çalışır
- Minimum 3 snapshot, 7+ gün kapsama önerilir (confidence=HIGH için)

### Alert Management UI
- Admin panelinde risk alert listesi (risk_radar.getAlerts)
- Alert resolve butonu
- HIGH/CRITICAL profil listesi sayfası

### Scheduled Scanning
- agent_scheduler.py'de günlük risk_radar_scan görevi
- Tüm aktif profillerin otomatik taranması

---

# TODO_NEXT — Part 13 Final Fix ✅ + Sonrası

## ✅ Part 13 Final Fix'te Tamamlanan

- [x] `brand_lookup.py` — alias search (cast aliases JSON to text, OR query)
- [x] `/lookup` endpoint — optional `platform` query param
- [x] Frontend no-results dropdown bug fix — `setDropdownOpen(true)` after any search
- [x] Campaign Patterns section rendered in ReportView
- [x] TypeScript 0 hata, Python syntax 0 hata

---

# TODO_NEXT — Part 13: Competitor Intelligence ✅ + Sonrası

## ✅ Part 13'te Tamamlanan

- [x] `models/competitor_intelligence.py` — CompetitorProfile, CompetitorCampaignSignal, CompetitorReportCache modelleri
- [x] `services/competitor_intelligence/` — 11 modül (schemas, brand_lookup, creator_detection, spend_estimation, category_analysis, overlap_analysis, opportunity_engine, confidence_engine, explainability, mock_generator, engine)
- [x] `services/agents/competitor_intelligence_agent.py` — BaseAgent implementasyonu, mock/live mode
- [x] `api/v1/routes/competitor_intelligence.py` — 5 endpoint (lookup, generate, get, opportunities, search)
- [x] `models/__init__.py` — yeni model import'ları
- [x] `main.py` — router kaydı, version 7.0.0
- [x] `agent_factory.py` — yeni slug
- [x] `agent_registry.py` — yeni agent metadata
- [x] `event_bus.py` — 5 yeni competitor event tipi
- [x] `lib/competitor-intelligence-api.ts` — tam tipli TypeScript client
- [x] `app/(app)/intelligence/competitor-intelligence/page.tsx` — enterprise UI
- [x] `AppShell.tsx` — nav linki eklendi
- [x] TypeScript 0 hata, Python syntax 0 hata

## 🔜 Part 14 Adayları

### Alembic Migration
- `alembic revision --autogenerate -m "competitor_intelligence_part13"` — competitor_profiles, competitor_campaign_signals, competitor_report_cache tabloları oluşturulmalı
- Docker ortamında `alembic upgrade head` çalıştırılmalı

### Gerçek Veri Zenginleştirme (AGENTS_MODE=live)
- Archive'da yeterli `Analysis` kaydı olduğunda `creator_detection.py` gerçek sinyaller üretecek
- `brand_lookup.py`'daki `industry_map` genişletilebilir (daha fazla marka → sektör eşleşmesi)
- `spend_estimation.py` Türk piyasa oranları güncelleme (2026 enflasyon)

### CEO Agent Entegrasyonu
- CEO agent'ın competitor report'ları okuyarak platform stratejisi önerileri üretmesi

### Ürün Özellikleri
- Karşılaştırmalı view: 2 rakip yan yana
- Haftalık competitor delta raporu (önceki haftaya göre değişim)
- Creator overlap detay sayfası

---

# TODO_NEXT — Part 12 Finalization + Sonrası

## ✅ Part 12 Finalization'da Tamamlanan

- [x] Kredi fix: generate/refresh başarısız olursa kredi düşmez (sadece `is_forecast_available=True`'da düşer)
- [x] `lookup.py` response'a `avatar_status`, `avatar_source`, `estimated_ready_at`, `missing[]` eklendi
- [x] `POST /archive/profiles/{id}/sync` — admin: tek profil snapshot sync + event
- [x] `POST /archive/profiles/{id}/resolve-avatar` — admin: tek profil avatar resolve
- [x] `components/ProfileAvatar.tsx` güncellendi — URL chain fallback, platform badge, borderRadius prop
- [x] `lib/influencers-api.ts` — yeni tipler + `archiveAdminApi`
- [x] Digital Twin page — ProfileAvatar kullanımı, AdminActionsPanel, InsufficientDataPanel enriched
- [x] TypeScript 0 hata, Python syntax 0 hata

---

## ✅ Part 12 UX Fix'te Tamamlanan

- [x] `services/influencers/identity.py` — normalize_handle, detect_platform_from_url, parse_social_profile_url (Instagram/TikTok/YouTube formatları)
- [x] `services/influencers/lookup.py` — exact + ilike + display_name arama, snapshot aggregates, twin status, data sufficiency enrichment
- [x] `api/v1/routes/influencers.py` — GET /api/v1/influencers/lookup (kredi düşmez)
- [x] `lib/influencers-api.ts` — typed client, platform label/color helpers
- [x] Digital Twin page tamamen yenilendi — profile ID input kaldırıldı
- [x] Debounced search + platform selector
- [x] ResultCard: avatar, badges, data sufficiency, twin status
- [x] SelectedProfilePanel: seçim gösterimi + clear
- [x] InsufficientDataPanel: required vs actual tablo
- [x] Auto-select (tek sonuç) + auto-load twin
- [x] Action buttons: kredi bilgisi, disabled state, conditional rendering
- [x] TypeScript 0 hata, Python syntax 0 hata

---

## 🟡 Kalan İyileştirmeler

### Global Influencer Autocomplete
- Arama kutusunu AppShell'e taşı → tüm sayfalarda kullanılabilir
- Dropdown ile sonuç listesi

### Archive Quick-Add
- Empty state'de "Bu influencer'ı archive'a ekle" butonu
- Sadece admin için

### Batch Twin Generation
- Admin panelinden "Tüm profiller için twin oluştur"
- Background worker + progress tracking

### Public Profile URL Support
- Archive'a eklenmemiş profil URL'sinden direkt twin oluştur (provider fetch → snapshot → twin)

---

# TODO_NEXT — Part 12+ (Post Part 12)

## ✅ Part 12'de Tamamlanan

- [x] `models/digital_twin.py` — InfluencerDigitalTwin, TwinForecast, TwinSignal modelleri
- [x] `services/digital_twin/` — 10 modül: schemas, data_quality, trend_analysis, volatility, risk_projection, confidence_engine, forecast_engine, explainability, campaign_readiness, twin_engine
- [x] Deterministic forecast: growth rate (recency-weighted), ER slope (OLS), risk projection (6 signal), confidence (points system)
- [x] Data quality gate — min 3 snapshot, min 30 gün, yetersizse forecast unavailable
- [x] DigitalTwinAgent — MOCK: read-only DB scan; ACTIVE: full twin generation
- [x] API routes: generate/get/refresh/high-risk/list
- [x] Frontend: `digital-twin-api.ts` typed client
- [x] Frontend: `/intelligence/digital-twin` page — horizon cards, evidence accordion, campaign readiness, confidence/risk badges
- [x] AppShell nav: Digital Twin™ link eklendi
- [x] CEO routing: digital_twin_audit + creator_intelligence
- [x] Event bus: digital_twin.generated, digital_twin.updated, digital_twin.failed, influencer.snapshot.created
- [x] agent_factory + agent_registry güncellendi (30. agent: digital-twin-agent)
- [x] main.py version 6.0.0
- [x] TypeScript 0 hata, Python syntax 0 hata

---

## 🔴 Kritik Kalan — Schema Migration

```bash
# Part 12 yeni tablolar (digital_twin, twin_forecasts, twin_signals)
docker compose down -v
docker compose up --build
```

---

## 🔴 Kritik — Snapshot Data

Digital Twin tahmin üretebilmek için gerçek snapshot verisi gerekli:
- Minimum 3 snapshot / influencer
- Minimum 30 günlük aralık
- Mevcut test verisi: `POST /archive/import-json` ile import edilebilir

---

## 🟡 Part 13 Planlanan — Twin Intelligence Enhancements

### Batch Twin Generation
- Admin panelinden "Tüm profilller için twin oluştur" butonu
- Background worker ile async batch processing
- Progress tracking

### Görsel Forecast Chart
- Recharts ile gerçek çizgi grafiği
- Historical data + projected range overlay
- 30/90/180 gün toggle

### Twin Comparison
- 2 influencer side-by-side twin karşılaştırması
- `/intelligence/compare-twins` sayfası

### CEO Executive Summary Entegrasyonu
- High-risk creator weekly özeti CEO Agent'a gönderilsin
- `digital_twin_audit` task'ı real verilerle çalışsın

### Archive Integration
- Yeni snapshot kaydedilince otomatik twin regenerate tetiklensin
- `influencer.snapshot.created` event → DigitalTwinAgent

---

## 🟡 Mevcut Part 12 Kısıtlamaları

- Forecasting modeli linear: momentum/acceleration henüz yok
- Sponsorship density signal proxy'e dayanıyor (gerçek sponsored post tarama yok)
- Platform-specific seasonality modeli yok
- 365d forecast horizon henüz aktif değil (sadece 30/90/180)

---

# TODO_NEXT — Part 11+ (Post Part 11)

## ✅ Part 11'de Tamamlanan

- [x] SecurityAgent — secret/auth/admin güvenlik taraması, P0/P1/P2 sınıflandırması
- [x] CtoAgent — teknik mimari, debt, scalability incelemesi
- [x] DataQualityAgent — MOCK etiketli / ACTIVE'de gerçek DB sorgusu
- [x] agent_factory.py güncellendi — 3 yeni slug + provider map
- [x] agent_registry.py güncellendi — 3 yeni agent kaydı (toplam 29)
- [x] CEO TASK_ROUTING güncellendi — security_audit, technical_review, data_quality_audit
- [x] Orchestrator plan'ları genişletildi — 5 yeni plan
- [x] Scheduler — 3 yeni scheduled job (security daily, data quality daily, CTO weekly)
- [x] mock-run endpoint enriched — message_count, agents_involved, scenario, note
- [x] triggerMockAgentRun return type düzeltildi
- [x] agents-api.ts — yeni rol/dept constants, DEPT_LABEL, DEPT_COLOR
- [x] Frontend agents page — department gruplu görünüm (DepartmentGroupedAgents)
- [x] Frontend agents page — event log paneli
- [x] Frontend agents page — pending approvals inline paneli
- [x] Frontend agents page — 3 yeni orchestration type
- [x] growth_agents.py pre-existing f-string bug düzeltildi
- [x] Backend version 5.0.0
- [x] TypeScript 0 hata, Python syntax 0 hata

---

## 🔴 Kritik Kalan — Schema Migration

```bash
# Part 11 agent mode column + new agent records
docker compose down -v
docker compose up --build
```

---

## 🔴 Kritik — ACTIVE Mode Aktivasyonu

Gerçek agent çalışması için:
```
AGENTS_MODE=real
ANTHROPIC_API_KEY=...   # Security, CTO agents için
OPENAI_API_KEY=...
DEEPSEEK_API_KEY=...
```

---

## 🟡 Part 12 Planlanan — Gerçek LLM Entegrasyonu

### Agent Prompt Engineering
- SecurityAgent için gerçek Claude prompt ile canlı analiz
- CtoAgent için repo tarama + build sonucu değerlendirme
- DataQualityAgent ACTIVE mod zaten hazır (gerçek DB sorgusu)

### Provider Health Dashboard
- `/admin/agents/providers` sayfasını gerçek API ping ile doğrula
- Latency grafiği ekle

### Campaign Intelligence Agent (Ayrı)
- Mevcut campaign-planner-agent'tan farklı, kampanya-spesifik zeka
- Gerçek campaign verisiyle çalışma (fake ROI üretmeme)

### Brand Match Agent (Ayrı)
- Part 10 Brand Evidence API ile entegrasyon
- Website evidence + AI interpretation ayrımını koru

---

## 🟡 Scheduler Geliştirme

- Redis + ARQ ile gerçek distributed scheduler (multi-worker güvenli)
- Scheduler health check UI
- Missed job recovery

---

## 🟢 Test Suite

- pytest + httpx ile API integration tests
- Agent mock response doğrulama
- Approval flow end-to-end test

---

# TODO_NEXT — Part 6+ (Post Part 5)

Part 6 Profile Image Resolution Pipeline tamamlandı. Aşağıdakiler sıradaki geliştirmeler.

## ✅ Part 6'da Tamamlanan

- [x] `services/avatar_resolver.py` — `resolve_profile_image(platform, username, cfg)` servisi
- [x] `POST /archive/resolve-avatars?limit=50` endpoint (admin-only)
- [x] Avatar field priority: Instagram (profilePicUrlHD→…), TikTok (avatarLarger→…), YouTube (high→medium→default)
- [x] Fake URL kontrolü: `startswith("http")` zorunlu, boş URL yazılmaz
- [x] Frontend: `archiveApi.resolveAvatars()` API fonksiyonu
- [x] Frontend: Archive admin sayfasına "Resolve Avatars" butonu + mesaj banner

---

## ✅ Part 5'te Tamamlanan

- [x] `POST /archive/import-json` endpoint (admin-only, multipart)
- [x] `InfluencerImportLog` modeli (yeni tablo — create_all ile otomatik oluşur)
- [x] JSON normalize: handle → username (@ temizle), platform lowercase
- [x] Dedup: username + platform unique → varsa update, yoksa create
- [x] Snapshot: followers null değilse oluştur, null ise oluşturma
- [x] Import log: her çalışmada kayıt yazılır
- [x] Frontend: Archive admin sayfasına JSON Import bölümü eklendi
- [x] Frontend: `archiveApi.importJson(file)` API fonksiyonu eklendi

---

## ✅ Part 4'te Tamamlanan

- [x] Login bug: yanlış şifreden 401 → "Oturum süresi doldu" hatası düzeltildi
- [x] Login: backend'den gelen gerçek hata mesajı gösteriliyor
- [x] Protected routes: `(app)/layout.tsx`'e AuthGuard eklendi
- [x] Token yoksa protected sayfa render edilmiyor → /login redirect
- [x] Token geçersizse logout + /login redirect
- [x] Admin guard: `/admin/*` non-admin kullanıcıları /dashboard'a yönlendiriliyor
- [x] Register: `company` zorunlu alan (frontend + backend)
- [x] Backend: `RegisterRequest.company` Optional → required

---

## ✅ Part 3'te Tamamlanan

- [x] main.py version string 4.2.0
- [x] AgentCard provider dropdown (mock/claude/openai/deepseek/gemini)
- [x] PATCH /agents/{id}/provider UI entegrasyonu
- [x] Mode badge (Mock/Real) AgentCard'da
- [x] Key status badge (✓ Key / ⚠ Key eksik) AgentCard'da
- [x] AGENTS_MODE=mock → "Run Mock" butonu
- [x] AGENTS_MODE=real → "Run Agent" butonu (per-ajan task create + run)
- [x] Real mode'da key eksikse sessiz mock düşme yok → raise + error_message
- [x] AgentRun.provider artık agent.model_provider.value
- [x] GET /agents response'a agents_mode + key_status eklendi

---

---

## 🔴 Kritik — Schema Migration

```bash
# Part 2'de ModelProvider.GEMINI + native_enum=False eklendi
docker compose down -v
docker compose up --build
```

---

## 🔴 Kritik — Stripe Aktivasyonu

```
1. STRIPE_SECRET_KEY=sk_live_...
2. STRIPE_WEBHOOK_SECRET=whsec_...
3. billing.py → STRIPE_PRICE_IDS güncelle
```

---

## 🔴 Güvenlik — Production Hardening

```
1. SECRET_KEY → 64+ rastgele karakter
2. ADMIN_PASSWORD → güçlü şifre
3. Rate limiting (slowapi)
4. HTTPS + nginx SSL
```

---

## 🟡 Part 3 Planlanan Geliştirmeler

### Agent Provider UI
- ~~Admin agents page'de per-agent provider dropdown~~ ✅ Tamamlandı
- Fallback provider seçimi UI (opsiyonel — metadata'ya kaydediliyor ama UI yok)

### Real Mode Activation
- `.env` → `AGENTS_MODE=real` + API key ekle
- Provider health check gerçek ping

### Archive AI Workflow
- Archive Category Agent → tüm archive profilleri tara ve kategori ata
- Archive Trend Agent → aylık snapshot karşılaştırması
- Admin Archive page'e "AI Analiz" butonu ekle

### Campaign Copilot Enhancement
- Gerçek analysis_id geçirerek Analysis Agent'ı kullan
- Copilot sonuçlarını PDF/rapor olarak kaydet

---

## 🟡 Team Davet Sistemi

```
Altyapı hazır — SMTP_PASSWORD ekle, send_invite_email() aktif et
```

---

## 🟢 Gemini Integration Test

```bash
# GEMINI_API_KEY ekle ve test et
curl -X PATCH http://localhost:8000/api/v1/agents/15/provider \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model_provider":"gemini","model_name":"gemini-1.5-flash"}'
```

---

## 🟢 Campaign Copilot — Gerçek Veri Entegrasyonu

```
POST /agents/copilot/campaign
→ Şu an mock analysis data kullanıyor
→ Gerçek archive profilleri + analysis_id ile bağla
```

---

## 🟢 Alembic Migration

```bash
cd backend
alembic init alembic
alembic revision --autogenerate -m "add_gemini_provider"
alembic upgrade head
```
