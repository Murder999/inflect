"use client";
import { useEffect, useState } from "react";
import { analyzeApi, type AnalysisSummary } from "@/lib/api";
import Link from "next/link";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function printReport(a: AnalysisSummary) {
  const w = window.open("", "_blank");
  if (!w) return;
  const platLabel = a.platform === "instagram" ? "Instagram" : a.platform === "youtube" ? "YouTube" : "TikTok";
  const riskColor = a.fraud_score < 25 ? "#16A34A" : a.fraud_score < 50 ? "#D97706" : "#DC2626";
  const scoreColor = a.final_score >= 70 ? "#16A34A" : a.final_score >= 45 ? "#D97706" : "#DC2626";
  w.document.write(`
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Inflect Report — @${a.username}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 28px; font-weight: 300; margin-bottom: 4px; }
  .meta { color: #666; font-size: 14px; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 24px 0; }
  .card { padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center; }
  .label { font-size: 11px; color: #888; margin-bottom: 4px; }
  .value { font-size: 22px; font-weight: 600; }
  .section { margin: 28px 0; }
  .section-title { font-size: 13px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 500; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>Inflect Influencer Report</h1>
<div class="meta">@${a.username} · ${platLabel} · ${new Date(a.created_at).toLocaleDateString("tr-TR", { year:"numeric",month:"long",day:"numeric" })}</div>

<div class="grid">
  <div class="card"><div class="label">Final Risk & Value</div><div class="value" style="color:${scoreColor}">${a.final_score}</div></div>
  <div class="card"><div class="label">Fraud Risk</div><div class="value" style="color:${riskColor}">${a.fraud_score}</div></div>
  <div class="card"><div class="label">Takipçi</div><div class="value">${fmt(a.followers)}</div></div>
  <div class="card"><div class="label">Etkileşim</div><div class="value">${a.engagement_rate.toFixed(1)}%</div></div>
</div>

<div class="section">
  <div class="section-title">Karar</div>
  <div class="badge" style="background:${scoreColor}22;color:${scoreColor}">${a.decision}</div>
</div>

<div class="section">
  <div class="section-title">Not</div>
  <p style="font-size:13px;color:#555">Bu rapor Inflect AI Influencer Intelligence Platform tarafından oluşturulmuştur. 
  Tahminler analiz anındaki gerçek platform verilerine dayanır. Platform demografisi ve fraud örnekleme verileri 
  için ek kaynak gerekebilir.</p>
</div>

<script>window.print(); window.onafterprint = () => window.close();</script>
</body></html>`);
  w.document.close();
}

export default function ReportsPage() {
  const [items,   setItems]   = useState<AnalysisSummary[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    analyzeApi.history(100, 0).then((r) => { setItems(r.items); setTotal(r.total); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((a) => !search || a.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Raporlar</h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Analiz geçmişi ({total})</p>
        </div>
        <Link href="/search" className="btn btn-primary">+ Yeni Analiz</Link>
      </div>

      {/* Search */}
      {items.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Kullanıcı adına göre ara..."
            style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, width: 280 }} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 14px" }}>◻</div>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 8px" }}>Rapor yok</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 18px" }}>İlk analizini yaptığında raporlar burada görünecek.</p>
          <Link href="/search" className="btn btn-primary">Analiz Başlat</Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 70px 80px 110px",
            gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>
            {["Profil", "Takipçi", "Etk.%", "Final", "Fraud", "Tarih", ""].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 500, color: "var(--text-3)" }}>{h}</div>
            ))}
          </div>
          {filtered.map((a) => (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 70px 80px 110px",
              gap: 8, padding: "11px 16px", borderBottom: "1px solid var(--line)", fontSize: 13, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`badge badge-${a.platform === "instagram" ? "ig" : a.platform === "youtube" ? "yt" : "tt"}`} style={{ fontSize: 10 }}>
                  {a.platform === "instagram" ? "IG" : a.platform === "youtube" ? "YT" : "TT"}
                </span>
                <span style={{ fontWeight: 500, color: "var(--text-1)" }}>@{a.username}</span>
                {a.brand && <span style={{ fontSize: 11, color: "var(--text-3)" }}>× {a.brand}</span>}
              </div>
              <div style={{ color: "var(--text-2)" }}>{fmt(a.followers)}</div>
              <div style={{ color: "var(--text-2)" }}>{a.engagement_rate.toFixed(1)}%</div>
              <div>
                <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 12, fontWeight: 500,
                  background: a.final_score >= 70 ? "var(--green-bg)" : a.final_score >= 45 ? "var(--amber-bg)" : "var(--red-bg)",
                  color: a.final_score >= 70 ? "var(--green)" : a.final_score >= 45 ? "var(--amber)" : "var(--red)" }}>
                  {a.final_score}
                </span>
              </div>
              <div>
                <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11,
                  background: a.fraud_score < 25 ? "var(--green-bg)" : a.fraud_score < 50 ? "var(--amber-bg)" : "var(--red-bg)",
                  color: a.fraud_score < 25 ? "var(--green)" : a.fraud_score < 50 ? "var(--amber)" : "var(--red)" }}>
                  {a.fraud_score}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                {new Date(a.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
              </div>
              <div>
                <button onClick={() => printReport(a)} style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                  background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)",
                }}>🖨 PDF</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
