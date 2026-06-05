"use client";
import { useEffect, useState } from "react";
import { authApi, type User } from "@/lib/api";

type Tab = "profile" | "billing" | "security" | "apikeys" | "support";

const PLAN_INFO: Record<string, { label: string; color: string; price: string; credits: number }> = {
  free:     { label: "Ücretsiz",  color: "var(--text-3)",    price: "$0/ay",     credits: 5 },
  starter:  { label: "Starter",   color: "var(--brand-600)", price: "$29/ay",    credits: 50 },
  pro:      { label: "Pro",       color: "var(--brand-600)", price: "$79/ay",    credits: 200 },
  business: { label: "Business",  color: "var(--green)",     price: "$199/ay",   credits: 1000 },
};

const KEY_LABELS: Record<string, { label: string; placeholder: string; docs: string }> = {
  youtube_api_key: { label: "YouTube Data API v3 Key", placeholder: "AIzaSy...", docs: "https://console.cloud.google.com" },
  apify_token:     { label: "Apify Token (Instagram + TikTok)", placeholder: "apify_api_...", docs: "https://console.apify.com" },
  openai_api_key:  { label: "OpenAI API Key", placeholder: "sk-...", docs: "https://platform.openai.com" },
};

async function api(path: string, method = "GET", body?: any) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
  return res.json();
}

export default function SettingsPage() {
  const [tab,     setTab]     = useState<Tab>("profile");
  const [user,    setUser]    = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ full_name: "", company: "", phone: "", website: "" });
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState("");
  const [pwForm,  setPwForm]  = useState({ current_password: "", new_password: "", confirm: "" });
  const [pwMsg,   setPwMsg]   = useState("");
  const [keys,    setKeys]    = useState<Record<string, string>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keysMsg, setKeysMsg] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tickets,  setTickets]  = useState<any[]>([]);
  const [newTicket, setNewTicket] = useState({ subject: "", message: "", category: "technical" });
  const [ticketMsg, setTicketMsg] = useState("");

  useEffect(() => {
    authApi.me().then((u) => { setUser(u); setForm({ full_name: u.full_name || "", company: u.company || "", phone: (u as any).phone || "", website: (u as any).website || "" }); })
      .catch(() => {}).finally(() => setLoading(false));
    authApi.getApiKeys().then((r) => setKeys(r.keys)).catch(() => {});
    api("/billing/invoices").then((r) => setInvoices(r.invoices)).catch(() => {});
    api("/support/tickets").then((r) => setTickets(r.tickets)).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setSaving(true); setMsg("");
    try { const u = await authApi.updateProfile(form); setUser(u); setMsg("✓ Kaydedildi."); }
    catch (e: any) { setMsg("✕ " + e.message); }
    finally { setSaving(false); }
  };

  const changePw = async () => {
    if (pwForm.new_password !== pwForm.confirm) { setPwMsg("✕ Şifreler eşleşmiyor."); return; }
    try {
      const r = await authApi.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwMsg("✓ " + r.message); setPwForm({ current_password: "", new_password: "", confirm: "" });
    } catch (e: any) { setPwMsg("✕ " + e.message); }
  };

  const saveKeys = async () => {
    try { const r = await authApi.updateApiKeys(keyInputs); setKeys(r.keys); setKeyInputs({}); setKeysMsg("✓ Kaydedildi."); }
    catch (e: any) { setKeysMsg("✕ " + e.message); }
  };

  const submitTicket = async () => {
    if (!newTicket.subject || !newTicket.message) { setTicketMsg("✕ Konu ve mesaj zorunlu."); return; }
    try {
      await api("/support/tickets", "POST", newTicket);
      setTicketMsg("✓ Talebiniz iletildi.");
      setNewTicket({ subject: "", message: "", category: "technical" });
      const r = await api("/support/tickets"); setTickets(r.tickets);
    } catch (e: any) { setTicketMsg("✕ " + e.message); }
  };

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>;

  const planInfo = PLAN_INFO[user?.plan || "free"] || PLAN_INFO.free;
  const usedCredits = (user?.credits_total || 0) - (user?.credits_remaining || 0);
  const creditsPct = Math.min((usedCredits / Math.max(user?.credits_total || 1, 1)) * 100, 100);

  const TABS: { key: Tab; label: string }[] = [
    { key: "profile",  label: "Profil" },
    { key: "billing",  label: "Plan & Fatura" },
    { key: "security", label: "Güvenlik" },
    { key: "apikeys",  label: "API Anahtarları" },
    { key: "support",  label: "Destek" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Ayarlar</h1>
        <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Hesap ve platform ayarlarını yönet.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, maxWidth: 900, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 14, border: "none",
              background: tab === t.key ? "var(--green-bg)" : "transparent",
              color: tab === t.key ? "var(--brand-700)" : "var(--text-2)", cursor: "pointer",
            }}>{t.label}</button>
          ))}
        </div>

        <div>
          {/* Profile */}
          {tab === "profile" && (
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 18px" }}>Profil Bilgileri</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[{ k: "full_name", l: "Ad Soyad", t: "text", p: "Adınız" }, { k: "company", l: "Şirket", t: "text", p: "Şirket adı" },
                  { k: "phone", l: "Telefon", t: "tel", p: "+90 5XX" }, { k: "website", l: "Website", t: "url", p: "https://..." }].map((f) => (
                  <div key={f.k}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>{f.l}</label>
                    <input type={f.t} value={(form as any)[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                      placeholder={f.p} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>E-posta</label>
                  <input value={user?.email || ""} disabled style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, opacity: 0.55 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}>
                  <button onClick={saveProfile} disabled={saving} className="btn btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                  {msg && <span style={{ fontSize: 13, color: msg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{msg}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Billing */}
          {tab === "billing" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 16px" }}>Mevcut Plan</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: planInfo.color }}>{planInfo.label}</div>
                    <div style={{ fontSize: 13, color: "var(--text-3)" }}>{planInfo.price}</div>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>Kredi Kullanımı</span>
                    <span style={{ fontWeight: 500 }}>{usedCredits} / {user?.credits_total}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${creditsPct}%`, background: creditsPct > 80 ? "var(--red)" : "var(--brand-500)" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{user?.credits_remaining} kredi kaldı</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["starter", "pro", "business"].filter((p) => p !== user?.plan).map((p) => (
                    <button key={p} onClick={() => {
                      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
                      const token = localStorage.getItem("access_token");
                      fetch(`${apiBase}/billing/checkout`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ plan: p, period: "monthly" }) })
                        .then((r) => r.json()).then((data) => { if (data.url) window.location.href = data.url; }).catch(() => {});
                    }} className="btn btn-primary btn-sm" style={{ textTransform: "capitalize" }}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}'e Geç →
                    </button>
                  ))}
                </div>
              </div>
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 12px" }}>Fatura Geçmişi</h2>
                {invoices.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>Fatura geçmişi yok.</div>
                ) : invoices.map((inv: any) => (
                  <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                    <span>{inv.plan} · {inv.period}</span>
                    <span>${inv.amount_usd}</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{new Date(inv.created_at).toLocaleDateString("tr-TR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security */}
          {tab === "security" && (
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 18px" }}>Şifre Değiştir</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 400 }}>
                {[{ k: "current_password", l: "Mevcut Şifre" }, { k: "new_password", l: "Yeni Şifre" }, { k: "confirm", l: "Yeni Şifre Tekrar" }].map((f) => (
                  <div key={f.k}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>{f.l}</label>
                    <input type="password" value={(pwForm as any)[f.k]} onChange={(e) => setPwForm({ ...pwForm, [f.k]: e.target.value })}
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={changePw} className="btn btn-primary">Güncelle</button>
                  {pwMsg && <span style={{ fontSize: 13, color: pwMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{pwMsg}</span>}
                </div>
              </div>
            </div>
          )}

          {/* API Keys */}
          {tab === "apikeys" && (
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 8px" }}>API Anahtarları</h2>
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 20px" }}>Anahtarlar güvenli şekilde saklanır.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {Object.entries(KEY_LABELS).map(([key, info]) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>{info.label}</label>
                    {keys[key] ? <div style={{ fontSize: 11, color: "var(--green)", marginBottom: 5 }}>✓ {keys[key]}</div>
                      : <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 5 }}>Henüz kayıt yok.</div>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="password" value={keyInputs[key] || ""} onChange={(e) => setKeyInputs({ ...keyInputs, [key]: e.target.value })}
                        placeholder={info.placeholder} style={{ flex: 1, padding: "9px 14px", borderRadius: 8, fontSize: 13 }} />
                      <a href={info.docs} target="_blank" rel="noopener noreferrer"
                        style={{ padding: "9px 12px", borderRadius: 8, background: "var(--bg-subtle)", border: "1px solid var(--line)", fontSize: 12, color: "var(--text-2)", textDecoration: "none" }}>
                        ↗ Nereden?
                      </a>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  <button onClick={saveKeys} className="btn btn-primary">Anahtarları Kaydet</button>
                  {keysMsg && <span style={{ fontSize: 13, color: keysMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{keysMsg}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Support */}
          {tab === "support" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 16px" }}>Yeni Destek Talebi</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Konu</label>
                    <input value={newTicket.subject} onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                      placeholder="Sorununuzu kısaca belirtin" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Kategori</label>
                    <select value={newTicket.category} onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 13 }}>
                      <option value="billing">Fatura</option><option value="technical">Teknik</option>
                      <option value="account">Hesap</option><option value="other">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Mesaj</label>
                    <textarea value={newTicket.message} onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                      rows={4} placeholder="Sorununuzu detaylı açıklayın..."
                      style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, resize: "vertical" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={submitTicket} className="btn btn-primary">Talep Gönder</button>
                    {ticketMsg && <span style={{ fontSize: 13, color: ticketMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{ticketMsg}</span>}
                  </div>
                </div>
              </div>
              {tickets.length > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 12px" }}>Taleplerim</h2>
                  {tickets.map((t: any) => (
                    <div key={t.id} style={{ padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{t.subject}</span>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: t.status === "open" ? "var(--amber-bg)" : "var(--green-bg)", color: t.status === "open" ? "var(--amber)" : "var(--green)" }}>{t.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{t.messages_count} mesaj · {new Date(t.created_at).toLocaleDateString("tr-TR")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
