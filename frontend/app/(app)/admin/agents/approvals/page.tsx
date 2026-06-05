"use client";
import { useEffect, useState } from "react";
import {
  getAgentApprovals, approveAgentApproval, rejectAgentApproval,
  type AgentApproval, RISK_COLOR, RISK_LABEL, relativeTime,
} from "@/lib/agents-api";

function RiskBadge({ level }: { level: string }) {
  const color = RISK_COLOR[level] || "var(--text-3)";
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {RISK_LABEL[level] || level} Risk
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; label: string }> = {
    pending:  { color: "var(--amber)", label: "Bekliyor" },
    approved: { color: "var(--green)", label: "Onaylandı" },
    rejected: { color: "var(--red)",   label: "Reddedildi" },
    expired:  { color: "var(--text-3)", label: "Süresi Doldu" },
  };
  const c = cfg[status] || { color: "var(--text-3)", label: status };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
      background: `${c.color}18`, color: c.color,
    }}>
      {c.label}
    </span>
  );
}

function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: AgentApproval;
  onApprove: (id: number, note?: string) => Promise<void>;
  onReject: (id: number, note?: string) => Promise<void>;
}) {
  const [note, setNote]       = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy]       = useState(false);
  const isPending = approval.status === "pending";

  async function handle(type: "approve" | "reject") {
    setBusy(true);
    try {
      if (type === "approve") await onApprove(approval.id, note || undefined);
      else                     await onReject(approval.id, note || undefined);
    } finally {
      setBusy(false);
      setShowNote(false);
      setNote("");
    }
  }

  const riskColor = RISK_COLOR[approval.risk_level] || "var(--text-3)";

  return (
    <div className="card" style={{
      padding: 0, overflow: "hidden",
      borderLeft: `3px solid ${isPending ? riskColor : "var(--line)"}`,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--line)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
              background: "var(--bg-subtle)", color: "var(--text-2)",
            }}>
              {approval.action_type}
            </span>
            <RiskBadge level={approval.risk_level} />
            <StatusBadge status={approval.status} />
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "var(--text-1)" }}>
            {approval.title}
          </h3>
          {approval.description && (
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.6 }}>
              {approval.description}
            </p>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>#{approval.id}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
            {relativeTime(approval.created_at)}
          </div>
        </div>
      </div>

      {/* Payload */}
      {approval.payload && Object.keys(approval.payload).length > 0 && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)", background: "var(--bg-subtle)" }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Payload</div>
          <pre style={{
            fontSize: 11, color: "var(--text-2)", margin: 0,
            fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-word",
          }}>
            {JSON.stringify(approval.payload, null, 2)}
          </pre>
        </div>
      )}

      {/* Review result */}
      {!isPending && (
        <div style={{ padding: "12px 20px", background: "var(--bg-subtle)" }}>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
            {approval.status === "approved" ? "✓ Onaylandı" : "✕ Reddedildi"}
            {approval.review_note && ` — ${approval.review_note}`}
            {approval.reviewed_at && ` · ${new Date(approval.reviewed_at).toLocaleString("tr-TR")}`}
          </div>
        </div>
      )}

      {/* Actions (sadece pending) */}
      {isPending && (
        <div style={{ padding: "14px 20px" }}>
          {showNote ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Red gerekçesi (opsiyonel)…"
                rows={2}
                style={{
                  width: "100%", borderRadius: 8, padding: "8px 12px",
                  fontSize: 13, resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handle("reject")}
                  disabled={busy}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: busy ? "wait" : "pointer",
                    background: "var(--red)", color: "#fff", border: "none", opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy ? "…" : "✕ Reddet"}
                </button>
                <button
                  onClick={() => { setShowNote(false); setNote(""); }}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13,
                    cursor: "pointer", background: "var(--bg-subtle)",
                    color: "var(--text-2)", border: "1px solid var(--line)",
                  }}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => handle("approve")}
                disabled={busy}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: busy ? "wait" : "pointer",
                  background: "var(--green)", color: "#fff", border: "none", opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "…" : "✓ Onayla"}
              </button>
              <button
                onClick={() => setShowNote(true)}
                disabled={busy}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", background: "#FEF2F2",
                  color: "var(--red)", border: "1px solid #FECACA",
                }}
              >
                ✕ Reddet
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<AgentApproval[]>([]);
  const [filter,    setFilter]    = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const r = await getAgentApprovals(filter === "all" ? undefined : filter);
      setApprovals(r.approvals);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function handleApprove(id: number, note?: string) {
    await approveAgentApproval(id, note);
    await load();
  }

  async function handleReject(id: number, note?: string) {
    await rejectAgentApproval(id, note);
    await load();
  }

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin → AI Agents</span>
            <span style={{ color: "var(--text-3)" }}>→</span>
            <span style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 500 }}>Onay Kuyruğu</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: "0 0 4px" }}>
            Onay Kuyruğu
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            {pendingCount > 0
              ? <><strong style={{ color: "var(--amber)" }}>{pendingCount} bekleyen</strong> onay talebi</>
              : "Bekleyen onay talebi yok"}
          </p>
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

      {/* Filtre */}
      <div style={{ display: "flex", gap: 4, background: "var(--bg-subtle)", padding: 4, borderRadius: 10, marginBottom: 20, width: "fit-content" }}>
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: filter === f ? 500 : 400,
            cursor: "pointer",
            background: filter === f ? "var(--bg-elevated)" : "transparent",
            color: filter === f ? "var(--text-1)" : "var(--text-3)",
            border: filter === f ? "1px solid var(--line)" : "none",
          }}>
            {f === "pending" ? "Bekleyenler" : f === "approved" ? "Onaylananlar" : f === "rejected" ? "Reddedilenler" : "Tümü"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-3)" }}>Yükleniyor…</div>
      ) : approvals.length === 0 ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 6px" }}>
            {filter === "pending" ? "Bekleyen onay yok" : "Kayıt bulunamadı"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            {filter === "pending" ? "Tüm ajanlar otomatik onay modunda çalışıyor." : "Farklı bir filtre deneyin."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {approvals.map((a) => (
            <ApprovalCard key={a.id} approval={a} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      )}
    </div>
  );
}
