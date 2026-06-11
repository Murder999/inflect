"use client";
import { useEffect, useState } from "react";
import { analyzeApi, type AnalysisSummary } from "@/lib/api";
import Link from "next/link";
import {
  BarChart2, Download, Search as SearchIcon, Filter,
  TrendingUp, AlertTriangle, CheckCircle, Users, Printer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function printReport(a: AnalysisSummary) {
  const w = window.open("", "_blank");
  if (!w) return;
  const platLabel  = a.platform === "instagram" ? "Instagram" : a.platform === "youtube" ? "YouTube" : "TikTok";
  const riskColor  = a.fraud_score < 25 ? "#16A34A" : a.fraud_score < 50 ? "#D97706" : "#DC2626";
  const scoreColor = a.final_score >= 70 ? "#16A34A" : a.final_score >= 45 ? "#D97706" : "#DC2626";
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Inflect Report — @${a.username}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.03em; }
  .meta { color: #666; font-size: 14px; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 24px 0; }
  .card { padding: 16px; border: 1px solid #e5e7eb; border-radius: 10px; text-align: center; }
  .label { font-size: 11px; color: #888; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .06em; }
  .value { font-size: 24px; font-weight: 700; letter-spacing: -0.04em; }
  .section { margin: 28px 0; }
  .section-title { font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 99px; font-size: 12px; font-weight: 600; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>Inflect Influencer Report</h1>
<div class="meta">@${a.username} · ${platLabel} · ${new Date(a.created_at).toLocaleDateString("tr-TR", { year:"numeric",month:"long",day:"numeric" })}</div>
<div class="grid">
  <div class="card"><div class="label">Final Skoru</div><div class="value" style="color:${scoreColor}">${a.final_score}</div></div>
  <div class="card"><div class="label">Fraud Risk</div><div class="value" style="color:${riskColor}">${a.fraud_score}</div></div>
  <div class="card"><div class="label">Takipçi</div><div class="value">${fmt(a.followers)}</div></div>
  <div class="card"><div class="label">Etkileşim</div><div class="value">${a.engagement_rate.toFixed(1)}%</div></div>
</div>
<div class="section"><div class="section-title">Karar</div><div class="badge" style="background:${scoreColor}22;color:${scoreColor}">${a.decision}</div></div>
<div class="section"><div class="section-title">Not</div><p style="font-size:13px;color:#555">Bu rapor Inflect AI Influencer Intelligence Platform tarafından oluşturulmuştur.</p></div>
<script>window.print(); window.onafterprint = () => window.close();</script>
</body></html>`);
  w.document.close();
}

const PLAT_SHORT: Record<string, string> = { instagram: "IG", youtube: "YT", tiktok: "TT" };

export default function ReportsPage() {
  const [items,   setItems]   = useState<AnalysisSummary[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [platFilter, setPlatFilter] = useState("all");

  useEffect(() => {
    analyzeApi.history(100, 0)
      .then((r) => { setItems(r.items); setTotal(r.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((a) => {
    const matchSearch = !search || a.username.toLowerCase().includes(search.toLowerCase());
    const matchPlat   = platFilter === "all" || a.platform === platFilter;
    return matchSearch && matchPlat;
  });

  // Analytics computations
  const avgFinal   = items.length ? Math.round(items.reduce((s, a) => s + a.final_score, 0)  / items.length) : 0;
  const avgFraud   = items.length ? Math.round(items.reduce((s, a) => s + a.fraud_score, 0)  / items.length) : 0;
  const highRisk   = items.filter((a) => a.fraud_score >= 50).length;
  const topScore   = items.length ? Math.max(...items.map((a) => a.final_score)) : 0;

  // Score distribution data for bar chart
  const scoreDistData = [
    { range: "0–20",  count: items.filter((a) => a.final_score < 20).length },
    { range: "20–40", count: items.filter((a) => a.final_score >= 20 && a.final_score < 40).length },
    { range: "40–60", count: items.filter((a) => a.final_score >= 40 && a.final_score < 60).length },
    { range: "60–80", count: items.filter((a) => a.final_score >= 60 && a.final_score < 80).length },
    { range: "80+",   count: items.filter((a) => a.final_score >= 80).length },
  ];

  // Trend by date (last 7 distinct days with data)
  const byDay = items.reduce<Record<string, number[]>>((acc, a) => {
    const day = new Date(a.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
    if (!acc[day]) acc[day] = [];
    acc[day].push(a.final_score);
    return acc;
  }, {});
  const trendData = Object.entries(byDay).slice(-7).map(([day, scores]) => ({
    day,
    avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    count: scores.length,
  }));

  const tooltipStyle = {
    contentStyle: {
      background: "var(--bg-elevated)", border: "1px solid var(--line)",
      borderRadius: 8, fontSize: 12, color: "var(--text-1)",
    },
  };

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
            Analiz Raporları
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
            {total} analiz raporu · tüm influencer değerlendirmeleri
          </p>
        </div>
        <Link href="/search" style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px",
          borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none",
          background: "var(--green)", color: "#fff",
        }}>
          + Yeni Analiz
        </Link>
      </div>

      {/* KPI row */}
      {items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { l: "Toplam Analiz", v: total,    icon: BarChart2,     color: "var(--brand-500)" },
            { l: "Ort. Final",    v: avgFinal, icon: TrendingUp,    color: "var(--green)" },
            { l: "Ort. Fraud",    v: avgFraud, icon: AlertTriangle, color: "var(--amber)" },
            { l: "Yüksek Risk",   v: highRisk, icon: CheckCircle,   color: "var(--red)" },
          ].map(({ l, v, icon: Icon, color }) => (
            <div key={l} className="card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={18} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.04em", lineHeight: 1 }}>{v}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {items.length >= 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 16 }}>Final Skoru Dağılımı</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scoreDistData} barSize={32}>
                <XAxis dataKey="range" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" name="Analiz" fill="var(--brand-500)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {trendData.length >= 2 && (
            <div className="card" style={{ padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 16 }}>Günlük Ortalama Skor Trendi</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="avg" name="Ort. Final" stroke="var(--green)" strokeWidth={2.5} dot={{ fill: "var(--green)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {items.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-elevated)", border: "1px solid var(--line)",
            borderRadius: 9, padding: "0 14px", height: 36,
          }}>
            <SearchIcon size={13} style={{ color: "var(--text-3)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kullanıcı adına göre ara..."
              style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--text-1)", width: 220 }}
            />
          </div>
          <div style={{ display: "flex", gap: 4, background: "var(--bg-elevated)", padding: 4, borderRadius: 8, border: "1px solid var(--line)" }}>
            {["all", "instagram", "youtube", "tiktok"].map((p) => (
              <button key={p} onClick={() => setPlatFilter(p)} style={{
                padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: platFilter === p ? 600 : 400,
                cursor: "pointer", transition: "all 0.12s",
                background: platFilter === p ? "var(--bg-subtle)" : "transparent",
                color: platFilter === p ? "var(--text-1)" : "var(--text-3)",
                border: platFilter === p ? "1px solid var(--line)" : "1px solid transparent",
              }}>
                {p === "all" ? "Tümü" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>
            {filtered.length} / {items.length} gösteriliyor
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <BarChart2 size={32} style={{ color: "var(--text-3)", margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
          <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 8px", color: "var(--text-1)" }}>Rapor yok</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 18px" }}>İlk analizini yaptığında raporlar burada görünecek.</p>
          <Link href="/search" style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px",
            borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none",
            background: "var(--green)", color: "#fff",
          }}>
            Analiz Başlat
          </Link>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 70px 80px 100px",
            gap: 8, padding: "10px 18px", borderBottom: "1px solid var(--line)",
            background: "var(--bg-subtle)",
          }}>
            {["Profil", "Takipçi", "Etk. %", "Final", "Fraud", "Tarih", ""].map((h) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
            ))}
          </div>

          {filtered.map((a, idx) => {
            const finalColor = a.final_score >= 70 ? "var(--green)" : a.final_score >= 45 ? "var(--amber)" : "var(--red)";
            const fraudColor = a.fraud_score < 25  ? "var(--green)" : a.fraud_score < 50  ? "var(--amber)" : "var(--red)";
            return (
              <div key={a.id} style={{
                display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 70px 80px 100px",
                gap: 8, padding: "11px 18px",
                borderBottom: idx < filtered.length - 1 ? "1px solid var(--line)" : "none",
                fontSize: 13, alignItems: "center",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, var(--brand-500), var(--green))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff",
                  }}>
                    {a.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-1)", fontSize: 13 }}>@{a.username}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{
                        padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: a.platform === "instagram" ? "#FDF2F8" : a.platform === "youtube" ? "#FFF5F5" : "#F0FFF4",
                        color: a.platform === "instagram" ? "#C13584" : a.platform === "youtube" ? "#FF0000" : "#010101",
                      }}>
                        {PLAT_SHORT[a.platform]}
                      </span>
                      {a.brand && `× ${a.brand}`}
                    </div>
                  </div>
                </div>

                <div style={{ color: "var(--text-2)", fontWeight: 500 }}>{fmt(a.followers)}</div>
                <div style={{ color: "var(--text-2)", fontWeight: 500 }}>{a.engagement_rate.toFixed(1)}%</div>

                <div>
                  <span style={{
                    padding: "3px 9px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                    background: `${finalColor}18`, color: finalColor,
                  }}>
                    {a.final_score}
                  </span>
                </div>

                <div>
                  <span style={{
                    padding: "3px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700,
                    background: `${fraudColor}18`, color: fraudColor,
                  }}>
                    {a.fraud_score}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {new Date(a.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </div>

                <div>
                  <button
                    onClick={() => printReport(a)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 7, fontSize: 11, cursor: "pointer",
                      background: "var(--bg-subtle)", border: "1px solid var(--line)",
                      color: "var(--text-2)", transition: "all 0.12s",
                    }}
                  >
                    <Printer size={11} /> PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
