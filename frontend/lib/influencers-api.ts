/**
 * Influencer Lookup API client — Part 12 UX Fix
 * Used by Digital Twin page and any future multi-feature search.
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type Platform = "instagram" | "tiktok" | "youtube";

export interface DataSufficiency {
  is_sufficient: boolean;
  required_snapshots: number;
  actual_snapshots: number;
  required_days: number;
  actual_days: number;
  reason: string | null;
  estimated_ready_at: string | null;
  missing: string[];
}

export interface InfluencerLookupResult {
  profile_id: number;
  username: string;
  display_name: string;
  platform: Platform | string;
  profile_image_url: string;
  avatar_status: "existing" | "fallback";
  avatar_source: "profile" | "initials";
  category: string;
  country: string;
  followers: number;
  engagement_rate: number;
  snapshot_count: number;
  first_snapshot_at: string | null;
  last_snapshot_at: string | null;
  history_days: number;
  has_digital_twin: boolean;
  latest_twin_id: number | null;
  twin_confidence: string | null;
  twin_generated_at: string | null;
  twin_is_mock: boolean | null;
  data_sufficiency: DataSufficiency;
}

export interface LookupResponse {
  query: string;
  normalized_username: string;
  detected_platform: string | null;
  results: InfluencerLookupResult[];
}

// ─── Platform UI helpers ──────────────────────────────────────────────────────

export const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok:    "TikTok",
  youtube:   "YouTube",
};

export const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#E1306C",
  tiktok:    "#010101",
  youtube:   "#FF0000",
};

export const PLATFORM_BG: Record<string, string> = {
  instagram: "#fce4ec",
  tiktok:    "#f0f0f0",
  youtube:   "#ffebee",
};

// ─── API ─────────────────────────────────────────────────────────────────────

export const influencersApi = {
  lookup: (q: string, platform?: string): Promise<LookupResponse> => {
    const params = new URLSearchParams({ q });
    if (platform && platform !== "auto") params.set("platform", platform);
    return request<LookupResponse>(`/influencers/lookup?${params.toString()}`);
  },
};

// ─── Admin archive actions ────────────────────────────────────────────────────

export interface SyncProfileResponse {
  success: boolean;
  note?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ResolveAvatarResponse {
  profile_id: number;
  ok: boolean;
  profile_image_url: string | null;
  source: string;
  error: string | null;
}

export const archiveAdminApi = {
  syncProfile: (profileId: number): Promise<SyncProfileResponse> =>
    request<SyncProfileResponse>(`/archive/profiles/${profileId}/sync`, { method: "POST" }),

  resolveAvatar: (profileId: number): Promise<ResolveAvatarResponse> =>
    request<ResolveAvatarResponse>(`/archive/profiles/${profileId}/resolve-avatar`, { method: "POST" }),
};
