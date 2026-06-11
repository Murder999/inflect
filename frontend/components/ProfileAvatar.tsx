"use client";
import { useState } from "react";

const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  instagram: { bg: "#FDF2F8", color: "#C13584" },
  tiktok:    { bg: "#F0FFF4", color: "#010101" },
  youtube:   { bg: "#FFF5F5", color: "#FF0000" },
  default:   { bg: "var(--green-bg)", color: "var(--brand-700)" },
};

interface ProfileAvatarProps {
  src?: string | null;
  profileImageUrl?: string | null;
  name: string;
  size?: number;
  platform?: string;
  /** Shape: circle (default) | rounded square via explicit px value */
  borderRadius?: number | string;
  /** Show a small platform letter badge in the bottom-right corner */
  showBadge?: boolean;
}

export default function ProfileAvatar({
  src,
  profileImageUrl,
  name,
  size = 40,
  platform,
  borderRadius = "50%",
  showBadge = false,
}: ProfileAvatarProps) {
  const sources = [profileImageUrl, src].filter(
    (u): u is string => typeof u === "string" && u.trim() !== "" && u.startsWith("http")
  );

  const [index,  setIndex]  = useState(0);
  const [failed, setFailed] = useState(false);

  const letter = (name || "?")[0]?.toUpperCase() ?? "?";
  const pKey   = (platform || "default").toLowerCase();
  const theme  = PLATFORM_COLORS[pKey] ?? PLATFORM_COLORS.default;
  const br     = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;

  const badgeLetter = platform ? platform.charAt(0).toUpperCase() : null;

  const avatarStyle: React.CSSProperties = {
    width: size, height: size,
    borderRadius: br,
    objectFit: "cover",
    flexShrink: 0,
    border: "1.5px solid var(--line)",
    background: theme.bg,
    display: "block",
  };

  const content = (failed || sources.length === 0) ? (
    <div style={{
      ...avatarStyle,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: theme.color, fontSize: size * 0.38, fontWeight: 700,
      userSelect: "none",
    }}>
      {letter}
    </div>
  ) : (
    <img
      src={sources[index]}
      alt={name}
      referrerPolicy="no-referrer-when-downgrade"
      onError={() => {
        if (index < sources.length - 1) {
          setIndex((i) => i + 1);
        } else {
          setFailed(true);
        }
      }}
      style={avatarStyle}
    />
  );

  if (!showBadge || !badgeLetter) return content;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {content}
      <div style={{
        position: "absolute", bottom: -3, right: -3,
        width: 16, height: 16,
        borderRadius: 4,
        background: theme.bg, color: theme.color,
        fontSize: 8, fontWeight: 800,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "1.5px solid var(--bg)",
        lineHeight: 1, textTransform: "uppercase",
        pointerEvents: "none",
        userSelect: "none",
      }}>
        {badgeLetter}
      </div>
    </div>
  );
}
