/**
 * Risk Radar API Client — Part 16
 * Typed client for /risk-radar endpoints.
 * Adds query-based scan (archive-independent) and feature cost lookup.
 */

import { request } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel    = "low" | "medium" | "high" | "critical";
export type Trajectory   = "declining" | "stable" | "rising" | "spike";
export type Confidence   = "low" | "medium" | "high";
export type DimensionName =
  | "fraud_anomaly"
  | "growth_anomaly"
  | "engagement_quality"
  | "brand_alignment"
  | "volatility"
  | "sentiment";

export interface RiskDimension {
  name:       DimensionName;
  label:      string;
  score:      number;
  level:      RiskLevel;
  trend:      Trajectory;
  signals:    string[];
  confidence: Confidence;
}

export interface AnomalyEvent {
  anomaly_type: string;
  description:  string;
  severity:     "low" | "medium" | "high";
  period:       string;
}

export interface RiskReport {
  profile_id:      number;
  username:        string;
  platform:        string;
  category:        string | null;
  window_days:     number;
  generated_at:    string;
  is_mock:         boolean;

  overall_score:   number;
  overall_level:   RiskLevel;
  risk_trajectory: Trajectory;
  confidence:      Confidence;
  snapshot_count:  number;

  dimensions:      Record<DimensionName, RiskDimension>;
  anomaly_events:  AnomalyEvent[];
  evidence_summary:string[];
  limitations:     string[];
  note:            string;
}

export type ReportMode = "limited" | "standard" | "full" | "archive_fallback" | "mock_limited";

export interface ResolvedInfo {
  status:            string;
  username:          string;
  platform:          string;
  display_name:      string;
  profile_image_url: string | null;
  avatar_status:     string;
  followers:         number;
  resolution_source: string;  // archive | provider | mock
}

export interface ScanResponse {
  ok:                true;
  report:            RiskReport & { report_mode?: ReportMode };
  resolved?:         ResolvedInfo;
  report_mode?:      ReportMode;
  warnings?:         string[];
  limitations?:      string[];
  credits_charged?:  number;
  credits_remaining: number;
}

export interface QueryScanFailure {
  ok:           false;
  failure_code: string;
  message:      string;
  next_action?: string;
}

export type QueryScanResult = ScanResponse | QueryScanFailure;

export interface FeatureCostInfo {
  slug:          string;
  name:          string;
  category:      string;
  accessible:    boolean;
  is_billable:   boolean;
  credit_cost:   number;
  is_free:       boolean;
  costs:         { limited: number; standard: number; full: number };
}

export type AlertStatus = "open" | "acknowledged" | "dismissed" | "resolved";
export type AlertSource = "scheduled_scan" | "manual_scan" | "campaign_monitor";

export interface RiskAlert {
  id:              number;
  profile_id:      number;
  alert_type:      string;
  severity:        RiskLevel;
  status:          AlertStatus;
  source:          AlertSource | null;
  platform:        string | null;
  message:         string;
  explanation:     string | null;
  previous_score:  number | null;
  current_score:   number | null;
  delta:           number | null;
  details:         Record<string, unknown> | null;
  evidence:        string[];
  acknowledged_by: number | null;
  acknowledged_at: string | null;
  resolved_at:     string | null;
  created_at:      string;
  updated_at:      string | null;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const riskRadarApi = {
  /**
   * Scan by username / @handle / URL — no archive required.
   * Returns QueryScanResult (ok=true on success, ok=false with failure_code on failure).
   */
  queryScan: (params: {
    query:          string;
    platform?:      string;
    window_days?:   number;
    force_refresh?: boolean;
  }): Promise<QueryScanResult> =>
    request<QueryScanResult>("/risk-radar/scan", {
      method: "POST",
      body: JSON.stringify({
        query:         params.query,
        platform:      params.platform ?? null,
        window_days:   params.window_days ?? 90,
        force_refresh: params.force_refresh ?? false,
      }),
    }),

  /** Generate a risk report for a known archive profile. */
  scan: (
    profile_id: number,
    window_days = 90,
    force = false
  ): Promise<ScanResponse> =>
    request<ScanResponse>(
      `/risk-radar/scan/${profile_id}?window_days=${window_days}&force=${force}`,
      { method: "POST" }
    ),

  /** Get effective feature costs for the current user. */
  getMyFeatureCosts: (): Promise<{
    ok: boolean;
    user_plan: string;
    features: FeatureCostInfo[];
  }> => request("/intelligence/features/me"),

  /** Fetch cached risk report. 0 credits. */
  getReport: (
    profile_id: number,
    window_days = 90
  ): Promise<{ ok: boolean; report: RiskReport }> =>
    request<{ ok: boolean; report: RiskReport }>(
      `/risk-radar/report/${profile_id}?window_days=${window_days}`
    ),

  /** List recent risk alerts. */
  getAlerts: (params?: {
    status?:   AlertStatus;
    severity?: RiskLevel;
    limit?:    number;
  }): Promise<{ ok: boolean; count: number; alerts: RiskAlert[] }> => {
    const q = new URLSearchParams();
    if (params?.status)   q.set("status",   params.status);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.limit)    q.set("limit",    String(params.limit));
    return request<{ ok: boolean; count: number; alerts: RiskAlert[] }>(
      `/risk-radar/alerts?${q}`
    );
  },

  /** Admin: list high-risk profiles. */
  getHighRisk: (
    limit = 20
  ): Promise<{ ok: boolean; count: number; profiles: unknown[] }> =>
    request<{ ok: boolean; count: number; profiles: unknown[] }>(
      `/risk-radar/high-risk?limit=${limit}`
    ),
};

// ── Provider Health ───────────────────────────────────────────────────────────

export interface ProviderHealthResult {
  provider:        string;
  status:          "healthy" | "degraded" | "unavailable" | "not_configured";
  configured:      boolean;
  latency_ms:      number | null;
  error:           string | null;
  last_checked_at: string | null;
  notes:           string[];
}

export const providerHealthApi = {
  getAll: (): Promise<{ ok: boolean; agents_mode: string; providers: ProviderHealthResult[] }> =>
    request("/admin/providers/health"),

  test: (provider: string): Promise<{ ok: boolean } & ProviderHealthResult> =>
    request(`/admin/providers/test/${provider}`, { method: "POST" }),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low:      "Düşük",
  medium:   "Orta",
  high:     "Yüksek",
  critical: "Kritik",
};

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  low:      "#22c55e",
  medium:   "#f59e0b",
  high:     "#ef4444",
  critical: "#7c3aed",
};

export const RISK_LEVEL_BG: Record<RiskLevel, string> = {
  low:      "rgba(34,197,94,0.08)",
  medium:   "rgba(245,158,11,0.08)",
  high:     "rgba(239,68,68,0.08)",
  critical: "rgba(124,58,237,0.08)",
};

export const TRAJECTORY_LABEL: Record<Trajectory, string> = {
  declining: "İyileşiyor",
  stable:    "Stabil",
  rising:    "Kötüleşiyor",
  spike:     "Hızlı Kötüleşme",
};

export const TRAJECTORY_COLOR: Record<Trajectory, string> = {
  declining: "#22c55e",
  stable:    "#94a3b8",
  rising:    "#f59e0b",
  spike:     "#ef4444",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low:    "Düşük Güven",
  medium: "Orta Güven",
  high:   "Yüksek Güven",
};

export const DIMENSION_ORDER: DimensionName[] = [
  "fraud_anomaly",
  "growth_anomaly",
  "brand_alignment",
  "engagement_quality",
  "volatility",
  "sentiment",
];
