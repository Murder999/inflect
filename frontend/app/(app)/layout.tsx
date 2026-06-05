"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authApi } from "@/lib/api";
import type { User } from "@/lib/api";
import AppShell from "@/components/layout/AppShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);

  // İlk yüklemede token doğrula
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    authApi
      .me()
      .then((u: User) => {
        if (pathname?.startsWith("/admin") && !u.is_admin) {
          router.replace("/dashboard");
          return;
        }
        setAuthUser(u);
        setReady(true);
      })
      .catch(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        router.replace("/login");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side navigasyonda admin guard
  useEffect(() => {
    if (!ready || !authUser) return;
    if (pathname?.startsWith("/admin") && !authUser.is_admin) {
      router.replace("/dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⬡</div>
          Yükleniyor...
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
