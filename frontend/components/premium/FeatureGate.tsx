"use client";
import { useEffect, useState, useRef } from "react";
import { entitlementsApi, type EntitlementMap, PLAN_DISPLAY_NAME } from "@/lib/entitlements-api";
import PremiumLockedCard from "./PremiumLockedCard";
import type { FeatureLockedDetail } from "@/lib/api";

interface FeatureGateProps {
  featureKey:     string;
  /** Copy shown in locked card */
  title?:         string;
  message?:       string;
  ctaLabel?:      string;
  /** Optional blur preview content */
  preview?:       React.ReactNode;
  /** Show compact inline lock badge instead of full card */
  compact?:       boolean;
  children:       React.ReactNode;
  /** Override style on locked card wrapper */
  lockedStyle?:   React.CSSProperties;
}

// Module-level entitlement cache to avoid re-fetching on every gate
let _entitlementCache: EntitlementMap | null = null;
let _currentPlanCache: string = "free";
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedEntitlements(): Promise<{ map: EntitlementMap; plan: string }> {
  const now = Date.now();
  if (_entitlementCache && now - _cacheTime < CACHE_TTL) {
    return { map: _entitlementCache, plan: _currentPlanCache };
  }
  const resp = await entitlementsApi.getMyEntitlements();
  _entitlementCache = resp.entitlements;
  _currentPlanCache = resp.plan;
  _cacheTime = now;
  return { map: resp.entitlements, plan: resp.plan };
}

/** Invalidate cache — call after plan upgrade */
export function invalidateEntitlementCache() {
  _entitlementCache = null;
  _cacheTime = 0;
}

type GateState = "loading" | "allowed" | "locked";

export default function FeatureGate({
  featureKey,
  title,
  message,
  ctaLabel,
  preview,
  compact = false,
  children,
  lockedStyle,
}: FeatureGateProps) {
  const [state,        setState]        = useState<GateState>("loading");
  const [currentPlan,  setCurrentPlan]  = useState("free");
  const [requiredPlan, setRequiredPlan] = useState("pro");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    getCachedEntitlements()
      .then(({ map, plan }) => {
        if (!mountedRef.current) return;
        setCurrentPlan(plan);
        if (map[featureKey] === true) {
          setState("allowed");
        } else {
          // Determine required plan from entitlement service copy
          setState("locked");
        }
      })
      .catch(() => {
        if (mountedRef.current) setState("loading");
      });
    return () => { mountedRef.current = false; };
  }, [featureKey]);

  if (state === "loading") {
    return (
      <div style={{
        borderRadius: 14, border: "1px dashed var(--line)",
        height: compact ? 36 : 160,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--brand-500)", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (state === "allowed") return <>{children}</>;

  // Locked state
  const lockTitle   = title   ?? `Bu özellik ${PLAN_DISPLAY_NAME[requiredPlan] ?? requiredPlan} planında mevcut`;
  const lockMessage = message ?? `Bu özelliği kullanmak için planınızı yükseltin.`;

  return (
    <PremiumLockedCard
      featureKey={featureKey}
      title={lockTitle}
      message={lockMessage}
      requiredPlan={requiredPlan}
      currentPlan={currentPlan}
      ctaLabel={ctaLabel}
      compact={compact}
      previewContent={preview}
      style={lockedStyle}
    />
  );
}
