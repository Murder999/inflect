"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Zap, AlertCircle, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Loader2, X,
  BarChart2, Filter, RefreshCw, CheckCircle,
  ShieldAlert, Layers, Activity, Play,
} from "lucide-react";
import { authApi, request } from "@/lib/api";
import { providerHealthApi, type ProviderHealthResult } from "@/lib/risk-radar-api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FeatureConfig {
  id:                   number;
  slug:                 string;
  name:                 string;
  description:          string | null;
  category:             string;
  is_enabled:           boolean;
  is_billable:          boolean;
  free_for_admin:       boolean;
  charge_on_failure:    boolean;
  credit_cost:          number;
  limited_credit_cost:  number;
  standard_credit_cost: number;
  full_credit_cost:     number;
  allowed_plans:        string[] | null;
  updated_at:           string;
}

interface UsageLog {
  id:              number;
  user_id:         number;
  feature_slug:    string;
  credits_charged: number;
  report_mode:     string | null;
  status:          string;
  failure_code:    string | null;
  created_at:      string;
  metadata:        Record<string, unknown> | null;
}

interface SummaryRow {
  feature_slug:  string;
  total_uses:    number;
  success:       number;
  failed:        number;
  total_credits: number;
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function fetchFeatures(): Promise<{ ok: boolean; features: FeatureConfig[] }> {
  return request("/admin/intelligence/features");
}

async function patchFeature(slug: string, patch: Partial<FeatureConfig>): Promise<{ ok: boolean; feature: FeatureConfig }> {
  return request(`/admin/intelligence/features/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

async function fetchUsage(params: {
  feature_slug?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ ok: boolean; total: number; logs: UsageLog[] }> {
  const q = new URLSearchParams();
  if (params.feature_slug) q.set("feature_slug", params.feature_slug);
  if (params.status) q.set("status", params.status);
  if (params.limit)  q.set("limit", String(params.limit));
  if (params.offset) q.set("offset", String(params.offset));
  return request(`/admin/intelligence/usage?${q}`);
}

async function fetchSummary(): Promise<{ ok: boolean; summary: SummaryRow[] }> {
  return request("/admin/intelligence/summary");
}

// ── Sub-components ────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  risk:         "#7c3aed",
  forecast:     "#6366f1",
  competitive:  "#f59e0b",
  brand:        "#22c55e",
  campaign:     "#06b6d4",
  intelligence: "#94a3b8",
};

function CategoryBadge({ cat }: { cat: string }) {
  const c = CATEGORY_COLOR[cat] ?? "#94a3b8";
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
      background: `${c}14`, color: c, border: `1px solid ${c}22`,
      letterSpacing: "0.06em",
    }}>
      {cat.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    success:     { bg: "#22c55e14", color: "#22c55e", label: "OK" },
    failed:      { bg: "#ef444414", color: "#ef4444", label: "FAILED" },
    not_charged: { bg: "#94a3b814", color: "#94a3b8", label: "FREE" },
    blocked:     { bg: "#f59e0b14", color: "#f59e0b", label: "BLOCKED" },
  }[status] ?? { bg: "var(--line)", color: "var(--text-3)", label: status.toUpperCase() };
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
      background: cfg.bg, color: cfg.color, letterSpacing: "0.05em",
    }}>
      {cfg.label}
    </span>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  feature, onClose, onSave,
}: {
  feature: FeatureConfig;
  onClose: () => void;
  onSave: (updated: FeatureConfig) => void;
}) {
  const [form, setForm] = useState<Partial<FeatureConfig>>({
    is_enabled:           feature.is_enabled,
    is_billable:          feature.is_billable,
    free_for_admin:       feature.free_for_admin,
    charge_on_failure:    feature.charge_on_failure,
    credit_cost:          feature.credit_cost,
    limited_credit_cost:  feature.limited_credit_cost,
    standard_credit_cost: feature.standard_credit_cost,
    full_credit_cost:     feature.full_credit_cost,
    allowed_plans:        feature.allowed_plans,
    description:          feature.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      const res = await patchFeature(feature.slug, form);
      onSave(res.feature);
      onClose();
    } catch (e: any) {
      setErr(e.message ?? "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof FeatureConfig) =>
    setForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }));
  const setNum = (key: keyof FeatureConfig, val: string) =>
    setForm(f => ({ ...f, [key]: parseInt(val) || 0 }));

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--line)",
        borderRadius: 16, width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", borderBottom: "1px solid var(--line)",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-1)" }}>
              {feature.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              {feature.slug}
            </div>
          </div>
          <button onClick={onClose} aria-label="Kapat" style={{
            background: "none", border: "none", cursor: "pointer", color: "var(--text-3)",
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
          {err && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 13 }}>
              {err}
            </div>
          )}

          {/* Toggles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em" }}>KONTROLLER</div>
            {([
              ["is_enabled",        "Aktif"],
              ["is_billable",       "Ücretli"],
              ["free_for_admin",    "Admin için Ücretsiz"],
              ["charge_on_failure", "Başarısızlıkta Ücret"],
            ] as Array<[keyof FeatureConfig, string]>).map(([key, label]) => (
              <div key={key} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 8,
                background: "var(--bg-card)", border: "1px solid var(--line)",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-2)" }}>{label}</span>
                <button
                  onClick={() => toggle(key)}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
                  aria-pressed={!!form[key]}
                >
                  {form[key]
                    ? <ToggleRight size={22} style={{ color: "#22c55e" }} />
                    : <ToggleLeft  size={22} style={{ color: "var(--text-3)" }} />
                  }
                </button>
              </div>
            ))}
          </div>

          {/* Credit costs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em" }}>KREDİ MALİYETLERİ</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {([
                ["limited_credit_cost",  "Limited Mode"],
                ["standard_credit_cost", "Standard Mode"],
                ["full_credit_cost",     "Full Mode"],
                ["credit_cost",          "Varsayılan"],
              ] as Array<[keyof FeatureConfig, string]>).map(([key, label]) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 4 }}>
                    {label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form[key] as number ?? 0}
                    onChange={e => setNum(key, e.target.value)}
                    style={{
                      width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 13,
                      background: "var(--bg-card)", border: "1px solid var(--line)",
                      color: "var(--text-1)", boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Allowed plans */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 8 }}>
              İZİNLİ PLANLAR (boş = tümü)
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["free", "starter", "pro", "business"].map(plan => {
                const active = form.allowed_plans === null
                  ? false
                  : (form.allowed_plans ?? []).includes(plan);
                const isAllPlanNull = form.allowed_plans === null;
                return (
                  <button
                    key={plan}
                    onClick={() => {
                      const current = form.allowed_plans ?? ["free", "starter", "pro", "business"];
                      if (active) {
                        const next = current.filter(p => p !== plan);
                        setForm(f => ({ ...f, allowed_plans: next.length ? next : null }));
                      } else {
                        setForm(f => ({ ...f, allowed_plans: [...current, plan] }));
                      }
                    }}
                    style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      cursor: "pointer",
                      background: (isAllPlanNull || active) ? "rgba(124,58,237,0.1)" : "var(--line)",
                      color: (isAllPlanNull || active) ? "#7c3aed" : "var(--text-3)",
                      border: `1px solid ${(isAllPlanNull || active) ? "rgba(124,58,237,0.3)" : "var(--line)"}`,
                    }}
                  >
                    {plan}
                  </button>
                );
              })}
              <button
                onClick={() => setForm(f => ({ ...f, allowed_plans: null }))}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                  cursor: "pointer",
                  background: form.allowed_plans === null ? "rgba(34,197,94,0.1)" : "var(--line)",
                  color: form.allowed_plans === null ? "#22c55e" : "var(--text-3)",
                  border: "1px solid var(--line)",
                }}
              >
                Tümü
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", gap: 10, justifyContent: "flex-end",
          padding: "14px 22px", borderTop: "1px solid var(--line)",
        }}>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600,
            background: "var(--line)", color: "var(--text-2)", border: "none", cursor: "pointer",
          }}>
            Vazgeç
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600,
            background: saving ? "var(--line)" : "linear-gradient(135deg, #7c3aed, #4c1d95)",
            color: saving ? "var(--text-3)" : "#fff", border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            {saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <CheckCircle size={13} />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminIntelligencePage() {
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [features,  setFeatures]  = useState<FeatureConfig[]>([]);
  const [summary,   setSummary]   = useState<SummaryRow[]>([]);
  const [logs,      setLogs]      = useState<UsageLog[]>([]);
  const [logTotal,  setLogTotal]  = useState(0);
  const [logOffset, setLogOffset] = useState(0);
  const LOG_PAGE = 50;

  const [filterSlug,    setFilterSlug]    = useState("");
  const [filterStatus,  setFilterStatus]  = useState("");
  const [editing,       setEditing]       = useState<FeatureConfig | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [logLoading,    setLogLoading]    = useState(false);
  const [activeTab,     setActiveTab]     = useState<"features" | "usage" | "summary" | "providers" | "scan-logs">("features");
  const [toast,         setToast]         = useState<string | null>(null);
  const [providers,     setProviders]     = useState<ProviderHealthResult[]>([]);
  const [agentsMode,    setAgentsMode]    = useState<string>("");
  const [provLoading,   setProvLoading]   = useState(false);
  const [testingProv,   setTestingProv]   = useState<string | null>(null);
  const [scanLogs,      setScanLogs]      = useState<any[]>([]);
  const [scanLoading,   setScanLoading]   = useState(false);
  const [scanTriggering,setScanTriggering]= useState(false);
  const [scanMsg,       setScanMsg]       = useState("");

  useEffect(() => {
    authApi.me().then(u => setIsAdmin(!!u.is_admin)).catch(() => {});
  }, []);

  const loadFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFeatures();
      setFeatures(res.features);
    } catch (e: any) {
      setToast(`Hata: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetchSummary();
      setSummary(res.summary);
    } catch {}
  }, []);

  const loadLogs = useCallback(async (offset = 0) => {
    setLogLoading(true);
    try {
      const res = await fetchUsage({
        feature_slug: filterSlug || undefined,
        status:       filterStatus || undefined,
        limit:        LOG_PAGE,
        offset,
      });
      setLogs(res.logs);
      setLogTotal(res.total);
      setLogOffset(offset);
    } catch (e: any) {
      setToast(`Hata: ${e.message}`);
    } finally {
      setLogLoading(false);
    }
  }, [filterSlug, filterStatus]);

  const loadProviders = useCallback(async () => {
    setProvLoading(true);
    try {
      const res = await providerHealthApi.getAll();
      setProviders(res.providers);
      setAgentsMode(res.agents_mode);
    } catch (e: any) {
      setToast(`Hata: ${e.message}`);
    } finally {
      setProvLoading(false);
    }
  }, []);

  const testProvider = async (name: string) => {
    setTestingProv(name);
    try {
      const res = await providerHealthApi.test(name);
      setProviders(prev => prev.map(p =>
        p.provider === name
          ? { ...p, status: res.status, latency_ms: res.latency_ms, error: res.error, last_checked_at: res.last_checked_at }
          : p,
      ));
    } catch (e: any) {
      setToast(`Test hatası: ${e.message}`);
    } finally {
      setTestingProv(null);
    }
  };

  const loadScanLogs = useCallback(async () => {
    setScanLoading(true);
    try {
      const res = await request<{ ok: boolean; logs: any[] }>("/admin/health/scan-logs?limit=20");
      setScanLogs(res.logs);
    } catch (e: any) {
      setToast(`Hata: ${e.message}`);
    } finally {
      setScanLoading(false);
    }
  }, []);

  const triggerScan = async () => {
    setScanTriggering(true); setScanMsg("");
    try {
      const res = await request<any>("/admin/risk-scan/trigger", { method: "POST" });
      setScanMsg(`✓ Tarama başlatıldı — ${res.profiles_scanned ?? "?"} profil, ${res.alerts_created ?? "?"} yeni alert`);
      loadScanLogs();
    } catch (e: any) {
      setScanMsg(`Hata: ${e.message}`);
    } finally {
      setScanTriggering(false);
    }
  };

  useEffect(() => { loadFeatures(); loadSummary(); }, [loadFeatures, loadSummary]);
  useEffect(() => {
    if (activeTab === "usage")     loadLogs(0);
    if (activeTab === "providers") loadProviders();
    if (activeTab === "scan-logs") loadScanLogs();
  }, [activeTab, filterSlug, filterStatus, loadLogs, loadProviders, loadScanLogs]);

  const handleFeatureSaved = (updated: FeatureConfig) => {
    setFeatures(fs => fs.map(f => f.slug === updated.slug ? updated : f));
    setToast("Güncellendi.");
  };

  if (!isAdmin) {
    return (
      <main style={{ padding: "40px 28px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "48px", background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 16,
          textAlign: "center", gap: 14,
        }}>
          <ShieldAlert size={32} style={{ color: "#7c3aed", opacity: 0.4 }} />
          <p style={{ color: "var(--text-3)", fontSize: 14 }}>Bu sayfaya erişim için admin yetkisi gereklidir.</p>
        </div>
      </main>
    );
  }

  const grouped = features.reduce<Record<string, FeatureConfig[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  return (
    <main style={{ padding: "24px 28px 48px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(124,58,237,0.28)",
          }}>
            <Zap size={20} style={{ color: "#fff" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
              Intelligence Billing
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
              Feature credit costs · Plan access · Usage logs
            </p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div role="status" style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
          borderRadius: 10, marginBottom: 16,
          background: toast.startsWith("Hata") ? "rgba(239,68,68,0.07)" : "rgba(34,197,94,0.07)",
          border: `1px solid ${toast.startsWith("Hata") ? "rgba(239,68,68,0.22)" : "rgba(34,197,94,0.22)"}`,
          color: toast.startsWith("Hata") ? "#ef4444" : "#22c55e",
          fontSize: 13,
        }}>
          {toast.startsWith("Hata") ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
          <span style={{ flex: 1 }}>{toast}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {([
          ["features",  "Özellikler",       <Zap size={12} key="z" />],
          ["usage",     "Kullanım Logları",  <BarChart2 size={12} key="b" />],
          ["summary",   "Özet",             <Layers size={12} key="l" />],
          ["providers", "Provider Sağlık",  <Activity size={12} key="a" />],
          ["scan-logs", "Tarama Logları",   <ShieldAlert size={12} key="s" />],
        ] as Array<[typeof activeTab, string, React.ReactNode]>).map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              padding: "8px 18px", borderRadius: 9, fontSize: 12, fontWeight: 600,
              cursor: "pointer",
              background: activeTab === id
                ? "linear-gradient(135deg, #7c3aed, #4c1d95)"
                : "var(--bg-card)",
              color: activeTab === id ? "#fff" : "var(--text-2)",
              border: `1px solid ${activeTab === id ? "transparent" : "var(--line)"}`,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {icon} {label}
          </button>
        ))}
        <button
          onClick={() => { loadFeatures(); loadSummary(); }}
          style={{
            marginLeft: "auto", padding: "8px 14px", borderRadius: 9, fontSize: 12,
            background: "var(--bg-card)", border: "1px solid var(--line)",
            color: "var(--text-3)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <RefreshCw size={12} /> Yenile
        </button>
      </div>

      {/* Features tab */}
      {activeTab === "features" && (
        loading
          ? <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>
              <Loader2 size={24} style={{ animation: "spin 0.8s linear infinite" }} />
            </div>
          : Object.entries(grouped).map(([cat, list]) => (
              <div key={cat} style={{ marginBottom: 22 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                  fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.07em",
                }}>
                  <CategoryBadge cat={cat} />
                  <span style={{ color: CATEGORY_COLOR[cat] ?? "#94a3b8" }}>{cat.toUpperCase()}</span>
                </div>
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--line)",
                  borderRadius: 12, overflow: "hidden",
                }}>
                  {list.map((f, idx) => (
                    <div key={f.slug} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto auto auto auto",
                      gap: 12,
                      padding: "14px 18px",
                      alignItems: "center",
                      borderBottom: idx < list.length - 1 ? "1px solid var(--line)" : "none",
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)", marginBottom: 2 }}>
                          {f.name}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "monospace" }}>
                          {f.slug}
                        </div>
                      </div>
                      <div style={{ textAlign: "center", minWidth: 48 }}>
                        <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 2 }}>L/S/F</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                          {f.limited_credit_cost}/{f.standard_credit_cost}/{f.full_credit_cost}
                        </div>
                      </div>
                      <div style={{ textAlign: "center", minWidth: 56 }}>
                        <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 2 }}>PLANLAR</div>
                        <div style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 600 }}>
                          {f.allowed_plans ? f.allowed_plans.join(", ") : "Tümü"}
                        </div>
                      </div>
                      <div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                          background: f.is_enabled ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                          color: f.is_enabled ? "#22c55e" : "#ef4444",
                          border: `1px solid ${f.is_enabled ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                        }}>
                          {f.is_enabled ? "AKTİF" : "DEVRE DIŞI"}
                        </span>
                      </div>
                      <div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                          background: f.is_billable ? "rgba(124,58,237,0.1)" : "rgba(148,163,184,0.1)",
                          color: f.is_billable ? "#7c3aed" : "#94a3b8",
                          border: "1px solid transparent",
                        }}>
                          {f.is_billable ? "ÜCRETLİ" : "ÜCRETSİZ"}
                        </span>
                      </div>
                      <button
                        onClick={() => setEditing(f)}
                        style={{
                          padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: "rgba(124,58,237,0.08)", color: "#7c3aed",
                          border: "1px solid rgba(124,58,237,0.22)", cursor: "pointer",
                        }}
                      >
                        Düzenle
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
      )}

      {/* Usage tab */}
      {activeTab === "usage" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <Filter size={13} style={{ color: "var(--text-3)" }} />
            <select
              value={filterSlug}
              onChange={e => setFilterSlug(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 8, fontSize: 12,
                background: "var(--bg-card)", border: "1px solid var(--line)", color: "var(--text-2)", cursor: "pointer",
              }}
            >
              <option value="">Tüm özellikler</option>
              {features.map(f => <option key={f.slug} value={f.slug}>{f.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 8, fontSize: 12,
                background: "var(--bg-card)", border: "1px solid var(--line)", color: "var(--text-2)", cursor: "pointer",
              }}
            >
              <option value="">Tüm durumlar</option>
              <option value="success">Başarılı</option>
              <option value="failed">Başarısız</option>
              <option value="not_charged">Ücretsiz</option>
              <option value="blocked">Engellendi</option>
            </select>
            <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
              {logTotal} kayıt
            </span>
          </div>

          {logLoading
            ? <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>
                <Loader2 size={24} style={{ animation: "spin 0.8s linear infinite" }} />
              </div>
            : (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      {["ID", "Kullanıcı", "Özellik", "Kredi", "Mode", "Durum", "Hata Kodu", "Tarih"].map(h => (
                        <th key={h} style={{
                          padding: "10px 14px", fontSize: 10, fontWeight: 700,
                          color: "var(--text-3)", letterSpacing: "0.06em", textAlign: "left",
                        }}>
                          {h.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                          Kayıt bulunamadı.
                        </td>
                      </tr>
                    )}
                    {logs.map(l => (
                      <tr key={l.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-3)" }}>{l.id}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-2)" }}>{l.user_id}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-1)", fontFamily: "monospace" }}>{l.feature_slug}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: l.credits_charged > 0 ? "#7c3aed" : "var(--text-3)" }}>
                          {l.credits_charged}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 10, color: "var(--text-3)" }}>{l.report_mode ?? "—"}</td>
                        <td style={{ padding: "10px 14px" }}><StatusBadge status={l.status} /></td>
                        <td style={{ padding: "10px 14px", fontSize: 10, color: "#f59e0b" }}>{l.failure_code ?? "—"}</td>
                        <td style={{ padding: "10px 14px", fontSize: 10, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                          {new Date(l.created_at).toLocaleString("tr-TR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {logTotal > LOG_PAGE && (
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                    <button
                      disabled={logOffset === 0}
                      onClick={() => loadLogs(logOffset - LOG_PAGE)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 12,
                        background: "var(--bg-card)", border: "1px solid var(--line)",
                        color: "var(--text-2)", cursor: logOffset === 0 ? "not-allowed" : "pointer",
                      }}
                    >
                      ← Önceki
                    </button>
                    <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "center" }}>
                      {logOffset + 1}–{Math.min(logOffset + LOG_PAGE, logTotal)} / {logTotal}
                    </span>
                    <button
                      disabled={logOffset + LOG_PAGE >= logTotal}
                      onClick={() => loadLogs(logOffset + LOG_PAGE)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 12,
                        background: "var(--bg-card)", border: "1px solid var(--line)",
                        color: "var(--text-2)", cursor: logOffset + LOG_PAGE >= logTotal ? "not-allowed" : "pointer",
                      }}
                    >
                      Sonraki →
                    </button>
                  </div>
                )}
              </div>
            )
          }
        </div>
      )}

      {/* Summary tab */}
      {activeTab === "summary" && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Özellik", "Toplam", "Başarılı", "Başarısız", "Toplam Kredi"].map(h => (
                  <th key={h} style={{
                    padding: "10px 16px", fontSize: 10, fontWeight: 700,
                    color: "var(--text-3)", letterSpacing: "0.06em", textAlign: "left",
                  }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                  Henüz kullanım verisi yok.
                </td></tr>
              )}
              {summary.map(s => (
                <tr key={s.feature_slug} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-1)", fontFamily: "monospace" }}>
                    {s.feature_slug}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>
                    {s.total_uses.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#22c55e" }}>
                    {s.success.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: s.failed > 0 ? "#ef4444" : "var(--text-3)" }}>
                    {s.failed.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>
                    {s.total_credits.toLocaleString()} kr
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Provider Health tab */}
      {activeTab === "providers" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              background: agentsMode === "mock"
                ? "rgba(167,139,250,0.12)" : "rgba(34,197,94,0.1)",
              color: agentsMode === "mock" ? "#a78bfa" : "#22c55e",
              border: `1px solid ${agentsMode === "mock" ? "rgba(167,139,250,0.3)" : "rgba(34,197,94,0.25)"}`,
            }}>
              AGENTS_MODE={agentsMode || "…"}
            </span>
            <button
              onClick={loadProviders}
              disabled={provLoading}
              style={{
                marginLeft: "auto", padding: "7px 14px", borderRadius: 9, fontSize: 12,
                background: "var(--bg-card)", border: "1px solid var(--line)",
                color: "var(--text-3)", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {provLoading
                ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
                : <RefreshCw size={12} />
              }
              Yenile
            </button>
          </div>

          {provLoading && providers.length === 0
            ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)" }}>
                <Loader2 size={24} style={{ animation: "spin 0.8s linear infinite" }} />
              </div>
            ) : (
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--line)",
                borderRadius: 12, overflow: "hidden",
              }}>
                {providers.map((p, idx) => {
                  const statusColor = p.status === "healthy"
                    ? "#22c55e"
                    : p.status === "degraded"
                      ? "#f59e0b"
                      : p.status === "not_configured"
                        ? "#94a3b8"
                        : "#ef4444";

                  return (
                    <div key={p.provider} style={{
                      display: "grid", gridTemplateColumns: "1fr auto auto auto",
                      gap: 16, padding: "14px 18px", alignItems: "center",
                      borderBottom: idx < providers.length - 1 ? "1px solid var(--line)" : "none",
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)", marginBottom: 2 }}>
                          {p.provider}
                        </div>
                        {p.error && (
                          <div style={{ fontSize: 10, color: "#ef4444", marginTop: 2 }}>{p.error}</div>
                        )}
                        {p.notes.length > 0 && (
                          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                            {p.notes.join(" · ")}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 3 }}>LATENCY</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                          {p.latency_ms != null ? `${p.latency_ms}ms` : "—"}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                        background: `${statusColor}12`, color: statusColor,
                        border: `1px solid ${statusColor}28`, whiteSpace: "nowrap",
                      }}>
                        {p.status.replace("_", " ").toUpperCase()}
                      </span>
                      <button
                        onClick={() => testProvider(p.provider)}
                        disabled={testingProv === p.provider}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: "rgba(99,102,241,0.08)", color: "#6366f1",
                          border: "1px solid rgba(99,102,241,0.22)",
                          cursor: testingProv === p.provider ? "not-allowed" : "pointer",
                        }}
                      >
                        {testingProv === p.provider
                          ? <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} />
                          : <Play size={11} />
                        }
                        Test
                      </button>
                    </div>
                  );
                })}
                {providers.length === 0 && (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                    Provider verisi yükleniyor…
                  </div>
                )}
              </div>
            )
          }
        </div>
      )}

      {/* Scan Logs tab */}
      {activeTab === "scan-logs" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <button
              onClick={triggerScan}
              disabled={scanTriggering}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: scanTriggering ? "not-allowed" : "pointer",
                background: scanTriggering ? "var(--bg-card)" : "linear-gradient(135deg,#7c3aed,#4c1d95)",
                color: scanTriggering ? "var(--text-3)" : "#fff",
                border: scanTriggering ? "1px solid var(--line)" : "none",
                opacity: scanTriggering ? 0.7 : 1,
              }}
            >
              <Play size={14} />
              {scanTriggering ? "Taranıyor…" : "Manuel Tarama Başlat"}
            </button>
            <button
              onClick={loadScanLogs}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "var(--bg-card)", border: "1px solid var(--line)", color: "var(--text-2)" }}
            >
              <RefreshCw size={12} /> Yenile
            </button>
            {scanMsg && (
              <span style={{ fontSize: 12, color: scanMsg.startsWith("Hata") ? "#ef4444" : "#22c55e", fontWeight: 500 }}>
                {scanMsg}
              </span>
            )}
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
            {scanLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor…</div>
            ) : scanLogs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                Henüz tarama log kaydı yok. "Manuel Tarama Başlat" butonunu kullanın.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                    {["Başlangıç", "Kaynak", "Taranan", "Başarılı", "Hatalı", "Yeni Alert", "Güncelleme", "Süre", "Durum"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scanLogs.map((log: any) => {
                    const duration = log.completed_at
                      ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                      : null;
                    return (
                      <tr key={log.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                          {new Date(log.started_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "var(--bg-subtle)", border: "1px solid var(--line)" }}>
                            {log.trigger_source === "scheduled_scan" ? "Otomatik" : "Manuel"}
                          </span>
                        </td>
                        <td style={{ padding: "9px 12px", fontWeight: 600 }}>{log.profiles_scanned}</td>
                        <td style={{ padding: "9px 12px", color: "#22c55e" }}>{log.profiles_succeeded}</td>
                        <td style={{ padding: "9px 12px", color: log.profiles_failed > 0 ? "#ef4444" : "var(--text-3)" }}>{log.profiles_failed}</td>
                        <td style={{ padding: "9px 12px", color: log.alerts_created > 0 ? "#7c3aed" : "var(--text-3)", fontWeight: log.alerts_created > 0 ? 600 : 400 }}>{log.alerts_created}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-3)" }}>{log.alerts_updated}</td>
                        <td style={{ padding: "9px 12px", color: "var(--text-3)" }}>{duration != null ? `${duration}s` : "…"}</td>
                        <td style={{ padding: "9px 12px" }}>
                          {log.error_message
                            ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>HATA</span>
                            : log.completed_at
                            ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>TAMAM</span>
                            : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>DEVAM</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <EditModal
          feature={editing}
          onClose={() => setEditing(null)}
          onSave={handleFeatureSaved}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
