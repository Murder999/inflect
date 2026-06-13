"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { authApi, alertsApi, type User } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LayoutDashboard, Search, Compass, Bookmark, ArrowLeftRight, Zap,
  BarChart2, Bell, Users, Settings, Shield, Database, Cpu,
  LogOut, ChevronRight, MessageSquare, CheckCircle, ListTodo,
  Server, TrendingUp, Bot, GitBranch, Activity, Menu, X,
  Brain, Dna, Swords, ShieldAlert, AlertOctagon, Lock,
} from "lucide-react";

const PLAN_ORDER: Record<string, number> = {
  free: 0, starter: 1, pro: 2, business: 2, agency: 3, enterprise: 4,
};

const NAV_MAIN = [
  { href: "/dashboard",  Icon: LayoutDashboard, label: "Dashboard" },
  { href: "/search",     Icon: Search,          label: "Influencer Ara" },
  { href: "/discovery",  Icon: Compass,         label: "Discovery" },
  { href: "/lists",      Icon: Bookmark,        label: "İzleme Listesi" },
  { href: "/compare",    Icon: ArrowLeftRight,  label: "Karşılaştır" },
  { href: "/campaigns",  Icon: Zap,             label: "Kampanyalar" },
  { href: "/reports",    Icon: BarChart2,       label: "Raporlar" },
];
const NAV_INTELLIGENCE = [
  { href: "/campaigns/simulate",                       Icon: Zap,        label: "Campaign Intelligence", minPlan: "starter"  },
  { href: "/intelligence/brand-match",                 Icon: Brain,      label: "AI Brand Match™",       minPlan: "free"     },
  { href: "/intelligence/digital-twin",                Icon: Dna,        label: "Digital Twin™",         minPlan: "agency"   },
  { href: "/intelligence/competitor-intelligence",     Icon: Swords,     label: "Competitor Intel™",     minPlan: "agency"   },
  { href: "/intelligence/risk-radar",                 Icon: ShieldAlert, label: "Risk Radar™",           minPlan: "pro"      },
];

const NAV_ACCOUNT = [
  { href: "/alerts",   Icon: Bell,     label: "Uyarılar" },
  { href: "/team",     Icon: Users,    label: "Ekip" },
  { href: "/settings", Icon: Settings, label: "Ayarlar" },
];
const NAV_AGENTS = [
  { href: "/admin/agents",               Icon: Bot,          label: "Center" },
  { href: "/admin/agents/conversations", Icon: MessageSquare,label: "Konuşmalar",  indent: true },
  { href: "/admin/agents/approvals",     Icon: CheckCircle,  label: "Onay Kuyruğu",indent: true },
  { href: "/admin/agents/tasks",         Icon: ListTodo,     label: "Görevler",    indent: true },
  { href: "/admin/agents/providers",     Icon: Server,       label: "Providers",   indent: true },
  { href: "/admin/agents/runs",          Icon: Activity,     label: "Run Logs",    indent: true },
  { href: "/admin/agents/growth",        Icon: TrendingUp,   label: "Growth Intel",indent: true },
  { href: "/admin/agents/copilot",       Icon: GitBranch,    label: "Copilot",     indent: true },
];

const PLAN_LABEL: Record<string, string> = {
  free: "Ücretsiz", starter: "Starter", pro: "Pro", business: "Business",
  agency: "Agency", enterprise: "Enterprise",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [user,          setUser]          = useState<User | null>(null);
  const [alertCount,    setAlertCount]    = useState(0);
  const [criticalAlert, setCriticalAlert] = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");

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

  function NavLink({
    href, Icon, label, badge, indent = false, intelligenceBadge, minPlan,
  }: { href: string; Icon: React.FC<{size?: number; strokeWidth?: number}>; label: string; badge?: number; indent?: boolean; intelligenceBadge?: string; minPlan?: string }) {
    const userPlanOrder = PLAN_ORDER[user?.plan ?? "free"] ?? 0;
    const reqPlanOrder  = PLAN_ORDER[minPlan ?? "free"] ?? 0;
    const isLocked      = minPlan && reqPlanOrder > userPlanOrder && !user?.is_admin;
    const exactPaths = ["/admin", "/admin/agents", "/admin/archive"];
    const isExact = exactPaths.includes(href);
    const active  = isExact ? pathname === href : pathname.startsWith(href);

    return (
      <Link
        href={href}
        style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: indent ? "6px 12px 6px 36px" : "7px 12px",
          borderRadius: 8, fontSize: indent ? 12.5 : 13.5,
          marginBottom: 2, textDecoration: "none",
          fontWeight: active ? 500 : 400,
          color: active ? "var(--text-1)" : "var(--text-3)",
          background: active ? "var(--green-bg)" : "transparent",
          boxShadow: active ? "inset 3px 0 0 var(--green)" : "none",
          transition: "all 0.12s",
          position: "relative",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-subtle)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-2)";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-3)";
          }
        }}
      >
        <Icon size={indent ? 13 : 15} strokeWidth={active ? 2.2 : 1.8} />
        {sidebarOpen && (
          <>
            <span style={{ flex: 1 }}>{label}</span>
            {isLocked ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                fontSize: 9, fontWeight: 800,
                background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.2)",
                color: "#6366F1", borderRadius: 99, padding: "1px 6px",
                letterSpacing: "0.04em",
              }}>
                <Lock size={8} />
                {(PLAN_LABEL[minPlan ?? "pro"] ?? minPlan ?? "Pro").toUpperCase()}
              </span>
            ) : intelligenceBadge ? (
              <span style={{ fontSize: 9, fontWeight: 800, background: "linear-gradient(135deg,var(--green),#6366F1)", color: "#fff", borderRadius: 99, padding: "1px 6px", letterSpacing: "0.04em" }}>
                {intelligenceBadge}
              </span>
            ) : null}
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
          </>
        )}
      </Link>
    );
  }

  const sidebarW = sidebarOpen ? 224 : 60;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>

      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header style={{
        height: 56, flexShrink: 0, display: "flex", alignItems: "center",
        background: "var(--bg-elevated)", borderBottom: "1px solid var(--line)",
        padding: "0 20px", gap: 16, zIndex: 100,
      }}>
        {/* Logo + toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: sidebarW - 20, flexShrink: 0, transition: "width 0.2s" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg, var(--brand-500) 0%, var(--brand-700) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 13, fontWeight: 700,
            }}>I</span>
            {sidebarOpen && (
              <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em", fontFamily: "var(--font-display)" }}>
                Inflect
              </span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ marginLeft: "auto", padding: 6, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-3)", display: "flex", alignItems: "center" }}
          >
            <Menu size={15} />
          </button>
        </div>

        {/* Global search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQuery.trim();
            if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
          }}
          style={{ flex: 1, maxWidth: 480 }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--bg-subtle)", borderRadius: 9, padding: "0 14px", height: 36,
            border: "1px solid var(--line)",
          }}>
            <Search size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Influencer ara... (Enter ile git)"
              style={{
                flex: 1, border: "none", background: "transparent", fontSize: 13,
                color: "var(--text-1)", outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const q = searchQuery.trim();
                  if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 0, display: "flex" }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </form>

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Notification bell */}
          <Link href="/alerts" style={{
            width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "1px solid var(--line)",
            color: criticalAlert ? "var(--red)" : alertCount > 0 ? "var(--amber)" : "var(--text-3)",
            textDecoration: "none", position: "relative", transition: "all 0.12s",
          }}>
            <Bell size={15} />
            {alertCount > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                width: 16, height: 16, borderRadius: "50%", fontSize: 9, fontWeight: 700,
                background: criticalAlert ? "var(--red)" : "var(--amber)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid var(--bg-elevated)",
              }}>
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </Link>

          {/* Theme toggle */}
          <ThemeToggle variant="topbar" />

          {/* User avatar */}
          {user && (
            <Link href="/settings" style={{
              display: "flex", alignItems: "center", gap: 9, padding: "5px 10px 5px 5px",
              borderRadius: 9, border: "1px solid var(--line)", textDecoration: "none",
              background: "transparent", transition: "all 0.12s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-subtle)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--brand-500), var(--green))",
                color: "#fff", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {(user.full_name || user.email)[0]?.toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.3 }}>
                  {(user.full_name || user.email).split("@")[0]}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.3 }}>
                  {PLAN_LABEL[user.plan] || user.plan}
                </span>
              </div>
            </Link>
          )}
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <aside style={{
          width: sidebarW, flexShrink: 0,
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--line)",
          display: "flex", flexDirection: "column",
          height: "100%", overflow: "hidden",
          transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          {/* Nav */}
          <nav style={{ flex: 1, padding: "10px 8px 0", overflowY: "auto", overflowX: "hidden" }}>
            {sidebarOpen && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-3)", padding: "0 4px", marginBottom: 4, textTransform: "uppercase" }}>Ana Menü</div>}
            {NAV_MAIN.map((item) => (
              <NavLink key={item.href} href={item.href} Icon={item.Icon} label={item.label} />
            ))}

            <div style={{ margin: "10px 6px 8px", height: 1, background: "var(--line)" }} />
            {sidebarOpen && (
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", padding: "0 4px", marginBottom: 4, textTransform: "uppercase", background: "linear-gradient(90deg,var(--green),#6366F1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Intelligence</div>
            )}
            {NAV_INTELLIGENCE.map((item) => (
              <NavLink key={item.href} href={item.href} Icon={item.Icon} label={item.label} minPlan={item.minPlan} />
            ))}

            <div style={{ margin: "10px 6px 8px", height: 1, background: "var(--line)" }} />
            {sidebarOpen && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-3)", padding: "0 4px", marginBottom: 4, textTransform: "uppercase" }}>Hesap</div>}
            {NAV_ACCOUNT.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                Icon={item.Icon}
                label={item.label}
                badge={item.href === "/alerts" && alertCount > 0 ? alertCount : undefined}
              />
            ))}

            {user?.is_admin && (
              <>
                <div style={{ margin: "10px 6px 8px", height: 1, background: "var(--line)" }} />
                {sidebarOpen && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-3)", padding: "0 4px", marginBottom: 4, textTransform: "uppercase" }}>Yönetim</div>}
                <NavLink href="/admin"                  Icon={Shield}       label="Admin Panel" />
                <NavLink href="/admin/archive"         Icon={Database}     label="Archive" />
                <NavLink href="/admin/intelligence"    Icon={Zap}          label="Intelligence Billing" />
                <NavLink href="/admin/risk-alerts"     Icon={AlertOctagon} label="Risk Alertler" />
                {NAV_AGENTS.map((item) => (
                  <NavLink key={item.href} href={item.href} Icon={item.Icon} label={item.label} indent={item.indent} />
                ))}
              </>
            )}
          </nav>

          {/* Credits + Logout (sidebar footer) */}
          <div style={{ padding: "0 8px 12px", flexShrink: 0 }}>
            {sidebarOpen && user && (
              <div style={{
                background: "var(--bg-subtle)", border: "1px solid var(--line)",
                borderRadius: 10, padding: "12px", marginBottom: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>
                    {PLAN_LABEL[user.plan] || user.plan}
                  </span>
                  <Link href="/pricing" style={{
                    fontSize: 10, color: "var(--green)", fontWeight: 600, textDecoration: "none",
                    background: "var(--green-bg)", padding: "2px 7px", borderRadius: 99,
                  }}>
                    Yükselt
                  </Link>
                </div>
                <div style={{ height: 4, background: "var(--bg-muted)", borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                  <div style={{ height: "100%", width: `${creditsPct}%`, borderRadius: 99, background: creditsLow ? "var(--red)" : "var(--brand-500)", transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: 11, color: creditsLow ? "var(--red)" : "var(--text-3)" }}>
                  {user.credits_remaining} / {user.credits_total} kredi
                </span>
              </div>
            )}
            <button
              onClick={logout}
              style={{
                width: "100%", padding: sidebarOpen ? "7px 0" : "8px 0", borderRadius: 8, fontSize: 13,
                background: "transparent", border: "1px solid var(--line)",
                color: "var(--text-3)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--red-bg)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--red)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
              }}
            >
              <LogOut size={13} />
              {sidebarOpen && <span>Çıkış Yap</span>}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
