"use client";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

/* ─── Hero dashboard mockup ───────────────────────────── */
const HERO_SCORES = [
  { l: "Fraud Risk",       v: 8,  c: "#10B981" },
  { l: "Brand Fit",        v: 87, c: "#3B82F6" },
  { l: "ROI Potential",    v: 91, c: "#8B5CF6" },
  { l: "Momentum",         v: 94, c: "#10B981" },
  { l: "Audience Quality", v: 81, c: "#F59E0B" },
  { l: "Final Score",      v: 89, c: "#10B981" },
];

function HeroDashboard() {
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", inset: "-60px",
        background: "radial-gradient(ellipse at 50% 40%, rgba(16,185,129,0.12) 0%, transparent 65%)",
        filter: "blur(40px)", pointerEvents: "none",
      }} />
      <div style={{
        position: "relative",
        background: "rgba(11,18,32,0.98)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 20, overflow: "hidden",
        boxShadow:
          "0 40px 80px rgba(0,0,0,0.70), " +
          "0 0 0 1px rgba(255,255,255,0.05), " +
          "inset 0 1px 0 rgba(255,255,255,0.07)",
        transform: "perspective(1200px) rotateY(-6deg) rotateX(3deg)",
      }}>
        {/* Window chrome */}
        <div style={{
          background: "rgba(255,255,255,0.028)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "11px 16px", display: "flex", alignItems: "center", gap: 8,
        }}>
          {["#FC5753","#FDBC40","#34C749"].map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
          ))}
          <div style={{
            flex: 1, marginLeft: 8,
            background: "rgba(255,255,255,0.05)", borderRadius: 5,
            padding: "4px 12px", fontSize: 11, color: "rgba(255,255,255,0.30)",
          }}>app.inflect.io/search</div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
            background: "rgba(16,185,129,0.14)", color: "#10B981",
            padding: "3px 9px", borderRadius: 4,
            border: "1px solid rgba(16,185,129,0.22)",
          }}>Analiz Tamamlandı</div>
        </div>

        {/* Profile row */}
        <div style={{
          padding: "16px 20px 14px",
          display: "flex", alignItems: "center", gap: 14,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            background: "linear-gradient(135deg, #3B82F6 0%, #10B981 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0,
          }}>CR</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", letterSpacing: "-0.02em" }}>
                Cristiano Ronaldo
              </span>
              <span style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700,
                background: "rgba(252,165,165,0.12)", color: "#FCA5A5",
                border: "1px solid rgba(252,165,165,0.16)",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>IG</span>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)" }}>
              @cristiano · 648.4M takipçi · %3.21 etkileşim
            </div>
          </div>
          <div style={{
            width: 42, height: 42, borderRadius: "50%",
            border: "2px solid #10B981",
            background: "rgba(16,185,129,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#10B981",
          }}>89</div>
        </div>

        {/* Score grid */}
        <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {HERO_SCORES.map(({ l, v, c }) => (
            <div key={l} style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.055)",
              borderRadius: 10, padding: "10px 12px",
            }}>
              <div style={{
                fontSize: 9, color: "rgba(255,255,255,0.28)",
                marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em",
              }}>{l}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c, letterSpacing: "-0.03em" }}>{v}</div>
              <div style={{ height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 99, marginTop: 7 }}>
                <div style={{ height: "100%", width: `${v}%`, background: c, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Growth chart */}
        <div style={{ padding: "0 20px 18px" }}>
          <div style={{
            background: "rgba(255,255,255,0.015)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 10, padding: "12px 14px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Büyüme Trendi (6 ay)
              </span>
              <span style={{ fontSize: 11, color: "#10B981", fontWeight: 700 }}>↑ +12.4%</span>
            </div>
            <svg width="100%" height="48" viewBox="0 0 280 48" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 44 C40 40 70 33 100 25 C130 17 160 11 200 6 C230 3 260 1 280 0"
                stroke="#10B981" strokeWidth="2" fill="none" />
              <path d="M0 44 C40 40 70 33 100 25 C130 17 160 11 200 6 C230 3 260 1 280 0 L280 48 L0 48Z"
                fill="url(#hg)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Analysis showcase ─────────────────────────────────── */
const SHOWCASE_SCORES = [
  { l: "Audience Auth.",  v: 82, c: "#10B981" },
  { l: "Fraud Risk",      v: 14, c: "#10B981" },
  { l: "Brand Fit",       v: 79, c: "#3B82F6" },
  { l: "Momentum",        v: 87, c: "#8B5CF6" },
  { l: "Eng. Quality",    v: 74, c: "#F59E0B" },
  { l: "ROI Potential",   v: 82, c: "#10B981" },
];

function AnalysisShowcase() {
  return (
    <div style={{
      background: "var(--bg)",
      border: "1px solid var(--line)",
      borderRadius: 20, overflow: "hidden",
    }}>
      <div style={{
        padding: "24px 28px",
        display: "flex", alignItems: "center", gap: 20,
        borderBottom: "1px solid var(--line)",
        flexWrap: "wrap",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 800, color: "#fff", flexShrink: 0,
        }}>KJ</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.03em" }}>Kylie Jenner</span>
            <span style={{
              fontSize: 9, padding: "3px 8px", borderRadius: 4, fontWeight: 700,
              background: "rgba(252,165,165,0.10)", color: "#FCA5A5",
              border: "1px solid rgba(252,165,165,0.16)",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>IG</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-3)" }}>@kyliejenner · 400.6M takipçi · %1.8 etkileşim</div>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          {[["Post Erişim","7.2M"],["Ort. Beğeni","2.4M"],["ROI Tahmini","4.2x"]].map(([l,v]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.03em" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{
          width: 60, height: 60, borderRadius: "50%",
          border: "3px solid #10B981", background: "rgba(16,185,129,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 900, color: "#10B981",
        }}>82</div>
      </div>

      <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {SHOWCASE_SCORES.map(({ l, v, c }) => (
          <div key={l} style={{
            padding: "18px 20px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--line)",
            borderRadius: 14,
          }}>
            <div style={{
              fontSize: 10, color: "var(--text-3)", marginBottom: 8,
              textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
            }}>{l}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: c, letterSpacing: "-0.05em", marginBottom: 10 }}>{v}</div>
            <div style={{ height: 3, background: "var(--bg-subtle)", borderRadius: 99 }}>
              <div style={{ height: "100%", width: `${v}%`, background: c, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Campaign mockup ─────────────────────────────────── */
const CAMPAIGN_INFLUENCERS = [
  { name: "Cristiano R.", plat: "IG", reach: "648M", roi: "4.2x", budget: "$45,000", score: 89, c: "#3B82F6" },
  { name: "Kylie Jenner", plat: "IG", reach: "400M", roi: "3.8x", budget: "$38,000", score: 82, c: "#EC4899" },
  { name: "MrBeast",      plat: "YT", reach: "320M", roi: "5.1x", budget: "$52,000", score: 94, c: "#F59E0B" },
];

function CampaignMockup() {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--line)", borderRadius: 20, overflow: "hidden" }}>
      <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.03em" }}>Q1 2025 Kampanyası</div>
        <div style={{ padding: "5px 12px", borderRadius: 99, background: "rgba(16,185,129,0.10)", color: "#10B981", fontSize: 11, fontWeight: 700, border: "1px solid rgba(16,185,129,0.20)" }}>Aktif</div>
      </div>
      <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Toplam Bütçe</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "var(--text-1)", letterSpacing: "-0.05em" }}>$135,000</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Tahmini ROI</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#10B981", letterSpacing: "-0.05em" }}>4.3x</div>
          </div>
        </div>
        <div style={{ height: 6, background: "var(--bg-subtle)", borderRadius: 99 }}>
          <div style={{ height: "100%", width: "67%", background: "linear-gradient(90deg, #10B981 0%, #3B82F6 100%)", borderRadius: 99 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--text-3)" }}>
          <span>$90,240 harcandı</span>
          <span style={{ color: "var(--text-2)", fontWeight: 700 }}>67%</span>
          <span>$44,760 kaldı</span>
        </div>
      </div>
      <div style={{ padding: "16px 22px 20px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>Influencerlar</div>
        {CAMPAIGN_INFLUENCERS.map(({ name, plat, reach, roi, budget, score, c }) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: `${c}18`, border: `1.5px solid ${c}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: c, flexShrink: 0,
            }}>{name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{name}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>{reach} · {plat}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{budget}</div>
              <div style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>{roi} ROI</div>
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              border: `2px solid ${score >= 85 ? "#10B981" : "#F59E0B"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: score >= 85 ? "#10B981" : "#F59E0B", flexShrink: 0,
            }}>{score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Data ─────────────────────────────────────────────── */
const CAPABILITIES = [
  { icon: "◎", title: "Audience Intelligence",  desc: "Kitle demografisi, coğrafya ve kalite analizi.",          c: "#3B82F6", bg: "rgba(59,130,246,0.08)" },
  { icon: "⚠", title: "Fraud Intelligence",     desc: "Sahte takipçi, bot ve etkileşim fraud tespiti.",          c: "#EF4444", bg: "rgba(239,68,68,0.08)"   },
  { icon: "◈", title: "Brand Match AI",          desc: "Marka değerleri ve içerik uyum skoru.",                   c: "#8B5CF6", bg: "rgba(139,92,246,0.08)"  },
  { icon: "△", title: "ROI Prediction",          desc: "Kampanya yatırım getirisi ve bütçe optimizasyonu.",       c: "#10B981", bg: "rgba(16,185,129,0.08)"  },
  { icon: "⊛", title: "Creator Discovery",       desc: "500M+ profilden kategori ve kriter arama.",              c: "#F59E0B", bg: "rgba(245,158,11,0.08)"  },
  { icon: "⇌", title: "Similar Influencers",     desc: "AI destekli benzer profil ve alternatif öneri.",          c: "#06B6D4", bg: "rgba(6,182,212,0.08)"   },
  { icon: "↑", title: "Growth Intelligence",     desc: "Momentum trendi ve yükselen influencer tespiti.",         c: "#84CC16", bg: "rgba(132,204,22,0.08)"  },
  { icon: "◻", title: "Campaign Planner",        desc: "Çoklu influencer kampanya yönetimi ve takibi.",           c: "#EC4899", bg: "rgba(236,72,153,0.08)"  },
];

const TRUST = [
  { val: "12M+",  lbl: "Analiz Edilen Profil" },
  { val: "300K+", lbl: "Tamamlanan Kampanya"  },
  { val: "98.3%", lbl: "Fraud Tespit Doğruluğu" },
  { val: "4.7x",  lbl: "Ortalama Kampanya ROI"  },
];

const AVATAR_COLORS = ["#10B981","#3B82F6","#8B5CF6","#F59E0B","#EC4899"];

/* ─── Main page ─────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text-1)", minHeight: "100vh" }}>

      {/* ════ HEADER ════ */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--header-border)",
        backdropFilter: "blur(24px) saturate(180%)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", height: 60, display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0 }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #10B981 0%, #3B82F6 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>⬡</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em" }}>Inflect</span>
          </Link>
          <nav style={{ flex: 1, display: "flex", alignItems: "center", gap: 2 }}>
            {[["Özellikler","/#features"],["Fiyatlar","/pricing"],["Blog","/blog"]].map(([l, h]) => (
              <Link key={l} href={h} style={{ padding: "6px 12px", fontSize: 14, fontWeight: 500, color: "var(--text-3)", textDecoration: "none", borderRadius: 7 }}>{l}</Link>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle variant="topbar" />
            <Link href="/login" style={{ padding: "7px 14px", fontSize: 14, fontWeight: 500, color: "var(--text-2)", textDecoration: "none" }}>Giriş</Link>
            <Link href="/register" style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "#10B981", color: "#fff", textDecoration: "none", boxShadow: "0 2px 8px rgba(16,185,129,0.30)" }}>Ücretsiz Başla</Link>
          </div>
        </div>
      </header>

      {/* ════ HERO ════ */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        {/* Grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 0%, black 0%, transparent 100%)",
        }} />
        <div style={{
          position: "absolute", top: "-5%", left: "5%", width: "40%", height: "70%",
          background: "radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none",
        }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 32px 120px", position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>

            {/* Left */}
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 99, marginBottom: 28,
                background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)",
                fontSize: 12, fontWeight: 700, color: "#10B981",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                AI-Powered Intelligence Platform
              </div>

              <h1 style={{
                fontSize: "clamp(48px, 5.5vw, 76px)", fontWeight: 900,
                lineHeight: 1.04, letterSpacing: "-0.05em",
                margin: "0 0 24px", color: "var(--text-1)",
              }}>
                Influencer<br />
                Seçmeyin.<br />
                <span style={{ color: "#10B981" }}>İstihbarat</span><br />
                <span style={{ color: "#10B981" }}>Toplayın.</span>
              </h1>

              <p style={{ fontSize: 18, color: "var(--text-3)", lineHeight: 1.65, margin: "0 0 36px", maxWidth: 420 }}>
                Her influencer için gerçek veri — fraud skoru, marka uyumu, ROI tahmini.
                Instagram, TikTok ve YouTube&apos;da çalışır.
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
                <Link href="/register" style={{ padding: "14px 28px", borderRadius: 12, fontSize: 15, fontWeight: 800, background: "#10B981", color: "#fff", textDecoration: "none", boxShadow: "0 4px 20px rgba(16,185,129,0.35)", letterSpacing: "-0.02em" }}>
                  Ücretsiz Başla →
                </Link>
                <Link href="/login" style={{ padding: "14px 28px", borderRadius: 12, fontSize: 15, fontWeight: 600, background: "rgba(255,255,255,0.04)", color: "var(--text-1)", textDecoration: "none", border: "1px solid var(--line-strong)", letterSpacing: "-0.02em" }}>
                  Demo İzle
                </Link>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--text-3)" }}>
                <div style={{ display: "flex" }}>
                  {AVATAR_COLORS.map((c, i) => (
                    <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: `${c}80`, border: "2px solid var(--bg)", marginLeft: i > 0 ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <span><strong style={{ color: "var(--text-1)", fontWeight: 700 }}>500+</strong> marka ve ajans kullanıyor</span>
              </div>
            </div>

            {/* Right */}
            <HeroDashboard />
          </div>
        </div>
      </section>

      {/* ════ TRUST METRICS ════ */}
      <section style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--bg-elevated)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          {TRUST.map(({ val, lbl }) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(38px, 4vw, 54px)", fontWeight: 900, letterSpacing: "-0.05em", color: "#10B981", lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 14, color: "var(--text-3)", marginTop: 8, fontWeight: 500 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ CAPABILITIES ════ */}
      <section id="features" style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 32px" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 16 }}>Platform Yetenekleri</div>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 50px)", fontWeight: 900, letterSpacing: "-0.05em", margin: "0 0 16px", color: "var(--text-1)", lineHeight: 1.06 }}>
            Her Karar İçin<br />Doğru Veri
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-3)", maxWidth: 520, margin: "0 auto", lineHeight: 1.65 }}>
            Tek platformda influencer araştırma, fraud tespiti, marka uyum analizi ve kampanya planlaması.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {CAPABILITIES.map(({ icon, title, desc, c, bg }) => (
            <div key={title} style={{ padding: "22px", borderRadius: 16, background: "var(--bg-elevated)", border: "1px solid var(--line)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, color: c, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 8px", color: "var(--text-1)", letterSpacing: "-0.03em" }}>{title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════ ANALYSIS SHOWCASE ════ */}
      <section style={{ background: "var(--bg-elevated)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 32px" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#3B82F6", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 16 }}>Gerçek Veri Analizi</div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 50px)", fontWeight: 900, letterSpacing: "-0.05em", margin: "0 0 16px", color: "var(--text-1)", lineHeight: 1.06 }}>
              Tam İstihbarat Raporu
            </h2>
            <p style={{ fontSize: 16, color: "var(--text-3)", maxWidth: 480, margin: "0 auto", lineHeight: 1.65 }}>
              Her analizde fraud, kitle kalitesi, marka uyumu ve ROI tahmini birlikte sunulur.
            </p>
          </div>
          <AnalysisShowcase />
        </div>
      </section>

      {/* ════ CAMPAIGN INTELLIGENCE ════ */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#3B82F6", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 20 }}>Kampanya Zekası</div>
            <h2 style={{ fontSize: "clamp(30px, 3.5vw, 44px)", fontWeight: 900, letterSpacing: "-0.05em", margin: "0 0 18px", color: "var(--text-1)", lineHeight: 1.08 }}>
              Kampanya Planlamada<br />Veri Odaklı Kararlar
            </h2>
            <p style={{ fontSize: 16, color: "var(--text-3)", lineHeight: 1.7, margin: "0 0 32px" }}>
              Birden fazla influencer&apos;ı karşılaştır, bütçe dağılımı yap ve ROI projeksiyonlarını anlık gör.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
              {[
                { icon: "△", label: "Bütçe optimizasyonu ve ROI maksimizasyonu", c: "#3B82F6" },
                { icon: "◎", label: "Kampanya takvimi ve içerik planlama", c: "#8B5CF6" },
                { icon: "↑", label: "Gerçek zamanlı performans takibi", c: "#10B981" },
              ].map(({ icon, label, c }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${c}12`, color: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{icon}</div>
                  <span style={{ fontSize: 14, color: "var(--text-2)", fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
            <Link href="/register" style={{ padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 800, background: "#3B82F6", color: "#fff", textDecoration: "none", display: "inline-block", letterSpacing: "-0.02em" }}>
              Kampanya Oluştur →
            </Link>
          </div>
          <CampaignMockup />
        </div>
      </section>

      {/* ════ FINAL CTA ════ */}
      <section style={{ background: "var(--bg-elevated)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "120px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 20 }}>Hemen Başla</div>
          <h2 style={{ fontSize: "clamp(36px, 5vw, 62px)", fontWeight: 900, letterSpacing: "-0.05em", margin: "0 0 20px", color: "var(--text-1)", lineHeight: 1.04 }}>
            Gerçek Verilerle<br />
            <span style={{ color: "#10B981" }}>Gerçek Kararlar</span> Al.
          </h2>
          <p style={{ fontSize: 17, color: "var(--text-3)", margin: "0 0 40px", lineHeight: 1.65 }}>
            Ücretsiz hesap aç, ilk analizini yap ve platformun farkını gör.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" style={{ padding: "16px 32px", borderRadius: 12, fontSize: 16, fontWeight: 800, background: "#10B981", color: "#fff", textDecoration: "none", boxShadow: "0 4px 24px rgba(16,185,129,0.30)", letterSpacing: "-0.03em" }}>
              Ücretsiz Hesap Aç →
            </Link>
            <Link href="/pricing" style={{ padding: "16px 32px", borderRadius: 12, fontSize: 16, fontWeight: 600, background: "transparent", color: "var(--text-1)", textDecoration: "none", border: "1px solid var(--line-strong)", letterSpacing: "-0.02em" }}>
              Planları Görüntüle
            </Link>
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer style={{ borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <span style={{ width: 22, height: 22, borderRadius: 5, background: "linear-gradient(135deg, #10B981 0%, #3B82F6 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11 }}>⬡</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.03em" }}>Inflect</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {[["Gizlilik","/privacy"],["Kullanım Şartları","/terms"],["Blog","/blog"]].map(([l, h]) => (
              <Link key={l} href={h} style={{ fontSize: 13, color: "var(--text-3)", textDecoration: "none" }}>{l}</Link>
            ))}
            <ThemeToggle variant="topbar" />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>© 2025 Inflect. Tüm hakları saklıdır.</div>
        </div>
      </footer>
    </div>
  );
}
