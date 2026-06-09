# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Non-Negotiable Workflow Rules

Before making any change, Claude Code must first read and understand:

* `README.md`
* `README_PROGRESS.md`
* `TODO_NEXT.md`
* Any other relevant architecture, setup, or progress documentation in the repository

Claude Code must not start editing code before understanding the current documented state of the project.

After completing any implementation, refactor, bug fix, migration, or architectural change, Claude Code must update the relevant documentation:

* Update `README.md` if setup, architecture, commands, routes, env vars, or major behavior changed
* Update `README_PROGRESS.md` with what was completed
* Update `TODO_NEXT.md` with remaining work, next steps, blockers, and follow-up tasks

Major product, architecture, billing, agent behavior, security, or business-logic decisions require explicit owner approval before implementation.

The project is fully owned by the owner. Agents and automated systems must behave as professional departments under owner control, not as independent decision-makers.

Mock/live behavior must always remain owner-controlled:

* `AGENTS_MODE=mock` must work for development and safe simulation
* `AGENTS_MODE=live` must use real providers only when configured
* No agent should silently switch between mock and live mode
* Human approval must be required for important agent actions when `AGENTS_REQUIRE_HUMAN_APPROVAL=true`

## Project Overview

Inflect is a B2B influencer intelligence platform: real-time Instagram/TikTok/YouTube analysis, 7-score AI scoring, fraud detection, brand-fit matching, campaign ROI simulation, and a multi-agent AI orchestrator. Stack: **Next.js 16 (App Router) + FastAPI 0.115 + PostgreSQL 16 + Redis**.

---

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev          # dev server on :3000
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (no test suite; use this to verify types)
```

### Backend (from `backend/`)
```bash
# With venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
uvicorn app.main:app --reload --port 8000

# Database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Docker (preferred for full-stack)
```bash
docker-compose up -d          # start all services
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose exec backend bash
make fresh                    # wipe DB and restart
make test-backend             # health check
make test-register            # test auth flow
```

### Environment setup
Copy `.env.example` → `.env` in both `backend/` and `frontend/`. Minimum required for local dev:
- Backend: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Frontend: `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`
- Set `AGENTS_MODE=mock` to skip AI provider keys for agent features

---

## Architecture

### Frontend — `frontend/`

**Route groups** (Next.js App Router):
- `app/(app)/` — All authenticated routes. `app/(app)/layout.tsx` handles auth guard (token check → redirect to `/login`) and admin guard (non-admins redirected from `/admin/*` to `/dashboard`).
- `app/(auth)/` — Login/register pages (no AppShell).
- `app/` root — Landing, pricing, blog, robots.ts, sitemap.ts (SEO).
- `app/api/` — Next.js API routes (currently: `intelligence/brand/analyze/route.ts` — proxies brand website fetching for brand-match engine).

**AppShell** lives at `components/layout/AppShell.tsx` and wraps all `(app)/` pages with sidebar/header.

**State & data fetching:** Zustand (`useAppStore`) for global state; SWR for server data; no Redux.

**Key lib files:**
- `lib/api.ts` — Central HTTP client. All API calls go through `request<T>()`. Handles 401 (auto-logout), 402 (credits), token refresh. Import typed helpers from here.
- `lib/agents-api.ts` — Agent orchestrator client (agent registry, runs, tasks, provider config).
- `lib/brand-match-engine.ts` — Pure-TS brand match scoring. Genome dimensions (10 × 10 keywords), evidence basis labels, creator scoring 0–100. Heavy file (~1500 lines); runs client-side.
- `lib/simulation-engine.ts` — Campaign ROI simulation engine. Also runs client-side.

**Styling:** Tailwind v3 (not v4). CSS custom properties `--bg`, `--text-1`, `--text-3`, `--line`, `--shadow`, `--radius` for theming. Dark mode via `data-theme` attribute on `<html>`. Lucide React for all icons. Framer Motion for animations.

### Backend — `backend/app/`

**Entry point:** `app/main.py` — registers all routers, CORS middleware, and runs DB init + agent scheduler on startup. Auto-seeds admin user and 4 pricing packages.

**Core modules:**
- `core/config.py` — Single `Settings` instance (pydantic-settings). All env vars accessed via `from app.core.config import settings`.
- `core/database.py` — Async SQLAlchemy engine (pool size 10, overflow 20). All DB code is async. Use `get_db()` as FastAPI dependency.
- `core/deps.py` — `get_current_user()` dependency (extracts + validates JWT, returns User).
- `core/security.py` — Bcrypt + JWT (access: 60 min, refresh: 30 days).

**API routes** all under `/api/v1/`:
```
auth, analyze, dashboard, admin, watchlist, discover,
campaigns, alerts, billing, support,
agents (core), agents-ext (growth agents), archive
```

**Services layer** (`services/`): business logic lives here, never directly in routes. Notable:
- `score_engine.py` — The 7-score algorithm (authenticity, fraud, momentum, brand_fit, engagement_quality, roi_potential, reputation_risk).
- `data_provider.py` — YouTube Data API v3 + Apify (Instagram/TikTok scraping).
- `ai_report.py` — AI executive summaries.
- Agent framework: `agent_registry.py`, `agent_orchestrator.py`, `agent_scheduler.py`, `agent_task_engine.py`, `agent_mock_provider.py`, `event_bus.py`.

**Agent system (Part 11):** Multi-agent orchestrator with named agents (CEO, Dev, PM, QA, Legal, Finance, Ops, Sales, Support, SEO, Ads). Controlled by `AGENTS_MODE=mock|live` and `AGENTS_REQUIRE_HUMAN_APPROVAL=true`. Mock mode returns simulated responses without API keys. Real mode routes requests to Anthropic (CEO/Dev/PM/QA/Report/Legal), OpenAI (Sales/Support/SEO/Ads/Brand Fit), or DeepSeek (Fraud/Analysis/Audience/ROI) based on agent type.

**Models** (SQLAlchemy, async): `User`, `Analysis`, `Campaign`, `WatchlistItem`, `Package`, `Payment`, `SupportTicket`, `AuditLog`, plus `Agent`-related models. All timestamps use `datetime.utcnow`.

### Data Flow for Influencer Analysis
1. Frontend `POST /api/v1/analyze` with `{username, platform, brand?}`
2. Route deducts 1 credit from user
3. `data_provider.py` fetches live profile from YouTube/Apify
4. `score_engine.py` computes 7 scores
5. `ai_report.py` generates executive summary
6. Result stored in `analyses` table, returned to frontend
7. Frontend `/search` page renders scores + report

### Admin Panel
Full super-admin at `/(app)/admin/`. Non-admin users are blocked at the layout level. 12-module admin dashboard covers: MRR/ARR/churn, user management with health score + churn risk, agent orchestrator, archive sync, billing, support tickets, audit logs, abuse detection, API cost estimation.

---

## Key Conventions

- **No test suite** — Use `npm run typecheck` (frontend) and manual curl/Makefile targets (backend) to verify correctness.
- **Async throughout** — All DB queries use `async/await` with `AsyncSession`. Never use sync SQLAlchemy calls.
- **Credits system** — Every analysis deducts 1 credit. Credit checks happen in the route before calling services.
- **Mock vs live agents** — When adding agent features, always support `AGENTS_MODE=mock` path in `agent_mock_provider.py` so development works without API keys.
- **Error messages** — Backend returns Turkish-language error messages (this is intentional for the target market).
- **Admin seeding** — `main.py` startup auto-creates the admin user and packages if they don't exist. Update seed logic there, not in migrations.
- **Frontend API calls** — Always go through `lib/api.ts` `request<T>()`. Do not use raw `fetch()` in pages/components.
