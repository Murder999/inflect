"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authApi, request as apiFetch } from "@/lib/api";
import {
  ShieldAlert, CheckCircle, X, Eye, RefreshCw, Play,
  AlertTriangle, ChevronDown, ChevronUp, Filter,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type AlertStatus = "open" | "acknowledged" | "dismissed" | "resolved";
type RiskLevel   = "low" | "medium" | "high" | "critical";
type AlertSource = "scheduled_scan" | "manual_scan" | "campaign_monitor";

interface RiskAlert {
  id:              number;
  profile_id:      number;
  alert_type:      string;
  severity:        RiskLevel;
  status:          AlertStatus;
  source:          AlertSource | null;
  platform:        string | null;
  message:         string;
  explanation:     string | null;
  previous_score:  number | null;
  current_score:   number | null;
  delta:           number | null;
  details:         Record<string, unknown> | null;
  evidence:        string[];
  acknowledged_by: number | null;
  acknowledged_at: string | null;
  resolved_at:     string | null;
  created_at:      string;
  updated_at:      string | null;
}

interface ScanLog {
  id:                 number;
  started_at:         string;
  completed_at:       string | null;
  trigger_source:     string;
  profiles_scanned:   number;
  profiles_succeeded: number;
  profiles_failed:    number;
  alerts_created:     number;
  alerts_updated:     number;
  error_message:      string | null;
}

interface MigrationHealth {
  ok:                  boolean;
  current_revision:    string | null;
  expected_head:       string;
  is_up_to_date:       boolean;
  missing_tables:      string[];
  missing_indexes:     [string, string][];
  schema_ready:        boolean;
  existing_table_count:number;
  checked_at:          string;
  action_required:     boolean;
}

// ── Badges ────────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<RiskLevel, string> = {
  low: "#22c55e", medium: "#f59e0b", high: "#ef4444", critical: "#7c3aed",
};
const SEV_LABEL: Record<RiskLevel, string> = {
  low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik",
};
const STATUS_COLOR: Record<AlertStatus, string> = {
  open: "#f59e0b", acknowledged: "#6366f1", dismissed: "#94a3b8", resolved: "#22c55e",
};
const STATUS_LABEL: Record<AlertStatus, string> = {
  open: "Açık", acknowledged: "İncelendi", dismissed: "Reddedildi", resolved: "Çözümlendi",
};
const SOURCE_LABEL: Record<string, string> = {
  scheduled_scan:   "Otomatik Tarama",
  manual_scan:      "Manuel Tarama",
  campaign_monitor: "Kampanya İzleme",
};

function SeverityBadge({ v }: { v: RiskLevel }) {
  const c = SEV_COLOR[v] ?? "#94a3b8";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${c}14`, color: c, border: `1px solid ${c}22`, letterSpacing: "0.04em" }}>
      {SEV_LABEL[v] ?? v}
    </span>
  );
}

function StatusBadge({ v }: { v: AlertStatus }) {
  const c = STATUS_COLOR[v] ?? "#94a3b8";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${c}14`, color: c, border: `1px solid ${c}22` }}>
      {STATUS_LABEL[v] ?? v}
    </span>
  );
}

// ── Alert Row ─────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onAction,
}: {
  alert: RiskAlert;
  onAction: (id: number, action: "acknowledge" | "dismiss" | "resolve") => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <td style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>#{alert.id}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>Profile {alert.profile_id}</div>
        </td>
        <td style={{ padding: "10px 14px" }}>
          <SeverityBadge v={alert.severity} />
        </td>
        <td style={{ padding: "10px 14px" }}>
          <StatusBadge v={alert.status} />
        </td>
        <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-2)", maxWidth: 260 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {alert.message}
          </div>
          {alert.alert_type && (
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{alert.alert_type}</div>
          )}
        </td>
        <td style={{ padding: "10px 14px" }}>
          {alert.platform && (
            <span style={{ fontSize: 11, color: "var(--text-3)", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: 99 }}>
              {alert.platform}
            </span>
          )}
        </td>
        <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-3)" }}>
          {alert.source ? (SOURCE_LABEL[alert.source] ?? alert.source) : "—"}
        </td>
        <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-3)" }}>
          {alert.current_score != null ? (
            <div>
              <span style={{ fontWeight: 600, color: SEV_COLOR[alert.severity] }}>{alert.current_score.toFixed(0)}</span>
              {alert.delta != null && (
                <span style={{ color: alert.delta > 0 ? "#ef4444" : "#22c55e", marginLeft: 4 }}>
                  {alert.delta > 0 ? "+" : ""}{alert.delta.toFixed(0)}
                </span>
              )}
            </div>
          ) : "—"}
        </td>
        <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-3)" }}>
          {new Date(alert.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
        </td>
        <td style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
            {alert.status === "open" && (
              <button
                onClick={() => onAction(alert.id, "acknowledge")}
                title="İncele"
                style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "#6366f114", color: "#6366f1", border: "1px solid #6366f130" }}
              >
                <Eye size={12} />
              </button>
            )}
            {(alert.status === "open" || alert.status === "acknowledged") && (
              <button
                onClick={() => onAction(alert.id, "dismiss")}
                title="Reddet"
                style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "#94a3b814", color: "#94a3b8", border: "1px solid #94a3b830" }}
              >
                <X size={12} />
              </button>
            )}
            {alert.status !== "resolved" && alert.status !== "dismissed" && (
              <button
                onClick={() => onAction(alert.id, "resolve")}
                title="Çözümlendi"
                style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "#22c55e14", color: "#22c55e", border: "1px solid #22c55e30" }}
              >
                <CheckCircle size={12} />
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "var(--bg-subtle)", color: "var(--text-3)", border: "1px solid var(--line)" }}
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
          <td colSpan={9} style={{ padding: "14px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {alert.explanation && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Açıklama</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>{alert.explanation}</div>
                </div>
              )}
              {alert.evidence && alert.evidence.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Kanıtlar</div>
                  <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "var(--text-2)" }}>
                    {alert.evidence.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {alert.acknowledged_at && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>İnceleme Zamanı</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>{new Date(alert.acknowledged_at).toLocaleString("tr-TR")}</div>
                </div>
              )}
              {alert.resolved_at && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Çözüm Zamanı</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)" }}>{new Date(alert.resolved_at).toLocaleString("tr-TR")}</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PageTab = "alerts" | "scan-logs" | "migration";

export default function AdminRiskAlertsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<PageTab>("alerts");

  // Alerts state
  const [alerts,       setAlerts]       = useState<RiskAlert[]>([]);
  const [alertTotal,   setAlertTotal]   = useState(0);
  const [alertLoading, setAlertLoading] = useState(true);
  const [alertErr,     setAlertErr]     = useState("");
  const [filterStatus,   setFilterStatus]   = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [filterPlatform, setFilterPlatform] = useState<string>("");
  const [alertOffset,    setAlertOffset]    = useState(0);
  const LIMIT = 25;

  // Scan logs state
  const [scanLogs,    setScanLogs]    = useState<ScanLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsErr,     setLogsErr]     = useState("");
  const [triggering,  setTriggering]  = useState(false);
  const [triggerMsg,  setTriggerMsg]  = useState("");

  // Migration health state
  const [migHealth,   setMigHealth]   = useState<MigrationHealth | null>(null);
  const [migLoading,  setMigLoading]  = useState(false);
  const [migErr,      setMigErr]      = useState("");

  // Admin guard
  useEffect(() => {
    authApi.me().then((u) => {
      if (!u.is_admin) router.replace("/dashboard");
    }).catch(() => router.replace("/login"));
  }, [router]);

  // ── Load alerts ─────────────────────────────────────────────────────────────

  const loadAlerts = useCallback(async () => {
    setAlertLoading(true); setAlertErr("");
    try {
      const q = new URLSearchParams();
      if (filterStatus)   q.set("status",   filterStatus);
      if (filterSeverity) q.set("severity", filterSeverity);
      if (filterPlatform) q.set("platform", filterPlatform);
      q.set("limit",  String(LIMIT));
      q.set("offset", String(alertOffset));
      const res = await apiFetch<{ ok: boolean; total: number; alerts: RiskAlert[] }>(
        `/admin/risk-alerts?${q}`
      );
      setAlerts(res.alerts);
      setAlertTotal(res.total);
    } catch (e: any) {
      setAlertErr(e.message ?? "Alertler yüklenemedi");
    } finally {
      setAlertLoading(false);
    }
  }, [filterStatus, filterSeverity, filterPlatform, alertOffset]);

  useEffect(() => { if (tab === "alerts") loadAlerts(); }, [tab, loadAlerts]);

  // ── Alert actions ────────────────────────────────────────────────────────────

  const handleAction = async (id: number, action: "acknowledge" | "dismiss" | "resolve") => {
    try {
      await apiFetch(`/admin/risk-alerts/${id}/${action}`, { method: "POST" });
      loadAlerts();
    } catch (e: any) {
      alert(e.message ?? "İşlem başarısız");
    }
  };

  // ── Load scan logs ───────────────────────────────────────────────────────────

  const loadScanLogs = useCallback(async () => {
    setLogsLoading(true); setLogsErr("");
    try {
      const res = await apiFetch<{ ok: boolean; logs: ScanLog[] }>("/admin/health/scan-logs?limit=20");
      setScanLogs(res.logs);
    } catch (e: any) {
      setLogsErr(e.message ?? "Loglar yüklenemedi");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === "scan-logs") loadScanLogs(); }, [tab, loadScanLogs]);

  const triggerScan = async () => {
    setTriggering(true); setTriggerMsg("");
    try {
      const res = await apiFetch<any>("/admin/risk-scan/trigger", { method: "POST" });
      setTriggerMsg(`✓ Tarama başlatıldı — ${res.profiles_scanned ?? "?"} profil, ${res.alerts_created ?? "?"} yeni alert`);
      loadScanLogs();
    } catch (e: any) {
      setTriggerMsg(`Hata: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  };

  // ── Load migration health ────────────────────────────────────────────────────

  const loadMigration = useCallback(async () => {
    setMigLoading(true); setMigErr("");
    try {
      const res = await apiFetch<MigrationHealth>("/admin/health/migrations");
      setMigHealth(res);
    } catch (e: any) {
      setMigErr(e.message ?? "Migration durumu yüklenemedi");
    } finally {
      setMigLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === "migration") loadMigration(); }, [tab, loadMigration]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const TABS: { key: PageTab; label: string }[] = [
    { key: "alerts",    label: "Risk Alertleri" },
    { key: "scan-logs", label: "Tarama Logları" },
    { key: "migration", label: "Şema Sağlığı" },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <ShieldAlert size={22} color="#7c3aed" />
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.03em" }}>
              Risk Alert Yönetimi
            </h1>
          </div>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
            Influencer risk alertlerini görüntüle, onayla veya çözümle
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 18px", fontSize: 13, border: "none", cursor: "pointer",
              background: "transparent", fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? "var(--text-1)" : "var(--text-3)",
              borderBottom: tab === t.key ? "2px solid var(--brand-600)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ALERTS TAB ── */}
      {tab === "alerts" && (
        <div>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-3)" }}>
              <Filter size={13} /> Filtre:
            </div>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setAlertOffset(0); }}
              style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12, border: "1px solid var(--line)", background: "var(--bg-subtle)", color: "var(--text-1)" }}
            >
              <option value="">Tüm Durumlar</option>
              <option value="open">Açık</option>
              <option value="acknowledged">İncelendi</option>
              <option value="dismissed">Reddedildi</option>
              <option value="resolved">Çözümlendi</option>
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => { setFilterSeverity(e.target.value); setAlertOffset(0); }}
              style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12, border: "1px solid var(--line)", background: "var(--bg-subtle)", color: "var(--text-1)" }}
            >
              <option value="">Tüm Seviyeler</option>
              <option value="critical">Kritik</option>
              <option value="high">Yüksek</option>
              <option value="medium">Orta</option>
              <option value="low">Düşük</option>
            </select>
            <select
              value={filterPlatform}
              onChange={(e) => { setFilterPlatform(e.target.value); setAlertOffset(0); }}
              style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12, border: "1px solid var(--line)", background: "var(--bg-subtle)", color: "var(--text-1)" }}
            >
              <option value="">Tüm Platformlar</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>
            <button
              onClick={loadAlerts}
              style={{ padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)", display: "flex", alignItems: "center", gap: 5 }}
            >
              <RefreshCw size={12} /> Yenile
            </button>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>
              {alertTotal} alert
            </span>
          </div>

          {alertErr && (
            <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {alertErr}
            </div>
          )}

          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                    {["ID", "Seviye", "Durum", "Mesaj", "Platform", "Kaynak", "Skor", "Tarih", "İşlem"].map((h) => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertLoading ? (
                    <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor…</td></tr>
                  ) : alerts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                        {filterStatus || filterSeverity || filterPlatform
                          ? "Filtreyle eşleşen alert yok."
                          : "Henüz açık risk alert yok."}
                      </td>
                    </tr>
                  ) : (
                    alerts.map((a) => (
                      <AlertRow key={a.id} alert={a} onAction={handleAction} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {alertTotal > LIMIT && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
              <button
                disabled={alertOffset === 0}
                onClick={() => setAlertOffset((o) => Math.max(0, o - LIMIT))}
                style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, cursor: alertOffset === 0 ? "not-allowed" : "pointer", opacity: alertOffset === 0 ? 0.4 : 1, background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)" }}
              >
                ← Önceki
              </button>
              <span style={{ fontSize: 12, color: "var(--text-3)", padding: "6px 10px" }}>
                {alertOffset + 1}–{Math.min(alertOffset + LIMIT, alertTotal)} / {alertTotal}
              </span>
              <button
                disabled={alertOffset + LIMIT >= alertTotal}
                onClick={() => setAlertOffset((o) => o + LIMIT)}
                style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, cursor: alertOffset + LIMIT >= alertTotal ? "not-allowed" : "pointer", opacity: alertOffset + LIMIT >= alertTotal ? 0.4 : 1, background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)" }}
              >
                Sonraki →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SCAN LOGS TAB ── */}
      {tab === "scan-logs" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <button
              onClick={triggerScan}
              disabled={triggering}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: triggering ? "not-allowed" : "pointer",
                background: triggering ? "var(--bg-subtle)" : "var(--brand-600)",
                color: triggering ? "var(--text-3)" : "#fff",
                border: triggering ? "1px solid var(--line)" : "none",
                opacity: triggering ? 0.7 : 1,
              }}
            >
              <Play size={14} />
              {triggering ? "Taranıyor…" : "Manuel Tarama Başlat"}
            </button>
            <button
              onClick={loadScanLogs}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)" }}
            >
              <RefreshCw size={12} /> Yenile
            </button>
            {triggerMsg && (
              <span style={{ fontSize: 12, color: triggerMsg.startsWith("Hata") ? "var(--red)" : "var(--green)", fontWeight: 500 }}>
                {triggerMsg}
              </span>
            )}
          </div>

          {logsErr && (
            <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {logsErr}
            </div>
          )}

          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 500 }}>
              Son Tarama Logları
            </div>
            {logsLoading ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor…</div>
            ) : scanLogs.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>
                Henüz tarama log kaydı yok. Manuel tarama başlatın veya zamanlı tarama için 24 saat bekleyin.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                      {["Başlangıç", "Kaynak", "Taranan", "Başarılı", "Hatalı", "Yeni Alert", "Güncelleme", "Süre", "Durum"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scanLogs.map((log) => {
                      const duration = log.completed_at
                        ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                        : null;
                      return (
                        <tr key={log.id} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                            {new Date(log.started_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                          </td>
                          <td style={{ padding: "9px 12px" }}>
                            <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 99, background: "var(--bg-subtle)", border: "1px solid var(--line)" }}>
                              {SOURCE_LABEL[log.trigger_source] ?? log.trigger_source}
                            </span>
                          </td>
                          <td style={{ padding: "9px 12px", fontWeight: 600 }}>{log.profiles_scanned}</td>
                          <td style={{ padding: "9px 12px", color: "var(--green)" }}>{log.profiles_succeeded}</td>
                          <td style={{ padding: "9px 12px", color: log.profiles_failed > 0 ? "var(--red)" : "var(--text-3)" }}>{log.profiles_failed}</td>
                          <td style={{ padding: "9px 12px", color: log.alerts_created > 0 ? "#7c3aed" : "var(--text-3)", fontWeight: log.alerts_created > 0 ? 600 : 400 }}>{log.alerts_created}</td>
                          <td style={{ padding: "9px 12px", color: "var(--text-3)" }}>{log.alerts_updated}</td>
                          <td style={{ padding: "9px 12px", color: "var(--text-3)" }}>
                            {duration != null ? `${duration}s` : "…"}
                          </td>
                          <td style={{ padding: "9px 12px" }}>
                            {log.error_message ? (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "var(--red-bg)", color: "var(--red)" }}>HATA</span>
                            ) : log.completed_at ? (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "var(--green-bg)", color: "var(--green)" }}>TAMAM</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "var(--amber-bg)", color: "var(--amber)" }}>DEVAM</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MIGRATION TAB ── */}
      {tab === "migration" && (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <button
              onClick={loadMigration}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)" }}
            >
              <RefreshCw size={12} /> Kontrol Et
            </button>
          </div>

          {migErr && (
            <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
              {migErr}
            </div>
          )}

          {migLoading && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>Kontrol ediliyor…</div>
          )}

          {migHealth && !migLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Status Banner */}
              <div style={{
                padding: "16px 20px", borderRadius: 12, border: "1px solid var(--line)",
                background: migHealth.schema_ready ? "var(--green-bg)" : "var(--red-bg)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                {migHealth.schema_ready
                  ? <CheckCircle size={20} color="var(--green)" />
                  : <AlertTriangle size={20} color="var(--red)" />
                }
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: migHealth.schema_ready ? "var(--green)" : "var(--red)" }}>
                    {migHealth.schema_ready ? "Şema hazır" : "Şema sorunu var"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                    {migHealth.action_required
                      ? "⚠ Aksiyon gerekli — aşağıdaki komutları çalıştırın"
                      : "Her şey güncel ve eksiksiz"}
                  </div>
                </div>
              </div>

              {/* Revision info */}
              <div className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 14 }}>Alembic Durumu</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { l: "Mevcut Revision", v: migHealth.current_revision ?? "Yok", c: migHealth.is_up_to_date ? "var(--green)" : "var(--red)" },
                    { l: "Beklenen Head",   v: migHealth.expected_head, c: "var(--text-1)" },
                    { l: "Tablo Sayısı",    v: String(migHealth.existing_table_count), c: "var(--text-1)" },
                  ].map(({ l, v, c }) => (
                    <div key={l} style={{ padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c, fontFamily: "var(--font-mono)" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Issues */}
              {(migHealth.missing_tables.length > 0 || migHealth.missing_indexes.length > 0) && (
                <div className="card" style={{ padding: 18, borderColor: "var(--red)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--red)", marginBottom: 12 }}>Eksikler</div>
                  {migHealth.missing_tables.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 6 }}>EKSİK TABLOLAR</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {migHealth.missing_tables.map((t) => (
                          <code key={t} style={{ fontSize: 11, padding: "3px 8px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 5 }}>{t}</code>
                        ))}
                      </div>
                    </div>
                  )}
                  {migHealth.missing_indexes.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 6 }}>EKSİK İNDEXLER</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {migHealth.missing_indexes.map(([table, idx]) => (
                          <code key={idx} style={{ fontSize: 11, padding: "3px 8px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 5 }}>
                            {table}.{idx}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Commands */}
              {migHealth.action_required && (
                <div className="card" style={{ padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 10 }}>Çalıştırılacak Komutlar</div>
                  {migHealth.current_revision === null ? (
                    <pre style={{ fontSize: 12, background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: 8, margin: 0, overflow: "auto" }}>
                      {`cd backend\nalembic upgrade head`}
                    </pre>
                  ) : (
                    <pre style={{ fontSize: 12, background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: 8, margin: 0, overflow: "auto" }}>
                      {`cd backend\nalembic stamp ${migHealth.current_revision}\nalembic upgrade head`}
                    </pre>
                  )}
                </div>
              )}

              <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "right" }}>
                Son kontrol: {new Date(migHealth.checked_at).toLocaleString("tr-TR")}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
