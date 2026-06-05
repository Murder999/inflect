"use client";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  getAgents, triggerMockAgentRun, runAgentTest, updateAgentProvider,
  type Agent, type AgentOverview,
  STATUS_COLOR, STATUS_LABEL, RISK_COLOR, RISK_LABEL, ROLE_ICON, relativeTime,
} from "@/lib/agents-api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TASK_TYPES = [
  { value: "orchestrated_review",   label: "🔄 Tam Orchestrated Review",     desc: "Tüm ajanlar: Ops + PM + QA + Legal + Finance" },
  { value: "system_health_review",  label: "❤ Sistem Sağlık Kontrolü",      desc: "Ops + QA + Legal" },
  { value: "product_roadmap_review",label: "◈ Ürün Roadmap İncelemesi",     desc: "PM + Legal" },
  { value: "code_change_plan",      label: "⌥ Kod Değişiklik Planı",        desc: "Dev + QA + Legal" },
  { value: "pricing_review",        label: "₿ Fiyatlandırma Analizi",       desc: "Finance" },
  { value: "compliance_review",     label: "⚖ Uyumluluk Kontrolü",          desc: "Legal" },
  { value: "qa_checklist",          label: "✓ QA Test Listesi",             desc: "QA" },
];

const PROVIDERS = ["mock", "claude", "openai", "deepseek", "gemini"] as const;

async function apiPost(path: string, body: any) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${res.status}`); }
  return res.json();
}

function Dot({ color }: { color: string }) {
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] || "var(--text-3)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: `${color}18`, color }}>
      <Dot color={color} />{STATUS_LABEL[status] || status}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const color = RISK_COLOR[level] || "var(--text-3)";
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: `${color}14`, color, border: `1px solid ${color}30` }}>
      {RISK_LABEL[level] || level} risk
    </span>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-display)", color: accent || "var(--text-1)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── AgentCard ────────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  agentsMode,
  keyStatus,
  onRunMock,
  onRunAgent,
  onProviderChange,
  isRunning,
}: {
  agent: Agent;
  agentsMode: string;
  keyStatus: Record<string, boolean>;
  onRunMock?: () => void;
  onRunAgent?: (id: number) => void;
  onProviderChange?: (id: number, provider: string) => void;
  isRunning?: boolean;
}) {
  const [localProvider, setLocalProvider] = useState(agent.model_provider);
  const [saving,        setSaving]        = useState(false);
  const [saveErr,       setSaveErr]       = useState<string | null>(null);

  const roleIcon    = ROLE_ICON[agent.role] || "◎";
  const statusColor = STATUS_COLOR[agent.status] || "var(--text-3)";
  const isRealMode  = agentsMode === "real" || agentsMode === "live";
  const needsKey    = localProvider !== "mock";
  const keyOk       = !needsKey || keyStatus[localProvider] === true;

  async function handleProviderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setLocalProvider(next as any);
    setSaving(true);
    setSaveErr(null);
    try {
      await updateAgentProvider(agent.id, next);
      onProviderChange?.(agent.id, next);
    } catch (err: any) {
      setSaveErr(err.message || "Provider güncellenemedi.");
      setLocalProvider(agent.model_provider); // geri al
    } finally {
      setSaving(false);
    }
  }

  const runBtnDisabled = !agent.is_enabled || !!isRunning;
  const runBtnBg = runBtnDisabled
    ? "var(--bg-muted)"
    : isRealMode && !keyOk
      ? "#D97706"
      : "var(--brand-600)";

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, borderTop: `2px solid ${statusColor}` }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `${statusColor}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: statusColor }}>
          {roleIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{agent.role} · {agent.model_name}</div>
        </div>
      </div>

      {/* ── Badges ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <StatusBadge status={agent.status} />
        <RiskBadge level={agent.risk_level} />
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
          background: isRealMode ? "var(--green-bg)" : "var(--bg-subtle)",
          color: isRealMode ? "var(--green)" : "var(--text-3)",
          border: `1px solid ${isRealMode ? "rgba(34,197,94,0.3)" : "var(--line)"}`,
        }}>
          {isRealMode ? "● Real" : "○ Mock"}
        </span>
      </div>

      {/* ── Provider dropdown ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-3)", marginBottom: 5 }}>Provider</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select
            value={localProvider}
            onChange={handleProviderChange}
            disabled={saving || !agent.is_enabled}
            style={{
              flex: 1, padding: "5px 8px", borderRadius: 6, fontSize: 12,
              border: "1px solid var(--line)", background: "var(--bg-subtle)",
              color: "var(--text-1)", cursor: agent.is_enabled ? "pointer" : "not-allowed",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {/* Key status */}
          {needsKey && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, flexShrink: 0,
              background: keyOk ? "var(--green-bg)" : "#FEF3C7",
              color: keyOk ? "var(--green)" : "#92400E",
              border: `1px solid ${keyOk ? "rgba(34,197,94,0.3)" : "#FDE68A"}`,
            }}>
              {keyOk ? "✓ Key" : "⚠ Key eksik"}
            </span>
          )}
          {saving && <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>…</span>}
        </div>
        {saveErr && (
          <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{saveErr}</div>
        )}
      </div>

      {/* ── Description ── */}
      {agent.description && (
        <p style={{
          fontSize: 12, color: "var(--text-3)", lineHeight: 1.6, margin: 0,
          display: "-webkit-box", WebkitLineClamp: 2, overflow: "hidden",
          ...({WebkitBoxOrient: "vertical"} as CSSProperties),
        }}>
          {agent.description}
        </p>
      )}

      <div style={{ fontSize: 11, color: "var(--text-3)" }}>Son çalışma: {relativeTime(agent.last_run_at)}</div>

      {/* ── Action buttons ── */}
      <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <button
          onClick={isRealMode ? () => onRunAgent?.(agent.id) : onRunMock}
          disabled={runBtnDisabled}
          title={isRealMode && !keyOk ? `${localProvider} için API key eksik` : undefined}
          style={{
            flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 500,
            cursor: runBtnDisabled ? "not-allowed" : "pointer",
            background: runBtnBg, color: runBtnDisabled ? "var(--text-3)" : "#fff",
            border: "none", opacity: runBtnDisabled ? 0.5 : 1,
          }}
        >
          {isRunning ? "…" : isRealMode ? "▶ Run Agent" : "▶ Run Mock"}
        </button>
        <Link href="/admin/agents/runs"
          style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 500, textDecoration: "none", background: "var(--bg-subtle)", color: "var(--text-2)", border: "1px solid var(--line)" }}>
          ≡ Logs
        </Link>
      </div>
    </div>
  );
}

// ─── Orchestrate Modal ────────────────────────────────────────────────────────

function OrchestrateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (res: any) => void }) {
  const [title,       setTitle]       = useState("AI Agent sisteminin production risklerini incele");
  const [description, setDescription] = useState("");
  const [taskType,    setTaskType]    = useState("orchestrated_review");
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState("");

  async function submit() {
    if (!title.trim()) { setErr("Görev başlığı zorunlu."); return; }
    setLoading(true); setErr("");
    try {
      const res = await apiPost("/agents/orchestrate", { title, description: description || undefined, task_type: taskType, priority: "normal" });
      onSuccess(res);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selected = TASK_TYPES.find((t) => t.value === taskType);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div className="card-raised" style={{ width: "100%", maxWidth: 520, padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px" }}>Orchestrated Review Başlat</h2>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>CEO Agent tüm ilgili ajanları koordine eder.</p>
          </div>
          <button onClick={onClose} style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", lineHeight: 1 }}>✕</button>
        </div>

        {err && (
          <div style={{ padding: "10px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 7, fontSize: 12, marginBottom: 14 }}>{err}</div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 8 }}>Review Türü</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {TASK_TYPES.map((t) => (
              <label key={t.value} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                borderRadius: 8, cursor: "pointer",
                background: taskType === t.value ? "var(--green-bg)" : "var(--bg-subtle)",
                border: `1px solid ${taskType === t.value ? "rgba(34,197,94,0.3)" : "var(--line)"}`,
              }}>
                <input type="radio" name="taskType" value={t.value} checked={taskType === t.value}
                  onChange={() => setTaskType(t.value)} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: taskType === t.value ? 600 : 400, color: "var(--text-1)" }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Görev Başlığı</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}
            placeholder="örn: Production risklerini incele" />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Açıklama (opsiyonel)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, resize: "vertical" }}
            placeholder="Ek bağlam veya odak alanı belirtin…" />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-secondary btn-sm">İptal</button>
          <button onClick={submit} disabled={loading} className="btn btn-primary"
            style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? "CEO çalışıyor…" : "⬡ Orchestrate Başlat"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentsCenterPage() {
  const [agents,          setAgents]          = useState<Agent[]>([]);
  const [overview,        setOverview]        = useState<AgentOverview | null>(null);
  const [agentsMode,      setAgentsMode]      = useState<string>("mock");
  const [keyStatus,       setKeyStatus]       = useState<Record<string, boolean>>({});
  const [loading,         setLoading]         = useState(true);
  const [err,             setErr]             = useState("");
  const [mockLoading,     setMockLoading]     = useState(false);
  const [runningAgentId,  setRunningAgentId]  = useState<number | null>(null);
  const [banner,          setBanner]          = useState<{ type: "success" | "error"; text: string; convId?: number } | null>(null);
  const [showOrch,        setShowOrch]        = useState(false);
  const [filter,          setFilter]          = useState<"all" | "active" | "idle" | "error">("all");

  async function load() {
    setLoading(true); setErr("");
    try {
      const res = await getAgents();
      setAgents(res.agents);
      setOverview(res.overview);
      setAgentsMode(res.agents_mode ?? "mock");
      setKeyStatus(res.key_status ?? {});
    } catch (e: any) {
      setErr(e.message || "Yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function runMock() {
    setMockLoading(true); setBanner(null);
    try {
      const res = await triggerMockAgentRun();
      setBanner({ type: "success", text: `✓ Mock run tamamlandı. Konuşma #${res.conversation_id}, ${res.message_count} mesaj.`, convId: res.conversation_id });
      await load();
    } catch (e: any) {
      setBanner({ type: "error", text: `✕ ${e.message}` });
    } finally {
      setMockLoading(false);
    }
  }

  async function runAgent(agentId: number) {
    setRunningAgentId(agentId); setBanner(null);
    try {
      const res = await runAgentTest(agentId);
      if (res.success) {
        setBanner({
          type: "success",
          text: `✓ Agent #${agentId} tamamlandı. Run #${res.run?.id} · provider: ${res.run?.provider ?? "—"}.`,
        });
      } else {
        const msg = res.error_message || res.task?.status || "Bilinmeyen hata.";
        setBanner({ type: "error", text: `✕ Agent #${agentId} başarısız: ${msg}` });
      }
      await load();
    } catch (e: any) {
      setBanner({ type: "error", text: `✕ ${e.message}` });
    } finally {
      setRunningAgentId(null);
    }
  }

  function handleOrchestrateSuccess(res: any) {
    setShowOrch(false);
    setBanner({
      type: "success",
      text: `✓ Orchestrated Review tamamlandı. ${res.sub_task_count} alt görev, risk: ${res.risk_level?.toUpperCase()}. ${res.approval_id ? `Approval #${res.approval_id} oluşturuldu.` : "Onay gerekmedi."}`,
      convId: res.conversation_id,
    });
    load();
  }

  function handleProviderChange(agentId: number, provider: string) {
    setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, model_provider: provider as any } : a));
  }

  const filtered = agents.filter((a) => filter === "all" || a.status === filter);
  const statusGroups = {
    active:           agents.filter((a) => a.status === "active").length,
    idle:             agents.filter((a) => a.status === "idle").length,
    error:            agents.filter((a) => a.status === "error").length,
    waiting_approval: agents.filter((a) => a.status === "waiting_approval").length,
    disabled:         agents.filter((a) => !a.is_enabled).length,
  };
  const isRealMode = agentsMode === "real" || agentsMode === "live";

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>Admin</span>
            <span style={{ color: "var(--text-3)" }}>→</span>
            <span style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 500 }}>AI Agents Center</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>AI Agents Center</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
              {overview?.agents_total || 0} ajan
            </p>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99,
              background: isRealMode ? "var(--green-bg)" : "var(--bg-subtle)",
              color: isRealMode ? "var(--green)" : "var(--text-3)",
              border: `1px solid ${isRealMode ? "rgba(34,197,94,0.3)" : "var(--line)"}`,
            }}>
              MODE: {agentsMode.toUpperCase()}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowOrch(true)} className="btn btn-primary">
            ⬡ Orchestrated Review
          </button>
          <button onClick={runMock} disabled={mockLoading} className="btn btn-secondary" style={{ opacity: mockLoading ? 0.7 : 1 }}>
            {mockLoading ? "…" : "▶ Mock Run"}
          </button>
          <button onClick={load} className="btn btn-secondary btn-sm" disabled={loading}>{loading ? "…" : "↺"}</button>
        </div>
      </div>

      {/* ── Key status özeti ── */}
      {isRealMode && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {(["claude", "openai", "deepseek", "gemini"] as const).map((p) => (
            <span key={p} style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
              background: keyStatus[p] ? "var(--green-bg)" : "#FEF3C7",
              color: keyStatus[p] ? "var(--green)" : "#92400E",
              border: `1px solid ${keyStatus[p] ? "rgba(34,197,94,0.3)" : "#FDE68A"}`,
            }}>
              {p}: {keyStatus[p] ? "✓ Key mevcut" : "⚠ Key eksik"}
            </span>
          ))}
        </div>
      )}

      {/* ── Banner ── */}
      {banner && (
        <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13,
          background: banner.type === "success" ? "var(--green-bg)" : "var(--red-bg)",
          border: `1px solid ${banner.type === "success" ? "rgba(34,197,94,0.2)" : "#FECACA"}`,
          color: banner.type === "success" ? "var(--green)" : "var(--red)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>{banner.text}</span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {banner.type === "success" && banner.convId && (
              <Link href="/admin/agents/conversations" style={{ fontSize: 12, color: "var(--brand-600)", textDecoration: "none", fontWeight: 500 }}>
                Konuşmayı gör →
              </Link>
            )}
            {banner.type === "success" && (
              <Link href="/admin/agents/approvals" style={{ fontSize: 12, color: "var(--amber)", textDecoration: "none", fontWeight: 500 }}>
                Onaylar →
              </Link>
            )}
            <button onClick={() => setBanner(null)} style={{ fontSize: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>✕</button>
          </div>
        </div>
      )}

      {err && (
        <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13, background: "var(--red-bg)", color: "var(--red)" }}>{err}</div>
      )}

      {/* ── Overview metrikler ── */}
      {overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          <MetricCard label="Toplam Ajan"   value={overview.agents_total}      sub={`${overview.agents_enabled} etkin`} />
          <MetricCard label="Aktif"         value={statusGroups.active}         accent="var(--green)" />
          <MetricCard label="Beklemede"     value={statusGroups.idle} />
          <MetricCard label="Hata"          value={statusGroups.error}           accent="var(--red)" />
          <MetricCard label="Onay Bekliyor" value={overview.pending_approvals}   accent="var(--amber)" />
          <MetricCard label="Toplam Görev"  value={overview.tasks_total} />
          <MetricCard label="Toplam Run"    value={overview.runs_total} />
          <MetricCard label="Konuşmalar"    value={overview.conversations_total} />
        </div>
      )}

      {/* ── Filtre ── */}
      <div style={{ display: "flex", gap: 4, background: "var(--bg-subtle)", padding: 4, borderRadius: 10, marginBottom: 20, width: "fit-content" }}>
        {(["all", "active", "idle", "error"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: filter === f ? 500 : 400, cursor: "pointer",
            background: filter === f ? "var(--bg-elevated)" : "transparent",
            color: filter === f ? "var(--text-1)" : "var(--text-3)",
            border: filter === f ? "1px solid var(--line)" : "none",
          }}>
            {f === "all" ? `Tümü (${agents.length})` : f === "active" ? `Aktif (${statusGroups.active})` : f === "idle" ? `Bekliyor (${statusGroups.idle})` : `Hata (${statusGroups.error})`}
          </button>
        ))}
      </div>

      {/* ── Agent kartları ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-3)" }}>Ajanlar yükleniyor…</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⬡</div>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 8px" }}>Ajan bulunamadı</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Sistemi yeniden başlatarak agent seed'lerini kontrol edin.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              agentsMode={agentsMode}
              keyStatus={keyStatus}
              onRunMock={runMock}
              onRunAgent={runAgent}
              onProviderChange={handleProviderChange}
              isRunning={runningAgentId === agent.id}
            />
          ))}
        </div>
      )}

      {/* ── Orchestrate Modal ── */}
      {showOrch && (
        <OrchestrateModal
          onClose={() => setShowOrch(false)}
          onSuccess={handleOrchestrateSuccess}
        />
      )}
    </div>
  );
}
