"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi, type Campaign, type LockedSection } from "@/lib/api";
import {
  ArrowLeft, Zap, Target, DollarSign, Calendar, Globe, Tag,
  Users, CheckCircle, AlertTriangle, Info, BarChart2,
  TrendingUp, Shield, Star, Lightbulb, ChevronRight,
  XCircle, Eye, RefreshCw, Download, Share2, Cpu, Lock,
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
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return iso; }
}

// ── Design constants ───────────────────────────────────────────────────────────

const ACCENT_COLORS = ["#10B981","#6366F1","#F59E0B","#EC4899","#3B82F6","#8B5CF6","#EF4444","#14B8A6"];

const CONF_GRADE_COLOR: Record<string, string> = {
  A: "var(--green)", B: "#6366F1", C: "#F59E0B", D: "var(--red)",
};
const FEAS_COLOR: Record<string, string> = {
  High: "var(--green)", Medium: "#F59E0B", Low: "var(--red)",
};
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  draft:     { label: "Taslak",      color: "var(--text-3)",    dot: "#64748B" },
  active:    { label: "Aktif",       color: "var(--green)",     dot: "#10B981" },
  completed: { label: "Tamamlandı",  color: "#6366F1",          dot: "#6366F1" },
  archived:  { label: "Arşiv",       color: "var(--text-3)",    dot: "#475569" },
};
const GOAL_LABELS: Record<string, string> = {
  brand_awareness: "Marka Bilinirliği", sales: "Satış",
  engagement: "Etkileşim", product_launch: "Ürün Lansmanı",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, sub, color = "var(--green)" }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
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

function Row({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, gap: 8, padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ color: "var(--text-3)" }}>{l}</span>
      <span style={{ color: "var(--text-1)", fontWeight: bold ? 700 : 500, textAlign: "right" }}>{v}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = Number(params?.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!id || isNaN(id)) { setError("Geçersiz kampanya ID."); setLoading(false); return; }
    campaignsApi.get(id)
      .then(setCampaign)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Kampanya yüklenemedi."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320, gap: 12 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--green)", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize: 13, color: "var(--text-3)" }}>Kampanya yükleniyor…</span>
    </div>
  );

  if (error || !campaign) return (
    <div style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(239,68,68,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <XCircle size={28} color="var(--red)" />
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-1)", margin: "0 0 8px" }}>Kampanya Bulunamadı</h2>
      <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 24px", lineHeight: 1.6 }}>
        {error || "Bu kampanya mevcut değil veya erişim izniniz yok."}
      </p>
      <Link href="/campaigns" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "10px 20px", borderRadius: 9, background: "var(--green)", color: "#fff",
        fontWeight: 700, fontSize: 13, textDecoration: "none",
      }}>
        <ArrowLeft size={13} /> Kampanyalara Dön
      </Link>
    </div>
  );

  const sim   = campaign.simulation_result as Record<string, any> | null;
  const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 0 60px" }}>

      {/* ── Breadcrumb ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 12, color: "var(--text-3)" }}>
        <Link href="/campaigns" style={{ color: "var(--text-3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={12} /> Kampanyalar
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{campaign.name}</span>
      </div>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,var(--bg-elevated),rgba(16,185,129,0.04))", borderRadius: 16, border: "1px solid var(--line)", padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "var(--green-bg)", border: "1px solid rgba(16,185,129,0.2)" }}>
                <Cpu size={11} color="var(--green)" />
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--green)" }}>Campaign Intelligence Report</span>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: `${status.dot}18`, border: `1px solid ${status.dot}44`, fontSize: 10, fontWeight: 700, color: status.color }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.dot, display: "inline-block" }} />
                {status.label}
              </span>
              {campaign.report_source && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", fontSize: 10, fontWeight: 700, color: "#6366F1" }}>
                  <Info size={10} color="#6366F1" />
                  {campaign.report_source === "server_provider_discovery" ? "Provider Doğrulamalı"
                    : campaign.report_source === "client_simulation_preview" ? "Simülasyon Önizleme"
                    : "Doğrulanmış Veri Yok"}
                </span>
              )}
              {campaign.redaction_level && campaign.redaction_level !== "none" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: 10, fontWeight: 700, color: "#F59E0B" }}>
                  <Lock size={10} color="#F59E0B" />
                  {campaign.redaction_level === "full" ? "Kısıtlı Erişim" : campaign.redaction_level === "basic" ? "Temel Önizleme" : "Pro Görünüm"}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.03em", color: "var(--text-1)" }}>
              {campaign.name}
            </h1>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-3)" }}>
              {campaign.goal && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Target size={11} /> {GOAL_LABELS[campaign.goal] || campaign.goal}</span>}
              {campaign.budget && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><DollarSign size={11} /> {fmtCurrency(campaign.budget)}</span>}
              {campaign.platform && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Tag size={11} /> {campaign.platform}</span>}
              {campaign.target_country && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Globe size={11} /> {campaign.target_country}</span>}
              {campaign.category && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><BarChart2 size={11} /> {campaign.category}</span>}
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {fmtDate(campaign.created_at)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/campaigns/simulate" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--bg-subtle)", color: "var(--text-2)", border: "1px solid var(--line)", textDecoration: "none" }}>
              <RefreshCw size={11} /> Yeniden Simüle Et
            </Link>
          </div>
        </div>
      </div>

      {/* ── Premium locked sections banner ── */}
      {(campaign.locked_sections?.length ?? 0) > 0 && (
        <PremiumLockedBanner lockedSections={campaign.locked_sections} />
      )}

      {/* ── No simulation result: basic campaign view ── */}
      {!sim && (
        <BasicCampaignView campaign={campaign} />
      )}

      {/* ── Full intelligence report ── */}
      {sim && (
        <IntelligenceReport campaign={campaign} sim={sim} />
      )}
    </div>
  );
}

// ── Premium Locked Banner ──────────────────────────────────────────────────────

function PremiumLockedBanner({ lockedSections }: { lockedSections: LockedSection[] }) {
  const highestPlan = lockedSections.reduce((acc, s) => {
    const order: Record<string, number> = { starter: 1, pro: 2, agency: 3 };
    return (order[s.required_plan] || 0) > (order[acc] || 0) ? s.required_plan : acc;
  }, lockedSections[0]?.required_plan || "starter");
  return (
    <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Lock size={16} color="#F59E0B" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#F59E0B", marginBottom: 4 }}>
            {lockedSections.length} bölüm mevcut planınızda kısıtlı
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {lockedSections.map(ls => (
              <div key={ls.key} style={{ padding: "7px 12px", background: "var(--bg-elevated)", borderRadius: 8, border: "1px solid var(--line)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-1)", marginBottom: 2 }}>{ls.title}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)" }}>{ls.message}</div>
              </div>
            ))}
          </div>
          <Link href="/pricing" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, background: "#F59E0B", color: "#fff", fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
            <Zap size={11} /> {highestPlan.charAt(0).toUpperCase() + highestPlan.slice(1)} planına geç
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Basic Campaign View (when no simulation_result) ────────────────────────────

function BasicCampaignView({ campaign }: { campaign: Campaign }) {
  const roi = campaign.roi_estimates as any;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {/* Campaign Profile */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
        <SectionTitle icon={Target} title="Kampanya Profili" />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <Row l="Marka" v={campaign.brand || "—"} />
          <Row l="Platform" v={campaign.platform || "—"} />
          <Row l="Hedef" v={campaign.goal ? (GOAL_LABELS[campaign.goal] || campaign.goal) : "—"} />
          <Row l="Kategori" v={campaign.category || "—"} />
          <Row l="Hedef Ülke" v={campaign.target_country || "—"} />
          <Row l="Bütçe" v={campaign.budget ? fmtCurrency(campaign.budget) : "—"} bold />
          <Row l="Not" v={campaign.notes || "—"} />
        </div>
      </div>

      {/* ROI Estimates */}
      {roi && roi.influencer_count > 0 && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px" }}>
          <SectionTitle icon={TrendingUp} title="Analiz Tabanlı Tahminler" sub="Kullanıcının analiz geçmişine dayalı" />
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <Row l="Influencer Sayısı" v={String(roi.influencer_count)} />
            <Row l="Toplam Takipçi" v={fmt(roi.total_followers)} />
            <Row l="Tahminsel Erişim" v={fmt(roi.total_reach)} bold />
            <Row l="Tahminsel İzlenim" v={fmt(roi.total_impressions)} />
            <Row l="Ortalama Fraud Skoru" v={String(roi.avg_fraud_score)} />
            <Row l="Ortalama Marka Uyumu" v={String(roi.avg_brand_fit)} />
          </div>
          <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(245,158,11,0.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,0.15)", fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
            {roi.note}
          </div>
        </div>
      )}

      {/* Recommended Influencers */}
      {campaign.recommended_influencers && campaign.recommended_influencers.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "20px 22px", gridColumn: "1 / -1" }}>
          <SectionTitle icon={Users} title="Önerilen Creator'lar" sub="Analiz geçmişinden otomatik eşleşme" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {campaign.recommended_influencers.map((inf: any, i: number) => (
              <div key={i} style={{ padding: "12px 14px", background: "var(--bg-subtle)", borderRadius: 10, border: "1px solid var(--line)" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-1)", marginBottom: 4 }}>@{inf.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6 }}>{inf.platform} · {fmt(inf.followers)}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "rgba(16,185,129,0.1)", color: "var(--green)", fontWeight: 600 }}>Final: {inf.final_score}</span>
                  <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "rgba(99,102,241,0.1)", color: "#6366F1", fontWeight: 600 }}>Fit: {inf.brand_fit_score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No sim result CTA */}
      <div style={{ gridColumn: "1 / -1", background: "linear-gradient(135deg,rgba(16,185,129,0.06),rgba(99,102,241,0.04))", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "24px 28px", textAlign: "center" }}>
        <Zap size={28} color="var(--green)" style={{ marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", margin: "0 0 8px" }}>Gelişmiş Kampanya Analizi</h3>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 18px", lineHeight: 1.65 }}>
          Bu kampanya için henüz Campaign Intelligence simülasyonu çalıştırılmamış.
          Simülasyon çalıştırarak güven skoru, creator portföyü, bütçe optimizasyonu ve erişim tahminleri alabilirsiniz.
        </p>
        <Link href="/campaigns/simulate" style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "11px 22px", borderRadius: 10, background: "var(--green)", color: "#fff",
          fontWeight: 700, fontSize: 13, textDecoration: "none",
        }}>
          <Zap size={13} /> Simülasyon Çalıştır
        </Link>
      </div>
    </div>
  );
}

// ── Intelligence Report (when simulation_result exists) ────────────────────────

function IntelligenceReport({ campaign, sim }: { campaign: Campaign; sim: Record<string, any> }) {
  const conf  = sim.confidence  as Record<string, any> | null;
  const feas  = sim.feasibility as Record<string, any> | null;
  const prof  = sim.campaignProfile as Record<string, any> | null;
  const aud   = sim.audienceIntelligence as Record<string, any> | null;
  const port  = sim.portfolio    as Record<string, any> | null;
  const creators: any[] = sim.creators || [];
  const reach  = sim.totalReach  as Record<string, any> | null;
  const eng    = sim.totalEngagement as Record<string, any> | null;
  const cpe    = sim.estimatedCPE as { low: number; high: number } | null;

  const confColor = conf ? (CONF_GRADE_COLOR[conf.grade] || "var(--text-3)") : "var(--text-3)";
  const feasColor = feas ? (FEAS_COLOR[feas.level] || "#F59E0B") : "#F59E0B";
  const feasLabel = feas?.level === "High" ? "Yüksek" : feas?.level === "Medium" ? "Orta" : "Düşük";

  const budgetData = creators.length > 0
    ? creators.map((c: any, i: number) => ({
        name: `@${c.card?.username || `Creator${i+1}`}`,
        value: Math.round((c.budgetPct || 0) * 10) / 10,
        abs:   Math.round(c.allocatedBudget || 0),
        color: ACCENT_COLORS[i % ACCENT_COLORS.length],
      }))
    : (port?.tiers || []).map((t: any, i: number) => ({
        name: t.label, value: t.budgetPct || 0, abs: t.budgetAbs || 0, color: t.color || ACCENT_COLORS[i],
      }));

  const perfData = creators.map((c: any) => ({
    name:    `@${(c.card?.username || "").slice(0, 10)}`,
    quality: c.qualityScore || 0,
    reach:   Math.round((c.estimatedReach?.expected || 0) / 1000),
  }));

  const excludedFromPortfolio: number = (sim.excludedFromPortfolio as number) || 0;
  const lowConfCreators = creators.filter((c: any) => c.completenessLevel === "low_confidence");

  return (
    <div>
      {/* ── Data quality warnings ── */}
      {excludedFromPortfolio > 0 && (
        <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
            <strong style={{ color: "#F59E0B" }}>Veri Kalitesi Filtresi:</strong> {excludedFromPortfolio} creator yetersiz veri kalitesi (tamamlama skoru %60 altında) nedeniyle portföye alınmadı.
            Portföy kalitesini artırmak için Discovery&apos;den gerçek analiz yapın.
          </div>
        </div>
      )}
      {lowConfCreators.length > 0 && (
        <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)", borderRadius: 10, padding: "11px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Info size={13} color="#6366F1" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
            <strong style={{ color: "#6366F1" }}>Düşük Güven:</strong> {lowConfCreators.length} creator düşük veri güveni (%60–%75 tamamlama) ile portföyde. Bütçeleri %15 ile sınırlandırıldı.
          </div>
        </div>
      )}

      {/* ── Summary ── */}
      {sim.summary && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 22px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Yönetici Özeti</div>
          <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.7 }}>{sim.summary}</div>
        </div>
      )}

      {/* ── Confidence + Feasibility ── */}
      {(conf || feas) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {conf && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--bg-elevated)", borderRadius: 10, border: `1px solid ${confColor}28` }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: `${confColor}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: confColor }}>{conf.grade}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Güven Skoru</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: confColor, letterSpacing: "-0.03em" }}>{conf.overall}/100</div>
              </div>
            </div>
          )}
          {feas && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: "var(--bg-elevated)", borderRadius: 10, border: `1px solid ${feasColor}28` }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: `${feasColor}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Target size={22} color={feasColor} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Fizibilite</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: feasColor, letterSpacing: "-0.03em" }}>{feasLabel}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Campaign profile + Audience intel ── */}
      {(prof || aud) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          {prof && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 22px" }}>
              <SectionTitle icon={Target} title="Kampanya Profili" />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <Row l="Marka" v={campaign.brand || "—"} />
                <Row l="Kategori" v={prof.primaryCategory || "—"} />
                <Row l="Alt Kategori" v={prof.subcategory || "—"} />
                <Row l="Satın Alma Niyeti" v={prof.purchaseIntentLevel || "—"} />
                <Row l="Kampanya Karmaşıklığı" v={prof.campaignComplexity || "—"} />
                <Row l="Tespit Kaynağı" v={prof.detectedFrom || "—"} />
              </div>
            </div>
          )}
          {aud && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 22px" }}>
              <SectionTitle icon={Users} title="Hedef Kitle Analizi" />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <Row l="Birincil Kitle" v={aud.primaryAudience || "—"} />
                <Row l="Yaş Aralığı" v={aud.ageRange || "—"} />
                <Row l="Satın Alma Niyeti" v={aud.purchaseIntent || "—"} />
              </div>
              {aud.interestClusters?.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {aud.interestClusters.map((cluster: string, i: number) => (
                    <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(99,102,241,0.1)", color: "#6366F1", fontWeight: 600 }}>{cluster}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Creator Portfolio ── */}
      {creators.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 22px", marginBottom: 14 }}>
          <SectionTitle icon={Users} title="Creator Portföyü" sub={`${creators.length} creator · Kampanya brief bazlı seçim`} />
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Creator", "Kalite", "Persona", "Ülke", "Kategori", "Erişim", "Bütçe"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creators.map((c: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)" }}>@{c.card?.username}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                        {fmt(c.card?.followers || 0)} · {c.tier}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 2 }}>{c.sourceLabel || c.card?.source || "—"}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {c.qualityScore != null ? (
                          <>
                            <div style={{ height: 3, width: 40, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${c.qualityScore}%`, background: c.qualityScore >= 70 ? "var(--green)" : c.qualityScore >= 50 ? "#F59E0B" : "var(--red)", borderRadius: 99 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: c.qualityScore >= 70 ? "var(--green)" : c.qualityScore >= 50 ? "#F59E0B" : "var(--red)" }}>{c.qualityScore}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                        )}
                        {c.completenessLabel && (
                          <span style={{ fontSize: 8, fontWeight: 700, color: c.completenessLabel === "Düşük Güven" ? "#F59E0B" : "var(--red)", background: c.completenessLabel === "Düşük Güven" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)", borderRadius: 99, padding: "1px 5px" }}>{c.completenessLabel}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "rgba(99,102,241,0.1)", color: "#6366F1", display: "inline-block", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.persona}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {c.countryMatch
                        ? <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--green)", fontWeight: 700 }}><CheckCircle size={10} color="var(--green)" />{c.card?.country || "—"}</span>
                        : <span style={{ fontSize: 10, color: "var(--text-3)" }}>{c.card?.country || "—"}</span>
                      }
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {c.categoryMatch
                        ? <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--green)", fontWeight: 700 }}><CheckCircle size={10} color="var(--green)" />{c.card?.category || "—"}</span>
                        : <span style={{ fontSize: 10, color: "var(--text-3)" }}>{c.card?.category || "—"}</span>
                      }
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)" }}>{fmt(c.estimatedReach?.expected || 0)}</div>
                      <div style={{ fontSize: 9, color: "var(--text-3)" }}>{fmt(c.estimatedReach?.low || 0)}–{fmt(c.estimatedReach?.high || 0)}</div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)" }}>{fmtCurrency(c.allocatedBudget || 0)}</div>
                      <div style={{ fontSize: 9, color: "var(--text-3)" }}>{(c.budgetPct || 0).toFixed(1)}%</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Budget chart + Performance chart ── */}
      {budgetData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, marginBottom: 14 }}>
          <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 20px" }}>
            <SectionTitle icon={DollarSign} title="Bütçe Dağılımı" sub="Creator kalite ağırlıklı" />
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={budgetData} cx="50%" cy="50%" innerRadius={44} outerRadius={70} paddingAngle={2} dataKey="value">
                  {budgetData.map((_: any, i: number) => <Cell key={i} fill={budgetData[i].color} />)}
                </Pie>
                <Tooltip formatter={(v: number, _: string, p: any) => [`${v.toFixed(1)}% (${fmtCurrency(p.payload.abs)})`, p.payload.name]} contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {budgetData.slice(0, 6).map((d: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>{d.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontWeight: 700, color: "var(--text-1)" }}>{d.value.toFixed(1)}%</span>
                    <span style={{ color: "var(--text-3)" }}>{fmtCurrency(d.abs)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {perfData.length > 0 && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 22px" }}>
              <SectionTitle icon={BarChart2} title="Creator Kalite & Erişim" />
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={perfData} barSize={20} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="quality" name="Kalite Skoru" fill="var(--green)" radius={[3,3,0,0]} />
                  <Bar dataKey="reach"   name="Erişim (K)"   fill="#6366F1"     radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Reach + Engagement + CPE ── */}
      {(reach || eng) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          {reach && (
            <MetricCard label="Tahmini Erişim" value={fmt(reach.expected)} range={`${fmt(reach.low)}–${fmt(reach.high)}`} confidence={reach.confidence} color="#6366F1" icon={Users} />
          )}
          {eng && (
            <MetricCard label="Tahmini Etkileşim" value={fmt(eng.expected)} range={`${fmt(eng.low)}–${fmt(eng.high)}`} confidence={eng.confidence} color="#F59E0B" icon={Star} />
          )}
          {cpe ? (
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", borderTop: "3px solid #14B8A6" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Tahmini CPE Aralığı</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 6 }}>
                {fmtCurrency(cpe.low)} – {fmtCurrency(cpe.high)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>Etkileşim başına maliyet tahmini</div>
            </div>
          ) : (
            <UnavailableCard label="Tahmini CPE" reason="Etkileşim verisi yetersiz." />
          )}
        </div>
      )}

      {/* Unavailable forecasts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <UnavailableCard label="Revenue / Gelir"    reason="Geçmiş kampanya dönüşüm verisi gerektirir." />
        <UnavailableCard label="ROAS"               reason="Gerçek dönüşüm oranı olmadan hesaplanamaz." />
        <UnavailableCard label="Conversion / Satış" reason="Tarihsel CVR verisi birikene kadar gösterilmez." />
      </div>

      {/* ── Insights + Risks + Opportunities ── */}
      {(sim.insights?.length || sim.risks?.length || sim.opportunities?.length) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          {sim.insights?.length > 0 && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 20px" }}>
              <SectionTitle icon={Lightbulb} title="AI İçgörüleri" color="#6366F1" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sim.insights.map((ins: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(99,102,241,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 8, fontWeight: 800, color: "#6366F1" }}>✦</span>
                    </div>
                    <span>{ins}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sim.opportunities?.length > 0 && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "18px 20px" }}>
              <SectionTitle icon={TrendingUp} title="Fırsatlar" color="var(--green)" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sim.opportunities.map((o: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
                    <CheckCircle size={12} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{o}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sim.risks?.length > 0 && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid rgba(239,68,68,0.12)", padding: "18px 20px" }}>
              <SectionTitle icon={AlertTriangle} title="Risk Faktörleri" color="var(--red)" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sim.risks.map((r: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
                    <AlertTriangle size={12} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Next Actions ── */}
      {sim.nextActions?.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.06),rgba(99,102,241,0.04))", borderRadius: 14, border: "1px solid rgba(16,185,129,0.15)", padding: "20px 24px", marginBottom: 14 }}>
          <SectionTitle icon={ChevronRight} title="Önerilen Sonraki Adımlar" sub="Kampanyanızı hayata geçirmek için" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {sim.nextActions.map((action: string, i: number) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "11px 13px", background: "var(--bg-elevated)", borderRadius: 9, border: "1px solid var(--line)", fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#fff" }}>{i + 1}</span>
                </div>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Data Source Transparency ── */}
      {sim.dataSourceNotes?.length > 0 && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--line)", padding: "18px 22px", marginBottom: 14 }}>
          <SectionTitle icon={Info} title="Veri Kaynağı & Güvenilirlik" sub="Şeffaflık — hangi veriler nereden geliyor" color="var(--text-3)" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {sim.dataSourceNotes.map((n: string, i: number) => (
              <div key={i} style={{ display: "flex", gap: 7, fontSize: 11, color: "var(--text-2)", lineHeight: 1.55, padding: "7px 10px", background: "var(--bg-subtle)", borderRadius: 7 }}>
                <Info size={11} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{n}</span>
              </div>
            ))}
          </div>
          {conf && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {[
                { l: "Creator Veri Kal.", v: conf.creatorDataQuality },
                { l: "Kitle Uyumu",       v: conf.audienceMatchConfidence },
                { l: "Ülke Eşleşmesi",    v: conf.countryMatchConfidence },
                { l: "Kategori Uyumu",    v: conf.categoryMatchConfidence },
                { l: "Portföy Güven.",    v: conf.portfolioReliability },
              ].map(({ l, v }) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: v >= 70 ? "var(--green)" : v >= 50 ? "#F59E0B" : "var(--red)", letterSpacing: "-0.03em" }}>{v}</div>
                  <div style={{ fontSize: 9, color: "var(--text-3)", lineHeight: 1.3 }}>{l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Forecast note ── */}
      {conf?.forecastReason && (
        <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "14px 18px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Shield size={14} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", marginBottom: 4 }}>Tahmin Güvenilirlik Bildirimi</div>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>{conf.forecastReason}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared metric components ───────────────────────────────────────────────────

function MetricCard({ label, value, range, confidence, color, icon: Icon }: {
  label: string; value: string; range: string;
  confidence: string; color: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}) {
  const confColor = confidence === "High" ? "var(--green)" : confidence === "Medium" ? "#F59E0B" : "var(--red)";
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 12, padding: "18px 20px", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: confColor, background: `${confColor}18`, padding: "2px 7px", borderRadius: 99 }}>{confidence} Güven</span>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={12} color={color} />
          </div>
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 5 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-3)" }}>Aralık: {range}</div>
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
