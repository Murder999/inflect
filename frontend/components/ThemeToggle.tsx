"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "inflect-theme";

interface Props {
  variant?: "sidebar" | "topbar";
}

export default function ThemeToggle({ variant = "topbar" }: Props) {
  const [dark,    setDark]    = useState(true); // dark is primary default
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    const isDark = stored !== "light"; // dark unless explicitly set to light
    setDark(isDark);
    if (isDark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem(STORAGE_KEY, "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem(STORAGE_KEY, "light");
    }
  }

  // Hydration guard
  if (!mounted) {
    return (
      <div style={{
        width:  variant === "sidebar" ? "100%" : 72,
        height: variant === "sidebar" ? 36 : 30,
        borderRadius: variant === "sidebar" ? 8 : 999,
        background: "var(--bg-subtle)",
        flexShrink: 0,
      }} />
    );
  }

  if (variant === "sidebar") {
    return (
      <button
        onClick={toggle}
        aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
        style={{
          width: "100%", padding: "7px 0", borderRadius: 8, fontSize: 13,
          background: "transparent", border: "1px solid var(--line)",
          color: "var(--text-3)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, marginBottom: 6, transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-subtle)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)";
        }}
      >
        <span style={{ fontSize: 14 }}>{dark ? "☀" : "☾"}</span>
        <span style={{ fontSize: 12 }}>{dark ? "Açık Tema" : "Koyu Tema"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 12px", borderRadius: 999,
        border: "1px solid var(--line-strong)",
        background: "var(--bg-elevated)",
        color: "var(--text-2)", fontSize: 12, fontWeight: 500,
        cursor: "pointer", flexShrink: 0, transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-subtle)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)";
      }}
    >
      <span style={{ fontSize: 13 }}>{dark ? "☀" : "☾"}</span>
      <span>{dark ? "Açık" : "Koyu"}</span>
    </button>
  );
}
