# TODO_NEXT — Part 22 Post-Audit: Taxonomy Leak Removal & Creator Pool Safe Reporting (2026-06-13)

## ✅ Post-Audit'de Tamamlanan

- [x] `brand-match-engine.ts`: `buildSummary()` — pool < 20 iken ortalama skor gösterilmiyor ("Creator havuzu yetersiz N/20")
- [x] `brand-match-engine.ts`: `buildNextActions()` — creator referanslı next steps pool < 20 iken filtreleniyor
- [x] `page.tsx`: DNA Boyutları — `basis === "Taxonomy Fallback"` dimensionlar skor göstermez, opacity 0.42 placeholder ("Web kanıtı yok")
- [x] `page.tsx`: Rapor header Creator badge — `reportStatus === "partial_no_creators"` → "Yetersiz Havuz" (amber)
- [x] `page.tsx`: "AI İçgörüleri" → "Marka İçgörüleri" (`websiteEvidence?.aiUsed !== true` durumunda)
- [x] `brand_match.py`: `BrandMatchAnalyzeResponse` + `_MIN_CREATOR_POOL = 20` + `brand_dna_ready`, `ai_enrichment_ready`, `min_creator_pool` alanları
- [x] `api.ts`: `BrandMatchAnalyzeResponse` tip güncellemesi
- [x] `test_brand_analysis.py`: `TestSectionReadiness` (9 test) → toplam 44/44 PASSED ✅
- [x] TypeScript `tsc --noEmit`: 0 hata ✅
- [x] `npm run build`: 38/38 sayfa ✅

---

# TODO_NEXT — Part 22 Post: AI Brand Match Backend Real Data Extraction (2026-06-13)

## ✅ Part 22'de Tamamlanan

- [x] `backend/app/services/brand_domain_resolver.py` (YENİ) — httpx TLD probing, URL/domain/bare-name sınıflandırma, .com>.com.tr tercihi, concurrent asyncio.gather
- [x] `backend/app/services/brand_website_fetcher.py` (YENİ) — httpx 8s fetch, 1MB cap, title/meta/OG/h1/h2/snippets/social extraction, evidence_quality
- [x] `backend/app/models/brand_analysis.py` (YENİ) — `BrandAnalysisSnapshot` model
- [x] `backend/app/api/v1/routes/brand_match.py` (YENİ) — `POST /api/v1/intelligence/brand-match/analyze`, auth, resolve→fetch→persist→response
- [x] `backend/alembic/versions/0006_part22_brand_ai.py` (YENİ) — brand_analysis_snapshots migration (≤32 chars ✓)
- [x] `backend/app/models/__init__.py` — BrandAnalysisSnapshot import
- [x] `backend/app/main.py` — brand_match router kayıt, version 10.4.0
- [x] `backend/app/api/v1/routes/admin_intelligence.py` — `_EXPECTED_HEAD` → `0006_part22_brand_ai`
- [x] `backend/app/services/entitlement_service.py` — `advanced_brand_match` feature (Pro+)
- [x] `backend/tests/test_migration_health.py` — part22 assertion güncellendi
- [x] `backend/tests/test_brand_analysis.py` (YENİ) — 35 test: resolver, HTML extraction, quality, fetch failures, plan redaction, no-taxonomy guards
- [x] `frontend/lib/api.ts` — BrandMatchEvidenceResponse, BrandMatchAnalyzeRequest/Response, brandMatchApi.analyze()
- [x] `frontend/app/(app)/intelligence/brand-match/page.tsx` — backend entegrasyonu, domain_unresolved UI, backend evidence mapping, locked_sections state
- [x] TypeScript `tsc --noEmit`: 0 hata ✅
- [x] `npm run build`: 38/38 sayfa ✅
- [x] `tests/test_brand_analysis.py` → 35/35 PASSED ✅
- [x] `tests/test_migration_health.py` → 7/7 PASSED ✅

## 🔜 Part 22 Sonrası — Sonraki Adımlar

### AI Brand Match Geliştirmeleri
- Domain resolver için arama provider entegrasyonu (Google Custom Search, Bing Search API): bare brand names için daha doğru çözümleme
- `BRAND_ANALYSIS_PROVIDER` env var ile AI enrichment (tone/audience sinyalleri) — Next.js API route'u zaten destekliyor
- Frontend: `locked_sections` içindeki bölümlere `PremiumLockedCard` gösterimi
- `POST /api/v1/intelligence/brand-match/history` — kullanıcının önceki analizleri
- Brand evidence refresh (yenileme butonu → backend yeniden fetch)

### Social Profile Verification
- Sosyal link extraction sonrası resmi profil doğrulaması
- Instagram/TikTok hesabının gerçekten o markaya ait olduğunu verify et

### Campaign Intelligence Live Provider
- `campaign_discovery_service.discover_campaign_creators()` → Apify/YouTube Data API live discovery
- `AGENTS_MODE=live` iken gerçek provider kullan

### Admin Brand Analytics
- `/admin/intelligence` → Brand Analysis sekmesi: kullanıcı başına analiz sayısı, resolver başarı oranı, evidence quality dağılımı

---

# TODO_NEXT — Part 21 Post: AI Brand Match No-Fallback Guard (2026-06-13)

## ✅ Part 21'de Tamamlanan

- [x] `frontend/lib/brand-match-engine.ts` — `MIN_CREATOR_POOL = 20`, `BrandMatchReportStatus` tipi, `reportStatus` + `verifiedReport` alanları, ülke mismatch dışlaması (`isMismatch = true`)
- [x] `frontend/app/(app)/intelligence/brand-match/page.tsx` — `looksLikeDomain()` TLD kontrolü, `fetch_failed` PageState, `failedEvidence` state, `runAnalysis()` çift koruma, `fetch_failed` tam hata ekranı (yeniden deneme formu dahil), `reportStatus` bağlı başlık badge, `partial_no_creators` creator havuzu uyarı paneli, `verifiedReport` koşullu Portfolio/Overlap/Mismatch bölümleri
- [x] TypeScript `tsc --noEmit`: 0 hata ✅
- [x] `npm run build`: 38/38 sayfa ✅

---

# TODO_NEXT — Part 20 Post: Campaign Intelligence Provider-Backed Discovery & Entitlement-Safe Report Engine (2026-06-13)

## ✅ Part 20'de Tamamlanan

- [x] `backend/app/services/campaign_discovery_service.py` (YENİ) — DataCompleteness gate (< 60% → excluded, 60-75% → low_confidence, ≥ 75% → normal), confidence-weighted power-law bütçe optimizer, `BUDGET_CAP_LOW_CONF = 0.15`, provider-gated discovery (`insufficient_verified_data` when 0 pass gate)
- [x] `backend/app/models/campaign.py` — 6 yeni kolon: `report_source`, `data_confidence`, `provider_status`, `discovery_sources`, `report_generated_at`, `redaction_level`
- [x] `backend/app/api/v1/routes/campaigns.py` — `_determine_redaction()`, `_to_dict()` server-side redaction, `_strip_roi_details()`, `POST /campaigns/discover` endpoint, `locked_sections` format
- [x] `backend/alembic/versions/0005_part20_campaign_report_metadata.py` — migration + backfill (simulation_result IS NOT NULL → client_simulation_preview)
- [x] `backend/tests/test_campaign_intelligence.py` (YENİ) — 28 pytest testi (5 class): TestComputeCompleteness, TestCompletenessLevel, TestDetermineRedaction, TestToDictRedaction, TestStripRoiDetails
- [x] `frontend/lib/simulation-engine.ts` — `DataCompletenessLevel`, eşik sabitleri, `qualityScore: number | null` (null when excluded), `SimResultV2` yeni alanlar (`excludedFromPortfolio`, `reportSource`), null-safe `avgQuality`
- [x] `frontend/lib/api.ts` — `CampaignReportSource`, `CampaignRedactionLevel`, `LockedSection` tipleri, `Campaign` 7 yeni alan, `CampaignDiscoverRequest`, `DiscoveredCreator`, `CampaignDiscoveryResponse`, `campaignsApi.discover()`
- [x] `frontend/app/(app)/campaigns/simulate/page.tsx` — `completenessLabel` badge'leri, `~EST` kaldırıldı, `excludedFromPortfolio` uyarı banner'ı, `reportSource` badge, `saveAsCampaign()` yeni alanlar
- [x] `frontend/app/(app)/campaigns/[id]/page.tsx` — `PremiumLockedBanner` komponenti, `report_source` + `redaction_level` badge'leri, completeness banner'ları, null-safe qualityScore
- [x] `README_PROGRESS.md` — Part 20 bölümü eklendi
- [x] TypeScript `tsc --noEmit`: 0 hata ✅

## ✅ Alembic Revision ID Fix (2026-06-13) — TAMAMLANDI

- [x] 0003 revision → `0003_part18_plans` (35→17 karakter)
- [x] 0004 revision → `0004_part19_campaign_sim` (38→24 karakter)
- [x] 0005 revision → `0005_part20_campaign_meta` (36→25 karakter)
- [x] `_EXPECTED_HEAD` → `0005_part20_campaign_meta` (admin_intelligence.py + test)
- [x] `requirements-dev.txt` oluşturuldu (pytest + pytest-asyncio)
- [x] `alembic upgrade head` hatasız: 0002→0003→0004→0005 ✓
- [x] `alembic current` = `0005_part20_campaign_meta (head)` ✓
- [x] `tests/test_campaign_intelligence.py` → 28/28 PASSED ✓
- [x] `tests/test_migration_health.py` → 7/7 PASSED ✓

**Kural:** Gelecekte yeni revision ID'ler 32 karakter sınırını aşmamalı:
```bash
alembic revision --autogenerate -m "açıklama" --rev-id "0006_part21_kısa"
```

## 🔜 Part 20 Sonrası — Hemen Yapılması Gerekenler

## 🔜 Part 21 Adayları

### Provider Discovery Gerçek Entegrasyon
- `campaign_discovery_service.discover_campaign_creators()` şu an sınırlı DB sorgusu yapıyor
- Apify / YouTube Data API ile gerçek creator discovery (`AGENTS_MODE=live` iken)
- `discovery_sources` alanına provider listesi yazılmalı (örn. `["apify_instagram", "youtube_api"]`)

### Campaign Report PDF Export
- Agency+ plan kullanıcıları için `/campaigns/{id}/export/pdf` endpoint
- `white_label_export` locked section kaldırılır (agency+)
- jinja2 + weasyprint veya reportlab ile PDF üretimi

### Campaign Status Flow
- `draft` → `active` → `completed` → `archived` durum geçişleri
- `PUT /campaigns/{id}/status` endpoint
- Frontend: status badge tıklanınca dropdown geçiş formu

### Admin Campaign Analytics
- `/admin/campaigns/stats` — toplam kampanya sayısı, plan dağılımı, report_source dağılımı
- Ortalama data_confidence per plan
- En çok excluded creator olan kampanyalar

### Creator Enrichment Pipeline
- Archive'daki düşük completeness creator'lar için arka plan zenginleştirme görevi
- Scheduler'da günlük `enrich_low_completeness_creators()` task'ı
- Tamamlandığında campaign portfolio'larının güncellenmesi

---

# TODO_NEXT — Part 19 Post: Campaign Intelligence Hardening Sonrası (2026-06-13)

## ✅ Part 19'da Tamamlanan

- [x] `frontend/app/(app)/campaigns/[id]/page.tsx` — Campaign detail sayfası oluşturuldu, 404 "Kampanyayı Gör" hatası çözüldü
- [x] `frontend/lib/api.ts` — `DiscoveryCard.source?: string`, `Campaign.simulation_result`, `CampaignCreateBody.simulation_result` alanları eklendi
- [x] `frontend/lib/simulation-engine.ts` — `DataCompleteness` tipi + `computeCreatorQualityScore()` completeness desteği + `buildDataSourceNotes()` arşiv/minimal sayıları
- [x] `frontend/app/(app)/campaigns/simulate/page.tsx` — `saveAsCampaign()` tam simulation_result gönderiyor, veri kalitesi banner'ları + `~EST` badge
- [x] `backend/app/models/campaign.py` — `simulation_result` JSON kolonu
- [x] `backend/app/api/v1/routes/campaigns.py` — simulation_result DB'ye kaydediliyor
- [x] `backend/alembic/versions/0004_part19_campaign_simulation_result.py` — migration
- [x] TypeScript tsc --noEmit: 0 hata ✅
- [x] npm run build: başarılı ✅ (`/campaigns/[id]` dynamic route görünüyor)

## 🔜 Part 20 Adayları

### Backend Tests — Campaign Intelligence
- `backend/tests/test_campaign_intelligence.py` — eksik testler:
  - Kampanya create simulation_result kaydeder
  - Kampanya detail simulation_result döndürür
  - Kalite skoru 49'a default olmuyor (veri varsa)
  - Bütçe dağılımı naive eşit split değil

### Alembic — Migration Doğrulama
- `alembic upgrade head` çalıştır (0004 migration)
- `GET /admin/health/migrations` → `schema_ready: true` doğrula

### Creator Data Quality Improvement
- Arşiv creator'larına ülke/kategori bilgisi zenginleştirmesi admin panelinden
- Import sırasında eksik alanları zorunlu kılma (country, category)
- DataCompleteness < "complete" olan profilleri admin listesi

### Campaign Portfolio Quality Gate
- Tüm creator'ları `minimal` veri kalitesiyle olan kampanyalarda uyarı gönder
- Minimum güven skoru altındaki kampanyalar için "Daha Fazla Analiz Yap" yönlendirmesi

---

# TODO_NEXT — Part 18 Post: Entitlement System Sonrası (2026-06-13)

## ✅ Part 18'de Tamamlanan

- [x] `PlanType` enum'a AGENCY + ENTERPRISE eklendi
- [x] `entitlement_service.py` — 26 feature key, plan-bazlı kontrol, require_feature() dependency
- [x] `routes/entitlements.py` — /pricing/plans, /entitlements/me, /events/premium, /admin/plans/* endpoint'leri
- [x] `digital_twin.py`, `competitor_intelligence.py` — require_feature() guard'ları
- [x] `risk_radar.py` — evidence redaction (anomaly_events + signals gizlenir, evidence_locked_meta döner)
- [x] `main.py` — 6 paket seed (non-destructive upsert), entitlements router
- [x] Alembic migration: `0003_part18_agency_enterprise_plans.py`
- [x] 20 backend entitlement testi
- [x] `frontend/lib/api.ts` — FeatureLockedDetail, FeatureLockedError, isFeatureLockedError
- [x] `frontend/lib/entitlements-api.ts` — entitlementsApi client
- [x] `frontend/components/premium/*` — PlanBadge, UpgradeModal, PremiumLockedCard, FeatureGate, UsageLimitBanner
- [x] `frontend/app/pricing/page.tsx` — 5 plan, aylık/yıllık toggle, özellik karşılaştırma tablosu
- [x] `frontend/app/(app)/dashboard/page.tsx` — UsageLimitBanner + kilitli modüller grid
- [x] `AppShell.tsx` — Plan lock badge'leri (AGENCY/PRO gerektiren nav items)
- [x] `intelligence/digital-twin` + `competitor-intelligence` — FeatureGate sarması
- [x] TypeScript tsc --noEmit: 0 hata ✅
- [x] npm run build: başarılı ✅

## 🔜 Part 19 Adayları

### Alembic — Canlı Ortam Doğrulaması
- `alembic upgrade head` çalıştır
- `GET /admin/health/migrations` endpoint'ini doğrula (schema_ready: true)
- PlanType enum migration'ı PostgreSQL'de test et

### Admin Plan Yönetim UI
- `/admin` → "Planlar & Özellikler" tab'ı ekle
- Feature matrix görünümü (plan × özellik)
- Plan fiyat/kredi düzenleme formu
- `PUT /admin/plans/{slug}/features` ve `PUT /admin/plans/{slug}/limits` endpoint'lerini bağla

### Stripe Entegrasyonu
- Stripe checkout session oluşturma
- Webhook handler: plan yükseltme/düşürme, kredi yenileme
- `invalidateEntitlementCache()` webhook sonrası tetikleme

### Analysis Detail Premium Sections
- Analiz detay sayfasına kilitli bölümler ekle (evidence, ROI prediction, audience quality)
- `isFeatureLockedError` + `PremiumLockedCard` pattern'i kullan

### Risk Alert Notification
- HIGH/CRITICAL alert oluştuğunda admin e-posta bildirimi

---

# TODO_NEXT — Güncel Durum (2026-06-13 Post-Audit) ✅

## ✅ Post-Audit Session'da Tamamlanan

- [x] `risk_radar.py` `GET /risk-radar/alerts` — `RiskAlert.resolved` AttributeError kritik fix
- [x] `lib/risk-radar-api.ts` — RiskAlert interface 20 alana güncellendi, AlertStatus/AlertSource tipleri
- [x] `app/(app)/admin/risk-alerts/page.tsx` — Yeni tam yönetim sayfası (3 tab)
- [x] `AppShell.tsx` — Admin nav Risk Alertler linki + fonksiyonel global arama formu
- [x] `app/(app)/admin/page.tsx` — DB Schema tab (migration health)
- [x] `app/(app)/admin/intelligence/page.tsx` — Tarama Logları tab
- [x] `lib/api.ts` — `request<T>()` export edildi
- [x] Local `request`/`apiFetch` fonksiyonları kaldırıldı (3 dosya) → merkezi `lib/api.ts` kullanımı

## 🔜 Part 18 Adayları

### Risk Alert Notification
- HIGH/CRITICAL alert oluştuğunda admin e-posta bildirimi
- Event bus: `risk.alert.created` → CEO Agent routing

### Alembic — Docker Entegrasyonu
- `docker-compose.yml`'ye `alembic upgrade head` startup komutu ekle

### Gerçek Ortamda Doğrulama
- `docker compose up` ile `alembic upgrade head` çalıştır
- Mevcut DB varsa `alembic stamp 0001_initial_full_schema && alembic upgrade head`
- `GET /admin/health/migrations` endpoint'inin `schema_ready: true` döndürdüğünü doğrula

### Scheduled Scan Geliştirmeleri
- Scan interval'i env var ile yapılandırılabilir hale getir (`RISK_SCAN_INTERVAL_SECONDS`)
- Failed profile raporlama geliştirilmesi

---

# TODO_NEXT — Part 17: Database Integrity + Scheduled Risk Scanning + Risk Alert Backend ✅ + Sonrası

## ✅ Part 17'de Tamamlanan

- [x] `alembic.ini` — Alembic yapılandırması (sıfırdan kurulum)
- [x] `alembic/env.py` — Async-compatible env (create_async_engine + NullPool + asyncio.run)
- [x] `alembic/script.py.mako` — Şablon dosyası
- [x] `alembic/versions/0001_initial_full_schema.py` — Parts 1-16 baseline (30 tablo, doğru sıralı)
- [x] `alembic/versions/0002_part17_risk_alert_extended.py` — RiskAlert genişletme + RiskScanLog + 5 index + veri migrasyonu
- [x] `models/risk_radar.py` — AlertStatus/AlertSource enum, RiskAlert 11 yeni alan, RiskScanLog model
- [x] `models/__init__.py` — Yeni model/enum importları
- [x] `services/risk_alert_service.py` — create_or_update_alert (dedup), acknowledge/dismiss/resolve, list_alerts, alert_to_dict
- [x] `services/risk_radar/engine.py` — _check_and_create_alerts() risk_alert_service'i kullanır
- [x] `services/risk_scan_scheduler.py` — start/stop scanner, daily loop, batch scan, per-profile isolation, NOT_CHARGED logging
- [x] `api/v1/routes/risk_alerts.py` — Admin CRUD (list, get, acknowledge, dismiss, resolve)
- [x] `api/v1/routes/admin_intelligence.py` — GET /admin/health/migrations, GET /admin/health/scan-logs, POST /admin/risk-scan/trigger
- [x] `main.py` — risk_alerts router, risk_scan_scheduler startup/shutdown, version v9.0.0
- [x] `tests/__init__.py` — Test package init
- [x] `tests/test_risk_alert_service.py` — 14 test (dedup, lifecycle, dict shape, permissions)
- [x] `tests/test_migration_health.py` — 7 test (sabitleri, response shape, non-admin 403)
- [x] `tests/test_risk_scan_scheduler.py` — 7 test (dedup, source, idempotency, enum values)

---

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
