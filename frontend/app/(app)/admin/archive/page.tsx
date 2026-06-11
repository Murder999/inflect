"use client";
import { useEffect, useState, useCallback } from "react";
import { archiveApi, type ArchiveProfile } from "@/lib/api";
import ProfileAvatar from "@/components/ProfileAvatar";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 2)   return "Az önce";
  if (mins < 60)  return `${mins}dk önce`;
  if (mins < 1440) return `${Math.floor(mins / 60)}s önce`;
  return `${Math.floor(mins / 1440)}g önce`;
}

function ScorePill({ v, risk }: { v: number | null | undefined; risk?: boolean }) {
  if (v === null || v === undefined) return <span style={{ color: "var(--text-3)", fontSize: 11 }}>—</span>;
  const color = risk
    ? (v < 25 ? "var(--green)" : v < 50 ? "var(--amber)" : "var(--red)")
    : (v >= 70 ? "var(--green)" : v >= 45 ? "var(--amber)" : "var(--red)");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 32, padding: "1px 6px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, background: `${color}1a`, color,
    }}>
      {v}
    </span>
  );
}

const SYNC_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  synced:     { bg: "var(--green-bg)",  color: "var(--green)",        label: "Synced"     },
  pending:    { bg: "var(--amber-bg)",  color: "var(--amber)",        label: "Pending"    },
  needs_sync: { bg: "var(--amber-bg)",  color: "var(--amber)",        label: "Needs Sync" },
  error:      { bg: "var(--red-bg)",    color: "var(--red)",          label: "Error"      },
  failed:     { bg: "var(--red-bg)",    color: "var(--red)",          label: "Failed"     },
};

const PLATFORM_BADGE: Record<string, { bg: string; color: string }> = {
  youtube:   { bg: "#FFF5F5", color: "#FF0000" },
  instagram: { bg: "#FDF2F8", color: "#C13584" },
  tiktok:    { bg: "#F0FFF4", color: "#010101" },
};

// ─── API helpers ─────────────────────────────────────────────────────────────

async function adminPost(path: string, body?: any) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminArchivePage() {
  const [items,    setItems]    = useState<ArchiveProfile[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [seedMsg,  setSeedMsg]  = useState("");
  const [bulkMsg,  setBulkMsg]  = useState("");
  const [err,      setErr]      = useState("");
  const [search,   setSearch]   = useState("");
  const [platform, setPlatform] = useState("all");
  const [offset,   setOffset]   = useState(0);

  // Satır düzeyinde loading state: profileId → "sync"|"analyze"|null
  const [rowLoading, setRowLoading] = useState<Record<number, string>>({});
  const [rowMsg,     setRowMsg]     = useState<Record<number, { ok: boolean; text: string }>>({});

  const [seeding,    setSeeding]    = useState(false);
  const [bulking,    setBulking]    = useState(false);
  const [resolving,  setResolving]  = useState(false);
  const [resolveMsg, setResolveMsg] = useState("");

  // JSON Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing,  setImporting]  = useState(false);
  const [importMsg,  setImportMsg]  = useState<{ ok: boolean; text: string } | null>(null);

  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const res = await archiveApi.list({
        platform: platform !== "all" ? platform : undefined,
        search:   search || undefined,
        limit:    LIMIT,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [platform, search, offset]);

  useEffect(() => { load(); }, [load]);

  // Seed
  async function handleSeed() {
    setSeeding(true); setSeedMsg("");
    try {
      const res = await archiveApi.seed();
      setSeedMsg(
        `Seed tamamlandı: ${res.created_profiles} yeni profil, ` +
        `${res.created_snapshots} snapshot (${res.scanned_analyses} analiz tarandı).`
      );
      load();
    } catch (e: any) {
      setSeedMsg(`Hata: ${e.message}`);
    } finally {
      setSeeding(false);
    }
  }

  // Bulk sync
  async function handleBulkSync() {
    setBulking(true); setBulkMsg("");
    try {
      const res = await adminPost("/archive/sync?limit=5");
      setBulkMsg(
        `Toplu sync: ${res.success}/${res.processed} başarılı. ` +
        (res.failed > 0 ? `${res.failed} başarısız (API key gerekli).` : "")
      );
      load();
    } catch (e: any) {
      setBulkMsg(`Hata: ${e.message}`);
    } finally {
      setBulking(false);
    }
  }

  // JSON Import
  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await archiveApi.importJson(importFile);
      setImportMsg({
        ok: true,
        text: `Import tamamlandı — ${res.created} yeni, ${res.updated} güncellendi, ` +
              `${res.skipped} atlandı${res.errors > 0 ? `, ${res.errors} hata` : ""} (toplam ${res.total})`,
      });
      setImportFile(null);
      load();
    } catch (e: any) {
      setImportMsg({ ok: false, text: `Hata: ${e.message}` });
    } finally {
      setImporting(false);
    }
  }

  // Resolve Avatars
  async function handleResolveAvatars() {
    setResolving(true); setResolveMsg("");
    try {
      const res = await archiveApi.resolveAvatars(50);
      if (res.note) {
        setResolveMsg(res.note);
      } else {
        setResolveMsg(
          `Avatar resolve: ${res.resolved}/${res.processed} başarılı` +
          (res.failed > 0 ? `, ${res.failed} başarısız (API key gerekli)` : "") + "."
        );
      }
      load();
    } catch (e: any) {
      setResolveMsg(`Hata: ${e.message}`);
    } finally {
      setResolving(false);
    }
  }

  // Per-row sync
  async function handleRowSync(id: number) {
    setRowLoading((r) => ({ ...r, [id]: "sync" }));
    setRowMsg((r) => { const n = { ...r }; delete n[id]; return n; });
    try {
      const res = await adminPost(`/archive/sync/${id}`);
      if (res.success) {
        setRowMsg((r) => ({ ...r, [id]: { ok: true, text: `Sync OK — ${fmt(res.followers)} takipçi` } }));
      } else {
        setRowMsg((r) => ({ ...r, [id]: { ok: false, text: res.error || "Sync başarısız" } }));
      }
      load();
    } catch (e: any) {
      setRowMsg((r) => ({ ...r, [id]: { ok: false, text: e.message } }));
    } finally {
      setRowLoading((r) => { const n = { ...r }; delete n[id]; return n; });
    }
  }

  // Per-row analyze
  async function handleRowAnalyze(id: number) {
    setRowLoading((r) => ({ ...r, [id]: "analyze" }));
    setRowMsg((r) => { const n = { ...r }; delete n[id]; return n; });
    try {
      const res = await adminPost(`/archive/analyze/${id}?brand=Genel%20Marka`);
      if (res.success) {
        setRowMsg((r) => ({
          ...r, [id]: {
            ok: true,
            text: `Analiz OK — Skor ${res.final_score}, ${res.decision}`,
          },
        }));
      } else {
        setRowMsg((r) => ({ ...r, [id]: { ok: false, text: res.error || "Analiz başarısız" } }));
      }
      load();
    } catch (e: any) {
      setRowMsg((r) => ({ ...r, [id]: { ok: false, text: e.message } }));
    } finally {
      setRowLoading((r) => { const n = { ...r }; delete n[id]; return n; });
    }
  }

  const totalPages  = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  const msgStyle = (ok: boolean) => ({
    padding: "6px 10px", borderRadius: 7, fontSize: 11,
    background: ok ? "var(--green-bg)" : "var(--red-bg)",
    color: ok ? "var(--green)" : "var(--red)",
    marginTop: 4, display: "block",
  });

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Admin</span>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>›</span>
          <span style={{ fontSize: 11, color: "var(--brand-500)", fontWeight: 600 }}>Archive</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.03em", color: "var(--text-1)" }}>
              Influencer Database
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
              {total > 0 ? `${total} profil` : "Kayıt yok"} — gerçek analizlerden oluşturulur
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleResolveAvatars} disabled={resolving}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: resolving ? "wait" : "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)", opacity: resolving ? 0.7 : 1 }}>
              {resolving ? "Resolving…" : "◉ Resolve Avatars"}
            </button>
            <button onClick={handleBulkSync} disabled={bulking}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: bulking ? "wait" : "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)", opacity: bulking ? 0.7 : 1 }}>
              {bulking ? "Syncing…" : "⟳ Bulk Sync"}
            </button>
            <button onClick={handleSeed} disabled={seeding}
              style={{ padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: seeding ? "wait" : "pointer", background: "var(--brand-600)", color: "#fff", border: "none", opacity: seeding ? 0.7 : 1 }}>
              {seeding ? "Seeding…" : "⊕ Seed"}
            </button>
          </div>
        </div>

        {/* Messages */}
        {seedMsg && (
          <div style={{ marginTop: 8, padding: "7px 12px", borderRadius: 8, fontSize: 12,
            background: seedMsg.startsWith("Hata") ? "var(--red-bg)" : "var(--green-bg)",
            color: seedMsg.startsWith("Hata") ? "var(--red)" : "var(--green)" }}>
            {seedMsg}
          </div>
        )}
        {bulkMsg && (
          <div style={{ marginTop: 8, padding: "7px 12px", borderRadius: 8, fontSize: 12,
            background: bulkMsg.startsWith("Hata") ? "var(--red-bg)" : "var(--green-bg)",
            color: bulkMsg.startsWith("Hata") ? "var(--red)" : "var(--green)" }}>
            {bulkMsg}
          </div>
        )}
        {resolveMsg && (
          <div style={{ marginTop: 8, padding: "7px 12px", borderRadius: 8, fontSize: 12,
            background: resolveMsg.startsWith("Hata") ? "var(--red-bg)" : "var(--green-bg)",
            color: resolveMsg.startsWith("Hata") ? "var(--red)" : "var(--green)" }}>
            {resolveMsg}
          </div>
        )}

        {/* JSON Import */}
        <div style={{
          marginTop: 10, padding: "10px 14px",
          background: "var(--bg-elevated)", border: "1px solid var(--line)",
          borderRadius: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            ⬆ JSON Import
          </span>
          <input
            type="file"
            accept=".json"
            onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportMsg(null); }}
            style={{ fontSize: 11, color: "var(--text-2)", flex: "1 1 180px", maxWidth: 280 }}
          />
          <button
            onClick={handleImport}
            disabled={importing || !importFile}
            style={{
              padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600,
              cursor: importing || !importFile ? "default" : "pointer",
              background: importing || !importFile ? "var(--bg-subtle)" : "var(--brand-600)",
              color: importing || !importFile ? "var(--text-3)" : "#fff",
              border: "none", flexShrink: 0,
              opacity: importing ? 0.7 : 1,
            }}
          >
            {importing ? "Import ediliyor…" : "Import et"}
          </button>
          {importMsg && (
            <span style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 6, flexBasis: "100%",
              background: importMsg.ok ? "var(--green-bg)" : "var(--red-bg)",
              color: importMsg.ok ? "var(--green)" : "var(--red)",
            }}>
              {importMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          placeholder="Kullanıcı adı veya isim ara…"
          style={{ padding: "7px 12px", borderRadius: 8, fontSize: 12, flex: "1 1 200px", border: "1px solid var(--line)", background: "var(--bg-elevated)", color: "var(--text-1)", outline: "none" }}
        />
        <select value={platform} onChange={(e) => { setPlatform(e.target.value); setOffset(0); }}
          style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12, border: "1px solid var(--line)", background: "var(--bg-elevated)", color: "var(--text-1)" }}>
          <option value="all">Tüm platformlar</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
        </select>
      </div>

      {err && (
        <div style={{ padding: "9px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && !err && (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>◉</div>
          <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 0 4px" }}>Archive boş</p>
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 18px" }}>
            Seed butonu ile mevcut analizlerden archive doldurun.
          </p>
          <button onClick={handleSeed} disabled={seeding}
            style={{ padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "var(--brand-600)", color: "#fff", border: "none" }}>
            {seeding ? "Seeding…" : "⊕ Seed Archive"}
          </button>
        </div>
      )}

      {/* Table */}
      {items.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle)" }}>
                  {["Profil", "Platform", "Takipçi", "ER%", "Skor", "Fraud", "Karar", "Sync", "Aksiyonlar"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.04em", textTransform: "uppercase", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const badge  = PLATFORM_BADGE[p.platform] ?? { bg: "var(--bg-subtle)", color: "var(--text-3)" };
                  const status = SYNC_STATUS_STYLE[p.sync_status] ?? SYNC_STATUS_STYLE.pending;
                  const rl     = rowLoading[p.id];
                  const rm     = rowMsg[p.id];

                  return (
                    <>
                      <tr key={p.id} style={{ borderBottom: rm ? "none" : "1px solid var(--line)" }}>
                        {/* Profil */}
                        <td style={{ padding: "9px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <ProfileAvatar src={p.avatar} profileImageUrl={p.profile_image_url}
                              name={p.display_name || p.username} size={32} platform={p.platform} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>
                                {p.display_name || p.username}
                              </div>
                              <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                                @{p.username}{p.category ? ` · ${p.category}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Platform */}
                        <td style={{ padding: "9px 10px" }}>
                          <span style={{ padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: badge.bg, color: badge.color }}>
                            {p.platform}
                          </span>
                        </td>
                        {/* Metrikler */}
                        <td style={{ padding: "9px 10px", fontSize: 12, color: "var(--text-2)" }}>{fmt(p.followers)}</td>
                        <td style={{ padding: "9px 10px", fontSize: 12, color: "var(--text-2)" }}>
                          {p.engagement_rate != null ? `${Number(p.engagement_rate).toFixed(1)}%` : "—"}
                        </td>
                        <td style={{ padding: "9px 10px" }}><ScorePill v={p.final_score} /></td>
                        <td style={{ padding: "9px 10px" }}><ScorePill v={p.fraud_score} risk /></td>
                        <td style={{ padding: "9px 10px", fontSize: 10, color: "var(--text-2)", maxWidth: 110 }}>
                          {p.decision || "—"}
                        </td>
                        {/* Sync durumu */}
                        <td style={{ padding: "9px 10px" }}>
                          <div>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: status.bg, color: status.color }}>
                              {status.label}
                            </span>
                            {p.last_synced_at && (
                              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                                {relTime(p.last_synced_at)}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Aksiyon butonları */}
                        <td style={{ padding: "9px 10px" }}>
                          <div style={{ display: "flex", gap: 5 }}>
                            <button
                              onClick={() => handleRowSync(p.id)}
                              disabled={!!rl}
                              title="Provider'dan metrik güncelle"
                              style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: rl ? "wait" : "pointer", border: "1px solid var(--line)", background: rl === "sync" ? "var(--amber-bg)" : "var(--bg-subtle)", color: rl === "sync" ? "var(--amber)" : "var(--text-2)", opacity: rl && rl !== "sync" ? 0.5 : 1 }}>
                              {rl === "sync" ? "…" : "⟳ Sync"}
                            </button>
                            <button
                              onClick={() => handleRowAnalyze(p.id)}
                              disabled={!!rl}
                              title="Provider + score_engine tam analiz"
                              style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: rl ? "wait" : "pointer", border: "none", background: rl === "analyze" ? "var(--brand-600)" : "var(--green-bg)", color: rl === "analyze" ? "#fff" : "var(--brand-700)", opacity: rl && rl !== "analyze" ? 0.5 : 1 }}>
                              {rl === "analyze" ? "…" : "⚡ Analiz"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Row message */}
                      {rm && (
                        <tr key={`${p.id}-msg`} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td colSpan={9} style={{ padding: "0 10px 8px" }}>
                            <span style={msgStyle(rm.ok)}>{rm.text}</span>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--text-3)" }}>
              <span>Sayfa {currentPage} / {totalPages} ({total} kayıt)</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)", opacity: offset === 0 ? 0.5 : 1 }}>
                  ← Önceki
                </button>
                <button onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= total}
                  style={{ padding: "4px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "var(--bg-subtle)", border: "1px solid var(--line)", color: "var(--text-2)", opacity: offset + LIMIT >= total ? 0.5 : 1 }}>
                  Sonraki →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: 24 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: 44, background: "var(--bg-subtle)", borderRadius: 7, marginBottom: 7, opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      )}

      {/* Provider note */}
      <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--line)", fontSize: 11, color: "var(--text-3)" }}>
        <strong>Sync &amp; Analiz:</strong> Provider API key gerektirir (YOUTUBE_API_KEY / APIFY_TOKEN).
        Key yoksa sync hata döner — mevcut veriler korunur. Yeni skor üretilmez, fake veri yazılmaz.
      </div>
    </div>
  );
}
