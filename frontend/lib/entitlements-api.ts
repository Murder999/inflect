/**
 * Entitlements & Pricing API Client — Part 18
 * Uses the central request<T>() from lib/api.ts.
 */
import { request } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeatureKey =
  | "basic_analysis"
  | "basic_profile_view"
  | "basic_risk_score"
  | "basic_brand_match"
  | "archive_limited"
  | "campaign_roi_simulation"
  | "advanced_risk_radar"
  | "risk_evidence"
  | "pdf_export"
  | "watchlist_alerts"
  | "digital_twin_forecast"
  | "competitor_intelligence"
  | "shareable_report"
  | "batch_analysis"
  | "scheduled_scan"
  | "risk_alert_management"
  | "advanced_filters"
  | "team_workspace"
  | "multi_client_workspace"
  | "white_label_reports"
  | "priority_processing"
  | "api_access"
  | "provider_health"
  | "migration_health"
  | "scan_logs"
  | "admin_intelligence";

export type PlanSlug = "free" | "starter" | "pro" | "business" | "agency" | "enterprise";

export interface EntitlementMap {
  [featureKey: string]: boolean;
}

export interface MyEntitlementsResponse {
  ok:           boolean;
  plan:         PlanSlug;
  is_admin:     boolean;
  entitlements: EntitlementMap;
}

export interface PlanMeta {
  name:            string;
  slug:            PlanSlug;
  price_monthly:   number;    // cents
  price_annual:    number;    // cents (full year)
  price_annual_mo: number;    // cents per month billed annually
  credits:         number;    // -1 = unlimited
  sort_order:      number;
  badge:           string | null;
  tagline:         string;
  cta_label:       string;
  cta_href:        string;
  highlight:       boolean;
  feature_keys:    string[];
}

export interface FeatureDisplayRow {
  key:   string;
  label: string;
}

export interface PricingPlansResponse {
  ok:       boolean;
  plans:    PlanMeta[];
  features: FeatureDisplayRow[];
}

export interface SingleFeatureResponse {
  ok:             boolean;
  allowed:        boolean;
  feature_key?:   string;
  error_code?:    string;
  required_plan?: string;
  current_plan?:  string;
  upgrade_title?:   string;
  upgrade_message?: string;
  cta_label?:       string;
  cta_url?:         string;
}

export interface AdminPlan {
  id:                      number;
  slug:                    string;
  name:                    string;
  price_monthly:           number;
  price_annual:            number;
  credits:                 number;
  is_active:               boolean;
  sort_order:              number;
  features:                Record<string, unknown>;
  feature_keys:            string[];
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual:  string | null;
}

export interface FeatureMatrixRow {
  key:   string;
  label: string;
  plans: Record<string, boolean>;
}

export interface AdminFeatureMatrixResponse {
  ok:     boolean;
  plans:  { slug: string; name: string }[];
  matrix: FeatureMatrixRow[];
}


// ── API client ────────────────────────────────────────────────────────────────

export const entitlementsApi = {
  /** Public — no auth. Returns plan + feature data for pricing page. */
  getPublicPlans: (): Promise<PricingPlansResponse> =>
    request<PricingPlansResponse>("/pricing/plans"),

  /** Authenticated — returns full entitlement map for the current user. */
  getMyEntitlements: (): Promise<MyEntitlementsResponse> =>
    request<MyEntitlementsResponse>("/entitlements/me"),

  /** Check a single feature key for the current user. */
  checkFeature: (featureKey: FeatureKey): Promise<SingleFeatureResponse> =>
    request<SingleFeatureResponse>(`/entitlements/feature/${featureKey}`),

  /** Track a premium conversion event. */
  trackEvent: (eventType: string, featureKey?: string, context?: Record<string, unknown>): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>("/events/premium", {
      method: "POST",
      body: JSON.stringify({ event_type: eventType, feature_key: featureKey, context }),
    }),

  // ── Admin ──────────────────────────────────────────────────────────────────

  /** Admin: get all plan configurations. */
  adminListPlans: (): Promise<{ ok: boolean; plans: AdminPlan[] }> =>
    request<{ ok: boolean; plans: AdminPlan[] }>("/admin/plans"),

  /** Admin: get feature × plan matrix. */
  adminGetFeatureMatrix: (): Promise<AdminFeatureMatrixResponse> =>
    request<AdminFeatureMatrixResponse>("/admin/plans/feature-matrix"),

  /** Admin: update feature_keys for a plan. */
  adminUpdateFeatures: (slug: string, featureKeys: string[]): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>(`/admin/plans/${slug}/features`, {
      method: "PUT",
      body: JSON.stringify({ feature_keys: featureKeys }),
    }),

  /** Admin: update credits / pricing for a plan. */
  adminUpdateLimits: (slug: string, updates: {
    price_monthly?:           number;
    price_annual?:            number;
    credits?:                 number;
    stripe_price_id_monthly?: string;
    stripe_price_id_annual?:  string;
    is_active?:               boolean;
  }): Promise<{ ok: boolean }> =>
    request<{ ok: boolean }>(`/admin/plans/${slug}/limits`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
};


// ── Helper: format price ──────────────────────────────────────────────────────

export function formatPrice(cents: number, short = false): string {
  if (cents <= 0) return short ? "Özel" : "Özel Fiyat";
  const dollars = cents / 100;
  if (dollars % 1 === 0) return `$${dollars}`;
  return `$${dollars.toFixed(0)}`;
}

export const PLAN_ORDER: Record<string, number> = {
  free: 0, starter: 1, pro: 2, business: 2, agency: 3, enterprise: 4,
};

export function canUpgradeTo(currentPlan: string, targetPlan: string): boolean {
  return (PLAN_ORDER[currentPlan] ?? 0) < (PLAN_ORDER[targetPlan] ?? 0);
}

export const PLAN_DISPLAY_NAME: Record<string, string> = {
  free:       "Ücretsiz",
  starter:    "Starter",
  pro:        "Pro",
  business:   "Business",
  agency:     "Agency",
  enterprise: "Enterprise",
};
