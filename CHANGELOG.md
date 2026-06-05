# CHANGELOG — Inflect Platform

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
