"use client";
import { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function apiPost(path: string, body: any = {}) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `HTTP ${res.status}`); }
  return res.json();
}

const SECTIONS = [
  { key: "seo",  label: "SEO Opportunities", icon: "↑", color: "var(--green)",     desc: "Blog başlıkları, keyword cluster, teknik SEO checklist", endpoint: "/agents/growth/seo-plan" },
  { key: "ads",  label: "Ads Intelligence",   icon: "◻", color: "var(--brand-600)", desc: "Google / Meta / LinkedIn reklam kopyaları ve hedef kitle", endpoint: "/agents/growth/ad-plan" },
  { key: "lead", label: "Lead Pipeline",      icon: "⊛", color: "var(--amber)",     desc: "ICP tanımı, segment önceliklendirme, lead scoring mantığı",  endpoint: "/agents/growth/lead-plan" },
];

function OutputSection({ data }: { data: any }) {
  if (!data) return null;
  const output = data.output || {};
  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      {data.summary && (
        <div style={{ padding: "10px 14px", background: "var(--green-bg)", borderRadius: 8, fontSize: 13, color: "var(--green)" }}>
          {data.summary}
        </div>
      )}
      {data.requires_approval && (
        <div style={{ padding: "8px 14px", background: "var(--amber-bg)", borderRadius: 8, fontSize: 12, color: "var(--amber)" }}>
          ⚠ Taslak hazır — dış aksiyon için Admin onayı gerekiyor.
        </div>
      )}
      {Object.entries(output).map(([key, val]) => {
        if (key === "status" || key === "note" || key === "blocked_reason" || key === "blocked_actions") return null;
        if (typeof val === "string") return (
          <div key={key} style={{ padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: 7, fontSize: 12 }}>
            <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{key}: </span>
            <span style={{ color: "var(--text-1)" }}>{val}</span>
          </div>
        );
        if (Array.isArray(val) && val.length) return (
          <div key={key} style={{ padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 7 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>{key}</div>
            {val.slice(0, 6).map((item: any, i: number) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-1)", padding: "2px 0" }}>
                {typeof item === "string" ? `• ${item}` :
                 typeof item === "object" && item.keyword ? `• [${item.priority}] ${item.keyword} — ${item.volume_est}` :
                 typeof item === "object" && item.name ? `• ${item.name} — ${item.priority || ""}` :
                 `• ${JSON.stringify(item).slice(0, 100)}`}
              </div>
            ))}
          </div>
        );
        if (typeof val === "object" && val !== null && !Array.isArray(val)) return (
          <div key={key} style={{ padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 7 }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>{key}</div>
            {Object.entries(val).slice(0, 6).map(([k, v]) => (
              <div key={k} style={{ fontSize: 12, color: "var(--text-1)", padding: "2px 0" }}>
                <span style={{ color: "var(--text-3)" }}>{k}: </span>{String(v).slice(0, 80)}
              </div>
            ))}
          </div>
        );
        return null;
      })}
    </div>
  );
}

export default function GrowthPage() {
  const [loading,  setLoading]  = useState<string | null>(null);
  const [results,  setResults]  = useState<Record<string, any>>({});
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [salesReq, setSalesReq] = useState({ name: "Marka Yöneticisi", company: "Hedef Şirket", plan: "starter" });
  const [salesRes, setSalesRes] = useState<any>(null);
  const [salesErr, setSalesErr] = useState("");

  async function run(key: string, endpoint: string) {
    setLoading(key); setErrors((e) => ({ ...e, [key]: "" }));
    try {
      const res = await apiPost(endpoint, {});
      setResults((r) => ({ ...r, [key]: res }));
    } catch (e: any) { setErrors((er) => ({ ...er, [key]: e.message })); }
    finally { setLoading(null); }
  }

  async function runSales() {
    setSalesErr(""); setSalesRes(null);
    try {
      setSalesRes(await apiPost("/agents/sales/draft-message", { prospect_name: salesReq.name, prospect_company: salesReq.company, recommended_plan: salesReq.plan }));
    } catch (e: any) { setSalesErr(e.message); }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin → AI Agents</span>
          <span style={{ color: "var(--text-3)" }}>→</span>
          <span style={{ fontSize: 11, color: "var(--brand-600)", fontWeight: 500 }}>Growth Intelligence</span>
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: "0 0 4px" }}>Growth Intelligence</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: 0 }}>SEO, Ads, Lead ve Sales ajanları. Tüm çıktılar taslak — dış işlem insan onayı gerektirir.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        {SECTIONS.map((s) => (
          <div key={s.key} className="card" style={{ padding: 20, borderLeft: `3px solid ${s.color}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{s.desc}</div>
                </div>
              </div>
              <button onClick={() => run(s.key, s.endpoint)} disabled={loading === s.key}
                style={{ padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: loading === s.key ? "wait" : "pointer", background: s.color, color: "#fff", border: "none", opacity: loading === s.key ? 0.7 : 1 }}>
                {loading === s.key ? "Çalışıyor…" : "▶ Çalıştır"}
              </button>
            </div>
            {errors[s.key] && <div style={{ padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 7, fontSize: 12, marginTop: 10 }}>{errors[s.key]}</div>}
            {results[s.key] && <OutputSection data={results[s.key]} />}
          </div>
        ))}

        {/* Sales Draft */}
        <div className="card" style={{ padding: 20, borderLeft: "3px solid var(--brand-600)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20, color: "var(--brand-600)" }}>◈</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Sales Draft Message</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>Sales Agent — taslak mesaj. Gönderim için admin onayı gerekir.</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 80px", gap: 8, marginBottom: 10 }}>
            <input value={salesReq.name} onChange={(e) => setSalesReq({ ...salesReq, name: e.target.value })} placeholder="Kişi adı" style={{ padding: "8px 12px", borderRadius: 7, fontSize: 12 }} />
            <input value={salesReq.company} onChange={(e) => setSalesReq({ ...salesReq, company: e.target.value })} placeholder="Şirket" style={{ padding: "8px 12px", borderRadius: 7, fontSize: 12 }} />
            <select value={salesReq.plan} onChange={(e) => setSalesReq({ ...salesReq, plan: e.target.value })} style={{ padding: "8px 10px", borderRadius: 7, fontSize: 12 }}>
              <option value="starter">Starter</option><option value="pro">Pro</option><option value="business">Business</option>
            </select>
            <button onClick={runSales} style={{ padding: "8px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "var(--brand-600)", color: "#fff", border: "none" }}>Üret</button>
          </div>
          {salesErr && <div style={{ padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 7, fontSize: 12 }}>{salesErr}</div>}
          {salesRes && <OutputSection data={salesRes} />}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {[{ href: "/admin/agents", label: "AI Agents Center", icon: "⬡" }, { href: "/admin/agents/approvals", label: "Onay Kuyruğu", icon: "!" }, { href: "/admin/agents/conversations", label: "Konuşmalar", icon: "◑" }].map((l) => (
          <Link key={l.href} href={l.href} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, background: "var(--bg-subtle)", border: "1px solid var(--line)", textDecoration: "none", fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>
            <span style={{ color: "var(--brand-600)" }}>{l.icon}</span>{l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
