"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, X as XIcon, Zap, Star, Building2, Rocket, Globe } from "lucide-react";

// ── Plan definitions ──────────────────────────────────────────────────────────

type BillingPeriod = "monthly" | "annual";

interface Plan {
  slug:       string;
  name:       string;
  monthly:    number;   // USD
  annual:     number;   // USD per month billed annually
  credits:    string;
  badge:      string | null;
  tagline:    string;
  cta:        string;
  href:       string;
  highlight:  boolean;
  icon:       React.FC<{ size?: number; color?: string }>;
  features:   string[];
}

const PLANS: Plan[] = [
  {
    slug:      "free",
    name:      "Ücretsiz",
    monthly:   0,
    annual:    0,
    credits:   "5 analiz",
    badge:     null,
    tagline:   "Platformu keşfet",
    cta:       "Ücretsiz Başla",
    href:      "/register",
    highlight: false,
    icon:      Rocket,
    features: [
      "5 influencer analizi/ay",
      "IG + TikTok + YouTube",
      "Temel risk skoru",
      "Temel profil görüntüleme",
      "Temel marka uyumu",
      "Arşiv erişimi",
    ],
  },
  {
    slug:      "starter",
    name:      "Starter",
    monthly:   49,
    annual:    39,
    credits:   "100 analiz/ay",
    badge:     null,
    tagline:   "Küçük işletme başlangıcı",
    cta:       "İlk Analizlerini Aç",
    href:      "/register?plan=starter",
    highlight: false,
    icon:      Star,
    features: [
      "100 analiz/ay",
      "Tüm ücretsiz özellikler",
      "Kampanya ROI Simülasyonu",
      "Fraud risk skorlama",
      "Temel marka uyum raporu",
      "30 gün geçmiş",
    ],
  },
  {
    slug:      "pro",
    name:      "Pro",
    monthly:   149,
    annual:    119,
    credits:   "500 analiz/ay",
    badge:     "En Popüler",
    tagline:   "Büyüyen markalar için",
    cta:       "Tüm İçgörüleri Aç",
    href:      "/register?plan=pro",
    highlight: true,
    icon:      Zap,
    features: [
      "500 analiz/ay",
      "Tüm Starter özellikleri",
      "Gelişmiş Risk Radar™",
      "Risk kanıtları & anomaly detayı",
      "PDF rapor indirme",
      "İzleme listesi uyarıları",
      "AI Brand Match™ detayları",
      "Engagement quality analizi",
      "Öncelikli destek",
    ],
  },
  {
    slug:      "agency",
    name:      "Agency",
    monthly:   399,
    annual:    299,
    credits:   "2000 analiz/ay",
    badge:     "Ajanslar İçin",
    tagline:   "Çoklu müşteri yönetimi",
    cta:       "Ajans Panelini Başlat",
    href:      "/register?plan=agency",
    highlight: false,
    icon:      Building2,
    features: [
      "2000 analiz/ay",
      "Tüm Pro özellikleri",
      "Digital Twin™ Forecast",
      "Competitor Intelligence™",
      "Toplu influencer analizi",
      "Zamanlanmış risk taraması",
      "Risk alert yönetimi",
      "Müşteri rapor bağlantısı",
      "White-label raporlar",
      "Multi-client workspace",
      "Ekip rolleri",
      "Öncelikli işlem",
    ],
  },
  {
    slug:      "enterprise",
    name:      "Enterprise",
    monthly:   0,
    annual:    0,
    credits:   "Sınırsız",
    badge:     "Kurumsal",
    tagline:   "Büyük marka & özel ihtiyaç",
    cta:       "Demo Planla",
    href:      "/contact?plan=enterprise",
    highlight: false,
    icon:      Globe,
    features: [
      "Sınırsız analiz",
      "Tüm Agency özellikleri",
      "API erişimi",
      "Özel entegrasyonlar",
      "Dedicated hesap yöneticisi",
      "Özel AI agent workflows",
      "Custom rapor markalama",
      "SLA & güvenlik garantisi",
      "SSO desteği",
    ],
  },
];

// ── Feature comparison table ──────────────────────────────────────────────────

const COMPARE_ROWS: { label: string; plans: (boolean | string)[] }[] = [
  { label: "Influencer Analizi",          plans: ["5/ay",    "100/ay",   "500/ay",    "2000/ay",   "Sınırsız"] },
  { label: "Platform Desteği",            plans: ["IG+TT+YT","IG+TT+YT","IG+TT+YT", "IG+TT+YT",  "IG+TT+YT"] },
  { label: "Temel Risk Skoru",            plans: [true,       true,       true,        true,        true]  },
  { label: "Kampanya ROI Simülasyonu",    plans: [false,      true,       true,        true,        true]  },
  { label: "Gelişmiş Risk Radar™",        plans: [false,      false,      true,        true,        true]  },
  { label: "Risk Kanıtları",              plans: [false,      false,      true,        true,        true]  },
  { label: "PDF Rapor",                   plans: [false,      false,      true,        true,        true]  },
  { label: "İzleme Uyarıları",           plans: [false,      false,      true,        true,        true]  },
  { label: "Digital Twin™ Forecast",      plans: [false,      false,      false,       true,        true]  },
  { label: "Competitor Intelligence™",    plans: [false,      false,      false,       true,        true]  },
  { label: "Toplu Analiz",               plans: [false,      false,      false,       true,        true]  },
  { label: "Zamanlanmış Tarama",         plans: [false,      false,      false,       true,        true]  },
  { label: "White-label Raporlar",       plans: [false,      false,      false,       true,        true]  },
  { label: "Multi-client Workspace",     plans: [false,      false,      false,       true,        true]  },
  { label: "API Erişimi",                plans: [false,      false,      false,       false,       true]  },
  { label: "SLA & Güvenlik",             plans: [false,      false,      false,       false,       true]  },
];

const FAQ = [
  { q: "14 gün deneme nasıl çalışır?",      a: "Ücretli plana katılırsınız, 14 gün boyunca kart kesimi yapılmaz. İstediğiniz zaman iptal edebilirsiniz." },
  { q: "Kredi sistemi nasıl işler?",         a: "Her influencer analizi 1 kredi harcar. Aylık krediniz bölüm sonunda sıfırlanır. Kalan krediniz bir sonraki aya devretmez." },
  { q: "Yıllık ödeme indirimi var mı?",      a: "Yıllık ödemede ~%20 indirim uygulanır. Fiyat karşılaştırmasında aylık eşdeğer gösterilmektedir." },
  { q: "Planlar arası geçiş yapabilir miyim?", a: "Evet, istediğiniz zaman yükseltebilirsiniz. Düşürme bir sonraki dönem başında geçerli olur." },
  { q: "Enterprise için nasıl başvururum?",   a: "Demo formu doldurun, ekibimiz 24 saat içinde size özel fiyat teklifo sunacaktır." },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [showAll, setShowAll] = useState(false);

  const price = (p: Plan) => {
    if (p.monthly === 0) return "Özel";
    return `$${period === "monthly" ? p.monthly : p.annual}`;
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "ItemList",
          name: "Inflect Pricing Plans",
          itemListElement: PLANS.filter(p => p.monthly > 0).map((p, i) => ({
            "@type": "ListItem", position: i + 1,
            item: {
              "@type": "Product", name: p.name,
              offers: { "@type": "Offer", price: String(p.monthly), priceCurrency: "USD" },
            },
          })),
        })}}
      />

      {/* Nav */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(247,247,249,0.88)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--line)", padding: "0 clamp(16px,5vw,72px)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 60, display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <span style={{
              width: 30, height: 30, background: "linear-gradient(135deg,var(--brand-500),#6366F1)",
              borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 14, fontWeight: 700,
            }}>I</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--text-1)", fontWeight: 600 }}>Inflect</span>
          </Link>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link href="/login"    className="btn btn-ghost btn-sm">Giriş Yap</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Ücretsiz Başla</Link>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "72px clamp(16px,5vw,64px) 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 99, padding: "5px 14px", fontSize: 12, fontWeight: 700,
            color: "#6366F1", marginBottom: 16, letterSpacing: "0.04em",
          }}>
            <Zap size={12} /> Şeffaf Fiyatlandırma
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(32px,5vw,52px)",
            fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-1)",
            margin: "0 0 16px", lineHeight: 1.1,
          }}>
            İhtiyacına Göre Büyü
          </h1>
          <p style={{ fontSize: 18, color: "var(--text-2)", maxWidth: 500, margin: "0 auto 28px" }}>
            14 gün ücretsiz dene. İstediğin zaman iptal et. Kredi kartı zorunlu değil.
          </p>

          {/* Billing toggle */}
          <div style={{
            display: "inline-flex", background: "var(--bg-subtle)", borderRadius: 10,
            padding: 4, border: "1px solid var(--line)",
          }}>
            {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "8px 20px", borderRadius: 7, border: "none",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: period === p ? "var(--bg-elevated)" : "transparent",
                  color: period === p ? "var(--text-1)" : "var(--text-3)",
                  boxShadow: period === p ? "var(--shadow-xs)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {p === "monthly" ? "Aylık" : "Yıllık"}
                {p === "annual" && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, fontWeight: 800, color: "#10b981",
                    background: "rgba(16,185,129,0.1)", borderRadius: 99, padding: "1px 7px",
                  }}>
                    %20 İndirim
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16, marginBottom: 72, alignItems: "start",
        }}>
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.slug}
                style={{
                  background: "var(--bg-elevated)",
                  border: plan.highlight ? "2px solid var(--brand-500)" : "1px solid var(--line)",
                  borderRadius: 16, padding: "24px 22px", position: "relative",
                  boxShadow: plan.highlight
                    ? "0 0 0 4px rgba(99,102,241,0.08), 0 8px 24px rgba(99,102,241,0.12)"
                    : "var(--shadow-xs)",
                  transition: "transform 0.12s, box-shadow 0.12s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                }}
              >
                {plan.badge && (
                  <div style={{
                    position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                    background: plan.highlight
                      ? "linear-gradient(135deg,var(--brand-500),#6366F1)"
                      : "var(--bg-subtle)",
                    color: plan.highlight ? "#fff" : "var(--text-2)",
                    border: plan.highlight ? "none" : "1px solid var(--line)",
                    padding: "4px 14px", borderRadius: 999,
                    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    {plan.badge}
                  </div>
                )}

                {/* Plan header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    background: plan.highlight
                      ? "linear-gradient(135deg,var(--brand-500),#6366F1)"
                      : "var(--bg-subtle)",
                    border: plan.highlight ? "none" : "1px solid var(--line)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={16} color={plan.highlight ? "#fff" : "var(--text-2)"} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{plan.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{plan.tagline}</div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{
                      fontSize: plan.monthly === 0 ? 22 : 36,
                      fontWeight: 700, color: "var(--text-1)", lineHeight: 1,
                      fontFamily: "var(--font-display)",
                    }}>
                      {price(plan)}
                    </span>
                    {plan.monthly > 0 && (
                      <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                        /{period === "annual" ? "ay*" : "ay"}
                      </span>
                    )}
                  </div>
                  {period === "annual" && plan.annual > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
                      Yıllık ${plan.annual * 12} faturalandırılır
                    </div>
                  )}
                  <div style={{
                    marginTop: 8, fontSize: 11, fontWeight: 700, color: "var(--brand-600)",
                    background: "rgba(99,102,241,0.06)", borderRadius: 99,
                    padding: "2px 10px", display: "inline-block",
                  }}>
                    {plan.credits}
                  </div>
                </div>

                {/* Feature list */}
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--text-2)", alignItems: "flex-start" }}>
                      <Check size={13} style={{ color: "var(--green)", flexShrink: 0, marginTop: 1 }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={plan.href}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "11px 16px", borderRadius: 10, textDecoration: "none",
                    fontSize: 13, fontWeight: 700, width: "100%",
                    background: plan.highlight
                      ? "linear-gradient(135deg,var(--brand-500),#6366F1)"
                      : "transparent",
                    color: plan.highlight ? "#fff" : "var(--text-1)",
                    border: plan.highlight ? "none" : "1px solid var(--line)",
                    boxShadow: plan.highlight ? "0 4px 12px rgba(99,102,241,0.3)" : "none",
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <div style={{ marginBottom: 72 }}>
          <h2 style={{
            textAlign: "center", fontFamily: "var(--font-display)",
            fontSize: "clamp(22px,3vw,32px)", fontWeight: 700,
            letterSpacing: "-0.02em", color: "var(--text-1)", margin: "0 0 32px",
          }}>
            Özellik Karşılaştırması
          </h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 12, color: "var(--text-3)", fontWeight: 500, borderBottom: "1px solid var(--line)", width: "32%" }}>
                    Özellik
                  </th>
                  {PLANS.map((p) => (
                    <th key={p.slug} style={{
                      padding: "10px 14px", fontSize: 12, fontWeight: 700,
                      color: p.highlight ? "var(--brand-500)" : "var(--text-2)",
                      borderBottom: "1px solid var(--line)", textAlign: "center",
                      background: p.highlight ? "rgba(99,102,241,0.03)" : "transparent",
                    }}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showAll ? COMPARE_ROWS : COMPARE_ROWS.slice(0, 8)).map((row, i) => (
                  <tr key={row.label} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{
                      padding: "11px 16px", fontSize: 13, color: "var(--text-2)",
                      background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)",
                    }}>
                      {row.label}
                    </td>
                    {row.plans.map((val, pi) => (
                      <td key={pi} style={{
                        padding: "11px 14px", textAlign: "center", fontSize: 13,
                        background: PLANS[pi]?.highlight
                          ? "rgba(99,102,241,0.02)"
                          : (i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)"),
                      }}>
                        {typeof val === "boolean"
                          ? val
                            ? <Check size={15} style={{ color: "var(--green)" }} />
                            : <XIcon size={13} style={{ color: "var(--text-3)" }} />
                          : <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{val}</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!showAll && COMPARE_ROWS.length > 8 && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                onClick={() => setShowAll(true)}
                style={{
                  padding: "9px 20px", borderRadius: 9, border: "1px solid var(--line)",
                  background: "transparent", color: "var(--text-2)", fontSize: 13,
                  cursor: "pointer", fontWeight: 500,
                }}
              >
                Tüm özellikleri göster ({COMPARE_ROWS.length - 8} daha)
              </button>
            </div>
          )}
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 700, margin: "0 auto 72px" }}>
          <h2 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(22px,3vw,32px)", fontWeight: 700,
            textAlign: "center", margin: "0 0 36px", color: "var(--text-1)",
          }}>
            Sık Sorulan Sorular
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ.map((item) => (
              <div key={item.q} style={{
                padding: "18px 20px", borderRadius: 12,
                background: "var(--bg-elevated)", border: "1px solid var(--line)",
              }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", margin: "0 0 6px" }}>{item.q}</h3>
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.65 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise CTA */}
        <div style={{
          textAlign: "center", padding: "48px 32px", borderRadius: 16,
          background: "linear-gradient(135deg,rgba(99,102,241,0.06),rgba(16,185,129,0.04))",
          border: "1px solid var(--line)",
        }}>
          <Globe size={32} style={{ color: "var(--brand-500)", marginBottom: 12 }} />
          <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-1)", margin: "0 0 8px" }}>
            Enterprise'a mı ihtiyacın var?
          </h3>
          <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 24px", maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            Özel kota, API erişimi, SLA ve dedicated destek. İhtiyaçlarınızı anlayalım.
          </p>
          <Link href="/contact?plan=enterprise" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "12px 28px", borderRadius: 10, textDecoration: "none",
            background: "var(--text-1)", color: "var(--bg)",
            fontSize: 14, fontWeight: 700,
          }}>
            Demo Planla
          </Link>
        </div>
      </div>
    </div>
  );
}
