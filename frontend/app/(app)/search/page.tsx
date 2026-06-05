"use client";
import { useState, useEffect } from "react";
import { analyzeApi, discoverApi, watchlistApi, type AnalyzeResult, type DiscoveryCard } from "@/lib/api";
import ProfileAvatar from "@/components/ProfileAvatar";

function Ring({ s, size = 72 }: { s: number; size?: number }) {
  const c = s >= 70 ? "var(--green)" : s >= 45 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: `3px solid ${c}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `${c}12`, fontSize: size * 0.27, fontWeight: 600, color: c, flexShrink: 0 }}>{s}</div>
  );
}

function ScoreCard({ label, value, reasons, risk }: { label: string; value: number; reasons: string[]; risk?: boolean }) {
  const color = risk
    ? (value < 25 ? "var(--green)" : value < 50 ? "var(--amber)" : "var(--red)")
    : (value >= 70 ? "var(--green)" : value >= 45 ? "var(--amber)" : "var(--red)");
  const badge = risk
    ? (value < 25 ? "Düşük" : value < 50 ? "Orta" : "Yüksek")
    : (value >= 70 ? "Güçlü" : value >= 45 ? "Orta" : "Zayıf");
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>{label}</span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, fontWeight: 500, background: `${color}18`, color }}>{badge}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color, marginBottom: 6 }}>{value}</div>
      <div className="progress-track" style={{ marginBottom: 8 }}>
        <div className="progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
      {reasons.slice(0, 2).map((r, i) => (
        <div key={i} style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, marginBottom: 2 }}>• {r}</div>
      ))}
    </div>
  );
}

function DataNA({ label }: { label: string }) {
  return (
    <div style={{ padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>
        Veri sağlayıcı bağlı değil — platform API erişimi gerekli
      </div>
    </div>
  );
}

function ContentThumb({ src, title }: { src: string; title: string }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center",
        justifyContent: "center", color: "var(--text-3)", fontSize: 11,
        background: "var(--bg-subtle)" }}>
        Görsel yok
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={title}
      referrerPolicy="no-referrer-when-downgrade"
      onError={() => setErrored(true)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PLATS = [
  { v: "instagram", l: "Instagram" },
  { v: "tiktok",    l: "TikTok" },
  { v: "youtube",   l: "YouTube" },
];

type Tab = "overview" | "fraud" | "audience" | "roi" | "similar";

export default function SearchPage() {
  const [un,      setUn]      = useState("");
  const [plat,    setPlat]    = useState("instagram");
  const [brand,   setBrand]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<AnalyzeResult | null>(null);
  const [err,     setErr]     = useState("");
  const [tab,     setTab]     = useState<Tab>("overview");

  const [watchAdding,  setWatchAdding]  = useState(false);
  const [watchAdded,   setWatchAdded]   = useState(false);
  const [similar,      setSimilar]      = useState<DiscoveryCard[]>([]);
  const [loadSimilar,  setLoadSimilar]  = useState(false);

  // Load similar when tab switches
  useEffect(() => {
    if (tab === "similar" && result && similar.length === 0) {
      setLoadSimilar(true);
      discoverApi.similar(result.analysis_id)
        .then((r) => setSimilar(r.items))
        .catch(() => {})
        .finally(() => setLoadSimilar(false));
    }
  }, [tab, result]);

  async function run() {
    if (!un.trim()) { setErr("Kullanıcı adı girin."); return; }
    setLoading(true); setErr(""); setResult(null); setTab("overview"); setWatchAdded(false); setSimilar([]);
    try {
      const d = await analyzeApi.analyze({ username: un.trim(), platform: plat, brand: brand || undefined });
      setResult(d);
    } catch (e: any) { setErr(e.message || "Analiz başarısız."); }
    finally { setLoading(false); }
  }

  const addToWatchlist = async () => {
    if (!result) return;
    setWatchAdding(true);
    try {
      await watchlistApi.add(result.analysis_id);
      setWatchAdded(true);
    } catch { setWatchAdded(true); } // already in list = fine
    finally { setWatchAdding(false); }
  };

  const p = result?.profile;
  const s = result?.scores;
  const r = result?.report;

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview",  label: "Genel Skorlar" },
    { key: "fraud",     label: "Fraud Intelligence" },
    { key: "audience",  label: "Kitle Analizi" },
    { key: "roi",       label: "ROI & Bütçe" },
    { key: "similar",   label: "Benzer Profiller" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Influencer Ara</h1>
        <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Platform + kullanıcı adı ile gerçek veri analizi.</p>
      </div>

      {/* Search Form */}
      <div className="card-raised" style={{ padding: 22, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {PLATS.map((pl) => (
              <button key={pl.v} onClick={() => setPlat(pl.v)} style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: plat === pl.v ? "2px solid var(--brand-500)" : "1px solid var(--line-strong)",
                background: plat === pl.v ? "var(--green-bg)" : "var(--bg-elevated)",
                color: plat === pl.v ? "var(--brand-600)" : "var(--text-2)", cursor: "pointer",
              }}>{pl.l}</button>
            ))}
          </div>
          <input value={un} onChange={(e) => setUn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Kullanıcı adı veya profil URL..."
            style={{ flex: "2 1 180px", padding: "10px 16px", borderRadius: 8, fontSize: 14 }} />
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marka adı (opsiyonel)"
            style={{ flex: "1 1 130px", padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
          <button onClick={run} disabled={loading} className="btn btn-primary" style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? "Analiz ediliyor..." : "Analiz Et"}
          </button>
        </div>
      </div>

      {err && (
        <div style={{ background: "var(--red-bg)", border: "1px solid #FECACA", borderRadius: 8,
          padding: "12px 16px", fontSize: 14, color: "var(--red)", marginBottom: 16 }}>{err}</div>
      )}
      {loading && (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>Gerçek veriler çekiliyor, lütfen bekleyin...</div>
        </div>
      )}

      {result && p && s && r && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Profile Header */}
          <div className="card-raised" style={{ padding: 22, display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <ProfileAvatar src={p.avatar} profileImageUrl={p.profile_image_url} name={p.display_name || p.username} size={68} platform={p.platform} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <h2 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "var(--text-1)" }}>{p.display_name}</h2>
                <span className={`badge badge-${p.platform === "instagram" ? "ig" : p.platform === "youtube" ? "yt" : "tt"}`}>{p.platform_label}</span>
                <span style={{ fontSize: 13, color: "var(--text-3)" }}>@{p.username}</span>
              </div>
              {p.bio && <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 12px", lineHeight: 1.5 }}>{p.bio.slice(0, 200)}</p>}
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                {[
                  ["Takipçi",  fmt(p.followers)],
                  ["Etkileşim", `%${p.engagement_rate.toFixed(1)}`],
                  ["Ort. Görüntülenme", fmt(p.avg_views)],
                  ["Ort. Beğeni", fmt(p.avg_likes)],
                  ["Ort. Yorum", fmt(p.avg_comments)],
                  ["Kategori", p.category || "—"],
                  ["Ülke", p.country || "—"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Ring s={s.final_score} size={72} />
              <div style={{ fontSize: 11, fontWeight: 500, textAlign: "center",
                color: s.final_score >= 70 ? "var(--green)" : s.final_score >= 45 ? "var(--amber)" : "var(--red)" }}>
                {s.decision}
              </div>
              {/* Watchlist button */}
              <button onClick={addToWatchlist} disabled={watchAdding || watchAdded} style={{
                marginTop: 4, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: watchAdded ? "var(--green-bg)" : "var(--bg-subtle)",
                color: watchAdded ? "var(--green)" : "var(--text-2)", border: "1px solid var(--line)",
              }}>{watchAdded ? "✓ İzlemeye Alındı" : watchAdding ? "..." : "☆ İzlemeye Al"}</button>
            </div>
          </div>

          {/* AI Executive Summary */}
          <div className="card" style={{ padding: 20, borderLeft: "3px solid var(--brand-500)" }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, margin: "0 0 8px", color: "var(--brand-600)",
              textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Executive Summary</h3>
            <p style={{ fontSize: 14, color: "var(--text-1)", lineHeight: 1.75, margin: 0 }}>{r.executive_summary || r.summary}</p>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 3, background: "var(--bg-subtle)", padding: 4, borderRadius: 10 }}>
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} style={{
                flex: 1, padding: "8px 4px", borderRadius: 7, fontSize: 12, fontWeight: tab === key ? 500 : 400,
                background: tab === key ? "var(--bg-elevated)" : "transparent",
                color: tab === key ? "var(--text-1)" : "var(--text-3)",
                border: tab === key ? "1px solid var(--line)" : "none", cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>

          {/* ── TAB: Overview ── */}
          {tab === "overview" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
                <ScoreCard label="Audience Authenticity"  value={s.authenticity}       reasons={s.authenticity_reasons || []} />
                <ScoreCard label="Fraud Risk"             value={s.fraud_score}        reasons={s.fraud_reasons || []} risk />
                <ScoreCard label="Brand Fit"              value={s.brand_fit}          reasons={s.brand_fit_reasons || []} />
                <ScoreCard label="Momentum"               value={s.momentum}           reasons={s.momentum_reasons || []} />
                <ScoreCard label="Engagement Quality"     value={s.engagement_quality} reasons={s.engagement_quality_reasons || []} />
                <ScoreCard label="ROI Potential"          value={s.roi_potential}      reasons={s.roi_reasons || []} />
                <ScoreCard label="Reputation Risk"        value={s.reputation_risk}    reasons={s.reputation_risk_reasons || []} risk />
              </div>
              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 12px" }}>Analiz Sinyalleri</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {s.signals.map((sig, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        background: sig.type === "positive" ? "var(--green-bg)" : sig.type === "negative" ? "var(--red-bg)" : "var(--amber-bg)",
                        color: sig.type === "positive" ? "var(--green)" : sig.type === "negative" ? "var(--red)" : "var(--amber)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>
                        {sig.type === "positive" ? "✓" : sig.type === "negative" ? "✕" : "!"}
                      </span>
                      <span style={{ color: "var(--text-2)", lineHeight: 1.5 }}>{sig.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              {(s.brand_fit_campaign_types?.length || 0) > 0 && (
                <div className="card" style={{ padding: 16 }}>
                  <h3 style={{ fontSize: 12, fontWeight: 500, margin: "0 0 10px" }}>Uygun Kampanya Türleri</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {s.brand_fit_campaign_types.map((t, i) => <span key={i} className="badge badge-brand" style={{ padding: "4px 10px" }}>{t}</span>)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── TAB: Fraud Intelligence ── */}
          {tab === "fraud" && s.fraud_detail && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 16px" }}>Fraud Intelligence</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {Object.entries(s.fraud_detail).map(([key, val]) => {
                  const labels: Record<string, string> = {
                    fake_follower_pct: "Sahte Takipçi Oranı", bot_activity: "Bot Aktivitesi",
                    engagement_fraud: "Etkileşim Fraud", comment_fraud: "Yorum Fraud",
                    growth_manipulation: "Büyüme Manipülasyonu", suspicious_spikes: "Şüpheli Spike",
                  };
                  const isNA  = typeof val === "string" && val.includes("Veri sağlayıcı");
                  const isBad = typeof val === "string" && (val.includes("Yüksek") || val.includes("Olası") || val.includes("Şüpheli"));
                  const isOk  = typeof val === "string" && (val.includes("Düşük") || val.includes("Tespit edilmedi"));
                  return (
                    <div key={key} style={{ padding: 14, background: "var(--bg-subtle)", borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{labels[key] || key}</div>
                      <div style={{
                        fontSize: 13, fontWeight: 500,
                        color: isNA ? "var(--text-3)" : isBad ? "var(--red)" : isOk ? "var(--green)" : "var(--text-1)",
                        fontStyle: isNA ? "italic" : "normal",
                      }}>{typeof val === "number" ? `%${val}` : val}</div>
                    </div>
                  );
                })}
              </div>
              <h4 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 8px" }}>Fraud Analiz Açıklaması</h4>
              {(s.fraud_reasons || []).map((reason, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 4 }}>• {reason}</div>
              ))}
            </div>
          )}

          {/* ── TAB: Audience Intelligence ── */}
          {tab === "audience" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px" }}>Kitle Analizi</h3>
                {/* Available data */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <div style={{ padding: 14, background: "var(--bg-subtle)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Tahmin Edilen Erişim</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-1)" }}>{fmt(r.reach_estimate)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>post başı erişim tahmini</div>
                  </div>
                  <div style={{ padding: 14, background: "var(--bg-subtle)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Etkileşim Kalitesi</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: s.engagement_quality >= 70 ? "var(--green)" : s.engagement_quality >= 45 ? "var(--amber)" : "var(--red)" }}>
                      {s.engagement_quality}/100
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{s.engagement_quality_reasons?.[0] || ""}</div>
                  </div>
                  {p.country && (
                    <div style={{ padding: 14, background: "var(--bg-subtle)", borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Kayıtlı Ülke</div>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{p.country}</div>
                    </div>
                  )}
                  {p.category && (
                    <div style={{ padding: 14, background: "var(--bg-subtle)", borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Kategori</div>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{p.category}</div>
                    </div>
                  )}
                </div>

                {/* Not available */}
                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 10 }}>
                    Platform API erişimi gerektiren veriler:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <DataNA label="Cinsiyet Dağılımı" />
                    <DataNA label="Yaş Dağılımı" />
                    <DataNA label="Şehir Dağılımı" />
                    <DataNA label="İlgi Alanları" />
                    <DataNA label="Takipçi Kalitesi Örnekleme" />
                    <DataNA label="Kitle Marka Uyumu" />
                  </div>
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--amber-bg)",
                    borderRadius: 7, fontSize: 11, color: "var(--amber)", lineHeight: 1.6 }}>
                    ⚠️ Yaş, cinsiyet ve şehir dağılımı verisi Instagram Graph API, TikTok Creator API veya YouTube Analytics
                    aracılığıyla edinilebilir. Bu veriler hesap bazlı erişim ve özel anlaşma gerektirir.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: ROI ── */}
          {tab === "roi" && s.roi_prediction && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px" }}>ROI Tahmini</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
                  {[
                    ["Tahmini Erişim",   fmt(s.roi_prediction.estimated_reach)],
                    ["Tahmini Gösterim", fmt(s.roi_prediction.estimated_impressions)],
                    ["Tahmini Tıklama",  fmt(s.roi_prediction.estimated_clicks)],
                    ["Tahmini Dönüşüm", fmt(s.roi_prediction.estimated_conversions)],
                    ["Tahmini CPM",      `$${s.roi_prediction.estimated_cpm}`],
                    ["Tahmini CPE",      `$${s.roi_prediction.estimated_cpe}`],
                  ].map(([l, v]) => (
                    <div key={l} style={{ padding: 12, background: "var(--bg-subtle)", borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--font-display)" }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 12, fontStyle: "italic" }}>
                  {s.roi_prediction.note}
                </div>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 10px" }}>Kampanya Bütçe Önerisi</h3>
                <div style={{ fontSize: 30, fontWeight: 600, fontFamily: "var(--font-display)" }}>
                  ${r.budget_estimate.min} – ${r.budget_estimate.max}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 10px" }}>
                  per {r.budget_estimate.per} · {r.budget_estimate.currency}
                </div>
                {(s.roi_reasons || []).map((reason, i) => (
                  <div key={i} style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>• {reason}</div>
                ))}
              </div>
              <div className="card" style={{ padding: 18 }}>
                <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 10px" }}>Önerilen Adımlar</h3>
                <ol style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {r.next_steps.map((step, i) => (
                    <li key={i} style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          {/* ── TAB: Similar ── */}
          {tab === "similar" && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: "0 0 14px" }}>Benzer Profiller</h3>
              {loadSimilar ? (
                <div style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>Yükleniyor...</div>
              ) : similar.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-3)", padding: 24, fontStyle: "italic" }}>
                  Benzer profil bulunamadı. Aynı platformda daha fazla analiz yaptıkça burası dolacak.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {similar.map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      background: "var(--bg-subtle)", borderRadius: 10 }}>
                      <ProfileAvatar src={c.avatar} name={c.display_name || c.username} size={44} platform={c.platform} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>@{c.username}</span>
                          <span className={`badge badge-${c.platform === "instagram" ? "ig" : c.platform === "youtube" ? "yt" : "tt"}`}
                            style={{ fontSize: 10 }}>
                            {c.platform === "instagram" ? "IG" : c.platform === "youtube" ? "YT" : "TT"}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {fmt(c.followers)} takipçi · %{c.engagement_rate.toFixed(1)} etk. · {c.category || "—"}
                        </div>
                        {c.similarity_reason && (
                          <div style={{ fontSize: 11, color: "var(--brand-600)", marginTop: 2 }}>{c.similarity_reason}</div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 16, fontWeight: 600,
                          color: c.final_score >= 70 ? "var(--green)" : c.final_score >= 45 ? "var(--amber)" : "var(--red)" }}>
                          {c.final_score}
                        </div>
                        {c.similarity !== undefined && (
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>%{c.similarity} benzer</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Content Grid */}
          {p.content.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 500, margin: "0 0 12px" }}>Son İçerikler</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {p.content.slice(0, 6).map((c) => (
                  <a key={c.id} href={c.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                    <div style={{ background: "var(--bg-subtle)", borderRadius: 8, overflow: "hidden", aspectRatio: "1", border: "1px solid var(--line)" }}>
                      <ContentThumb src={c.thumbnail} title={c.title} />
                    </div>
                    <div style={{ padding: "6px 2px" }}>
                      <div className="truncate-2" style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.3 }}>{c.title || "—"}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>♥ {fmt(c.likes)} · ✎ {fmt(c.comments)}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {r.missing_data_note && (
            <div style={{ background: "var(--blue-bg)", border: "1px solid rgba(37,99,235,0.15)",
              borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "var(--blue)", lineHeight: 1.6 }}>
              {r.missing_data_note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
