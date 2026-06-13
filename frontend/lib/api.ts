// ── Feature locked error ──────────────────────────────────────────────────────

export interface FeatureLockedDetail {
  error_code:       "FEATURE_LOCKED";
  feature_key:      string;
  required_plan:    string;
  current_plan:     string;
  upgrade_title:    string;
  upgrade_message:  string;
  preview_available: boolean;
  cta_label:        string;
  cta_url:          string;
}

export class FeatureLockedError extends Error {
  readonly lockedDetail: FeatureLockedDetail;
  constructor(detail: FeatureLockedDetail) {
    super(detail.upgrade_message || "Bu özellik mevcut planınızda kullanılamaz.");
    this.name = "FeatureLockedError";
    this.lockedDetail = detail;
  }
}

export function isFeatureLockedError(e: unknown): e is FeatureLockedError {
  return e instanceof FeatureLockedError;
}

// ─────────────────────────────────────────────────────────────────────────────

const API_BASE =
  (typeof window !== "undefined"
    ? (window as any).__NEXT_PUBLIC_API_URL
    : undefined) ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

/**
 * Temel HTTP istek fonksiyonu.
 *
 * Hata sınıflandırması:
 *   - TypeError (network unreachable) → kullanıcı dostu mesaj
 *   - 401 → logout + yönlendirme
 *   - 4xx/5xx → server'dan gelen detail mesajı
 */
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // ─── Network hatalarını yakala ───────────────────────────────────────────
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    // fetch() kendisi throw eder → sunucuya ulaşılamadı
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    throw new Error(
      isOffline
        ? "İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin."
        : `Sunucuya bağlanılamadı. Backend'in çalışır durumda olduğundan ve ` +
          `${API_BASE} adresinin doğru olduğundan emin olun.`
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  if (res.status === 401) {
    const onAuthPage =
      typeof window !== "undefined" &&
      (window.location.pathname === "/login" ||
        window.location.pathname === "/register");
    if (!onAuthPage && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      window.location.href = "/login";
      throw new Error("Oturum süresi doldu. Lütfen tekrar giriş yapın.");
    }
    // Auth sayfasındayken gerçek hata mesajını döndür (örn. yanlış şifre)
    let detail = "E-posta veya şifre hatalı.";
    try {
      const errData = await res.json();
      if (typeof errData?.detail === "string") detail = errData.detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  if (res.status === 402) {
    throw new Error("Yetersiz kredi. Plan yükseltmek için Ayarlar > Fatura sayfasını ziyaret edin.");
  }

  if (res.status === 403) {
    let detail403: any;
    try { detail403 = await res.json(); } catch { /* ignore */ }
    if (detail403?.detail?.error_code === "FEATURE_LOCKED") {
      const e = new FeatureLockedError(detail403.detail);
      throw e;
    }
    throw new Error(
      typeof detail403?.detail === "string"
        ? detail403.detail
        : "Bu işlem için yetkiniz yok."
    );
  }

  if (res.status === 404) {
    let msg = "İstenen kaynak bulunamadı.";
    try {
      const data = await res.json();
      if (data?.detail) msg = data.detail;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  // JSON parse + hata mesajı çıkarma
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      res.ok
        ? "Sunucu yanıtı işlenemedi."
        : `Sunucu hatası: HTTP ${res.status}`
    );
  }

  if (!res.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : Array.isArray(data?.detail)
        ? data.detail.map((d: any) => d?.msg || String(d)).join(", ")
        : `Hata oluştu (HTTP ${res.status})`;
    throw new Error(detail);
  }

  return data as T;
}

/** Backend sağlık kontrolü — bağlantı test etmek için kullanılır */
export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE.replace("/api/v1", "")}/api/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { API_BASE };

// ─── Auth ───
export const authApi = {
  register: (body: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    company: string;
  }) =>
    request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => request<User>("/auth/me"),
  updateProfile: (body: {
    full_name?: string;
    company?: string;
    phone?: string;
    website?: string;
  }) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (body: {
    current_password: string;
    new_password: string;
  }) =>
    request<{ success: boolean; message: string }>("/auth/password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getApiKeys: () =>
    request<{ keys: Record<string, string> }>("/auth/api-keys"),
  updateApiKeys: (body: {
    youtube_api_key?: string;
    apify_token?: string;
    openai_api_key?: string;
  }) =>
    request<{ success: boolean; keys: Record<string, string> }>(
      "/auth/api-keys",
      { method: "PATCH", body: JSON.stringify(body) }
    ),
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
  },
};

// ─── Analyze ───
export const analyzeApi = {
  analyze: (body: { username: string; platform: string; brand?: string }) =>
    request<AnalyzeResult>("/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  history: (limit = 20, offset = 0) =>
    request<{ items: AnalysisSummary[]; total: number }>(
      `/analyze/history?limit=${limit}&offset=${offset}`
    ),
  get: (id: number) => request<AnalyzeResult>(`/analyze/${id}`),
};

// ─── Dashboard ───
export const dashboardApi = {
  stats: () => request<DashboardStats>("/dashboard/stats"),
  leaderboards: () => request<Leaderboards>("/dashboard/leaderboards"),
};

// ─── Discovery ───
export const discoverApi = {
  sections: () => request<DiscoverySections>("/discover/sections"),
  feed: (params: DiscoveryFilters) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    });
    return request<DiscoveryFeed>(`/discover/feed?${q.toString()}`);
  },
  similar: (analysisId: number) =>
    request<{ items: DiscoveryCard[]; total: number }>(
      `/discover/similar/${analysisId}`
    ),
};

// ─── Watchlist ───
export const watchlistApi = {
  list: () =>
    request<{ items: WatchlistItem[]; total: number }>("/watchlist"),
  add: (analysisId: number, notes?: string) =>
    request<{ success: boolean; item: WatchlistItem }>("/watchlist", {
      method: "POST",
      body: JSON.stringify({ analysis_id: analysisId, notes }),
    }),
  remove: (itemId: number) =>
    request<{ success: boolean }>(`/watchlist/${itemId}`, {
      method: "DELETE",
    }),
  check: (username: string, platform: string) =>
    request<{ in_watchlist: boolean; item_id: number | null }>(
      `/watchlist/check/${username}/${platform}`
    ),
};

// ─── Campaigns ───
export const campaignsApi = {
  list: (status?: string) =>
    request<{ items: Campaign[]; total: number }>(
      `/campaigns${status ? `?status=${status}` : ""}`
    ),
  get: (id: number) => request<Campaign>(`/campaigns/${id}`),
  create: (body: CampaignCreateBody) =>
    request<{ success: boolean; campaign: Campaign }>("/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    id: number,
    body: Partial<CampaignCreateBody & { status: string; analysis_ids: number[] }>
  ) =>
    request<{ success: boolean; campaign: Campaign }>(`/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/campaigns/${id}`, { method: "DELETE" }),
  addInfluencer: (campaignId: number, analysisId: number) =>
    request<{ success: boolean; campaign: Campaign }>(
      `/campaigns/${campaignId}/add-influencer?analysis_id=${analysisId}`,
      { method: "POST" }
    ),
  discover: (body: CampaignDiscoverRequest) =>
    request<CampaignDiscoveryResponse>("/campaigns/discover", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ─── Alerts ───
export const alertsApi = {
  list: () => request<AlertsResponse>("/alerts"),
};

// ─── Billing ───
export const billingApi = {
  checkout: (plan: string, period: "monthly" | "annual" = "monthly") =>
    request<{
      url: string;
      session_id?: string;
      mode: string;
      message?: string;
    }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan, period }),
    }),
  invoices: () =>
    request<{
      invoices: Invoice[];
      total: number;
      stripe_configured: boolean;
    }>("/billing/invoices"),
  subscription: () => request<SubscriptionStatus>("/billing/subscription"),
};

// ─── Support ───
export const supportApi = {
  tickets: () =>
    request<{ tickets: SupportTicket[]; total: number }>("/support/tickets"),
  create: (body: {
    subject: string;
    message: string;
    category?: string;
    priority?: string;
  }) =>
    request<{ success: boolean; ticket_id: number; message: string }>(
      "/support/tickets",
      { method: "POST", body: JSON.stringify(body) }
    ),
  reply: (ticketId: number, message: string) =>
    request<{ success: boolean }>(
      `/support/tickets/${ticketId}/reply?message=${encodeURIComponent(message)}`,
      { method: "POST" }
    ),
};

// ─── Admin ───
export const adminApi = {
  stats: () => request<AdminStats>("/admin/stats"),
  users: (limit = 50, offset = 0) =>
    request<{ users: AdminUser[]; total: number }>(
      `/admin/users?limit=${limit}&offset=${offset}`
    ),
  updateCredits: (
    userId: number,
    credits: number,
    action: "add" | "subtract" | "set" = "add"
  ) =>
    request<{ success: boolean; credits_remaining: number; credits_total: number }>(
      `/admin/users/${userId}/credits`,
      { method: "POST", body: JSON.stringify({ credits, action }) }
    ),
  updatePlan: (userId: number, plan: string, credits_total?: number) =>
    request<any>(`/admin/users/${userId}/plan`, {
      method: "POST",
      body: JSON.stringify({ plan, credits_total }),
    }),
  toggleUser: (userId: number) =>
    request<{ success: boolean; is_active: boolean }>(
      `/admin/users/${userId}/toggle`,
      { method: "POST" }
    ),
  deleteUser: (userId: number) =>
    request<{ success: boolean }>(`/admin/users/${userId}`, {
      method: "DELETE",
    }),
  customerIntelligence: () =>
    request<{ users: CustomerIntelligence[]; total: number }>(
      "/admin/customer-intelligence"
    ),
  churnRisks: () =>
    request<{ at_risk: ChurnRisk[]; total: number }>("/admin/churn-risks"),
  costCenter: () => request<CostCenter>("/admin/cost-center"),
  healthCheck: () => request<HealthCheck>("/admin/health-check"),
  queueMonitor: () => request<QueueMonitor>("/admin/queue-monitor"),
  abuseDetection: () =>
    request<{
      alerts: AbuseAlert[];
      total: number;
      scanned_period_hours: number;
    }>("/admin/abuse-detection"),
  tickets: (status?: string) =>
    request<{ tickets: AdminTicket[]; total: number }>(
      `/admin/tickets${status ? `?status=${status}` : ""}`
    ),
  updateTicket: (id: number, status: string) =>
    request<{ success: boolean }>(
      `/admin/tickets/${id}?status=${status}`,
      { method: "PATCH" }
    ),
  replyTicket: (id: number, message: string) =>
    request<{ success: boolean }>(
      `/admin/tickets/${id}/reply?message=${encodeURIComponent(message)}`,
      { method: "POST" }
    ),
  auditLogs: (limit = 50, offset = 0) =>
    request<{ logs: AuditLog[]; total: number }>(
      `/admin/audit-logs?limit=${limit}&offset=${offset}`
    ),
  packages: () => request<{ packages: Package[] }>("/admin/packages"),
  createPackage: (body: any) =>
    request<{ success: boolean; package: Package }>("/admin/packages", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePackage: (id: number, body: any) =>
    request<{ success: boolean; package: Package }>(
      `/admin/packages/${id}`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),
};

// ─── Archive ───
export const archiveApi = {
  list: (params?: {
    platform?: string;
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.platform) q.set("platform", params.platform);
    if (params?.category) q.set("category", params.category);
    if (params?.search)   q.set("search",   params.search);
    if (params?.limit !== undefined)  q.set("limit",  String(params.limit));
    if (params?.offset !== undefined) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<{ items: ArchiveProfile[]; total: number; limit: number; offset: number }>(
      `/archive${qs ? `?${qs}` : ""}`
    );
  },
  get: (id: number) => request<ArchiveProfile>(`/archive/${id}`),
  seed: () =>
    request<{
      success: boolean;
      scanned_analyses: number;
      created_profiles: number;
      created_snapshots: number;
      skipped_snapshots: number;
      note: string;
    }>("/archive/seed", { method: "POST" }),
  /** Tek profil sync: provider'dan metrik günceller, skor değişmez */
  sync: (id: number) =>
    request<{ success: boolean; profile_id: number; followers?: number; error?: string }>(
      `/archive/sync/${id}`, { method: "POST" }
    ),
  /** Toplu sync: pending/needs_sync profilleri işler */
  syncAll: (limit = 5) =>
    request<{ processed: number; success: number; failed: number; results: any[] }>(
      `/archive/sync?limit=${limit}`, { method: "POST" }
    ),
  /** Tek profil tam analiz: provider + score_engine */
  analyze: (id: number, brand = "Genel Marka") =>
    request<{ success: boolean; profile_id: number; final_score?: number; decision?: string; error?: string }>(
      `/archive/analyze/${id}?brand=${encodeURIComponent(brand)}`, { method: "POST" }
    ),

  /** Avatar eksik profillere provider'dan gerçek URL çeker */
  resolveAvatars: (limit = 50) =>
    request<{
      processed: number;
      resolved:  number;
      failed:    number;
      errors:    { profile_id: number; username: string; platform: string; error: string }[];
      note?:     string;
    }>(`/archive/resolve-avatars?limit=${limit}`, { method: "POST" }),

  /** JSON dosyasından toplu influencer import (multipart/form-data) */
  importJson: async (file: File) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/archive/import-json`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
    } catch {
      throw new Error("Sunucuya bağlanılamadı.");
    }
    let data: any;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) {
      throw new Error(typeof data?.detail === "string" ? data.detail : `HTTP ${res.status}`);
    }
    return data as {
      success: boolean;
      filename: string;
      total: number;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
    };
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  website: string | null;
  avatar_url: string | null;
  plan: string;
  credits_remaining: number;
  credits_total: number;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string | null;
}

export interface DiscoveryCard {
  id: number;
  username: string;
  display_name: string;
  platform: string;
  platform_label: string;
  avatar: string;
  category: string;
  country: string;
  bio: string;
  followers: number;
  engagement_rate: number;
  avg_views: number;
  final_score: number;
  fraud_score: number;
  fraud_risk: string;
  brand_fit_score: number;
  roi_potential_score: number;
  momentum_score: number;
  engagement_quality_score: number;
  reputation_risk_score: number;
  decision: string;
  created_at: string;
  similarity?: number;
  similarity_reason?: string;
  source?: string;
}

export interface DiscoverySections {
  has_data: boolean;
  total_analyses: number;
  note: string;
  rising: DiscoveryCard[];
  brand_fit: DiscoveryCard[];
  roi: DiscoveryCard[];
  micro: DiscoveryCard[];
  macro: DiscoveryCard[];
  lowest_risk: DiscoveryCard[];
}

export interface DiscoveryFilters {
  platform?: string;
  category?: string;
  country?: string;
  min_followers?: number;
  max_followers?: number;
  min_engagement?: number;
  max_fraud?: number;
  min_brand_fit?: number;
  min_momentum?: number;
  min_roi?: number;
  search?: string;
  limit?: number;
}

export interface DiscoveryFeed {
  items: DiscoveryCard[];
  total: number;
  has_data: boolean;
  note: string;
}

export interface WatchlistItem {
  id: number;
  analysis_id: number | null;
  username: string;
  platform: string;
  display_name: string | null;
  avatar: string | null;
  category: string | null;
  followers: number;
  final_score: number;
  fraud_score: number;
  brand_fit_score: number;
  notes: string | null;
  added_at: string;
}

export type CampaignReportSource =
  | "server_provider_discovery"
  | "client_simulation_preview"
  | "insufficient_data";

export type CampaignRedactionLevel = "none" | "pro" | "basic" | "full";

export interface LockedSection {
  key:           string;
  title:         string;
  required_plan: string;
  message:       string;
}

export interface Campaign {
  id: number;
  name: string;
  brand: string | null;
  platform: string | null;
  status: string;
  budget: number | null;
  category: string | null;
  target_country: string | null;
  target_audience: string | null;
  goal: string | null;
  notes: string | null;
  analysis_ids: number[];
  recommended_influencers: RecommendedInfluencer[];
  roi_estimates: CampaignROI;
  simulation_result: Record<string, unknown> | null;
  total_reach: number;
  estimated_budget: number;
  // Part 20 — report metadata
  report_source:       CampaignReportSource | null;
  data_confidence:     "low" | "medium" | "high" | null;
  provider_status:     "available" | "unavailable" | "partial" | null;
  discovery_sources:   string[] | null;
  report_generated_at: string | null;
  redaction_level:     CampaignRedactionLevel | null;
  locked_sections:     LockedSection[];
  created_at: string;
  updated_at: string;
}

export interface CampaignCreateBody {
  name: string;
  brand?: string;
  platform?: string;
  budget?: number;
  category?: string;
  target_country?: string;
  target_audience?: string;
  goal?: string;
  notes?: string;
  simulation_result?: Record<string, unknown> | null;
  // Part 20 — report metadata
  report_source?:     CampaignReportSource;
  data_confidence?:   "low" | "medium" | "high";
  provider_status?:   "available" | "unavailable" | "partial";
  discovery_sources?: string[];
}

export interface CampaignDiscoverRequest {
  name:           string;
  brand?:         string;
  platform?:      string;
  budget?:        number;
  category?:      string;
  target_country?: string;
  goal?:          string;
  notes?:         string;
}

export interface DiscoveredCreator {
  username:             string;
  platform:             string;
  followers:            number;
  engagement_rate:      number;
  final_score:          number | null;
  quality_score:        number | null;
  completeness_pct:     number;
  completeness_level:   "normal" | "low_confidence" | "excluded";
  missing_fields:       string[];
  allocated_budget:     number;
  budget_pct:           number;
  budget_cap_applied:   boolean;
  country:              string;
  category:             string;
}

export interface CampaignDiscoveryResponse {
  status:           "ok" | "insufficient_verified_data" | "provider_unavailable";
  report_source:    CampaignReportSource;
  data_confidence:  "low" | "medium" | "high" | null;
  provider_status:  "available" | "unavailable" | "partial";
  total_candidates: number;
  excluded_count:   number;
  selected_count:   number;
  creators:         DiscoveredCreator[];
  budget_allocated: number;
  discovery_sources: string[];
  generated_at:     string;
  campaign_id?:     number;
}

export interface RecommendedInfluencer {
  analysis_id: number;
  username: string;
  display_name: string;
  platform: string;
  avatar: string;
  followers: number;
  engagement_rate: number;
  final_score: number;
  fraud_score: number;
  brand_fit_score: number;
  roi_potential_score: number;
}

export interface CampaignROI {
  influencer_count: number;
  total_followers: number;
  total_reach: number;
  total_impressions: number;
  total_clicks: number;
  avg_fraud_score: number;
  avg_roi_potential: number;
  avg_brand_fit: number;
  suggested_budget: number;
  budget_per_influencer: number;
  currency: string;
  note: string;
}

export interface Alert {
  type: "critical" | "danger" | "warning" | "info";
  title: string;
  message: string;
  action: string;
  action_label: string;
  username?: string;
  platform?: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  has_critical: boolean;
  has_warning: boolean;
}

export interface Invoice {
  id: number;
  amount_usd: number;
  currency: string;
  status: string;
  plan: string | null;
  period: string | null;
  stripe_invoice_id: string | null;
  created_at: string;
}

export interface SubscriptionStatus {
  plan: string;
  credits_remaining: number;
  credits_total: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_configured: boolean;
}

export interface SupportTicket {
  id: number;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  messages: SupportMessage[];
  messages_count: number;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  sender: string;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  new_users_month: number;
  total_analyses: number;
  this_month_analyses: number;
  total_campaigns: number;
  total_credits_used: number;
  plans: Record<string, number>;
  platforms: Record<string, number>;
  mrr: number;
  arr: number;
  estimated_revenue: number;
  estimated_api_cost: number;
  estimated_net: number;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  plan: string;
  credits_remaining: number;
  credits_total: number;
  credits_used: number;
  credits_pct: number;
  is_active: boolean;
  is_admin: boolean;
  analyses_count: number;
  health_score: number;
  churn_risk: string;
  churn_reason: string;
  created_at: string;
  last_login_at: string | null;
}

export interface CustomerIntelligence {
  user_id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  plan: string;
  health_score: number;
  churn_risk: string;
  churn_reason: string;
  analyses_count: number;
  top_platform: string | null;
  credits_used: number;
  credits_total: number;
  days_since_login: number | null;
}

export interface ChurnRisk {
  user_id: number;
  email: string;
  full_name: string | null;
  plan: string;
  churn_risk: string;
  reason: string;
  days_since_login: number | null;
  analyses_count: number;
}

export interface CostCenter {
  breakdown: Record<
    string,
    {
      analyses: number;
      cost_per_analysis_cents: number;
      total_cost_usd: number;
    }
  >;
  total_analyses: number;
  total_cost_usd: number;
  cost_per_analysis_usd: number;
  cost_per_user_usd: number;
  estimated_monthly_cost: number;
  note: string;
  providers: Record<string, { cost_per_call_cents: number; description: string }>;
}

export interface HealthCheck {
  overall: "healthy" | "warning" | "degraded";
  providers: Record<string, { status: string; message: string; code?: number }>;
}

export interface QueueMonitor {
  status: string;
  recent_hour: number;
  recent_day: number;
  total_processed: number;
  avg_per_day: number;
  recent_analyses: {
    id: number;
    username: string;
    platform: string;
    final_score: number;
    created_at: string;
  }[];
  note: string;
}

export interface AbuseAlert {
  type: string;
  severity: string;
  user_id: number;
  email: string;
  message: string;
  count: number;
  username?: string;
}

export interface AdminTicket {
  id: number;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  messages_count: number;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  action: string;
  user_email: string | null;
  admin_email: string | null;
  resource_type: string | null;
  resource_id: number | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface Package {
  id: number;
  slug: string;
  name: string;
  price_monthly: number;
  price_annual: number;
  price_monthly_usd: number;
  price_annual_usd: number;
  credits: number;
  features: Record<string, any>;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface AnalysisCard {
  id: number;
  username: string;
  display_name: string;
  platform: string;
  platform_label: string;
  avatar: string;
  category: string;
  country: string;
  followers: number;
  engagement_rate: number;
  final_score: number;
  fraud_score: number;
  fraud_risk: string;
  brand_fit_score: number;
  roi_potential_score: number;
  momentum_score: number;
  engagement_quality_score: number;
  decision: string;
  created_at: string;
}

export interface DashboardStats {
  user: {
    id: number;
    full_name: string | null;
    email: string;
    company: string | null;
    plan: string;
    credits_remaining: number;
    credits_total: number;
    is_admin: boolean;
  };
  stats: {
    total_analyses: number;
    this_month: number;
    credits_remaining: number;
    credits_total: number;
    low_risk: number;
    medium_risk: number;
    high_risk: number;
  };
  platforms: Record<string, number>;
  recent_analyses: AnalysisCard[];
  /** Archive preview — yalnızca kişisel analiz yoksa dolu olur */
  archive_preview?: AnalysisCard[];
  archive_count?: number;
}

export interface Leaderboards {
  lowest_risk: AnalysisCard[];
  highest_brand: AnalysisCard[];
  highest_roi: AnalysisCard[];
  highest_momentum: AnalysisCard[];
  best_overall: AnalysisCard[];
  has_data: boolean;
}

export interface AnalyzeResult {
  success: boolean;
  analysis_id: number;
  profile: Profile;
  scores: Scores;
  report: Report;
  similar: any[];
  credits_remaining: number;
}

export interface Profile {
  username: string;
  display_name: string;
  platform: string;
  platform_label: string;
  avatar: string;
  /** Normalize edilmiş profil görseli — her provider garantiler */
  profile_image_url?: string;
  banner: string;
  bio: string;
  category: string;
  country: string;
  followers: number;
  following: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  engagement_rate: number;
  suspicious_audience: number;
  content: ContentItem[];
  is_real_data: boolean;
  missing_real_fields: string[];
}

export interface ContentItem {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  published: string;
  url: string;
}

export interface Scores {
  final_score: number;
  authenticity: number;
  authenticity_reasons: string[];
  fraud_score: number;
  fraud_reasons: string[];
  fraud_detail: Record<string, string | number>;
  brand_fit: number;
  brand_fit_reasons: string[];
  brand_fit_campaign_types: string[];
  momentum: number;
  momentum_reasons: string[];
  engagement_quality: number;
  engagement_quality_reasons: string[];
  roi_potential: number;
  roi_reasons: string[];
  roi_prediction: RoiPrediction;
  reputation_risk: number;
  reputation_risk_reasons: string[];
  fraud_risk: string;
  fraud_risk_label: string;
  decision: string;
  er_grade: string;
  signals: Signal[];
  data_confidence: string;
  missing_fields: string[];
}

export interface RoiPrediction {
  estimated_reach: number;
  estimated_impressions: number;
  estimated_clicks: number;
  estimated_conversions: number;
  estimated_cpm: number;
  estimated_cpe: number;
  budget_min: number;
  budget_max: number;
  currency: string;
  note: string;
}

export interface Signal {
  type: "positive" | "negative" | "warning";
  text: string;
}

export interface Report {
  headline: string;
  executive_summary: string;
  summary: string;
  recommendation: string;
  pros: string[];
  cons: string[];
  budget_estimate: {
    min: number;
    max: number;
    currency: string;
    per: string;
    note: string;
  };
  roi_prediction: RoiPrediction;
  reach_estimate: number;
  next_steps: string[];
  missing_data_note: string | null;
}

export interface AnalysisSummary {
  id: number;
  username: string;
  platform: string;
  brand: string | null;
  final_score: number;
  fraud_score: number;
  decision: string;
  followers: number;
  engagement_rate: number;
  created_at: string;
}

// ── Archive Types ───────────────────────────────────────────────

export interface ArchiveProfile {
  id: number;
  username: string;
  platform: string;
  platform_label: string;
  display_name: string;
  category: string;
  country: string;
  bio: string;
  profile_image_url: string;
  avatar: string;
  sync_status: string;
  has_snapshot: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // snapshot fields (presente se has_snapshot=true)
  followers?: number | null;
  following?: number | null;
  avg_views?: number | null;
  engagement_rate?: number | null;
  final_score?: number | null;
  fraud_score?: number | null;
  brand_fit_score?: number | null;
  roi_potential_score?: number | null;
  momentum_score?: number | null;
  engagement_quality_score?: number | null;
  reputation_risk_score?: number | null;
  fraud_risk?: string;
  decision?: string;
  captured_at?: string;
  // snapshot_history (detail endpoint)
  snapshot_count?: number;
  snapshot_history?: {
    id: number;
    captured_at: string;
    followers: number;
    engagement_rate: number;
    final_score: number;
    fraud_score: number;
    decision: string;
  }[];
}

// ── Brand Match API Types (Part 22) ──────────────────────────────────────────

export interface BrandMatchEvidenceResponse {
  url: string;
  fetchStatus: "success" | "failed" | "timeout" | "blocked" | "invalid_url";
  fetchError?: string;
  httpStatus?: number;
  finalUrl?: string;
  responseTimeMs?: number;
  pageTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  h1s: string[];
  h2s: string[];
  bodySnippets: string[];
  keywordHints: string[];
  socialLinks: string[];
  language?: string;
  aiUsed: boolean;
  targetMarket?: string;
  evidenceQuality: "strong" | "moderate" | "weak" | "none";
}

export interface BrandMatchAnalyzeRequest {
  input: string;
  target_market?: string;
}

export interface BrandMatchAnalyzeResponse {
  analysis_id?: number;
  input: string;
  resolved_domain?: string;
  resolved_url?: string;
  resolver_status: "resolved" | "domain_unresolved" | "ambiguous_domain";
  resolver_confidence: "high" | "medium" | "low";
  resolver_note?: string;
  fetch_status: "success" | "failed" | "timeout" | "blocked" | "not_attempted";
  report_status: "verified" | "domain_unresolved" | "fetch_failed" | "insufficient_web_evidence";
  verified_report: boolean;
  evidence?: BrandMatchEvidenceResponse;
  domain_candidates: { domain: string; url: string; confidence: string }[];
  locked_sections: string[];
  redaction_level: string;
  user_message?: string;
  // Section readiness (Post-Audit / Final Patch)
  brand_dna_ready: boolean;
  ai_enrichment_ready: boolean;
  min_creator_pool: number;
  creator_matching_ready: boolean;
  trust_scores_ready: boolean;
  blocked_sections: string[];
  blocked_reasons: Record<string, string>;
}

export const brandMatchApi = {
  analyze: (body: BrandMatchAnalyzeRequest): Promise<BrandMatchAnalyzeResponse> =>
    request<BrandMatchAnalyzeResponse>("/intelligence/brand-match/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
