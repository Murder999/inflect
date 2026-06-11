import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://inflect.io";
const TITLE    = "Inflect — Influencer Intelligence Platform";
const DESC     = "Instagram, TikTok ve YouTube influencer'larını gerçek verilerle analiz et. Fraud tespiti, marka uyum skoru, kampanya bütçe tahmini. Ajanslar ve markalar için tasarlandı.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:       { default: TITLE, template: "%s | Inflect" },
  description: DESC,
  keywords:    ["influencer analizi","influencer marketing","instagram analiz","tiktok analiz","youtube kanal analizi","influencer fraud tespiti","influencer scoring","dijital pazarlama","kampanya yönetimi","marka uyumu"],
  authors:     [{ name: "Inflect", url: SITE_URL }],
  creator:     "Inflect",
  publisher:   "Inflect",
  robots:      { index:true, follow:true, googleBot:{ index:true, follow:true, "max-image-preview":"large", "max-snippet":-1 } },
  openGraph:   { type:"website", locale:"tr_TR", alternateLocale:"en_US", url:SITE_URL, siteName:"Inflect", title:TITLE, description:DESC, images:[{ url:`${SITE_URL}/og.png`, width:1200, height:630, alt:TITLE }] },
  twitter:     { card:"summary_large_image", site:"@inflect_io", title:TITLE, description:DESC, images:[`${SITE_URL}/og.png`] },
  alternates:  { canonical:SITE_URL, languages:{ "tr-TR":SITE_URL, "en-US":`${SITE_URL}/en` } },
  icons:       { icon:[{url:"/favicon.ico"},{url:"/icon.svg",type:"image/svg+xml"}], apple:"/apple-touch-icon.png" },
  manifest:    "/site.webmanifest",
  verification:{ google: process.env.NEXT_PUBLIC_GSV || "" },
};

export const viewport: Viewport = {
  themeColor: [{ media:"(prefers-color-scheme:light)", color:"#F7F7F9" }, { media:"(prefers-color-scheme:dark)", color:"#0C0C0E" }],
  width:"device-width", initialScale:1, maximumScale:5,
};

const ld = {
  "@context":"https://schema.org",
  "@graph":[
    { "@type":"WebSite","@id":`${SITE_URL}/#site`, url:SITE_URL, name:"Inflect", description:DESC,
      potentialAction:{ "@type":"SearchAction", target:{ "@type":"EntryPoint", urlTemplate:`${SITE_URL}/search?q={q}` }, "query-input":"required name=q" } },
    { "@type":"SoftwareApplication", name:"Inflect", applicationCategory:"BusinessApplication", description:DESC, url:SITE_URL,
      offers:{ "@type":"AggregateOffer", lowPrice:"29", highPrice:"199", priceCurrency:"USD", offerCount:"3" },
      operatingSystem:"Web" },
    { "@type":"Organization","@id":`${SITE_URL}/#org`, name:"Inflect", url:SITE_URL,
      logo:{ "@type":"ImageObject", url:`${SITE_URL}/logo.png` },
      sameAs:["https://twitter.com/inflect_io","https://linkedin.com/company/inflect-io"] },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Anti-flash: tema localStorage'dan okunup React hydrate olmadan önce uygulanır */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('inflect-theme');if(t!=='light')document.documentElement.setAttribute('data-theme','dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();` }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            },
          }}
        />
      </body>
    </html>
  );
}
