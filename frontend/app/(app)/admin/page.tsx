"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function apiCall(path: string) {
  const token = localStorage.getItem("access_token");
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function apiPost(path: string, body: any, method = "POST") {
  const token = localStorage.getItem("access_token");
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${r.status}`); }
  return r.json();
}

// ─── Badges ─────────────────────────────────────────────────────────────────
function HealthBadge({ score }: { score: number }) {
  const c = score >= 70 ? "var(--green)" : score >= 40 ? "var(--amber)" : "var(--red)";
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: `${c}18`, color: c }}>{score}</span>;
}
function ChurnBadge({ risk }: { risk: string }) {
  const m: Record<string, [string, string]> = {
    low: ["var(--green)", "Düşük"], medium: ["var(--amber)", "Orta"],
    high: ["var(--red)", "Yüksek"], critical: ["var(--red)", "Kritik"],
  };
  const [c, l] = m[risk] || m.low;
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: `${c}18`, color: c }}>{l}</span>;
}
function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = { free: "var(--text-3)", starter: "#3B82F6", pro: "var(--brand-600)", business: "var(--green)" };
  const c = colors[plan] || "var(--text-3)";
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: `${c}18`, color: c }}>{plan}</span>;
}
function StatusDot({ status }: { status: string }) {
  const c = status === "healthy" ? "var(--green)" : status === "down" ? "var(--red)" : status === "warning" ? "var(--amber)" : "var(--text-3)";
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
}

// ─── Tabs ────────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "customers" | "billing" | "packages" | "intelligence"
         | "churn" | "costs" | "health" | "queue" | "abuse" | "tickets" | "logs";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard",    label: "Dashboard",        icon: "⬡" },
  { key: "customers",    label: "Müşteriler",       icon: "◎" },
  { key: "billing",      label: "Fatura & Stripe",  icon: "◇" },
  { key: "packages",     label: "Paket Yönetimi",   icon: "□" },
  { key: "intelligence", label: "Müşteri Analizi",  icon: "△" },
  { key: "churn",        label: "Churn Tahmini",    icon: "↓" },
  { key: "costs",        label: "API Maliyeti",     icon: "₿" },
  { key: "health",       label: "Provider Sağlık",  icon: "♡" },
  { key: "queue",        label: "Kuyruk Monitor",   icon: "◑" },
  { key: "abuse",        label: "Kötüye Kullanım",  icon: "!" },
  { key: "tickets",      label: "Destek",           icon: "✉" },
  { key: "logs",         label: "Audit Logs",       icon: "≡" },
];

// ─── Main ────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [tab,     setTab]     = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [data,    setData]    = useState<any>(null);
  const [err,     setErr]     = useState("");

  // Customer search
  const [search,     setSearch]     = useState("");
  const [filterPlan, setFilterPlan] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Credit modal
  const [creditModal,  setCreditModal]  = useState<{ userId: number; email: string } | null>(null);
  const [creditAmt,    setCreditAmt]    = useState(50);
  const [creditAction, setCreditAction] = useState<"add" | "subtract" | "set">("add");

  // Package modal
  const [pkgModal, setPkgModal] = useState<any>(null); // null=closed, {}=new, {id,...}=edit

  // Ticket panel
  const [ticketPanel, setTicketPanel] = useState<any>(null);
  const [replyText,   setReplyText]   = useState("");

  // Admin guard
  useEffect(() => {
    authApi.me().then((u) => {
      if (!u.is_admin) { router.replace("/dashboard"); }
    }).catch(() => router.replace("/login"));
  }, [router]);

  const PATH_MAP: Record<Tab, string> = {
    dashboard:    "/admin/stats",
    customers:    `/admin/users?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}${filterPlan ? `&plan=${filterPlan}` : ""}`,
    billing:      "/billing/invoices",
    packages:     "/admin/packages",
    intelligence: "/admin/customer-intelligence",
    churn:        "/admin/churn-risks",
    costs:        "/admin/cost-center",
    health:       "/admin/health-check",
    queue:        "/admin/queue-monitor",
    abuse:        "/admin/abuse-detection",
    tickets:      "/admin/tickets",
    logs:         "/admin/audit-logs?limit=100",
  };

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setData(await apiCall(PATH_MAP[tab])); }
    catch (e: any) { setErr(e.message || "Yüklenemedi"); }
    finally { setLoading(false); }
  }, [tab, search, filterPlan]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // Debounced search
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {}, 400);
  };

  // Credit update
  const applyCredits = async () => {
    if (!creditModal) return;
    try {
      await apiPost(`/admin/users/${creditModal.userId}/credits`, { credits: creditAmt, action: creditAction });
      setCreditModal(null);
      load();
    } catch (e: any) { alert(e.message); }
  };

  // Package save
  const savePkg = async () => {
    if (!pkgModal) return;
    try {
      if (pkgModal.id) {
        await apiPost(`/admin/packages/${pkgModal.id}`, pkgModal, "PATCH");
      } else {
        await apiPost("/admin/packages", pkgModal);
      }
      setPkgModal(null); load();
    } catch (e: any) { alert(e.message); }
  };

  // Ticket reply
  const sendReply = async () => {
    if (!ticketPanel || !replyText.trim()) return;
    try {
      await apiPost(`/admin/tickets/${ticketPanel.id}/reply?message=${encodeURIComponent(replyText)}`, {});
      setReplyText("");
      load();
    } catch (e: any) { alert(e.message); }
  };

  // Ticket status update
  const updateTicketStatus = async (id: number, status: string) => {
    try {
      await apiPost(`/admin/tickets/${id}?status=${status}`, {}, "PATCH");
      load();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.03em", color: "var(--text-1)" }}>
            Enterprise Control Center
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Platform yönetim ve analiz merkezi</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/admin/archive" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}>
            Archive
          </Link>
          <Link href="/admin/agents/runs" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}>
            Run Logs
          </Link>
          <button onClick={load} style={{ padding: "8px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-3)" }} disabled={loading}>
            {loading ? "..." : "↻"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20 }}>
        {/* Sidebar */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--line)", padding: 8, height: "fit-content" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setTicketPanel(null); }} style={{
              width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, fontSize: 13,
              border: "none", marginBottom: 2, cursor: "pointer", display: "flex", alignItems: "center", gap: 9,
              background: tab === t.key ? "var(--green-bg)" : "transparent",
              color: tab === t.key ? "var(--green)" : "var(--text-3)",
              fontWeight: tab === t.key ? 600 : 400,
              boxShadow: tab === t.key ? "inset 3px 0 0 var(--green)" : "none",
              transition: "all 0.12s",
            }}>
              <span style={{ fontSize: 13, opacity: 0.8 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {err && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "var(--red-bg)", borderRadius: 8 }}>Hata: {err}</div>}
          {loading && <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>}

          {/* ── DASHBOARD ── */}
          {tab === "dashboard" && !loading && data && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  { l: "MRR",            v: `$${(data.mrr || 0).toFixed(0)}`,              color: "var(--green)",    accent: true },
                  { l: "ARR",            v: `$${(data.arr || 0).toFixed(0)}`,              color: "#6366F1",         accent: true },
                  { l: "Toplam Müşteri", v: data.total_users,                               color: "var(--brand-500)", accent: false },
                  { l: "Bu Ay Yeni",     v: data.new_users_month,                           color: "var(--amber)",    accent: false },
                ].map(({ l, v, color, accent }) => (
                  <div key={l} className="card" style={{ padding: "18px 20px", borderTop: `3px solid ${color}` }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{l}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: accent ? color : "var(--text-1)", letterSpacing: "-0.04em", lineHeight: 1 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  { l: "Aktif Müşteri",  v: data.active_users },
                  { l: "Toplam Analiz",  v: data.total_analyses },
                  { l: "Bu Ay Analiz",   v: data.this_month_analyses },
                  { l: "Net Tahmin",     v: `$${(data.estimated_net || 0).toFixed(0)}`, color: (data.estimated_net || 0) >= 0 ? "var(--green)" : "var(--red)" },
                ].map(({ l, v, color }) => (
                  <div key={l} className="card" style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--text-1)", letterSpacing: "-0.03em" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="card" style={{ padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 14 }}>Plan Dağılımı</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(data.plans || {}).map(([plan, count]) => {
                      const planColors: Record<string, string> = { free: "var(--text-3)", starter: "#3B82F6", pro: "var(--brand-600)", business: "var(--green)" };
                      const c = planColors[plan] || "var(--text-3)";
                      return (
                        <div key={plan} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 14px", background: `${c}10`, borderRadius: 10, border: `1px solid ${c}30` }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: c, letterSpacing: "-0.04em" }}>{count as number}</div>
                          <div style={{ fontSize: 11, color: c, fontWeight: 600, textTransform: "capitalize" }}>{plan}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="card" style={{ padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 14 }}>API Maliyet Özeti</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { l: "API Maliyeti",    v: `$${data.estimated_api_cost}`,              c: "var(--red)" },
                      { l: "Gelir (MRR)",     v: `$${data.estimated_revenue}`,               c: "var(--green)" },
                      { l: "Net Tahmin",      v: `$${(data.estimated_net || 0).toFixed(2)}`, c: (data.estimated_net || 0) >= 0 ? "var(--green)" : "var(--red)" },
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{l}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── CUSTOMERS ── */}
          {tab === "customers" && !loading && data && (
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 500, flexShrink: 0 }}>Kullanıcılar ({data.total})</span>
                <input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Email, ad veya şirket ara…"
                  style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, flex: "1 1 180px", border: "1px solid var(--line)", background: "var(--bg-subtle)", color: "var(--text-1)" }}
                />
                <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12, border: "1px solid var(--line)", background: "var(--bg-subtle)" }}>
                  <option value="">Tüm planlar</option>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="business">Business</option>
                </select>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--bg-subtle)" }}>
                      {["Kullanıcı", "Plan", "Kredi", "Analiz", "Sağlık", "Churn", "Son Giriş", "İşlem"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.users || []).map((u: any) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "9px 12px" }}>
                          <div style={{ fontWeight: 500, color: "var(--text-1)" }}>{u.full_name || u.email}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{u.email}</div>
                          {u.company && <div style={{ fontSize: 10, color: "var(--text-3)" }}>{u.company}</div>}
                        </td>
                        <td style={{ padding: "9px 12px" }}><PlanBadge plan={u.plan} /></td>
                        <td style={{ padding: "9px 12px" }}>
                          <div>{u.credits_remaining}/{u.credits_total}</div>
                          <div style={{ height: 3, width: 48, background: "var(--bg-muted)", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${u.credits_pct}%`, background: u.credits_pct > 80 ? "var(--green)" : "var(--brand-500)", borderRadius: 2 }} />
                          </div>
                        </td>
                        <td style={{ padding: "9px 12px" }}>{u.analyses_count}</td>
                        <td style={{ padding: "9px 12px" }}><HealthBadge score={u.health_score} /></td>
                        <td style={{ padding: "9px 12px" }}><ChurnBadge risk={u.churn_risk} /></td>
                        <td style={{ padding: "9px 12px", fontSize: 11, color: "var(--text-3)" }}>
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString("tr-TR") : "—"}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <button onClick={() => { setCreditModal({ userId: u.id, email: u.email }); setCreditAmt(50); setCreditAction("add"); }}
                              style={{ padding: "3px 8px", borderRadius: 5, fontSize: 11, cursor: "pointer", background: "var(--brand-600)", color: "#fff", border: "none" }}>Kredi</button>
                            {!u.is_admin && (
                              <button onClick={async () => { await apiPost(`/admin/users/${u.id}/toggle`, {}); load(); }}
                                style={{ padding: "3px 8px", borderRadius: 5, fontSize: 11, cursor: "pointer", background: u.is_active ? "var(--amber-bg)" : "var(--green-bg)", color: u.is_active ? "var(--amber)" : "var(--green)", border: "1px solid var(--line)" }}>
                                {u.is_active ? "Askıya" : "Aktif"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── BILLING ── */}
          {tab === "billing" && !loading && data && (
            <div>
              <div className="card" style={{ padding: 18, marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 10px" }}>Stripe Durumu</h3>
                <div style={{ fontSize: 13, color: data.stripe_configured ? "var(--green)" : "var(--amber)" }}>
                  {data.stripe_configured ? "✓ Stripe yapılandırılmış" : "⚠ Stripe key girilmemiş — test mode"}
                </div>
                <p style={{ fontSize: 12, color: "var(--text-3)", margin: "8px 0 0" }}>
                  Gerçek ödemeleri almak için <code>STRIPE_SECRET_KEY</code> ve <code>STRIPE_WEBHOOK_SECRET</code> env değişkenlerini ayarlayın.
                </p>
              </div>
              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 12px" }}>Fatura Geçmişi</h3>
                {(data.invoices || []).length === 0 ? (
                  <div style={{ color: "var(--text-3)", fontSize: 13, fontStyle: "italic" }}>Henüz ödeme kaydı yok.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.invoices.map((inv: any) => (
                      <div key={inv.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, padding: "9px 10px", background: "var(--bg-subtle)", borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 500 }}>{inv.plan || "—"}</div>
                        <div>${inv.amount_usd}</div>
                        <span style={{ padding: "2px 7px", borderRadius: 99, fontSize: 11, background: "var(--green-bg)", color: "var(--green)", alignSelf: "center" }}>{inv.status}</span>
                        <div style={{ color: "var(--text-3)" }}>{new Date(inv.created_at).toLocaleDateString("tr-TR")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PACKAGES ── */}
          {tab === "packages" && !loading && data && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Paket Yönetimi ({(data.packages || []).length})</h3>
                <button onClick={() => setPkgModal({ slug: "", name: "", price_monthly: 0, price_annual: 0, credits: 10, is_active: true, sort_order: 99 })}
                  style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "var(--brand-600)", color: "#fff", border: "none" }}>
                  + Yeni Paket
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(data.packages || []).map((p: any) => (
                  <div key={p.id} style={{ display: "grid", gridTemplateColumns: "80px 140px 100px 100px 70px 1fr 80px", gap: 10, padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 8, fontSize: 13, alignItems: "center" }}>
                    <PlanBadge plan={p.slug} />
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span>${p.price_monthly_usd}/ay</span>
                    <span>${p.price_annual_usd}/yıl</span>
                    <span>{p.credits} kr.</span>
                    <span style={{ fontSize: 11, color: p.is_active ? "var(--green)" : "var(--red)" }}>{p.is_active ? "Aktif" : "Pasif"}</span>
                    <button onClick={() => setPkgModal({ ...p })}
                      style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
                      Düzenle
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── INTELLIGENCE ── */}
          {tab === "intelligence" && !loading && data && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px" }}>Müşteri Sağlık Analizi ({(data.users || []).length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(data.users || []).map((u: any) => (
                  <div key={u.user_id} style={{ display: "grid", gridTemplateColumns: "2fr 55px 80px 80px 80px 80px", gap: 10, padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: 8, fontSize: 12, alignItems: "center" }}>
                    <div><div style={{ fontWeight: 500 }}>{u.email}</div><div style={{ fontSize: 11, color: "var(--text-3)" }}>{u.plan} · {u.analyses_count} analiz</div></div>
                    <HealthBadge score={u.health_score} />
                    <ChurnBadge risk={u.churn_risk} />
                    <span>{u.credits_used}/{u.credits_total} kr.</span>
                    <span style={{ color: "var(--text-3)" }}>{u.top_platform || "—"}</span>
                    <span style={{ color: "var(--text-3)" }}>{u.days_since_login != null ? `${u.days_since_login}g` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CHURN ── */}
          {tab === "churn" && !loading && data && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>Churn Risk Tahmini</h3>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 16px" }}>{data.total} kullanıcı risk altında</p>
              {(data.at_risk || []).length === 0
                ? <div style={{ color: "var(--green)", fontSize: 13 }}>✓ Yüksek churn riski tespit edilmedi.</div>
                : (data.at_risk || []).map((u: any) => (
                  <div key={u.user_id} style={{ display: "grid", gridTemplateColumns: "2fr 80px 1fr 80px", gap: 10, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 8, fontSize: 12, marginBottom: 6 }}>
                    <div><div style={{ fontWeight: 500 }}>{u.email}</div><div style={{ fontSize: 11, color: "var(--text-3)" }}>{u.plan} · {u.analyses_count} analiz</div></div>
                    <ChurnBadge risk={u.churn_risk} />
                    <span style={{ color: "var(--text-2)" }}>{u.reason}</span>
                    <span style={{ color: "var(--text-3)" }}>{u.days_since_login != null ? `${u.days_since_login}g` : "—"}</span>
                  </div>
                ))}
            </div>
          )}

          {/* ── COSTS ── */}
          {tab === "costs" && !loading && data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                {[["Toplam Analiz", data.total_analyses], ["Toplam Maliyet", `$${data.total_cost_usd}`], ["Analiz Başı", `$${data.cost_per_analysis_usd}`], ["Kullanıcı Başı", `$${data.cost_per_user_usd}`]].map(([l, v]) => (
                  <div key={String(l)} className="card" style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 12px" }}>Platform Bazlı</h3>
                {Object.entries(data.breakdown || {}).map(([plat, info]: [string, any]) => (
                  <div key={plat} style={{ display: "grid", gridTemplateColumns: "100px 80px 80px 100px", gap: 10, padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 500 }}>{plat.charAt(0).toUpperCase() + plat.slice(1)}</span>
                    <span>{info.analyses} analiz</span>
                    <span>{info.cost_per_analysis_cents}¢</span>
                    <span style={{ fontWeight: 500 }}>${info.total_cost_usd}</span>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "var(--text-3)", margin: "10px 0 0", fontStyle: "italic" }}>{data.note}</p>
              </div>
            </div>
          )}

          {/* ── HEALTH ── */}
          {tab === "health" && !loading && data && (
            <div>
              <div className="card" style={{ padding: 20, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Provider Sağlık Durumu</h3>
                  <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: data.overall === "healthy" ? "var(--green-bg)" : data.overall === "warning" ? "var(--amber-bg)" : "var(--red-bg)", color: data.overall === "healthy" ? "var(--green)" : data.overall === "warning" ? "var(--amber)" : "var(--red)" }}>
                    {data.overall === "healthy" ? "✓ Sağlıklı" : data.overall === "warning" ? "⚠ Uyarı" : "✕ Sorunlu"}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(data.providers || {}).map(([name, info]: [string, any]) => {
                    const color = info.status === "healthy" ? "var(--green)" : info.status === "down" ? "var(--red)" : info.status === "warning" ? "var(--amber)" : "var(--text-3)";
                    return (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 8 }}>
                        <StatusDot status={info.status} />
                        <span style={{ fontWeight: 500, minWidth: 120, fontSize: 13 }}>{name.charAt(0).toUpperCase() + name.slice(1)}</span>
                        <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 100 }}>{info.status}</span>
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{info.message}</span>
                        {info.code && <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>HTTP {info.code}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Hızlı Bağlantılar</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href="/admin/agents/providers" style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}>Agent Providers</Link>
                  <Link href="/admin/agents/runs" style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)", textDecoration: "none" }}>Run Logs</Link>
                </div>
              </div>
            </div>
          )}

          {/* ── QUEUE ── */}
          {tab === "queue" && !loading && data && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
                {[["Son 1 Saat", data.recent_hour], ["Son 24 Saat", data.recent_day], ["Toplam", data.total_processed], ["Gün Ort.", data.avg_per_day]].map(([l, v]) => (
                  <div key={String(l)} className="card" style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 12px" }}>Son Analizler</h3>
                {(data.recent_analyses || []).map((a: any) => (
                  <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 120px", gap: 10, padding: "7px 10px", background: "var(--bg-subtle)", borderRadius: 6, marginBottom: 4, fontSize: 12, alignItems: "center" }}>
                    <span style={{ fontWeight: 500 }}>@{a.username}</span>
                    <span style={{ color: "var(--text-3)" }}>{a.platform}</span>
                    <span style={{ color: a.final_score >= 70 ? "var(--green)" : a.final_score >= 45 ? "var(--amber)" : "var(--red)", fontWeight: 600 }}>{a.final_score}</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{new Date(a.created_at).toLocaleString("tr-TR")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ABUSE ── */}
          {tab === "abuse" && !loading && data && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 4px" }}>Kötüye Kullanım Tespiti</h3>
              <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 16px" }}>{data.total} uyarı · son {data.scanned_period_hours} saat</p>
              {(data.alerts || []).length === 0
                ? <div style={{ color: "var(--green)", fontSize: 13 }}>✓ Şüpheli aktivite tespit edilmedi.</div>
                : (data.alerts || []).map((a: any, i: number) => (
                  <div key={i} style={{ padding: "12px 14px", background: a.severity === "warning" ? "var(--amber-bg)" : "var(--bg-subtle)", border: `1px solid ${a.severity === "warning" ? "#FDE68A" : "var(--line)"}`, borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{a.email}</div>
                    <div style={{ fontSize: 12, color: "var(--text-2)" }}>{a.message}</div>
                  </div>
                ))}
            </div>
          )}

          {/* ── TICKETS ── */}
          {tab === "tickets" && !loading && data && !ticketPanel && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px" }}>Destek Talepleri ({data.total})</h3>
              {(data.tickets || []).length === 0
                ? <div style={{ color: "var(--text-3)", fontSize: 13 }}>Henüz destek talebi yok.</div>
                : (data.tickets || []).map((t: any) => (
                  <div key={t.id} style={{ padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 8, marginBottom: 8, cursor: "pointer" }}
                    onClick={() => setTicketPanel(t)}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{t.subject}</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: t.status === "open" ? "var(--amber-bg)" : t.status === "resolved" ? "var(--green-bg)" : "var(--bg-elevated)", color: t.status === "open" ? "var(--amber)" : t.status === "resolved" ? "var(--green)" : "var(--text-3)" }}>{t.status}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateTicketStatus(t.id, t.status === "open" ? "resolved" : "open"); }}
                          style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, cursor: "pointer", background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-3)" }}>
                          {t.status === "open" ? "Kapat" : "Aç"}
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {t.user_email} · {t.messages_count} mesaj · {new Date(t.created_at).toLocaleDateString("tr-TR")}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* ── TICKET DETAIL PANEL ── */}
          {tab === "tickets" && !loading && ticketPanel && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <button onClick={() => setTicketPanel(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-3)", marginBottom: 6, padding: 0 }}>← Geri</button>
                  <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{ticketPanel.subject}</h3>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{ticketPanel.user_email} · #{ticketPanel.id}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["open", "in_progress", "resolved"].map((s) => (
                    <button key={s} onClick={() => updateTicketStatus(ticketPanel.id, s)}
                      style={{ padding: "5px 12px", borderRadius: 7, fontSize: 11, cursor: "pointer", fontWeight: ticketPanel.status === s ? 700 : 400, background: ticketPanel.status === s ? "var(--brand-600)" : "var(--bg-subtle)", color: ticketPanel.status === s ? "#fff" : "var(--text-2)", border: "1px solid var(--line)" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {(ticketPanel.messages || []).map((m: any, i: number) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: m.sender === "admin" ? "var(--green-bg)" : "var(--bg-subtle)", fontSize: 13 }}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{m.sender_name} · {new Date(m.created_at).toLocaleString("tr-TR")}</div>
                    {m.message}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Yanıt yaz…"
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 8, fontSize: 13, resize: "vertical", minHeight: 70, border: "1px solid var(--line)", background: "var(--bg-subtle)", color: "var(--text-1)" }} />
                <button onClick={sendReply} disabled={!replyText.trim()}
                  style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--brand-600)", color: "#fff", border: "none", alignSelf: "flex-end", opacity: replyText.trim() ? 1 : 0.5 }}>
                  Gönder
                </button>
              </div>
            </div>
          )}

          {/* ── LOGS ── */}
          {tab === "logs" && !loading && data && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px" }}>Audit Logs ({data.total})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {(data.logs || []).map((log: any) => (
                  <div key={log.id} style={{ display: "grid", gridTemplateColumns: "130px 2fr 1fr 80px", gap: 10, padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: 6, fontSize: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "var(--text-3)" }}>{new Date(log.created_at).toLocaleString("tr-TR")}</span>
                    <span style={{ fontWeight: 500 }}>{log.action}</span>
                    <span style={{ color: "var(--text-3)" }}>{log.user_email || log.admin_email || "—"}</span>
                    <span style={{ color: "var(--text-3)" }}>{log.resource_type || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Credit Modal ── */}
      {creditModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setCreditModal(null)}>
          <div className="card" style={{ padding: 28, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 6px" }}>Kredi Güncelle</h3>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 16px" }}>{creditModal.email}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {(["add", "subtract", "set"] as const).map((a) => (
                <button key={a} onClick={() => setCreditAction(a)} style={{ flex: 1, padding: "6px", borderRadius: 7, fontSize: 12, cursor: "pointer", background: creditAction === a ? "var(--brand-600)" : "var(--bg-subtle)", color: creditAction === a ? "#fff" : "var(--text-2)", border: "1px solid var(--line)" }}>
                  {a === "add" ? "Ekle" : a === "subtract" ? "Düş" : "Ayarla"}
                </button>
              ))}
            </div>
            <input type="number" value={creditAmt} onChange={(e) => setCreditAmt(Number(e.target.value))} min={1} max={10000} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, marginBottom: 14, border: "1px solid var(--line)", background: "var(--bg-subtle)" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setCreditModal(null)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)" }}>İptal</button>
              <button onClick={applyCredits} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--brand-600)", color: "#fff", border: "none" }}>Uygula</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Package Modal ── */}
      {pkgModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPkgModal(null)}>
          <div className="card" style={{ padding: 28, width: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 16px" }}>{pkgModal.id ? "Paket Düzenle" : "Yeni Paket"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                ["Slug", "slug", "text"], ["Ad", "name", "text"],
                ["Fiyat/Ay (kuruş)", "price_monthly", "number"],
                ["Fiyat/Yıl (kuruş)", "price_annual", "number"],
                ["Kredi", "credits", "number"], ["Sıra", "sort_order", "number"],
              ].map(([label, key, type]) => (
                <div key={String(key)}>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 3 }}>{label}</label>
                  <input type={String(type)} value={pkgModal[key as string] || ""} onChange={(e) => setPkgModal((p: any) => ({ ...p, [key as string]: type === "number" ? Number(e.target.value) : e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 7, fontSize: 12, border: "1px solid var(--line)", background: "var(--bg-subtle)" }} />
                </div>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>
              <input type="checkbox" checked={!!pkgModal.is_active} onChange={(e) => setPkgModal((p: any) => ({ ...p, is_active: e.target.checked }))} />
              Aktif
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setPkgModal(null)} style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)" }}>İptal</button>
              <button onClick={savePkg} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--brand-600)", color: "#fff", border: "none" }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
