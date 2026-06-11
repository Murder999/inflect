/**
 * Competitor Intelligence API — Part 13 (Final Production)
 * Typed client for /competitor-intelligence endpoints.
 */

const API_BASE =
  (typeof window !== "undefined" ? (window as any).__NEXT_PUBLIC_API_URL : undefined) ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api/v1";

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
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      detail = json.detail ?? json.message ?? detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";
export type Tier = "mega" | "macro" | "mid" | "micro" | "nano";
export type Momentum = "increasing" | "stable" | "declining";
export type Aggression = "high" | "medium" | "low";
export type OpportunityType =
  | "tier_gap"
  | "platform_gap"
  | "category_gap"
  | "creator_fatigue"
  | "market_entry";
export type SignalType =
  | "brand_analysis"
  | "category_match"
  | "sponsored_hashtag"
  | "campaign_record";

/** Shape returned by GET /competitor-intelligence/lookup */
export interface CompetitorSuggestion {
  competitor_id: number;
  name: string;
  normalized_name: string;
  aliases: string[];
  industry: string | null;
  country: string;
  has_active_campaigns: boolean;
  last_campaign_at: string | null;
}

export interface CreatorSignal {
  username: string;
  platform: string;
  followers: number;
  category: string;
  tier: Tier;
  signal_type: SignalType;
  signal_strength: number;
  confidence: Confidence;
  evidence: string[];
}

export interface SpendEstimate {
  range_low_tl: number;
  range_high_tl: number;
  confidence: Confidence;
  methodology: string[];
  limitations: string[];
}

export interface CategoryDominance {
  category: string;
  creator_count: number;
  percentage: number;
  rank: number;
}

export interface PlatformBreakdown {
  platform: string;
  creator_count: number;
  percentage: number;
}

export interface TierBreakdown {
  tier: Tier;
  creator_count: number;
  percentage: number;
}

export interface StrategicOpportunity {
  opportunity_type: OpportunityType;
  title: string;
  description: string;
  evidence: string[];
  priority: "high" | "medium" | "low";
  confidence: Confidence;
}

export interface CampaignPattern {
  pattern_type: string;
  description: string;
  count: number;
  confidence: Confidence;
}

export interface CompetitorReport {
  is_mock: boolean;
  competitor_id: number;
  competitor_name: string;
  analysis_window_days: number;
  generated_at: string;

  creator_count: number;
  dominant_platform: string;
  dominant_category: string;
  avg_creator_followers: number;
  estimated_creator_tier: Tier;
  creator_momentum: Momentum;
  campaign_aggression: Aggression;
  confidence: Confidence;

  spend_estimate: SpendEstimate | null;
  category_dominance: CategoryDominance[];
  platform_breakdown: PlatformBreakdown[];
  tier_breakdown: TierBreakdown[];
  opportunities: StrategicOpportunity[];
  campaign_patterns: CampaignPattern[];
  creator_signals: CreatorSignal[];

  evidence_summary: string[];
  limitations: string[];
  note: string;
}

export interface GenerateReportResponse {
  ok: boolean;
  report: CompetitorReport;
  credits_remaining: number;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const competitorIntelApi = {
  /**
   * Autocomplete lookup. Returns array of matching competitors.
   * Never throws — returns [] on any error (safe for autocomplete).
   */
  lookup: async (q: string, limit = 10): Promise<CompetitorSuggestion[]> => {
    try {
      const result = await request<CompetitorSuggestion[]>(
        `/competitor-intelligence/lookup?q=${encodeURIComponent(q)}&limit=${limit}`
      );
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  },

  /** Generate a full competitor intelligence report. Costs 1 credit. */
  generateReport: (
    brand_name: string,
    window_days = 90,
    force = false
  ): Promise<GenerateReportResponse> =>
    request<GenerateReportResponse>("/competitor-intelligence/report", {
      method: "POST",
      body: JSON.stringify({ brand_name, window_days, force }),
    }),

  /** Fetch cached report by competitor ID. 0 credits. */
  getReport: (
    competitor_id: number,
    window_days = 90
  ): Promise<{ ok: boolean; report: CompetitorReport }> =>
    request<{ ok: boolean; report: CompetitorReport }>(
      `/competitor-intelligence/report/${competitor_id}?window_days=${window_days}`
    ),

  /** Get strategic opportunities for a competitor brand. */
  getOpportunities: (
    brand: string,
    window_days = 90
  ): Promise<{ ok: boolean; brand: string; opportunities: StrategicOpportunity[] }> =>
    request<{ ok: boolean; brand: string; opportunities: StrategicOpportunity[] }>(
      `/competitor-intelligence/opportunities?brand=${encodeURIComponent(brand)}&window_days=${window_days}`
    ),
};

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatSpendTL(amount: number): string {
  if (amount >= 1_000_000)
    return `₺${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)
    return `₺${Math.round(amount / 1_000)}K`;
  return `₺${amount.toLocaleString("tr-TR")}`;
}

export function tierLabel(tier: Tier): string {
  return (
    {
      mega:  "Mega (>1M)",
      macro: "Macro (500K–1M)",
      mid:   "Mid-tier (50K–500K)",
      micro: "Micro (10K–50K)",
      nano:  "Nano (<10K)",
    }[tier] ?? tier
  );
}

export function confidenceColor(c: Confidence): string {
  return { high: "#22c55e", medium: "#f59e0b", low: "#94a3b8" }[c] ?? "#94a3b8";
}

export function confidenceLabel(c: Confidence): string {
  return { high: "Yüksek", medium: "Orta", low: "Düşük" }[c] ?? c;
}

export function momentumLabel(m: Momentum): string {
  return { increasing: "Artıyor", stable: "Stabil", declining: "Düşüyor" }[m] ?? m;
}

export function aggressionLabel(a: Aggression): string {
  return { high: "Agresif", medium: "Orta", low: "Temkinli" }[a] ?? a;
}

export function priorityColor(p: "high" | "medium" | "low"): string {
  return { high: "#ef4444", medium: "#f59e0b", low: "#3b82f6" }[p] ?? "#94a3b8";
}

export function industryLabel(industry: string | null): string {
  if (!industry) return "Genel";
  return (
    {
      beauty_health:   "Güzellik & Sağlık",
      beauty:          "Güzellik",
      fashion:         "Moda",
      fashion_sports:  "Moda & Spor",
      food_retail:     "Gıda & Perakende",
      electronics:     "Elektronik",
      technology:      "Teknoloji",
    }[industry] ?? industry
  );
}
