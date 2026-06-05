"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { authApi, pingBackend, API_BASE } from "@/lib/api";

export default function RegisterPage() {
  const [f, setF] = useState({
    full_name: "", email: "", phone: "", password: "", company: "",
  });
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState("");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  const set = (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    pingBackend().then(ok => setBackendOk(ok));
  }, []);

  async function handle(ev: React.FormEvent) {
    ev.preventDefault();
    if (f.password.length < 8) {
      setErr("Şifre en az 8 karakter olmalı.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const d = await authApi.register(f);
      localStorage.setItem("access_token",  d.access_token);
      localStorage.setItem("refresh_token", d.refresh_token);
      window.location.href = "/dashboard";
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Kayıt başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg)", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 9,
            textDecoration: "none", marginBottom: 24,
          }}>
            <span style={{
              width: 34, height: 34, background: "var(--brand-600)", borderRadius: 9,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 16,
            }}>⬡</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text-1)" }}>
              Inflect
            </span>
          </Link>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400,
            margin: "0 0 8px", color: "var(--text-1)",
          }}>
            Ücretsiz hesap oluştur
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-3)", margin: 0 }}>
            Kredi kartı gerekmez · 5 ücretsiz analiz
          </p>
        </div>

        {/* Backend durum göstergesi */}
        {backendOk === false && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 10, padding: "12px 16px", marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--red)", marginBottom: 4 }}>
              ⚠️ Sunucuya ulaşılamıyor
            </div>
            <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.6 }}>
              Backend çalışmıyor olabilir. Lütfen kontrol edin:
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                <li>Docker çalışıyor mu? <code>docker compose up</code></li>
                <li>Backend port 8000'de erişilebilir mi?</li>
              </ul>
              <div style={{ marginTop: 6, color: "#991B1B" }}>
                API: <code style={{ fontSize: 11 }}>{API_BASE}</code>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="card-raised" style={{ padding: 28 }}>
          {err && (
            <div style={{
              background: "var(--red-bg)", border: "1px solid #FECACA",
              borderRadius: "var(--radius-sm)", padding: "10px 14px",
              fontSize: 13, color: "var(--red)", marginBottom: 16,
              lineHeight: 1.5,
            }}>
              {err}
              {err.includes("bağlanılamadı") && (
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                  API: <code>{API_BASE}</code>
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={handle}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {([
              { k: "full_name", l: "Ad Soyad",           t: "text",     ph: "Adınız Soyadınız",       req: true  },
              { k: "email",     l: "E-posta",             t: "email",    ph: "siz@sirket.com",         req: true  },
              { k: "phone",     l: "Telefon",             t: "tel",      ph: "+90 5XX XXX XX XX",      req: true  },
              { k: "company",   l: "Şirket",               t: "text",     ph: "Şirket adı",             req: true  },
              { k: "password",  l: "Şifre",               t: "password", ph: "En az 8 karakter",       req: true  },
            ] as const).map(field => (
              <div key={field.k}>
                <label style={{
                  display: "block", fontSize: 13, fontWeight: 500,
                  color: "var(--text-2)", marginBottom: 6,
                }}>
                  {field.l}
                </label>
                <input
                  type={field.t}
                  value={f[field.k as keyof typeof f]}
                  onChange={set(field.k)}
                  placeholder={field.ph}
                  required={field.req}
                  autoComplete={
                    field.k === "email" ? "email"
                    : field.k === "password" ? "new-password"
                    : field.k === "full_name" ? "name"
                    : field.k === "phone" ? "tel"
                    : "organization"
                  }
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "var(--radius)" }}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", marginTop: 6, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Hesap oluşturuluyor..." : "Ücretsiz Hesap Oluştur →"}
            </button>
          </form>

          <p style={{
            fontSize: 11, color: "var(--text-3)", textAlign: "center",
            marginTop: 16, lineHeight: 1.6,
          }}>
            Devam ederek{" "}
            <Link href="/terms" style={{ color: "var(--brand-600)", textDecoration: "none" }}>
              Kullanım Koşulları
            </Link>
            {" "}ve{" "}
            <Link href="/privacy" style={{ color: "var(--brand-600)", textDecoration: "none" }}>
              Gizlilik Politikası
            </Link>
            'nı kabul etmiş olursunuz.
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-3)", marginTop: 20 }}>
          Zaten hesabınız var mı?{" "}
          <Link href="/login" style={{ color: "var(--brand-600)", fontWeight: 500, textDecoration: "none" }}>
            Giriş yapın
          </Link>
        </p>
      </div>
    </div>
  );
}
