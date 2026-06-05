"use client";
import { useEffect, useState } from "react";
import { authApi, type User } from "@/lib/api";

const ROLE_CONFIG: Record<string, { label: string; desc: string; color: string }> = {
  owner:   { label: "Owner",   desc: "Tüm ayarlar, fatura, ekip yönetimi", color: "var(--brand-600)" },
  admin:   { label: "Admin",   desc: "Kullanıcı yönetimi, tüm analizler",   color: "var(--green)" },
  analyst: { label: "Analyst", desc: "Analiz yapma, raporları görme",       color: "var(--amber)" },
  viewer:  { label: "Viewer",  desc: "Sadece raporları okuyabilir",          color: "var(--text-3)" },
};

export default function TeamPage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => { authApi.me().then(setUser).catch(() => {}); }, []);

  const currentRole = user?.is_admin ? "admin" : "analyst";
  const planLabel   = user?.plan || "free";
  const isAgency    = ["pro", "business"].includes(planLabel);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>Ekip Yönetimi</h1>
        <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Takım üyelerini ekle ve rol ata.</p>
      </div>

      {/* Current user role */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 16px" }}>Mevcut Rolünüz</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--green-bg)", color: "var(--brand-700)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600 }}>
            {(user?.full_name || user?.email || "?")[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-1)" }}>{user?.full_name || user?.email}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>{user?.email}</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
              background: "var(--green-bg)", color: ROLE_CONFIG[currentRole]?.color }}>
              {user?.is_admin ? "Admin" : "Owner"}
            </span>
          </div>
        </div>
      </div>

      {/* Roles reference */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 16px" }}>Rol Tanımları</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 8 }}>
              <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: `${cfg.color}18`, color: cfg.color, width: 72, textAlign: "center" }}>
                {cfg.label}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>{cfg.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Team invite - placeholder for agency plans */}
      {!isAgency ? (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 10px" }}>Ekip Üyesi Ekle</h2>
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 16 }}>
              Ekip üyesi eklemek için Pro veya Business planı gereklidir.
            </div>
            <a href="/pricing" className="btn btn-primary">Planı Yükselt</a>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 16px" }}>Ekip Üyesi Davet Et</h2>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input placeholder="E-posta adresi" style={{ flex: 1, padding: "10px 14px", borderRadius: 8, fontSize: 14 }} />
            <select style={{ padding: "10px 12px", borderRadius: 8, fontSize: 14 }}>
              <option>Analyst</option>
              <option>Viewer</option>
            </select>
            <button className="btn btn-primary">Davet Gönder</button>
          </div>
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13, fontStyle: "italic" }}>
            Ekip davet sistemi Phase 4'te tamamlanacak. Backend altyapısı hazırlanıyor.
          </div>
        </div>
      )}
    </div>
  );
}
