/**
 * Digital Twin API client — Part 12
 * Influencer behavioral forecasting endpoints.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    throw new Error("Oturum süresi doldu.");
  }
  if (res.status === 402) {
    throw new Error("Yetersiz kredi.");
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const d = await res.json();
      if (d?.detail) detail = d.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConfidenceLevel = "insufficient" | "low" | "medium" | "high";
export type RiskTrend       = "declining" | "stable" | "increasing";
export type StabilityTrend  = "improving" | "stable" | "declining";
export type CampaignReadiness = "ready" | "conditional" | "caution" | "not_recommended";

export interface TwinForecast {
  id: number;
  horizon_days: 30 | 90 | 180 | 365;

  // Growth
  followers_current: number;
  followers_projected: number;
  followers_projection_pct: number;
  followers_range_low_pct: number;
  followers_range_high_pct: number;

  // Engagement
  engagement_current: number;
  engagement_projected: number;
  engagement_projection_pct: number;
  engagement_decay_risk: boolean;

  // Risk & stability
  risk_trend: RiskTrend;
  stability_trend: StabilityTrend;

  // Campaign
  campaign_readiness: CampaignReadiness;
  campaign_recommendation: string;

  // Evidence
  confidence: ConfidenceLevel;
  limitations: string[];
  evidence: {
    growth?: EvidenceBlock;
    engagement?: EvidenceBlock;
    risk?: EvidenceBlock;
    campaign?: EvidenceBlock;
  };
  raw_signals: {
    trend?: Record<string, unknown>;
    volatility?: Record<string, unknown>;
    risk?: Record<string, unknown>;
  };
}

export interface EvidenceBlock {
  dimension: string;
  projection_pct?: number;
  horizon_days?: number;
  labels: string[];
  basis: string[];
  drivers?: string[];
  overall_trend?: string;
  readiness?: string;
  recommendation?: string;
}

export interface DigitalTwin {
  id: number;
  influencer_profile_id: number;
  generated_at: string;
  forecast_version: string;

  is_forecast_available: boolean;
  unavailability_reason: string | null;

  snapshot_count: number;
  snapshot_days_coverage: number;
  oldest_snapshot_at: string | null;
  newest_snapshot_at: string | null;

  confidence: ConfidenceLevel;
  evidence_strength: "weak" | "moderate" | "strong";
  is_mock: boolean;

  forecasts: TwinForecast[];
}

export interface GenerateTwinResponse {
  success: boolean;
  twin: DigitalTwin | null;
  signals_extracted?: number;
  is_forecast_available?: boolean;
  unavailability_reason?: string | null;
  snapshot_count?: number;
  note: string;
}

export interface TwinListResponse {
  total: number;
  offset: number;
  limit: number;
  twins: DigitalTwin[];
}

export interface HighRiskResponse {
  total: number;
  twins: DigitalTwin[];
}

// ─── Label helpers ────────────────────────────────────────────────────────────

export const CONFIDENCE_LABEL: Record<string, string> = {
  insufficient: "Yetersiz Veri",
  low:          "Düşük",
  medium:       "Orta",
  high:         "Yüksek",
};

export const CONFIDENCE_COLOR: Record<string, string> = {
  insufficient: "var(--text-3)",
  low:          "var(--amber)",
  medium:       "var(--brand-600)",
  high:         "var(--green)",
};

export const RISK_TREND_LABEL: Record<string, string> = {
  declining:  "Azalıyor",
  stable:     "Stabil",
  increasing: "Artıyor",
};

export const RISK_TREND_COLOR: Record<string, string> = {
  declining:  "var(--green)",
  stable:     "var(--text-3)",
  increasing: "var(--red, #ef4444)",
};

export const STABILITY_LABEL: Record<string, string> = {
  improving:  "İyileşiyor",
  stable:     "Stabil",
  declining:  "Düşüyor",
};

export const READINESS_LABEL: Record<string, string> = {
  ready:           "Hazır",
  conditional:     "Koşullu",
  caution:         "Dikkatli",
  not_recommended: "Önerilmez",
};

export const READINESS_COLOR: Record<string, string> = {
  ready:           "var(--green)",
  conditional:     "var(--brand-600)",
  caution:         "var(--amber)",
  not_recommended: "var(--red, #ef4444)",
};

// ─── API functions ────────────────────────────────────────────────────────────

export const digitalTwinApi = {
  generate: (profileId: number) =>
    request<GenerateTwinResponse>(`/digital-twin/generate/${profileId}`, { method: "POST" }),

  get: (profileId: number) =>
    request<DigitalTwin>(`/digital-twin/${profileId}`),

  refresh: (profileId: number) =>
    request<GenerateTwinResponse>(`/digital-twin/refresh/${profileId}`, { method: "POST" }),

  listHighRisk: (limit = 20) =>
    request<HighRiskResponse>(`/digital-twin/high-risk?limit=${limit}`),

  list: (params?: { limit?: number; offset?: number; confidence?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit)  qs.set("limit",  String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    if (params?.confidence) qs.set("confidence", params.confidence);
    return request<TwinListResponse>(`/digital-twin/?${qs.toString()}`);
  },
};
