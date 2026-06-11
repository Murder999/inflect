"use client";
import {
  useState, useEffect, useCallback, useRef, useId,
} from "react";
import {
  Search, BarChart2, TrendingUp, TrendingDown, Minus,
  Target, Globe, Users, Layers, DollarSign, AlertCircle,
  ChevronDown, ChevronUp, Loader2, Info, Zap,
  Shield, Eye, ArrowRight, TriangleAlert, CheckCircle,
  Activity, RefreshCw, Building2, Swords, X,
  Database, Tag,
} from "lucide-react";
import {
  competitorIntelApi,
  type CompetitorReport,
  type CompetitorSuggestion,
  type StrategicOpportunity,
  type CreatorSignal,
  formatSpendTL,
  tierLabel,
  confidenceColor,
  confidenceLabel,
  momentumLabel,
  aggressionLabel,
  priorityColor,
  industryLabel,
} from "@/lib/competitor-intelligence-api";
import { authApi } from "@/lib/api";
import { archiveApi } from "@/lib/api";

// ── Tiny helpers ──────────────────────────────────────────────────────────────

function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

// ── Design atoms ──────────────────────────────────────────────────────────────

function MomentumIcon({ m }: { m: string }) {
  if (m === "increasing") return <TrendingUp size={13} style={{ color: "#22c55e" }} />;
  if (m === "declining")  return <TrendingDown size={13} style={{ color: "#ef4444" }} />;
  return <Minus size={13} style={{ color: "#94a3b8" }} />;
}

function ConfidencePill({ c }: { c: string }) {
  const color = confidenceColor(c as any);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
      background: `${color}18`, color,
      border: `1px solid ${color}40`,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
      {confidenceLabel(c as any).toUpperCase()}
    </span>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const color = priorityColor(p as any);
  const label = { high: "YÜKSEK", medium: "ORTA", low: "DÜŞÜK" }[p] ?? p.toUpperCase();
  return (
    <span style={{
      padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
      background: `${color}18`, color, border: `1px solid ${color}30`,
      letterSpacing: "0.05em", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function InlineTag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block", padding: "0 6px",
      borderRadius: 4, fontSize: 10, fontWeight: 500,
      background: "rgba(148,163,184,0.12)", color: "var(--text-3)",
      border: "1px solid var(--line)",
    }}>
      {children}
    </span>
  );
}

function MockBanner() {
  return (
    <div role="status" style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 14px", borderRadius: 8, marginBottom: 18,
      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
      color: "#f59e0b", fontSize: 12, fontWeight: 500,
    }}>
      <TriangleAlert size={13} aria-hidden />
      <span>
        <strong>[MOCK MODE]</strong> — Gösterilen veriler sentetik ve deterministiktir.
        Gerçek rakip analizi için <code style={{ fontSize: 11, background: "rgba(245,158,11,0.12)", padding: "0 4px", borderRadius: 3 }}>AGENTS_MODE=live</code> gereklidir.
      </span>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 14px", borderRadius: 8, marginBottom: 16,
      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
      color: "#ef4444", fontSize: 13,
    }}>
      <AlertCircle size={14} aria-hidden />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Hatayı kapat"
        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0 }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

function MetricCard({
  icon, label, value, sub, accent,
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode;
  sub?: React.ReactNode; accent?: string;
}) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--line)",
      borderRadius: 10, padding: "14px 18px",
      display: "flex", flexDirection: "column", gap: 5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-3)", fontSize: 10, letterSpacing: "0.06em" }}>
        <span style={{ color: accent ?? "var(--brand-500)" }}>{icon}</span>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{sub}</div>}
    </div>
  );
}

function HorizontalBar({ label, pct, count, color }: { label: string; pct: number; count: number; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-2)", marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div style={{ height: 5, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function Section({ title, icon, children, collapsible = false, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 18px", borderBottom: open ? "1px solid var(--line)" : "none",
          cursor: collapsible ? "pointer" : "default",
        }}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
          <span style={{ color: "var(--brand-500)" }}>{icon}</span>
          {title}
        </div>
        {collapsible && (
          open
            ? <ChevronUp size={13} style={{ color: "var(--text-3)" }} />
            : <ChevronDown size={13} style={{ color: "var(--text-3)" }} />
        )}
      </div>
      {open && <div style={{ padding: "14px 18px" }}>{children}</div>}
    </div>
  );
}

// ── Autocomplete Dropdown ─────────────────────────────────────────────────────

function AutocompleteDropdown({
  suggestions,
  activeIndex,
  onSelect,
  listId,
}: {
  suggestions: CompetitorSuggestion[];
  activeIndex: number;
  onSelect: (s: CompetitorSuggestion) => void;
  listId: string;
}) {
  return (
    <ul
      id={listId}
      role="listbox"
      aria-label="Rakip önerileri"
      style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999,
        background: "var(--bg-card)", border: "1px solid var(--line)",
        borderRadius: 10, padding: "4px 0",
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        maxHeight: 340, overflowY: "auto",
      }}
    >
      {suggestions.map((s, i) => (
        <li
          key={s.competitor_id}
          role="option"
          aria-selected={i === activeIndex}
          onMouseDown={() => onSelect(s)}
          style={{
            padding: "10px 14px", cursor: "pointer",
            background: i === activeIndex ? "rgba(34,197,94,0.06)" : "transparent",
            borderLeft: i === activeIndex ? "2px solid var(--brand-500)" : "2px solid transparent",
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          {/* Brand initial avatar */}
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #ef444420, #b91c1c20)",
            border: "1px solid rgba(239,68,68,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#ef4444",
          }}>
            {s.name.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{s.name}</span>
              {s.has_active_campaigns && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "0 5px", borderRadius: 3,
                  background: "rgba(34,197,94,0.12)", color: "#22c55e",
                  border: "1px solid rgba(34,197,94,0.2)", letterSpacing: "0.04em",
                }}>
                  AKTİF
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
              {s.industry && <InlineTag>{industryLabel(s.industry)}</InlineTag>}
              {s.aliases.slice(0, 2).filter(a => a !== s.name).map((alias, j) => (
                <InlineTag key={j}>{alias}</InlineTag>
              ))}
              {s.last_campaign_at && (
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                  Son: {new Date(s.last_campaign_at).toLocaleDateString("tr-TR")}
                </span>
              )}
            </div>
          </div>

          <ArrowRight size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        </li>
      ))}
    </ul>
  );
}

// ── Opportunity Card ──────────────────────────────────────────────────────────

function OpportunityCard({ opp }: { opp: StrategicOpportunity }) {
  const [expanded, setExpanded] = useState(false);
  const iconMap: Record<string, React.ReactNode> = {
    tier_gap:       <Layers size={14} />,
    platform_gap:   <Globe size={14} />,
    category_gap:   <Target size={14} />,
    creator_fatigue:<RefreshCw size={14} />,
    market_entry:   <Zap size={14} />,
  };
  const color = priorityColor(opp.priority);
  return (
    <div style={{
      border: `1px solid ${color}28`, borderLeft: `3px solid ${color}`,
      borderRadius: 8, padding: "12px 14px", background: `${color}04`, marginBottom: 8,
    }}>
      <button
        style={{
          width: "100%", background: "none", border: "none", cursor: "pointer",
          display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0,
        }}
        aria-expanded={expanded}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, textAlign: "left" }}>
          <span style={{ color }}>{iconMap[opp.opportunity_type] ?? <AlertCircle size={14} />}</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>{opp.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <PriorityBadge p={opp.priority} />
          <ConfidencePill c={opp.confidence} />
          {expanded ? <ChevronUp size={12} style={{ color: "var(--text-3)" }} /> : <ChevronDown size={12} style={{ color: "var(--text-3)" }} />}
        </div>
      </button>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>{opp.description}</p>
          {opp.evidence.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {opp.evidence.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--text-3)" }}>
                  <CheckCircle size={10} style={{ color: "#22c55e", marginTop: 2, flexShrink: 0 }} />
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Creator Signal Table ──────────────────────────────────────────────────────

function CreatorSignalTable({ signals }: { signals: CreatorSignal[] }) {
  const [show, setShow] = useState(15);

  return (
    <div role="table" aria-label="Creator sinyalleri">
      <div role="rowgroup">
        <div role="row" style={{
          display: "grid", gridTemplateColumns: "1.8fr 80px 80px 70px 80px 70px 75px",
          gap: "0 10px", padding: "5px 8px", borderBottom: "1px solid var(--line)",
          fontSize: 9, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em",
        }}>
          {["USERNAME", "PLATFORM", "TAKİPÇİ", "TİER", "KATEGORİ", "SİNYAL", "GÜVEN"].map(h => (
            <span key={h} role="columnheader">{h}</span>
          ))}
        </div>
      </div>
      <div role="rowgroup">
        {signals.slice(0, show).map((s, i) => (
          <div key={i} role="row" style={{
            display: "grid", gridTemplateColumns: "1.8fr 80px 80px 70px 80px 70px 75px",
            gap: "0 10px", padding: "7px 8px",
            borderBottom: "1px solid var(--line)", fontSize: 12,
            background: i % 2 === 1 ? "rgba(0,0,0,0.015)" : "transparent",
          }}>
            <span role="cell" style={{ color: "var(--text-1)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{s.username}</span>
            <span role="cell" style={{ color: "var(--text-2)", textTransform: "capitalize" }}>{s.platform}</span>
            <span role="cell" style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{fmtFollowers(s.followers)}</span>
            <span role="cell" style={{ color: "var(--text-3)", textTransform: "capitalize", fontSize: 11 }}>{s.tier}</span>
            <span role="cell" style={{ color: "var(--text-3)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.category}</span>
            <span role="cell">
              {s.signal_type === "brand_analysis"
                ? <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 700 }}>DOĞRUDAN</span>
                : <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "rgba(148,163,184,0.1)", color: "#94a3b8", fontWeight: 700 }}>KATEGORİ</span>
              }
            </span>
            <span role="cell"><ConfidencePill c={s.confidence} /></span>
          </div>
        ))}
      </div>
      {signals.length > show && (
        <button
          onClick={() => setShow(n => n + 20)}
          style={{
            width: "100%", padding: "8px", fontSize: 12,
            color: "var(--brand-500)", background: "transparent",
            border: "none", cursor: "pointer", marginTop: 4,
          }}
        >
          + {signals.length - show} creator daha göster
        </button>
      )}
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────

function AdminPanel({
  selectedBrand,
}: {
  selectedBrand: CompetitorSuggestion;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await archiveApi.seed();
      setMsg(`✓ Archive seed tamamlandı. ${res.created_profiles ?? 0} profil oluşturuldu.`);
    } catch (e: any) {
      setMsg(`Seed hatası: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      margin: "0 0 16px", padding: "12px 16px",
      background: "rgba(99,102,241,0.05)",
      border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "#6366f1", marginBottom: 10, letterSpacing: "0.05em" }}>
        <Shield size={12} /> ADMIN AKSIYONLARI — {selectedBrand.name}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleSeed}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
            color: "#6366f1", cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Database size={12} />}
          Archive Seed
        </button>

        <a
          href="/admin/archive"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
            color: "#6366f1", textDecoration: "none",
          }}
        >
          <ArrowRight size={12} /> Archive'a Git
        </a>
      </div>

      {msg && (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-2)" }}>{msg}</p>
      )}

      <p style={{ margin: "8px 0 0", fontSize: 10, color: "var(--text-3)" }}>
        Archive'da {selectedBrand.name} ile ilgili creator verisi eklenirse sonraki rapor daha zengin sinyal içerecektir.
      </p>
    </div>
  );
}

// ── Report View ───────────────────────────────────────────────────────────────

function ReportView({
  report,
  isAdmin,
  selectedBrand,
  onRefresh,
}: {
  report: CompetitorReport;
  isAdmin: boolean;
  selectedBrand: CompetitorSuggestion | null;
  onRefresh: () => void;
}) {
  const tier_colors: Record<string, string> = {
    mega: "#8b5cf6", macro: "#3b82f6", mid: "#22c55e", micro: "#f59e0b", nano: "#94a3b8",
  };
  const platform_colors: Record<string, string> = {
    instagram: "#e1306c", tiktok: "#111827", youtube: "#ff0000",
  };

  return (
    <div>
      {report.is_mock && <MockBanner />}

      {isAdmin && selectedBrand && <AdminPanel selectedBrand={selectedBrand} />}

      {/* ── Executive KPIs ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))",
        gap: 10, marginBottom: 18,
      }}>
        <MetricCard
          icon={<Users size={13} />}
          label="Tespit Edilen Creator"
          value={report.creator_count}
          sub={<><ConfidencePill c={report.confidence} /> güvenle</>}
          accent="var(--brand-500)"
        />
        <MetricCard
          icon={<Globe size={13} />}
          label="Dominant Platform"
          value={<span style={{ textTransform: "capitalize" }}>{report.dominant_platform}</span>}
          sub={`${report.platform_breakdown[0]?.percentage?.toFixed(0) ?? "—"}% yoğunluk`}
          accent={platform_colors[report.dominant_platform] ?? "#94a3b8"}
        />
        <MetricCard
          icon={<Target size={13} />}
          label="Dominant Kategori"
          value={report.dominant_category}
          sub={`${report.category_dominance[0]?.percentage?.toFixed(0) ?? "—"}% yoğunluk`}
          accent="#8b5cf6"
        />
        <MetricCard
          icon={<Activity size={13} />}
          label="Creator Momentum"
          value={
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MomentumIcon m={report.creator_momentum} />
              {momentumLabel(report.creator_momentum as any)}
            </div>
          }
          sub={`Kampanya: ${aggressionLabel(report.campaign_aggression as any)}`}
        />
        {report.spend_estimate && (
          <MetricCard
            icon={<DollarSign size={13} />}
            label="Tahmini Harcama"
            value={
              <span style={{ fontSize: 17 }}>
                {formatSpendTL(report.spend_estimate.range_low_tl)}–{formatSpendTL(report.spend_estimate.range_high_tl)}
              </span>
            }
            sub={`${report.analysis_window_days}g · ${report.spend_estimate.confidence === "high" ? "Yüksek" : report.spend_estimate.confidence === "medium" ? "Orta" : "Düşük"} güven`}
            accent="#f59e0b"
          />
        )}
        <MetricCard
          icon={<Swords size={13} />}
          label="Agresiflik"
          value={aggressionLabel(report.campaign_aggression as any)}
          sub={
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MomentumIcon m={report.creator_momentum} />
              {momentumLabel(report.creator_momentum as any)}
            </div>
          }
          accent="#ef4444"
        />
      </div>

      {/* ── Opportunities ── */}
      {report.opportunities.length > 0 && (
        <Section title={`Stratejik Fırsatlar (${report.opportunities.length})`} icon={<Zap size={13} />}>
          {report.opportunities.map((o, i) => (
            <OpportunityCard key={i} opp={o} />
          ))}
        </Section>
      )}

      {/* ── Distribution grids ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-1)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Globe size={12} style={{ color: "var(--brand-500)" }} /> Platform
          </div>
          {report.platform_breakdown.map((p, i) => (
            <HorizontalBar key={i}
              label={p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}
              pct={p.percentage} count={p.creator_count}
              color={platform_colors[p.platform] ?? "#94a3b8"}
            />
          ))}
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-1)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Layers size={12} style={{ color: "var(--brand-500)" }} /> Tier
          </div>
          {report.tier_breakdown.map((t, i) => (
            <HorizontalBar key={i}
              label={tierLabel(t.tier as any).split(" ")[0]}
              pct={t.percentage} count={t.creator_count}
              color={tier_colors[t.tier] ?? "#94a3b8"}
            />
          ))}
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-1)", marginBottom: 12, display: "flex", alignItems: "center", gap: 5 }}>
            <Target size={12} style={{ color: "var(--brand-500)" }} /> Kategori
          </div>
          {report.category_dominance.slice(0, 6).map((c, i) => (
            <HorizontalBar key={i}
              label={c.category}
              pct={c.percentage} count={c.creator_count}
              color={`hsl(${(i * 47 + 200) % 360}, 60%, 52%)`}
            />
          ))}
        </div>
      </div>

      {/* ── Spend methodology ── */}
      {report.spend_estimate && (
        <Section title="Harcama Tahmini — Metodoloji & Sınırlamalar" icon={<DollarSign size={13} />} collapsible defaultOpen={false}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 8 }}>METODOLOJİ</div>
              {report.spend_estimate.methodology.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>
                  <ArrowRight size={10} style={{ color: "var(--brand-500)", marginTop: 3, flexShrink: 0 }} />{m}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 8 }}>SINIRLAMALAR</div>
              {report.spend_estimate.limitations.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
                  <Info size={10} style={{ color: "#f59e0b", marginTop: 3, flexShrink: 0 }} />{l}
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── Creator signals ── */}
      {report.creator_signals.length > 0 && (
        <Section
          title={`Creator Sinyalleri — ${report.creator_count} tespit (${Math.min(report.creator_signals.length, 50)} gösteriliyor)`}
          icon={<Eye size={13} />}
          collapsible defaultOpen={false}
        >
          <CreatorSignalTable signals={report.creator_signals} />
        </Section>
      )}

      {/* ── Campaign patterns ── */}
      {report.campaign_patterns && report.campaign_patterns.length > 0 && (
        <Section title={`Kampanya Kalıpları (${report.campaign_patterns.length})`} icon={<Activity size={13} />} collapsible defaultOpen={false}>
          {report.campaign_patterns.map((p, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              padding: "10px 12px", borderRadius: 7, marginBottom: 6,
              background: "rgba(148,163,184,0.05)", border: "1px solid var(--line)",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "0 5px", borderRadius: 3,
                    background: "rgba(99,102,241,0.1)", color: "#6366f1",
                    border: "1px solid rgba(99,102,241,0.2)", letterSpacing: "0.05em",
                  }}>
                    {p.pattern_type.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <ConfidencePill c={p.confidence} />
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0 }}>{p.description}</p>
              </div>
              <span style={{
                marginLeft: 12, fontSize: 20, fontWeight: 700, color: "var(--text-1)",
                flexShrink: 0, fontVariantNumeric: "tabular-nums",
              }}>{p.count}</span>
            </div>
          ))}
        </Section>
      )}

      {/* ── Evidence & Limitations ── */}
      <Section title="Kanıt Özeti & Sınırlamalar" icon={<Shield size={13} />} collapsible defaultOpen={false}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 8 }}>KANIT</div>
            {report.evidence_summary.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>
                <CheckCircle size={10} style={{ color: "#22c55e", marginTop: 3, flexShrink: 0 }} />{e}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 8 }}>SINIRLAMALAR</div>
            {report.limitations.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
                <Info size={10} style={{ color: "#f59e0b", marginTop: 3, flexShrink: 0 }} />{l}
              </div>
            ))}
          </div>
        </div>
        {report.note && (
          <p style={{ margin: "10px 0 0", padding: "8px 10px", borderRadius: 6, fontSize: 11, color: "var(--text-3)", background: "rgba(148,163,184,0.06)", border: "1px solid var(--line)" }}>
            {report.note}
          </p>
        )}
      </Section>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
        <span>Üretildi: {new Date(report.generated_at).toLocaleString("tr-TR")} · {report.analysis_window_days} günlük pencere</span>
        <button
          onClick={onRefresh}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 11px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "var(--bg-card)", border: "1px solid var(--line)",
            color: "var(--text-2)", cursor: "pointer",
          }}
        >
          <RefreshCw size={10} /> Yenile (1 kredi)
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CompetitorIntelligencePage() {
  const listboxId = useId();

  // ── State ─────────────────────────────────────────────────────────────────
  const [inputValue,    setInputValue]    = useState("");
  const [suggestions,   setSuggestions]   = useState<CompetitorSuggestion[]>([]);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [activeIndex,   setActiveIndex]   = useState(-1);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedBrand,  setSelectedBrand]  = useState<CompetitorSuggestion | null>(null);
  const [windowDays,     setWindowDays]     = useState(90);
  const [reportLoading,  setReportLoading]  = useState(false);
  const [report,         setReport]         = useState<CompetitorReport | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [creditsLeft,    setCreditsLeft]    = useState<number | null>(null);
  const [isAdmin,        setIsAdmin]        = useState(false);

  const inputRef   = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Admin detection ───────────────────────────────────────────────────────
  useEffect(() => {
    authApi.me().then(u => setIsAdmin(!!u.is_admin)).catch(() => {});
  }, []);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Debounced search ──────────────────────────────────────────────────────
  const debouncedInput = useDebounce(inputValue, 320);

  useEffect(() => {
    const q = debouncedInput.trim();
    if (!q || q.length < 1) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    competitorIntelApi.lookup(q, 10).then(results => {
      if (cancelled) return;
      setSuggestions(results);
      setDropdownOpen(true); // Always open to show results or no-results message
      setActiveIndex(-1);
      // Auto-select if exactly 1 result and it matches closely
      if (results.length === 1 && results[0].name.toLowerCase() === q.toLowerCase()) {
        handleSelect(results[0]);
      }
      setSearchLoading(false);
    }).catch(() => {
      if (!cancelled) setSearchLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput]);

  // ── Select a suggestion ───────────────────────────────────────────────────
  const handleSelect = useCallback((s: CompetitorSuggestion) => {
    setSelectedBrand(s);
    setInputValue(s.name);
    setSuggestions([]);
    setDropdownOpen(false);
    setActiveIndex(-1);
    setReport(null);
    setError(null);
  }, []);

  // ── Clear selection ───────────────────────────────────────────────────────
  const handleClear = () => {
    setSelectedBrand(null);
    setInputValue("");
    setSuggestions([]);
    setDropdownOpen(false);
    setReport(null);
    setError(null);
    inputRef.current?.focus();
  };

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setDropdownOpen(false);
      return;
    }
    if (!dropdownOpen || suggestions.length === 0) {
      if (e.key === "Enter" && selectedBrand) runReport();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        handleSelect(suggestions[activeIndex]);
      }
    }
  };

  // ── Generate report ───────────────────────────────────────────────────────
  const runReport = useCallback(async (force = false) => {
    const brandName = selectedBrand?.name ?? inputValue.trim();
    if (!brandName) return;

    setReportLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await competitorIntelApi.generateReport(brandName, windowDays, force);
      setReport(res.report);
      setCreditsLeft(res.credits_remaining);
    } catch (e: any) {
      const msg = e.message ?? "Rapor üretilemedi.";
      // Map known error patterns to user-friendly messages
      if (msg.includes("402") || msg.toLowerCase().includes("kredi")) {
        setError("Yetersiz kredi. Rapor üretmek için en az 1 krediniz olmalıdır.");
      } else if (msg.includes("401") || msg.toLowerCase().includes("authentication")) {
        setError("Oturum süresi dolmuş. Lütfen yeniden giriş yapın.");
      } else if (msg.includes("500") || msg.includes("sunucu")) {
        setError("Sunucu hatası. Lütfen birkaç saniye sonra tekrar deneyin.");
      } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
        setError("Bağlantı hatası. İnternet bağlantınızı kontrol edin.");
      } else {
        setError(msg);
      }
    } finally {
      setReportLoading(false);
    }
  }, [selectedBrand, inputValue, windowDays]);

  // ── Render ────────────────────────────────────────────────────────────────

  const canGenerate = !!(selectedBrand || inputValue.trim()) && !reportLoading;

  return (
    <main style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
          }}>
            <Swords size={18} style={{ color: "#fff" }} aria-hidden />
          </div>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: "var(--text-1)", margin: 0, lineHeight: 1.2 }}>
              Competitor Intelligence™
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
              Rakip influencer stratejileri · Kanıta dayalı · Güven puanlı
            </p>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderRadius: 6, marginTop: 8,
          background: "rgba(148,163,184,0.06)", border: "1px solid var(--line)",
          fontSize: 11, color: "var(--text-3)",
        }}>
          <Info size={10} aria-hidden />
          Creator-marka ilişkileri dolaylı sinyallerden çıkarılmıştır.
          Gerçek harcama verileri mevcut değildir. Tüm tahminler yönlendirici niteliktedir.
        </div>
      </div>

      {/* ── Search row ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "flex-start" }}>
        {/* Autocomplete wrapper */}
        <div ref={wrapperRef} style={{ position: "relative", flex: 1 }}>
          <label htmlFor="competitor-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
            Rakip marka adı
          </label>

          {/* Search icon */}
          {searchLoading
            ? <Loader2 size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", animation: "spin 0.8s linear infinite" }} />
            : <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} aria-hidden />
          }

          <input
            id="competitor-search"
            ref={inputRef}
            type="search"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={dropdownOpen}
            aria-controls={dropdownOpen ? listboxId : undefined}
            aria-activedescendant={activeIndex >= 0 ? `ci-opt-${activeIndex}` : undefined}
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              if (selectedBrand && e.target.value !== selectedBrand.name) {
                setSelectedBrand(null);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setDropdownOpen(true); }}
            placeholder="Rakip marka adı girin (ör. Watsons, L'Oréal, Adidas…)"
            style={{
              width: "100%",
              paddingLeft: 36,
              paddingRight: selectedBrand ? 36 : 14,
              height: 44, fontSize: 14,
              background: "var(--bg-card)", border: `1px solid ${selectedBrand ? "var(--brand-500)" : "var(--line)"}`,
              borderRadius: 10, color: "var(--text-1)", outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
          />

          {/* Selected indicator / clear */}
          {selectedBrand && (
            <button
              onClick={handleClear}
              aria-label="Seçimi temizle"
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "rgba(34,197,94,0.12)", border: "none", borderRadius: "50%",
                width: 20, height: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--brand-500)",
              }}
            >
              <X size={11} />
            </button>
          )}

          {/* Dropdown */}
          {dropdownOpen && suggestions.length > 0 && (
            <AutocompleteDropdown
              suggestions={suggestions}
              activeIndex={activeIndex}
              onSelect={handleSelect}
              listId={listboxId}
            />
          )}

          {/* No-results state */}
          {dropdownOpen && suggestions.length === 0 && debouncedInput.trim().length >= 2 && !searchLoading && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999,
              background: "var(--bg-card)", border: "1px solid var(--line)",
              borderRadius: 10, padding: "16px 14px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <Building2 size={22} style={{ color: "var(--text-3)", opacity: 0.4 }} />
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, fontWeight: 500 }}>
                "{debouncedInput}" bulunamadı
              </p>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
                Rapor ürettiğinizde bu marka otomatik olarak kaydedilecektir.
              </p>
              <button
                onMouseDown={() => {
                  setDropdownOpen(false);
                  setSelectedBrand({ competitor_id: 0, name: debouncedInput.trim(), normalized_name: "", aliases: [], industry: null, country: "TR", has_active_campaigns: false, last_campaign_at: null });
                }}
                style={{
                  marginTop: 4, padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: "var(--brand-500)", color: "#fff", border: "none", cursor: "pointer",
                }}
              >
                "{debouncedInput.trim()}" için rapor üret
              </button>
            </div>
          )}
        </div>

        {/* Window selector */}
        <select
          value={windowDays}
          onChange={e => setWindowDays(Number(e.target.value))}
          aria-label="Analiz penceresi"
          style={{
            height: 44, padding: "0 10px", fontSize: 13,
            background: "var(--bg-card)", border: "1px solid var(--line)",
            borderRadius: 10, color: "var(--text-2)", cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <option value={30}>30 gün</option>
          <option value={60}>60 gün</option>
          <option value={90}>90 gün</option>
          <option value={180}>180 gün</option>
        </select>

        {/* Generate button */}
        <button
          onClick={() => runReport(false)}
          disabled={!canGenerate}
          aria-disabled={!canGenerate}
          aria-label="Competitor Intelligence raporu üret"
          style={{
            height: 44, padding: "0 22px",
            background: canGenerate
              ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
              : "var(--line)",
            color: canGenerate ? "#fff" : "var(--text-3)",
            border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: canGenerate ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {reportLoading
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Analiz…</>
            : <><BarChart2 size={13} /> Rapor Üret</>
          }
        </button>
      </div>

      {/* ── Selected brand pill (confirmation) ── */}
      {selectedBrand && !report && !reportLoading && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 20, marginBottom: 16,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
          fontSize: 12, color: "var(--brand-500)",
        }}>
          <CheckCircle size={12} />
          <span>
            <strong>{selectedBrand.name}</strong> seçildi
            {selectedBrand.industry && ` — ${industryLabel(selectedBrand.industry)}`}
          </span>
          {selectedBrand.has_active_campaigns && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "0 5px", borderRadius: 3, background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
              AKTİF KAMPANYA
            </span>
          )}
        </div>
      )}

      {/* ── Credits counter ── */}
      {creditsLeft !== null && (
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, textAlign: "right" }}>
          Kalan kredi: <strong style={{ color: "var(--text-2)" }}>{creditsLeft}</strong>
        </div>
      )}

      {/* ── Error ── */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ── Loading skeleton ── */}
      {reportLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-live="polite" aria-label="Rapor yükleniyor">
          {[70, 110, 180, 140, 220].map((h, i) => (
            <div key={i} aria-hidden style={{
              height: h, borderRadius: 10, opacity: 0.55,
              background: "linear-gradient(90deg, var(--line) 25%, var(--bg-card) 50%, var(--line) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.4s infinite",
            }} />
          ))}
        </div>
      )}

      {/* ── Report ── */}
      {!reportLoading && report && (
        <ReportView
          report={report}
          isAdmin={isAdmin}
          selectedBrand={selectedBrand}
          onRefresh={() => runReport(true)}
        />
      )}

      {/* ── Empty state ── */}
      {!reportLoading && !report && !error && (
        <div style={{ textAlign: "center", padding: "56px 20px", color: "var(--text-3)" }}>
          <Building2 size={34} style={{ margin: "0 auto 10px", opacity: 0.25 }} aria-hidden />
          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
            Rakip marka adı girerek analiz başlatın
          </p>
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>
            Creator portföyü · Platform dağılımı · Harcama tahmini · Stratejik fırsatlar
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {["Watsons", "Gratis", "LC Waikiki", "Adidas", "L'Oréal"].map(brand => (
              <button
                key={brand}
                onClick={() => { setInputValue(brand); inputRef.current?.focus(); }}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: "var(--bg-card)", border: "1px solid var(--line)",
                  color: "var(--text-2)", cursor: "pointer",
                }}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </main>
  );
}
