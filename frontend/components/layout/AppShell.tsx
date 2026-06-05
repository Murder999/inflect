"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { authApi, alertsApi, type User } from "@/lib/api";

const NAV_MAIN = [
  { href: "/dashboard",  icon: "⬡", label: "Dashboard" },
  { href: "/search",     icon: "◎", label: "Influencer Ara" },
  { href: "/discovery",  icon: "⊛", label: "Discovery" },
  { href: "/lists",      icon: "☆", label: "İzleme Listesi" },
  { href: "/compare",    icon: "⇌", label: "Karşılaştır" },
  { href: "/campaigns",  icon: "◈", label: "Kampanyalar" },
  { href: "/reports",    icon: "◻", label: "Raporlar" },
];
const NAV_ACCOUNT = [
  { href: "/alerts",   icon: "🔔", label: "Uyarılar" },
  { href: "/team",     icon: "👥", label: "Ekip" },
  { href: "/settings", icon: "◇",  label: "Ayarlar" },
];

/** AI Agents alt menüsü — sadece admin kullanıcılara */
const NAV_AGENTS = [
  { href: "/admin/agents",               icon: "⬡",  label: "Center" },
  { href: "/admin/agents/conversations", icon: "◑",  label: "Konuşmalar" },
  { href: "/admin/agents/approvals",     icon: "!",  label: "Onay Kuyruğu" },
  { href: "/admin/agents/tasks",         icon: "◻",  label: "Görevler" },
  { href: "/admin/agents/providers",     icon: "♡",  label: "Providers" },
  { href: "/admin/agents/runs",          icon: "≡",  label: "Run Logs" },
  { href: "/admin/agents/growth",        icon: "↑",  label: "Growth Intel" },  // Part 4
  { href: "/admin/agents/copilot",       icon: "⚡",  label: "Campaign Copilot" }, // Part 2
];

const PLAN_LABEL: Record<string, string> = {
  free: "Ücretsiz", starter: "Starter", pro: "Pro", business: "Business",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [user,          setUser]          = useState<User | null>(null);
  const [alertCount,    setAlertCount]    = useState(0);
  const [criticalAlert, setCriticalAlert] = useState(false);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => {});
    alertsApi.list()
      .then((r) => { setAlertCount(r.total); setCriticalAlert(r.has_critical); })
      .catch(() => {});
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  }, [router]);

  const creditsUsed = user ? user.credits_total - user.credits_remaining : 0;
  const creditsPct  = user ? Math.min((creditsUsed / Math.max(user.credits_total, 1)) * 100, 100) : 0;
  const creditsLow  = user ? user.credits_remaining <= 2 : false;

  const navLink = (
    item: { href: string; icon: string; label: string },
    badge?: number,
    indent = false,
  ) => {
    const exactPaths = ["/admin", "/admin/agents", "/admin/archive"];
    const isExact = exactPaths.includes(item.href);
    const active = isExact
      ? pathname === item.href
      : pathname.startsWith(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        style={{
          display: "flex", alignItems: "center",
          gap: 9, padding: indent ? "6px 10px 6px 22px" : "8px 10px",
          borderRadius: 8, fontSize: indent ? 12 : 14,
          marginBottom: 2, textDecoration: "none",
          fontWeight: active ? 500 : 400,
          background: active ? "var(--green-bg)" : "transparent",
          color: active ? "var(--brand-700)" : indent ? "var(--text-3)" : "var(--text-2)",
        }}
      >
        <span style={{ fontSize: 12, width: 18, textAlign: "center", flexShrink: 0 }}>
          {item.icon}
        </span>
        <span style={{ flex: 1 }}>{item.label}</span>
        {badge ? (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: criticalAlert ? "var(--red)" : "var(--amber)",
            color: "#fff", borderRadius: 99, padding: "1px 6px",
            minWidth: 18, textAlign: "center",
          }}>
            {badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <aside style={{
        width: 224, flexShrink: 0, background: "var(--bg-elevated)",
        borderRight: "1px solid var(--line)",
        display: "flex", flexDirection: "column",
        height: "100vh", position: "sticky", top: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 16px 0", marginBottom: 20 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <span style={{
              width: 30, height: 30, background: "var(--brand-600)", borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 14,
            }}>⬡</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 19, color: "var(--text-1)" }}>
              Inflect
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 8px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", padding: "0 8px", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
            ANA MENÜ
          </div>
          {NAV_MAIN.map((item) => navLink(item))}

          <div style={{ margin: "14px 8px 10px", height: 1, background: "var(--line)" }} />
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", padding: "0 8px", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
            HESAP
          </div>
          {NAV_ACCOUNT.map((item) =>
            navLink(item, item.href === "/alerts" && alertCount > 0 ? alertCount : undefined)
          )}

          {user?.is_admin && (
            <>
              <div style={{ margin: "14px 8px 10px", height: 1, background: "var(--line)" }} />
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", padding: "0 8px", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
                YÖNETİM
              </div>
              {navLink({ href: "/admin",         icon: "△", label: "Admin Panel" })}
              {navLink({ href: "/admin/archive",  icon: "◉", label: "Archive" })}
              {navLink({ href: "/admin/agents",   icon: "⬡", label: "AI Agents" })}
              {NAV_AGENTS.slice(1).map((item) => navLink(item, undefined, true))}
            </>
          )}
        </nav>

        {/* User + Credits + Logout */}
        <div style={{ padding: "0 10px 12px" }}>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 6px" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--green-bg)", color: "var(--brand-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                {(user.full_name || user.email)[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.full_name || user.email}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              </div>
            </div>
          )}
          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-1)" }}>
                {user ? PLAN_LABEL[user.plan] || user.plan : "—"}
              </span>
              <Link href="/pricing" style={{ fontSize: 10, color: "var(--brand-600)", fontWeight: 600, textDecoration: "none", background: "var(--green-bg)", padding: "2px 7px", borderRadius: 99 }}>
                Yükselt
              </Link>
            </div>
            <div className="progress-track" style={{ marginBottom: 5 }}>
              <div className="progress-fill" style={{ width: `${creditsPct}%`, background: creditsLow ? "var(--red)" : "var(--brand-500)" }} />
            </div>
            <span style={{ fontSize: 11, color: creditsLow ? "var(--red)" : "var(--text-3)" }}>
              {user ? `${user.credits_remaining} / ${user.credits_total} kredi` : "—"}
            </span>
          </div>
          <button onClick={logout} style={{ width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 13, background: "transparent", border: "1px solid var(--line)", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            ↩ Çıkış Yap
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
        {children}
      </main>
    </div>
  );
}
