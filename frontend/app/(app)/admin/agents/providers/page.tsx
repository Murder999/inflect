"use client";
import { useEffect, useState } from "react";
import {
  getAgentProviderHealth,
  type AgentProviderHealth,
} from "@/lib/agents-api";

const PROVIDER_META: Record<string, { icon: string; label: string; desc: string }> = {
  mock:      { icon: "⬡", label: "Mock",      desc: "Simüle edilmiş provider (Part 1)" },
  claude:    { icon: "◈", label: "Claude",     desc: "Anthropic Claude API" },
  openai:    { icon: "◎", label: "OpenAI",     desc: "GPT-4o / GPT-4-turbo API" },
  deepseek:  { icon: "⊛", label: "DeepSeek",  desc: "DeepSeek-V3 API" },
  youtube:   { icon: "▶", label: "YouTube",    desc: "YouTube Data API v3" },
  apify:     { icon: "◑", label: "Apify",      desc: "Instagram + TikTok scraper" },
  instagram: { icon: "◐", label: "Instagram",  desc: "Meta Instagram Basic Display" },
  tiktok:    { icon: "◻", label: "TikTok",     desc: "TikTok Research API" },
};

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  healthy:  { color: "var(--green)", bg: "var(--green-bg)", label: "Sağlıklı" },
  degraded: { color: "var(--amber)", bg: "var(--amber-bg)", label: "Yavaş" },
  down:     { color: "var(--red)",   bg: "#FEF2F2",         label: "Çökmüş" },
  unknown:  { color: "var(--text-3)", bg: "var(--bg-subtle)", label: "Bilinmiyor" },
};

function ProviderCard({ provider }: { provider: AgentProviderHealth }) {
  const meta = PROVIDER_META[provider.provider] || { icon: "◎", label: provider.provider, desc: "" };
  const cfg  = STATUS_CFG[provider.status] || STATUS_CFG.unknown;

  return (
    <div className="card" style={{
      padding: 20, display: "flex", flexDirection: "column", gap: 14,
      borderTop: `3px solid ${cfg.color}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 11, flexShrink: 0,
          background: cfg.bg, color: cfg.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 700,
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{meta.desc}</div>
        </div>
      </div>

      {/* Status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 12px", borderRadius: 8,
        background: cfg.bg, border: `1px solid ${cfg.color}20`,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: cfg.color, flexShrink: 0,
          boxShadow: provider.status === "healthy" ? `0 0 0 3px ${cfg.color}25` : "none",
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>
          {cfg.label}
        </span>
        {provider.latency_ms != null && (
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>
            {provider.latency_ms}ms
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{
          padding: "8px 10px", background: "var(--bg-subtle)",
          borderRadius: 7, fontSize: 11,
        }}>
          <div style={{ color: "var(--text-3)", marginBottom: 2 }}>Son kontrol</div>
          <div style={{ color: "var(--text-1)", fontWeight: 500 }}>
            {new Date(provider.last_checked_at).toLocaleString("tr-TR", {
              hour: "2-digit", minute: "2-digit",
              day: "2-digit", month: "2-digit",
            })}
          </div>
        </div>
        <div style={{ padding: "8px 10px", background: "var(--bg-subtle)", borderRadius: 7, fontSize: 11 }}>
          <div style={{ color: "var(--text-3)", marginBottom: 2 }}>Sağlayıcı ID</div>
          <div style={{ color: "var(--text-1)", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
            #{provider.id} — {provider.provider}
          </div>
        </div>
      </div>

      {/* Error */}
      {provider.error_message && (
        <div style={{
          padding: "8px 12px", background: "#FEF2F2",
          border: "1px solid #FECACA", borderRadius: 7,
          fontSize: 12, color: "var(--red)", lineHeight: 1.5,
        }}>
          {provider.error_message}
        </div>
      )}

      {/* Metadata */}
      {provider.metadata && Object.keys(provider.metadata).length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
          {Object.entries(provider.metadata).map(([k, v]) => (
            <div key={k}><strong>{k}:</strong> {JSON.stringify(v)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<AgentProviderHealth[]>([]);
  const [note,      setNote]      = useState("");
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState("");

  async function load() {
    setLoading(true); setErr("");
    try {
      const r = await getAgentProviderHealth();
      setProviders(r.providers);
      setNote(r.note || "");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const healthy  = providers.filter((p) => p.status === "healthy").length;
  const degraded = providers.filter((p) => p.status === "degraded").length;
  const down     = providers.filter((p) => p.status === "down").length;
  const unknown  = providers.filter((p) => p.status === "unknown").length;

  const overallOk = down === 0 && degraded === 0;

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin → AI Agents</span>
            <span style={{ color: "var(--text-3)" }}>→</span>
            <span style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 500 }}>Provider Health</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: "0 0 4px" }}>
            Provider Sağlık
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: overallOk ? "var(--green)" : down > 0 ? "var(--red)" : "var(--amber)",
            }} />
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: overallOk ? "var(--green)" : down > 0 ? "var(--red)" : "var(--amber)",
            }}>
              {overallOk ? "Tüm sistemler normal" : down > 0 ? `${down} provider çökmüş` : "Degraded mode"}
            </span>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm" disabled={loading}>
          {loading ? "…" : "↺ Yenile"}
        </button>
      </div>

      {/* Özet */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Sağlıklı",  value: healthy,  color: "var(--green)" },
          { label: "Yavaş",     value: degraded, color: "var(--amber)" },
          { label: "Çökmüş",   value: down,     color: "var(--red)" },
          { label: "Bilinmiyor", value: unknown, color: "var(--text-3)" },
        ].map((item) => (
          <div key={item.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: item.value > 0 ? item.color : "var(--text-3)" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {note && (
        <div style={{
          padding: "10px 14px", background: "var(--bg-subtle)",
          border: "1px solid var(--line)", borderRadius: 8,
          fontSize: 12, color: "var(--text-3)", marginBottom: 20,
        }}>
          ℹ {note}
        </div>
      )}

      {err && (
        <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-3)" }}>Yükleniyor…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {providers.map((p) => <ProviderCard key={p.id} provider={p} />)}
        </div>
      )}
    </div>
  );
}
