"use client";
import { useEffect, useState } from "react";
import { watchlistApi, type WatchlistItem } from "@/lib/api";
import Link from "next/link";
import ProfileAvatar from "@/components/ProfileAvatar";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function ListsPage() {
  const [items,    setItems]    = useState<WatchlistItem[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    watchlistApi.list().then((r) => { setItems(r.items); setTotal(r.total); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const remove = async (id: number) => {
    setRemoving(id);
    try { await watchlistApi.remove(id); setItems((p) => p.filter((i) => i.id !== id)); setTotal((t) => t - 1); }
    catch { }
    finally { setRemoving(null); }
  };

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>;

  return (
    <div>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>İzleme Listesi</h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>{total} profil izleniyor</p>
        </div>
        <Link href="/discovery" className="btn btn-secondary">Daha Fazla Keşfet →</Link>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 14px" }}>☆</div>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 8px" }}>Liste boş</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: "0 0 18px" }}>Discovery veya analiz sayfasından "İzlemeye Al" butonunu kullan.</p>
          <Link href="/discovery" className="btn btn-primary">Discovery'ye Git</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <ProfileAvatar src={item.avatar} name={item.display_name || item.username} size={44} platform={item.platform} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>@{item.username}</span>
                    <span className={`badge badge-${item.platform === "instagram" ? "ig" : item.platform === "youtube" ? "yt" : "tt"}`} style={{ fontSize: 10 }}>
                      {item.platform === "instagram" ? "IG" : item.platform === "youtube" ? "YT" : "TT"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{item.category || "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "var(--font-display)",
                    color: item.final_score >= 70 ? "var(--green)" : item.final_score >= 45 ? "var(--amber)" : "var(--red)" }}>
                    {item.final_score}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>Final</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[["Takipçi", fmt(item.followers)], ["Fraud", String(item.fraud_score)], ["Brand", String(item.brand_fit_score)]].map(([l, v]) => (
                  <div key={l} style={{ flex: 1, textAlign: "center", padding: "5px", background: "var(--bg-subtle)", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
              {item.notes && <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, fontStyle: "italic" }}>{item.notes}</div>}
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
                Eklendi: {new Date(item.added_at).toLocaleDateString("tr-TR")}
              </div>
              <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <Link href="/search" style={{ flex: 1, textAlign: "center", padding: "7px", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "var(--brand-600)", color: "#fff", textDecoration: "none" }}>Analiz Et</Link>
                <button onClick={() => remove(item.id)} disabled={removing === item.id} style={{
                  flex: 1, padding: "7px", borderRadius: 7, fontSize: 12, cursor: "pointer",
                  background: "var(--bg-subtle)", color: "var(--red)", border: "1px solid var(--line)", opacity: removing === item.id ? 0.5 : 1,
                }}>{removing === item.id ? "..." : "✕ Çıkar"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
