"use client";
import { useEffect, useState } from "react";
import { dashboardApi, type DashboardStats, type Leaderboards, type AnalysisCard } from "@/lib/api";
import Link from "next/link";
import ProfileAvatar from "@/components/ProfileAvatar";
import UsageLimitBanner from "@/components/premium/UsageLimitBanner";
import PremiumLockedCard from "@/components/premium/PremiumLockedCard";
import { entitlementsApi, type EntitlementMap } from "@/lib/entitlements-api";
import { Dna, Swords, ShieldAlert, FileDown, Layers, BarChart2 } from "lucide-react";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function ScoreBadge({ v, risk }: { v: number; risk?: boolean }) {
  const color = risk
    ? (v < 25 ? "var(--green)" : v < 50 ? "var(--amber)" : "var(--red)")
    : (v >= 70 ? "var(--green)" : v >= 45 ? "var(--amber)" : "var(--red)");
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700,
      background: `${color}1A`, color, letterSpacing: "-0.01em",
    }}>{v}</span>
  );
}

function PlatBadge({ plat }: { plat: string }) {
  const cls = plat === "instagram" ? "badge-ig" : plat === "youtube" ? "badge-yt" : "badge-tt";
  const lbl = plat === "instagram" ? "IG" : plat === "youtube" ? "YT" : "TT";
  return <span className={`badge ${cls}`} style={{ fontSize: 10, padding: "2px 6px" }}>{lbl}</span>;
}

function InfluencerCard({ a, rank, highlight }: { a: AnalysisCard; rank?: number; highlight?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      {rank !== undefined && (
        <div style={{
          width: 24, fontSize: rank === 0 ? 14 : 12, fontWeight: 700,
          color: rank === 0 ? "var(--amber)" : rank < 3 ? "var(--brand-600)" : "var(--text-3)",
          textAlign: "center", flexShrink: 0,
        }}>
          {rank + 1}
        </div>
      )}
      <ProfileAvatar src={a.avatar} name={a.display_name || a.username} size={40} platform={a.platform} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            @{a.username}
          </span>
          <PlatBadge plat={a.platform} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          {fmt(a.followers)} · %{a.engagement_rate.toFixed(1)} · {a.category || "—"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        {highlight === "fraud" && <ScoreBadge v={a.fraud_score} risk />}
        {highlight === "brand" && <ScoreBadge v={a.brand_fit_score} />}
        {highlight === "roi"   && <ScoreBadge v={a.roi_potential_score} />}
        {highlight === "momentum" && <ScoreBadge v={a.momentum_score} />}
        {(!highlight || highlight === "final") && <ScoreBadge v={a.final_score} />}
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>
          {highlight === "fraud" ? "Fraud" : highlight === "brand" ? "Brand" : highlight === "roi" ? "ROI" : highlight === "momentum" ? "Mom." : "Skor"}
        </span>
      </div>
    </div>
  );
}

function LeaderboardSection({ title, icon, items, highlight, emptyText }: {
  title: string; icon: string; items: AnalysisCard[];
  highlight?: string; emptyText: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <h3 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)", margin: 0 }}>{title}</h3>
        {items.length > 0 && <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>{items.length} profil</span>}
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "20px 16px", background: "var(--bg-subtle)", borderRadius: 10, textAlign: "center",
          fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>{emptyText}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.slice(0, 8).map((a, i) => <InfluencerCard key={a.id} a={a} rank={i} highlight={highlight} />)}
        </div>
      )}
    </div>
  );
}

const PREMIUM_MODULES = [
  {
    key:  "digital_twin_forecast",
    icon: Dna,
    title: "Digital Twin™ Forecast",
    message: "90 günlük büyüme ve risk tahmini hazır. Davranış modelini açmak için Agency paketine geçin.",
    plan: "agency",
    href: "/intelligence/digital-twin",
  },
  {
    key:  "competitor_intelligence",
    icon: Swords,
    title: "Competitor Intelligence™",
    message: "Rakip markaların influencer stratejisini görün. Agency paketine geçin.",
    plan: "agency",
    href: "/intelligence/competitor-intelligence",
  },
  {
    key:  "risk_evidence",
    icon: ShieldAlert,
    title: "Risk Kanıtları",
    message: "Kritik risk sinyallerinin detaylı kanıtları için Pro paketine geçin.",
    plan: "pro",
    href: "/intelligence/risk-radar",
  },
  {
    key:  "pdf_export",
    icon: FileDown,
    title: "PDF Rapor",
    message: "Profesyonel raporları indirin ve müşterilerle paylaşın. Pro paketine geçin.",
    plan: "pro",
    href: "/reports",
  },
  {
    key:  "batch_analysis",
    icon: Layers,
    title: "Toplu Analiz",
    message: "Onlarca influencer'ı tek seferde tarayın. Agency paketine geçin.",
    plan: "agency",
    href: "/discovery",
  },
  {
    key:  "scheduled_scan",
    icon: BarChart2,
    title: "Zamanlanmış Tarama",
    message: "Portföyünüzü otomatik günlük izleyin. Agency paketine geçin.",
    plan: "agency",
    href: "/intelligence/risk-radar",
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<EntitlementMap>({});
  const [plan, setPlan] = useState("free");

  useEffect(() => {
    Promise.all([dashboardApi.stats(), dashboardApi.leaderboards()])
      .then(([s, b]) => { setStats(s); setBoards(b); })
      .catch(() => {})
      .finally(() => setLoading(false));

    entitlementsApi.getMyEntitlements()
      .then((r) => { setEntitlements(r.entitlements); setPlan(r.plan); })
      .catch(() => {});
  }, []);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>;

  const s = stats?.stats;
  const hasData = boards?.has_data;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px", color: "var(--text-1)" }}>
            {stats?.user.full_name ? `Hoşgeldin, ${stats.user.full_name}.` : "Dashboard"}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Analizlerin ve risk raporlarına genel bakış.</p>
        </div>
        <Link href="/search" className="btn btn-primary">+ Yeni Analiz</Link>
      </div>

      {/* Credits usage banner */}
      {stats?.stats && (
        <UsageLimitBanner
          creditsRemaining={stats.stats.credits_remaining}
          creditsTotal={stats.stats.credits_total}
          plan={plan}
        />
      )}

      {/* Metric Cards */}
      {s && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { l: "Bu Ay Analiz",   v: s.this_month,        sub: `${s.total_analyses} toplam`, c: "var(--brand-600)" },
            { l: "Kalan Kredi",    v: s.credits_remaining,  sub: `/ ${s.credits_total}`,       c: s.credits_remaining < 3 ? "var(--red)" : "var(--brand-600)" },
            { l: "Düşük Riskli",   v: s.low_risk,           sub: "fraud < 25",                 c: "var(--green)" },
            { l: "Orta Riskli",    v: s.medium_risk,        sub: "fraud 25–59",                c: "var(--amber)" },
            { l: "Yüksek Riskli",  v: s.high_risk,          sub: "fraud ≥ 60",                 c: "var(--red)" },
          ].map((m) => (
            <div key={m.l} className="card" style={{ padding: "16px 18px", borderTop: `3px solid ${m.c}` }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>{m.l}</div>
              <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "var(--font-display)", color: m.c, lineHeight: 1 }}>{m.v}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Platform breakdown */}
      {stats && Object.keys(stats.platforms).length > 0 && (
        <div className="card" style={{ padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Platform:</span>
          {Object.entries(stats.platforms).map(([plat, count]) => (
            <div key={plat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <PlatBadge plat={plat} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboards or Onboarding */}
      {!hasData ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--green-bg)",
            color: "var(--brand-600)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, margin: "0 auto 18px" }}>◎</div>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 8px", color: "var(--text-1)" }}>
            Leaderboard'lar henüz boş
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 20px", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            Analiz yaptıkça Top 10 listeleri burada otomatik dolacak — en düşük riskten, en yüksek ROI'ya.
          </p>
          <Link href="/search" className="btn btn-primary">İlk Analizi Başlat →</Link>
        </div>
      ) : (
        <>
          {/* 5 Leaderboard grid — 2+2+1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <LeaderboardSection title="En Düşük Risk" icon="✓" items={boards?.lowest_risk || []} highlight="fraud"
              emptyText="Analiz yapıldıkça burada görünecek." />
            <LeaderboardSection title="En Yüksek Brand Fit" icon="◈" items={boards?.highest_brand || []} highlight="brand"
              emptyText="Analiz yapıldıkça burada görünecek." />
            <LeaderboardSection title="En Yüksek ROI Potansiyeli" icon="△" items={boards?.highest_roi || []} highlight="roi"
              emptyText="Analiz yapıldıkça burada görünecek." />
            <LeaderboardSection title="En Güçlü Momentum" icon="↑" items={boards?.highest_momentum || []} highlight="momentum"
              emptyText="Analiz yapıldıkça burada görünecek." />
          </div>
          <LeaderboardSection title="En Yüksek Final Skor" icon="⬡" items={boards?.best_overall || []} highlight="final"
            emptyText="Analiz yapıldıkça burada görünecek." />
        </>
      )}

      {/* Premium module teasers — show locked ones only */}
      {(() => {
        const locked = PREMIUM_MODULES.filter((m) => entitlements[m.key] === false);
        if (locked.length === 0) return null;
        return (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text-1)" }}>Premium Modüller</h3>
              <Link href="/pricing" style={{ fontSize: 12, color: "var(--brand-600)", textDecoration: "none" }}>Tüm planları gör →</Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {locked.map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.key} style={{
                    borderRadius: 12, border: "1px solid var(--line)", overflow: "hidden",
                    background: "var(--bg-elevated)",
                    display: "flex", flexDirection: "column",
                  }}>
                    {/* Top stripe */}
                    <div style={{
                      padding: "14px 16px 10px",
                      background: "linear-gradient(135deg,rgba(99,102,241,0.06),rgba(16,185,129,0.04))",
                      borderBottom: "1px solid var(--line)",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9,
                        background: "linear-gradient(135deg,var(--brand-500),#6366F1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <Icon size={16} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{m.title}</div>
                        <div style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                          color: "#6366F1", background: "rgba(99,102,241,0.1)", borderRadius: 99,
                          padding: "1px 7px", display: "inline-block", marginTop: 2,
                        }}>
                          {m.plan === "agency" ? "Agency" : m.plan === "pro" ? "Pro" : m.plan} paketi
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: "12px 16px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 12px", lineHeight: 1.6 }}>{m.message}</p>
                      <PremiumLockedCard
                        featureKey={m.key}
                        title={m.title}
                        message={m.message}
                        requiredPlan={m.plan}
                        currentPlan={plan}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Recent Analyses Table */}
      {stats && stats.recent_analyses.length > 0 && (
        <div className="card" style={{ padding: 18, marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--text-1)" }}>Son Analizler</h3>
            <Link href="/reports" style={{ fontSize: 12, color: "var(--brand-600)", textDecoration: "none" }}>Tümünü gör →</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 60px 80px",
              gap: 10, padding: "4px 10px", fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>
              {["Profil", "Takipçi", "Etk.%", "Final", "Fraud", "Tarih"].map((h) => (
                <div key={h}>{h}</div>
              ))}
            </div>
            {stats.recent_analyses.slice(0, 8).map((a) => (
              <div key={a.id} style={{
                display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 60px 80px",
                gap: 10, padding: "9px 10px", borderRadius: 8,
                background: "var(--bg-subtle)", fontSize: 13, alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ProfileAvatar src={a.avatar} name={a.display_name || a.username} size={28} platform={a.platform} />
                  <div>
                    <div style={{ fontWeight: 500, color: "var(--text-1)", fontSize: 12 }}>@{a.username}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 1 }}>
                      <PlatBadge plat={a.platform} />
                    </div>
                  </div>
                </div>
                <div style={{ color: "var(--text-2)", fontSize: 12 }}>{fmt(a.followers)}</div>
                <div style={{ color: "var(--text-2)", fontSize: 12 }}>%{a.engagement_rate.toFixed(1)}</div>
                <div><ScoreBadge v={a.final_score} /></div>
                <div><ScoreBadge v={a.fraud_score} risk /></div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
