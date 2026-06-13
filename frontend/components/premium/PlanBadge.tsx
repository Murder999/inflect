"use client";
import type { PlanSlug } from "@/lib/entitlements-api";

interface PlanBadgeProps {
  plan: string;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
  free:       { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" },
  starter:    { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  pro:        { bg: "rgba(99,102,241,0.12)",  color: "#6366f1" },
  business:   { bg: "rgba(99,102,241,0.12)",  color: "#6366f1" },
  agency:     { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
  enterprise: { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
};

const PLAN_LABEL: Record<string, string> = {
  free:       "Ücretsiz",
  starter:    "Starter",
  pro:        "Pro",
  business:   "Pro",
  agency:     "Agency",
  enterprise: "Enterprise",
};

export default function PlanBadge({ plan, size = "sm", style }: PlanBadgeProps) {
  const { bg, color } = PLAN_COLOR[plan] ?? PLAN_COLOR.free;
  const label = PLAN_LABEL[plan] ?? plan;
  const fontSize = size === "sm" ? 10 : 12;
  const padding  = size === "sm" ? "2px 7px" : "3px 10px";

  return (
    <span style={{
      fontSize, fontWeight: 700, background: bg, color,
      borderRadius: 99, padding, letterSpacing: "0.04em",
      textTransform: "uppercase", display: "inline-flex",
      alignItems: "center", gap: 3,
      ...style,
    }}>
      {label}
    </span>
  );
}
