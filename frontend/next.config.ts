import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // CDN görsellerini Next.js Image component ile kullanabilmek için
  images: {
    remotePatterns: [
      // YouTube kanal avatarları ve video thumbnail’ları
      { protocol: "https", hostname: "yt3.ggpht.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      // Instagram / Facebook CDN (hem eski hem yeni domain'ler)
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.instagram.com" },
      { protocol: "https", hostname: "**.facebook.com" },
      // TikTok / ByteDance CDN
      { protocol: "https", hostname: "**.tiktokcdn.com" },
      { protocol: "https", hostname: "**.tiktokcdn-us.com" },
      { protocol: "https", hostname: "**.tiktokv.com" },
      { protocol: "https", hostname: "**.muscdn.com" },
      { protocol: "https", hostname: "**.bytegoofy.com" },
      { protocol: "https", hostname: "**.byteimg.com" },
      // Apify dataset storage (içerik thumbnail’ları)
      { protocol: "https", hostname: "**.apify.com" },
      { protocol: "https", hostname: "**.apifyusercontent.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",          value: "DENY" },
          { key: "X-XSS-Protection",         value: "1; mode=block" },
          { key: "Referrer-Policy",          value: "no-referrer-when-downgrade" },
        ],
      },
    ];
  },
};

export default nextConfig;
