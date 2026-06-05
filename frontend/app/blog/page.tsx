import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog — Influencer Marketing İpuçları",
  description: "Influencer marketing stratejileri, fraud tespiti rehberleri ve kampanya optimizasyon ipuçları.",
  alternates: { canonical: "/blog" },
};

const POSTS = [
  { slug:"influencer-fraud-nasil-tespit-edilir", title:"Influencer Fraud Nasıl Tespit Edilir?", desc:"Sahte takipçileri ve yapay etkileşimi tanımanın 7 yolu.", date:"2025-01-15", cat:"Rehber" },
  { slug:"tiktok-engagement-rate-hesaplama", title:"TikTok Engagement Rate Nasıl Hesaplanır?", desc:"Doğru etkileşim oranı hesaplama ve sektör karşılaştırması.", date:"2025-01-10", cat:"Analiz" },
  { slug:"influencer-kampanya-roi-olcme", title:"Influencer Kampanya ROI'sini Ölçme Rehberi", desc:"UTM, kupon kodu ve satış atfı ile gerçek ROI nasıl hesaplanır.", date:"2025-01-05", cat:"Strateji" },
];

export default function BlogPage() {
  return (
    <div style={{ background:"var(--bg)",minHeight:"100vh" }}>
      <header style={{ position:"sticky",top:0,zIndex:50,background:"rgba(247,247,249,0.82)",backdropFilter:"blur(16px)",borderBottom:"1px solid var(--line)",padding:"0 clamp(16px,5vw,72px)" }}>
        <div style={{ maxWidth:1200,margin:"0 auto",height:60,display:"flex",alignItems:"center",gap:32 }}>
          <Link href="/" style={{ display:"flex",alignItems:"center",gap:9,textDecoration:"none" }}>
            <span style={{ width:30,height:30,background:"var(--brand-600)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14 }}>⬡</span>
            <span style={{ fontFamily:"var(--font-display)",fontSize:19,color:"var(--text-1)" }}>Inflect</span>
          </Link>
          <div style={{ marginLeft:"auto",display:"flex",gap:8 }}>
            <Link href="/login" className="btn btn-ghost btn-sm">Giriş Yap</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Ücretsiz Başla</Link>
          </div>
        </div>
      </header>
      <div style={{ maxWidth:860,margin:"0 auto",padding:"72px clamp(16px,5vw,40px)" }}>
        <h1 style={{ fontFamily:"var(--font-display)",fontSize:"clamp(32px,5vw,52px)",fontWeight:400,margin:"0 0 48px",color:"var(--text-1)" }}>Blog</h1>
        <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
          {POSTS.map(post=>(
            <article key={post.slug} className="card" style={{ padding:28 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                <span className="badge badge-brand">{post.cat}</span>
                <time style={{ fontSize:12,color:"var(--text-3)" }} dateTime={post.date}>{post.date}</time>
              </div>
              <h2 style={{ fontSize:20,fontWeight:500,margin:"0 0 10px",color:"var(--text-1)",fontFamily:"var(--font-display)" }}>
                <Link href={`/blog/${post.slug}`} style={{ textDecoration:"none",color:"inherit" }}>{post.title}</Link>
              </h2>
              <p style={{ fontSize:14,color:"var(--text-2)",margin:"0 0 16px",lineHeight:1.65 }}>{post.desc}</p>
              <Link href={`/blog/${post.slug}`} style={{ fontSize:13,color:"var(--brand-600)",fontWeight:500,textDecoration:"none" }}>
                Devamını oku →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
