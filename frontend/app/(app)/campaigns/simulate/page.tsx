"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { discoverApi, campaignsApi } from "@/lib/api";
import {
  runIntelligentSimulation, interpretCampaign,
  BRAND_TAXONOMY, GOAL_META, getCreatorTier,
  type SimConfig, type SimResultV2, type EnrichedCreator,
  type CampaignProfile, type RangeEstimate, type ConfidenceScore,
  type FeasibilityScore, type BrandEntry,
} from "@/lib/simulation-engine";
import Link from "next/link";
import {
  Zap, ArrowRight, ArrowLeft, BarChart2, TrendingUp, Users, DollarSign,
  Target, Globe, Tag, Calendar, Sparkles, AlertTriangle, CheckCircle,
  ChevronRight, Save, Eye, Star, Shield, RefreshCw, Lightbulb,
  Info, XCircle, MapPin, Layers, Search, ChevronDown,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const ACCENT_COLORS = ["#10B981","#6366F1","#F59E0B","#EC4899","#3B82F6","#8B5CF6","#EF4444","#14B8A6"];
const TIER_COLORS: Record<string, string> = {
  "Micro": "#10B981", "Mid-tier": "#6366F1", "Macro": "#F59E0B", "Hero": "#EC4899",
};

const CONF_GRADE_COLOR: Record<string, string> = {
  A: "var(--green)", B: "#6366F1", C: "#F59E0B", D: "var(--red)",
};
const FEAS_COLOR: Record<string, string> = {
  High: "var(--green)", Medium: "#F59E0B", Low: "var(--red)",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

function SectionTitle({ icon: Icon, title, sub, color = "var(--green)" }: {
  icon: IconComponent; title: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function RangeCard({
  label, range, icon: Icon, color, note,
}: {
  label: string; range: RangeEstimate; icon: IconComponent; color: string; note?: string;
}) {
  const confColor = range.confidence === "High" ? "var(--green)" : range.confidence === "Medium" ? "#F59E0B" : "var(--red)";
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: confColor, background: `${confColor}18`, padding: "2px 7px", borderRadius: 99 }}>{range.confidence} Güven</span>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={13} color={color} />
          </div>
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 6 }}>
        {fmt(range.expected)}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: note ? 8 : 0 }}>
        Aralık: {fmt(range.low)} — {fmt(range.high)}
      </div>
      {note && <div style={{ fontSize: 10, color: "var(--text-3)", fontStyle: "italic" }}>{note}</div>}
    </div>
  );
}

function UnavailableCard({ label, reason }: { label: string; reason: string }) {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", borderTop: "3px solid var(--bg-muted)", opacity: 0.7 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <XCircle size={14} color="var(--text-3)" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)" }}>Veri Yetersiz</span>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.5, fontStyle: "italic" }}>{reason}</div>
    </div>
  );
}

function ConfidenceBadge({ score }: { score: ConfidenceScore }) {
  const color = CONF_GRADE_COLOR[score.grade] || "var(--text-3)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", background: "var(--bg-elevated)", borderRadius: 10, border: `1px solid ${color}28` }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color }}>{score.grade}</span>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Güven Skoru</div>
        <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{score.overall}/100</div>
      </div>
    </div>
  );
}

function FeasibilityBadge({ score }: { score: FeasibilityScore }) {
  const color = FEAS_COLOR[score.level];
  const label = score.level === "High" ? "Yüksek" : score.level === "Medium" ? "Orta" : "Düşük";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", background: "var(--bg-elevated)", borderRadius: 10, border: `1px solid ${color}28` }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Target size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Fizibilite</div>
        <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{label}</div>
      </div>
    </div>
  );
}

// ── Brand Autocomplete ─────────────────────────────────────────────────────────

function BrandAutocomplete({
  value, onChange, onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (brand: string, category: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<BrandEntry[]>([]);
  const [open, setOpen]               = useState(false);
  const [idx, setIdx]                 = useState(-1);
  const [loading, setLoading]         = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef     = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    const lower = q.toLowerCase();
    const results = BRAND_TAXONOMY
      .filter(b => b.brand.toLowerCase().includes(lower) || b.category.toLowerCase().includes(lower))
      .slice(0, 6);
    setSuggestions(results);
    setOpen(results.length > 0);
    setLoading(false);
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    setIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 280);
  };

  const handleSelect = (entry: BrandEntry) => {
    onSelect(entry.brand, entry.category);
    setSuggestions([]); setOpen(false); setIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(i => Math.max(i - 1, -1)); }
    if (e.key === "Enter" && idx >= 0) { e.preventDefault(); handleSelect(suggestions[idx]); }
    if (e.key === "Escape") { setOpen(false); setIdx(-1); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setIdx(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-3)" }} />
        <input
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && search(value)}
          placeholder="Nike, MyProtein, Samsung..."
          autoComplete="off"
          style={{ width: "100%", padding: "10px 14px 10px 34px", borderRadius: 9, fontSize: 13 }}
        />
        {loading && (
          <RefreshCw size={12} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", animation: "spin 1s linear infinite", color: "var(--text-3)" }} />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)", overflow: "hidden",
        }}>
          {suggestions.map((entry, i) => (
            <button
              key={entry.brand}
              onMouseDown={e => { e.preventDefault(); handleSelect(entry); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "10px 14px", textAlign: "left", cursor: "pointer",
                background: i === idx ? "var(--green-bg)" : "transparent",
                border: "none", borderBottom: i < suggestions.length - 1 ? "1px solid var(--line)" : "none",
                transition: "background 0.1s",
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: i === idx ? "var(--green)" : "var(--text-1)" }}>{entry.brand}</span>
                {entry.sub && <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>· {entry.sub}</span>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", background: "var(--bg-subtle)", padding: "2px 7px", borderRadius: 99, flexShrink: 0 }}>{entry.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Loading Steps ──────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  "Kampanya bağlamı analiz ediliyor...",
  "Hedef kitle profili oluşturuluyor...",
  "Creator veritabanı taranıyor...",
  "Ülke ve kategori filtreleri uygulanıyor...",
  "Creator kalite skorları hesaplanıyor...",
  "Portföy yapısı optimize ediliyor...",
  "Erişim ve etkileşim aralıkları tahmin ediliyor...",
  "Güven ve fizibilite değerlendirmesi yapılıyor...",
  "Kampanya raporu derleniyor...",
];

// ── Constants ──────────────────────────────────────────────────────────────────

const GOALS = [
  { v: "brand_awareness" as const, l: "Marka Bilinirliği", icon: "📢", desc: "Maksimum görünürlük" },
  { v: "sales"           as const, l: "Satış",             icon: "💰", desc: "Dönüşüm odaklı" },
  { v: "engagement"      as const, l: "Etkileşim",         icon: "💬", desc: "Topluluk oluşturma" },
  { v: "product_launch"  as const, l: "Ürün Lansmanı",     icon: "🚀", desc: "Yeni ürün farkındalığı" },
];
const PLATFORMS = [
  { v: "instagram" as const, l: "Instagram" },
  { v: "tiktok"    as const, l: "TikTok" },
  { v: "youtube"   as const, l: "YouTube" },
  { v: "all"       as const, l: "Tüm Platformlar" },
];
const DURATIONS = [2, 4, 6, 8, 12];

// ── Main Page ──────────────────────────────────────────────────────────────────

type Step = "configure" | "running" | "report";

export default function SimulatePage() {
  const [step,         setStep]        = useState<Step>("configure");
  const [config,       setConfig]      = useState<SimConfig>({
    name: "", product: "", goal: "brand_awareness",
    platform: "instagram", category: "", country: "",
    budget: 10000, duration: 4,
  });
  const [result,       setResult]      = useState<SimResultV2 | null>(null);
  const [liveProfile,  setLiveProfile] = useState<CampaignProfile | null>(null);
  const [loadingStep,  setLoadingStep] = useState(0);
  const [err,          setErr]         = useState("");
  const [saving,       setSaving]      = useState(false);
  const [savedId,      setSavedId]     = useState<number | null>(null);
  const [expandedCreator, setExpandedCreator] = useState<number | null>(null);

  const set = <K extends keyof SimConfig>(k: K) =>
    (v: SimConfig[K]) => setConfig(p => ({ ...p, [k]: v }));

  // Live campaign profile preview
  useEffect(() => {
    if (config.product.trim().length >= 2) {
      setLiveProfile(interpretCampaign(config));
    } else {
      setLiveProfile(null);
    }
  }, [config.product, config.category, config.goal]);

  const canRun = config.product.trim().length >= 2 && config.budget >= 500;

  async function runSim() {
    if (!canRun) { setErr("Ürün/Marka adı ve minimum $500 bütçe zorunlu."); return; }
    setErr(""); setStep("running"); setLoadingStep(0);

    let stepIdx = 0;
    const tick = () => {
      stepIdx++;
      if (stepIdx < LOADING_STEPS.length) {
        setLoadingStep(stepIdx);
        setTimeout(tick, 380 + Math.random() * 200);
      }
    };
    setTimeout(tick, 420);

    let raw: import("@/lib/api").DiscoveryCard[] = [];
    try {
      const primary = await discoverApi.feed({
        platform:      config.platform === "all" ? undefined : config.platform,
        category:      config.category || undefined,
        country:       config.country  || undefined,
        min_brand_fit: 25,
        max_fraud:     75,
        limit:         30,
      });
      raw = primary.items;

      // If country filtering yields < 3, broaden search
      if (raw.length < 3 && (config.category || config.country)) {
        const broad = await discoverApi.feed({
          platform: config.platform === "all" ? undefined : config.platform,
          limit: 20,
        });
        const existing = new Set(raw.map(c => `${c.username}::${c.platform}`));
        raw = [...raw, ...broad.items.filter(c => !existing.has(`${c.username}::${c.platform}`))];
      }
    } catch {
      // DB unavailable — engine handles empty gracefully
    }

    const sim = runIntelligentSimulation(config, raw);
    await new Promise(r => setTimeout(r, 3200));
    setResult(sim);
    setStep("report");
  }

  async function saveAsCampaign() {
    if (!result || !config.product.trim()) return;
    setSaving(true);
    try {
      // Serialize simulation result — strip circular refs via JSON round-trip
      let simResultPayload: Record<string, unknown> | null = null;
      try {
        simResultPayload = JSON.parse(JSON.stringify(result));
      } catch {
        simResultPayload = null;
      }

      const r = await campaignsApi.create({
        name:              config.name || `${config.product} — ${GOAL_META[config.goal].label}`,
        platform:          config.platform === "all" ? "instagram" : config.platform,
        category:          config.category || result.campaignProfile.primaryCategory,
        target_country:    config.country  || undefined,
        goal:              config.goal,
        budget:            config.budget,
        brand:             config.product,
        notes:             result.summary.slice(0, 500),
        simulation_result: simResultPayload,
        report_source:     result.reportSource,
        data_confidence:   result.confidence.grade === "A" ? "high" : result.confidence.grade === "D" ? "low" : "medium",
        provider_status:   result.creatorsFromDB > 0 ? "available" : "unavailable",
      });
      setSavedId(r.campaign?.id || null);
    } catch (e: unknown) {
      if (e instanceof Error) setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── CONFIGURE ─────────────────────────────────────────────────────────────────

  if (step === "configure") {
    return (
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 99, background: "var(--green-bg)", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 14 }}>
            <Sparkles size={12} color="var(--green)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", letterSpacing: "0.05em" }}>CAMPAIGN INTELLIGENCE SYSTEM</span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.04em", color: "var(--text-1)", lineHeight: 1.1 }}>
            Kampanya Stratejisi<br />
            <span style={{ background: "linear-gradient(135deg,var(--green),#34D399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Simülasyonu
            </span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0, maxWidth: 480, marginInline: "auto", lineHeight: 1.6 }}>
            Gerçek influencer verisine dayalı, güven skoru ile validate edilmiş kampanya stratejisi.
            Hallüsinasyon yok, şeffaf güven seviyeleri.
          </p>
        </div>

        {err && (
          <div style={{ padding: "10px 16px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 9, fontSize: 13, marginBottom: 18, border: "1px solid rgba(239,68,68,0.2)" }}>
            {err}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Campaign Details */}
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                <Target size={14} color="var(--green)" /> Kampanya Detayları
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Kampanya Adı (opsiyonel)</label>
                  <input value={config.name} onChange={e => set("name")(e.target.value)} placeholder="Q3 Kampanyası..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    Ürün / Marka <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <BrandAutocomplete
                    value={config.product}
                    onChange={v => set("product")(v)}
                    onSelect={(brand, cat) => setConfig(p => ({ ...p, product: brand, category: p.category || cat }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Kategori (opsiyonel — auto-detect)</label>
                  <input value={config.category} onChange={e => set("category")(e.target.value)} placeholder="Fitness, Güzellik, Teknoloji..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    <Globe size={10} style={{ display: "inline", marginRight: 4 }} />Hedef Ülke
                  </label>
                  <input value={config.country} onChange={e => set("country")(e.target.value)} placeholder="Türkiye, USA, Germany..." style={{ width: "100%", padding: "9px 12px", borderRadius: 8, fontSize: 13 }} />
                </div>
              </div>
            </div>

            {/* Budget & Duration */}
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                <DollarSign size={14} color="var(--green)" /> Bütçe & Süre
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    Toplam Bütçe (USD) <span style={{ color: "var(--red)" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--text-3)", fontWeight: 700 }}>$</span>
                    <input type="number" value={config.budget} onChange={e => set("budget")(Number(e.target.value))} min={500} style={{ width: "100%", padding: "9px 12px 9px 26px", borderRadius: 8, fontSize: 14, fontWeight: 700 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>Minimum $500 · Revenue/ROAS kampanya verisi gerektirir</div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Kampanya Süresi</label>
                  <div style={{ display: "flex", gap: 5 }}>
                    {DURATIONS.map(d => (
                      <button key={d} onClick={() => set("duration")(d)} style={{
                        flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: config.duration === d ? 700 : 400,
                        cursor: "pointer", transition: "all 0.12s",
                        background: config.duration === d ? "var(--green)" : "var(--bg-subtle)",
                        color: config.duration === d ? "#fff" : "var(--text-3)",
                        border: config.duration === d ? "none" : "1px solid var(--line)",
                      }}>{d}h</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Goal */}
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                <Target size={14} color="var(--green)" /> Kampanya Hedefi
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {GOALS.map(g => (
                  <button key={g.v} onClick={() => set("goal")(g.v)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "11px 13px",
                    borderRadius: 9, cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.12s",
                    background: config.goal === g.v ? "var(--green-bg)" : "var(--bg-subtle)",
                    border: `1.5px solid ${config.goal === g.v ? "rgba(16,185,129,0.3)" : "var(--line)"}`,
                  }}>
                    <span style={{ fontSize: 18 }}>{g.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: config.goal === g.v ? "var(--green)" : "var(--text-1)" }}>{g.l}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>{g.desc}</div>
                    </div>
                    {config.goal === g.v && <CheckCircle size={14} color="var(--green)" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
                <Globe size={14} color="var(--green)" /> Platform
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {PLATFORMS.map(p => (
                  <button key={p.v} onClick={() => set("platform")(p.v)} style={{
                    padding: "9px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.12s",
                    background: config.platform === p.v ? "var(--green-bg)" : "var(--bg-subtle)",
                    border: `1.5px solid ${config.platform === p.v ? "rgba(16,185,129,0.3)" : "var(--line)"}`,
                    color: config.platform === p.v ? "var(--green)" : "var(--text-2)",
                    fontWeight: config.platform === p.v ? 700 : 400, fontSize: 12,
                  }}>{p.l}</button>
                ))}
              </div>
            </div>

            {/* Live Campaign Intelligence Preview */}
            {liveProfile && (
              <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.07),rgba(99,102,241,0.05))", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={11} color="var(--green)" /> Kampanya Zekası Önizleme
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <Row l="Kategori" v={liveProfile.primaryCategory} />
                  <Row l="Alt Kategori" v={liveProfile.subcategory} />
                  <Row l="Hedef Kitle" v={`${liveProfile.audienceAgeRange} · ${liveProfile.audienceGender}`} />
                  <Row l="Satın Alma Niyeti" v={liveProfile.purchaseIntentLevel === "High" ? "Yüksek" : liveProfile.purchaseIntentLevel === "Medium" ? "Orta" : "Düşük"} />
                  <div style={{ paddingTop: 6, borderTop: "1px solid rgba(16,185,129,0.15)", marginTop: 2 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Önerilen Creator Tipleri</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {liveProfile.recommendedPersonas.slice(0, 3).map(p => (
                        <span key={p} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(16,185,129,0.12)", color: "var(--green)" }}>{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <button onClick={runSim} disabled={!canRun} style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "14px 40px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: canRun ? "pointer" : "not-allowed",
            background: canRun ? "linear-gradient(135deg,var(--green),#34D399)" : "var(--bg-subtle)",
            color: canRun ? "#fff" : "var(--text-3)", border: "none", opacity: canRun ? 1 : 0.6,
            boxShadow: canRun ? "0 8px 24px rgba(16,185,129,0.35)" : "none", transition: "all 0.2s",
          }}>
            <Zap size={17} />
            Campaign Intelligence Simülasyonunu Başlat
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ── RUNNING ────────────────────────────────────────────────────────────────────

  if (step === "running") {
    return (
      <div style={{ maxWidth: 580, margin: "0 auto", paddingTop: 52, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--green-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 0 0 12px rgba(16,185,129,0.07)" }}>
          <Zap size={26} color="var(--green)" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.04em", color: "var(--text-1)" }}>
          Campaign Intelligence Çalışıyor...
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 32px" }}>
          Veri doğrulama ve relevance scoring yapılıyor
        </p>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "22px 28px", marginBottom: 20, textAlign: "left" }}>
          {LOADING_STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < LOADING_STEPS.length - 1 ? "1px solid var(--line)" : "none" }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: i < loadingStep ? "var(--green)" : i === loadingStep ? "var(--green-bg)" : "var(--bg-subtle)",
                border: i === loadingStep ? "2px solid var(--green)" : "none",
                transition: "all 0.3s",
              }}>
                {i < loadingStep
                  ? <CheckCircle size={11} color="#fff" />
                  : i === loadingStep
                  ? <RefreshCw size={10} color="var(--green)" style={{ animation: "spin 1s linear infinite" }} />
                  : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--bg-muted)", display: "block" }} />
                }
              </div>
              <span style={{
                fontSize: 12, fontWeight: i <= loadingStep ? 500 : 400,
                color: i < loadingStep ? "var(--text-3)" : i === loadingStep ? "var(--text-1)" : "var(--text-3)",
                textDecoration: i < loadingStep ? "line-through" : "none",
              }}>{s}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {[config.product, GOAL_META[config.goal].label, config.platform, `$${config.budget.toLocaleString()}`].filter(Boolean).map(tag => (
            <span key={tag} style={{ padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-3)" }}>{tag}</span>
          ))}
        </div>
      </div>
    );
  }

  // ── REPORT ─────────────────────────────────────────────────────────────────────

  if (!result) return null;
  const profile  = result.campaignProfile;
  const audience = result.audienceIntelligence;

  const budgetChartData = result.creators.length > 0
    ? result.creators.map((c, i) => ({ name: `@${c.card.username}`, value: Math.round(c.budgetPct * 10) / 10, abs: Math.round(c.allocatedBudget), color: ACCENT_COLORS[i % ACCENT_COLORS.length] }))
    : result.portfolio.tiers.map((t, i) => ({ name: t.label, value: t.budgetPct, abs: t.budgetAbs, color: t.color }));

  const perfData = result.creators.map(c => ({
    name:    `@${c.card.username.slice(0, 10)}`,
    quality: c.qualityScore ?? 0,
    reach:   Math.round(c.estimatedReach.expected / 1000),
    budget:  Math.round(c.budgetPct),
  }));

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* ── Report Header ── */}
      <div style={{ background: "linear-gradient(135deg,var(--bg-elevated),rgba(16,185,129,0.04))", borderRadius: 16, border: "1px solid var(--line)", padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "var(--green-bg)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <CheckCircle size={11} color="var(--green)" />
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--green)" }}>Intelligence Report · {new Date().toLocaleDateString("tr-TR")}</span>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <Info size={10} color="#6366F1" />
                <span style={{ fontSize: 10, fontWeight: 700, color: "#6366F1" }}>
                  {result.reportSource === "client_simulation_preview" ? "Simülasyon Önizleme" : "Doğrulanmış Veri Yok"}
                </span>
              </div>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.04em", color: "var(--text-1)" }}>
              {config.name || `${config.product} Kampanya Analizi`}
            </h1>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-3)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Target size={11} /> {GOAL_META[config.goal].label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><DollarSign size={11} /> {fmtCurrency(config.budget)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {config.duration} hafta</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Globe size={11} /> {config.country || "Global"}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Tag size={11} /> {config.platform === "all" ? "Tüm Platformlar" : config.platform}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11} /> {result.creatorsFromDB} creator veritabanı</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setStep("configure"); setResult(null); setSavedId(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "var(--bg-subtle)", color: "var(--text-2)", border: "1px solid var(--line)" }}>
              <ArrowLeft size={12} /> Yapılandır
            </button>
            {savedId
              ? <Link href={`/campaigns/${savedId}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--green)", color: "#fff", textDecoration: "none" }}>
                  <Eye size={12} /> Kampanyayı Gör
                </Link>
              : <button onClick={saveAsCampaign} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: saving ? "wait" : "pointer", background: "var(--green)", color: "#fff", border: "none", opacity: saving ? 0.7 : 1 }}>
                  <Save size={12} /> {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
            }
          </div>
        </div>
      </div>

      {/* ── Data quality warnings ── */}
      {result.excludedFromPortfolio > 0 && (
        <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", marginBottom: 3 }}>Veri Kalitesi Filtresi Uygulandı</div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
              {result.excludedFromPortfolio} creator, yetersiz veri kalitesi (tamamlama skoru %60 altında) nedeniyle portföye alınmadı.
              Portföy kalitesini artırmak için Discovery'den gerçek analiz yapın.
            </div>
          </div>
        </div>
      )}
      {result.creators.some(c => c.completenessLevel === "low_confidence") && (
        <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Info size={14} color="#6366F1" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
            <strong style={{ color: "#6366F1" }}>Düşük Güven Creator:</strong> Bazı creator'lar (%60–%75 veri tamamlama) portföyde yer alıyor ancak bütçenin en fazla %15&apos;i tahsis edildi.
            Daha yüksek bütçe payı için Discovery&apos;den tam analiz yapın.
          </div>
        </div>
      )}

      {/* ── Confidence + Feasibility Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <ConfidenceBadge score={result.confidence} />
        <FeasibilityBadge score={result.feasibility} />
      </div>
      {result.feasibility.reasons.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 10, border: "1px solid var(--line)", padding: "12px 16px", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Info size={13} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.55 }}>
            {result.feasibility.reasons.join(" · ")}
          </div>
        </div>
      )}

      {/* ── Executive Summary ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "22px 26px", marginBottom: 16 }}>
        <SectionTitle icon={Sparkles} title="Yönetici Özeti" sub="Campaign Intelligence Engine tarafından üretildi" />
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.8, margin: 0, padding: "14px 18px", background: "var(--bg-subtle)", borderRadius: 9, borderLeft: "3px solid var(--green)" }}>
          {result.summary}
        </p>
      </div>

      {/* ── Campaign Profile + Audience Intelligence ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Campaign Profile */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
          <SectionTitle icon={Target} title="Kampanya Profili" sub={`Kaynak: ${profile.detectedFrom === "brand_taxonomy" ? "Marka veritabanı" : profile.detectedFrom === "keyword" ? "Anahtar kelime tespiti" : "Kullanıcı girişi"}`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Row l="Birincil Kategori"  v={profile.primaryCategory} bold />
            <Row l="Alt Kategori"       v={profile.subcategory} />
            <Row l="Satın Alma Niyeti"  v={profile.purchaseIntentLevel === "High" ? "Yüksek" : profile.purchaseIntentLevel === "Medium" ? "Orta" : "Düşük"} color={profile.purchaseIntentLevel === "High" ? "var(--green)" : profile.purchaseIntentLevel === "Medium" ? "#F59E0B" : "var(--red)"} />
            <Row l="Kampanya Karmaşıklığı" v={profile.campaignComplexity === "High" ? "Yüksek" : profile.campaignComplexity === "Medium" ? "Orta" : "Düşük"} />
            <Row l="Hedef Yaş Aralığı"  v={profile.audienceAgeRange} />
            <Row l="Cinsiyet Dağılımı"  v={profile.audienceGender} />
          </div>
          {profile.strategicNotes.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Stratejik Notlar</div>
              {profile.strategicNotes.map((n, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 5, display: "flex", gap: 7 }}>
                  <span style={{ color: "var(--green)", flexShrink: 0 }}>›</span> {n}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audience Intelligence */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
          <SectionTitle icon={Users} title="Hedef Kitle Zekası" sub="Kampanya profili ve hedefe göre türetildi" color="#6366F1" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <Row l="Birincil Kitle"     v={audience.primaryAudience} />
            <Row l="İkincil Kitle"      v={audience.secondaryAudience} />
            <Row l="Yaş Aralığı"        v={audience.ageRange} />
            <Row l="Satın Alma Niyeti"  v={audience.purchaseIntent} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>İlgi Kümeleri</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {audience.interestClusters.map(ic => (
                <span key={ic} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(99,102,241,0.12)", color: "#6366F1" }}>{ic}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>Creator Persona Önceliği</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {audience.personaPriority.slice(0, 4).map((p, i) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-2)" }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: `${ACCENT_COLORS[i]}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: ACCENT_COLORS[i], flexShrink: 0 }}>{i + 1}</span>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Portfolio Strategy ── */}
      {result.portfolio.tiers.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 24px", marginBottom: 16 }}>
          <SectionTitle icon={Layers} title="Portföy Stratejisi" sub={result.portfolio.strategy} color="#F59E0B" />
          <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 16, padding: "10px 14px", background: "rgba(245,158,11,0.06)", borderRadius: 8, borderLeft: "3px solid #F59E0B" }}>
            {result.portfolio.goalRationale}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${result.portfolio.tiers.length}, 1fr)`, gap: 10 }}>
            {result.portfolio.tiers.map(tier => (
              <div key={tier.name} style={{ background: "var(--bg-subtle)", borderRadius: 10, border: `1px solid ${tier.color}28`, padding: "14px 16px", borderTop: `3px solid ${tier.color}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: tier.color, marginBottom: 4 }}>{tier.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em" }}>{tier.budgetPct}%</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>{fmtCurrency(tier.budgetAbs)} · {tier.count} creator</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.5 }}>{tier.rationale}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Creator Portfolio Table ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)" }}>
          <SectionTitle icon={Users} title="Creator Portföyü" sub={result.creators.length > 0 ? `${result.creators.length} creator — kalite skoru ağırlıklı, relevance-first seçim` : "Veritabanında eşleşen creator bulunamadı"} />
        </div>
        {result.creators.length === 0 ? (
          <div style={{ padding: "36px 22px", textAlign: "center" }}>
            <Users size={26} style={{ display: "block", margin: "0 auto 10px", opacity: 0.25 }} color="var(--text-3)" />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Veritabanı henüz boş</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16 }}>Influencer analizi yapıldıkça portföy burada görünecek.</div>
            <Link href="/discovery" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--green)", color: "#fff", textDecoration: "none" }}>
              Discovery'ye git <ArrowRight size={11} />
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                  {["Sıra","Creator","Kalite Skoru","Persona","Ülke","Kategori","Tahmini Erişim","Bütçe","Ayrıntı"].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.creators.map((c, i) => {
                  const isExpanded = expandedCreator === i;
                  return (
                    <>
                      <tr key={c.card.id} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }} onClick={() => setExpandedCreator(isExpanded ? null : i)}>
                        <td style={{ padding: "11px 12px" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${ACCENT_COLORS[i % ACCENT_COLORS.length]}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: ACCENT_COLORS[i % ACCENT_COLORS.length] }}>{i + 1}</div>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)" }}>@{c.card.username}</div>
                          <div style={{ fontSize: 10, color: "var(--text-3)" }}>{fmt(c.card.followers)} · {c.tier}</div>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {c.qualityScore !== null ? (
                              <>
                                <div style={{ height: 3, width: 44, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${c.qualityScore}%`, background: c.qualityScore >= 70 ? "var(--green)" : c.qualityScore >= 50 ? "#F59E0B" : "var(--red)", borderRadius: 99 }} />
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: c.qualityScore >= 70 ? "var(--green)" : c.qualityScore >= 50 ? "#F59E0B" : "var(--red)" }}>{c.qualityScore}</span>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                            )}
                            {c.completenessLabel && (
                              <span title={c.completenessLabel === "Düşük Güven" ? "Veri güveni düşük — bütçe %15 ile sınırlı" : "Yetersiz veri — skor hesaplanamadı"} style={{ fontSize: 8, fontWeight: 700, color: c.completenessLabel === "Düşük Güven" ? "#F59E0B" : "var(--red)", background: c.completenessLabel === "Düşük Güven" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)", borderRadius: 99, padding: "1px 5px", letterSpacing: "0.04em" }}>{c.completenessLabel}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 2 }}>{c.sourceLabel}</div>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "rgba(99,102,241,0.12)", color: "#6366F1", display: "inline-block", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.persona}</span>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          {c.countryMatch
                            ? <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--green)", fontWeight: 700 }}><CheckCircle size={10} color="var(--green)" />{c.card.country || "—"}</span>
                            : <span style={{ fontSize: 10, color: "var(--text-3)" }}>{c.card.country || "—"}</span>
                          }
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          {c.categoryMatch
                            ? <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--green)", fontWeight: 700 }}><CheckCircle size={10} color="var(--green)" />{c.card.category || "—"}</span>
                            : <span style={{ fontSize: 10, color: "var(--text-3)" }}>{c.card.category || "—"}</span>
                          }
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{fmt(c.estimatedReach.expected)}</div>
                          <div style={{ fontSize: 9, color: "var(--text-3)" }}>{fmt(c.estimatedReach.low)}–{fmt(c.estimatedReach.high)}</div>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)" }}>{fmtCurrency(c.allocatedBudget)}</div>
                          <div style={{ fontSize: 9, color: "var(--text-3)" }}>{c.budgetPct.toFixed(1)}%</div>
                        </td>
                        <td style={{ padding: "11px 12px" }}>
                          <ChevronDown size={13} color="var(--text-3)" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`exp-${i}`}>
                          <td colSpan={9} style={{ padding: "0" }}>
                            <div style={{ padding: "14px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Seçilme Nedeni & Kalite Analizi</div>
                              <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.65, marginBottom: 14, padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, borderLeft: "3px solid #6366F1" }}>
                                {c.whySelected}
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                                {Object.entries(c.qualityBreakdown).map(([key, val]) => (
                                  <div key={key} style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 14, fontWeight: 800, color: (val as number) >= 70 ? "var(--green)" : (val as number) >= 50 ? "#F59E0B" : "var(--red)", letterSpacing: "-0.03em" }}>{val as number}</div>
                                    <div style={{ fontSize: 9, color: "var(--text-3)", lineHeight: 1.3 }}>
                                      {key === "engagementQuality" ? "Etk. Kalitesi" : key === "countryRelevance" ? "Ülke Uyumu" : key === "categoryRelevance" ? "Kategori" : key === "fraudSafety" ? "Fraud Güv." : key === "brandSafety" ? "Marka Güv." : key === "brandFit" ? "Marka Fit" : "Büyüme"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Budget + Performance Chart ── */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16, marginBottom: 16 }}>
        {/* Budget donut */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 20px" }}>
          <SectionTitle icon={DollarSign} title="Bütçe Dağılımı" sub="Creator ağırlık algoritmasına göre" />
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={budgetChartData} cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={2} dataKey="value">
                {budgetChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v: number, _: string, p: any) => [`${v.toFixed(1)}% (${fmtCurrency(p.payload.abs)})`, p.payload.name]} contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 11, color: "var(--text-1)" }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {budgetChartData.slice(0, 6).map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                  <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 108 }}>{d.name}</span>
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{d.value.toFixed(1)}%</span>
                  <span style={{ color: "var(--text-3)" }}>{fmtCurrency(d.abs)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Creator quality + reach chart */}
        {perfData.length > 0 && (
          <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 22px" }}>
            <SectionTitle icon={BarChart2} title="Creator Kalite & Erişim" sub="Kalite skoru ve tahmini erişim karşılaştırması" />
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={perfData} barSize={22} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 11, color: "var(--text-1)" }} />
                <Bar dataKey="quality" name="Kalite Skoru" fill="var(--green)" radius={[3,3,0,0]} />
                <Bar dataKey="reach"   name="Erişim (K)"   fill="#6366F1"     radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Reach & Engagement Estimates ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Tahminsel Metrikler — Güven Aralıklı
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          {result.creators.length > 0
            ? <>
                <RangeCard label="Tahmini Erişim"     range={result.totalReach}      icon={Users}      color="#6366F1" note={result.totalReach.basis} />
                <RangeCard label="Tahmini Etkileşim"  range={result.totalEngagement}  icon={Star}       color="#F59E0B" note={result.totalEngagement.basis} />
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", borderTop: "3px solid #14B8A6" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Tahmini CPE Aralığı</div>
                  {result.estimatedCPE
                    ? <>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 6 }}>{fmtCurrency(result.estimatedCPE.low)} – {fmtCurrency(result.estimatedCPE.high)}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>Etkileşim başına maliyet tahmini · Gerçek veri ile doğrulanmalı</div>
                      </>
                    : <div style={{ fontSize: 12, color: "var(--text-3)" }}>Etkileşim verisi yetersiz</div>
                  }
                </div>
              </>
            : <>
                <UnavailableCard label="Tahmini Erişim"    reason="Creator verisi olmadan erişim tahmini yapılamaz." />
                <UnavailableCard label="Tahmini Etkileşim" reason="Creator verisi olmadan etkileşim tahmini yapılamaz." />
                <UnavailableCard label="CPE"               reason="Creator verisi olmadan CPE hesaplanamaz." />
              </>
          }
        </div>
        {/* Unavailable forecasts — transparent and trustworthy */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <UnavailableCard label="Revenue / Gelir"   reason="Geçmiş kampanya dönüşüm verisi gerektirir." />
          <UnavailableCard label="ROAS"              reason="Gerçek dönüşüm oranı olmadan hesaplanamaz." />
          <UnavailableCard label="Conversion / Satış" reason="Tarihsel CVR verisi birikene kadar gösterilmez." />
        </div>
      </div>

      {/* ── Forecast Confidence Note ── */}
      <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Shield size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", marginBottom: 4 }}>Tahmin Güvenilirlik Bildirimi</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>{result.confidence.forecastReason}</div>
        </div>
      </div>

      {/* ── Insights + Opportunities + Risks ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 20px" }}>
          <SectionTitle icon={Lightbulb} title="AI İçgörüleri" color="#6366F1" />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {result.insights.map((ins, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: "#6366F1" }}>✦</span>
                </div>
                <span>{ins}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "18px 20px" }}>
          <SectionTitle icon={TrendingUp} title="Fırsatlar" color="var(--green)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {result.opportunities.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
                <CheckCircle size={12} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{o}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid rgba(239,68,68,0.12)", padding: "18px 20px" }}>
          <SectionTitle icon={AlertTriangle} title="Risk Faktörleri" color="var(--red)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {result.risks.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
                <AlertTriangle size={12} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Next Actions ── */}
      <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.06),rgba(99,102,241,0.04))", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "20px 24px", marginBottom: 16 }}>
        <SectionTitle icon={ChevronRight} title="Önerilen Sonraki Adımlar" sub="Kampanyanızı hayata geçirmek için" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {result.nextActions.map((action, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "11px 13px", background: "var(--bg-elevated)", borderRadius: 9, border: "1px solid var(--line)", fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "#fff" }}>{i + 1}</span>
              </div>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Data Source & Confidence ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle icon={Info} title="Veri Kaynağı & Güvenilirlik" sub="Şeffaflık — hangi veriler nereden geliyor" color="var(--text-3)" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {result.dataSourceNotes.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 7, fontSize: 11, color: "var(--text-2)", lineHeight: 1.55, padding: "7px 10px", background: "var(--bg-subtle)", borderRadius: 7 }}>
              <Info size={11} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{n}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { l: "Creator Veri Kal.", v: result.confidence.creatorDataQuality },
            { l: "Kitle Uyumu",       v: result.confidence.audienceMatchConfidence },
            { l: "Ülke Eşleşmesi",    v: result.confidence.countryMatchConfidence },
            { l: "Kategori Uyumu",    v: result.confidence.categoryMatchConfidence },
            { l: "Portföy Güvenilirliği", v: result.confidence.portfolioReliability },
          ].map(({ l, v }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: v >= 70 ? "var(--green)" : v >= 50 ? "#F59E0B" : "var(--red)", letterSpacing: "-0.03em" }}>{v}</div>
              <div style={{ fontSize: 9, color: "var(--text-3)", lineHeight: 1.3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--line)" }}>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          Inflect Campaign Intelligence System · {new Date().toLocaleDateString("tr-TR")} · Güven: {result.confidence.overall}/100
        </div>
        <div style={{ display: "flex", gap: 7 }}>
          <button onClick={() => { setStep("configure"); setResult(null); setSavedId(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "var(--bg-subtle)", color: "var(--text-2)", border: "1px solid var(--line)" }}>
            <RefreshCw size={11} /> Yeni Simülasyon
          </button>
          {!savedId && (
            <button onClick={saveAsCampaign} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: saving ? "wait" : "pointer", background: "var(--green)", color: "#fff", border: "none", opacity: saving ? 0.7 : 1 }}>
              <Save size={11} /> {saving ? "Kaydediliyor..." : "Kampanya Olarak Kaydet"}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

// ── Micro-component ────────────────────────────────────────────────────────────

function Row({ l, v, bold, color }: { l: string; v: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 12, gap: 8 }}>
      <span style={{ color: "var(--text-3)", flexShrink: 0 }}>{l}</span>
      <span style={{ color: color || "var(--text-1)", fontWeight: bold ? 700 : 500, textAlign: "right" }}>{v}</span>
    </div>
  );
}
