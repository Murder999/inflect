"use client";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  getAgents, triggerMockAgentRun, runAgentTest, updateAgentProvider, updateAgentMode,
  getAgentApprovals, getAgentEvents,
  type Agent, type AgentMode, type AgentOverview, type AgentApproval, type AgentEvent,
  STATUS_COLOR, STATUS_LABEL, RISK_COLOR, RISK_LABEL, ROLE_ICON,
  MODE_COLOR, MODE_LABEL, MODE_DESC, DEPT_LABEL, DEPT_COLOR,
  relativeTime,
} from "@/lib/agents-api";
import {
  Bot, Play, RefreshCw, X, CheckCircle, AlertTriangle,
  Clock, Activity, MessageSquare, ListTodo, ChevronRight,
  Zap, BarChart2, Calendar, Shield, FlaskConical, Layers,
  Radio, Lock, AlertCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const TASK_TYPES = [
  { value: "orchestrated_review",    label: "Tam Orchestrated Review",    desc: "Tüm ajanlar: Ops + PM + QA + Legal + Finance" },
  { value: "system_health_review",   label: "Sistem Sağlık Kontrolü",     desc: "Ops + QA + Legal" },
  { value: "security_audit",         label: "Güvenlik Taraması",          desc: "Security + Legal + Ops" },
  { value: "technical_review",       label: "Teknik Mimari İncelemesi",   desc: "CTO + Dev + QA" },
  { value: "data_quality_audit",     label: "Veri Kalitesi Denetimi",     desc: "Data Quality + Archive Cleaner" },
  { value: "product_roadmap_review", label: "Ürün Roadmap İncelemesi",    desc: "PM + Legal" },
  { value: "code_change_plan",       label: "Kod Değişiklik Planı",       desc: "Dev + QA + Legal" },
  { value: "pricing_review",         label: "Fiyatlandırma Analizi",      desc: "Finance" },
  { value: "compliance_review",      label: "Uyumluluk Kontrolü",         desc: "Legal" },
  { value: "qa_checklist",           label: "QA Test Listesi",            desc: "QA" },
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

function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color, flexShrink: 0,
      boxShadow: pulse ? `0 0 0 2px ${color}40` : "none",
    }} />
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] || "var(--text-3)";
  const isActive = status === "active";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
      background: `${color}18`, color,
    }}>
      <Dot color={color} pulse={isActive} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const color = RISK_COLOR[level] || "var(--text-3)";
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99,
      background: `${color}14`, color, border: `1px solid ${color}30`,
    }}>
      {RISK_LABEL[level] || level} risk
    </span>
  );
}

function ModeBadge({ mode }: { mode: AgentMode }) {
  const color = MODE_COLOR[mode] || "var(--text-3)";
  const icons: Record<AgentMode, React.ReactNode> = {
    mock:     <FlaskConical size={9} />,
    active:   <Shield size={9} />,
    disabled: <X size={9} />,
  };
  return (
    <span title={MODE_DESC[mode]} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
      background: `${color}14`, color, border: `1px solid ${color}30`,
      cursor: "help",
    }}>
      {icons[mode]}
      {MODE_LABEL[mode]}
    </span>
  );
}

function KpiCard({ label, value, sub, accent, icon: Icon }: {
  label: string; value: number | string; sub?: string; accent?: string; icon?: React.ComponentType<{ size?: number; color?: string }>;
}) {
  const c = accent || "var(--text-1)";
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
        {Icon && <Icon size={14} color={c} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: c, letterSpacing: "-0.04em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function AgentCard({
  agent, agentsMode, keyStatus, onRunMock, onRunAgent, onProviderChange, onModeChange, isRunning,
}: {
  agent: Agent;
  agentsMode: string;
  keyStatus: Record<string, boolean>;
  onRunMock?: () => void;
  onRunAgent?: (id: number) => void;
  onProviderChange?: (id: number, provider: string) => void;
  onModeChange?: (id: number, mode: AgentMode) => void;
  isRunning?: boolean;
}) {
  const [localProvider, setLocalProvider] = useState(agent.model_provider);
  const [localMode,     setLocalMode]     = useState<AgentMode>(agent.mode || "mock");
  const [saving,        setSaving]        = useState(false);
  const [savingMode,    setSavingMode]    = useState(false);
  const [saveErr,       setSaveErr]       = useState<string | null>(null);

  const statusColor = STATUS_COLOR[agent.status] || "var(--text-3)";
  const agentMode   = localMode;
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
      setLocalProvider(agent.model_provider);
    } finally {
      setSaving(false);
    }
  }

  async function handleModeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as AgentMode;
    setSavingMode(true);
    setSaveErr(null);
    try {
      await updateAgentMode(agent.id, next);
      setLocalMode(next);
      onModeChange?.(agent.id, next);
    } catch (err: any) {
      setSaveErr(err.message || "Mode güncellenemedi.");
    } finally {
      setSavingMode(false);
    }
  }

  const runBtnDisabled = !agent.is_enabled || !!isRunning || agentMode === "disabled";

  return (
    <div style={{
      background: "var(--bg-elevated)", borderRadius: 14,
      border: "1px solid var(--line)", overflow: "hidden",
      display: "flex", flexDirection: "column",
      borderTop: `2px solid ${statusColor}`,
    }}>
      {/* Header */}
      <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `${statusColor}18`, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 17, color: statusColor,
          }}>
            {ROLE_ICON[agent.role] || "◎"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
              {agent.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
              {agent.role} · {agent.model_name}
            </div>
          </div>
          {!agent.is_enabled && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "var(--bg-muted)", color: "var(--text-3)", flexShrink: 0 }}>
              Devre Dışı
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <StatusBadge status={agent.status} />
          <RiskBadge level={agent.risk_level} />
          <ModeBadge mode={agentMode} />
          {agent.is_scheduled && (
            <span title={`Zamanlama: ${agent.schedule_cron || "—"}`} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99,
              background: "var(--brand-600)14", color: "var(--brand-600)",
              border: "1px solid var(--brand-600)30",
            }}>
              <Calendar size={9} /> {agent.schedule_cron || "scheduled"}
            </span>
          )}
          {agent.failure_count > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
              background: "var(--red-bg)", color: "var(--red)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}>
              {agent.failure_count}x hata
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 18px", flex: 1 }}>
        {/* Mode selector */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Execution Mode</div>
          <select
            value={localMode}
            onChange={handleModeChange}
            disabled={savingMode}
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 7, fontSize: 12,
              border: `1px solid ${MODE_COLOR[localMode]}40`,
              background: `${MODE_COLOR[localMode]}10`,
              color: MODE_COLOR[localMode],
              fontWeight: 600, cursor: "pointer", opacity: savingMode ? 0.6 : 1,
            }}
          >
            <option value="mock">MOCK — Simüle yanıtlar</option>
            <option value="active">ACTIVE — Gerçek LLM (API key gerekli)</option>
            <option value="disabled">DISABLED — Devre dışı</option>
          </select>
        </div>

        {/* Provider */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Provider</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select
              value={localProvider}
              onChange={handleProviderChange}
              disabled={saving || !agent.is_enabled}
              style={{
                flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: 12,
                border: "1px solid var(--line)", background: "var(--bg-subtle)",
                color: "var(--text-1)", cursor: agent.is_enabled ? "pointer" : "not-allowed",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {needsKey && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, flexShrink: 0,
                background: keyOk ? "var(--green-bg)" : "#FEF3C7",
                color: keyOk ? "var(--green)" : "#92400E",
                border: `1px solid ${keyOk ? "rgba(34,197,94,0.3)" : "#FDE68A"}`,
              }}>
                {keyOk ? "✓ Key" : "⚠ Key"}
              </span>
            )}
          </div>
          {saveErr && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{saveErr}</div>}
        </div>

        {/* Description */}
        {agent.description && (
          <p style={{
            fontSize: 12, color: "var(--text-3)", lineHeight: 1.6, margin: "0 0 10px",
            display: "-webkit-box", WebkitLineClamp: 2, overflow: "hidden",
            ...({ WebkitBoxOrient: "vertical" } as CSSProperties),
          }}>
            {agent.description}
          </p>
        )}

        <div style={{ fontSize: 11, color: "var(--text-3)", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} /> Son: {relativeTime(agent.last_run_at)}
          </span>
          {agent.is_scheduled && agent.next_run_at && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={11} /> Sonraki: {relativeTime(agent.next_run_at)}
            </span>
          )}
          {agent.is_scheduled && !agent.next_run_at && (
            <span style={{ color: "var(--amber)", display: "flex", alignItems: "center", gap: 4 }}>
              <Calendar size={11} /> Zamanlama: hesaplanmadı
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
        <button
          onClick={agentMode === "active" ? () => onRunAgent?.(agent.id) : onRunMock}
          disabled={runBtnDisabled}
          title={
            agentMode === "disabled" ? "Agent devre dışı" :
            agentMode === "active" && !keyOk ? `${localProvider} için API key eksik` : undefined
          }
          style={{
            flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
            cursor: runBtnDisabled ? "not-allowed" : "pointer",
            background: runBtnDisabled ? "var(--bg-muted)" :
              agentMode === "active" && !keyOk ? "#D97706" : "var(--brand-600)",
            color: runBtnDisabled ? "var(--text-3)" : "#fff", border: "none",
            opacity: runBtnDisabled ? 0.5 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Play size={11} />
          {isRunning ? "Çalışıyor..." : agentMode === "active" ? "Run (Real)" : agentMode === "disabled" ? "Disabled" : "Run (Mock)"}
        </button>
        <Link href="/admin/agents/runs" style={{
          flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 7, fontSize: 12,
          fontWeight: 500, textDecoration: "none", background: "var(--bg-subtle)",
          color: "var(--text-2)", border: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          <BarChart2 size={11} /> Logs
        </Link>
      </div>
    </div>
  );
}

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

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 16, width: "100%", maxWidth: 540,
        border: "1px solid var(--line)", boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
        padding: 28,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em", color: "var(--text-1)" }}>
              Orchestrated Review
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>CEO Agent tüm ilgili ajanları koordine eder.</p>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 7, background: "var(--bg-subtle)", border: "1px solid var(--line)", cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center" }}>
            <X size={14} />
          </button>
        </div>

        {err && (
          <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, fontSize: 12, marginBottom: 16, border: "1px solid rgba(239,68,68,0.2)" }}>
            {err}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Review Türü</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {TASK_TYPES.map((t) => (
              <label key={t.value} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                borderRadius: 9, cursor: "pointer",
                background: taskType === t.value ? "var(--green-bg)" : "var(--bg-subtle)",
                border: `1px solid ${taskType === t.value ? "rgba(34,197,94,0.3)" : "var(--line)"}`,
                transition: "all 0.12s",
              }}>
                <input type="radio" name="taskType" value={t.value} checked={taskType === t.value}
                  onChange={() => setTaskType(t.value)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: taskType === t.value ? 600 : 400, color: "var(--text-1)" }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{t.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Görev Başlığı</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}
            placeholder="örn: Production risklerini incele"
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Açıklama (opsiyonel)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 13, resize: "vertical" }}
            placeholder="Ek bağlam veya odak alanı belirtin…"
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: "var(--bg-subtle)", color: "var(--text-2)", border: "1px solid var(--line)",
          }}>
            İptal
          </button>
          <button onClick={submit} disabled={loading} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "var(--bg-muted)" : "var(--brand-600)", color: loading ? "var(--text-3)" : "#fff",
            border: "none", opacity: loading ? 0.7 : 1,
          }}>
            <Zap size={13} />
            {loading ? "CEO çalışıyor…" : "Orchestrate Başlat"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsCenterPage() {
  const [agents,         setAgents]         = useState<Agent[]>([]);
  const [overview,       setOverview]       = useState<AgentOverview | null>(null);
  const [agentsMode,     setAgentsMode]     = useState<string>("mock");
  const [keyStatus,      setKeyStatus]      = useState<Record<string, boolean>>({});
  const [loading,        setLoading]        = useState(true);
  const [err,            setErr]            = useState("");
  const [mockLoading,    setMockLoading]    = useState(false);
  const [runningAgentId, setRunningAgentId] = useState<number | null>(null);
  const [banner,         setBanner]         = useState<{ type: "success" | "error"; text: string; convId?: number } | null>(null);
  const [showOrch,       setShowOrch]       = useState(false);
  const [filter,         setFilter]         = useState<"all" | "active" | "idle" | "error">("all");
  const [groupByDept,    setGroupByDept]    = useState(true);
  const [approvals,      setApprovals]      = useState<AgentApproval[]>([]);
  const [events,         setEvents]         = useState<AgentEvent[]>([]);
  const [approvalsLoaded, setApprovalsLoaded] = useState(false);
  const [eventsLoaded,   setEventsLoaded]   = useState(false);

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

  async function loadApprovals() {
    try {
      const res = await getAgentApprovals("pending");
      setApprovals(res.approvals);
      setApprovalsLoaded(true);
    } catch { /* ignore */ }
  }

  async function loadEvents() {
    try {
      const res = await getAgentEvents({ limit: 20 });
      setEvents(res.events);
      setEventsLoaded(true);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    loadApprovals();
    loadEvents();
  }, []);

  async function runMock() {
    setMockLoading(true); setBanner(null);
    try {
      const res = await triggerMockAgentRun();
      const msgNote = res.message_count ? `, ${res.message_count} mesaj` : "";
      setBanner({
        type: "success",
        text: `Mock run tamamlandı. Konuşma #${res.conversation_id}${msgNote}. Risk: ${(res.risk_level || "low").toUpperCase()}. [${res.mode || "MOCK"}]`,
        convId: res.conversation_id,
      });
      await load();
      await loadApprovals();
      await loadEvents();
    } catch (e: any) {
      setBanner({ type: "error", text: e.message });
    } finally {
      setMockLoading(false);
    }
  }

  async function runAgent(agentId: number) {
    setRunningAgentId(agentId); setBanner(null);
    try {
      const res = await runAgentTest(agentId);
      if (res.success) {
        setBanner({ type: "success", text: `Agent #${agentId} tamamlandı. Run #${res.run?.id} · provider: ${res.run?.provider ?? "—"}.` });
      } else {
        setBanner({ type: "error", text: `Agent #${agentId} başarısız: ${res.error_message || res.task?.status || "Bilinmeyen hata."}` });
      }
      await load();
    } catch (e: any) {
      setBanner({ type: "error", text: e.message });
    } finally {
      setRunningAgentId(null);
    }
  }

  function handleOrchestrateSuccess(res: any) {
    setShowOrch(false);
    setBanner({
      type: "success",
      text: `Orchestrated Review tamamlandı. ${res.sub_task_count ?? 0} alt görev, risk: ${(res.risk_level || "low").toUpperCase()}. ${res.approval_id ? `Approval #${res.approval_id} oluşturuldu.` : "Onay gerekmedi."} [${res.mode || "MOCK"}]`,
      convId: res.conversation_id,
    });
    load();
    loadApprovals();
    loadEvents();
  }

  function handleProviderChange(agentId: number, provider: string) {
    setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, model_provider: provider as any } : a));
  }

  function handleModeChange(agentId: number, mode: AgentMode) {
    setAgents((prev) => prev.map((a) =>
      a.id === agentId ? { ...a, mode, is_enabled: mode !== "disabled" } : a
    ));
  }

  const filtered = agents.filter((a) => filter === "all" || a.status === filter);
  const statusGroups = {
    active:           agents.filter((a) => a.status === "active").length,
    idle:             agents.filter((a) => a.status === "idle").length,
    error:            agents.filter((a) => a.status === "error").length,
    waiting_approval: agents.filter((a) => a.status === "waiting_approval").length,
  };
  const isRealMode = agentsMode === "real" || agentsMode === "live";

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin</span>
            <ChevronRight size={12} style={{ color: "var(--text-3)" }} />
            <span style={{ fontSize: 11, color: "var(--brand-500)", fontWeight: 600 }}>AI Agents Center</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.03em", color: "var(--text-1)" }}>
            AI Agents Center
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, color: "var(--text-3)" }}>{overview?.agents_total || 0} ajan</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
              background: isRealMode ? "var(--green-bg)" : "var(--bg-subtle)",
              color: isRealMode ? "var(--green)" : "var(--text-3)",
              border: `1px solid ${isRealMode ? "rgba(34,197,94,0.3)" : "var(--line)"}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              <Dot color={isRealMode ? "var(--green)" : "var(--text-3)"} pulse={isRealMode} />
              MODE: {agentsMode.toUpperCase()}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setShowOrch(true)} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600,
            background: "var(--brand-600)", color: "#fff", border: "none", cursor: "pointer",
          }}>
            <Zap size={14} /> Orchestrated Review
          </button>
          <button onClick={runMock} disabled={mockLoading} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 500,
            background: "var(--bg-elevated)", color: "var(--text-2)", border: "1px solid var(--line)",
            cursor: mockLoading ? "not-allowed" : "pointer", opacity: mockLoading ? 0.7 : 1,
          }}>
            <Play size={13} /> {mockLoading ? "..." : "Mock Run"}
          </button>
          <button onClick={load} disabled={loading} style={{
            padding: "9px 10px", borderRadius: 9, fontSize: 13, fontWeight: 500,
            background: "var(--bg-elevated)", color: "var(--text-3)", border: "1px solid var(--line)",
            cursor: "pointer", display: "flex", alignItems: "center",
          }}>
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* Key status */}
      {isRealMode && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {(["claude", "openai", "deepseek", "gemini"] as const).map((p) => (
            <span key={p} style={{
              fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 99,
              background: keyStatus[p] ? "var(--green-bg)" : "#FEF3C7",
              color: keyStatus[p] ? "var(--green)" : "#92400E",
              border: `1px solid ${keyStatus[p] ? "rgba(34,197,94,0.3)" : "#FDE68A"}`,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              {keyStatus[p] ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
              {p}: {keyStatus[p] ? "Key mevcut" : "Key eksik"}
            </span>
          ))}
        </div>
      )}

      {/* Banner */}
      {banner && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13,
          background: banner.type === "success" ? "var(--green-bg)" : "var(--red-bg)",
          border: `1px solid ${banner.type === "success" ? "rgba(34,197,94,0.2)" : "#FECACA"}`,
          color: banner.type === "success" ? "var(--green)" : "var(--red)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {banner.type === "success" ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            <span>{banner.text}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {banner.type === "success" && banner.convId && (
              <Link href="/admin/agents/conversations" style={{ fontSize: 12, color: "var(--brand-500)", textDecoration: "none", fontWeight: 600 }}>
                Konuşmayı gör →
              </Link>
            )}
            {banner.type === "success" && (
              <Link href="/admin/agents/approvals" style={{ fontSize: 12, color: "var(--amber)", textDecoration: "none", fontWeight: 600 }}>
                Onaylar →
              </Link>
            )}
            <button onClick={() => setBanner(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "inherit", opacity: 0.7 }}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {err && (
        <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13, background: "var(--red-bg)", color: "var(--red)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {err}
        </div>
      )}

      {/* KPI grid */}
      {overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
          <KpiCard label="Toplam Ajan"   value={overview.agents_total}        sub={`${overview.agents_enabled} etkin`} icon={Bot} />
          <KpiCard label="Aktif"          value={statusGroups.active}           accent="var(--green)" icon={Activity} />
          <KpiCard label="Hata"           value={statusGroups.error}            accent="var(--red)" icon={AlertTriangle} />
          <KpiCard label="Onay Bekliyor"  value={overview.pending_approvals}    accent="var(--amber)" icon={CheckCircle} />
          <KpiCard label="Zamanlanmış"    value={overview.agents_scheduled ?? 0} accent="var(--brand-600)" icon={Calendar} />
          <KpiCard label="Toplam Görev"   value={overview.tasks_total}          icon={ListTodo} />
          <KpiCard label="Mock Run"       value={overview.runs_mock ?? 0}       sub="gerçek API yok" icon={FlaskConical} />
          <KpiCard label="Konuşmalar"     value={overview.conversations_total}  icon={MessageSquare} />
        </div>
      )}

      {/* Quick links */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { href: "/admin/agents/conversations", label: "Konuşmalar", icon: MessageSquare },
          { href: "/admin/agents/approvals",     label: "Onay Kuyruğu", icon: CheckCircle },
          { href: "/admin/agents/tasks",         label: "Görevler", icon: ListTodo },
          { href: "/admin/agents/runs",          label: "Run Logs", icon: BarChart2 },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
            textDecoration: "none", background: "var(--bg-elevated)",
            color: "var(--text-2)", border: "1px solid var(--line)",
            transition: "all 0.12s",
          }}>
            <Icon size={13} /> {label}
          </Link>
        ))}
      </div>

      {/* Filter + View Toggle */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", padding: 4, borderRadius: 10, border: "1px solid var(--line)" }}>
          {([
            { key: "all",    label: `Tümü (${agents.length})` },
            { key: "active", label: `Aktif (${statusGroups.active})` },
            { key: "idle",   label: `Bekliyor (${statusGroups.idle})` },
            { key: "error",  label: `Hata (${statusGroups.error})` },
          ] as const).map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: filter === f.key ? 600 : 400,
              cursor: "pointer", transition: "all 0.12s",
              background: filter === f.key ? "var(--bg-subtle)" : "transparent",
              color: filter === f.key ? "var(--text-1)" : "var(--text-3)",
              border: filter === f.key ? "1px solid var(--line)" : "1px solid transparent",
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setGroupByDept(!groupByDept)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: groupByDept ? "var(--brand-600)" : "var(--bg-elevated)",
            color: groupByDept ? "#fff" : "var(--text-2)",
            border: `1px solid ${groupByDept ? "var(--brand-600)" : "var(--line)"}`,
            cursor: "pointer",
          }}
        >
          <Layers size={12} />
          {groupByDept ? "Departmana Göre" : "Düz Liste"}
        </button>
      </div>

      {/* Agent grid / department view */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 56, color: "var(--text-3)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Ajanlar yükleniyor…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <Bot size={32} style={{ color: "var(--text-3)", display: "block", margin: "0 auto 12px", opacity: 0.4 }} />
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 8px", color: "var(--text-1)" }}>Ajan bulunamadı</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Sistemi yeniden başlatarak agent seed&apos;lerini kontrol edin.</p>
        </div>
      ) : groupByDept ? (
        <DepartmentGroupedAgents
          agents={filtered}
          agentsMode={agentsMode}
          keyStatus={keyStatus}
          runningAgentId={runningAgentId}
          onRunMock={runMock}
          onRunAgent={runAgent}
          onProviderChange={handleProviderChange}
          onModeChange={handleModeChange}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 }}>
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              agentsMode={agentsMode}
              keyStatus={keyStatus}
              onRunMock={runMock}
              onRunAgent={runAgent}
              onProviderChange={handleProviderChange}
              onModeChange={handleModeChange}
              isRunning={runningAgentId === agent.id}
            />
          ))}
        </div>
      )}

      {/* Pending Approvals Panel */}
      {approvalsLoaded && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={16} style={{ color: "var(--amber)" }} />
              Onay Kuyruğu
              {approvals.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                  background: "rgba(245,158,11,0.15)", color: "var(--amber)",
                  border: "1px solid rgba(245,158,11,0.3)",
                }}>
                  {approvals.length} bekliyor
                </span>
              )}
            </h2>
            <Link href="/admin/agents/approvals" style={{ fontSize: 12, color: "var(--brand-500)", textDecoration: "none", fontWeight: 600 }}>
              Tümünü gör →
            </Link>
          </div>
          {approvals.length === 0 ? (
            <div style={{ padding: "16px 18px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-3)", fontSize: 13 }}>
              <CheckCircle size={13} style={{ display: "inline", marginRight: 6, color: "var(--green)" }} />
              Bekleyen onay yok.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {approvals.slice(0, 5).map((a) => (
                <div key={a.id} style={{
                  padding: "12px 16px", borderRadius: 10, background: "var(--bg-elevated)",
                  border: "1px solid var(--line)", borderLeft: `3px solid ${RISK_COLOR[a.risk_level] || "var(--amber)"}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                      {a.action_type} · {relativeTime(a.created_at)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, flexShrink: 0,
                    background: `${RISK_COLOR[a.risk_level] || "var(--amber)"}18`,
                    color: RISK_COLOR[a.risk_level] || "var(--amber)",
                  }}>
                    {a.risk_level.toUpperCase()}
                  </span>
                  <Link href="/admin/agents/approvals" style={{
                    fontSize: 12, fontWeight: 600, color: "var(--brand-500)", textDecoration: "none", flexShrink: 0,
                  }}>
                    İncele →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event Log Panel */}
      {eventsLoaded && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 8 }}>
              <Radio size={14} style={{ color: "var(--brand-600)" }} />
              Event Log
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-3)" }}>— son {Math.min(events.length, 20)} olay</span>
            </h2>
            <Link href="/admin/agents/tasks" style={{ fontSize: 12, color: "var(--brand-500)", textDecoration: "none", fontWeight: 600 }}>
              Görevler →
            </Link>
          </div>
          {events.length === 0 ? (
            <div style={{ padding: "16px 18px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-3)", fontSize: 13 }}>
              Henüz kayıtlı event yok.
            </div>
          ) : (
            <div style={{
              borderRadius: 10, border: "1px solid var(--line)", overflow: "hidden",
              background: "var(--bg-elevated)",
            }}>
              {events.slice(0, 10).map((ev, i) => {
                const isLast = i === Math.min(events.length, 10) - 1;
                const statusColor = ev.status === "routed" ? "var(--green)" :
                                    ev.status === "failed" ? "var(--red)" : "var(--amber)";
                return (
                  <div key={ev.id} style={{
                    padding: "10px 16px", display: "flex", alignItems: "center", gap: 12,
                    borderBottom: isLast ? "none" : "1px solid var(--line)",
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0,
                      background: `${statusColor}14`, color: statusColor,
                    }}>
                      {ev.status}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.event_type}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{ev.source}</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{relativeTime(ev.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showOrch && (
        <OrchestrateModal onClose={() => setShowOrch(false)} onSuccess={handleOrchestrateSuccess} />
      )}
    </div>
  );
}

// ─── Department Grouped View ──────────────────────────────────────────────────

function DepartmentGroupedAgents({
  agents, agentsMode, keyStatus, runningAgentId,
  onRunMock, onRunAgent, onProviderChange, onModeChange,
}: {
  agents: Agent[];
  agentsMode: string;
  keyStatus: Record<string, boolean>;
  runningAgentId: number | null;
  onRunMock: () => void;
  onRunAgent: (id: number) => void;
  onProviderChange: (id: number, provider: string) => void;
  onModeChange: (id: number, mode: AgentMode) => void;
}) {
  const grouped: Record<string, Agent[]> = {};
  for (const agent of agents) {
    const dept = agent.department || "other";
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(agent);
  }

  const deptOrder = ["executive", "engineering", "analysis", "campaign", "growth", "archive", "intel", "product", "other"];
  const sortedDepts = [
    ...deptOrder.filter((d) => grouped[d]),
    ...Object.keys(grouped).filter((d) => !deptOrder.includes(d)),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {sortedDepts.map((dept) => {
        const deptAgents = grouped[dept] || [];
        const color = DEPT_COLOR[dept] || "var(--text-3)";
        const label = DEPT_LABEL[dept] || dept.charAt(0).toUpperCase() + dept.slice(1);
        const activeCount = deptAgents.filter((a) => a.status === "active").length;
        const mockCount = deptAgents.filter((a) => a.mode === "mock").length;

        return (
          <div key={dept}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 3, height: 18, borderRadius: 2, background: color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.01em" }}>
                {label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {deptAgents.length} ajan
              </span>
              {activeCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
                  background: "var(--green-bg)", color: "var(--green)",
                }}>
                  {activeCount} aktif
                </span>
              )}
              {mockCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
                  background: "rgba(245,158,11,0.12)", color: "var(--amber)",
                }}>
                  {mockCount} mock
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 12 }}>
              {deptAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  agentsMode={agentsMode}
                  keyStatus={keyStatus}
                  onRunMock={onRunMock}
                  onRunAgent={onRunAgent}
                  onProviderChange={onProviderChange}
                  onModeChange={onModeChange}
                  isRunning={runningAgentId === agent.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
