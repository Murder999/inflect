"use client";
import { useEffect, useState } from "react";
import { analyzeApi, type AnalysisSummary } from "@/lib/api";
import { ArrowLeftRight, Trophy, ChevronUp, Loader2, X, Plus } from "lucide-react";
import ProfileAvatar from "@/components/ProfileAvatar";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ScoreBar({ value, risk }: { value: number; risk?: boolean }) {
  const color = risk
    ? (value < 25 ? "var(--green)" : value < 50 ? "var(--amber)" : "var(--red)")
    : (value >= 70 ? "var(--green)" : value >= 45 ? "var(--amber)" : "var(--red)");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, width: 28, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

const METRICS = [
  { key: "final_score",               label: "Final Skoru",       risk: false },
  { key: "fraud_score",               label: "Fraud Risk",        risk: true  },
  { key: "brand_fit_score",           label: "Brand Fit",         risk: false },
  { key: "engagement_rate",           label: "Etkileşim %",       risk: false, suffix: "%", isRaw: true },
  { key: "momentum_score",            label: "Momentum",          risk: false },
  { key: "roi_potential_score",       label: "ROI Potential",     risk: false },
  { key: "engagement_quality_score",  label: "Etkileşim Kalitesi",risk: false },
  { key: "reputation_risk_score",     label: "İtibar Riski",      risk: true  },
  { key: "followers",                 label: "Takipçi",           risk: false, isFmt: true },
];

const RADAR_KEYS = ["final_score","brand_fit_score","momentum_score","roi_potential_score","engagement_quality_score"];

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

const ACCENT_COLORS = ["var(--green)", "#6366F1", "#F59E0B", "#EC4899"];
const PLATFORM_SHORT: Record<string, string> = { instagram: "IG", youtube: "YT", tiktok: "TT" };

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
      if (selected.length >= 4) return;
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
    const best = risk
      ? vals.reduce((a, b) => a.v < b.v ? a : b)
      : vals.reduce((a, b) => a.v > b.v ? a : b);
    return best.id;
  };

  const radarData = RADAR_KEYS.map((key) => ({
    metric: METRICS.find((m) => m.key === key)?.label || key,
    ...Object.fromEntries(selectedDetails.map((d) => [d.username, (d as any)[key] || 0])),
  }));

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 10, color: "var(--text-3)", fontSize: 14 }}>
      <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Yükleniyor...
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.03em", color: "var(--text-1)" }}>
          Karşılaştırma Çalışma Alanı
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
          Analiz geçmişinden max 4 influencer seç, yan yana karşılaştır.
        </p>
      </div>

      {/* Selector card */}
      <div className="card" style={{ padding: "20px 22px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--text-1)" }}>
            Profil Seç
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)", marginLeft: 8 }}>
              {selected.length}/4 seçildi
            </span>
          </h3>
          {loadingD && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-3)" }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Yükleniyor...
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>Henüz analiz yok. Önce bir influencer analiz et.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {history.slice(0, 30).map((a) => {
              const isSelected = selected.includes(a.id);
              const isDisabled = !isSelected && selected.length >= 4;
              const selIdx     = selected.indexOf(a.id);
              const accentColor = selIdx >= 0 ? ACCENT_COLORS[selIdx] : null;
              return (
                <button
                  key={a.id}
                  onClick={() => !isDisabled && toggleSelect(a.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: isSelected ? 600 : 400,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    background: isSelected ? `${accentColor}18` : "var(--bg-subtle)",
                    color: isSelected ? accentColor! : isDisabled ? "var(--text-3)" : "var(--text-2)",
                    border: isSelected ? `1.5px solid ${accentColor}40` : "1px solid var(--line)",
                    opacity: isDisabled ? 0.45 : 1,
                    transition: "all 0.12s",
                  }}
                >
                  {isSelected && <span style={{ fontSize: 9, fontWeight: 700 }}>●</span>}
                  @{a.username}
                  <span style={{ fontSize: 10, opacity: 0.65 }}>
                    {PLATFORM_SHORT[a.platform] || a.platform.toUpperCase()}
                  </span>
                  {isSelected && <X size={11} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected chips */}
      {selectedDetails.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {selectedDetails.map((d, i) => (
            <div key={d.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
              borderRadius: 10, border: `1.5px solid ${ACCENT_COLORS[i]}40`,
              background: `${ACCENT_COLORS[i]}0A`,
            }}>
              <ProfileAvatar
                src={d.avatar || undefined}
                name={d.display_name || d.username}
                platform={d.platform as "instagram" | "tiktok" | "youtube"}
                size={32}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>@{d.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {PLATFORM_SHORT[d.platform]} · {fmt(d.followers)}
                </div>
              </div>
              <div style={{
                marginLeft: 8, fontSize: 20, fontWeight: 800,
                color: ACCENT_COLORS[i], letterSpacing: "-0.04em",
              }}>
                {d.final_score}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Radar chart */}
      {selectedDetails.length >= 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 16 }}>Radar Karşılaştırması</div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                {selectedDetails.map((d, i) => (
                  <Radar
                    key={d.id}
                    name={`@${d.username}`}
                    dataKey={d.username}
                    stroke={ACCENT_COLORS[i]}
                    fill={ACCENT_COLORS[i]}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)", border: "1px solid var(--line)",
                    borderRadius: 8, fontSize: 12, color: "var(--text-1)",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Winner summary */}
          <div className="card" style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 16 }}>
              <Trophy size={14} style={{ display: "inline", marginRight: 6, color: "var(--amber)" }} />
              Kategori Kazananları
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { key: "final_score",         label: "Final Skoru",    risk: false },
                { key: "brand_fit_score",      label: "Brand Fit",     risk: false },
                { key: "fraud_score",          label: "En Düşük Fraud",risk: true  },
                { key: "roi_potential_score",  label: "ROI Potential", risk: false },
                { key: "momentum_score",       label: "Momentum",      risk: false },
              ].map((m) => {
                const winnerId  = bestFor(m.key, m.risk);
                const winner    = selectedDetails.find((d) => d.id === winnerId);
                const winnerIdx = selectedDetails.indexOf(winner!);
                return (
                  <div key={m.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>{m.label}</span>
                    {winner ? (
                      <span style={{
                        fontSize: 12, fontWeight: 600, padding: "2px 10px",
                        borderRadius: 99, background: `${ACCENT_COLORS[winnerIdx]}18`,
                        color: ACCENT_COLORS[winnerIdx],
                      }}>
                        @{winner.username} · {(winner as any)[m.key]}
                      </span>
                    ) : <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Comparison table */}
      {selectedDetails.length >= 2 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Detaylı Karşılaştırma</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--line)" }}>
                  <th style={{ padding: "12px 22px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-3)", width: 180 }}>METRİK</th>
                  {selectedDetails.map((d, i) => (
                    <th key={d.id} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13 }}>
                      <div style={{ fontWeight: 700, color: ACCENT_COLORS[i] }}>@{d.username}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>
                        {PLATFORM_SHORT[d.platform]} · {d.category || "—"}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 99, fontWeight: 600,
                          background: d.final_score >= 70 ? "var(--green-bg)" : d.final_score >= 45 ? "var(--amber-bg)" : "var(--red-bg)",
                          color: d.final_score >= 70 ? "var(--green)" : d.final_score >= 45 ? "var(--amber)" : "var(--red)",
                        }}>
                          {d.decision}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => {
                  const best = bestFor(m.key, m.risk);
                  return (
                    <tr key={m.key} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px 22px", fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>
                        {m.label}
                      </td>
                      {selectedDetails.map((d, i) => {
                        const val    = (d as any)[m.key] || 0;
                        const isBest = d.id === best;
                        return (
                          <td key={d.id} style={{
                            padding: "12px 16px",
                            background: isBest ? `${ACCENT_COLORS[i]}08` : "transparent",
                            borderLeft: isBest ? `2px solid ${ACCENT_COLORS[i]}` : "2px solid transparent",
                          }}>
                            {m.isFmt ? (
                              <div>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>{fmt(val)}</span>
                                {isBest && <ChevronUp size={12} style={{ color: "var(--green)", display: "inline", marginLeft: 4 }} />}
                              </div>
                            ) : m.isRaw ? (
                              <div>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>{val.toFixed(1)}{m.suffix || ""}</span>
                                {isBest && <ChevronUp size={12} style={{ color: "var(--green)", display: "inline", marginLeft: 4 }} />}
                              </div>
                            ) : (
                              <ScoreBar value={val} risk={m.risk} />
                            )}
                            {isBest && <div style={{ fontSize: 10, color: ACCENT_COLORS[i], marginTop: 2, fontWeight: 600 }}>En İyi</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedDetails.length === 1 && (
        <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 14, padding: 32 }}>
          <Plus size={24} style={{ display: "block", margin: "0 auto 8px", opacity: 0.4 }} />
          En az 1 profil daha seç (toplam min. 2)
        </div>
      )}

      {selected.length === 0 && history.length > 0 && (
        <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
          <ArrowLeftRight size={32} style={{ color: "var(--text-3)", margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)", marginBottom: 6 }}>Karşılaştırma Modu</div>
          <div style={{ fontSize: 14, color: "var(--text-3)" }}>Yukarıdan 2–4 influencer seçerek karşılaştırmayı başlat.</div>
        </div>
      )}
    </div>
  );
}
