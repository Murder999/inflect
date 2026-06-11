"use client";
import {
  useState, useEffect, useCallback, useRef, useId, useMemo,
} from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import {
  Shield, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Search, Loader2, Info, CheckCircle,
  X, ChevronDown, ChevronUp, Activity, Eye,
  Zap, AlertCircle, BarChart2, RefreshCw,
  Users, ArrowRight, Clock, RotateCw,
  FileText, ShieldAlert, Layers, Target,
} from "lucide-react";
import {
  riskRadarApi,
  type RiskReport, type RiskDimension, type AnomalyEvent,
  type RiskLevel, type Trajectory, type DimensionName,
  type ReportMode, type ResolvedInfo,
  RISK_LEVEL_LABEL, RISK_LEVEL_COLOR, RISK_LEVEL_BG,
  TRAJECTORY_LABEL, TRAJECTORY_COLOR, CONFIDENCE_LABEL,
  DIMENSION_ORDER,
} from "@/lib/risk-radar-api";
import {
  influencersApi, archiveAdminApi,
  type InfluencerLookupResult,
  type SyncProfileResponse, type ResolveAvatarResponse,
} from "@/lib/influencers-api";
import { authApi } from "@/lib/api";
import ProfileAvatar from "@/components/ProfileAvatar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setD(v), ms);
    return () => clearTimeout(id);
  }, [v, ms]);
  return d;
}

function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** Deterministic timeline from trajectory — no Math.random() */
function buildTimeline(
  score: number,
  trajectory: Trajectory,
  windowDays: number,
): Array<{ label: string; score: number }> {
  const pts = 7;
  const offsets: number[] = [];
  for (let i = 0; i < pts; i++) offsets.push(Math.round((i / (pts - 1)) * windowDays));

  return offsets.map((day, i) => {
    let s: number;

    if (trajectory === "spike") {
      s = i < pts - 2 ? score - 22 + i * 2 : score;
    } else if (trajectory === "rising") {
      s = score - (pts - 1 - i) * 7;
    } else if (trajectory === "declining") {
      s = score + (pts - 1 - i) * 6;
    } else {
      // stable — slight wave
      const wave = [0, 2, -1, 3, -2, 1, 0][i] ?? 0;
      s = score + wave;
    }

    return {
      label: day === 0 ? "Başlangıç" : day === windowDays ? "Bugün" : `${day}g`,
      score: Math.max(0, Math.min(100, Math.round(s))),
    };
  });
}

// ─── Design atoms ──────────────────────────────────────────────────────────────

function MockBanner() {
  return (
    <div role="status" style={{
      display: "flex", alignItems: "flex-start", gap: 9,
      padding: "10px 14px", borderRadius: 10, marginBottom: 18,
      background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.28)",
      color: "#f59e0b", fontSize: 12, fontWeight: 500, lineHeight: 1.5,
    }}>
      <AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden />
      <span>
        <strong>[MOCK MODE]</strong> — Gösterilen risk verileri sentetik ve deterministiktir.
        Gerçek analiz için{" "}
        <code style={{ fontSize: 11, background: "rgba(245,158,11,0.12)", padding: "0 4px", borderRadius: 3 }}>
          AGENTS_MODE=live
        </code>{" "}
        ve archive snapshot verisi gereklidir.
      </span>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 14px", borderRadius: 10, marginBottom: 16,
      background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.22)",
      color: "#ef4444", fontSize: 13,
    }}>
      <AlertCircle size={14} aria-hidden />
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} aria-label="Kapat" style={{
        background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0,
      }}>
        <X size={13} />
      </button>
    </div>
  );
}

function SuccessBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="status" style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 14px", borderRadius: 10, marginBottom: 14,
      background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.22)",
      color: "#22c55e", fontSize: 13,
    }}>
      <CheckCircle size={14} aria-hidden />
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} aria-label="Kapat" style={{
        background: "none", border: "none", cursor: "pointer", color: "#22c55e", padding: 0,
      }}>
        <X size={13} />
      </button>
    </div>
  );
}

function RiskLevelBadge({ level, size = "md" }: { level: RiskLevel; size?: "sm" | "md" | "lg" }) {
  const color = RISK_LEVEL_COLOR[level];
  const px = { sm: "1px 6px", md: "3px 10px", lg: "5px 14px" }[size];
  const fs = { sm: 9, md: 11, lg: 12 }[size];
  const dot = { sm: 4, md: 5, lg: 6 }[size];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: px, borderRadius: 20, fontSize: fs, fontWeight: 700, letterSpacing: "0.05em",
      background: RISK_LEVEL_BG[level], color,
      border: `1px solid ${color}40`, whiteSpace: "nowrap",
    }}>
      <span style={{ width: dot, height: dot, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {RISK_LEVEL_LABEL[level].toUpperCase()}
    </span>
  );
}

function TrajectoryBadge({ t }: { t: Trajectory }) {
  const color = TRAJECTORY_COLOR[t];
  const Icon = t === "declining" ? TrendingDown : (t === "rising" || t === "spike") ? TrendingUp : Minus;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: `${color}12`, color, border: `1px solid ${color}30`,
    }}>
      <Icon size={11} /> {TRAJECTORY_LABEL[t]}
    </span>
  );
}

function ConfidencePill({ c, showLabel = true }: { c: string; showLabel?: boolean }) {
  const color = c === "high" ? "#22c55e" : c === "medium" ? "#f59e0b" : "#94a3b8";
  const label = CONFIDENCE_LABEL[c as keyof typeof CONFIDENCE_LABEL] ?? c;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
      background: `${color}14`, color, border: `1px solid ${color}28`,
      letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {showLabel ? label.toUpperCase() : null}
    </span>
  );
}

function Section({
  title, icon, children, collapsible = false, defaultOpen = true,
  badge,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  collapsible?: boolean; defaultOpen?: boolean; badge?: string | number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--line)",
      borderRadius: 12, marginBottom: 14, overflow: "hidden",
    }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 18px", borderBottom: open ? "1px solid var(--line)" : "none",
          cursor: collapsible ? "pointer" : "default",
        }}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
          <span style={{ color: "var(--brand-500, #7c3aed)" }}>{icon}</span>
          {title}
          {badge !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
              background: "rgba(124,58,237,0.12)", color: "#7c3aed", marginLeft: 4,
            }}>
              {badge}
            </span>
          )}
        </div>
        {collapsible && (
          open
            ? <ChevronUp size={13} style={{ color: "var(--text-3)" }} />
            : <ChevronDown size={13} style={{ color: "var(--text-3)" }} />
        )}
      </div>
      {open && <div style={{ padding: "16px 18px" }}>{children}</div>}
    </div>
  );
}

// ─── Risk Gauge SVG ────────────────────────────────────────────────────────────

function RiskGauge({ score, level }: { score: number; level: RiskLevel }) {
  const color = RISK_LEVEL_COLOR[level];
  const r     = 52;
  const circ  = 2 * Math.PI * r;
  const pct   = Math.min(score, 100) / 100;
  // Zone colors for bg track (25% each: low / medium / high / critical)
  const zones: Array<{ pct: number; clr: string }> = [
    { pct: 0.25, clr: "#22c55e30" },
    { pct: 0.25, clr: "#f59e0b30" },
    { pct: 0.25, clr: "#ef444430" },
    { pct: 0.25, clr: "#7c3aed30" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden>
          {/* Track */}
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
          {/* Zone rings */}
          {zones.map((z, idx) => (
            <circle
              key={idx}
              cx="60" cy="60" r={r} fill="none"
              stroke={z.clr} strokeWidth="10"
              strokeDasharray={`${circ * z.pct} ${circ * (1 - z.pct)}`}
              strokeDashoffset={`${circ * (0.25 - idx * z.pct)}`}
              strokeLinecap="butt"
            />
          ))}
          {/* Active fill */}
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
            strokeDashoffset={`${circ * 0.25}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.05em" }}>/100</span>
        </div>
      </div>
      <RiskLevelBadge level={level} size="lg" />
    </div>
  );
}

// ─── Timeline Chart ────────────────────────────────────────────────────────────

function RiskTimelineChart({
  report,
  windowDays,
}: {
  report: RiskReport;
  windowDays: number;
}) {
  const data = useMemo(
    () => buildTimeline(report.overall_score, report.risk_trajectory, windowDays),
    [report.overall_score, report.risk_trajectory, windowDays],
  );

  const color = RISK_LEVEL_COLOR[report.overall_level];

  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0]?.value as number;
    return (
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--line)",
        borderRadius: 8, padding: "8px 12px", fontSize: 12,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      }}>
        <div style={{ fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>{label}</div>
        <div style={{ color: RISK_LEVEL_COLOR[scoreToLevel(val)], fontWeight: 700 }}>
          Risk: {val} — {RISK_LEVEL_LABEL[scoreToLevel(val)]}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
          Tahmin edilen risk eğrisi · {windowDays} günlük pencere ·{" "}
          <TrajectoryBadge t={report.risk_trajectory} />
        </span>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--text-3)" }}
              axisLine={false}
              tickLine={false}
            />
            <RechartsTooltip content={customTooltip} />
            <Area
              type="monotone"
              dataKey="score"
              stroke={color}
              strokeWidth={2.5}
              fill="url(#riskGrad)"
              dot={{ fill: color, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, textAlign: "right" }}>
        * Trajectory analizi tahminidir. Gerçek zaman serisi için çoklu snapshot gereklidir.
      </p>
    </div>
  );
}

function scoreToLevel(s: number): RiskLevel {
  if (s >= 75) return "critical";
  if (s >= 50) return "high";
  if (s >= 25) return "medium";
  return "low";
}

// ─── Dimension Bar ─────────────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: RiskDimension }) {
  const [expanded, setExpanded] = useState(false);
  const color = RISK_LEVEL_COLOR[dim.level];
  return (
    <div style={{
      marginBottom: 12, padding: "12px 14px", borderRadius: 10,
      background: `${color}04`, border: `1px solid ${color}18`,
    }}>
      <button
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{dim.label}</span>
            <ConfidencePill c={dim.confidence} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{dim.score}</span>
            <RiskLevelBadge level={dim.level} size="sm" />
            {expanded
              ? <ChevronUp size={12} style={{ color: "var(--text-3)" }} />
              : <ChevronDown size={12} style={{ color: "var(--text-3)" }} />
            }
          </div>
        </div>
        <div style={{ height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${dim.score}%`,
            background: `linear-gradient(90deg, ${color}70, ${color})`,
            borderRadius: 4, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>
      </button>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          {dim.signals.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {dim.signals.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.4 }}>
                  <ArrowRight size={10} style={{ color, marginTop: 3, flexShrink: 0 }} />
                  {s}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, fontStyle: "italic" }}>
              Bu boyut için sinyal verisi mevcut değil.
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <TrajectoryBadge t={dim.trend} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Anomaly Card ──────────────────────────────────────────────────────────────

function AnomalyCard({ ev, index }: { ev: AnomalyEvent; index: number }) {
  const color = ev.severity === "high" ? "#ef4444" : ev.severity === "medium" ? "#f59e0b" : "#94a3b8";
  const Icon  = ev.severity === "high" ? AlertTriangle : ev.severity === "medium" ? Zap : Activity;
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10, marginBottom: 8,
      border: `1px solid ${color}28`, borderLeft: `3px solid ${color}`,
      background: `${color}04`, display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={13} style={{ color }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
            background: `${color}14`, color, letterSpacing: "0.05em",
          }}>
            {ev.anomaly_type.replace(/_/g, " ").toUpperCase()}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
            background: "var(--line)", color: "var(--text-3)", letterSpacing: "0.04em",
          }}>
            {ev.period}
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
          {ev.description}
        </p>
      </div>
    </div>
  );
}

// ─── Structured Failure Card ──────────────────────────────────────────────────

const FAILURE_META: Record<string, { icon: React.ReactNode; color: string; title: string }> = {
  needs_platform:           { icon: <AlertCircle size={20} />, color: "#f59e0b", title: "Platform Belirlenemedi" },
  provider_not_configured:  { icon: <AlertTriangle size={20} />, color: "#f59e0b", title: "Provider Yapılandırılmamış" },
  provider_unavailable:     { icon: <AlertTriangle size={20} />, color: "#ef4444", title: "Provider Erişilemiyor" },
  profile_not_found:        { icon: <Users size={20} />, color: "#94a3b8", title: "Profil Bulunamadı" },
  feature_disabled:         { icon: <Shield size={20} />, color: "#6366f1", title: "Özellik Devre Dışı" },
  plan_not_allowed:         { icon: <ShieldAlert size={20} />, color: "#7c3aed", title: "Plan Erişim Yok" },
  insufficient_credits:     { icon: <Zap size={20} />, color: "#ef4444", title: "Yetersiz Kredi" },
  internal_error:           { icon: <AlertCircle size={20} />, color: "#ef4444", title: "Analiz Hatası" },
  invalid_query:            { icon: <Search size={20} />, color: "#94a3b8", title: "Geçersiz Sorgu" },
};

function RiskFailureCard({
  code, message, nextAction, onDismiss,
}: {
  code: string; message: string; nextAction?: string | null; onDismiss: () => void;
}) {
  const meta = FAILURE_META[code] ?? FAILURE_META.internal_error;
  const actionLabel: Record<string, string> = {
    select_platform:    "Platform seçin veya profil URL'si kullanın (instagram.com/...)",
    configure_provider: "Admin panelinden API anahtarlarını yapılandırın",
    retry:              "Birkaç dakika sonra tekrar deneyin",
  };
  return (
    <div role="alert" style={{
      padding: "20px 22px", borderRadius: 12, marginBottom: 18,
      background: `${meta.color}06`, border: `1px solid ${meta.color}30`,
      borderLeft: `4px solid ${meta.color}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${meta.color}14`, display: "flex", alignItems: "center", justifyContent: "center",
          color: meta.color,
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: meta.color }}>{meta.title}</span>
            <button onClick={onDismiss} aria-label="Kapat" style={{
              background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 0,
            }}>
              <X size={13} />
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 8px", lineHeight: 1.6 }}>
            {message}
          </p>
          {nextAction && actionLabel[nextAction] && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 6,
              padding: "7px 10px", borderRadius: 7, fontSize: 11,
              background: `${meta.color}08`, border: `1px solid ${meta.color}20`,
              color: "var(--text-3)",
            }}>
              <ArrowRight size={10} style={{ color: meta.color, marginTop: 2, flexShrink: 0 }} />
              <span>{actionLabel[nextAction]}</span>
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
              background: `${meta.color}12`, color: meta.color, letterSpacing: "0.06em",
              border: `1px solid ${meta.color}20`,
            }}>
              {code.toUpperCase().replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Report Mode Badge ────────────────────────────────────────────────────────

function ReportModeBadge({ mode, snapshotCount }: { mode: ReportMode; snapshotCount?: number }) {
  const cfg = (({
    limited:          { color: "#f59e0b", label: "Limited Evidence",   hint: "1 snapshot — yalnızca temel fraud/auth" },
    standard:         { color: "#6366f1", label: "Standard Evidence",  hint: "3+ snapshot — trend ve anomaly dahil" },
    full:             { color: "#22c55e", label: "Full Evidence",      hint: "7+ snapshot — tüm boyutlar yüksek güvenle" },
    archive_fallback: { color: "#94a3b8", label: "Archive Fallback",   hint: "Canlı provider yanıt vermedi — arşiv verisi kullanıldı" },
    mock_limited:     { color: "#a78bfa", label: "Mock Limited",       hint: "Sentetik veri — AGENTS_MODE=mock" },
  }) as Record<string, { color: string; label: string; hint: string }>)[mode] ?? {
    color: "#94a3b8", label: mode, hint: "",
  };
  return (
    <span title={cfg.hint} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: `${cfg.color}12`, color: cfg.color, border: `1px solid ${cfg.color}28`,
      letterSpacing: "0.04em", cursor: "help",
    }}>
      <Layers size={9} />
      {cfg.label.toUpperCase()}
      {snapshotCount !== undefined && (
        <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 2 }}>
          · {snapshotCount} snap
        </span>
      )}
    </span>
  );
}

// ─── Sentiment Section ────────────────────────────────────────────────────────

function SentimentSection({ dim }: { dim: RiskDimension | undefined }) {
  if (!dim) return null;
  const color = RISK_LEVEL_COLOR[dim.level];
  const bars = [
    { label: "Pozitif", pct: Math.max(0, 100 - dim.score) },
    { label: "Nötr",    pct: Math.min(30, Math.max(10, 40 - Math.abs(dim.score - 50))) },
    { label: "Negatif", pct: dim.score },
  ];
  const total = bars.reduce((s, b) => s + b.pct, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <RiskLevelBadge level={dim.level} />
        <TrajectoryBadge t={dim.trend} />
        <ConfidencePill c={dim.confidence} />
      </div>
      {/* Stacked bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.04em" }}>
          SENTIMENT DAĞILIMI
        </div>
        <div style={{ height: 16, borderRadius: 8, overflow: "hidden", display: "flex", gap: 2 }}>
          {bars.map(b => (
            <div key={b.label} style={{
              height: "100%", width: `${(b.pct / total) * 100}%`,
              background: b.label === "Pozitif" ? "#22c55e" : b.label === "Negatif" ? "#ef4444" : "#94a3b8",
              transition: "width 0.6s ease",
            }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
          {bars.map(b => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--text-3)" }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: b.label === "Pozitif" ? "#22c55e" : b.label === "Negatif" ? "#ef4444" : "#94a3b8",
              }} />
              {b.label} ({Math.round((b.pct / total) * 100)}%)
            </div>
          ))}
        </div>
      </div>
      {/* Signals */}
      {dim.signals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.05em", marginBottom: 4 }}>
            SİNYALLER
          </div>
          {dim.signals.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
              <ArrowRight size={10} style={{ color, marginTop: 3, flexShrink: 0 }} />{s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Admin Actions Panel ──────────────────────────────────────────────────────

function AdminActionsPanel({
  profileId, onScanForce, loading,
}: {
  profileId: number; onScanForce: () => void; loading: boolean;
}) {
  const [syncMsg,    setSyncMsg]    = useState<string | null>(null);
  const [avatarMsg,  setAvatarMsg]  = useState<string | null>(null);
  const [syncBusy,   setSyncBusy]   = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const handleSync = async () => {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const res: SyncProfileResponse = await archiveAdminApi.syncProfile(profileId);
      setSyncMsg(res.message ?? res.note ?? "Profil senkronize edildi.");
    } catch (e: any) {
      setSyncMsg(`Hata: ${e.message}`);
    } finally {
      setSyncBusy(false);
    }
  };

  const handleResolveAvatar = async () => {
    setAvatarBusy(true);
    setAvatarMsg(null);
    try {
      const res: ResolveAvatarResponse = await archiveAdminApi.resolveAvatar(profileId);
      setAvatarMsg(res.ok ? "Avatar güncellendi." : (res.error ?? "Avatar değişmedi."));
    } catch (e: any) {
      setAvatarMsg(`Hata: ${e.message}`);
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div style={{
      padding: "14px 16px", borderRadius: 10, marginBottom: 14,
      background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.18)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <ShieldAlert size={13} style={{ color: "#7c3aed" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.04em" }}>
          ADMIN AKSIYONLARI
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleSync}
          disabled={syncBusy}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: syncBusy ? "var(--line)" : "rgba(124,58,237,0.1)",
            color: syncBusy ? "var(--text-3)" : "#7c3aed",
            border: "1px solid rgba(124,58,237,0.25)", cursor: syncBusy ? "not-allowed" : "pointer",
          }}
        >
          {syncBusy
            ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
            : <RotateCw size={12} />
          }
          Snapshot Sync
        </button>
        <button
          onClick={handleResolveAvatar}
          disabled={avatarBusy}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: avatarBusy ? "var(--line)" : "rgba(99,102,241,0.08)",
            color: avatarBusy ? "var(--text-3)" : "#6366f1",
            border: "1px solid rgba(99,102,241,0.22)", cursor: avatarBusy ? "not-allowed" : "pointer",
          }}
        >
          {avatarBusy
            ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
            : <Eye size={12} />
          }
          Avatar Resolve
        </button>
        <button
          onClick={onScanForce}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: loading ? "var(--line)" : "rgba(239,68,68,0.08)",
            color: loading ? "var(--text-3)" : "#ef4444",
            border: "1px solid rgba(239,68,68,0.22)", cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading
            ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
            : <RefreshCw size={12} />
          }
          Zorla Yenile (1 kredi)
        </button>
      </div>
      {syncMsg && (
        <p style={{ fontSize: 11, color: syncMsg.startsWith("Hata") ? "#ef4444" : "#22c55e", marginTop: 8, margin: "8px 0 0" }}>
          {syncMsg}
        </p>
      )}
      {avatarMsg && (
        <p style={{ fontSize: 11, color: avatarMsg.startsWith("Hata") ? "#ef4444" : "#22c55e", marginTop: 8, margin: "8px 0 0" }}>
          {avatarMsg}
        </p>
      )}
    </div>
  );
}

// ─── Profile Dropdown ──────────────────────────────────────────────────────────

const PLTCOLOR: Record<string, string> = {
  instagram: "#e1306c", tiktok: "#111827", youtube: "#ff0000",
};

function ProfileDropdown({
  results, activeIndex, onSelect, listId,
}: {
  results: InfluencerLookupResult[];
  activeIndex: number;
  onSelect: (r: InfluencerLookupResult) => void;
  listId: string;
}) {
  return (
    <ul id={listId} role="listbox" aria-label="Influencer önerileri" style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 999,
      background: "var(--bg-card)", border: "1px solid var(--line)",
      borderRadius: 12, padding: "4px 0",
      boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
      maxHeight: 320, overflowY: "auto",
    }}>
      {results.map((r, i) => (
        <li
          key={r.profile_id}
          role="option"
          aria-selected={i === activeIndex}
          onMouseDown={() => onSelect(r)}
          style={{
            padding: "10px 14px", cursor: "pointer",
            background: i === activeIndex ? "rgba(124,58,237,0.06)" : "transparent",
            borderLeft: i === activeIndex ? "2px solid #7c3aed" : "2px solid transparent",
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: `${PLTCOLOR[r.platform] ?? "#94a3b8"}14`,
            border: "1px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: PLTCOLOR[r.platform] ?? "#94a3b8",
          }}>
            {r.username.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>@{r.username}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: PLTCOLOR[r.platform] ?? "#94a3b8", fontWeight: 600 }}>
                {r.platform}
              </span>
              {r.followers > 0 && (
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>{fmtFollowers(r.followers)}</span>
              )}
              {r.category && (
                <span style={{
                  fontSize: 10, color: "var(--text-3)",
                  padding: "0 5px", borderRadius: 4,
                  background: "var(--line)",
                }}>
                  {r.category}
                </span>
              )}
              {r.snapshot_count > 0 && (
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                  {r.snapshot_count} snap
                </span>
              )}
            </div>
          </div>
          {r.snapshot_count < 3 && (
            <span style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 4,
              background: "rgba(245,158,11,0.12)", color: "#f59e0b",
              border: "1px solid rgba(245,158,11,0.25)", whiteSpace: "nowrap",
            }}>
              Az Veri
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Premium Info Panel ────────────────────────────────────────────────────────

function InfoPanel() {
  const features = [
    { icon: <ShieldAlert size={15} />, color: "#7c3aed", title: "Brand Safety Analizi", desc: "İçerik, davranış ve engagement kalitesi üzerinden marka güvenliği riski hesaplanır." },
    { icon: <Activity size={15} />, color: "#ef4444", title: "Anomali Tespiti", desc: "Anormal büyüme, engagement spike veya follower kaybı gibi önemli değişimler işaretlenir." },
    { icon: <TrendingUp size={15} />, color: "#f59e0b", title: "Fraud & Authenticity", desc: "Sahte takipçi ve yapay engagement riski 0–100 arası puanlanır." },
    { icon: <Target size={15} />, color: "#22c55e", title: "Brand Alignment", desc: "Influencer'ın marka fit skoru ve engagement kalitesi ile brand alignment ölçülür." },
    { icon: <Eye size={15} />, color: "#6366f1", title: "Explainable AI", desc: "Her risk sinyali kanıta dayanır ve sınırlamaları şeffaf olarak açıklanır." },
    { icon: <Layers size={15} />, color: "#06b6d4", title: "Confidence Engine", desc: "Snapshot sayısı ve kapsama süresi sonuca olan güven düzeyini belirler." },
  ];

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--line)",
      borderRadius: 14, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 22px 16px",
        background: "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(99,102,241,0.04) 100%)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldAlert size={16} style={{ color: "#fff" }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>
            Risk Radar™ Nasıl Çalışır?
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, lineHeight: 1.6 }}>
          Bu sayfa influencer&apos;ların brand safety durumlarını, anomali geçmişlerini ve risk
          profillerini izler. Fraud risk, growth anomalileri, engagement kalitesi ve brand alignment
          tek bir intelligence panosunda birleştirilir.
        </p>
      </div>

      {/* Feature list */}
      <div style={{ padding: "16px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        {features.map(f => (
          <div key={f.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: `${f.color}12`, border: `1px solid ${f.color}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: f.color,
            }}>
              {f.icon}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: "12px 22px 16px",
        borderTop: "1px solid var(--line)",
        fontSize: 10, color: "var(--text-3)", lineHeight: 1.6,
        display: "flex", gap: 7, alignItems: "flex-start",
      }}>
        <Info size={11} style={{ marginTop: 1, flexShrink: 0 }} />
        <span>
          Risk Radar siyasi kimlik, ideoloji, din veya korunan özellik çıkarımı <strong>yapmaz</strong>.
          Tüm risk sinyalleri performans metriklerine ve davranış kalıplarına dayanır.
        </span>
      </div>

      {/* Legend */}
      <div style={{
        padding: "12px 22px 16px", borderTop: "1px solid var(--line)",
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 8 }}>
          RİSK SEVİYELERİ
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(["low", "medium", "high", "critical"] as RiskLevel[]).map(l => (
            <div key={l} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", borderRadius: 7,
              background: RISK_LEVEL_BG[l], border: `1px solid ${RISK_LEVEL_COLOR[l]}30`,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: RISK_LEVEL_COLOR[l], flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: RISK_LEVEL_COLOR[l] }}>
                {RISK_LEVEL_LABEL[l]}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                {l === "low" ? "0–24" : l === "medium" ? "25–49" : l === "high" ? "50–74" : "75–100"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Report View ───────────────────────────────────────────────────────────────

function ReportView({
  report, isAdmin, windowDays, onRefresh, profileId,
  resolvedInfo, reportMode, warnings,
}: {
  report: RiskReport; isAdmin: boolean; windowDays: number;
  onRefresh: () => void; profileId: number;
  resolvedInfo?: ResolvedInfo | null;
  reportMode?: ReportMode | null;
  warnings?: string[];
}) {
  const orderedDims = useMemo(
    () => DIMENSION_ORDER.map(k => report.dimensions[k]).filter(Boolean),
    [report.dimensions],
  );

  const sentimentDim = report.dimensions["sentiment"];

  const kpis = [
    { label: "Genel Risk",  value: RISK_LEVEL_LABEL[report.overall_level],   color: RISK_LEVEL_COLOR[report.overall_level] },
    { label: "Trajectory",  value: TRAJECTORY_LABEL[report.risk_trajectory],  color: TRAJECTORY_COLOR[report.risk_trajectory] },
    { label: "Güven",       value: (CONFIDENCE_LABEL as any)[report.confidence] ?? report.confidence, color: "#7c3aed" },
    { label: "Snapshotlar", value: String(report.snapshot_count),              color: "var(--text-2)" },
    { label: "Pencere",     value: `${report.window_days} gün`,               color: "var(--text-2)" },
    { label: "Boyutlar",    value: String(orderedDims.length),                  color: "var(--text-2)" },
  ];

  return (
    <div>
      {report.is_mock && <MockBanner />}

      {/* Resolved profile banner */}
      {resolvedInfo && (
        <div role="status" style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", borderRadius: 10, marginBottom: 14,
          background: resolvedInfo.status === "archive_fallback"
            ? "rgba(148,163,184,0.07)" : "rgba(99,102,241,0.06)",
          border: resolvedInfo.status === "archive_fallback"
            ? "1px solid rgba(148,163,184,0.28)" : "1px solid rgba(99,102,241,0.22)",
          fontSize: 12, flexWrap: "wrap",
        }}>
          <ProfileAvatar
            src={resolvedInfo.profile_image_url ?? undefined}
            name={resolvedInfo.display_name || resolvedInfo.username}
            platform={resolvedInfo.platform as "instagram" | "tiktok" | "youtube"}
            size={36}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-1)" }}>
              @{resolvedInfo.username}
              {resolvedInfo.followers > 0 && (
                <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>
                  {fmtFollowers(resolvedInfo.followers)} takipçi
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
              {resolvedInfo.status === "archive_fallback"
                ? "Arşiv verisiyle çözümlendi"
                : resolvedInfo.resolution_source === "mock"
                  ? "Mock profil oluşturuldu"
                  : resolvedInfo.resolution_source === "provider"
                    ? "Canlı veriden çözümlendi"
                    : "Arşivden yüklendi"
              }
              {" · "}{resolvedInfo.platform}
            </div>
          </div>
          {reportMode && <ReportModeBadge mode={reportMode} snapshotCount={report.snapshot_count} />}
        </div>
      )}

      {/* Report mode only when no resolvedInfo is present */}
      {reportMode && !resolvedInfo && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <ReportModeBadge mode={reportMode} snapshotCount={report.snapshot_count} />
        </div>
      )}

      {/* Warnings from resolve pipeline */}
      {warnings && warnings.length > 0 && (
        <div role="status" style={{
          padding: "9px 13px", borderRadius: 9, marginBottom: 12,
          background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)",
          fontSize: 11, color: "#f59e0b",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {warnings.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
              <AlertTriangle size={10} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <AdminActionsPanel
          profileId={profileId}
          onScanForce={onRefresh}
          loading={false}
        />
      )}

      {/* ── Executive Risk Summary ── */}
      <Section title="Executive Risk Summary" icon={<Shield size={13} />}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "start" }}>
          <RiskGauge score={report.overall_score} level={report.overall_level} />
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <TrajectoryBadge t={report.risk_trajectory} />
              <ConfidencePill c={report.confidence} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {kpis.map(k => (
                <div key={k.label} style={{
                  padding: "10px 12px", borderRadius: 9,
                  background: "var(--bg-card)", border: "1px solid var(--line)",
                }}>
                  <div style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 4 }}>
                    {k.label.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{
              padding: "9px 12px", borderRadius: 8, fontSize: 11,
              background: "rgba(148,163,184,0.05)", border: "1px solid var(--line)",
              color: "var(--text-3)", lineHeight: 1.6,
              display: "flex", gap: 7, alignItems: "flex-start",
            }}>
              <Info size={10} style={{ marginTop: 2, flexShrink: 0 }} />
              Risk analizi kanıta dayalı ve yönlendiricidir. Siyasi kimlik, ideoloji veya korunan
              özellik çıkarımı yapılmaz.
            </div>
          </div>
        </div>
      </Section>

      {/* ── Risk Timeline Chart ── */}
      <Section title="Risk Zaman Çizgisi" icon={<Activity size={13} />} collapsible defaultOpen>
        <RiskTimelineChart report={report} windowDays={windowDays} />
      </Section>

      {/* ── Risk Breakdown ── */}
      <Section title="Risk Boyutları" icon={<BarChart2 size={13} />} badge={orderedDims.length}>
        {orderedDims.map(dim => (
          <DimensionBar key={dim.name} dim={dim} />
        ))}
      </Section>

      {/* ── Anomaly Events ── */}
      {report.anomaly_events.length > 0 && (
        <Section
          title="Tespit Edilen Anomaliler"
          icon={<Zap size={13} />}
          badge={report.anomaly_events.length}
          collapsible
          defaultOpen
        >
          {report.anomaly_events.map((ev, i) => (
            <AnomalyCard key={i} ev={ev} index={i} />
          ))}
        </Section>
      )}

      {/* ── Sentiment Trend ── */}
      {sentimentDim && (
        <Section title="Sentiment Analizi" icon={<TrendingUp size={13} />} collapsible defaultOpen>
          <SentimentSection dim={sentimentDim} />
        </Section>
      )}

      {/* ── Evidence & Limitations ── */}
      <Section
        title="Kanıt Özeti & Sınırlamalar"
        icon={<FileText size={13} />}
        collapsible
        defaultOpen={false}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 10 }}>
              KANIT
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {report.evidence_summary.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                  <CheckCircle size={11} style={{ color: "#22c55e", marginTop: 2, flexShrink: 0 }} />{e}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.06em", marginBottom: 10 }}>
              SINIRLAMALAR
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {report.limitations.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
                  <Info size={11} style={{ color: "#f59e0b", marginTop: 2, flexShrink: 0 }} />{l}
                </div>
              ))}
            </div>
          </div>
        </div>
        {report.note && (
          <div style={{
            marginTop: 14, padding: "10px 12px", borderRadius: 8, fontSize: 11,
            color: "var(--text-3)", background: "rgba(148,163,184,0.05)",
            border: "1px solid var(--line)", lineHeight: 1.6,
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <AlertCircle size={11} style={{ color: "#f59e0b", marginTop: 1, flexShrink: 0 }} />
            {report.note}
          </div>
        )}
      </Section>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 6, fontSize: 11, color: "var(--text-3)", flexWrap: "wrap", gap: 8,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Clock size={10} />
          {new Date(report.generated_at).toLocaleString("tr-TR")} · {report.window_days} günlük pencere
        </span>
        <button onClick={onRefresh} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: "var(--bg-card)", border: "1px solid var(--line)",
          color: "var(--text-2)", cursor: "pointer",
          transition: "border-color 0.15s",
        }}>
          <RefreshCw size={11} /> Yenile (1 kredi)
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RiskRadarPage() {
  const listboxId = useId();

  const [inputValue,    setInputValue]    = useState("");
  const [suggestions,   setSuggestions]   = useState<InfluencerLookupResult[]>([]);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [activeIndex,   setActiveIndex]   = useState(-1);
  const [searchLoading, setSearchLoading] = useState(false);

  const [selectedProfile, setSelectedProfile] = useState<InfluencerLookupResult | null>(null);
  const [windowDays,      setWindowDays]      = useState(90);
  const [reportLoading,   setReportLoading]   = useState(false);
  const [report,          setReport]          = useState<RiskReport | null>(null);
  const [resolvedInfo,    setResolvedInfo]    = useState<ResolvedInfo | null>(null);
  const [reportMode,      setReportMode]      = useState<ReportMode | null>(null);
  const [scanWarnings,    setScanWarnings]    = useState<string[]>([]);
  const [failureInfo,     setFailureInfo]     = useState<{ code: string; message: string; next_action?: string | null } | null>(null);
  const [error,           setError]           = useState<string | null>(null);
  const [success,         setSuccess]         = useState<string | null>(null);
  const [creditsLeft,     setCreditsLeft]     = useState<number | null>(null);
  const [isAdmin,         setIsAdmin]         = useState(false);

  const inputRef   = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authApi.me().then(u => setIsAdmin(!!u.is_admin)).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const debouncedInput = useDebounce(inputValue, 320);

  const handleSelect = useCallback((r: InfluencerLookupResult) => {
    setSelectedProfile(r);
    setInputValue(`@${r.username} (${r.platform})`);
    setSuggestions([]);
    setDropdownOpen(false);
    setActiveIndex(-1);
    setReport(null);
    setError(null);
  }, []);

  useEffect(() => {
    const q = debouncedInput.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    influencersApi.lookup(q).then(res => {
      if (cancelled) return;
      const results = Array.isArray(res) ? res : (res as any).results ?? [];
      setSuggestions(results);
      setDropdownOpen(true);
      setActiveIndex(-1);
      if (results.length === 1) handleSelect(results[0]);
      setSearchLoading(false);
    }).catch(() => {
      if (!cancelled) setSearchLoading(false);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput]);

  const handleClear = () => {
    setSelectedProfile(null);
    setInputValue("");
    setSuggestions([]);
    setDropdownOpen(false);
    setReport(null);
    setResolvedInfo(null);
    setReportMode(null);
    setScanWarnings([]);
    setFailureInfo(null);
    setError(null);
    setSuccess(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setDropdownOpen(false); return; }
    if (!dropdownOpen || suggestions.length === 0) {
      if (e.key === "Enter" && selectedProfile) runScan();
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
      if (activeIndex >= 0 && suggestions[activeIndex]) handleSelect(suggestions[activeIndex]);
    }
  };

  const runScan = useCallback(async (force = false) => {
    const query = inputValue.trim();
    if (!query) return;
    setReportLoading(true);
    setError(null);
    setSuccess(null);
    setReport(null);
    setResolvedInfo(null);
    setReportMode(null);
    setScanWarnings([]);
    setFailureInfo(null);
    try {
      const res = await riskRadarApi.queryScan({
        query,
        platform: selectedProfile?.platform,
        window_days: windowDays,
        force_refresh: force,
      });
      if (!res.ok) {
        setFailureInfo({
          code:        res.failure_code,
          message:     res.message,
          next_action: res.next_action,
        });
      } else {
        setReport(res.report);
        setResolvedInfo(res.resolved ?? null);
        setReportMode(res.report_mode ?? null);
        setScanWarnings(res.warnings ?? []);
        setCreditsLeft(res.credits_remaining ?? null);
        if (force) setSuccess("Rapor güncellendi.");
      }
    } catch (e: any) {
      const msg: string = e.message ?? "Risk analizi tamamlanamadı.";
      if (msg.includes("402") || msg.toLowerCase().includes("kredi")) {
        setError("Yetersiz kredi. Risk analizi için krediniz bulunmamaktadır.");
      } else if (msg.includes("401")) {
        setError("Oturum süresi dolmuş. Lütfen yeniden giriş yapın.");
      } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
        setError("Bağlantı hatası. İnternet bağlantınızı kontrol edin.");
      } else {
        setError(msg);
      }
    } finally {
      setReportLoading(false);
    }
  }, [inputValue, selectedProfile, windowDays]);

  const canScan = inputValue.trim().length >= 2 && !reportLoading;
  const showInfoPanel = !report && !reportLoading && !failureInfo;

  return (
    <main style={{ padding: "24px 28px 48px", maxWidth: 1200, margin: "0 auto" }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
            boxShadow: "0 4px 16px rgba(124,58,237,0.28)",
          }}>
            <ShieldAlert size={20} style={{ color: "#fff" }} aria-hidden />
          </div>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: "var(--text-1)", margin: 0, lineHeight: 1.2,
              background: "linear-gradient(90deg, #7c3aed, #6366f1)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              Influencer Risk Radar™
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0, marginTop: 2 }}>
              Behavioral brand safety intelligence · Kanıta dayalı · Explainable risk scoring
            </p>
          </div>
        </div>
        {/* Disclaimer strip */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7, padding: "7px 12px",
          borderRadius: 8, background: "rgba(124,58,237,0.05)",
          border: "1px solid rgba(124,58,237,0.15)", fontSize: 11, color: "var(--text-3)",
        }}>
          <Info size={10} aria-hidden />
          Sistem siyasi kimlik, ideoloji, din veya korunan özellik çıkarımı yapmaz.
          Tüm risk sinyalleri performans metriklerine ve davranış kalıplarına dayanır.
        </div>
      </div>

      {/* ── Search row ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div ref={wrapperRef} style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <label htmlFor="risk-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
            Influencer ara
          </label>
          {searchLoading
            ? <Loader2 size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", animation: "spin 0.8s linear infinite" }} />
            : <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} aria-hidden />
          }
          <input
            id="risk-search"
            ref={inputRef}
            type="search"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={dropdownOpen}
            aria-controls={dropdownOpen ? listboxId : undefined}
            aria-activedescendant={activeIndex >= 0 ? `rr-opt-${activeIndex}` : undefined}
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              if (selectedProfile && e.target.value !== `@${selectedProfile.username} (${selectedProfile.platform})`) {
                setSelectedProfile(null);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setDropdownOpen(true); }}
            placeholder="@username, profil URL veya influencer adı…"
            style={{
              width: "100%", paddingLeft: 38,
              paddingRight: selectedProfile ? 38 : 14,
              height: 46, fontSize: 14,
              background: "var(--bg-card)",
              border: `1px solid ${selectedProfile ? "rgba(124,58,237,0.55)" : "var(--line)"}`,
              borderRadius: 11, color: "var(--text-1)", outline: "none",
              boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s",
              boxShadow: selectedProfile ? "0 0 0 3px rgba(124,58,237,0.08)" : "none",
            }}
          />
          {selectedProfile && (
            <button onClick={handleClear} aria-label="Seçimi temizle" style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "rgba(124,58,237,0.12)", border: "none", borderRadius: "50%",
              width: 22, height: 22, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#7c3aed",
            }}>
              <X size={11} />
            </button>
          )}
          {dropdownOpen && suggestions.length > 0 && (
            <ProfileDropdown
              results={suggestions}
              activeIndex={activeIndex}
              onSelect={handleSelect}
              listId={listboxId}
            />
          )}
          {dropdownOpen && suggestions.length === 0 && debouncedInput.trim().length >= 2 && !searchLoading && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 999,
              background: "var(--bg-card)", border: "1px solid var(--line)",
              borderRadius: 12, padding: "16px 14px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 7, textAlign: "center",
            }}>
              <Search size={20} style={{ color: "#7c3aed", opacity: 0.4 }} />
              <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, fontWeight: 500 }}>
                &ldquo;{debouncedInput}&rdquo; archive&apos;da yok
              </p>
              <p style={{ fontSize: 11, color: "var(--text-3)", margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
                Sorun değil — tarama düğmesine basın. Sistem profili canlı veriden veya mock moddan çözümler.
              </p>
            </div>
          )}
        </div>

        <select
          value={windowDays}
          onChange={e => { setWindowDays(Number(e.target.value)); setReport(null); }}
          aria-label="Analiz penceresi"
          style={{
            height: 46, padding: "0 12px", fontSize: 13,
            background: "var(--bg-card)", border: "1px solid var(--line)",
            borderRadius: 11, color: "var(--text-2)", cursor: "pointer", flexShrink: 0,
          }}
        >
          <option value={30}>30 gün</option>
          <option value={60}>60 gün</option>
          <option value={90}>90 gün</option>
          <option value={180}>180 gün</option>
        </select>

        <button
          onClick={() => runScan(false)}
          disabled={!canScan}
          aria-disabled={!canScan}
          style={{
            height: 46, padding: "0 24px",
            background: canScan
              ? "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)"
              : "var(--line)",
            color: canScan ? "#fff" : "var(--text-3)",
            border: "none", borderRadius: 11, fontSize: 13, fontWeight: 700,
            cursor: canScan ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
            flexShrink: 0,
            boxShadow: canScan ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
            transition: "box-shadow 0.2s, background 0.2s",
          }}
        >
          {reportLoading
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Analiz ediliyor…</>
            : <><ShieldAlert size={14} /> Risk Taraması</>
          }
        </button>
      </div>

      {/* Hint chips */}
      {!inputValue.trim() && !report && !failureInfo && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)", marginRight: 2 }}>Örnek:</span>
          {["@cristiano", "@khaby.lame", "instagram.com/selenagomez", "@mkbhd"].map(hint => (
            <button
              key={hint}
              onClick={() => setInputValue(hint)}
              style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20,
                background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)",
                color: "#7c3aed", cursor: "pointer", fontWeight: 500,
              }}
            >
              {hint}
            </button>
          ))}
        </div>
      )}

      {/* Ready-to-scan chip */}
      {inputValue.trim().length >= 2 && !report && !reportLoading && !failureInfo && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 9,
          padding: "7px 14px", borderRadius: 22, marginBottom: 16,
          background: selectedProfile
            ? "rgba(124,58,237,0.07)"
            : "rgba(99,102,241,0.07)",
          border: `1px solid ${selectedProfile ? "rgba(124,58,237,0.22)" : "rgba(99,102,241,0.2)"}`,
          fontSize: 12,
          color: selectedProfile ? "#7c3aed" : "#6366f1",
        }}>
          <CheckCircle size={13} />
          {selectedProfile ? (
            <span>
              <strong>@{selectedProfile.username}</strong>{" "}
              ({selectedProfile.platform}
              {selectedProfile.followers > 0 ? ` · ${fmtFollowers(selectedProfile.followers)}` : ""})
              {" "}archive&apos;dan seçildi
            </span>
          ) : (
            <span>
              <strong>{inputValue.trim()}</strong> taranacak
              <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>
                — archive&apos;da değilse otomatik çözümlenir
              </span>
            </span>
          )}
        </div>
      )}

      {creditsLeft !== null && (
        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10, textAlign: "right" }}>
          Kalan kredi: <strong style={{ color: "var(--text-2)" }}>{creditsLeft}</strong>
        </div>
      )}

      {error  && <ErrorBanner   message={error}   onDismiss={() => setError(null)} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}
      {failureInfo && (
        <RiskFailureCard
          code={failureInfo.code}
          message={failureInfo.message}
          nextAction={failureInfo.next_action}
          onDismiss={() => setFailureInfo(null)}
        />
      )}

      {/* Loading skeleton */}
      {reportLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} aria-live="polite">
          {[88, 220, 140, 180, 100].map((h, i) => (
            <div key={i} aria-hidden style={{
              height: h, borderRadius: 12, opacity: 0.55,
              background: "linear-gradient(90deg, var(--line) 25%, var(--bg-card) 50%, var(--line) 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.4s infinite",
            }} />
          ))}
        </div>
      )}

      {/* ── Main content ── */}
      {!reportLoading && report && (
        <ReportView
          report={report}
          isAdmin={isAdmin}
          windowDays={windowDays}
          onRefresh={() => runScan(true)}
          profileId={report.profile_id}
          resolvedInfo={resolvedInfo}
          reportMode={reportMode}
          warnings={scanWarnings}
        />
      )}

      {/* ── Empty state: two-column layout with info panel ── */}
      {!reportLoading && !report && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 20,
          alignItems: "start",
        }}>
          {/* Left: hero empty state */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", textAlign: "center",
            padding: "56px 32px",
            background: "var(--bg-card)", border: "1px solid var(--line)", borderRadius: 14,
            minHeight: 440,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18, marginBottom: 20,
              background: "linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(99,102,241,0.06) 100%)",
              border: "1px solid rgba(124,58,237,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ShieldAlert size={32} style={{ color: "#7c3aed", opacity: 0.7 }} aria-hidden />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", margin: "0 0 10px" }}>
              Risk analizi başlatın
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 360, lineHeight: 1.7, margin: "0 0 24px" }}>
              Herhangi bir @username, profil URL&apos;si veya influencer adı girin.
              Archive&apos;da yoksa sistem otomatik olarak profili çözümler ve tarar.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {[
                { icon: <ShieldAlert size={13} />, label: "Fraud & Authenticity", color: "#7c3aed" },
                { icon: <Activity size={13} />,    label: "Growth Anomalies",     color: "#ef4444" },
                { icon: <TrendingUp size={13} />,  label: "Brand Alignment",      color: "#22c55e" },
                { icon: <BarChart2 size={13} />,   label: "Volatility Score",     color: "#f59e0b" },
                { icon: <Eye size={13} />,          label: "Sentiment Trend",      color: "#6366f1" },
                { icon: <Layers size={13} />,      label: "Engagement Quality",   color: "#06b6d4" },
              ].map(f => (
                <span key={f.label} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 11, padding: "5px 11px", borderRadius: 20, fontWeight: 500,
                  background: `${f.color}10`, border: `1px solid ${f.color}25`,
                  color: f.color,
                }}>
                  {f.icon} {f.label}
                </span>
              ))}
            </div>
            <div style={{
              marginTop: 24, display: "flex", alignItems: "center", gap: 7,
              padding: "8px 14px", borderRadius: 8,
              background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.14)",
              fontSize: 11, color: "var(--text-3)", maxWidth: 380,
            }}>
              <Info size={11} style={{ flexShrink: 0 }} />
              Archive&apos;da kayıtlı profiller daha zengin kanıt sunar. Yeni profiller limited mode ile başlar.
            </div>
          </div>

          {/* Right: info panel */}
          <InfoPanel />
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @media (max-width: 900px) {
          .rr-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
