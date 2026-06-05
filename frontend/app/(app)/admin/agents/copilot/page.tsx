"use client";
import { useState } from "react";
import { runCampaignCopilot } from "@/lib/agents-api";

const PLATFORMS = ["instagram", "tiktok", "youtube"];
const CATEGORIES = ["Moda", "Güzellik", "Teknoloji", "Gıda", "Spor", "Seyahat", "Gaming", "Business", "Genel"];

function StepBadge({ success }: { success: boolean }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: success ? "var(--green-bg)" : "var(--red-bg)",
      color: success ? "var(--green)" : "var(--red)",
    }}>
      {success ? "✓ Başarılı" : "✕ Hata"}
    </span>
  );
}

export default function CopilotPage() {
  const [form, setForm] = useState({
    brand: "", objective: "", platform: "instagram",
    category: "Genel", budget: "", competitors: "",
  });
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<any>(null);
  const [err,      setErr]      = useState("");

  const set = (k: string) => (e: React.ChangeEvent<any>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  async function run() {
    if (!form.brand.trim() || !form.objective.trim()) {
      setErr("Marka ve hedef zorunlu."); return;
    }
    setLoading(true); setErr(""); setResult(null);
    try {
      const res = await runCampaignCopilot({
        brand:       form.brand.trim(),
        objective:   form.objective.trim(),
        platform:    form.platform,
        category:    form.category,
        budget:      form.budget ? Number(form.budget) : undefined,
        competitors: form.competitors ? form.competitors.split(",").map((s) => s.trim()).filter(Boolean) : [],
      });
      setResult(res);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin → AI Agents</span>
          <span style={{ color: "var(--text-3)" }}>→</span>
          <span style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 500 }}>Campaign Copilot</span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: "0 0 4px" }}>
          Campaign Copilot
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>
          6 ajana zincirli workflow: Creator Keşfi → Marka Uyumu → ROI → Kampanya → Rapor
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 20, alignItems: "start" }}>
        {/* Form */}
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Kampanya Parametreleri</h3>

          {err && (
            <div style={{ padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 7, fontSize: 12 }}>
              {err}
            </div>
          )}

          {[
            { k: "brand",     l: "Marka Adı *",           ph: "Nike, Samsung..." },
            { k: "objective", l: "Kampanya Hedefi *",      ph: "Türkiye'de teknoloji influencer bul" },
          ].map((f) => (
            <div key={f.k}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>{f.l}</label>
              <input value={form[f.k as "brand" | "objective"]} onChange={set(f.k)} placeholder={f.ph}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, border: "1px solid var(--line)", background: "var(--bg-subtle)", color: "var(--text-1)" }} />
            </div>
          ))}

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Platform</label>
            <select value={form.platform} onChange={set("platform")}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, border: "1px solid var(--line)", background: "var(--bg-subtle)" }}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Kategori</label>
            <select value={form.category} onChange={set("category")}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, border: "1px solid var(--line)", background: "var(--bg-subtle)" }}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Bütçe (USD, opsiyonel)</label>
            <input type="number" value={form.budget} onChange={set("budget")} placeholder="5000"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, border: "1px solid var(--line)", background: "var(--bg-subtle)" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>
              Rakipler (virgülle ayır, opsiyonel)
            </label>
            <input value={form.competitors} onChange={set("competitors")} placeholder="Adidas, Puma"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, border: "1px solid var(--line)", background: "var(--bg-subtle)" }} />
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>
              Rakip varsa Competitor Intel ajanı zincire eklenir.
            </div>
          </div>

          <button onClick={run} disabled={loading} style={{
            padding: "10px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            background: "var(--brand-600)", color: "#fff", border: "none",
            opacity: loading ? 0.7 : 1, marginTop: 4,
          }}>
            {loading ? "Copilot çalışıyor…" : "⚡ Campaign Copilot Başlat"}
          </button>

          {/* Workflow diagram */}
          <div style={{ paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-2)", marginBottom: 8 }}>Workflow Zinciri</div>
            {[
              "Creator Keşfi", "Marka Uyumu", "ROI Tahmin",
              "Kampanya Planı", "Premium Rapor",
            ].map((step, i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--green-bg)", color: "var(--brand-600)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-2)" }}>{step}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6 }}>
              + Rakip varsa: Competitor Intel (adım 0)
            </div>
          </div>
        </div>

        {/* Results */}
        {result ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Summary card */}
            <div className="card" style={{ padding: 18, borderLeft: "3px solid var(--green)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {result.brand} — Copilot Tamamlandı
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-3)" }}>
                <span>Adım: {result.steps_run}</span>
                <span>Başarılı: <span style={{ color: "var(--green)", fontWeight: 600 }}>{result.success_count}</span></span>
                <span>Maliyet: ${result.total_cost_usd}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, fontStyle: "italic" }}>{result.note}</div>
            </div>

            {/* Step results */}
            {result.results.map((step: any, i: number) => (
              <div key={i} className="card" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--brand-600)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{step.step}</span>
                    <span style={{ fontSize: 10, color: "var(--text-3)" }}>{step.slug}</span>
                  </div>
                  <StepBadge success={step.success} />
                </div>
                {step.summary && (
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8, lineHeight: 1.5 }}>
                    {step.summary}
                  </div>
                )}
                {step.output && typeof step.output === "object" && (
                  <div style={{ background: "var(--bg-subtle)", borderRadius: 7, padding: "10px 12px", fontSize: 11, color: "var(--text-3)" }}>
                    {Object.entries(step.output).slice(0, 4).map(([k, v]) => {
                      if (typeof v === "string" && v.length < 150)
                        return <div key={k} style={{ marginBottom: 2 }}><strong>{k}:</strong> {v}</div>;
                      if (Array.isArray(v) && v.length > 0)
                        return <div key={k} style={{ marginBottom: 2 }}><strong>{k}:</strong> {v.length} öge</div>;
                      return null;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>⚡</div>
            <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 8px" }}>Campaign Copilot</h2>
            <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0, maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>
              Formu doldurun ve Copilot'u başlatın. 5-6 ajan otomatik zincirlenecek:
              Creator Keşfi → Marka Uyumu → ROI → Kampanya Planı → Premium Rapor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
