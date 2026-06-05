"use client";
import { useEffect, useState } from "react";
import { analyzeApi, type AnalysisSummary } from "@/lib/api";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ScoreBar({ value, risk }: { value: number; risk?: boolean }) {
  const color = risk ? (value < 25 ? "var(--green)" : value < 50 ? "var(--amber)" : "var(--red)") : (value >= 70 ? "var(--green)" : value >= 45 ? "var(--amber)" : "var(--red)");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "var(--bg-muted)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color, width: 32, textAlign: "right" }}>{value}</span>
    </div>
  );
}

const METRICS = [
  { key: "final_score",    label: "Final Risk & Value", risk: false },
  { key: "fraud_score",    label: "Fraud Risk",          risk: true  },
  { key: "brand_fit_score",label: "Brand Fit",           risk: false },
  { key: "engagement_rate",label: "Etkileşim %",         risk: false, suffix: "%" },
  { key: "momentum_score", label: "Momentum",            risk: false },
  { key: "roi_potential_score", label: "ROI Potential",  risk: false },
  { key: "engagement_quality_score", label: "Eng. Quality", risk: false },
  { key: "reputation_risk_score",    label: "Reputation Risk", risk: true },
  { key: "followers",      label: "Takipçi",             risk: false, fmt: true },
];

interface DetailedAnalysis {
  id: number;
  username: string;
  platform: string;
  display_name: string;
  avatar: string;
  category: string;
  followers: number;
  engagement_rate: number;
  final_score: number;
  fraud_score: number;
  brand_fit_score: number;
  momentum_score: number;
  roi_potential_score: number;
  engagement_quality_score: number;
  reputation_risk_score: number;
  decision: string;
}

export default function ComparePage() {
  const [history,   setHistory]   = useState<AnalysisSummary[]>([]);
  const [selected,  setSelected]  = useState<number[]>([]);
  const [details,   setDetails]   = useState<Record<number, DetailedAnalysis>>({});
  const [loading,   setLoading]   = useState(true);
  const [loadingD,  setLoadingD]  = useState(false);

  useEffect(() => {
    analyzeApi.history(100, 0).then((r) => setHistory(r.items)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleSelect = async (id: number) => {
    if (selected.includes(id)) {
      setSelected((p) => p.filter((x) => x !== id));
    } else {
      if (selected.length >= 4) return; // max 4
      setSelected((p) => [...p, id]);
      if (!details[id]) {
        setLoadingD(true);
        try {
          const d = await analyzeApi.get(id);
          const p = d.profile;
          const s = d.scores;
          setDetails((prev) => ({
            ...prev,
            [id]: {
              id, username: p.username, platform: p.platform,
              display_name: p.display_name, avatar: p.avatar, category: p.category,
              followers: p.followers, engagement_rate: p.engagement_rate,
              final_score: s.final_score, fraud_score: s.fraud_score,
              brand_fit_score: s.brand_fit, momentum_score: s.momentum,
              roi_potential_score: s.roi_potential, engagement_quality_score: s.engagement_quality,
              reputation_risk_score: s.reputation_risk, decision: s.decision,
            },
          }));
        } catch { }
        finally { setLoadingD(false); }
      }
    }
  };

  const selectedDetails = selected.map((id) => details[id]).filter(Boolean);
  const bestFor = (metric: string, risk: boolean) => {
    if (selectedDetails.length < 2) return null;
    const vals = selectedDetails.map((d) => ({ id: d.id, v: (d as any)[metric] || 0 }));
    const best = risk ? vals.reduce((a, b) => a.v < b.v ? a : b) : vals.reduce((a, b) => a.v > b.v ? a : b);
    return best.id;
  };

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Karşılaştırma Modu</h1>
        <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Analiz geçmişinden max 4 influencer seç, yan yana karşılaştır.</p>
      </div>

      {/* Selection */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 12px", color: "var(--text-1)" }}>
          Karşılaştırılacakları Seç ({selected.length}/4)
        </h3>
        {history.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>Henüz analiz yok.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {history.slice(0, 30).map((a) => {
              const isSelected = selected.includes(a.id);
              const disabled   = !isSelected && selected.length >= 4;
              return (
                <button key={a.id} onClick={() => !disabled && toggleSelect(a.id)} style={{
                  padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: isSelected ? 500 : 400, cursor: disabled ? "not-allowed" : "pointer",
                  background: isSelected ? "var(--brand-600)" : "var(--bg-subtle)",
                  color: isSelected ? "#fff" : disabled ? "var(--text-3)" : "var(--text-2)",
                  border: "1px solid var(--line)", opacity: disabled ? 0.5 : 1,
                }}>
                  {isSelected ? "✓ " : ""}@{a.username}
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>
                    {a.platform === "instagram" ? "IG" : a.platform === "youtube" ? "YT" : "TT"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {loadingD && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>Detaylar yükleniyor...</div>}
      </div>

      {/* Comparison Table */}
      {selectedDetails.length >= 2 && (
        <div className="card" style={{ padding: 20, overflowX: "auto" }}>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 16px", color: "var(--text-1)" }}>Karşılaştırma</h3>

          {/* Headers */}
          <div style={{ display: "grid", gridTemplateColumns: `200px repeat(${selectedDetails.length}, 1fr)`, gap: 0 }}>
            <div />
            {selectedDetails.map((d) => (
              <div key={d.id} style={{ textAlign: "center", padding: "12px 8px", borderBottom: "2px solid var(--line)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>@{d.username}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                  {d.platform === "instagram" ? "IG" : d.platform === "youtube" ? "YT" : "TT"} · {d.category || "—"}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 500,
                    background: d.final_score >= 70 ? "var(--green-bg)" : d.final_score >= 45 ? "var(--amber-bg)" : "var(--red-bg)",
                    color: d.final_score >= 70 ? "var(--green)" : d.final_score >= 45 ? "var(--amber)" : "var(--red)" }}>
                    {d.decision}
                  </span>
                </div>
              </div>
            ))}

            {/* Rows */}
            {METRICS.map((m) => {
              const best = bestFor(m.key, m.risk);
              return (
                <>
                  <div key={`label-${m.key}`} style={{ padding: "12px 8px", fontSize: 12, fontWeight: 500, color: "var(--text-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
                    {m.label}
                  </div>
                  {selectedDetails.map((d) => {
                    const val = (d as any)[m.key] || 0;
                    const isBest = d.id === best;
                    const isNum  = m.key === "followers" || m.key === "engagement_rate";
                    return (
                      <div key={`${m.key}-${d.id}`} style={{
                        padding: "12px 16px", borderBottom: "1px solid var(--line)",
                        background: isBest ? "rgba(34,197,94,0.04)" : "transparent",
                        borderLeft: isBest ? "2px solid var(--green)" : "2px solid transparent",
                      }}>
                        {isNum ? (
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
                            {m.fmt ? fmt(val) : `${val.toFixed(1)}${m.suffix || ""}`}
                          </div>
                        ) : (
                          <ScoreBar value={val} risk={m.risk} />
                        )}
                        {isBest && <div style={{ fontSize: 10, color: "var(--green)", marginTop: 2 }}>En İyi</div>}
                      </div>
                    );
                  })}
                </>
              );
            })}
          </div>
        </div>
      )}

      {selectedDetails.length === 1 && (
        <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 14, padding: 24 }}>
          En az 1 profil daha seç (toplam min. 2)
        </div>
      )}
    </div>
  );
}
