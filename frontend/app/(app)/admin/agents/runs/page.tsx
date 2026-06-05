"use client";
import { useEffect, useState } from "react";
import { getAgentRuns, getAgents, type AgentRun } from "@/lib/agents-api";

function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed" ? "var(--green)"
    : status === "failed"  ? "var(--red)"
    : status === "running" ? "var(--brand-600)"
    : "var(--text-3)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, color,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      {status === "completed" ? "Tamamlandı"
        : status === "failed" ? "Başarısız"
        : status === "running" ? "Çalışıyor"
        : status}
    </span>
  );
}

function TokenBadge({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <span style={{
      fontSize: 10, padding: "2px 7px", borderRadius: 99,
      background: "var(--bg-subtle)", color: "var(--text-3)",
      border: "1px solid var(--line)",
    }}>
      {label}: {value.toLocaleString()}
    </span>
  );
}

function RunRow({ run, agents }: { run: AgentRun; agents: Record<number, string> }) {
  const [expanded, setExpanded] = useState(false);
  const hasMeta = run.metadata && Object.keys(run.metadata).length > 0;

  const latencyColor =
    !run.latency_ms        ? "var(--text-3)"
    : run.latency_ms < 200 ? "var(--green)"
    : run.latency_ms < 500 ? "var(--amber)"
    : "var(--red)";

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--line)" }}>
        {/* Run ID */}
        <td style={{ padding: "11px 14px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-3)" }}>
            #{run.id}
          </span>
        </td>
        {/* Agent */}
        <td style={{ padding: "11px 8px" }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>
            {agents[run.agent_id] || `Agent #${run.agent_id}`}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)" }}>
            task #{run.task_id ?? "—"}
          </div>
        </td>
        {/* Provider / model */}
        <td style={{ padding: "11px 8px" }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{run.provider}</div>
          <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
            {run.model}
          </div>
        </td>
        {/* Status */}
        <td style={{ padding: "11px 8px" }}>
          <StatusDot status={run.status} />
        </td>
        {/* Tokens */}
        <td style={{ padding: "11px 8px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <TokenBadge label="in"  value={run.input_tokens} />
            <TokenBadge label="out" value={run.output_tokens} />
          </div>
        </td>
        {/* Latency */}
        <td style={{ padding: "11px 8px" }}>
          {run.latency_ms != null ? (
            <span style={{
              fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: latencyColor,
            }}>
              {run.latency_ms}ms
            </span>
          ) : (
            <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>
          )}
        </td>
        {/* Cost */}
        <td style={{ padding: "11px 8px" }}>
          <span style={{ fontSize: 12, color: run.cost_estimate ? "var(--text-1)" : "var(--text-3)" }}>
            {run.cost_estimate != null && run.cost_estimate > 0
              ? `$${run.cost_estimate.toFixed(5)}`
              : run.provider === "mock" ? "Free" : "—"}
          </span>
        </td>
        {/* Time */}
        <td style={{ padding: "11px 8px", fontSize: 11, color: "var(--text-3)" }}>
          {run.completed_at
            ? new Date(run.completed_at).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
            : "—"}
        </td>
        {/* Expand */}
        <td style={{ padding: "11px 8px" }}>
          {(hasMeta || run.error_message) && (
            <button
              onClick={() => setExpanded((e) => !e)}
              style={{
                fontSize: 11, padding: "4px 8px", borderRadius: 6,
                cursor: "pointer", background: "var(--bg-subtle)",
                color: "var(--text-3)", border: "1px solid var(--line)",
              }}
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid var(--line)" }}>
          <td colSpan={9} style={{ padding: "0 14px 12px" }}>
            {run.error_message && (
              <div style={{
                padding: "8px 12px", background: "#FEF2F2",
                border: "1px solid #FECACA", borderRadius: 7,
                fontSize: 12, color: "var(--red)", marginBottom: 8,
              }}>
                <strong>Hata:</strong> {run.error_message}
              </div>
            )}
            {hasMeta && (
              <div style={{
                padding: "8px 12px", background: "var(--bg-subtle)",
                border: "1px solid var(--line)", borderRadius: 7,
              }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, marginBottom: 4 }}>Metadata</div>
                <pre style={{ fontSize: 11, color: "var(--text-2)", margin: 0, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(run.metadata, null, 2)}
                </pre>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function RunsPage() {
  const [runs,    setRuns]    = useState<AgentRun[]>([]);
  const [agents,  setAgents]  = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const [runsRes, agentsRes] = await Promise.all([
        getAgentRuns(undefined, 100),
        getAgents(),
      ]);
      setRuns(runsRes.runs);
      const map: Record<number, string> = {};
      agentsRes.agents.forEach((a) => { map[a.id] = a.name; });
      setAgents(map);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // İstatistikler
  const completed = runs.filter((r) => r.status === "completed").length;
  const failed    = runs.filter((r) => r.status === "failed").length;
  const avgLatency = runs.filter((r) => r.latency_ms).reduce((acc, r) => acc + (r.latency_ms || 0), 0)
    / Math.max(runs.filter((r) => r.latency_ms).length, 1);
  const totalTokens = runs.reduce((acc, r) => acc + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
  const totalCost   = runs.reduce((acc, r) => acc + (r.cost_estimate || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin → AI Agents</span>
            <span style={{ color: "var(--text-3)" }}>→</span>
            <span style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 500 }}>Run Logs</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: "0 0 4px" }}>
            Agent Run Logs
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>{runs.length} run kaydı</p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm" disabled={loading}>
          {loading ? "…" : "↺ Yenile"}
        </button>
      </div>

      {/* Özet metrikler */}
      {!loading && runs.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Toplam Run",       value: runs.length,                      color: "var(--text-1)" },
            { label: "Tamamlandı",       value: completed,                        color: "var(--green)" },
            { label: "Başarısız",        value: failed,                           color: failed > 0 ? "var(--red)" : "var(--text-3)" },
            { label: "Ort. Latency",     value: `${Math.round(avgLatency)}ms`,    color: "var(--text-1)" },
            { label: "Toplam Token",     value: totalTokens.toLocaleString(),     color: "var(--text-1)" },
            { label: "Toplam Maliyet",   value: totalCost > 0 ? `$${totalCost.toFixed(4)}` : "Free", color: "var(--text-1)" },
          ].map((m) => (
            <div key={m.label} className="card" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {err && (
        <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-3)" }}>Yükleniyor…</div>
      ) : runs.length === 0 ? (
        <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>≡</div>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 6px" }}>Henüz run kaydı yok</h2>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            Center sayfasından Mock Run başlatın.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                {["ID", "Ajan", "Provider/Model", "Durum", "Tokenlar", "Latency", "Maliyet", "Zaman", ""].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "9px 14px",
                    fontSize: 11, fontWeight: 600, color: "var(--text-3)", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => <RunRow key={r.id} run={r} agents={agents} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
