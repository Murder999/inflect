"use client";
import { useEffect, useState } from "react";
import { alertsApi, type Alert, type AlertsResponse } from "@/lib/api";
import Link from "next/link";

const TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  critical: { color: "var(--red)",      bg: "var(--red-bg)",    border: "#FECACA", icon: "✕" },
  danger:   { color: "var(--red)",      bg: "var(--red-bg)",    border: "#FECACA", icon: "!" },
  warning:  { color: "var(--amber)",    bg: "var(--amber-bg)",  border: "#FDE68A", icon: "⚠" },
  info:     { color: "var(--blue)",     bg: "var(--blue-bg)",   border: "rgba(37,99,235,0.2)", icon: "ℹ" },
};

export default function AlertsPage() {
  const [data,    setData]    = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    alertsApi.list().then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: "var(--text-3)" }}>Yükleniyor...</div>;

  const alerts = data?.alerts || [];

  return (
    <div>
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>
            Alert Center
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
            {data?.total || 0} aktif uyarı
          </p>
        </div>
        <button onClick={() => { setLoading(true); alertsApi.list().then(setData).catch(() => {}).finally(() => setLoading(false)); }}
          className="btn btn-secondary btn-sm">Yenile</button>
      </div>

      {alerts.length === 0 ? (
        <div className="card" style={{ padding: "52px 32px", textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--green-bg)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 14px" }}>✓</div>
          <h2 style={{ fontSize: 17, fontWeight: 500, margin: "0 0 8px", color: "var(--green)" }}>Tüm Sistemler Sağlıklı</h2>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Aktif uyarı yok.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {alerts.map((alert, i) => {
            const cfg = TYPE_CONFIG[alert.type] || TYPE_CONFIG.info;
            return (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px",
                background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: cfg.color, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, fontWeight: 600 }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: cfg.color, marginBottom: 4 }}>{alert.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>{alert.message}</div>
                </div>
                <Link href={alert.action} className="btn btn-sm btn-secondary" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  {alert.action_label}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 24, padding: "12px 16px", background: "var(--bg-subtle)", borderRadius: 8, fontSize: 12, color: "var(--text-3)" }}>
        ℹ️ Uyarılar izleme listenizdeki profillere ve hesap durumunuza göre otomatik üretilir.
        Watchlist'e eklediğiniz profillerle risk değişiklikleri burada görünür.
      </div>
    </div>
  );
}
