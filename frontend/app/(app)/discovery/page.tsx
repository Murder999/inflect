"use client";
import { useEffect, useState, useCallback } from "react";
import { discoverApi, watchlistApi, type DiscoveryCard, type DiscoverySections } from "@/lib/api";
import Link from "next/link";
import ProfileAvatar from "@/components/ProfileAvatar";
import { Compass, Filter, LayoutGrid, List, Search as SearchIcon, SlidersHorizontal, Bookmark, ArrowUpRight, TrendingUp, ChevronDown } from "lucide-react";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ScorePill({ value, risk }: { value: number; risk?: boolean }) {
  const color = risk
    ? (value < 25 ? "var(--green)" : value < 50 ? "var(--amber)" : "var(--red)")
    : (value >= 70 ? "var(--green)" : value >= 45 ? "var(--amber)" : "var(--red)");
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, background: `${color}18`, color,
    }}>
      {value}
    </span>
  );
}

function PlatBadge({ plat }: { plat: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    instagram: { bg: "#FDF2F8", color: "#C13584", label: "IG" },
    youtube:   { bg: "#FFF5F5", color: "#FF0000", label: "YT" },
    tiktok:    { bg: "rgba(0,0,0,0.05)", color: "#010101", label: "TT" },
  };
  const s = styles[plat] || { bg: "var(--bg-subtle)", color: "var(--text-3)", label: plat.slice(0,2).toUpperCase() };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

/* ── Data Table Row ───────────────────────────────────────────────── */
function TableRow({ card }: { card: DiscoveryCard }) {
  const [adding, setAdding] = useState(false);
  const [added,  setAdded]  = useState(false);

  const addToWatchlist = async () => {
    setAdding(true);
    try { await watchlistApi.add(card.id); setAdded(true); }
    catch { }
    finally { setAdding(false); }
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(200px, 2fr) 70px 100px 80px 80px 80px 80px 80px 90px 130px",
      gap: 0, alignItems: "center",
      borderBottom: "1px solid var(--line)",
      transition: "background 0.1s",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {/* Profile */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px" }}>
        <ProfileAvatar src={card.avatar} name={card.display_name || card.username} size={36} platform={card.platform} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            @{card.username}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.category || "—"}
          </div>
        </div>
      </div>

      {/* Platform */}
      <div style={{ padding: "0 10px" }}>
        <PlatBadge plat={card.platform} />
      </div>

      {/* Followers */}
      <div style={{ padding: "0 10px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{fmt(card.followers)}</div>
        {card.country && <div style={{ fontSize: 10, color: "var(--text-3)" }}>{card.country}</div>}
      </div>

      {/* ER% */}
      <div style={{ padding: "0 10px", fontSize: 13, fontWeight: 500, color: card.engagement_rate >= 3 ? "var(--green)" : card.engagement_rate >= 1 ? "var(--amber)" : "var(--red)" }}>
        {card.engagement_rate.toFixed(1)}%
      </div>

      {/* Brand Fit */}
      <div style={{ padding: "0 10px" }}>
        <ScorePill value={card.brand_fit_score} />
      </div>

      {/* Fraud */}
      <div style={{ padding: "0 10px" }}>
        <ScorePill value={card.fraud_score} risk />
      </div>

      {/* ROI */}
      <div style={{ padding: "0 10px" }}>
        <ScorePill value={card.roi_potential_score} />
      </div>

      {/* Momentum */}
      <div style={{ padding: "0 10px" }}>
        <ScorePill value={card.momentum_score} />
      </div>

      {/* Final */}
      <div style={{ padding: "0 10px" }}>
        <span style={{
          fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em",
          color: card.final_score >= 70 ? "var(--green)" : card.final_score >= 45 ? "var(--amber)" : "var(--red)",
        }}>
          {card.final_score}
        </span>
      </div>

      {/* Actions */}
      <div style={{ padding: "0 12px", display: "flex", gap: 6 }}>
        <Link href="/search" style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
          background: "var(--brand-600)", color: "#fff", textDecoration: "none",
        }}>
          Analiz <ArrowUpRight size={10} />
        </Link>
        <button onClick={addToWatchlist} disabled={adding || added} style={{
          padding: "5px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
          background: added ? "var(--green-bg)" : "var(--bg-subtle)",
          color: added ? "var(--green)" : "var(--text-3)",
          border: "1px solid var(--line)",
        }}>
          {added ? "✓" : <Bookmark size={11} />}
        </button>
      </div>
    </div>
  );
}

/* ── Card (sections view) ─────────────────────────────────────────── */
function InfluencerCard({ card }: { card: DiscoveryCard }) {
  const [adding, setAdding] = useState(false);
  const [added,  setAdded]  = useState(false);

  const addToWatchlist = async () => {
    setAdding(true);
    try { await watchlistApi.add(card.id); setAdded(true); }
    catch { }
    finally { setAdding(false); }
  };

  return (
    <div style={{
      background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--line)",
      padding: "16px", display: "flex", flexDirection: "column", gap: 12,
      transition: "box-shadow 0.15s, border-color 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ProfileAvatar src={card.avatar} name={card.display_name || card.username} size={42} platform={card.platform} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{card.username}
            </span>
            <PlatBadge plat={card.platform} />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{card.category || "—"} {card.country ? `· ${card.country}` : ""}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: "-0.04em",
            color: card.final_score >= 70 ? "var(--green)" : card.final_score >= 45 ? "var(--amber)" : "var(--red)",
          }}>
            {card.final_score}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 500, textTransform: "uppercase" }}>FINAL</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {[
          { l: "Takipçi", v: fmt(card.followers) },
          { l: "Etk.%",   v: `${card.engagement_rate.toFixed(1)}%` },
          { l: "Fraud",   v: card.fraud_score, risk: true },
        ].map(({ l, v, risk }) => (
          <div key={l} style={{ textAlign: "center", padding: "6px 4px", background: "var(--bg-subtle)", borderRadius: 7 }}>
            <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 2, fontWeight: 500, textTransform: "uppercase" }}>{l}</div>
            {typeof v === "number" ? (
              <ScorePill value={v} risk={risk} />
            ) : (
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{v}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--text-3)", justifyContent: "space-between" }}>
        <span>Brand <span style={{ color: card.brand_fit_score >= 70 ? "var(--green)" : card.brand_fit_score >= 45 ? "var(--amber)" : "var(--red)", fontWeight: 700 }}>{card.brand_fit_score}</span></span>
        <span>ROI <span style={{ color: card.roi_potential_score >= 70 ? "var(--green)" : "var(--amber)", fontWeight: 700 }}>{card.roi_potential_score}</span></span>
        <span>Mom <span style={{ color: card.momentum_score >= 70 ? "var(--green)" : "var(--amber)", fontWeight: 700 }}>{card.momentum_score}</span></span>
      </div>

      <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <Link href="/search" style={{
          flex: 1, textAlign: "center", padding: "7px", borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: "var(--brand-600)", color: "#fff", textDecoration: "none",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          Analiz Et <ArrowUpRight size={12} />
        </Link>
        <button onClick={addToWatchlist} disabled={adding || added} style={{
          padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
          background: added ? "var(--green-bg)" : "var(--bg-subtle)",
          color: added ? "var(--green)" : "var(--text-2)",
          border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 5,
        }}>
          <Bookmark size={12} />
          {added ? "Listede" : adding ? "..." : "İzle"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, items }: { title: string; icon: string; items: DiscoveryCard[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", margin: 0, letterSpacing: "-0.01em" }}>{title}</h3>
        <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto", background: "var(--bg-subtle)", padding: "2px 8px", borderRadius: 99, border: "1px solid var(--line)" }}>
          {items.length} profil
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
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

const TABLE_HEADERS = [
  { l: "Profil",   w: "minmax(200px, 2fr)" },
  { l: "Platform", w: "70px" },
  { l: "Takipçi",  w: "100px" },
  { l: "ER%",      w: "80px" },
  { l: "Brand",    w: "80px" },
  { l: "Fraud",    w: "80px" },
  { l: "ROI",      w: "80px" },
  { l: "Momentum", w: "80px" },
  { l: "Final",    w: "90px" },
  { l: "İşlem",    w: "130px" },
];

export default function DiscoveryPage() {
  const [sections, setSections] = useState<DiscoverySections | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<"sections" | "filter">("sections");

  const [platform,    setPlatform]    = useState("all");
  const [category,    setCategory]    = useState("");
  const [country,     setCountry]     = useState("");
  const [followerRng, setFollowerRng] = useState("");
  const [maxFraud,    setMaxFraud]    = useState(100);
  const [minBrand,    setMinBrand]    = useState(0);
  const [search,      setSearch]      = useState("");

  const [feedItems, setFeedItems] = useState<DiscoveryCard[]>([]);
  const [feedNote,  setFeedNote]  = useState("");
  const [searching, setSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

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

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text-3)", fontSize: 14 }}>
      Yükleniyor...
    </div>
  );

  return (
    <div style={{ maxWidth: 1300 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.03em", color: "var(--text-1)" }}>
            Discovery
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
            {sections?.total_analyses
              ? `${sections.total_analyses} analizden küratöryal keşif listesi.`
              : "İlk analizini yaptıkça burada influencer'lar görünecek."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 9, padding: 4, gap: 4 }}>
            {([
              { v: "sections", label: "Listeler", icon: LayoutGrid },
              { v: "filter",   label: "Filtrele", icon: List },
            ] as const).map(({ v, label, icon: Icon }) => (
              <button key={v} onClick={() => setView(v)} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 7, fontSize: 13, fontWeight: view === v ? 600 : 400,
                cursor: "pointer", transition: "all 0.12s",
                background: view === v ? "var(--bg-subtle)" : "transparent",
                color: view === v ? "var(--text-1)" : "var(--text-3)",
                border: view === v ? "1px solid var(--line)" : "1px solid transparent",
              }}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data note */}
      {sections?.note && (
        <div style={{
          background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)",
          borderRadius: 9, padding: "10px 14px", fontSize: 12, color: "#60A5FA", marginBottom: 20,
        }}>
          ℹ️ {sections.note}
        </div>
      )}

      {/* Empty state */}
      {!sections?.has_data && (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center", marginBottom: 20 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: "var(--green-bg)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
          }}>
            <Compass size={24} style={{ color: "var(--green)" }} />
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px", color: "var(--text-1)" }}>Discovery henüz boş</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 20px", maxWidth: 400, marginInline: "auto" }}>
            Analiz yaptıkça Discovery dolacak. Her analiz bu havuza eklenir ve filtrelenebilir hale gelir.
          </p>
          <Link href="/search" style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px",
            borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none",
            background: "var(--green)", color: "#fff",
          }}>
            İlk Analizi Başlat →
          </Link>
        </div>
      )}

      {/* ── SECTIONS VIEW ── */}
      {view === "sections" && sections?.has_data && (
        <>
          <Section title="Hızla Yükselen — Top Momentum"  icon="↑" items={sections.rising}      />
          <Section title="En Yüksek Marka Uyumu"          icon="◈" items={sections.brand_fit}   />
          <Section title="En Yüksek ROI Potansiyeli"      icon="△" items={sections.roi}         />
          <Section title="Mikro Influencer (< 100K)"      icon="○" items={sections.micro}       />
          <Section title="Makro Influencer (> 500K)"      icon="●" items={sections.macro}       />
          <Section title="En Düşük Risk"                  icon="✓" items={sections.lowest_risk} />
        </>
      )}

      {/* ── FILTER VIEW — data table ── */}
      {view === "filter" && (
        <>
          {/* Filter panel */}
          <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderBottom: showFilters ? "1px solid var(--line)" : "none",
              cursor: "pointer",
            }} onClick={() => setShowFilters((v) => !v)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                <SlidersHorizontal size={14} style={{ color: "var(--text-3)" }} />
                Filtreler
              </div>
              <ChevronDown size={14} style={{ color: "var(--text-3)", transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </div>

            {showFilters && (
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 14, marginBottom: 14 }}>
                  {/* Platform */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Platform</label>
                    <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
                      {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Kategori</label>
                    <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Moda, teknoloji..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
                  </div>

                  {/* Country */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Ülke</label>
                    <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Türkiye, US..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }} />
                  </div>

                  {/* Followers */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Takipçi Aralığı</label>
                    <select value={followerRng} onChange={(e) => setFollowerRng(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
                      {FOLLOWER_RANGES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                    </select>
                  </div>

                  {/* Fraud slider */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                      Max Fraud: <span style={{ color: "var(--red)", fontWeight: 800 }}>{maxFraud}</span>
                    </label>
                    <input type="range" min={0} max={100} value={maxFraud} onChange={(e) => setMaxFraud(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>

                  {/* Brand Fit slider */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                      Min Brand Fit: <span style={{ color: "var(--green)", fontWeight: 800 }}>{minBrand}</span>
                    </label>
                    <input type="range" min={0} max={100} value={minBrand} onChange={(e) => setMinBrand(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "var(--bg-subtle)", border: "1px solid var(--line)", borderRadius: 9, padding: "0 12px", height: 38 }}>
                    <SearchIcon size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="İsim veya kullanıcı adı ara..."
                      style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--text-1)", flex: 1 }}
                    />
                  </div>
                  <button onClick={runFilter} disabled={searching} style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                    background: "var(--green)", color: "#fff", border: "none",
                    cursor: searching ? "not-allowed" : "pointer", opacity: searching ? 0.7 : 1,
                  }}>
                    <Filter size={13} />
                    {searching ? "Aranıyor..." : "Filtrele"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Feed note */}
          {feedNote && (
            <div style={{
              background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)",
              borderRadius: 9, padding: "9px 14px", fontSize: 12, color: "#60A5FA", marginBottom: 14,
            }}>
              ℹ️ {feedNote}
            </div>
          )}

          {/* Data table */}
          {feedItems.length > 0 ? (
            <div className="card" style={{ overflow: "hidden" }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: TABLE_HEADERS.map((h) => h.w).join(" "),
                gap: 0, background: "var(--bg-subtle)", borderBottom: "2px solid var(--line)",
                position: "sticky", top: 0, zIndex: 10,
              }}>
                {TABLE_HEADERS.map((h) => (
                  <div key={h.l} style={{ padding: "9px 10px 9px 16px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {h.l}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div>
                {feedItems.map((card) => <TableRow key={card.id} card={card} />)}
              </div>

              {/* Footer count */}
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line)", fontSize: 12, color: "var(--text-3)" }}>
                {feedItems.length} sonuç gösteriliyor
              </div>
            </div>
          ) : feedNote ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
              <Filter size={24} style={{ display: "block", margin: "0 auto 12px", opacity: 0.4 }} />
              Filtrelerinize uyan sonuç bulunamadı.
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
