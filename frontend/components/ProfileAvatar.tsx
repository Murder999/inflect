"use client";
/**
 * ProfileAvatar — Tek yetkili avatar bileşeni.
 * Önce profile_image_url, sonra src dener. İkisi de başarısız olursa
 * platform renginde baş harf fallback gösterir.
 *
 * CDN referrer sorunlarını önlemek için "no-referrer-when-downgrade" kullanır.
 */
import { useState } from "react";

const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  instagram: { bg: "#FDF2F8", color: "#C13584" },
  tiktok:    { bg: "#F0FFF4", color: "#010101" },
  youtube:   { bg: "#FFF5F5", color: "#FF0000" },
  default:   { bg: "var(--green-bg)", color: "var(--brand-700)" },
};

interface ProfileAvatarProps {
  /** Profil görseli URL'si (data_provider'dan gelen `avatar` alanı) */
  src?: string | null;
  /** Normalize edilmiş profil görseli (data_provider'dan gelen `profile_image_url` alanı) */
  profileImageUrl?: string | null;
  /** Fallback için kişi/kanal adı */
  name: string;
  /** Avatar boyutu (px) */
  size?: number;
  /** Platform (renk şeması için) */
  platform?: string;
}

export default function ProfileAvatar({
  src,
  profileImageUrl,
  name,
  size = 40,
  platform,
}: ProfileAvatarProps) {
  // Deneme sırası: profile_image_url → src (avatar) → fallback
  const sources = [profileImageUrl, src].filter(
    (u): u is string => typeof u === "string" && u.trim() !== ""
  );

  const [index,  setIndex]  = useState(0);
  const [failed, setFailed] = useState(false);

  const letter = (name || "?")[0]?.toUpperCase() ?? "?";
  const pKey   = (platform || "default").toLowerCase();
  const theme  = PLATFORM_COLORS[pKey] ?? PLATFORM_COLORS.default;

  // Fallback: baş harf + platform rengi
  const Fallback = (
    <div
      aria-label={name}
      style={{
        width:           size,
        height:          size,
        borderRadius:    "50%",
        background:      theme.bg,
        color:           theme.color,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        fontSize:        size * 0.38,
        fontWeight:      700,
        flexShrink:      0,
        border:          `1.5px solid ${theme.color}22`,
        userSelect:      "none",
      }}
    >
      {letter}
    </div>
  );

  if (failed || sources.length === 0) return Fallback;

  return (
    <img
      src={sources[index]}
      alt={name}
      /* no-referrer-when-downgrade: CDN'lere Referer gönderir (CDN engeli önler) */
      referrerPolicy="no-referrer-when-downgrade"
      onError={() => {
        if (index < sources.length - 1) {
          // Bir sonraki URL'yi dene
          setIndex((i) => i + 1);
        } else {
          // Tüm URL'ler başarısız → fallback'e geç
          setFailed(true);
        }
      }}
      style={{
        width:        size,
        height:       size,
        borderRadius: "50%",
        objectFit:    "cover",
        flexShrink:   0,
        border:       `1.5px solid var(--line)`,
        background:   theme.bg, // görsel yüklenirken arka plan
      }}
    />
  );
}
