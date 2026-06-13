"use client";
import { useState } from "react";
import { AlertTriangle, X, Zap } from "lucide-react";
import { PLAN_DISPLAY_NAME } from "@/lib/entitlements-api";

interface UsageLimitBannerProps {
  creditsRemaining: number;
  creditsTotal:     number;
  plan:             string;
  /** At what fraction to start showing (e.g. 0.2 = 20% remaining) */
  threshold?:       number;
}

export default function UsageLimitBanner({
  creditsRemaining,
  creditsTotal,
  plan,
  threshold = 0.2,
}: UsageLimitBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (creditsTotal <= 0) return null;

  const pct = creditsRemaining / creditsTotal;
  if (pct > threshold && creditsRemaining > 1) return null;

  const empty    = creditsRemaining === 0;
  const planName = PLAN_DISPLAY_NAME[plan] ?? plan;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 16px", borderRadius: 10, marginBottom: 16,
      background: empty ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
      border: `1px solid ${empty ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)"}`,
    }}>
      <AlertTriangle size={15} style={{ color: empty ? "var(--red)" : "var(--amber)", flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: "var(--text-2)", flex: 1 }}>
        {empty
          ? `Krediniz bitti. Yeni analiz yapabilmek için planınızı yükseltin.`
          : `${creditsRemaining} krediniz kaldı. ${planName} planında ${creditsTotal} krediniz var.`}
      </span>
      <a
        href="/pricing"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          fontSize: 12, fontWeight: 700, color: empty ? "var(--red)" : "#f59e0b",
          textDecoration: "none", flexShrink: 0, padding: "4px 10px",
          borderRadius: 7,
          background: empty ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
        }}
      >
        <Zap size={11} />
        Yükselt
      </a>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2, display: "flex" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
