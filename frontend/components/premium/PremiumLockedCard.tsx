"use client";
import { useState } from "react";
import { Lock, Zap, ArrowRight } from "lucide-react";
import type { FeatureLockedDetail } from "@/lib/api";
import { entitlementsApi, PLAN_DISPLAY_NAME } from "@/lib/entitlements-api";
import UpgradeModal from "./UpgradeModal";

export interface PremiumLockedCardProps {
  featureKey:     string;
  title:          string;
  message:        string;
  requiredPlan:   string;
  currentPlan?:   string;
  ctaLabel?:      string;
  /** Compact mode — no background, inline badge style */
  compact?:       boolean;
  /** Preview content rendered behind the blur */
  previewContent?: React.ReactNode;
  className?:      string;
  style?:          React.CSSProperties;
}

export default function PremiumLockedCard({
  featureKey,
  title,
  message,
  requiredPlan,
  currentPlan = "free",
  ctaLabel,
  compact = false,
  previewContent,
  style,
}: PremiumLockedCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const lockedDetail: FeatureLockedDetail = {
    error_code:       "FEATURE_LOCKED",
    feature_key:      featureKey,
    required_plan:    requiredPlan,
    current_plan:     currentPlan,
    upgrade_title:    title,
    upgrade_message:  message,
    preview_available: true,
    cta_label:        ctaLabel ?? "Paketi Yükselt",
    cta_url:          "/pricing",
  };

  const handleOpen = () => {
    setModalOpen(true);
    entitlementsApi.trackEvent("upgrade_modal_opened", featureKey, { current_plan: currentPlan }).catch(() => {});
  };

  const planName = PLAN_DISPLAY_NAME[requiredPlan] ?? requiredPlan;

  if (compact) {
    return (
      <>
        <button
          onClick={handleOpen}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 7,
            background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.25)",
            color: "#6366F1", fontSize: 12, fontWeight: 600,
            cursor: "pointer", textDecoration: "none",
            ...style,
          }}
        >
          <Lock size={11} />
          {planName}
        </button>
        {modalOpen && <UpgradeModal lockedDetail={lockedDetail} onClose={() => setModalOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <div
        style={{
          position: "relative", borderRadius: 14, overflow: "hidden",
          border: "1px solid var(--line)", minHeight: previewContent ? undefined : 200,
          ...style,
        }}
        onMouseEnter={() => {
          entitlementsApi.trackEvent("premium_locked_card_viewed", featureKey).catch(() => {});
        }}
      >
        {/* Preview content behind blur */}
        {previewContent && (
          <div style={{
            filter: "blur(5px)", pointerEvents: "none", userSelect: "none",
            opacity: 0.4, padding: 20,
          }}>
            {previewContent}
          </div>
        )}

        {/* Glass overlay */}
        <div style={{
          position: previewContent ? "absolute" : "relative",
          inset: previewContent ? 0 : undefined,
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", textAlign: "center",
          padding: "32px 28px",
          background: previewContent
            ? "rgba(var(--bg-rgb,247,247,249),0.82)"
            : "var(--bg-subtle)",
          backdropFilter: previewContent ? "blur(10px)" : undefined,
        }}>
          {/* Lock icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 14, marginBottom: 16,
            background: "linear-gradient(135deg,var(--brand-500),#6366F1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 20px rgba(99,102,241,0.3)",
          }}>
            <Lock size={22} color="#fff" />
          </div>

          {/* Plan badge */}
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "#6366F1", background: "rgba(99,102,241,0.1)", borderRadius: 99,
            padding: "2px 10px", marginBottom: 10,
          }}>
            {planName} paketi gerekli
          </div>

          <h3 style={{
            fontSize: 16, fontWeight: 700, color: "var(--text-1)",
            margin: "0 0 8px", lineHeight: 1.3,
          }}>
            {title}
          </h3>

          <p style={{
            fontSize: 13, color: "var(--text-3)", margin: "0 0 20px",
            lineHeight: 1.6, maxWidth: 320,
          }}>
            {message}
          </p>

          <button
            onClick={handleOpen}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 20px", borderRadius: 10,
              background: "linear-gradient(135deg,var(--brand-500),#6366F1)",
              color: "#fff", fontWeight: 700, fontSize: 13, border: "none",
              cursor: "pointer", boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 18px rgba(99,102,241,0.4)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(99,102,241,0.3)";
            }}
          >
            <Zap size={14} />
            {ctaLabel ?? `${planName}'e Geç`}
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {modalOpen && (
        <UpgradeModal lockedDetail={lockedDetail} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
