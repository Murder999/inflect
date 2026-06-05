# Inflect — Geliştirme Komutları
# Kullanım: make <komut>

.PHONY: up down restart logs status test-backend clean rebuild

# ── Başlatma ──────────────────────────────────────────────────────────────────

# Normal başlatma (ilk kez veya kod değişikliği yoksa)
up:
	docker compose up --build -d
	@echo ""
	@echo "✓ Başlatıldı. Loglar için: make logs"
	@echo "  Frontend : http://localhost:3000"
	@echo "  Backend  : http://localhost:8000"
	@echo "  API Docs : http://localhost:8000/docs"

# Veritabanı temizleyerek başlat (yeni tablolar eklendiyse zorunlu)
fresh:
	docker compose down -v
	docker compose up --build -d
	@echo "✓ Temiz kurulum başlatıldı (DB sıfırlandı)."

# Sadece derleme — başlatma
build:
	docker compose build

# ── Durdurma ──────────────────────────────────────────────────────────────────

# Durdur (veri korunur)
down:
	docker compose down

# Durdur + veritabanı sil
clean:
	docker compose down -v
	@echo "✓ Konteynerler ve veritabanı silindi."

# ── Yeniden Başlatma ──────────────────────────────────────────────────────────

restart:
	docker compose restart backend frontend

restart-backend:
	docker compose restart backend

# ── Loglar ───────────────────────────────────────────────────────────────────

# Tüm loglar
logs:
	docker compose logs -f

# Sadece backend logları
logs-backend:
	docker compose logs -f backend

# Sadece frontend logları
logs-frontend:
	docker compose logs -f frontend

# ── Durum ─────────────────────────────────────────────────────────────────────

status:
	@echo "=== Konteyner Durumu ==="
	@docker compose ps
	@echo ""
	@echo "=== Backend Health ==="
	@curl -sf http://localhost:8000/api/v1/health 2>/dev/null && echo "✓ Backend ÇALIŞIYOR" || echo "✕ Backend ÇALIŞMIYOR"

# ── Backend Testi ─────────────────────────────────────────────────────────────

# Backend'in çalıştığını test et
test-backend:
	@echo "Backend health check..."
	@curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool 2>/dev/null || \
		(echo "✕ Backend çalışmıyor! Loglar için: make logs-backend" && exit 1)
	@echo "✓ Backend sağlıklı"

# Register testi
test-register:
	@curl -s -X POST http://localhost:8000/api/v1/auth/register \
		-H "Content-Type: application/json" \
		-d '{"email":"test@test.com","password":"Test1234!","full_name":"Test"}' \
		| python3 -m json.tool

# Login testi (önce register yapılmış olmalı)
test-login:
	@curl -s -X POST http://localhost:8000/api/v1/auth/login \
		-H "Content-Type: application/json" \
		-d '{"email":"test@test.com","password":"Test1234!"}' \
		| python3 -m json.tool

# ── Shell ─────────────────────────────────────────────────────────────────────

# Backend container'ına bağlan
shell-backend:
	docker compose exec backend bash

# Postgres'e bağlan
shell-db:
	docker compose exec postgres psql -U inflect -d inflect_db
