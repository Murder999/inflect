# TODO_NEXT — Part 5+ (Post Part 4)

Part 4 Kritik Security Fix tamamlandı. Aşağıdakiler sıradaki geliştirmeler.

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
