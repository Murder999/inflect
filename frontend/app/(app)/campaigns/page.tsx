"use client";
import { useEffect, useState } from "react";
import { campaignsApi, type Campaign } from "@/lib/api";
import Link from "next/link";
import {
  Zap, TrendingUp, Users, DollarSign, BarChart2, Circle,
  Plus, Trash2, CheckCircle, Play, Calendar, Globe, Tag,
  Target, ArrowUpRight,
} from "lucide-react";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:     { label: "Taslak",      color: "var(--text-3)",    bg: "var(--bg-subtle)", dot: "#64748B" },
  active:    { label: "Aktif",       color: "var(--green)",     bg: "var(--green-bg)",  dot: "#10B981" },
  completed: { label: "Tamamlandı",  color: "var(--brand-600)", bg: "var(--brand-light,#EEF2FF)", dot: "#6366F1" },
  archived:  { label: "Arşiv",       color: "var(--text-3)",    bg: "var(--bg-muted)",  dot: "#475569" },
};

const GOAL_LABELS: Record<string, string> = {
  brand_awareness: "Marka Bilinirliği", sales: "Satış",
  engagement: "Etkileşim", product_launch: "Ürün Lansmanı",
};

type TabFilter = "all" | "active" | "draft" | "completed";

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color, flexShrink: 0,
    }} />
  );
}

function KpiCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ComponentType<{ size?: number; color?: string }>; color: string;
}) {
  return (
    <div className="card" style={{ padding: "20px 22px", display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label}
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.04em", lineHeight: 1 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<TabFilter>("all");
  const [deleting,  setDeleting]  = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const r = await campaignsApi.list(); setCampaigns(r.items); }
    catch { }
    finally { setLoading(false); }
  }

  const updateStatus = async (id: number, status: string) => {
    try { await campaignsApi.update(id, { status }); await load(); } catch { }
  };

  const deleteCampaign = async (id: number) => {
    if (!confirm("Kampanyayı silmek istediğinizden emin misiniz?")) return;
    setDeleting(id);
    try { await campaignsApi.delete(id); await load(); } catch { }
    finally { setDeleting(null); }
  };

  const filtered = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);

  const totalReach   = campaigns.reduce((s, c) => s + (c.roi_estimates?.total_reach || 0), 0);
  const totalBudget  = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const activeCount  = campaigns.filter((c) => c.status === "active").length;
  const influencerCount = campaigns.reduce((s, c) => s + (c.roi_estimates?.influencer_count || 0), 0);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text-3)", fontSize: 14 }}>
      Yükleniyor...
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.03em", color: "var(--text-1)" }}>
            Kampanya Merkezi
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
            {campaigns.length} kampanya · {activeCount} aktif şu anda
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/campaigns/simulate" style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px",
            borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none",
            background: "linear-gradient(135deg, var(--green), #34D399)",
            color: "#fff", boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
          }}>
            <Zap size={14} />
            Simülasyon Başlat
          </Link>
          <Link href="/campaigns/new" style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px",
            borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none",
            background: "var(--bg-elevated)", color: "var(--text-1)", border: "1px solid var(--line)",
          }}>
            <Plus size={14} />
            Yeni Kampanya
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        <KpiCard label="Toplam Kampanya" value={campaigns.length} icon={Zap}       color="var(--brand-500)" />
        <KpiCard label="Aktif"           value={activeCount}      icon={Play}      color="var(--green)" />
        <KpiCard label="Toplam Erişim"   value={fmt(totalReach)}  icon={TrendingUp} color="#8B5CF6" />
        <KpiCard label="Toplam Bütçe"    value={totalBudget > 0 ? `$${fmt(totalBudget)}` : "—"} icon={DollarSign} color="var(--amber)" />
      </div>

      {/* Tab filters */}
      <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", padding: 4, borderRadius: 10, marginBottom: 20, width: "fit-content", border: "1px solid var(--line)" }}>
        {([
          { key: "all",       label: `Tümü (${campaigns.length})` },
          { key: "active",    label: "Aktif" },
          { key: "draft",     label: "Taslak" },
          { key: "completed", label: "Tamamlandı" },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "6px 16px", borderRadius: 7, fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
            cursor: "pointer", transition: "all 0.12s",
            background: tab === t.key ? "var(--bg-subtle)" : "transparent",
            color: tab === t.key ? "var(--text-1)" : "var(--text-3)",
            border: tab === t.key ? "1px solid var(--line)" : "1px solid transparent",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "64px 32px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Zap size={22} style={{ color: "var(--text-3)" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: "var(--text-1)" }}>Kampanya yok</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 20px" }}>
            İlk kampanyanı oluştur — influencer önerileri ve ROI tahmini otomatik hazırlanır.
          </p>
          <Link href="/campaigns/new" style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px",
            borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none",
            background: "var(--green)", color: "#fff",
          }}>
            <Plus size={14} />
            Kampanya Oluştur
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((c) => {
            const st  = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
            const roi = c.roi_estimates;
            const budgetPct = c.budget && roi?.total_reach
              ? Math.min((roi.total_reach / 1_000_000) * 100, 100)
              : 0;

            return (
              <div key={c.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Top stripe */}
                <div style={{
                  height: 3,
                  background: c.status === "active"
                    ? "linear-gradient(90deg, var(--green), #34D399)"
                    : c.status === "completed"
                    ? "linear-gradient(90deg, var(--brand-500), var(--brand-700))"
                    : "var(--line)",
                }} />

                <div style={{ padding: "18px 22px" }}>
                  {/* Row 1: Title + status + actions */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "var(--text-1)", letterSpacing: "-0.01em" }}>
                          {c.name}
                        </h3>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 11, padding: "3px 9px", borderRadius: 99, fontWeight: 600,
                          background: st.bg, color: st.color,
                        }}>
                          <StatusDot color={st.dot} />
                          {st.label}
                        </span>
                        {c.brand && (
                          <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>
                            × {c.brand}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-3)" }}>
                        {c.platform && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Globe size={11} /> {c.platform.charAt(0).toUpperCase() + c.platform.slice(1)}
                          </span>
                        )}
                        {c.category && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Tag size={11} /> {c.category}
                          </span>
                        )}
                        {c.goal && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Target size={11} /> {GOAL_LABELS[c.goal] || c.goal}
                          </span>
                        )}
                        {c.budget && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <DollarSign size={11} /> ${c.budget.toLocaleString()}
                          </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={11} /> {new Date(c.created_at).toLocaleDateString("tr-TR")}
                        </span>
                      </div>
                    </div>

                    {/* ROI metrics */}
                    {roi && roi.influencer_count > 0 && (
                      <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                        {[
                          { l: "Influencer", v: roi.influencer_count },
                          { l: "Erişim",     v: fmt(roi.total_reach) },
                          { l: "Gösterim",   v: fmt(roi.total_impressions) },
                        ].map(({ l, v }) => (
                          <div key={l} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Budget progress */}
                  {c.budget && budgetPct > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)", marginBottom: 5 }}>
                        <span>Erişim İlerlemesi</span>
                        <span>{budgetPct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 4, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${budgetPct}%`, borderRadius: 99, background: "linear-gradient(90deg, var(--green), #34D399)", transition: "width 0.3s" }} />
                      </div>
                    </div>
                  )}

                  {/* Recommended influencers */}
                  {c.recommended_influencers.length > 0 && (
                    <div style={{ marginBottom: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {c.recommended_influencers.slice(0, 5).map((inf) => (
                        <span key={inf.analysis_id} style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 10px", borderRadius: 99, fontSize: 12,
                          background: "var(--bg-subtle)", border: "1px solid var(--line)",
                        }}>
                          <span style={{ color: "var(--text-1)", fontWeight: 500 }}>@{inf.username}</span>
                          <span style={{
                            fontWeight: 700, fontSize: 11,
                            color: inf.final_score >= 70 ? "var(--green)" : inf.final_score >= 45 ? "var(--amber)" : "var(--red)",
                          }}>
                            {inf.final_score}
                          </span>
                        </span>
                      ))}
                      {c.recommended_influencers.length > 5 && (
                        <span style={{ padding: "3px 10px", background: "var(--bg-subtle)", borderRadius: 99, fontSize: 12, color: "var(--text-3)", border: "1px solid var(--line)" }}>
                          +{c.recommended_influencers.length - 5} daha
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                    {c.status === "draft" && (
                      <button onClick={() => updateStatus(c.id, "active")} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        background: "var(--green)", color: "#fff", border: "none",
                      }}>
                        <Play size={11} /> Aktife Al
                      </button>
                    )}
                    {c.status === "active" && (
                      <button onClick={() => updateStatus(c.id, "completed")} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        background: "var(--bg-subtle)", color: "var(--text-2)", border: "1px solid var(--line)",
                      }}>
                        <CheckCircle size={11} /> Tamamlandı
                      </button>
                    )}
                    <button
                      onClick={() => deleteCampaign(c.id)}
                      disabled={deleting === c.id}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                        background: "transparent", color: "var(--red)", border: "1px solid var(--line)",
                        opacity: deleting === c.id ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={11} />
                      {deleting === c.id ? "..." : "Sil"}
                    </button>
                    <Link href={`/campaigns/${c.id}`} style={{
                      marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 12, color: "var(--text-3)", textDecoration: "none",
                    }}>
                      Detaylar <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
