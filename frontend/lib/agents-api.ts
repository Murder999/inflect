/**
 * AI Orchestrator — Agent API Client (Part 2)
 * Tüm agent endpoint'leri için type-safe fonksiyonlar.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function agentRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Sunucuya bağlanılamadı.");
  }

  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Yetkisiz.");
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }

  if (!res.ok) {
    const msg =
      typeof data?.detail === "string"
        ? data.detail
        : `Hata (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentStatus =
  | "active"
  | "idle"
  | "error"
  | "disabled"
  | "waiting_approval";

export type AgentMode = "mock" | "active" | "disabled";

export type AgentRole =
  | "orchestrator"
  | "product"
  | "developer"
  | "qa"
  | "operations"
  | "analysis"
  | "fraud"
  | "audience"
  | "brand_fit"
  | "roi"
  | "seo"
  | "lead_finder"
  | "ads"
  | "sales"
  | "support"
  | "finance"
  | "legal"
  | "report"
  | "security"
  | "cto"
  | "data_quality"
  | "growth"
  | "discovery"
  | "intel"
  | "archive_ai"
  | string;

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "waiting_approval"
  | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type MessageType =
  | "instruction"
  | "result"
  | "warning"
  | "approval_request"
  | "decision"
  | "log";
export type SenderType = "agent" | "system" | "admin" | "user";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ProviderStatus = "healthy" | "degraded" | "down" | "unknown";

export interface Agent {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  role: AgentRole;
  department: string | null;
  status: AgentStatus;
  mode: AgentMode;
  model_provider: string;
  model_name: string;
  risk_level: RiskLevel;
  is_enabled: boolean;
  is_scheduled: boolean;
  schedule_cron: string | null;
  next_run_at: string | null;
  autonomy_level: string;
  health_status: string;
  failure_count: number;
  last_error: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  memories?: { key: string; value: any; type: string; confidence: number | null }[];
  recent_runs?: AgentRun[];
}

export interface AgentTask {
  id: number;
  agent_id: number;
  parent_task_id: number | null;
  title: string;
  description: string | null;
  task_type: string;
  status: TaskStatus;
  priority: TaskPriority;
  risk_level: RiskLevel;
  requires_approval: boolean;
  input_data: Record<string, any> | null;
  output_data: Record<string, any> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  runs?: AgentRun[];
}

export interface AgentRun {
  id: number;
  agent_id: number;
  task_id: number | null;
  provider: string;
  model: string;
  status: string;
  is_mock: boolean;
  mode_used: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate: number | null;
  latency_ms: number | null;
  input_summary: string | null;
  output_summary: string | null;
  confidence: number | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, any> | null;
}

export interface AgentEvent {
  id: number;
  event_type: string;
  payload: Record<string, any> | null;
  source: string;
  status: string;
  related_agent_id: number | null;
  related_task_id: number | null;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
}

export interface AgentConversation {
  id: number;
  title: string;
  source: string;
  status: string;
  related_task_id: number | null;
  created_at: string;
  updated_at: string;
  messages?: AgentMessage[];
  message_count?: number;
}

export interface AgentMessage {
  id: number;
  conversation_id: number;
  agent_id: number | null;
  sender_type: SenderType;
  sender_name: string;
  message_type: MessageType;
  content: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface AgentApproval {
  id: number;
  task_id: number | null;
  requested_by_agent_id: number | null;
  action_type: string;
  title: string;
  description: string | null;
  risk_level: RiskLevel;
  payload: Record<string, any> | null;
  status: ApprovalStatus;
  reviewed_by_user_id: number | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface AgentProviderHealth {
  id: number;
  provider: string;
  status: ProviderStatus;
  latency_ms: number | null;
  last_checked_at: string;
  error_message: string | null;
  metadata: Record<string, any> | null;
}

export interface AgentOverview {
  agents_total: number;
  agents_enabled: number;
  agents_scheduled: number;
  tasks_total: number;
  runs_total: number;
  runs_mock: number;
  conversations_total: number;
  pending_approvals: number;
  system_status: string;
  provider_mode: string;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/** Tüm ajanları listele + genel özet + mod + key durumu */
export function getAgents(enabledOnly = false) {
  return agentRequest<{
    agents: Agent[];
    total: number;
    overview: AgentOverview;
    agents_mode: string;
    key_status: Record<string, boolean>;
  }>(`/agents${enabledOnly ? "?enabled_only=true" : ""}`);
}

/** Sistem genel özeti */
export function getAgentOverview() {
  return agentRequest<AgentOverview>("/agents/overview");
}

/** Görev listesi */
export function getAgentTasks(params?: {
  agent_id?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params?.agent_id) q.set("agent_id", String(params.agent_id));
  if (params?.status) q.set("status", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.offset) q.set("offset", String(params.offset));
  const qs = q.toString();
  return agentRequest<{ tasks: AgentTask[]; total: number }>(
    `/agents/tasks${qs ? `?${qs}` : ""}`
  );
}

/** Yeni görev oluştur */
export function createAgentTask(body: {
  agent_id: number;
  title: string;
  task_type?: string;
  description?: string;
  input_data?: Record<string, any>;
  priority?: string;
  risk_level?: string;
  requires_approval?: boolean;
}) {
  return agentRequest<{ success: boolean; task: AgentTask }>("/agents/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Görevi çalıştır */
export function runAgentTask(taskId: number) {
  return agentRequest<{ success: boolean; task: AgentTask; run: AgentRun | null }>(
    `/agents/tasks/${taskId}/run`,
    { method: "POST" }
  );
}

/** Run listesi */
export function getAgentRuns(agentId?: number, limit = 50) {
  const q = new URLSearchParams({ limit: String(limit) });
  if (agentId) q.set("agent_id", String(agentId));
  return agentRequest<{ runs: AgentRun[]; total: number }>(
    `/agents/runs?${q.toString()}`
  );
}

/** Konuşma listesi */
export function getAgentConversations(limit = 50, offset = 0) {
  return agentRequest<{ conversations: AgentConversation[]; total: number }>(
    `/agents/conversations?limit=${limit}&offset=${offset}`
  );
}

/** Konuşma detayı + mesajlar */
export function getAgentConversation(conversationId: number) {
  return agentRequest<AgentConversation & { messages: AgentMessage[]; message_count: number }>(
    `/agents/conversations/${conversationId}`
  );
}

/** Onay kuyruğu */
export function getAgentApprovals(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return agentRequest<{ approvals: AgentApproval[]; total: number }>(
    `/agents/approvals${qs}`
  );
}

/** Onayı kabul et */
export function approveAgentApproval(approvalId: number, note?: string) {
  return agentRequest<{ success: boolean; approval: AgentApproval }>(
    `/agents/approvals/${approvalId}/approve`,
    { method: "POST", body: JSON.stringify({ note: note || null }) }
  );
}

/** Onayı reddet */
export function rejectAgentApproval(approvalId: number, note?: string) {
  return agentRequest<{ success: boolean; approval: AgentApproval }>(
    `/agents/approvals/${approvalId}/reject`,
    { method: "POST", body: JSON.stringify({ note: note || null }) }
  );
}

/** Provider sağlık durumu */
export function getAgentProviderHealth() {
  return agentRequest<{ providers: AgentProviderHealth[]; total: number; note: string }>(
    "/agents/provider-health"
  );
}

/** Mock run senaryosu tetikle */
export function triggerMockAgentRun() {
  return agentRequest<{
    success: boolean;
    scenario: string;
    conversation_id: number;
    main_task_id: number;
    sub_task_ids: number[];
    sub_task_count: number;
    message_count: number;
    run_id: number | null;
    agents_involved: string[];
    note: string;
    mode: string;
    is_mock: boolean;
    risk_level: string;
    approval_id: number | null;
  }>("/agents/mock-run", { method: "POST" });
}

/**
 * Real mode'da tek ajan çalıştır.
 * Task oluştur → run → sonuç döndür.
 */
export async function runAgentTest(agentId: number) {
  const { task } = await createAgentTask({
    agent_id: agentId,
    title: "Test çalıştırma",
    task_type: "general",
  });
  const runResult = await runAgentTask(task.id);
  const failed = runResult.run?.error_message || runResult.task.status !== "completed";
  return {
    success: !failed,
    task: runResult.task,
    run: runResult.run,
    error_message: runResult.run?.error_message ?? null,
  };
}

/** Admin: per-agent execution mode değiştir */
export function updateAgentMode(agentId: number, mode: AgentMode) {
  return agentRequest<{ success: boolean; mode: string; is_enabled: boolean; note: string }>(
    `/agents/${agentId}/mode`,
    { method: "PATCH", body: JSON.stringify({ mode }) }
  );
}

/** Agent event bus: event listesi */
export function getAgentEvents(params?: { event_type?: string; status?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.event_type) q.set("event_type", params.event_type);
  if (params?.status) q.set("status", params.status);
  if (params?.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return agentRequest<{ events: AgentEvent[]; total: number }>(
    `/agents/events${qs ? `?${qs}` : ""}`
  );
}

/** Admin: event bus'a event yayınla */
export function publishAgentEvent(event_type: string, payload?: Record<string, any>) {
  return agentRequest<{ success: boolean; event: AgentEvent }>(
    `/agents/events`,
    { method: "POST", body: JSON.stringify({ event_type, payload: payload || {}, source: "admin" }) }
  );
}

/** Admin: Scheduled job'ı manuel tetikle */
export function triggerScheduledJob(agentSlug: string) {
  return agentRequest<{ success: boolean; task_id: number; agent_slug: string; triggered_at: string }>(
    `/agents/schedule/${agentSlug}/trigger`,
    { method: "POST" }
  );
}

/** Admin: Ajan provider ve model güncelle */
export function updateAgentProvider(
  agentId: number,
  provider: string,
  modelName?: string,
  fallbackProvider?: string,
) {
  return agentRequest<{ success: boolean; model_provider: string; model_name: string; note: string }>(
    `/agents/${agentId}/provider`,
    {
      method: "PATCH",
      body: JSON.stringify({
        model_provider:    provider,
        model_name:        modelName || undefined,
        fallback_provider: fallbackProvider || undefined,
      }),
    }
  );
}

/** Campaign Copilot — çok ajana zincirli workflow */
export function runCampaignCopilot(body: {
  brand: string;
  objective: string;
  platform?: string;
  category?: string;
  budget?: number;
  competitors?: string[];
}) {
  return agentRequest<{
    brand: string;
    objective: string;
    steps_run: number;
    success_count: number;
    task_ids: number[];
    total_cost_usd: number;
    results: { step: string; slug: string; success: boolean; summary: string; output: any }[];
    note: string;
  }>("/agents/copilot/campaign", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export const STATUS_COLOR: Record<string, string> = {
  active:           "var(--green)",
  idle:             "var(--brand-600)",
  error:            "var(--red)",
  disabled:         "var(--text-3)",
  waiting_approval: "var(--amber)",
  // task
  pending:   "var(--text-3)",
  running:   "var(--brand-600)",
  completed: "var(--green)",
  failed:    "var(--red)",
  cancelled: "var(--text-3)",
  // provider
  healthy:  "var(--green)",
  degraded: "var(--amber)",
  down:     "var(--red)",
  unknown:  "var(--text-3)",
  // approval
  approved: "var(--green)",
  rejected: "var(--red)",
  expired:  "var(--text-3)",
};

export const STATUS_LABEL: Record<string, string> = {
  active: "Aktif", idle: "Beklemede", error: "Hata",
  disabled: "Devre Dışı", waiting_approval: "Onay Bekliyor",
  pending: "Bekliyor", running: "Çalışıyor", completed: "Tamamlandı",
  failed: "Başarısız", cancelled: "İptal",
  healthy: "Sağlıklı", degraded: "Yavaş", down: "Çökmüş", unknown: "Bilinmiyor",
  approved: "Onaylandı", rejected: "Reddedildi", expired: "Süresi Doldu",
};

export const RISK_COLOR: Record<string, string> = {
  low: "var(--green)", medium: "var(--amber)",
  high: "var(--red)", critical: "var(--red)",
};

export const RISK_LABEL: Record<string, string> = {
  low: "Düşük", medium: "Orta", high: "Yüksek", critical: "Kritik",
};

export const MSG_TYPE_COLOR: Record<string, string> = {
  instruction:      "var(--brand-600)",
  result:           "var(--green)",
  warning:          "var(--amber)",
  approval_request: "var(--red)",
  decision:         "#8B5CF6",
  log:              "var(--text-3)",
};

export const MSG_TYPE_LABEL: Record<string, string> = {
  instruction: "Talimat", result: "Sonuç", warning: "Uyarı",
  approval_request: "Onay İsteği", decision: "Karar", log: "Log",
};

export const MODE_COLOR: Record<AgentMode, string> = {
  mock:     "var(--amber)",
  active:   "var(--green)",
  disabled: "var(--text-3)",
};

export const MODE_LABEL: Record<AgentMode, string> = {
  mock:     "MOCK",
  active:   "ACTIVE",
  disabled: "DISABLED",
};

export const MODE_DESC: Record<AgentMode, string> = {
  mock:     "Simüle yanıtlar — gerçek API çağrısı yok",
  active:   "Gerçek LLM sağlayıcılar — API key gerekli",
  disabled: "Devre dışı — görev almaz",
};

export const ROLE_ICON: Record<string, string> = {
  orchestrator: "⬡", product: "◈", developer: "⌥", qa: "✓",
  operations: "◑", analysis: "◎", fraud: "!", audience: "◐",
  brand_fit: "◇", roi: "△", seo: "↑", lead_finder: "⊛",
  ads: "◻", sales: "◈", support: "✉", finance: "₿", legal: "⚖", report: "≡",
  // Part 2
  archive_ai: "◉", intel: "◑", growth: "↑", discovery: "⊕", campaign: "✴",
  // Part 11
  security: "🛡", cto: "⚙", data_quality: "◫",
};

export const DEPT_LABEL: Record<string, string> = {
  executive:   "Executive",
  product:     "Product",
  engineering: "Engineering",
  analysis:    "Analysis",
  campaign:    "Campaign",
  growth:      "Growth",
  archive:     "Archive",
  intel:       "Intelligence",
};

export const DEPT_COLOR: Record<string, string> = {
  executive:   "#8B5CF6",
  product:     "var(--brand-600)",
  engineering: "var(--green)",
  analysis:    "var(--amber)",
  campaign:    "#EC4899",
  growth:      "#06B6D4",
  archive:     "#F59E0B",
  intel:       "#6366F1",
};

export function relativeTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60) return "Az önce";
  if (diff < 3600) return `${Math.floor(diff / 60)}dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}s önce`;
  return `${Math.floor(diff / 86400)}g önce`;
}
