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

## Mimari

```
inflect/
├── backend/          # FastAPI + SQLAlchemy + PostgreSQL
│   ├── app/
│   │   ├── api/      # REST endpoints
│   │   ├── core/     # Config, DB, Security
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   └── services/ # Business logic
│   └── requirements.txt
├── frontend/         # Next.js 15 + TypeScript + Tailwind
│   ├── app/          # App Router pages
│   ├── components/   # UI components
│   └── lib/          # API client, utils
└── docker-compose.yml
```

## SEO

- Next.js Metadata API (title, description, keywords)
- OpenGraph + Twitter Card
- JSON-LD structured data (WebSite, SoftwareApplication, Organization, ItemList)
- sitemap.xml + robots.txt programmatic generation
- Canonical URLs + hreflang (tr-TR / en-US)
- Security headers

## Planlama

| Plan | Fiyat | Kredi |
|------|-------|-------|
| Ücretsiz | $0 | 5 analiz |
| Starter | $29/ay | 50 analiz |
| Pro | $79/ay | 200 analiz |
| Business | $199/ay | 1000 analiz |

## Lisans

MIT
