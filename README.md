# Inflect — Influencer Intelligence Platform

**Gerçek verilerle influencer analizi.** Instagram, TikTok, YouTube.

## Hızlı Başlangıç

```bash
# 1. Repoyu klonla
git clone https://github.com/your-org/inflect.git && cd inflect

# 2. Backend env
cp backend/.env.example backend/.env
# → .env dosyasını düzenle (API anahtarları ekle)

# 3. Frontend env
cp frontend/.env.example frontend/.env.local

# 4. Docker ile başlat
docker-compose up -d

# → Backend:  http://localhost:8000
# → Frontend: http://localhost:3000
# → API docs: http://localhost:8000/docs
```

## Geliştirme (Docker olmadan)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Gerekli API Anahtarları

| Anahtar | Platform | Nereden Alınır |
|---------|----------|----------------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 | [Google Cloud Console](https://console.cloud.google.com) |
| `APIFY_TOKEN` | Instagram + TikTok | [Apify Console](https://console.apify.com) |
| `STRIPE_SECRET_KEY` | Ödemeler | [Stripe Dashboard](https://dashboard.stripe.com) |

## Veritabanı Migrasyonu (Alembic)

Part 17'de Alembic tam olarak kuruldu. Migration zinciri: `0001 → 0002 → 0003 → 0004 → 0005 → 0006`. Aşağıdaki komutları `backend/` dizininden çalıştır.

**Önemli:** Revision ID'leri 32 karakter sınırı içinde olmalıdır (PostgreSQL `alembic_version.version_num` kısıtı).
Mevcut revision ID'ler: `0003_part18_plans`, `0004_part19_campaign_sim`, `0005_part20_campaign_meta`, `0006_part22_brand_ai`

### Yeni kurulum (boş DB)

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
alembic upgrade head        # Tüm migration'ları uygula (0001→0005)
```

### Mevcut DB (create_all ile oluşturulmuş)

```bash
cd backend
alembic stamp 0001_initial_full_schema   # Mevcut şemayı baseline olarak işaretle
alembic upgrade head                     # Part 17-20 değişikliklerini uygula
```

### Migration durumu kontrol

```bash
alembic current       # Mevcut revision
alembic history       # Tüm migration geçmişi

# Veya API üzerinden (admin gerekli):
GET /api/v1/admin/health/migrations
```

### Backend test suite

```bash
# Geliştirme bağımlılıklarını kur (production image dışında):
pip install -r requirements-dev.txt

# Testleri çalıştır:
python -m pytest tests/ -v

# Veya Docker içinde:
docker compose exec backend bash -c "pip install -r requirements-dev.txt && python -m pytest tests/ -v"
```

### Yeni migration oluştur

```bash
alembic revision --autogenerate -m "açıklama"
alembic upgrade head
```

**Uyarı:** Yeni revision ID'ler 32 karakteri AŞMAMALIDIR. Alembic varsayılan olarak uzun UUID üretir — kısa ID için `--rev-id` flag'i kullan:
```bash
alembic revision --autogenerate -m "açıklama" --rev-id "0006_part21_kısa_isim"
```

---

## Mimari

```
inflect/
├── backend/
│   ├── alembic/              # Migration dosyaları (Part 17'den itibaren)
│   │   └── versions/
│   │       ├── 0001_initial_full_schema.py
│   │       ├── 0002_part17_risk_alert_extended.py
│   │       ├── 0003_part18_agency_enterprise_plans.py  (revision: 0003_part18_plans)
│   │       ├── 0004_part19_campaign_simulation_result.py  (revision: 0004_part19_campaign_sim)
│   │       ├── 0005_part20_campaign_report_metadata.py  (revision: 0005_part20_campaign_meta)
│   │       └── 0006_part22_brand_ai.py                 (revision: 0006_part22_brand_ai)
│   ├── alembic.ini
│   ├── app/
│   │   ├── api/      # REST endpoints
│   │   ├── core/     # Config, DB, Security
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   └── services/ # Business logic
│   │       └── campaign_discovery_service.py  # DataCompleteness gate + bütçe optimizer (Part 20)
│   ├── tests/        # pytest test suite
│   └── requirements.txt
├── frontend/         # Next.js 16 + TypeScript + Tailwind
│   ├── app/
│   │   └── (app)/campaigns/
│   │       ├── simulate/     # ROI simülasyon sayfası
│   │       └── [id]/         # Kampanya detay (entitlement-safe, Part 19+)
│   ├── components/
│   │   └── premium/          # PlanBadge, UpgradeModal, FeatureGate, PremiumLockedCard
│   └── lib/                  # API client, simulation-engine, brand-match-engine
└── docker-compose.yml
```

## Backend Testleri

```bash
cd backend
python -m pytest tests/ -v

# Belirli test dosyaları
python -m pytest tests/test_risk_alert_service.py -v        # Part 17: Risk alert lifecycle
python -m pytest tests/test_migration_health.py -v          # Part 17: Migration health endpoint
python -m pytest tests/test_risk_scan_scheduler.py -v       # Part 17: Scan scheduler
python -m pytest tests/test_campaign_intelligence.py -v     # Part 20: DataCompleteness + entitlement redaction
python -m pytest tests/test_brand_analysis.py -v           # Part 22: Brand domain resolver, fetcher, redaction
```

## AI Brand Match™ Backend (Part 22)

### Endpoint
`POST /api/v1/intelligence/brand-match/analyze`

Accepts `{ "input": "karaca", "target_market": "Turkey" }`.

### Domain Resolver
- Full URL (https://...) → normalized immediately
- Domain with TLD (karaca.com.tr) → validated immediately
- Bare brand name (karaca) → probes .com/.com.tr/.net/.io/.co/.org concurrently (2s timeout each)
- Returns `resolver_status: "resolved" | "domain_unresolved"` with candidates

### Evidence Rules
- `fetch_status !== "success"` → `verified_report: false`
- `evidence_quality === "none"` → `verified_report: false`
- Taxonomy fallback / known brand profile NOT used — only real HTTP evidence
- Brand DNA scoring still runs client-side in `brand-match-engine.ts` using verified backend evidence

### Plan Redaction (locked_sections)
| Plan | Locked |
|------|--------|
| Free | creator_matches, portfolio, insights, export |
| Starter | portfolio, export |
| Pro | export |
| Agency/Enterprise | — |

### Environment Variables (optional)
```
BRAND_ANALYSIS_PROVIDER=claude|openai|deepseek   # AI enrichment (Next.js layer)
BRAND_ANALYSIS_API_KEY=...                         # AI provider API key
BRAND_ANALYSIS_MODEL=...                           # Model name override
```

## SEO

- Next.js Metadata API (title, description, keywords)
- OpenGraph + Twitter Card
- JSON-LD structured data (WebSite, SoftwareApplication, Organization, ItemList)
- sitemap.xml + robots.txt programmatic generation
- Canonical URLs + hreflang (tr-TR / en-US)
- Security headers

## Entitlement-Safe Campaign Reports (Part 20)

Campaign raporları plana göre sunucu tarafında redact edilir:

| Plan | `simulation_result` | `recommended_influencers` | `locked_sections` |
|------|--------------------|--------------------------|--------------------|
| Free | `null` | `[]` | `simulation_result`, `recommended_influencers`, `roi_estimates` |
| Starter | Preview (creator listesi yok) | İlk 3 | `full_report`, `white_label_export` |
| Pro | Tam | Tam | `white_label_export` |
| Agency / Enterprise / Admin | Tam | Tam | `[]` |

DataCompleteness eşikleri (creator portföy seçimi):
- **< 60%** → excluded (portföye alınmaz, `qualityScore = null`)
- **60–75%** → low_confidence (bütçe maks. %15 ile sınırlı)
- **≥ 75%** → normal (standart bütçe ağırlığı)

## Planlama

| Plan | Fiyat | Kredi |
|------|-------|-------|
| Ücretsiz | $0 | 5 analiz |
| Starter | $29/ay | 50 analiz |
| Pro | $79/ay | 200 analiz |
| Agency | $199/ay | 1000 analiz |
| Enterprise | Özel | Sınırsız |

## Lisans

MIT
