"use client";
import { useEffect, useState } from "react";
import { campaignsApi, type Campaign } from "@/lib/api";
import Link from "next/link";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Taslak",     color: "var(--text-3)",    bg: "var(--bg-subtle)" },
  active:    { label: "Aktif",      color: "var(--green)",     bg: "var(--green-bg)" },
  completed: { label: "Tamamlandı", color: "var(--brand-600)", bg: "var(--brand-light,#EEF2FF)" },
  archived:  { label: "Arşiv",      color: "var(--text-3)",    bg: "var(--bg-muted)" },
};

const GOAL_LABELS: Record<string, string> = {
  brand_awareness: "Marka Bilinirliği", sales: "Satış", engagement: "Etkileşim", product_launch: "Ürün Lansmanı",
};

type TabFilter = "all" | "active" | "draft" | "completed";

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

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>;

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Kampanyalar</h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>{campaigns.length} kampanya</p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary">+ Yeni Kampanya</Link>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Toplam", v: campaigns.length },
          { l: "Aktif",  v: campaigns.filter((c) => c.status === "active").length },
          { l: "Taslak", v: campaigns.filter((c) => c.status === "draft").length },
          { l: "Tamamlandı", v: campaigns.filter((c) => c.status === "completed").length },
        ].map((m) => (
          <div key={m.l} className="card" style={{ padding: "14px 18px" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{m.l}</div>
            <div style={{ fontSize: 24, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--text-1)" }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--bg-subtle)", padding: 4, borderRadius: 10, marginBottom: 20, width: "fit-content" }}>
        {(["all", "active", "draft", "completed"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: tab === t ? 500 : 400, cursor: "pointer",
            background: tab === t ? "var(--bg-elevated)" : "transparent",
            color: tab === t ? "var(--text-1)" : "var(--text-3)",
            border: tab === t ? "1px solid var(--line)" : "none",
          }}>
            {t === "all" ? "Tümü" : STATUS_CONFIG[t]?.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 14px" }}>◈</div>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 8px" }}>Henüz kampanya yok</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 18px" }}>İlk kampanyanı oluştur — influencer önerileri ve ROI tahmini otomatik hazırlanır.</p>
          <Link href="/campaigns/new" className="btn btn-primary">Kampanya Oluştur</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((c) => {
            const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
            const roi = c.roi_estimates;
            return (
              <div key={c.id} className="card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0, color: "var(--text-1)" }}>{c.name}</h3>
                      <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, fontWeight: 500, background: st.bg, color: st.color }}>{st.label}</span>
                      {c.brand && <span style={{ fontSize: 12, color: "var(--text-3)" }}>× {c.brand}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text-3)" }}>
                      {c.platform && <span>📱 {c.platform.charAt(0).toUpperCase() + c.platform.slice(1)}</span>}
                      {c.category && <span>🏷 {c.category}</span>}
                      {c.target_country && <span>🌍 {c.target_country}</span>}
                      {c.goal && <span>🎯 {GOAL_LABELS[c.goal] || c.goal}</span>}
                      {c.budget && <span>💰 ${c.budget.toLocaleString()}</span>}
                    </div>
                  </div>

                  {/* ROI mini */}
                  {roi && roi.influencer_count > 0 && (
                    <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                      {[
                        ["Influencer", roi.influencer_count],
                        ["Erişim", fmt(roi.total_reach)],
                        ["Gösterim", fmt(roi.total_impressions)],
                      ].map(([l, v]) => (
                        <div key={l} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>{l}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recommended influencers */}
                {c.recommended_influencers.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {c.recommended_influencers.slice(0, 4).map((inf) => (
                      <div key={inf.analysis_id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
                        background: "var(--bg-subtle)", borderRadius: 99, fontSize: 12 }}>
                        <span style={{ color: "var(--text-1)", fontWeight: 500 }}>@{inf.username}</span>
                        <span style={{ color: inf.final_score >= 70 ? "var(--green)" : inf.final_score >= 45 ? "var(--amber)" : "var(--red)",
                          fontWeight: 600, fontSize: 11 }}>{inf.final_score}</span>
                      </div>
                    ))}
                    {c.recommended_influencers.length > 4 && (
                      <div style={{ padding: "4px 10px", background: "var(--bg-subtle)", borderRadius: 99, fontSize: 12, color: "var(--text-3)" }}>
                        +{c.recommended_influencers.length - 4} daha
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: 14, display: "flex", gap: 8, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                  {c.status === "draft" && (
                    <button onClick={() => updateStatus(c.id, "active")} className="btn btn-primary btn-sm">Aktife Al</button>
                  )}
                  {c.status === "active" && (
                    <button onClick={() => updateStatus(c.id, "completed")} className="btn btn-secondary btn-sm">Tamamlandı İşaretle</button>
                  )}
                  <button onClick={() => deleteCampaign(c.id)} disabled={deleting === c.id}
                    style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                      background: "transparent", color: "var(--red)", border: "1px solid var(--line)", opacity: deleting === c.id ? 0.5 : 1 }}>
                    {deleting === c.id ? "..." : "Sil"}
                  </button>
                  <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)", alignSelf: "center" }}>
                    {new Date(c.created_at).toLocaleDateString("tr-TR")}
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
