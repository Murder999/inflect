"use client";
import { useEffect, useCallback } from "react";
import { X, Zap, Check, ArrowRight } from "lucide-react";
import type { FeatureLockedDetail } from "@/lib/api";
import { entitlementsApi, formatPrice, PLAN_ORDER, PLAN_DISPLAY_NAME } from "@/lib/entitlements-api";

interface UpgradeModalProps {
  lockedDetail: FeatureLockedDetail;
  onClose: () => void;
}

const PLAN_FEATURES_SUMMARY: Record<string, string[]> = {
  starter:    ["100 analiz/ay", "Kampanya ROI Simülasyonu", "Temel risk analizi"],
  pro:        ["500 analiz/ay", "Gelişmiş Risk Radar™", "Risk kanıtları & anomaly", "PDF rapor", "İzleme uyarıları"],
  agency:     ["2000 analiz/ay", "Digital Twin™ Forecast", "Competitor Intelligence™", "Toplu analiz", "Zamanlanmış tarama", "White-label raporlar"],
  enterprise: ["Sınırsız analiz", "API erişimi", "Özel entegrasyonlar", "SLA & destek", "Kurumsal güvenlik"],
};

const PLAN_PRICES: Record<string, { monthly: number; annualMo: number }> = {
  starter:    { monthly: 49,  annualMo: 39  },
  pro:        { monthly: 149, annualMo: 119 },
  agency:     { monthly: 399, annualMo: 299 },
  enterprise: { monthly: 0,   annualMo: 0   },
};

export default function UpgradeModal({ lockedDetail, onClose }: UpgradeModalProps) {
  const { required_plan, current_plan, upgrade_title, upgrade_message, cta_label } = lockedDetail;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose]);

  const handleCTAClick = () => {
    entitlementsApi.trackEvent("upgrade_cta_clicked", lockedDetail.feature_key, {
      required_plan, current_plan,
    }).catch(() => {});
    window.location.href = `/pricing?highlight=${required_plan}`;
  };

  const features = PLAN_FEATURES_SUMMARY[required_plan] ?? [];
  const price = PLAN_PRICES[required_plan];
  const planName = PLAN_DISPLAY_NAME[required_plan] ?? required_plan;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 16,
        border: "1px solid var(--line)", width: "min(480px, 94vw)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.25)", overflow: "hidden",
        animation: "fadeInUp 0.18s ease",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg,var(--brand-500),#6366F1)",
          padding: "24px 24px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)",
                letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
              }}>
                {planName} Paketi Gerekli
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.3 }}>
                {upgrade_title}
              </h2>
            </div>
            <button
              onClick={handleClose}
              style={{
                background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer",
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                color: "#fff",
              }}
            >
              <X size={15} />
            </button>
          </div>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "10px 0 0", lineHeight: 1.6 }}>
            {upgrade_message}
          </p>
        </div>

        {/* Plan details */}
        <div style={{ padding: "20px 24px" }}>
          {price && (price.monthly > 0) && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
              padding: "12px 16px", borderRadius: 10, background: "var(--bg-subtle)",
              border: "1px solid var(--line)",
            }}>
              <Zap size={16} style={{ color: "var(--brand-500)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                  {planName} — <span style={{ color: "var(--brand-500)" }}>${price.monthly}/ay</span>
                  {price.annualMo > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>
                      (yıllık: ${price.annualMo}/ay)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>14 gün ücretsiz deneme</div>
              </div>
            </div>
          )}

          {features.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                {planName} planında dahil:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Check size={13} style={{ color: "var(--green)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "var(--text-2)" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleCTAClick}
              style={{
                flex: 1, padding: "11px 20px", borderRadius: 10,
                background: "linear-gradient(135deg,var(--brand-500),#6366F1)",
                color: "#fff", fontWeight: 700, fontSize: 14, border: "none",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 7, boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
              }}
            >
              {cta_label || "Paketi Yükselt"}
              <ArrowRight size={15} />
            </button>
            <button
              onClick={handleClose}
              style={{
                padding: "11px 16px", borderRadius: 10, border: "1px solid var(--line)",
                background: "transparent", color: "var(--text-3)", fontSize: 13,
                cursor: "pointer", fontWeight: 500,
              }}
            >
              Belki sonra
            </button>
          </div>

          <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginTop: 12 }}>
            Tüm planları karşılaştırmak için{" "}
            <a href="/pricing" style={{ color: "var(--brand-500)", textDecoration: "none" }}>
              fiyatlandırma sayfasını
            </a>{" "}
            ziyaret edin.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
