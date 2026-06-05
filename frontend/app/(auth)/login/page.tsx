"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { authApi, pingBackend, API_BASE } from "@/lib/api";

type BackendStatus = "checking" | "ok" | "error";

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [pw,       setPw]       = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [status,   setStatus]   = useState<BackendStatus>("checking");

  // Backend erişilebilirlik kontrolü
  useEffect(() => {
    let mounted = true;
    pingBackend().then(ok => { if (mounted) setStatus(ok ? "ok" : "error"); });
    return () => { mounted = false; };
  }, []);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const d = await authApi.login({ email, password: pw });
      localStorage.setItem("access_token",  d.access_token);
      localStorage.setItem("refresh_token", d.refresh_token);
      window.location.href = "/dashboard";
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  const retry = () => {
    setStatus("checking");
    pingBackend().then(ok => setStatus(ok ? "ok" : "error"));
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 20 }}>
            <span style={{ width: 36, height: 36, background: "var(--brand-600)", borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 17 }}>⬡</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-1)" }}>Inflect</span>
          </Link>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, margin: "0 0 6px", color: "var(--text-1)" }}>
            Tekrar hoşgeldiniz
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>Hesabınıza giriş yapın</p>
        </div>

        {/* Backend durumu */}
        {status === "checking" && (
          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--line)", borderRadius: 10,
            padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--text-3)",
            display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
            Sunucu bağlantısı kontrol ediliyor…
          </div>
        )}

        {status === "ok" && (
          <div style={{ background: "var(--green-bg)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10,
            padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "var(--green)" }}>
            ✓ Sunucu bağlantısı aktif
          </div>
        )}

        {status === "error" && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10,
            padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#DC2626", marginBottom: 8 }}>
              ⚠️ Sunucuya ulaşılamıyor
            </div>
            <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.7 }}>
              Backend <code style={{ background: "#fee2e2", padding: "0 3px", borderRadius: 3 }}>{API_BASE}</code> adresinde çalışmıyor.
              <br />
              Çalıştırmak için terminal'de:
            </div>
            <pre style={{ background: "#7F1D1D", color: "#fecaca", padding: "8px 12px", borderRadius: 6,
              fontSize: 12, margin: "8px 0 6px", overflowX: "auto" }}>
{`cd inflect
docker compose down -v
docker compose up --build`}
            </pre>
            <div style={{ fontSize: 11, color: "#991B1B", marginBottom: 8 }}>
              Başladıktan sonra (yaklaşık 30-60 saniye) tekrar deneyin.
            </div>
            <button onClick={retry} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
              background: "#DC2626", color: "#fff", border: "none" }}>
              Tekrar Kontrol Et
            </button>
          </div>
        )}

        {/* Form */}
        <div className="card-raised" style={{ padding: 28 }}>
          {err && (
            <div style={{ background: "var(--red-bg)", border: "1px solid #FECACA", borderRadius: 8,
              padding: "10px 14px", fontSize: 13, color: "var(--red)", marginBottom: 16, lineHeight: 1.5 }}>
              {err}
            </div>
          )}

          <form onSubmit={handle} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>
                E-posta
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="siz@sirket.com" required autoComplete="email"
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", fontSize: 14 }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>
                Şifre
              </label>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)", fontSize: 14 }} />
            </div>

            <button type="submit" disabled={loading || status === "error"} className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", opacity: (loading || status === "error") ? 0.6 : 1 }}>
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </button>

            {status === "error" && (
              <p style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", margin: 0 }}>
                Sunucu bağlantısı olmadan giriş yapılamaz.
              </p>
            )}
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-3)", marginTop: 20 }}>
          Hesabınız yok mu?{" "}
          <Link href="/register" style={{ color: "var(--brand-600)", fontWeight: 500, textDecoration: "none" }}>
            Ücretsiz başlayın
          </Link>
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
