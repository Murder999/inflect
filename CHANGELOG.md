# CHANGELOG — Inflect Platform

---

## v8.2.0 — Part 16: Archive-Independent Risk Radar + Intelligence Credit Control

### Backend — New Files

- **`services/influencers/resolve.py`** — Influencer Resolve Pipeline: normalizes @handle/URL/username → DB lookup → if missing: deterministic mock (AGENTS_MODE=mock) or live provider → creates InfluencerProfile + InfluencerSnapshot → returns ResolvedInfluencer dataclass with status, followers, avatar info, warnings, failure_code.
- **`models/intelligence_billing.py`** — `IntelligenceFeature` (DB-driven credit cost per mode + plan access), `IntelligenceUsageLog` (every invocation logged with status and credits charged), `UsageStatus` enum.
- **`services/intelligence_billing.py`** — `get_feature_cost()`, `can_use_feature()`, `charge_feature_usage()`, `record_failed_usage()`, `seed_intelligence_features()` — all credit logic, no hardcoded costs.
- **`api/v1/routes/admin_intelligence.py`** — Admin: GET/PATCH features, GET usage logs (paginated + filtered), GET summary. User-facing: `GET /intelligence/features/me` → effective costs for current user.

### Backend — Updated Files

- **`api/v1/routes/risk_radar.py`** — New `POST /risk-radar/scan` (body-based, archive-independent). Uses resolve pipeline + intelligence billing. Credits charged ONLY on success. Report mode (limited/standard/full) auto-detected from snapshot count. Structured failure responses with `failure_code`. Fixed credit charge timing (was before scan, now after).
- **`models/__init__.py`** — Added `IntelligenceFeature`, `IntelligenceUsageLog`, `UsageStatus` imports.
- **`main.py`** — Registers `admin_intelligence` router, seeds `IntelligenceFeature` rows on startup, version → `8.2.0`.

### Frontend — New Files

- **`app/(app)/admin/intelligence/page.tsx`** — Intelligence Billing admin panel: feature list table grouped by category, edit modal (costs per mode, toggles, plan access), usage log table (filterable by slug/status, paginated), summary tab with aggregate stats.

### Frontend — Updated Files

- **`lib/risk-radar-api.ts`** — Added `queryScan()`, `getMyFeatureCosts()`, new types: `ReportMode`, `ResolvedInfo`, `QueryScanFailure`, `QueryScanResult`, `FeatureCostInfo`. Fixed `ScanResponse.ok: true` as discriminant.
- **`app/(app)/intelligence/risk-radar/page.tsx`** — Query-based flow: any @handle/URL/username works (no archive required). `RiskFailureCard` for structured errors. `ReportModeBadge` (Limited/Standard/Full Evidence). Resolved profile banner. Scan button enabled from 2 chars. Warnings from resolve pipeline. `runScan()` uses `queryScan()`.
- **`components/layout/AppShell.tsx`** — Added Intelligence Billing link in admin nav.

---

## v8.1.0 — Part 15 Final: Influencer Risk Radar™ Full Production UX

### Frontend — Risk Radar Page Complete UX Overhaul

- **`app/(app)/intelligence/risk-radar/page.tsx`** — Fully rewritten for premium enterprise UX:
  - **InfoPanel** — Premium right-side knowledge block explaining Risk Radar features, risk level legend, and disclaimer when page first loads. Two-column empty state layout.
  - **RiskGauge** — Enhanced SVG gauge with zone rings (low/medium/high/critical), smooth transition animation, larger hit area.
  - **RiskTimelineChart** — recharts AreaChart showing estimated risk trajectory over the selected window (30/60/90/180 days). Gradient fill, custom tooltip with level labels.
  - **SentimentSection** — Visual stacked bar chart for positive/neutral/negative distribution derived from sentiment dimension. Signals list below.
  - **AdminActionsPanel** — Admin-only panel with: Snapshot Sync, Avatar Resolve, Force Refresh buttons. Uses `archiveAdminApi` from `influencers-api.ts`. Hidden for non-admin users.
  - **DimensionBar** — Richer expanded view with risk score, confidence pill, trajectory badge, colored card background.
  - **AnomalyCard** — Severity icon, type badge, period badge, improved layout.
  - **ProfileDropdown** — Low-data warning chip, snapshot count display, category pill.
  - **Hint chips** — Example search queries shown when no profile selected.
  - **Window selector** — Clears report when changed to force fresh analysis.
  - **SuccessBanner** — Green confirmation after forced refresh.
  - **Responsive design** — Mobile-friendly grid collapses to single column below 900px.
  - **TypeScript 0 errors** — All types verified with `npx tsc --noEmit`.

---

## v8.0.0 — Part 15: Influencer Risk Radar™

### Backend — New Services
- **New: `models/risk_radar.py`** — `InfluencerRiskReport` (cached report with TTL), `RiskAlert` (severity-tagged alerts)
- **New: `services/risk_radar/`** — 10-module service layer:
  - `schemas.py` — constants (RISK_*, TRAJ_*, DIM_*), DIMENSION_WEIGHTS, dataclasses
  - `anomaly_detection.py` — growth anomalies (period-over-period, mean+2σ), engagement drop detection
  - `volatility_engine.py` — coefficient of variation analysis (ER, followers, fraud_score, avg_views)
  - `brand_alignment.py` — brand fit / rep risk composite, engagement quality, sentiment
  - `risk_scoring.py` — fraud risk (0.65×fraud + 0.35×auth inverse), composite score, trajectory
  - `confidence_engine.py` — points-based (snapshot count + coverage + consistency → low/medium/high)
  - `explainability.py` — evidence summary strings, mandatory limitation disclosures (TR)
  - `mock_generator.py` — deterministic SHA-256 seeded mock, all outputs labeled [MOCK]
  - `engine.py` — main `scan_influencer()`, cache check/write (24h live / 1h mock), event firing
- **New: `services/agents/risk_radar_agent.py`** — RiskRadarAgent (trust_safety dept, supervised autonomy)
- **New: `api/v1/routes/risk_radar.py`** — 4 endpoints:
  - `POST /risk-radar/scan/{profile_id}` — 1 credit, generates/caches report
  - `GET /risk-radar/report/{profile_id}` — 0 credits, cached only
  - `GET /risk-radar/alerts` — recent alerts
  - `GET /risk-radar/high-risk` — admin only, HIGH/CRITICAL profiles

### Backend — Modified
- **`main.py`**: risk_radar router registered; version → 8.0.0, ai → part-15-risk-radar
- **`models/__init__.py`**: InfluencerRiskReport, RiskAlert imports
- **`agent_factory.py`**: `risk-radar-agent` slug + PROVIDER_MAP entry
- **`agent_registry.py`**: risk-radar-agent metadata (trust_safety, daily, supervised)
- **`event_bus.py`**: 5 new events — creator.risk_changed, creator.sentiment_spike, creator.growth_anomaly, creator.brand_alignment_declined, creator.high_risk_detected
- **`services/agents/ceo_agent.py`**: TASK_ROUTING entries for brand_safety_audit, risk_radar_scan

### Frontend
- **New: `lib/risk-radar-api.ts`** — typed TS client with local `request<T>()`, all types, helper maps
- **New: `app/(app)/intelligence/risk-radar/page.tsx`** — enterprise UI:
  - Profile search autocomplete (reuses influencers lookup)
  - Risk gauge (SVG radial), 6-dimension bars with collapsible signal lists
  - Anomaly event cards (color-coded by severity)
  - Evidence + limitations panel
  - MOCK banner, loading skeleton, accessible error banner
  - Window selector (30/60/90/180 days), 1-credit scan button
- **`components/layout/AppShell.tsx`**: Risk Radar™ nav link added to NAV_INTELLIGENCE (ShieldAlert icon)

### Safety & compliance
- No political/ideological/protected-attribute inference
- Mandatory limitation disclosure on every report (TR)
- All mock data clearly labeled [MOCK]
- Deterministic mock via SHA-256 hash of `username:platform`

---

## v7.0.1 — Part 13 Final Fix: Competitor Intelligence Production Hardening

### Backend fixes
- **`services/competitor_intelligence/brand_lookup.py`**: `search_competitors()` now searches both brand name AND aliases JSON column (OR query with `cast(aliases, Text)`). Previously only name was searched, making alias-based autocomplete non-functional.
- **`api/v1/routes/competitor_intelligence.py`**: Added optional `platform` query param to `GET /lookup` endpoint (`instagram|tiktok|youtube`).

### Frontend fixes
- **`app/(app)/intelligence/competitor-intelligence/page.tsx`**: Fixed critical bug — no-results dropdown never rendered because `setDropdownOpen(results.length > 0)` made `dropdownOpen && suggestions.length === 0` an impossible condition. Changed to `setDropdownOpen(true)` after any completed search, allowing the no-results empty state to show correctly.
- **`app/(app)/intelligence/competitor-intelligence/page.tsx`**: Added Campaign Patterns section to `ReportView`. Previously `campaign_patterns` field was typed, populated by backend, but never displayed in the UI.

### Acceptance criteria
- TypeScript: 0 errors (`npx tsc --noEmit`)
- Python syntax: 0 errors (`ast.parse`)

---

## v7.0.0 — Part 13: Competitor Intelligence Agent™

### Backend
- **New: `models/competitor_intelligence.py`** — CompetitorProfile, CompetitorCampaignSignal, CompetitorReportCache (3 new DB models)
- **New: `services/competitor_intelligence/`** — 11-module service layer: schemas, brand_lookup, creator_detection, spend_estimation, category_analysis, overlap_analysis, opportunity_engine, confidence_engine, explainability, mock_generator, engine
- **New: `services/agents/competitor_intelligence_agent.py`** — BaseAgent with mock (deterministic) and live (archive scan) modes
- **New: `api/v1/routes/competitor_intelligence.py`** — 5 REST endpoints: lookup, generate (1 credit), get, opportunities, search
- **`main.py`**: competitor_intelligence router registered; version → 7.0.0
- **`models/__init__.py`**: 3 new competitor model imports
- **`agent_factory.py`**: `competitor-intelligence-agent` slug added
- **`agent_registry.py`**: CompetitorIntelligenceAgent™ metadata seeded
- **`event_bus.py`**: 5 new event types (competitor.detected, competitor.report.generated, competitor.momentum_changed, creator.brand_signal_detected, opportunity.detected)

### Frontend
- **New: `lib/competitor-intelligence-api.ts`** — Full typed API client with formatSpendTL, tierLabel, confidence/priority helpers
- **New: `app/(app)/intelligence/competitor-intelligence/page.tsx`** — Enterprise Bloomberg/Palantir-style UI: search, 6-metric summary bar, opportunity cards, platform/tier/category distribution bars, creator signal table (50 rows), spend methodology, evidence & limitations panel, mock banner
- **`AppShell.tsx`**: "Competitor Intel™" nav link added to Intelligence section

### Design principles upheld
- No fake revenue or ROAS values
- All spend estimates are range-based, rounded to 50K TL, with methodology and limitations
- Confidence: HIGH/MEDIUM/LOW with explicit point system
- Mock mode: deterministic SHA-256 hash, clearly labeled [MOCK]
- Human approval required for important actions (AGENTS_REQUIRE_HUMAN_APPROVAL=true)

### ⚠️ Requires migration
```
alembic revision --autogenerate -m "competitor_intelligence_part13"
alembic upgrade head
```

---

## v6.2.0 — Part 12 Finalization: Avatar Guarantee + Data Readiness + Admin Actions

### Backend
- **`api/v1/routes/digital_twin.py`**: Kredi sadece başarılı forecast üretiminde düşer (`is_forecast_available=True`). Yetersiz veri durumunda veya exception'da kredi düşmez.
- **`services/influencers/lookup.py`**: Lookup response'a `avatar_status` ("existing"/"fallback"), `avatar_source` ("profile"/"initials") eklendi. `data_sufficiency`'a `estimated_ready_at` (ilk snapshot + 30 gün) ve `missing[]` array eklendi.
- **`api/v1/routes/archive.py`** (2 yeni endpoint):
  - `POST /archive/profiles/{id}/sync` — admin: tek profil snapshot sync + `influencer.snapshot.created` event
  - `POST /archive/profiles/{id}/resolve-avatar` — admin: tek profil avatar resolve, gerçek URL yoksa DB güncellenmez

### Frontend
- **`components/ProfileAvatar.tsx`** (güncellendi): Çoklu URL chain (profileImageUrl → src), onError fallback, platform badge (`showBadge`), `borderRadius` prop, referrerPolicy
- **`lib/influencers-api.ts`**: `DataSufficiency` arayüzüne `estimated_ready_at` ve `missing[]` eklendi. `InfluencerLookupResult`'a `avatar_status` ve `avatar_source` eklendi. `archiveAdminApi` eklendi (syncProfile, resolveAvatar)
- **`app/(app)/intelligence/digital-twin/page.tsx`**:
  - Tüm `<img>` tagları `<ProfileAvatar>` bileşeni ile değiştirildi — broken image yok
  - `AdminActionsPanel` bileşeni eklendi (Snapshot Sync, Avatar Resolve, Archive linki) — sadece admin görür
  - `InsufficientDataPanel` güncellendi: `estimated_ready_at`, `missing[]`, admin/normal user ayrımı
  - `SelectedProfilePanel` güncellendi: admin actions inline
  - `authApi.me()` ile admin statüsü yüklenir (isAdmin state)

### Kredi Kuralları (Kesinleştirildi)
- Lookup: 0 kredi
- Twin generate (başarılı): 1 kredi
- Twin generate (yetersiz veri / exception): 0 kredi
- Twin refresh (başarılı): 1 kredi
- Admin sync/resolve: 0 kredi

---

## v6.1.0 — Part 12 UX Fix: Username-Based Influencer Lookup

### Backend
- **`services/influencers/identity.py`** (YENİ): URL/handle normalization — Instagram, TikTok, YouTube formatları deterministik parse edilir
- **`services/influencers/lookup.py`** (YENİ): DB search (exact + ilike + display_name), snapshot aggregate, twin status, data sufficiency enrichment
- **`api/v1/routes/influencers.py`** (YENİ): `GET /api/v1/influencers/lookup?q=&platform=` — kredi düşmez, full twin status döner

### Frontend
- **`lib/influencers-api.ts`** (YENİ): `influencersApi.lookup()`, typed interfaces, platform label/color helpers
- **`app/(app)/intelligence/digital-twin/page.tsx`** (TAMAMEN YENİLENDİ):
  - "Profile ID girin" input'u tamamen kaldırıldı
  - Debounced search + platform selector eklendi
  - ResultCard, SelectedProfilePanel, InsufficientDataPanel bileşenleri
  - Auto-select (tek sonuç), auto-load twin, conditional action buttons
  - Kredi bilgisi buton label'larında görünür

### Standard: No internal ID exposure
- Kullanıcı artık internal profile_id görmez
- Tüm ID yönetimi arka planda yapılır

---

## v6.0.0 — Part 12: Influencer Digital Twin™ Forecast Intelligence

### Core Architecture — Digital Twin System

**services/digital_twin/** (YENİ — 10 modül)
- `schemas.py`: SnapshotPoint, TrendResult, VolatilityResult, RiskProjection, HorizonForecast, DigitalTwinResult
- `data_quality.py`: Minimum snapshot/gün kontrolü, yetersiz veri = forecast blok
- `trend_analysis.py`: OLS-based ER slope, recency-weighted growth rate, momentum/fraud trend
- `volatility.py`: stdev-based volatility score, spike/crash detection
- `risk_projection.py`: 6 risk faktörü (fraud, engagement_decay, inactivity, volatility, sponsorship_overload, burnout)
- `confidence_engine.py`: Points-based — insufficient/low/medium/high
- `forecast_engine.py`: Horizon dampening + volatility range, per-horizon HorizonForecast
- `explainability.py`: Evidence labels (Historical Trend, Velocity Analysis, Volatility Detection, etc.)
- `campaign_readiness.py`: Score-based ready/conditional/caution/not_recommended
- `twin_engine.py`: Full pipeline orchestrator — load → quality check → analyze → forecast → persist

### New DB Models (`models/digital_twin.py`)
- `InfluencerDigitalTwin`: Master twin record per influencer (is_latest versioning)
- `TwinForecast`: Per-horizon forecast data with full evidence JSON
- `TwinSignal`: Extracted historical signals (follower_growth_rate, er_delta, fraud_score_delta, volatility)
- Enums: ConfidenceLevel, RiskTrend, StabilityTrend, CampaignReadiness

### New Agent
- `services/agents/digital_twin_agent.py`: DigitalTwinAgent (intel dept, daily scheduled, mock/active aware)

### New API Routes (`api/v1/routes/digital_twin.py`)
- `POST /digital-twin/generate/{id}` — 1 kredi, twin oluştur
- `GET /digital-twin/{id}` — mevcut twin getir
- `POST /digital-twin/refresh/{id}` — 1 kredi, yenile
- `GET /digital-twin/high-risk` — artan risk trendli listesi (admin)
- `GET /digital-twin/` — tüm twins (admin, confidence filter)

### Frontend
- `lib/digital-twin-api.ts`: Typed API client, label/color helpers
- `app/(app)/intelligence/digital-twin/page.tsx`: Enterprise UI (overview, horizon cards, evidence accordion, campaign readiness)
- AppShell: Digital Twin™ nav link eklendi

### Event Bus
- digital_twin.generated, digital_twin.updated, digital_twin.failed, influencer.snapshot.created

### Standard: No fake predictions
- Random confidence → eliminated
- Seeded forecast → eliminated
- Hallucinated revenue → not implemented
- All projections traceable to snapshot data

---

## v5.0.0 — Part 11: Enterprise Autonomous Agent System

### Backend — Yeni Agent Implementations

**services/agents/security_agent.py** (YENİ)
- 5 güvenlik kontrolü: env secret, auth endpoints, admin access, CORS/headers, data access audit
- P0/P1/P2 risk sınıflandırması
- `is_mock` her çıktıda, açık etiketleme
- Yıkıcı işlemlerde approval gerektirir

**services/agents/cto_agent.py** (YENİ)
- 6 teknik alan: API routes, DB/migration, async patterns, frontend build, technical debt, scalability
- P1/P2/P3 öncelik bazlı raporlama
- Recommended actions listesi

**services/agents/data_quality_agent.py** (YENİ)
- MOCK modda: açıkça etiketli, gerçek veri yok uyarısı
- ACTIVE modda: gerçek DB sorgusu (missing avatar/country/category, duplicate, snapshot coverage)
- Onay gerektirmiyor (read-only)

### Backend — Güncellenen Servisler

**services/agents/agent_factory.py**
- 3 yeni slug: security-agent, cto-agent, data-quality-agent
- Provider map: security/cto → claude, data-quality → mock

**services/agent_registry.py**
- 3 yeni agent kaydı (toplam 29)
- security-agent: HIGH risk, daily scheduled
- cto-agent: MEDIUM risk, weekly scheduled
- data-quality-agent: LOW risk, daily scheduled

**services/agent_orchestrator.py**
- 5 yeni plan: security_audit, technical_review, data_quality_audit, weekly_executive_summary
- Tüm planlar CEO Agent tarafından koordine edilir

**services/agent_scheduler.py**
- 3 yeni scheduled job: security daily, data quality daily, CTO weekly

**services/agents/ceo_agent.py**
- TASK_ROUTING'e 4 yeni tip eklendi

**services/agents/growth_agents.py**
- Pre-existing f-string syntax bug düzeltildi

**api/v1/routes/agents.py**
- mock-run endpoint: message_count, agents_involved, scenario, note alanları eklendi

### Frontend — Güncellenen Dosyalar

**lib/agents-api.ts**
- AgentRole: security, cto, data_quality, growth, discovery, intel, archive_ai eklendi
- ROLE_ICON: yeni roller için ikonlar
- DEPT_LABEL, DEPT_COLOR sabitleri: 8 departman
- triggerMockAgentRun return type düzeltildi

**app/(app)/admin/agents/page.tsx**
- DepartmentGroupedAgents bileşeni — varsayılan görünüm
- Event Log paneli — son 20 event, status/source/time
- Pending Approvals paneli — inline onay listesi
- 3 yeni orchestration type: security_audit, technical_review, data_quality_audit
- Banner: mode (MOCK/ACTIVE) + risk level bilgisi
- loadApprovals/loadEvents otomatik çağırma

### Teknik

- Backend version: 5.0.0
- TypeScript: `npx tsc --noEmit` → 0 hata
- Python: `ast.parse` tüm .py → 0 hata

---

## v4.4.0 — Phase 1 UI: Premium Design System + Dark/Light Theme

### Design System

**app/globals.css** (tam yeniden yazım)
- `[data-theme="dark"]` bloku eklendi — deep navy (#06090F) bg, emerald (#34D399) accent
- `--header-bg` / `--header-border` CSS vars: light = rgba(247,247,249,0.88), dark = rgba(6,9,15,0.90)
- `--grad-start` / `--grad-end`: light = green+violet, dark = emerald+indigo
- `--glow-brand` / `--glow-card`: dark mode premium glow efektleri
- `@layer components` ile utility classes tanımlandı:
  - `.card`, `.card-glass` — border, shadow, hover geçişleri
  - `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`, `.btn-lg`
  - `.badge`, `.badge-brand`, `.badge-red`, `.badge-amber`, `.badge-blue`
  - `.progress-track`, `.progress-fill` — kredi çubuğu
  - `.grad-text` — CSS var tabanlı gradient metin
  - `.input` — form input standardı
  - `.stat-num`, `.section-title` — tipografi yardımcıları
- Smooth theme transition (background, border, color, shadow — 0.20s ease)
- Custom scrollbar (light/dark uyumlu)
- `::selection` highlight (yeşil tint)

### Theme System

**app/layout.tsx**
- Anti-flash inline script eklendi: React hydrate olmadan önce `data-theme` uygulanır
- localStorage key: `inflect-theme`

**components/ThemeToggle.tsx** (YENİ)
- `variant="topbar"` — pill şekli (topbar ve footer'da kullanılıyor)
- `variant="sidebar"` — tam genişlik buton (AppShell sidebar'da kullanılıyor)
- Hydration guard: placeholder render → mounted sonrası gerçek state
- localStorage'dan okur, `document.documentElement` üzerinde `data-theme` set eder

**components/layout/AppShell.tsx**
- `ThemeToggle variant="sidebar"` eklendi (logout butonunun üstünde)
- Tüm renk değerleri zaten CSS var kullanıyordu → dark mode otomatik çalışıyor

### Landing Page

**app/page.tsx** (tam yeniden tasarım — tüm CTAlar ve linkler korundu)
- Topbar: `var(--header-bg)` kullanımı, ThemeToggle eklendi
- Hero headline değişti: "Doğru influencer'ı saniyeler içinde bul." → "Influencer Seçmeyin. İstihbarat Toplayın."
- `.grad-text` ile animate gradient başlık (CSS var tabanlı, dark/light uyumlu)
- Stats section: `stat-num` utility class, alt başlık eklendi
- Features: 6 spesifik feature (Audience Intelligence, Fraud Intelligence, Brand Match AI, ROI Prediction, Similar Influencers, Campaign Planner) — ikon+badge+açıklama
- "3 adımda gerçek istihbarat" section eklendi (How It Works)
- Testimonials: yıldız derecelendirmesi eklendi
- Pricing: "✦ En Popüler" badge güncellemesi
- Footer: ThemeToggle eklendi, alt çizgi divider
- Tüm inline style renkleri CSS var tabanlı

### Değişmeyen
- Tüm route'lar, API çağrıları, state, form, iş mantığı
- `tailwind.config.ts` — darkMode: "class" korundu
- `next.config.ts` — değiştirilmedi
- Tüm admin sayfaları — CSS var kullandıkları için dark mode otomatik çalışıyor

---

## v4.3.1 — Part 6: Profile Image Resolution Pipeline

### Backend

**services/avatar_resolver.py** (YENİ)
- `resolve_profile_image(platform, username, cfg)` — async, provider'dan avatar URL çeker
- Platform-specific field priority: data_provider._pick() zinciri üzerinden uygulanır
- Dönüş: `{profile_image_url, source, ok, error}` — başarısızsa ok=False, profil dokunulmaz
- URL `startswith("http")` kontrolü — boş/placeholder URL kabul edilmez

**api/v1/routes/archive.py**
- `POST /archive/resolve-avatars?limit=50` endpoint eklendi (admin-only)
- `or_` import eklendi (sqlalchemy)
- `profile_image_url IS NULL OR ''` filtresi → `updated_at ASC` sırası
- Her profil için `resolve_profile_image()` çağrılır; başarılıysa DB güncellenir
- Max 20 hata detayı response'a dahil edilir

### Frontend

**lib/api.ts**
- `archiveApi.resolveAvatars(limit?)` eklendi — POST /archive/resolve-avatars

**app/(app)/admin/archive/page.tsx**
- `resolving` + `resolveMsg` state eklendi
- `handleResolveAvatars()` fonksiyonu eklendi
- Header'a "◉ Resolve Avatars" butonu eklendi (Bulk Sync'ten önce)
- resolveMsg banner eklendi (yeşil/kırmızı)

### Değişmeyen (müdahale gerekmedi)
- `services/archive_sync.py` — sync/analyze zaten `_apply_provider_to_profile()` ile avatar güncelliyor
- `services/data_provider.py` — platform-specific avatar field priority zaten uygulanmış
- `components/ProfileAvatar.tsx` — profile_image_url → src → initials fallback + onError zinciri
- `next.config.ts` — tüm CDN remotePatterns zaten tanımlı

---

## v4.3.0 — Part 5: JSON Import Pipeline

### Backend

**models/influencer_archive.py**
- `InfluencerImportLog` modeli eklendi: filename, total/created/updated/skipped/error count, created_at, created_by_user_id

**models/__init__.py**
- `InfluencerImportLog` export'a eklendi (create_all ile tablo otomatik oluşur)

**api/v1/routes/archive.py**
- `POST /archive/import-json` endpoint eklendi (admin-only, multipart UploadFile)
- JSON yapısı: `{ influencers: [...] }` — handle, name, platform, categories, followers, profile_image_url
- Normalizasyon: handle → username (@ temizlenir), platform lowercase + youtube/tiktok/instagram normalize
- Dedup: username + platform unique key — varsa güncelle (updated), yoksa oluştur (created)
- Snapshot: followers null değilse `source_type="json_import"` ile oluşturulur; null ise atlanır (fake veri yok)
- Her import sonunda `InfluencerImportLog` kaydı yazılır
- Hata toleranslı: tek kayıt hatası tüm import'u kesmez

### Frontend

**lib/api.ts**
- `archiveApi.importJson(file: File)` eklendi — multipart FormData ile POST /archive/import-json

**app/(app)/admin/archive/page.tsx**
- "⬆ JSON Import" bölümü eklendi: dosya seç + Import butonu
- Import sonucu: created / updated / skipped / errors banner olarak gösterilir
- Import tamamlandığında liste otomatik yenilenir

---

## v4.2.2 — Part 4: Kritik Security Fix (Auth Guard + Login)

### Frontend

**lib/api.ts**
- 401 handler düzeltildi: `/login` veya `/register` sayfasındayken artık redirect yapılmıyor
- Auth sayfasındaki 401'de backend'den gerçek hata mesajı (`detail`) parse edilerek kullanıcıya gösteriliyor
- Daha önce: yanlış şifreden 401 gelince "Oturum süresi doldu" görünüyor ve sayfa yeniden yükleniyordu
- `authApi.register` tipinde `company` artık zorunlu (`string`, eski: `string | undefined`)

**app/(app)/layout.tsx**
- "use client" eklendi; AuthGuard + AdminGuard implement edildi
- Token yoksa → `/login`'e redirect (render engellendi)
- `/auth/me` ile token doğrulandı; 401 → token temizle + `/login` redirect
- Admin guard: `/admin/*` yollarında `is_admin=false` kullanıcılar `/dashboard`'a yönlendiriliyor
- Client-side navigasyonda da admin guard aktif (pathname değişimini izliyor)
- Token doğrulanana kadar loading spinner gösteriliyor; sayfa içeriği doğrulama sonrası render ediliyor

**app/(auth)/register/page.tsx**
- `company` alanı artık zorunlu: `req: false` → `req: true`
- Label güncellendi: "Şirket (opsiyonel)" → "Şirket"

### Backend

**schemas/auth.py**
- `RegisterRequest.company`: `Optional[str]` → `str = Field(..., min_length=1, max_length=200)` (zorunlu alan)

---

## v4.2.1 — Part 3: Agent Real Mode UI Fix

### Backend

**main.py**
- version string 4.1.0 → 4.2.0 (tüm log ve response string'leri)

**services/agents/provider_client.py**
- `_real_mode()` helper eklendi: `AGENTS_MODE in ("real", "live")` kontrolü
- `call_claude()`, `call_openai()`, `call_deepseek()`, `call_gemini()`:
  - Key eksikse ve real mode → `ValueError` raise (sessiz mock fallback yok)
  - API hatası ve real mode → `RuntimeError` raise (sessiz mock fallback yok)
  - Mock mode'da davranış değişmedi

**services/agent_task_engine.py**
- `_get_key` import eklendi
- `run_task()` başında real mode key kontrolü: key eksikse açık `ValueError`
- `AgentRun.provider` artık hardcoded `"mock"` yerine `agent.model_provider.value`
- Error path AgentRun da `agent.model_provider.value` kullanıyor
- `metadata_`'ya `"is_mock"` flag eklendi

**api/v1/routes/agents.py**
- `GET /agents` response'a `agents_mode` + `key_status` eklendi:
  `{"claude": bool, "openai": bool, "deepseek": bool, "gemini": bool}`

### Frontend

**lib/agents-api.ts**
- `getAgents()` dönüş tipi: `agents_mode: string` + `key_status: Record<string, boolean>` eklendi
- `runAgentTest(agentId)` eklendi: task oluştur → run → normalized sonuç döndür

**app/(app)/admin/agents/page.tsx**
- `AgentCard` props genişletildi: `agentsMode`, `keyStatus`, `onRunAgent`, `onProviderChange`, `isRunning`
- AgentCard local state: `localProvider`, `saving`, `saveErr`
- Provider dropdown (mock/claude/openai/deepseek/gemini) — PATCH /agents/{id}/provider çağırır
- Key status badge: provider mock değilse "✓ Key" veya "⚠ Key eksik"
- Mode badge: "● Real" veya "○ Mock"
- Run button: AGENTS_MODE=mock → "▶ Run Mock", AGENTS_MODE=real → "▶ Run Agent"
- Run Agent: per-ajan `runAgentTest()` çağırır, hata/başarı banner'ında gösterilir
- `AgentsCenterPage`: `agentsMode`, `keyStatus`, `runningAgentId` state eklendi
- Real mode'da key özet satırı (header altında tüm provider'lar için)
- `handleProviderChange`: optimistic update + local state sync
- `runAgent`: hata mesajını doğrudan kullanıcıya gösterir

---

## v4.2.0 — Part 2: AI Agent Operating System

### Backend

**core/config.py**
- `GEMINI_API_KEY: str = ""` eklendi
- `AGENTS_MODE` dokümantasyonu: "real" ve "live" destekleniyor

**models/agent.py**
- `ModelProvider.GEMINI = "gemini"` eklendi
- `SAEnum(ModelProvider, native_enum=False, length=20)` — migration-safe

**services/agents/provider_client.py**
- `call_gemini()` — Google Gemini v1beta REST API
- `call_with_fallback(primary, fallback, prompt)` — provider fallback mantığı
- `is_mock_mode()`: "real" ve "live" her ikisini de destekliyor
- GEMINI_API_KEY bos olduğunda mock'a düşer

**services/agents/archive_ai_agents.py** (YENİ)
- `ArchiveCategoryAgent` — bio/username'den kategori tahmini
- `ArchiveTrendAgent` — snapshot geçmişinden büyüme trend analizi
- `InfluencerClassifierAgent` — Nano/Micro/Macro/Mega tier sınıflandırma
- `ArchiveCleanerAgent` — stale/duplicate tespit, silme için approval zorunlu

**services/agents/campaign_agents.py**
- `CompetitorIntelAgent` eklendi — rakip analizi, fırsat tespiti, influencer gap

**services/agent_registry.py**
- 5 yeni ajan: archive-category, archive-trend, archive-classifier, archive-cleaner, competitor-intel
- `gemini` ALL_PROVIDERS'a eklendi

**services/agents/agent_factory.py**
- 5 yeni ajan slug mapping + PROVIDER_MAP'e Gemini ve Archive AI

**api/v1/routes/agents.py**
- `PATCH /agents/{id}/provider` — per-agent provider ve model güncelleme
- `POST /agents/copilot/campaign` — 6 ajana zincirli Campaign Copilot workflow
- `ProviderUpdateRequest`, `CopilotRequest` schema'ları

### Frontend

**lib/agents-api.ts**
- `updateAgentProvider()` — PATCH /agents/{id}/provider
- `runCampaignCopilot()` — POST /agents/copilot/campaign
- `ROLE_ICON`: archive_ai, intel, growth, discovery, campaign rolleri eklendi

**app/(app)/admin/agents/copilot/page.tsx** (YENİ)
- Campaign Copilot UI: Marka + hedef + platform + kategori + bütçe + rakip
- Workflow görsel: 5-6 adım zinciri
- Adim adim sonuçlar gösterim

**components/layout/AppShell.tsx**
- "Campaign Copilot" nav linki (⚡) eklendi

---

## v4.1.1 — Part 1: Core Platform Completion

### Backend

**schemas/auth.py**
- `RegisterRequest`'e `phone: Optional[str]` alanı eklendi (min 7, max 50 karakter)

**api/v1/routes/auth.py**
- Register: `phone=req.phone` User modeline kaydediliyor

**models/influencer_archive.py**
- `InfluencerProfile`'a `city: Mapped[Optional[str]]` alanı eklendi
- **Not:** Schema değişikliği — ilk build'de `docker compose down -v` gerekli

**api/v1/routes/archive.py**
- `_profile_dict` serializer'a `city` eklendi
- `seed_archive` fonksiyonuna `city=pd.get("city")` eklendi

**services/archive_sync.py**
- `_apply_provider_to_profile` fonksiyonuna `city` sync eklendi

### Frontend

**app/(auth)/register/page.tsx**
- Telefon (phone) alanı eklendi — form sırası: Ad, Email, Telefon, Şirket, Şifre
- `autoComplete="tel"` eklendi

**lib/api.ts**
- `authApi.register` type'a `phone?: string` eklendi

**app/(app)/search/page.tsx**
- `ContentThumb` bileşeni eklendi: `onError` handler + fallback
- `referrerPolicy` `no-referrer-when-downgrade` olarak güncellendi (CDN uyumu)
- Kırık thumbnail yerine "Görsel yok" placeholder gösteriliyor

---

## v4.0.0 — Phase 4: Production Ready SaaS

### Backend — Yeni Modeller

**models/admin_models.py** (YENİ)
- `AuditLog` — user_id, admin_id, action, resource_type, resource_id, details (JSON), ip_address
- `SupportTicket` — user_id, subject, status, priority, category, messages (JSON)
- `Package` — slug, name, price_monthly, price_annual, credits, features, stripe_price_ids
- `Payment` — user_id, stripe_payment_intent_id, amount, currency, status, plan, period

**services/audit.py** (YENİ)
- `log_action()` — async helper, tüm kritik aksiyonlarda çağrılır

### Backend — Yeni Route'lar

**api/v1/routes/billing.py** (YENİ)
- `POST /billing/checkout` — Stripe checkout session (test mode'da mock URL)
- `POST /billing/webhook` — Stripe webhook (ödeme → plan + kredi güncelle)
- `GET /billing/invoices` — Kullanıcının fatura geçmişi
- `GET /billing/subscription` — Mevcut abonelik durumu

**api/v1/routes/support.py** (YENİ)
- `GET /support/tickets` — Kullanıcının talepleri
- `POST /support/tickets` — Yeni talep
- `POST /support/tickets/{id}/reply` — Talebe yanıt

**api/v1/routes/admin.py** (TAM YENİ — 12 Modül)
- `GET /admin/stats` — MRR, ARR, Net, kullanıcı, analiz, platform
- `GET /admin/users` — Health score + churn risk dahil
- `POST /admin/users/{id}/credits` — add/subtract/set + audit log
- `POST /admin/users/{id}/plan` — Plan + kredi değiştir + audit log
- `POST /admin/users/{id}/toggle` — Aktif/pasif + audit log
- `DELETE /admin/users/{id}` — Sil + audit log
- `GET /admin/customer-intelligence` — Sağlık analizi
- `GET /admin/churn-risks` — 30 gün inaktivite, düşük kullanım
- `GET /admin/cost-center` — Platform bazlı API maliyet tahmini
- `GET /admin/health-check` — YouTube/Apify/Stripe/DB ping
- `GET /admin/queue-monitor` — Anlık analiz istatistikleri
- `GET /admin/abuse-detection` — Yüksek hacim + tekrar analiz
- `GET/PATCH/POST /admin/tickets` — Admin destek yönetimi
- `GET /admin/audit-logs` — Sistem aksiyon geçmişi
- `GET/POST/PATCH /admin/packages` — Paket CRUD

### Backend — Güncellenen Route'lar

**api/v1/routes/auth.py**
- `POST /auth/register` — Audit log eklendi
- `POST /auth/login` — Audit log + `last_login_at` güncelleme
- `POST /auth/password` — Audit log eklendi

**main.py** (v4.0.0)
- billing + support route'lar register edildi
- Package seed (free/starter/pro/business — ilk açılışta otomatik)
- `func` import düzeltildi (`__import__` kaldırıldı)

### Frontend — Yeni Sayfalar

**app/(app)/admin/page.tsx** (YENİ — 12 Modül)
Sidebar tabbed layout:
1. Dashboard — MRR/ARR/Net kâr grid + plan dağılımı
2. Müşteriler — Tablo, health/churn badge, kredi modal
3. Fatura & Stripe — Ödeme geçmişi, Stripe durum
4. Paket Yönetimi — Aktif paketler listesi
5. Müşteri Analizi — Health + kullanım özeti
6. Churn Tahmini — Risk kategorili liste
7. API Maliyeti — Platform bazlı breakdown
8. Sağlık Kontrolü — Provider status lights
9. Kuyruk Monitor — Anlık + günlük istatistik
10. Kötüye Kullanım — Yüksek hacim alertleri
11. Destek Talepleri — Ticket listesi
12. Audit Logs — Tarihli aksiyon geçmişi

**app/(app)/settings/page.tsx** (GELİŞTİRİLDİ)
- 5. sekme eklendi: Destek
- Destek talep formu (subject, category, message)
- Mevcut talepler listesi
- Billing: Plan yükseltme butonları (Stripe checkout tetikler)
- Billing: Fatura geçmişi (backendden gerçek veri)

### API Client

**frontend/lib/api.ts** (GELİŞTİRİLDİ)
- `billingApi` — checkout, invoices, subscription
- `supportApi` — tickets, create, reply
- Genişletilmiş `adminApi` — tüm 12 modül endpoint'i
- Yeni tipler: `Invoice`, `SubscriptionStatus`, `SupportTicket`, `CustomerIntelligence`,
  `ChurnRisk`, `CostCenter`, `HealthCheck`, `QueueMonitor`, `AbuseAlert`, `AdminTicket`,
  `AuditLog`, `Package` (güncellenmiş `AdminStats`, `AdminUser`)

### Yeni Dosyalar

- `backend/.env.example` — Tüm ENV değişkenleri örnek ve açıklamalı
- `FINAL_IMPLEMENTATION_REPORT.md` — Tam teknik döküman

---

## v3.0.0 — Phase 3: Ajans Seviyesi

- Campaign Planner (AI öneri + ROI tahmini)
- Compare Mode (max 4, 9 metrik)
- Alert Center
- Team Management (altyapı)
- Reports (PDF print)

## v2.1.0 — Phase 2: Discovery & Analysis Engine

- Discovery (6 Top-10 + 8 parametre filtre)
- Watchlist (Add/Remove/Check)
- Search: 5 sekme + Audience Intelligence + Similar

## v2.0.0 — Phase 1: SaaS Görünümüne Geçiş

- 7 Skor Sistemi (rule-based)
- Auth profil + şifre + API keys
- Dashboard leaderboards
- Admin panel (temel)

## v1.0.0 — Pre-Phase: Kritik Bug Düzeltmeleri

- bcrypt==4.0.1, lazy="selectin", models/__init__.py
- asyncio.to_thread, CORS, Docker build
