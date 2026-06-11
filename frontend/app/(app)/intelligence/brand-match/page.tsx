"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { discoverApi } from "@/lib/api";
import {
  runBrandMatchAnalysis, BRAND_URL_SUGGESTIONS,
  type BrandMatchResult, type MatchedCreator, type BrandWebsiteEvidence,
  type EvidenceGenome, type GenomeDimensionScore,
} from "@/lib/brand-match-engine";
import {
  Sparkles, Globe, Search, ArrowRight, ChevronDown, CheckCircle,
  AlertTriangle, XCircle, RefreshCw, TrendingUp, Shield, Star,
  Lightbulb, Target, Zap, Layers, Info, Users, BarChart2, Eye,
  Brain, Dna, Activity, Compass, Database, Link2, Wifi, WifiOff,
  BadgeCheck, FlaskConical,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
function clr(score: number, lo = 60, hi = 80): string {
  return score >= hi ? "var(--green)" : score >= lo ? "#F59E0B" : "var(--red)";
}
type IconComp = React.ComponentType<{ size?: number; color?: string }>;

// ── Design tokens ──────────────────────────────────────────────────────────────
const ACCENT = ["#10B981","#6366F1","#F59E0B","#EC4899","#3B82F6","#8B5CF6","#EF4444","#14B8A6"];
const TIER_COLOR: Record<string, string> = { Micro:"#10B981", "Mid-tier":"#6366F1", Macro:"#F59E0B", Hero:"#EC4899" };
const RISK_COLOR: Record<string, string> = { Low:"var(--green)", Medium:"#F59E0B", High:"var(--red)" };
const GRADE_COLOR: Record<string, string> = { A:"var(--green)", B:"#6366F1", C:"#F59E0B", D:"var(--red)" };

// ── Mini components ────────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title, sub, color = "var(--green)" }: { icon: IconComp; title: string; sub?: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ScorePill({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color || clr(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: c, letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--text-3)", textAlign: "center", lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function ProgressBar({ value, color, height = 3 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, value)}%`, background: color, borderRadius: 99, transition: "width 0.4s" }} />
    </div>
  );
}

// ── Evidence basis colors ──────────────────────────────────────────────────────
const BASIS_COLOR: Record<string, string> = {
  "Website Evidence":    "var(--green)",
  "AI Interpretation":   "#6366F1",
  "Known Brand Profile": "#F59E0B",
  "Taxonomy Fallback":   "var(--text-3)",
  "Unavailable":         "var(--red)",
};
const CONF_COLOR: Record<string, string> = { High: "var(--green)", Medium: "#F59E0B", Low: "var(--text-3)" };

// ── Loading Steps ──────────────────────────────────────────────────────────────
const ANALYSIS_STEPS = [
  "URL doğrulanıyor ve güvenlik kontrolü yapılıyor...",
  "Marka web sitesi alınıyor ve içerik analiz ediliyor...",
  "HTML sinyalleri çıkarılıyor (başlık, meta, OG, başlıklar)...",
  "Marka Intelligence profili oluşturuluyor...",
  "Brand Genome DNA kanıt bazlı hesaplanıyor...",
  "Hedef kitle segmentleri analiz ediliyor...",
  "Creator veritabanı taranıyor...",
  "Genome Compatibility skorları hesaplanıyor...",
  "AI Brand Match algoritması çalışıyor...",
  "Portföy yapısı ve tier dağılımı optimize ediliyor...",
  "Mismatch detection çalıştırılıyor...",
  "Güven ve şeffaflık raporu derleniyor...",
];

// ── URL Autocomplete ───────────────────────────────────────────────────────────
function UrlInput({ value, onChange, onAnalyze, loading }: { value: string; onChange: (v: string) => void; onAnalyze: () => void; loading: boolean }) {
  const [open, setOpen]   = useState(false);
  const [sugs, setSugs]   = useState<string[]>([]);
  const [idx,  setIdx]    = useState(-1);
  const wrapRef           = useRef<HTMLDivElement>(null);

  const search = useCallback((v: string) => {
    const q = v.toLowerCase().replace(/https?:\/\//g, "").replace(/^www\./, "");
    setSugs(q.length >= 1 ? BRAND_URL_SUGGESTIONS.filter(s => s.includes(q)).slice(0, 6) : []);
    setOpen(true);
  }, []);

  const pick = (s: string) => { onChange(s); setOpen(false); setIdx(-1); };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, sugs.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setIdx(i => Math.max(i - 1, -1)); }
    if (e.key === "Enter")     { e.preventDefault(); idx >= 0 ? pick(sugs[idx]) : onAnalyze(); }
    if (e.key === "Escape")    { setOpen(false); }
  };

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 520 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Globe size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <input
            value={value}
            onChange={e => { onChange(e.target.value); search(e.target.value); }}
            onKeyDown={onKey}
            onFocus={() => value && search(value)}
            placeholder="nike.com"
            autoComplete="off"
            style={{
              width: "100%", padding: "14px 16px 14px 42px",
              borderRadius: 12, fontSize: 16, fontWeight: 500,
              border: "1.5px solid var(--line)", background: "var(--bg-elevated)",
              color: "var(--text-1)", outline: "none", transition: "border 0.15s",
            }}
            onFocusCapture={e => (e.currentTarget.style.borderColor = "var(--green)")}
            onBlurCapture={e =>  (e.currentTarget.style.borderColor = "var(--line)")}
          />
        </div>
        <button onClick={onAnalyze} disabled={loading || !value.trim()} style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px",
          borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: loading || !value.trim() ? "not-allowed" : "pointer",
          background: value.trim() ? "linear-gradient(135deg,var(--green),#34D399)" : "var(--bg-subtle)",
          color: value.trim() ? "#fff" : "var(--text-3)", border: "none",
          boxShadow: value.trim() ? "0 8px 24px rgba(16,185,129,0.35)" : "none",
          transition: "all 0.2s", opacity: loading ? 0.7 : 1,
        }}>
          {loading ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <><Brain size={16} /> Analiz Et</>}
        </button>
      </div>
      {open && sugs.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.22)", overflow: "hidden", zIndex: 50 }}>
          {sugs.map((s, i) => (
            <button key={s} onMouseDown={e => { e.preventDefault(); pick(s); }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px",
              background: i === idx ? "var(--green-bg)" : "transparent", border: "none", borderBottom: i < sugs.length - 1 ? "1px solid var(--line)" : "none", cursor: "pointer", textAlign: "left",
            }}>
              <Globe size={13} color={i === idx ? "var(--green)" : "var(--text-3)"} />
              <span style={{ fontSize: 13, fontWeight: 500, color: i === idx ? "var(--green)" : "var(--text-1)" }}>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Genome Radar Chart ─────────────────────────────────────────────────────────
const GENOME_LABELS = [
  { key: "performance",     label: "Performans" },
  { key: "trust",           label: "Güven" },
  { key: "luxury",          label: "Lüks" },
  { key: "innovation",      label: "İnovasyon" },
  { key: "lifestyle",       label: "Yaşam Tarzı" },
  { key: "education",       label: "Eğitim" },
  { key: "entertainment",   label: "Eğlence" },
  { key: "authority",       label: "Otorite" },
  { key: "community",       label: "Topluluk" },
  { key: "competitiveness", label: "Rekabetçilik" },
];

function GenomeRadar({ brand, creator }: { brand: Record<string, number>; creator?: Record<string, number> }) {
  const data = GENOME_LABELS.map(({ key, label }) => ({
    subject: label,
    Marka: brand[key] || 0,
    ...(creator ? { Creator: creator[key] || 0 } : {}),
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--line)" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "var(--text-3)" }} />
        <Radar name="Marka" dataKey="Marka" stroke="var(--green)" fill="var(--green)" fillOpacity={0.18} strokeWidth={2} />
        {creator && <Radar name="Creator" dataKey="Creator" stroke="#6366F1" fill="#6366F1" fillOpacity={0.12} strokeWidth={2} />}
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
type PageState = "landing" | "analyzing" | "report";

export default function BrandMatchPage() {
  const [state,        setState]        = useState<PageState>("landing");
  const [url,          setUrl]          = useState("");
  const [targetMarket, setTargetMarket] = useState("Global");
  const [competitorUrl,setCompetitorUrl]= useState("");
  const [result,       setResult]       = useState<BrandMatchResult | null>(null);
  const [step,         setStep]         = useState(0);
  const [err,          setErr]          = useState("");
  const [expanded,     setExpanded]     = useState<number | null>(null);
  const [history,      setHistory]      = useState<string[]>([]);
  const [genomeCreator,setGenomeCreator]= useState<MatchedCreator | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("brand_match_history") || "[]");
      setHistory(stored.slice(0, 5));
    } catch { /* ignore */ }
  }, []);

  async function runAnalysis() {
    const cleaned = url.trim();
    if (!cleaned) { setErr("Lütfen bir marka URL'si girin."); return; }
    setErr(""); setState("analyzing"); setStep(0);

    // Animated steps
    let si = 0;
    const tick = () => {
      si++;
      if (si < ANALYSIS_STEPS.length) {
        setStep(si);
        setTimeout(tick, 340 + Math.random() * 160);
      }
    };
    setTimeout(tick, 300);

    // Fetch creators + website evidence in parallel
    let raw: import("@/lib/api").DiscoveryCard[] = [];
    let websiteEvidence: BrandWebsiteEvidence | undefined;

    await Promise.allSettled([
      // Creator fetch
      (async () => {
        try {
          const r1 = await discoverApi.feed({ limit: 50, min_brand_fit: 20, max_fraud: 75 });
          raw = r1.items;
          if (raw.length < 5) {
            const r2 = await discoverApi.feed({ limit: 30 });
            const existing = new Set(raw.map(c => `${c.username}::${c.platform}`));
            raw = [...raw, ...r2.items.filter(c => !existing.has(`${c.username}::${c.platform}`))];
          }
        } catch { /* empty DB handled gracefully */ }
      })(),
      // Website evidence fetch via server-side API route
      (async () => {
        try {
          const resp = await fetch("/api/intelligence/brand/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: cleaned.startsWith("http") ? cleaned : `https://${cleaned}`, targetMarket }),
          });
          if (resp.ok) {
            websiteEvidence = await resp.json() as BrandWebsiteEvidence;
          }
        } catch { /* evidence unavailable — gracefully degrade */ }
      })(),
    ]);

    const res = runBrandMatchAnalysis(cleaned, raw, {
      websiteEvidence,
      targetMarket,
      competitorUrl: competitorUrl.trim() || undefined,
    });

    await new Promise(r => setTimeout(r, 2400));

    // Save to history
    const newHistory = [cleaned, ...history.filter(h => h !== cleaned)].slice(0, 5);
    setHistory(newHistory);
    try { localStorage.setItem("brand_match_history", JSON.stringify(newHistory)); } catch { /* ignore */ }

    setResult(res);
    setState("report");
  }

  // ── LANDING ──────────────────────────────────────────────────────────────────

  if (state === "landing") {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", padding: "52px 0 44px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 16px", borderRadius: 99, background: "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(99,102,241,0.08))", border: "1px solid rgba(16,185,129,0.2)", marginBottom: 18 }}>
            <Dna size={12} color="var(--green)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", letterSpacing: "0.07em" }}>AI BRAND MATCH™ · INFLECT INTELLIGENCE</span>
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, margin: "0 0 16px", letterSpacing: "-0.05em", color: "var(--text-1)", lineHeight: 1.05 }}>
            AI Brand Match<sup style={{ fontSize: 22, fontWeight: 700, verticalAlign: "super" }}>™</sup>
          </h1>
          <p style={{ fontSize: 20, fontWeight: 500, color: "var(--text-3)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            Paste a website. Get the perfect creator strategy.
          </p>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 40px", maxWidth: 520, marginInline: "auto", lineHeight: 1.7 }}>
            Brand Genome Analysis, Genome Compatibility™ ve AI-powered creator matching ile
            markanızın DNA'sını anlayan bir intelligence raporu.
          </p>

          {err && (
            <div style={{ padding: "10px 16px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 9, fontSize: 13, marginBottom: 16, border: "1px solid rgba(239,68,68,0.2)", maxWidth: 520, marginInline: "auto" }}>{err}</div>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <UrlInput value={url} onChange={setUrl} onAnalyze={runAnalysis} loading={false} />
          </div>

          {/* Target Market + Competitor URL */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--line)" }}>
              <Globe size={13} color="var(--text-3)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)" }}>Hedef Pazar:</span>
              <select
                value={targetMarket}
                onChange={e => setTargetMarket(e.target.value)}
                style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", background: "transparent", border: "none", outline: "none", cursor: "pointer" }}
              >
                {["Global","Turkey","USA","UK","Germany"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--line)", minWidth: 280 }}>
              <Link2 size={13} color="var(--text-3)" />
              <input
                value={competitorUrl}
                onChange={e => setCompetitorUrl(e.target.value)}
                placeholder="Rakip URL (isteğe bağlı, örn. competitor.com)"
                style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)", background: "transparent", border: "none", outline: "none", flex: 1 }}
              />
            </div>
          </div>

          {/* Recent history */}
          {history.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>Son Analizler</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {history.map(h => (
                  <button key={h} onClick={() => setUrl(h)} style={{ padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: "pointer", background: "var(--bg-elevated)", border: "1px solid var(--line)", color: "var(--text-2)", transition: "all 0.12s" }}>{h}</button>
                ))}
              </div>
            </div>
          )}

          {/* Feature pills */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { icon: Dna, label: "Brand Genome DNA" },
              { icon: Activity, label: "Genome Compatibility™" },
              { icon: Users, label: "AI Creator Matching" },
              { icon: Shield, label: "Mismatch Detection" },
              { icon: Compass, label: "Expansion Intelligence" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 99, background: "var(--bg-elevated)", border: "1px solid var(--line)", fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>
                <Icon size={12} color="var(--green)" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Example brands */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--line)", padding: "24px 28px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>Hızlı Başlat</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { url: "nike.com",       label: "Nike",       sub: "Sportswear" },
              { url: "myprotein.com",  label: "MyProtein",  sub: "Supplement" },
              { url: "samsung.com",    label: "Samsung",    sub: "Technology" },
              { url: "zara.com",       label: "Zara",       sub: "Fashion" },
              { url: "cerave.com",     label: "CeraVe",     sub: "Skincare" },
              { url: "gymshark.com",   label: "Gymshark",   sub: "Fitness" },
              { url: "playstation.com",label: "PlayStation",sub: "Gaming" },
              { url: "airbnb.com",     label: "Airbnb",     sub: "Travel" },
            ].map(({ url: u, label, sub }) => (
              <button key={u} onClick={() => { setUrl(u); }} style={{
                padding: "12px 16px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                background: "var(--bg-subtle)", border: "1px solid var(--line)",
                transition: "all 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.4)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--green-bg)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-subtle)"; }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)" }}>{u} · {sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── ANALYZING ─────────────────────────────────────────────────────────────────

  if (state === "analyzing") {
    return (
      <div style={{ maxWidth: 580, margin: "0 auto", paddingTop: 52, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg,var(--green-bg),rgba(99,102,241,0.12))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px", boxShadow: "0 0 0 14px rgba(16,185,129,0.06)" }}>
          <Brain size={30} color="var(--green)" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.04em", color: "var(--text-1)" }}>AI Brand Match Çalışıyor...</h2>
        <div style={{ fontSize: 14, color: "var(--green)", fontWeight: 600, marginBottom: 8 }}>{url}</div>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 32px" }}>Brand Genome DNA hesaplanıyor · Creator matching çalışıyor</p>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 24px", textAlign: "left" }}>
          {ANALYSIS_STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < ANALYSIS_STEPS.length - 1 ? "1px solid var(--line)" : "none" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: i < step ? "var(--green)" : i === step ? "var(--green-bg)" : "var(--bg-subtle)", border: i === step ? "2px solid var(--green)" : "none", transition: "all 0.3s" }}>
                {i < step
                  ? <CheckCircle size={11} color="#fff" />
                  : i === step
                  ? <RefreshCw size={10} color="var(--green)" style={{ animation: "spin 1s linear infinite" }} />
                  : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--bg-muted)", display: "block" }} />
                }
              </div>
              <span style={{ fontSize: 12, color: i < step ? "var(--text-3)" : i === step ? "var(--text-1)" : "var(--text-3)", fontWeight: i <= step ? 500 : 400, textDecoration: i < step ? "line-through" : "none" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── REPORT ─────────────────────────────────────────────────────────────────────
  if (!result) return null;
  const {
    brand, genome, tone, audience, creators, portfolio, overlap, mismatches, expansions,
    confidence, insights, risks, opportunities, nextActions, summary, dataSourceNotes,
    websiteEvidence, evidenceGenome, creatorCoverage, targetMarket: resultTargetMarket,
  } = result;

  const genomeChartData = GENOME_LABELS.map(({ key, label }) => ({
    subject: label,
    Marka:   (genome as any)[key] || 0,
  }));
  const dnaCardData = GENOME_LABELS.map(({ key, label }) => ({ label, value: (genome as any)[key] as number })).sort((a, b) => b.value - a.value);

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* ── Report header ── */}
      <div style={{ background: "linear-gradient(135deg,var(--bg-elevated),rgba(16,185,129,0.04),rgba(99,102,241,0.03))", borderRadius: 16, border: "1px solid var(--line)", padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px", borderRadius: 99, background: "var(--green-bg)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <CheckCircle size={11} color="var(--green)" />
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--green)" }}>AI Brand Match™ Report · {new Date().toLocaleDateString("tr-TR")}</span>
              </div>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(99,102,241,0.12)", color: "#6366F1", fontWeight: 700 }}>{brand.detectedFrom === "url_lookup" ? "✓ Verified" : brand.detectedFrom === "taxonomy" ? "~ Taxonomy" : "~ Extracted"}</span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, margin: "0 0 6px", letterSpacing: "-0.04em", color: "var(--text-1)" }}>{brand.name}</h1>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-3)" }}>
              <span>{brand.industry}</span>
              <span>·</span>
              <span>{brand.positioning}</span>
              <span>·</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Globe size={11} />{brand.geoScope}</span>
              <span>·</span>
              <span>{brand.marketTier}</span>
              <span>·</span>
              <span>{brand.maturity}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "8px 16px", borderRadius: 10, background: `${GRADE_COLOR[confidence.grade]}14`, border: `1px solid ${GRADE_COLOR[confidence.grade]}28` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Güven</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: GRADE_COLOR[confidence.grade], letterSpacing: "-0.04em" }}>{confidence.grade} · {confidence.overall}</div>
              </div>
              <div style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Creator</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#6366F1", letterSpacing: "-0.04em" }}>{creators.length}</div>
              </div>
            </div>
            <button onClick={() => { setState("landing"); setResult(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "var(--bg-subtle)", color: "var(--text-2)", border: "1px solid var(--line)" }}>
              <RefreshCw size={11} /> Yeni Analiz
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "14px 0 0", lineHeight: 1.7, padding: "12px 16px", background: "rgba(16,185,129,0.05)", borderRadius: 9, borderLeft: "3px solid var(--green)" }}>{summary}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {brand.brandPersonality.map(p => (
            <span key={p} style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 99, background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)" }}>{p}</span>
          ))}
        </div>
      </div>

      {/* ── Brand Evidence Panel ── */}
      {websiteEvidence && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: `1px solid ${websiteEvidence.fetchStatus === "success" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, padding: "18px 22px", marginBottom: 16 }}>
          <SectionTitle icon={FlaskConical} title="Brand Website Evidence" sub={`Veri kaynağı şeffaflığı · Her kanıt etiketlenmiştir`} color={websiteEvidence.fetchStatus === "success" ? "var(--green)" : "var(--red)"} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {/* Fetch status */}
            <div style={{ padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                {websiteEvidence.fetchStatus === "success" ? <Wifi size={12} color="var(--green)" /> : <WifiOff size={12} color="var(--red)" />}
                <span style={{ fontSize: 11, fontWeight: 700, color: websiteEvidence.fetchStatus === "success" ? "var(--green)" : "var(--red)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {websiteEvidence.fetchStatus === "success" ? "Web Sitesi Alındı" : websiteEvidence.fetchStatus === "timeout" ? "Zaman Aşımı" : websiteEvidence.fetchStatus === "invalid_url" ? "Geçersiz URL" : "Erişim Hatası"}
                </span>
              </div>
              {websiteEvidence.responseTimeMs && <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4 }}>Yanıt süresi: {websiteEvidence.responseTimeMs}ms</div>}
              {websiteEvidence.fetchError && <div style={{ fontSize: 10, color: "var(--red)", lineHeight: 1.5 }}>{websiteEvidence.fetchError}</div>}
              {websiteEvidence.language && <div style={{ fontSize: 10, color: "var(--text-3)" }}>Dil: <strong style={{ color: "var(--text-2)" }}>{websiteEvidence.language}</strong></div>}
              {websiteEvidence.fetchStatus !== "success" && (
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, fontStyle: "italic" }}>Web kanıtı yok — analiz Bilinen Marka Profili veya Taksonomi bazlı</div>
              )}
              {websiteEvidence.aiUsed && (
                <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#6366F1" }}>AI Enhanced · {websiteEvidence.aiProvider}</span>
                </div>
              )}
            </div>

            {/* Extracted signals */}
            <div style={{ padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Çıkarılan Sinyaller</div>
              {websiteEvidence.pageTitle && <div style={{ fontSize: 11, color: "var(--text-1)", fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{websiteEvidence.pageTitle.slice(0, 60)}</div>}
              {websiteEvidence.metaDescription && <div style={{ fontSize: 10, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 6 }}>{websiteEvidence.metaDescription.slice(0, 120)}</div>}
              {(websiteEvidence.h1s || []).length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 3 }}>H1:</div>
                  {(websiteEvidence.h1s || []).slice(0, 2).map((h, i) => (
                    <div key={i} style={{ fontSize: 10, color: "var(--text-2)", fontStyle: "italic" }}>"{h.slice(0, 60)}"</div>
                  ))}
                </div>
              )}
              {(websiteEvidence.keywordHints || []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {(websiteEvidence.keywordHints || []).slice(0, 8).map(kw => (
                    <span key={kw} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "rgba(16,185,129,0.08)", color: "var(--green)", fontWeight: 600 }}>{kw}</span>
                  ))}
                </div>
              )}
            </div>

            {/* AI signals or social links */}
            <div style={{ padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 10, border: "1px solid var(--line)" }}>
              {websiteEvidence.aiUsed ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>AI Sinyalleri</div>
                  {websiteEvidence.aiPositioning && <div style={{ fontSize: 11, color: "var(--text-1)", fontWeight: 600, marginBottom: 8, lineHeight: 1.5, padding: "6px 8px", background: "rgba(99,102,241,0.06)", borderRadius: 6 }}>{websiteEvidence.aiPositioning}</div>}
                  {(websiteEvidence.aiToneSignals || []).length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 4 }}>Ton:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(websiteEvidence.aiToneSignals || []).map(s => <span key={s} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "rgba(99,102,241,0.1)", color: "#6366F1", fontWeight: 600 }}>{s}</span>)}
                      </div>
                    </div>
                  )}
                  {(websiteEvidence.aiAudienceSignals || []).length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 4 }}>Kitle:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(websiteEvidence.aiAudienceSignals || []).map(s => <span key={s} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "rgba(16,185,129,0.1)", color: "var(--green)", fontWeight: 600 }}>{s}</span>)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Veri Şeffaflığı</div>
                  {(websiteEvidence.socialLinks || []).length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 4 }}>Sosyal Bağlantılar:</div>
                      {(websiteEvidence.socialLinks || []).slice(0, 3).map((s, i) => <div key={i} style={{ fontSize: 10, color: "#6366F1", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</div>)}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.6, fontStyle: "italic" }}>
                    {websiteEvidence.fetchStatus === "success"
                      ? "AI analizi yapılandırılmamış. Web içeriği kural bazlı analiz edildi."
                      : "Web sitesi alınamadı. Genome analizi Bilinen Marka Profili veya Taksonomi'ye dayalı."}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 9, padding: "4px 8px", borderRadius: 6, background: "rgba(245,158,11,0.08)", color: "#F59E0B", fontWeight: 600 }}>
                    AI için: BRAND_ANALYSIS_PROVIDER env var'ı ayarlayın
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Hedef Pazar */}
          {resultTargetMarket && resultTargetMarket !== "Global" && (
            <div style={{ marginTop: 10, padding: "8px 14px", background: "rgba(99,102,241,0.06)", borderRadius: 8, border: "1px solid rgba(99,102,241,0.15)", fontSize: 11, color: "#6366F1", fontWeight: 600 }}>
              Hedef Pazar: <strong>{resultTargetMarket}</strong> · Country match skoru bu pazara göre ağırlıklandırıldı
            </div>
          )}
        </div>
      )}

      {/* ── Brand Genome + Tone ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Genome Radar */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
          <SectionTitle icon={Dna} title="Brand Genome DNA" sub={genome.summary} color="#6366F1" />
          <GenomeRadar brand={Object.fromEntries(GENOME_LABELS.map(({ key }) => [key, (genome as any)[key]]))} creator={genomeCreator ? Object.fromEntries(GENOME_LABELS.map(({ key }) => [key, (genomeCreator.creatorGenome as any)[key]])) : undefined} />
          {genomeCreator && (
            <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-3)", textAlign: "center" }}>
              Yeşil = {brand.name} · Mor = @{genomeCreator.card.username} · Genome Uyumu: <span style={{ color: "var(--green)", fontWeight: 700 }}>{genomeCreator.scores.genomeCompatibility}/100</span>
            </div>
          )}
        </div>

        {/* Evidence-annotated DNA Boyutları */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px", overflowY: "auto", maxHeight: 380 }}>
          <SectionTitle icon={Activity} title="DNA Boyutları · Kanıt" sub={`${evidenceGenome.summary.slice(0, 60)}...`} color="#6366F1" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {GENOME_LABELS.map(({ key, label }) => {
              const dim = evidenceGenome[key as keyof typeof evidenceGenome] as GenomeDimensionScore | undefined;
              if (!dim || typeof dim !== "object") return null;
              const basisColor = BASIS_COLOR[dim.basis] || "var(--text-3)";
              return (
                <div key={key} style={{ padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--line)", borderLeft: `3px solid ${basisColor}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-1)" }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: `${basisColor}14`, color: basisColor, fontWeight: 700 }}>{dim.basis}</span>
                      <span style={{ fontSize: 9, color: CONF_COLOR[dim.confidence] || "var(--text-3)", fontWeight: 700 }}>{dim.confidence}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: clr(dim.value, 50, 70), minWidth: 24, textAlign: "right" }}>{dim.value}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <ProgressBar value={dim.value} color={basisColor} height={3} />
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 3, lineHeight: 1.4 }}>{dim.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Audience + Tone ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Audience Intelligence */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
          <SectionTitle icon={Users} title="Hedef Kitle İstihbaratı" sub="Marka profili ve kategori bazlı kitle analizi" />
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
            <KVRow l="Birincil Kitle"    v={audience.primaryAudience} />
            <KVRow l="İkincil Kitle"     v={audience.secondaryAudience} />
            <KVRow l="Cinsiyet Eğilimi"  v={audience.genderTendency} />
            <KVRow l="Satın Alma Niyeti" v={audience.purchaseIntent === "High" ? "Yüksek" : audience.purchaseIntent === "Medium" ? "Orta" : "Düşük"} color={audience.purchaseIntent === "High" ? "var(--green)" : audience.purchaseIntent === "Medium" ? "#F59E0B" : "var(--red)"} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Yaş Dağılımı</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {audience.ageDistribution.map(({ segment, pct }) => (
                <div key={segment} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 40, fontSize: 10, color: "var(--text-3)", flexShrink: 0 }}>{segment}</span>
                  <ProgressBar value={pct} color="var(--green)" height={5} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-1)", width: 28, textAlign: "right", flexShrink: 0 }}>{pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>İlgi Kümeleri</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {audience.interestClusters.map(ic => (
                <span key={ic} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(16,185,129,0.1)", color: "var(--green)", border: "1px solid rgba(16,185,129,0.2)" }}>{ic}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Brand Tone */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
          <SectionTitle icon={Zap} title="Marka Sesi & Tonu" sub="Creator brief ve içerik yönlendirmesi için" color="#F59E0B" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ padding: "14px 16px", background: "rgba(16,185,129,0.08)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Birincil Ton</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--green)" }}>{tone.primary}</div>
            </div>
            <div style={{ padding: "14px 16px", background: "rgba(99,102,241,0.08)", borderRadius: 10, border: "1px solid rgba(99,102,241,0.2)", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>İkincil Ton</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#6366F1" }}>{tone.secondary}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.65, marginBottom: 14, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 8 }}>{tone.summary}</div>
          {tone.avoid.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>Kaçınılması Gereken Tonlar</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {tone.avoid.map(a => (
                  <span key={a} style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(239,68,68,0.08)", color: "var(--red)", border: "1px solid rgba(239,68,68,0.18)" }}>✕ {a}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>Platform Önceliği</div>
            <div style={{ display: "flex", gap: 6 }}>
              {audience.platformPriorities.map((p, i) => (
                <span key={p} style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: i === 0 ? "var(--green)" : i === 1 ? "rgba(99,102,241,0.2)" : "var(--bg-subtle)", color: i === 0 ? "#fff" : i === 1 ? "#6366F1" : "var(--text-2)", border: i > 0 ? "1px solid var(--line)" : "none" }}>{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top Creator Matches table ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionTitle icon={Star} title="Top Creator Matches" sub={creators.length > 0 ? `${creators.length} creator · Genome Compatibility™ ile sıralandı` : "Creator veritabanında veri yok"} />
          {genomeCreator && (
            <button onClick={() => setGenomeCreator(null)} style={{ fontSize: 11, color: "var(--text-3)", background: "var(--bg-subtle)", border: "1px solid var(--line)", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>Genome karşılaştırmayı temizle</button>
          )}
        </div>
        {creators.length === 0 ? (
          <div style={{ padding: "40px 22px", textAlign: "center" }}>
            <Brain size={28} style={{ display: "block", margin: "0 auto 10px", opacity: 0.25 }} color="var(--text-3)" />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Creator verisi yok</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>Brand Genome analizi tamamlandı. Creator eşleşmesi için Discovery'de influencer analizi yapın.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                  {["#","Creator","Tier","Final Match","Genome","Kitle","Kategori","Neden Seçildi?","Risk","Karşılaştır"].map(h => (
                    <th key={h} style={{ padding: "9px 11px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creators.map((c, i) => {
                  const exp = expanded === i;
                  return (
                    <>
                      <tr key={c.card.id} onClick={() => setExpanded(exp ? null : i)} style={{ borderBottom: "1px solid var(--line)", cursor: "pointer", background: c.isMismatch ? "rgba(239,68,68,0.03)" : "transparent" }}>
                        <td style={{ padding: "10px 11px" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${ACCENT[i % ACCENT.length]}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: ACCENT[i % ACCENT.length] }}>{i + 1}</div>
                        </td>
                        <td style={{ padding: "10px 11px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: c.isMismatch ? "var(--text-3)" : "var(--text-1)" }}>@{c.card.username}</div>
                          <div style={{ fontSize: 10, color: "var(--text-3)" }}>{fmt(c.card.followers)} · {c.card.platform}</div>
                        </td>
                        <td style={{ padding: "10px 11px" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: `${TIER_COLOR[c.tier]}18`, color: TIER_COLOR[c.tier] }}>{c.tier}</span>
                        </td>
                        <td style={{ padding: "10px 11px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <ProgressBar value={c.scores.final} color={clr(c.scores.final, 55, 75)} height={3} />
                            <span style={{ fontSize: 12, fontWeight: 800, color: clr(c.scores.final, 55, 75), flexShrink: 0, minWidth: 24 }}>{c.scores.final}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 11px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: clr(c.scores.genomeCompatibility, 55, 75) }}>{c.scores.genomeCompatibility}</span>
                        </td>
                        <td style={{ padding: "10px 11px" }}>
                          <span style={{ fontSize: 11, color: "var(--text-2)" }}>{c.scores.audienceMatch}</span>
                        </td>
                        <td style={{ padding: "10px 11px" }}>
                          <span style={{ fontSize: 11, color: "var(--text-2)" }}>{c.scores.categoryRelevance}</span>
                        </td>
                        <td style={{ padding: "10px 11px", maxWidth: 180 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {c.topMatchReasons.length > 0
                              ? c.topMatchReasons.map((r, ri) => (
                                  <span key={ri} style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: ri === 0 ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.1)", color: ri === 0 ? "var(--green)" : "#6366F1", whiteSpace: "nowrap" }}>{r}</span>
                                ))
                              : <span style={{ fontSize: 9, color: "var(--text-3)", fontStyle: "italic" }}>—</span>
                            }
                          </div>
                        </td>
                        <td style={{ padding: "10px 11px" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: RISK_COLOR[c.riskLevel], background: `${RISK_COLOR[c.riskLevel]}12`, padding: "2px 7px", borderRadius: 99 }}>{c.riskLevel === "High" ? "Yüksek" : c.riskLevel === "Medium" ? "Orta" : "Düşük"}</span>
                        </td>
                        <td style={{ padding: "10px 11px" }}>
                          <button onClick={e => { e.stopPropagation(); setGenomeCreator(c); }} style={{ fontSize: 10, color: "var(--text-3)", background: genomeCreator?.card.id === c.card.id ? "var(--green-bg)" : "var(--bg-subtle)", border: `1px solid ${genomeCreator?.card.id === c.card.id ? "rgba(16,185,129,0.3)" : "var(--line)"}`, borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
                            <Dna size={10} color={genomeCreator?.card.id === c.card.id ? "var(--green)" : "var(--text-3)"} />
                          </button>
                        </td>
                      </tr>
                      {exp && (
                        <tr key={`exp-${i}`}>
                          <td colSpan={10} style={{ padding: 0 }}>
                            <div style={{ padding: "14px 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--line)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Seçilme Analizi · Genome Uyumu Detayı</div>
                                <span style={{ fontSize: 10, color: "#6366F1", fontWeight: 600 }}>Persona: {c.persona}</span>
                              </div>
                              <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.65, margin: "0 0 12px", padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: 8, borderLeft: `3px solid ${c.isMismatch ? "var(--red)" : "#6366F1"}` }}>{c.whySelected}</p>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                                {[["Genome", c.scores.genomeCompatibility], ["Kitle", c.scores.audienceMatch], ["Kategori", c.scores.categoryRelevance], ["Persona", c.scores.personaMatch], ["Kalite", c.scores.qualityScore], ["Güven", c.scores.trustScore], ["Ülke", c.scores.countryMatch]].map(([label, val]) => (
                                  <div key={label} style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: clr(val as number, 50, 70), letterSpacing: "-0.03em" }}>{val}</div>
                                    <div style={{ fontSize: 9, color: "var(--text-3)" }}>{label}</div>
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

      {/* ── Creator Database Coverage Panel ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: `1px solid ${creatorCoverage.coverageScore >= 70 ? "rgba(16,185,129,0.2)" : creatorCoverage.coverageScore >= 40 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`, padding: "18px 22px", marginBottom: 16 }}>
        <SectionTitle icon={Database} title="Creator Veritabanı Kapsamı" sub={`${creatorCoverage.total} creator analiz edildi · Veri kalitesi şeffaflığı`} color={creatorCoverage.coverageScore >= 70 ? "var(--green)" : creatorCoverage.coverageScore >= 40 ? "#F59E0B" : "var(--red)"} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 12 }}>
          {[
            { label: "Toplam Creator", value: creatorCoverage.total, isNum: true },
            { label: "Ülke Verisi", value: creatorCoverage.withCountry, isNum: true },
            { label: "Kategori Verisi", value: creatorCoverage.withCategory, isNum: true },
            { label: "Engagement Kalitesi", value: creatorCoverage.withEngagementData, isNum: true },
            { label: "Fraud Verisi", value: creatorCoverage.withFraudData, isNum: true },
            { label: "Kapsam Skoru", value: creatorCoverage.coverageScore, isNum: false },
          ].map(({ label, value, isNum }) => (
            <div key={label} style={{ textAlign: "center", padding: "10px 8px", background: "var(--bg-subtle)", borderRadius: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: isNum ? "var(--text-1)" : clr(value, 40, 70), letterSpacing: "-0.03em" }}>{value}{!isNum ? "" : ""}</div>
              <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 2, lineHeight: 1.3 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.6, padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: 8, marginBottom: creatorCoverage.limitation ? 8 : 0 }}>
          {creatorCoverage.coverageNote}
        </div>
        {creatorCoverage.limitation && (
          <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#F59E0B", padding: "8px 12px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)" }}>
            <AlertTriangle size={12} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
            {creatorCoverage.limitation}
          </div>
        )}
      </div>

      {/* ── Portfolio + Overlap ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Portfolio */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
          <SectionTitle icon={Layers} title="Önerilen Creator Portföyü" sub={portfolio.strategy} color="#F59E0B" />
          {portfolio.tiers.map(t => (
            <div key={t.label} style={{ background: "var(--bg-subtle)", borderRadius: 10, border: `1px solid ${t.color}22`, borderLeft: `3px solid ${t.color}`, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.color }}>{t.label}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-1)" }}>{t.budgetPct}% bütçe</span>
                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>{t.count} creator</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{t.rationale}</div>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <ScorePill label="Portföy Çeşitliliği" value={portfolio.diversity} />
            <ScorePill label="Portföy Verimliliği" value={portfolio.efficiency} />
          </div>
        </div>

        {/* Audience Overlap */}
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
          <SectionTitle icon={Eye} title="Kitle Örtüşme Analizi" sub="Seçilen creator'lar arası tahmini overlap" color={RISK_COLOR[overlap.saturationRisk]} />
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, padding: "16px", background: "var(--bg-subtle)", borderRadius: 10, border: `1px solid ${RISK_COLOR[overlap.saturationRisk]}22`, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: RISK_COLOR[overlap.saturationRisk], letterSpacing: "-0.04em" }}>{overlap.estimatedOverlapPct}%</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>Tahmini Örtüşme</div>
            </div>
            <div style={{ flex: 1, padding: "16px", background: "var(--bg-subtle)", borderRadius: 10, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-1)", letterSpacing: "-0.04em" }}>{overlap.effectiveReachMultiplier}×</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>Efektif Erişim Çarpanı</div>
            </div>
          </div>
          <div style={{ padding: "8px 12px", background: `${RISK_COLOR[overlap.saturationRisk]}08`, borderRadius: 8, border: `1px solid ${RISK_COLOR[overlap.saturationRisk]}20`, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: RISK_COLOR[overlap.saturationRisk], marginBottom: 4 }}>
              {overlap.saturationRisk === "High" ? "⚠ Yüksek Doygunluk Riski" : overlap.saturationRisk === "Medium" ? "Orta Doygunluk" : "Düşük Örtüşme — İyi"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
              Bu tahmin kategori çeşitliliğine dayalıdır. Gerçek kitle datası olmadan kesin değer hesaplanamaz.
            </div>
          </div>
          {overlap.warnings.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, padding: "8px 10px", background: "rgba(245,158,11,0.06)", borderRadius: 7, marginBottom: 5 }}>
              <AlertTriangle size={12} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
              {w}
            </div>
          ))}
          {overlap.warnings.length === 0 && (
            <div style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--text-2)", padding: "8px 10px", background: "rgba(16,185,129,0.06)", borderRadius: 7 }}>
              <CheckCircle size={12} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} />
              Creator portföyü kitle çeşitliliği açısından makul görünüyor.
            </div>
          )}
        </div>
      </div>

      {/* ── Mismatch Warnings ── */}
      {mismatches.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", padding: "20px 22px", marginBottom: 16 }}>
          <SectionTitle icon={XCircle} title={`Brand Mismatch Tespiti (${mismatches.length})`} sub="Yüksek takipçili ancak düşük brand uyumlu creator'lar" color="var(--red)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {mismatches.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", background: "rgba(239,68,68,0.05)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)", alignItems: "flex-start" }}>
                <XCircle size={14} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 3 }}>@{m.creator.username} · {fmt(m.creator.followers)} takipçi · Risk: {m.riskScore}/100</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 6 }}>{m.reason}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {m.signals.map(s => (
                      <span key={s} style={{ fontSize: 10, color: "var(--red)", background: "rgba(239,68,68,0.08)", padding: "1px 7px", borderRadius: 99, fontWeight: 600 }}>{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Expansion Opportunities ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px", marginBottom: 16 }}>
        <SectionTitle icon={Compass} title="Büyüme & Expansion Fırsatları" sub="Dokunulmamış kitle segmentleri ve yeni creator kategorileri" color="#6366F1" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {expansions.map((exp, i) => (
            <div key={i} style={{ padding: "14px 16px", background: "var(--bg-subtle)", borderRadius: 10, border: "1px solid var(--line)", borderTop: `3px solid ${exp.priority === "High" ? "var(--green)" : "#6366F1"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: exp.priority === "High" ? "var(--green)" : "#6366F1" }}>{exp.priority === "High" ? "Yüksek Öncelik" : "Orta Öncelik"}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", marginBottom: 5 }}>{exp.segment}</div>
              <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 8 }}>{exp.opportunity}</div>
              <div style={{ fontSize: 10, color: "var(--text-3)", borderTop: "1px solid var(--line)", paddingTop: 8 }}>Creator Tipi: <strong style={{ color: "var(--text-2)" }}>{exp.creatorType}</strong></div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Insights + Risks + Opportunities ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 20px" }}>
          <SectionTitle icon={Lightbulb} title="AI İçgörüleri" color="#6366F1" />
          {insights.map((ins, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 10 }}>
              <span style={{ color: "#6366F1", flexShrink: 0 }}>›</span> {ins}
            </div>
          ))}
        </div>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "18px 20px" }}>
          <SectionTitle icon={TrendingUp} title="Fırsatlar" color="var(--green)" />
          {opportunities.map((o, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 10 }}>
              <CheckCircle size={12} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} /> {o}
            </div>
          ))}
        </div>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid rgba(239,68,68,0.12)", padding: "18px 20px" }}>
          <SectionTitle icon={AlertTriangle} title="Risk Faktörleri" color="var(--red)" />
          {risks.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 10 }}>
              <AlertTriangle size={12} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} /> {r}
            </div>
          ))}
        </div>
      </div>

      {/* ── Next Actions ── */}
      <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.06),rgba(99,102,241,0.04))", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "20px 24px", marginBottom: 16 }}>
        <SectionTitle icon={Target} title="Önerilen Sonraki Adımlar" sub="Bu raporu aksiyona dönüştürün" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {nextActions.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "11px 13px", background: "var(--bg-elevated)", borderRadius: 9, border: "1px solid var(--line)", fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "#fff" }}>{i + 1}</span>
              </div>
              {a}
            </div>
          ))}
        </div>
      </div>

      {/* ── Confidence Breakdown ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px", marginBottom: 16 }}>
        <SectionTitle icon={Shield} title="Güven Motoru & Şeffaflık" sub="Analiz güvenilirliği ve veri kaynağı detayları" color="var(--text-3)" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
          {[["Analiz", confidence.analysis], ["Kitle", confidence.audience], ["Creator", confidence.creator], ["Genome", confidence.genome], ["Genel", confidence.overall]].map(([label, val]) => (
            <div key={label} style={{ textAlign: "center", padding: "12px", background: "var(--bg-subtle)", borderRadius: 9 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: clr(val as number, 55, 75), letterSpacing: "-0.03em" }}>{val}</div>
              <div style={{ fontSize: 10, color: "var(--text-3)" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {confidence.reasons.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: 7 }}>
              <Info size={12} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 1 }} /> {r}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Veri Kaynağı Notları</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {dataSourceNotes.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 7, fontSize: 11, color: "var(--text-2)", padding: "7px 10px", background: "var(--bg-subtle)", borderRadius: 7, lineHeight: 1.55 }}>
                <Info size={11} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 1 }} /> {n}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--line)" }}>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>Inflect AI Brand Match™ · {new Date().toLocaleDateString("tr-TR")} · Güven: {confidence.overall}/100 · Revenue/ROAS/Conversion bu raporda yer almaz</div>
        <button onClick={() => { setState("landing"); setResult(null); setGenomeCreator(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "var(--green)", color: "#fff", border: "none" }}>
          <RefreshCw size={11} /> Yeni Marka Analiz Et
        </button>
      </div>

    </div>
  );
}

// ── Micro util ─────────────────────────────────────────────────────────────────
function KVRow({ l, v, color }: { l: string; v: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 12, gap: 8 }}>
      <span style={{ color: "var(--text-3)", flexShrink: 0 }}>{l}</span>
      <span style={{ color: color || "var(--text-1)", fontWeight: 500, textAlign: "right" }}>{v}</span>
    </div>
  );
}
