"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dna, Search, RefreshCw, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, Clock, BarChart2, Shield,
  Zap, Info, ChevronDown, ChevronUp, Users, Activity,
  ExternalLink, X, Loader2, Database, Image, ArrowUpRight,
} from "lucide-react";
import {
  digitalTwinApi,
  type DigitalTwin, type TwinForecast,
  CONFIDENCE_LABEL, CONFIDENCE_COLOR,
  RISK_TREND_LABEL, RISK_TREND_COLOR,
  STABILITY_LABEL, READINESS_LABEL, READINESS_COLOR,
} from "@/lib/digital-twin-api";
import {
  influencersApi,
  archiveAdminApi,
  type InfluencerLookupResult,
  PLATFORM_LABEL, PLATFORM_COLOR, PLATFORM_BG,
} from "@/lib/influencers-api";
import { authApi } from "@/lib/api";
import ProfileAvatar from "@/components/ProfileAvatar";

// ─── Formatting helpers ───────────────────────────────────────────────────────

function pctLabel(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "Bugün";
  if (days === 1) return "Dün";
  if (days < 30) return `${days} gün önce`;
  if (days < 365) return `${Math.floor(days / 30)} ay önce`;
  return `${Math.floor(days / 365)} yıl önce`;
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: string }) {
  const color = CONFIDENCE_COLOR[level as keyof typeof CONFIDENCE_COLOR] || "var(--text-3)";
  const label = CONFIDENCE_LABEL[level as keyof typeof CONFIDENCE_LABEL] || level;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      border: `1px solid ${color}`, color, fontSize: 11, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

function ReadinessBadge({ r }: { r: string }) {
  const color = READINESS_COLOR[r as keyof typeof READINESS_COLOR] || "var(--text-3)";
  const label = READINESS_LABEL[r as keyof typeof READINESS_LABEL] || r;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      background: `${color}18`, color, fontSize: 11, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const label = PLATFORM_LABEL[platform] || platform;
  const color = PLATFORM_COLOR[platform] || "var(--text-3)";
  const bg    = PLATFORM_BG[platform]    || "var(--bg-subtle)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: bg, color,
    }}>
      {label}
    </span>
  );
}

function SufficiencyBadge({ s }: { s: InfluencerLookupResult["data_sufficiency"] }) {
  if (s.is_sufficient) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: "var(--green-bg, #f0fdf4)", color: "var(--green, #16a34a)",
      }}>
        <CheckCircle size={10} />
        Tahmin Hazır
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: "#fef3c7", color: "#92400e",
    }}>
      <AlertTriangle size={10} />
      Yetersiz Veri
    </span>
  );
}

function TwinStatusBadge({ result }: { result: InfluencerLookupResult }) {
  if (result.has_digital_twin) {
    const color = CONFIDENCE_COLOR[result.twin_confidence || "insufficient"];
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: `${color}18`, color,
      }}>
        <Dna size={10} />
        Twin: {CONFIDENCE_LABEL[result.twin_confidence || "insufficient"] || result.twin_confidence}
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: "var(--bg-subtle)", color: "var(--text-3)",
    }}>
      <Dna size={10} />
      Twin Yok
    </span>
  );
}

// ─── Evidence accordion ───────────────────────────────────────────────────────

function EvidencePanel({ evidence }: { evidence: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const blocks = Object.values(evidence) as Array<{
    dimension?: string; labels?: string[]; basis?: string[]; drivers?: string[];
  }>;
  if (!blocks.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-3)", fontSize: 12, padding: 0,
        }}
      >
        <Info size={12} />
        Kanıt Detayları
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {blocks.map((block, i) => (
            <div key={i} style={{
              padding: "10px 12px", borderRadius: 8,
              background: "var(--bg-subtle)", border: "1px solid var(--line)",
            }}>
              {block.dimension && (
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 6, textTransform: "capitalize" }}>
                  {block.dimension.replace(/_/g, " ")}
                </div>
              )}
              {block.labels && block.labels.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {block.labels.map((l, j) => (
                    <span key={j} style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 4,
                      background: "var(--bg-muted)", color: "var(--text-3)", fontWeight: 500,
                    }}>
                      {l}
                    </span>
                  ))}
                </div>
              )}
              {(block.basis || block.drivers || []).map((line: string, j: number) => (
                <p key={j} style={{ margin: "3px 0", fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>
                  • {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Horizon forecast card ────────────────────────────────────────────────────

function HorizonCard({ forecast }: { forecast: TwinForecast }) {
  const followerColor =
    forecast.followers_projection_pct > 5 ? "var(--green)" :
    forecast.followers_projection_pct < -2 ? "#ef4444" :
    "var(--text-2)";
  const erColor =
    forecast.engagement_projection_pct > 0 ? "var(--green)" :
    forecast.engagement_projection_pct < -5 ? "#ef4444" :
    "var(--text-2)";

  return (
    <div style={{
      flex: "1 1 280px", minWidth: 0,
      background: "var(--bg-elevated)", borderRadius: 12,
      border: "1px solid var(--line)", padding: 16,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{forecast.horizon_days} Gün</span>
        <ConfidenceBadge level={forecast.confidence} />
      </div>

      <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "var(--bg-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ color: "var(--text-3)", display: "flex" }}><Users size={12} /></span>
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>TAKİPÇİ TAHMİNİ</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: followerColor }}>
            {pctLabel(forecast.followers_projection_pct)}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {fmtFollowers(forecast.followers_current)} → {fmtFollowers(forecast.followers_projected)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
          Aralık: {pctLabel(forecast.followers_range_low_pct)} / {pctLabel(forecast.followers_range_high_pct)}
        </div>
      </div>

      <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "var(--bg-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ color: "var(--text-3)", display: "flex" }}><Activity size={12} /></span>
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>ENGAGEMENT TAHMİNİ</span>
          {forecast.engagement_decay_risk && (
            <AlertTriangle size={11} style={{ color: "var(--amber)" }} />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: erColor }}>
            {pctLabel(forecast.engagement_projection_pct)}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {forecast.engagement_current?.toFixed(2)}% → {forecast.engagement_projected?.toFixed(2)}%
          </span>
        </div>
        {forecast.engagement_decay_risk && (
          <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>
            Engagement azalma sinyali tespit edildi
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: "var(--bg-subtle)" }}>
          <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 500, marginBottom: 4 }}>RİSK</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
            color: RISK_TREND_COLOR[forecast.risk_trend],
          }}>
            {forecast.risk_trend === "increasing" ? <TrendingUp size={12} /> :
             forecast.risk_trend === "declining"  ? <TrendingDown size={12} /> :
             <Minus size={12} />}
            {RISK_TREND_LABEL[forecast.risk_trend]}
          </div>
        </div>
        <div style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: "var(--bg-subtle)" }}>
          <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 500, marginBottom: 4 }}>STABİLİTE</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>
            {STABILITY_LABEL[forecast.stability_trend]}
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-subtle)", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ color: "var(--text-3)", display: "flex" }}><Zap size={11} /></span>
          <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>KAMPANYA HAZIRLIĞI</span>
        </div>
        <div style={{ marginBottom: 6 }}><ReadinessBadge r={forecast.campaign_readiness} /></div>
        <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5, margin: 0 }}>
          {forecast.campaign_recommendation}
        </p>
      </div>

      {forecast.limitations?.length > 0 && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-subtle)", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "var(--amber)", fontWeight: 600, marginBottom: 4 }}>KISITLAMALAR</div>
          {forecast.limitations.map((l, i) => (
            <p key={i} style={{ margin: "2px 0", fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>• {l}</p>
          ))}
        </div>
      )}

      {forecast.evidence && Object.keys(forecast.evidence).length > 0 && (
        <EvidencePanel evidence={forecast.evidence as Record<string, unknown>} />
      )}
    </div>
  );
}

// ─── Result card (search results list) ───────────────────────────────────────

function ResultCard({
  result,
  isSelected,
  onSelect,
}: {
  result: InfluencerLookupResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        padding: "12px 14px", borderRadius: 10, cursor: "pointer",
        border: isSelected ? "2px solid var(--brand-600)" : "1px solid var(--line)",
        background: isSelected ? "var(--green-bg, #f0fdf4)" : "var(--bg-elevated)",
        transition: "all 0.12s",
      }}
    >
      {/* Avatar */}
      <ProfileAvatar
        src={result.profile_image_url}
        name={result.display_name || result.username}
        platform={result.platform}
        size={44}
        borderRadius={10}
        showBadge
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
            {result.display_name}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>@{result.username}</span>
          <PlatformBadge platform={result.platform} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {result.followers > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              {fmtFollowers(result.followers)} takipçi
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {result.snapshot_count} snapshot · {result.history_days} gün geçmiş
          </span>
          <SufficiencyBadge s={result.data_sufficiency} />
          <TwinStatusBadge result={result} />
        </div>
      </div>

      {/* Action hint */}
      <div style={{ flexShrink: 0, color: isSelected ? "var(--brand-600)" : "var(--text-3)" }}>
        {isSelected ? <CheckCircle size={18} /> : <ExternalLink size={15} />}
      </div>
    </button>
  );
}

// ─── Selected profile panel ───────────────────────────────────────────────────

function SelectedProfilePanel({
  result,
  isAdmin,
  onClear,
  onSyncComplete,
  onAvatarResolved,
}: {
  result: InfluencerLookupResult;
  isAdmin: boolean;
  onClear: () => void;
  onSyncComplete?: () => void;
  onAvatarResolved?: (url: string) => void;
}) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      background: "var(--bg-elevated)", border: "2px solid var(--brand-600)",
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ProfileAvatar
          src={result.profile_image_url}
          name={result.display_name || result.username}
          platform={result.platform}
          size={52}
          borderRadius={12}
          showBadge
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{result.display_name}</span>
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>@{result.username}</span>
            <PlatformBadge platform={result.platform} />
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {result.followers > 0 && (
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                <strong style={{ color: "var(--text-2)" }}>{fmtFollowers(result.followers)}</strong> takipçi
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              <strong style={{ color: "var(--text-2)" }}>{result.snapshot_count}</strong> snapshot
            </span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              <strong style={{ color: "var(--text-2)" }}>{result.history_days}</strong> gün geçmiş
            </span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              Son: <strong style={{ color: "var(--text-2)" }}>{relativeDate(result.last_snapshot_at)}</strong>
            </span>
          </div>
          {!result.data_sufficiency.is_sufficient && result.data_sufficiency.reason && (
            <div style={{
              marginTop: 8, padding: "6px 10px", borderRadius: 6,
              background: "#fef3c7", border: "1px solid #fcd34d", fontSize: 12, color: "#92400e",
              display: "flex", gap: 6, alignItems: "flex-start",
            }}>
              <span style={{ flexShrink: 0, marginTop: 1, display: "flex" }}><AlertTriangle size={12} /></span>
              {result.data_sufficiency.reason}
            </div>
          )}
        </div>

        <button
          onClick={onClear}
          style={{
            flexShrink: 0, background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", padding: 4, borderRadius: 6,
          }}
          title="Seçimi kaldır"
        >
          <X size={16} />
        </button>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <AdminActionsPanel
          profileId={result.profile_id}
          onSyncComplete={onSyncComplete}
          onAvatarResolved={onAvatarResolved}
        />
      )}
    </div>
  );
}

// ─── Admin actions panel ──────────────────────────────────────────────────────

function AdminActionsPanel({
  profileId,
  onSyncComplete,
  onAvatarResolved,
}: {
  profileId: number;
  onSyncComplete?: () => void;
  onAvatarResolved?: (url: string) => void;
}) {
  const [syncing,    setSyncing]    = useState(false);
  const [resolving,  setResolving]  = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true); setMsg(null);
    try {
      const res = await archiveAdminApi.syncProfile(profileId);
      setMsg({ type: "ok", text: (res.note as string) || (res.message as string) || "Sync tamamlandı." });
      onSyncComplete?.();
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Sync hatası." });
    } finally {
      setSyncing(false);
    }
  };

  const handleResolveAvatar = async () => {
    setResolving(true); setMsg(null);
    try {
      const res = await archiveAdminApi.resolveAvatar(profileId);
      if (res.ok && res.profile_image_url) {
        setMsg({ type: "ok", text: "Avatar güncellendi." });
        onAvatarResolved?.(res.profile_image_url);
      } else {
        setMsg({ type: "err", text: res.error || "Avatar çözümlenemedi — provider key eksik olabilir." });
      }
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Avatar resolve hatası." });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div style={{
      marginTop: 12, paddingTop: 12,
      borderTop: "1px solid var(--line)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Admin İşlemleri
      </div>
      {msg && (
        <div style={{
          marginBottom: 8, padding: "6px 10px", borderRadius: 6, fontSize: 12,
          background: msg.type === "ok" ? "var(--green-bg, #f0fdf4)" : "#fef2f2",
          color: msg.type === "ok" ? "var(--green, #16a34a)" : "#dc2626",
          border: `1px solid ${msg.type === "ok" ? "var(--green, #22c55e)" : "#fca5a5"}`,
        }}>
          {msg.text}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer",
            background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)",
            opacity: syncing ? 0.6 : 1,
          }}
        >
          <span style={{ display: "flex" }}>{syncing ? <Loader2 size={12} /> : <Database size={12} />}</span>
          {syncing ? "Sync yapılıyor…" : "Snapshot Sync Başlat"}
        </button>

        <button
          onClick={handleResolveAvatar}
          disabled={resolving}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer",
            background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)",
            opacity: resolving ? 0.6 : 1,
          }}
        >
          <span style={{ display: "flex" }}>{resolving ? <Loader2 size={12} /> : <Image size={12} />}</span>
          {resolving ? "Çözümleniyor…" : "Avatar Resolve Et"}
        </button>

        <a
          href="/admin/archive"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
            background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)",
            textDecoration: "none",
          }}
        >
          <span style={{ display: "flex" }}><ArrowUpRight size={12} /></span>
          Archive&apos;a Git
        </a>
      </div>
    </div>
  );
}

// ─── Insufficient data panel ──────────────────────────────────────────────────

function InsufficientDataPanel({
  s,
  isAdmin,
  profileId,
  onSyncComplete,
  onAvatarResolved,
}: {
  s: InfluencerLookupResult["data_sufficiency"];
  isAdmin: boolean;
  profileId: number;
  onSyncComplete?: () => void;
  onAvatarResolved?: (url: string) => void;
}) {
  const readyDate = s.estimated_ready_at
    ? new Date(s.estimated_ready_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div style={{
      padding: "20px 24px", borderRadius: 12,
      background: "var(--bg-elevated)", border: "1px solid var(--line)",
      marginBottom: 20,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }}>
          <AlertTriangle size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", marginBottom: 8 }}>
            Forecast Üretilemedi
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
            Bu influencer için yeterli geçmiş veri yok. Digital Twin™ tahminleri gerçek
            snapshot geçmişine dayanır — sahte veri üretilmez.
          </p>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            padding: "12px 16px", borderRadius: 8, background: "var(--bg-subtle)",
            marginBottom: 12,
          }}>
            {[
              { label: "Gereken Snapshot", req: s.required_snapshots, actual: s.actual_snapshots, ok: s.actual_snapshots >= s.required_snapshots },
              { label: "Gereken Süre",     req: `${s.required_days} gün`, actual: `${s.actual_days} gün`, ok: s.actual_days >= s.required_days },
            ].map(({ label, req, actual, ok }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ok ? "var(--green)" : "#ef4444" }}>
                    {actual}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>/ min {req}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Missing list */}
          {s.missing.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {s.missing.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#92400e", marginBottom: 3 }}>
                  <span style={{ display: "flex", color: "var(--amber)" }}><Clock size={11} /></span>
                  {m}
                </div>
              ))}
            </div>
          )}

          {/* Estimated ready date */}
          {readyDate && (
            <div style={{
              marginBottom: 12, padding: "8px 12px", borderRadius: 8,
              background: "var(--bg-subtle)", border: "1px solid var(--line)",
              display: "flex", gap: 8, alignItems: "center",
            }}>
              <span style={{ display: "flex", color: "var(--text-3)" }}><Clock size={13} /></span>
              <div>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Tahmini hazır: </span>
                <strong style={{ fontSize: 12, color: "var(--text-2)" }}>{readyDate}</strong>
                <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>
                  (ilk snapshot + {s.required_days} gün)
                </span>
              </div>
            </div>
          )}

          <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>
            Bu profil archive&apos;a düzenli olarak sync edilirse, zamanla yeterli veri birikecek
            ve tahmin oluşturulabilecektir.
          </p>

          {/* Admin actions */}
          {isAdmin && (
            <AdminActionsPanel
              profileId={profileId}
              onSyncComplete={onSyncComplete}
              onAvatarResolved={onAvatarResolved}
            />
          )}

          {/* Normal user info */}
          {!isAdmin && (
            <div style={{
              marginTop: 12, padding: "8px 12px", borderRadius: 8,
              background: "var(--bg-subtle)", fontSize: 12, color: "var(--text-3)",
              lineHeight: 1.5,
            }}>
              Platform yöneticisi bu profil için snapshot sync başlatabilir.
              Veri biriktiğinde tahmin otomatik olarak kullanılabilir hale gelir.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DigitalTwinPage() {
  const [query, setQuery]               = useState("");
  const [platform, setPlatform]         = useState("auto");
  const [lookupResults, setLookupResults] = useState<InfluencerLookupResult[] | null>(null);
  const [searching, setSearching]       = useState(false);
  const [selected, setSelected]         = useState<InfluencerLookupResult | null>(null);
  const [twin, setTwin]                 = useState<DigitalTwin | null>(null);
  const [twinLoading, setTwinLoading]   = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);
  const [isAdmin, setIsAdmin]           = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMessages = () => { setError(null); setSuccessMsg(null); };

  // Load admin status
  useEffect(() => {
    authApi.me().then(u => setIsAdmin(!!u.is_admin)).catch(() => {});
  }, []);

  // ── Auto-load twin when influencer is selected ───────────────────────────
  useEffect(() => {
    if (!selected) { setTwin(null); return; }
    if (!selected.has_digital_twin) { setTwin(null); return; }
    setTwinLoading(true);
    clearMessages();
    digitalTwinApi.get(selected.profile_id)
      .then(setTwin)
      .catch(() => setTwin(null))
      .finally(() => setTwinLoading(false));
  }, [selected]);

  // ── Search ───────────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { setLookupResults(null); return; }
    setSearching(true);
    clearMessages();
    try {
      const res = await influencersApi.lookup(trimmed, platform !== "auto" ? platform : undefined);
      setLookupResults(res.results);
      // Auto-select if single result
      if (res.results.length === 1) {
        setSelected(res.results[0]);
      } else {
        setSelected(null);
        setTwin(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setLookupResults([]);
    } finally {
      setSearching(false);
    }
  }, [platform]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setLookupResults(null); setSelected(null); setTwin(null); return; }
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  };

  const handleSelectResult = (result: InfluencerLookupResult) => {
    setSelected(result);
    setLookupResults(null);  // collapse results panel after selection
  };

  const handleClearSelection = () => {
    setSelected(null);
    setTwin(null);
    setQuery("");
    setLookupResults(null);
    clearMessages();
  };

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    clearMessages();
    try {
      const res = await digitalTwinApi.generate(selected.profile_id);
      if (res.twin) {
        setTwin(res.twin);
        setSelected(prev => prev ? { ...prev, has_digital_twin: true, twin_confidence: res.twin!.confidence } : prev);
        setSuccessMsg(`Digital Twin oluşturuldu. ${res.signals_extracted ?? 0} sinyal çıkarıldı.`);
      } else {
        setError(res.unavailability_reason ?? "Twin oluşturulamadı — yeterli snapshot yok.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = async () => {
    if (!selected) return;
    setGenerating(true);
    clearMessages();
    try {
      const res = await digitalTwinApi.refresh(selected.profile_id);
      if (res.twin) {
        setTwin(res.twin);
        setSuccessMsg("Digital Twin yenilendi.");
      } else {
        setError(res.unavailability_reason ?? "Yenileme başarısız.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = selected?.data_sufficiency.is_sufficient ?? false;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--accent-500)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Dna size={18} color="#fff" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-1)" }}>
              Influencer Digital Twin™
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-3)" }}>
              Geçmiş veriye dayalı davranış tahmini · Evidence-based · Explainable
            </p>
          </div>
        </div>
        <div style={{
          padding: "9px 14px", borderRadius: 8,
          background: "var(--bg-subtle)", border: "1px solid var(--line)",
          display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <span style={{ color: "var(--text-3)", display: "flex", flexShrink: 0, marginTop: 1 }}>
            <Info size={13} />
          </span>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
            Tüm tahminler gerçek snapshot geçmişinden üretilir.
            Sahte confidence, rastgele projeksiyon veya seeded pattern yoktur.
          </p>
        </div>
      </div>

      {/* ── Search bar ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {/* Platform selector */}
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value)}
          style={{
            padding: "9px 12px", borderRadius: 8, fontSize: 13,
            border: "1px solid var(--line)", background: "var(--bg-elevated)",
            color: "var(--text-2)", cursor: "pointer",
          }}
        >
          <option value="auto">Tüm Platformlar</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
        </select>

        {/* Query input */}
        <div style={{ flex: "1 1 260px", position: "relative" }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }}>
            {searching ? <Loader2 size={14} /> : <Search size={14} />}
          </div>
          <input
            type="text"
            placeholder="Kullanıcı adı, @handle veya profil URL girin…"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            style={{
              width: "100%", padding: "9px 36px 9px 36px", borderRadius: 8,
              border: "1px solid var(--line)", background: "var(--bg-elevated)",
              color: "var(--text-1)", fontSize: 14, outline: "none",
              boxSizing: "border-box",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setLookupResults(null); setSelected(null); setTwin(null); }}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-3)", padding: 2,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => doSearch(query)}
          disabled={searching || !query.trim()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: 8, cursor: "pointer",
            background: "var(--bg-subtle)", border: "1px solid var(--line)",
            color: "var(--text-1)", fontSize: 13, fontWeight: 500,
            opacity: !query.trim() ? 0.5 : 1,
          }}
        >
          <Search size={14} />
          Ara
        </button>
      </div>

      {/* ── Input hints ────────────────────────────────────────────── */}
      {!query && !selected && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {[
            "@cristiano", "instagram:mkbhd", "https://www.tiktok.com/@khaby.lame",
          ].map(hint => (
            <button
              key={hint}
              onClick={() => { setQuery(hint); doSearch(hint); }}
              style={{
                padding: "4px 10px", borderRadius: 999, border: "1px solid var(--line)",
                background: "var(--bg-subtle)", fontSize: 11, color: "var(--text-3)",
                cursor: "pointer", fontFamily: "var(--font-mono)",
              }}
            >
              {hint}
            </button>
          ))}
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8,
          background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626",
          fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8,
          background: "var(--green-bg, #f0fdf4)", border: "1px solid var(--green, #22c55e)",
          color: "var(--green, #16a34a)", fontSize: 13,
          display: "flex", gap: 8, alignItems: "flex-start",
        }}>
          <CheckCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          {successMsg}
        </div>
      )}

      {/* ── Search results panel ─────────────────────────────────────── */}
      {lookupResults !== null && !selected && (
        <div style={{ marginBottom: 20 }}>
          {lookupResults.length === 0 ? (
            /* Empty state */
            <div style={{
              padding: "28px 24px", borderRadius: 12,
              background: "var(--bg-elevated)", border: "1px solid var(--line)",
              textAlign: "center",
            }}>
              <div style={{ color: "var(--text-3)", marginBottom: 12 }}><Search size={32} /></div>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: "var(--text-2)" }}>
                Influencer bulunamadı
              </h3>
              <p style={{ margin: "0 auto", fontSize: 13, color: "var(--text-3)", maxWidth: 420, lineHeight: 1.6 }}>
                <strong>&ldquo;{query}&rdquo;</strong> archive veritabanında bulunamadı.
                Digital Twin oluşturmak için önce bu influencer&apos;ın archive&apos;a eklenmesi
                ve en az 3 snapshot / 30 günlük geçmiş oluşması gerekir.
              </p>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                <a href="/admin/archive" style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                  background: "var(--bg-subtle)", border: "1px solid var(--line)",
                  color: "var(--text-2)", textDecoration: "none",
                }}>
                  Archive&apos;a Git →
                </a>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>
                {lookupResults.length} sonuç bulundu — bir influencer seçin
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lookupResults.map(r => (
                  <ResultCard
                    key={`${r.platform}:${r.profile_id}`}
                    result={r}
                    isSelected={false}
                    onSelect={() => handleSelectResult(r)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Selected influencer panel ─────────────────────────────────── */}
      {selected && (
        <SelectedProfilePanel
          result={selected}
          isAdmin={isAdmin}
          onClear={handleClearSelection}
          onSyncComplete={() => {
            setSuccessMsg("Snapshot sync başlatıldı. Birkaç dakika içinde veri güncellenecek.");
          }}
          onAvatarResolved={(url) => {
            setSelected(prev => prev ? { ...prev, profile_image_url: url, avatar_status: "existing", avatar_source: "profile" } : prev);
            setSuccessMsg("Avatar güncellendi.");
          }}
        />
      )}

      {/* ── Insufficient data ─────────────────────────────────────────── */}
      {selected && !selected.data_sufficiency.is_sufficient && (
        <InsufficientDataPanel
          s={selected.data_sufficiency}
          isAdmin={isAdmin}
          profileId={selected.profile_id}
          onSyncComplete={() => {
            setSuccessMsg("Snapshot sync başlatıldı.");
          }}
          onAvatarResolved={(url) => {
            setSelected(prev => prev ? { ...prev, profile_image_url: url, avatar_status: "existing", avatar_source: "profile" } : prev);
          }}
        />
      )}

      {/* ── Action buttons ────────────────────────────────────────────── */}
      {selected && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {/* Generate */}
          {!twin && !twinLoading && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              title={!canGenerate ? selected.data_sufficiency.reason ?? "Yetersiz veri" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 8,
                background: canGenerate ? "var(--accent-500)" : "var(--bg-subtle)",
                border: canGenerate ? "none" : "1px solid var(--line)",
                color: canGenerate ? "#fff" : "var(--text-3)",
                fontSize: 13, fontWeight: 600,
                cursor: !canGenerate || generating ? "not-allowed" : "pointer",
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? <Loader2 size={14} /> : <Dna size={14} />}
              {generating ? "Üretiliyor…" : "Twin Oluştur (1 kredi)"}
            </button>
          )}

          {/* Refresh */}
          {twin && (
            <button
              onClick={handleRefresh}
              disabled={generating}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 8,
                background: "var(--accent-500)", border: "none",
                color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: generating ? "not-allowed" : "pointer",
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? <Loader2 size={14} /> : <RefreshCw size={14} />}
              {generating ? "Yenileniyor…" : "Twin Yenile (1 kredi)"}
            </button>
          )}

          {twinLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-3)", fontSize: 13 }}>
              <Loader2 size={14} />
              Twin yükleniyor…
            </div>
          )}
        </div>
      )}

      {/* ── Twin overview & forecasts ─────────────────────────────────── */}
      {twin && (
        <>
          {twin.is_mock && (
            <div style={{
              marginBottom: 12, padding: "8px 14px", borderRadius: 8,
              background: "var(--bg-subtle)", border: "1px dashed var(--line)",
              fontSize: 12, color: "var(--text-3)",
              display: "flex", gap: 6, alignItems: "center",
            }}>
              <span style={{ display: "flex" }}><Info size={12} /></span>
              [MOCK] Bu twin MOCK modunda oluşturuldu. Tahminler gerçek veriye dayalı ancak LLM kullanılmadı.
            </div>
          )}

          {/* Overview metrics */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10, marginBottom: 20,
          }}>
            {[
              { label: "Güven",          content: <ConfidenceBadge level={twin.confidence} /> },
              { label: "Kanıt Gücü",     content: <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", textTransform: "capitalize" }}>{twin.evidence_strength === "strong" ? "Güçlü" : twin.evidence_strength === "moderate" ? "Orta" : "Zayıf"}</span> },
              { label: "Snapshot",       content: <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>{twin.snapshot_count}</span> },
              { label: "Kapsama",        content: <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>{twin.snapshot_days_coverage} gün</span> },
              { label: "Oluşturuldu",    content: <span style={{ fontSize: 12, color: "var(--text-2)" }}>{relativeDate(twin.generated_at)}</span> },
            ].map(({ label, content }) => (
              <div key={label} style={{
                padding: "11px 13px", borderRadius: 10,
                background: "var(--bg-elevated)", border: "1px solid var(--line)",
              }}>
                <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 7 }}>
                  {label}
                </div>
                {content}
              </div>
            ))}
          </div>

          {/* Forecast horizon cards */}
          {twin.is_forecast_available && twin.forecasts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", marginBottom: 14 }}>
                Horizon Tahminleri
              </h2>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                {twin.forecasts.map(f => <HorizonCard key={f.id} forecast={f} />)}
              </div>
            </div>
          )}

          {!twin.is_forecast_available && (
            <div style={{
              padding: "18px 20px", borderRadius: 12,
              background: "var(--bg-elevated)", border: "1px solid var(--line)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={15} style={{ color: "var(--amber)" }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>Tahmin Üretilemedi</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)" }}>{twin.unavailability_reason}</p>
            </div>
          )}
        </>
      )}

      {/* ── Empty / intro state ──────────────────────────────────────── */}
      {!selected && lookupResults === null && !searching && (
        <div style={{
          padding: "48px 32px", textAlign: "center",
          background: "var(--bg-elevated)", borderRadius: 12,
          border: "1px solid var(--line)",
        }}>
          <div style={{ color: "var(--text-3)", marginBottom: 16 }}><Dna size={40} /></div>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "var(--text-2)" }}>
            Influencer seçerek tahmin üretin
          </h3>
          <p style={{ margin: "0 auto", fontSize: 13, color: "var(--text-3)", maxWidth: 400, lineHeight: 1.6 }}>
            Yukarıdaki arama kutusuna kullanıcı adı, @handle veya profil URL girin.
          </p>
          <div style={{
            marginTop: 20, display: "inline-flex",
            flexDirection: "column", gap: 6, textAlign: "left",
            padding: "14px 18px", borderRadius: 8, background: "var(--bg-subtle)",
          }}>
            {[
              "Arama ücretsizdir — kredi düşmez",
              "En az 3 snapshot / 30 günlük geçmiş gerekir",
              "Twin oluşturma ve yenileme 1 kredi kullanır",
              "30 / 90 / 180 günlük horizon için tahmin üretilir",
              "Her tahmin için kanıt ve kısıtlamalar gösterilir",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, color: "var(--text-3)" }}>
                <CheckCircle size={11} style={{ color: "var(--green)", flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
