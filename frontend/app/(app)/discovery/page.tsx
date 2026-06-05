"use client";
import { useEffect, useState, useCallback } from "react";
import { discoverApi, watchlistApi, type DiscoveryCard, type DiscoverySections } from "@/lib/api";
import Link from "next/link";
import ProfileAvatar from "@/components/ProfileAvatar";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function PlatBadge({ plat }: { plat: string }) {
  const c = plat === "instagram" ? "badge-ig" : plat === "youtube" ? "badge-yt" : "badge-tt";
  const l = plat === "instagram" ? "IG" : plat === "youtube" ? "YT" : "TT";
  return <span className={`badge ${c}`} style={{ fontSize: 10, padding: "2px 6px" }}>{l}</span>;
}

function RiskBadge({ score }: { score: number }) {
  const label = score < 25 ? "Düşük Risk" : score < 50 ? "Orta Risk" : "Yüksek Risk";
  const color = score < 25 ? "var(--green)" : score < 50 ? "var(--amber)" : "var(--red)";
  return <span style={{ fontSize: 10, color, background: `${color}18`, padding: "2px 6px", borderRadius: 99 }}>{label}</span>;
}

function ScorePill({ value, risk }: { value: number; risk?: boolean }) {
  const color = risk
    ? (value < 25 ? "var(--green)" : value < 50 ? "var(--amber)" : "var(--red)")
    : (value >= 70 ? "var(--green)" : value >= 45 ? "var(--amber)" : "var(--red)");
  return <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>;
}

function InfluencerCard({ card, onWatchlist }: { card: DiscoveryCard; onWatchlist?: (id: number) => void }) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded]   = useState(false);

  const addToWatchlist = async () => {
    setAdding(true);
    try {
      await watchlistApi.add(card.id);
      setAdded(true);
    } catch { /* already added or error */ }
    finally { setAdding(false); }
  };

  return (
    <div className="card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ProfileAvatar src={card.avatar} name={card.display_name || card.username} size={44} platform={card.platform} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>@{card.username}</span>
            <PlatBadge plat={card.platform} />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
            {card.category || "—"} {card.country ? `· ${card.country}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "var(--font-display)",
            color: card.final_score >= 70 ? "var(--green)" : card.final_score >= 45 ? "var(--amber)" : "var(--red)" }}>
            {card.final_score}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)" }}>Final</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          ["Takipçi", fmt(card.followers)],
          ["Etk.%",   `${card.engagement_rate.toFixed(1)}%`],
          ["Fraud",   String(card.fraud_score)],
        ].map(([l, v]) => (
          <div key={l} style={{ textAlign: "center", padding: "6px 4px", background: "var(--bg-subtle)", borderRadius: 6 }}>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Scores row */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)" }}>
        <div>Brand <ScorePill value={card.brand_fit_score} /></div>
        <div>ROI <ScorePill value={card.roi_potential_score} /></div>
        <div>Mom <ScorePill value={card.momentum_score} /></div>
        <RiskBadge score={card.fraud_score} />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <Link href="/search" style={{
          flex: 1, textAlign: "center", padding: "7px", borderRadius: 7, fontSize: 12, fontWeight: 500,
          background: "var(--brand-600)", color: "#fff", textDecoration: "none",
        }}>Analiz Et</Link>
        <button onClick={addToWatchlist} disabled={adding || added} style={{
          flex: 1, padding: "7px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer",
          background: added ? "var(--green-bg)" : "var(--bg-subtle)",
          color: added ? "var(--green)" : "var(--text-2)",
          border: "1px solid var(--line)",
        }}>{added ? "✓ Listede" : adding ? "..." : "☆ İzle"}</button>
      </div>
    </div>
  );
}

function Section({ title, icon, items, emptyText }: {
  title: string; icon: string; items: DiscoveryCard[]; emptyText: string;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h3 style={{ fontSize: 15, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>{items.length} profil</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {items.map((card) => <InfluencerCard key={card.id} card={card} />)}
      </div>
    </div>
  );
}

const PLATFORMS = [
  { v: "all", l: "Tümü" }, { v: "instagram", l: "Instagram" },
  { v: "tiktok", l: "TikTok" }, { v: "youtube", l: "YouTube" },
];
const FOLLOWER_RANGES = [
  { v: "", l: "Tümü" }, { v: "0-10000", l: "< 10K" }, { v: "10000-100000", l: "10K – 100K" },
  { v: "100000-500000", l: "100K – 500K" }, { v: "500000-999999999", l: "> 500K" },
];

export default function DiscoveryPage() {
  const [sections, setSections] = useState<DiscoverySections | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<"sections" | "filter">("sections");

  // Filters
  const [platform,    setPlatform]   = useState("all");
  const [category,    setCategory]   = useState("");
  const [country,     setCountry]    = useState("");
  const [followerRng, setFollowerRng] = useState("");
  const [maxFraud,    setMaxFraud]   = useState(100);
  const [minBrand,    setMinBrand]   = useState(0);
  const [search,      setSearch]     = useState("");

  const [feedItems,  setFeedItems]  = useState<DiscoveryCard[]>([]);
  const [feedNote,   setFeedNote]   = useState("");
  const [searching,  setSearching]  = useState(false);

  useEffect(() => {
    discoverApi.sections()
      .then(setSections)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const runFilter = useCallback(async () => {
    setSearching(true);
    const [min_followers, max_followers] = followerRng
      ? followerRng.split("-").map(Number)
      : [0, 999_000_000];
    try {
      const r = await discoverApi.feed({
        platform: platform === "all" ? undefined : platform,
        category: category || undefined,
        country: country || undefined,
        min_followers, max_followers,
        max_fraud: maxFraud,
        min_brand_fit: minBrand,
        search: search || undefined,
        limit: 50,
      });
      setFeedItems(r.items);
      setFeedNote(r.note);
    } catch { }
    finally { setSearching(false); }
  }, [platform, category, country, followerRng, maxFraud, minBrand, search]);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Discovery</h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
            {sections?.total_analyses
              ? `${sections.total_analyses} analizden küratöryal keşif listesi.`
              : "İlk analizini yaptıkça burada influencer'lar görünecek."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["sections", "filter"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: view === v ? "var(--brand-600)" : "var(--bg-subtle)",
              color: view === v ? "#fff" : "var(--text-2)",
              border: view === v ? "none" : "1px solid var(--line)",
            }}>{v === "sections" ? "Top Listeler" : "Filtrele"}</button>
          ))}
        </div>
      </div>

      {/* Data note */}
      {sections?.note && (
        <div style={{ background: "var(--blue-bg)", border: "1px solid rgba(37,99,235,0.15)",
          borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--blue)", marginBottom: 20 }}>
          ℹ️ {sections.note}
        </div>
      )}

      {/* Empty state */}
      {!sections?.has_data && (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--green-bg)",
            color: "var(--brand-600)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, margin: "0 auto 18px" }}>⊛</div>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 8px" }}>Discovery henüz boş</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 20px", maxWidth: 400, marginInline: "auto" }}>
            Analiz yaptıkça Discovery dolacak. Her analiz bu havuza eklenir ve filtrelenebilir hale gelir.
          </p>
          <Link href="/search" className="btn btn-primary">İlk Analizi Başlat →</Link>
        </div>
      )}

      {/* ── SECTIONS VIEW ── */}
      {view === "sections" && sections?.has_data && (
        <>
          <Section title="Hızla Yükselen (Top Momentum)"  icon="↑" items={sections.rising}      emptyText="" />
          <Section title="En Yüksek Marka Uyumu"          icon="◈" items={sections.brand_fit}   emptyText="" />
          <Section title="En Yüksek ROI Potansiyeli"      icon="△" items={sections.roi}         emptyText="" />
          <Section title="Mikro Influencer (< 100K)"      icon="○" items={sections.micro}       emptyText="" />
          <Section title="Makro Influencer (> 500K)"      icon="●" items={sections.macro}       emptyText="" />
          <Section title="En Düşük Risk"                  icon="✓" items={sections.lowest_risk} emptyText="" />
        </>
      )}

      {/* ── FILTER VIEW ── */}
      {view === "filter" && (
        <>
          {/* Filter Panel */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 14 }}>
              {/* Platform */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Platform</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
                  {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>

              {/* Category */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Kategori</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)}
                  placeholder="Moda, teknoloji..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
              </div>

              {/* Country */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Ülke</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)}
                  placeholder="Türkiye, US..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
              </div>

              {/* Followers */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Takipçi Aralığı</label>
                <select value={followerRng} onChange={(e) => setFollowerRng(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
                  {FOLLOWER_RANGES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </div>

              {/* Fraud */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>
                  Max Fraud Risk: {maxFraud}
                </label>
                <input type="range" min={0} max={100} value={maxFraud} onChange={(e) => setMaxFraud(Number(e.target.value))}
                  style={{ width: "100%" }} />
              </div>

              {/* Brand Fit */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>
                  Min Brand Fit: {minBrand}
                </label>
                <input type="range" min={0} max={100} value={minBrand} onChange={(e) => setMinBrand(Number(e.target.value))}
                  style={{ width: "100%" }} />
              </div>
            </div>

            {/* Search + button */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="İsim veya kullanıcı adı ara..."
                style={{ flex: 1, padding: "9px 14px", borderRadius: 8, fontSize: 13 }} />
              <button onClick={runFilter} disabled={searching} className="btn btn-primary"
                style={{ opacity: searching ? 0.7 : 1 }}>
                {searching ? "Aranıyor..." : "Filtrele"}
              </button>
            </div>
          </div>

          {/* Feed Note */}
          {feedNote && (
            <div style={{ background: "var(--blue-bg)", border: "1px solid rgba(37,99,235,0.15)",
              borderRadius: 8, padding: "9px 14px", fontSize: 12, color: "var(--blue)", marginBottom: 14 }}>
              ℹ️ {feedNote}
            </div>
          )}

          {/* Feed Results */}
          {feedItems.length > 0 ? (
            <>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>{feedItems.length} sonuç</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                {feedItems.map((card) => <InfluencerCard key={card.id} card={card} />)}
              </div>
            </>
          ) : feedNote ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
              Filtrelerinize uyan sonuç bulunamadı.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
