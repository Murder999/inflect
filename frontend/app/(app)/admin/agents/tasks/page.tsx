"use client";
import { useEffect, useState } from "react";
import {
  getAgentTasks, runAgentTask,
  type AgentTask,
  STATUS_COLOR, STATUS_LABEL, RISK_COLOR, RISK_LABEL, relativeTime,
} from "@/lib/agents-api";

const STATUS_TABS = [
  { key: "",                 label: "Tümü" },
  { key: "pending",          label: "Bekliyor" },
  { key: "running",          label: "Çalışıyor" },
  { key: "completed",        label: "Tamamlandı" },
  { key: "failed",           label: "Başarısız" },
  { key: "waiting_approval", label: "Onay Bekliyor" },
];

const PRIORITY_COLOR: Record<string, string> = {
  low: "var(--text-3)", normal: "var(--brand-600)",
  high: "var(--amber)", urgent: "var(--red)",
};
const PRIORITY_LABEL: Record<string, string> = {
  low: "Düşük", normal: "Normal", high: "Yüksek", urgent: "Acil",
};

function TaskRow({ task, onRun }: { task: AgentTask; onRun: (id: number) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const canRun = task.status === "pending" || task.status === "failed";
  const statusColor = STATUS_COLOR[task.status] || "var(--text-3)";
  const riskColor = RISK_COLOR[task.risk_level] || "var(--text-3)";

  async function handleRun() {
    setBusy(true);
    try { await onRun(task.id); }
    finally { setBusy(false); }
  }

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--line)" }}>
        <td style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
              {task.title}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              {task.task_type} · #{task.id}
              {task.parent_task_id ? ` · sub-task of #${task.parent_task_id}` : ""}
            </span>
          </div>
        </td>
        <td style={{ padding: "12px 8px" }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99,
            background: `${statusColor}18`, color: statusColor,
          }}>
            {STATUS_LABEL[task.status] || task.status}
          </span>
        </td>
        <td style={{ padding: "12px 8px" }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color: PRIORITY_COLOR[task.priority] || "var(--text-3)",
          }}>
            {PRIORITY_LABEL[task.priority] || task.priority}
          </span>
        </td>
        <td style={{ padding: "12px 8px" }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 99,
            background: `${riskColor}14`, color: riskColor,
          }}>
            {RISK_LABEL[task.risk_level] || task.risk_level}
          </span>
        </td>
        <td style={{ padding: "12px 8px", fontSize: 11, color: "var(--text-3)" }}>
          {relativeTime(task.created_at)}
        </td>
        <td style={{ padding: "12px 8px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {canRun && (
              <button
                onClick={handleRun}
                disabled={busy}
                style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  cursor: busy ? "wait" : "pointer",
                  background: "var(--brand-600)", color: "#fff",
                  border: "none", opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "…" : "▶ Çalıştır"}
              </button>
            )}
            {task.output_data && (
              <button
                onClick={() => setExpanded((e) => !e)}
                style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 11,
                  cursor: "pointer", background: "var(--bg-subtle)",
                  color: "var(--text-2)", border: "1px solid var(--line)",
                }}
              >
                {expanded ? "▲" : "▼"} Çıktı
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && task.output_data && (
        <tr style={{ borderBottom: "1px solid var(--line)" }}>
          <td colSpan={6} style={{ padding: "0 14px 12px" }}>
            <div style={{
              background: "var(--bg-subtle)", border: "1px solid var(--line)",
              borderRadius: 8, padding: "10px 14px",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>
                Görev Çıktısı
              </div>
              {task.output_data.response ? (
                <p style={{ fontSize: 12, color: "var(--text-1)", margin: 0, lineHeight: 1.65 }}>
                  {task.output_data.response}
                </p>
              ) : (
                <pre style={{ fontSize: 11, color: "var(--text-2)", margin: 0, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(task.output_data, null, 2)}
                </pre>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function TasksPage() {
  const [tasks,   setTasks]   = useState<AgentTask[]>([]);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(true);
  const [total,   setTotal]   = useState(0);
  const [err,     setErr]     = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const r = await getAgentTasks({ status: status || undefined, limit: 100 });
      setTasks(r.tasks);
      setTotal(r.total);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status]);

  async function handleRun(taskId: number) {
    await runAgentTask(taskId);
    await load();
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin → AI Agents</span>
            <span style={{ color: "var(--text-3)" }}>→</span>
            <span style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 500 }}>Görevler</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: "0 0 4px" }}>
            Agent Görevleri
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>{total} görev</p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm" disabled={loading}>
          {loading ? "…" : "↺ Yenile"}
        </button>
      </div>

      {err && (
        <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {err}
        </div>
      )}

      {/* Filtre tabları */}
      <div style={{ display: "flex", gap: 2, marginBottom: 16, borderBottom: "1px solid var(--line)", paddingBottom: 0 }}>
        {STATUS_TABS.map((tab) => (
          <button key={tab.key} onClick={() => setStatus(tab.key)} style={{
            padding: "8px 14px", fontSize: 13, cursor: "pointer",
            background: "none", border: "none",
            borderBottom: status === tab.key ? "2px solid var(--brand-600)" : "2px solid transparent",
            color: status === tab.key ? "var(--brand-600)" : "var(--text-3)",
            fontWeight: status === tab.key ? 600 : 400, marginBottom: "-1px",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-3)" }}>Yükleniyor…</div>
      ) : tasks.length === 0 ? (
        <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>◻</div>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 6px" }}>Görev bulunamadı</h2>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            Center sayfasından Mock Run başlatarak görev oluşturun.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                {["Görev", "Durum", "Öncelik", "Risk", "Oluşturulma", "İşlem"].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "9px 14px",
                    fontSize: 11, fontWeight: 600, color: "var(--text-3)",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} onRun={handleRun} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
