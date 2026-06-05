"use client";
import { useState } from "react";
import { campaignsApi, type Campaign, type CampaignCreateBody } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PLATFORMS = ["", "instagram", "tiktok", "youtube"];
const GOALS = [
  { v: "brand_awareness", l: "Marka Bilinirliği" },
  { v: "sales",           l: "Satış" },
  { v: "engagement",      l: "Etkileşim" },
  { v: "product_launch",  l: "Ürün Lansmanı" },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [form, setForm] = useState<CampaignCreateBody>({
    name: "", brand: "", platform: "", budget: undefined,
    category: "", target_country: "", target_audience: "", goal: "brand_awareness", notes: "",
  });
  const [saving,   setSaving]   = useState(false);
  const [result,   setResult]   = useState<Campaign | null>(null);
  const [err,      setErr]      = useState("");

  const set = (k: keyof CampaignCreateBody) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    if (!form.name.trim()) { setErr("Kampanya adı zorunlu."); return; }
    setSaving(true); setErr("");
    try {
      const r = await campaignsApi.create({ ...form, budget: form.budget ? Number(form.budget) : undefined });
      setResult(r.campaign);
    } catch (e: any) { setErr(e.message || "Oluşturulamadı."); }
    finally { setSaving(false); }
  };

  if (result) {
    const roi = result.roi_estimates;
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Kampanya Oluşturuldu</h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>AI analiz geçmişinizden öneriler hazırladı.</p>
        </div>

        {/* ROI Summary */}
        {roi && roi.influencer_count > 0 && (
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 16px", color: "var(--text-1)" }}>Tahmini Kampanya Performansı</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 12 }}>
              {[
                ["Influencer", String(roi.influencer_count)],
                ["Toplam Erişim", fmt(roi.total_reach)],
                ["Toplam Gösterim", fmt(roi.total_impressions)],
                ["Tahmini Tıklama", fmt(roi.total_clicks)],
                ["Ort. Fraud Riski", String(roi.avg_fraud_score)],
                ["Ort. Brand Fit", String(roi.avg_brand_fit)],
                ["Önerilen Bütçe", `$${roi.suggested_budget}`],
                ["Influencer Başı", `$${roi.budget_per_influencer}`],
              ].map(([l, v]) => (
                <div key={l} style={{ padding: 12, background: "var(--bg-subtle)", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-1)" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic" }}>{roi.note}</div>
          </div>
        )}

        {/* Recommended Influencers */}
        {result.recommended_influencers.length > 0 && (
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 16px", color: "var(--text-1)" }}>
              AI Önerilen Influencer'lar
              <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400, marginLeft: 8 }}>
                Analiz geçmişinizden en uygun profiller
              </span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.recommended_influencers.map((inf) => (
                <div key={inf.analysis_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  background: "var(--bg-subtle)", borderRadius: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--green-bg)", color: "var(--brand-700)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                    {(inf.display_name || inf.username)[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>@{inf.username}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {fmt(inf.followers)} takipçi · %{inf.engagement_rate.toFixed(1)} etk.
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    {[
                      ["Final", inf.final_score, false],
                      ["Fraud", inf.fraud_score, true],
                      ["Brand", inf.brand_fit_score, false],
                    ].map(([l, v, risk]) => {
                      const n = Number(v);
                      const color = risk ? (n < 25 ? "var(--green)" : n < 50 ? "var(--amber)" : "var(--red)") : (n >= 70 ? "var(--green)" : n >= 45 ? "var(--amber)" : "var(--red)");
                      return (
                        <div key={String(l)} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: "var(--text-3)" }}>{l}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color }}>{v}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.recommended_influencers.length === 0 && (
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>
              Henüz analiz geçmişinizde bu filtrelere uygun profil bulunamadı. Influencer Ara sayfasından analiz yaptıkça kampanyaya eklenecek.
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/campaigns" className="btn btn-primary">Kampanyalara Git</Link>
          <Link href="/search" className="btn btn-secondary">Influencer Ara</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Link href="/campaigns" style={{ fontSize: 13, color: "var(--text-3)", textDecoration: "none" }}>← Kampanyalar</Link>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Yeni Kampanya</h1>
        <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Bilgileri gir — AI otomatik influencer önerisi ve ROI tahmini hazırlayacak.</p>
      </div>

      <div style={{ maxWidth: 720 }}>
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Kampanya Adı *</label>
                <input value={form.name} onChange={set("name")} placeholder="Yaz Koleksiyonu 2025"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Marka</label>
                <input value={form.brand} onChange={set("brand")} placeholder="Marka adı"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Platform</label>
                <select value={form.platform} onChange={set("platform")} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14 }}>
                  {PLATFORMS.map((p) => <option key={p} value={p}>{p ? p.charAt(0).toUpperCase() + p.slice(1) : "Tümü"}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Kampanya Hedefi</label>
                <select value={form.goal} onChange={set("goal")} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontSize: 14 }}>
                  {GOALS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Bütçe (USD)</label>
                <input type="number" value={form.budget || ""} onChange={set("budget")} placeholder="5000"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Kategori</label>
                <input value={form.category} onChange={set("category")} placeholder="Moda, teknoloji, güzellik..."
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Hedef Ülke</label>
                <input value={form.target_country} onChange={set("target_country")} placeholder="Türkiye"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Hedef Kitle</label>
              <input value={form.target_audience} onChange={set("target_audience")} placeholder="18-35 yaş, kadın, şehirli"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Notlar</label>
              <textarea value={form.notes} onChange={set("notes") as any} placeholder="Kampanya notları..."
                rows={3} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, resize: "vertical" }} />
            </div>

            {err && <div style={{ color: "var(--red)", fontSize: 13 }}>{err}</div>}

            <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
              <button onClick={handleCreate} disabled={saving} className="btn btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? "Oluşturuluyor..." : "Kampanya Oluştur + AI Önerisi Al"}
              </button>
              <Link href="/campaigns" className="btn btn-secondary">İptal</Link>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14, padding: "12px 16px", background: "var(--blue-bg)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: 8, fontSize: 12, color: "var(--blue)", lineHeight: 1.6 }}>
          ℹ️ AI önerileri, analiz geçmişinizdeki profillerden otomatik seçilir. Daha fazla analiz yaptıkça öneriler zenginleşir.
        </div>
      </div>
    </div>
  );
}
