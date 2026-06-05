import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inflect — Influencer Intelligence Platform",
  description: "Instagram, TikTok ve YouTube influencer'larını gerçek verilerle analiz et. Fraud tespiti, marka uyum skoru ve kampanya bütçe tahmini — tek platformda.",
  alternates: { canonical: "/" },
};

const STATS = [
  { n: "10M+",  l: "Analiz Edilen Profil" },
  { n: "98%",   l: "Fraud Tespit Doğruluğu" },
  { n: "4.2×",  l: "Ortalama Kampanya ROI" },
  { n: "<3sn",  l: "Ortalama Analiz Süresi" },
];

const FEATURES = [
  { icon: "⬡", t: "Gerçek Veri, Sıfır Tahmin",     d: "YouTube Data API v3 ve Apify üzerinden Instagram & TikTok — sahte metrik veya uydurma profil yok. Her sorguda canlı veri." },
  { icon: "◎", t: "Fraud Risk Skoru",               d: "Engagement rate, şüpheli takipçi sinyalleri ve büyüme anomalileri birleşik analiz. Düşük → Kritik arası risk seviyesi." },
  { icon: "◈", t: "Marka Uyum Analizi",             d: "Kategori-marka eşleşmesi, momentum skoru ve final öneri: 'Önerilir / Test et / Önerilmez'. Karar sürecini saniyeye indir." },
  { icon: "△", t: "Kampanya Bütçe Tahmini",         d: "Görüntülenme bazlı CPM hesabı, tahmini reach ve ROI projeksiyonu. Kampanya planlaması artık tahmine değil veriye dayalı." },
  { icon: "◇", t: "Çoklu Platform Desteği",         d: "Instagram, TikTok, YouTube — tek standart skor formatı. Platformlar arası adil karşılaştırma." },
  { icon: "□", t: "Rapor & Dışa Aktarım",           d: "Analiz geçmişi, kampanya raporları, PDF indirme. Ajans müşterileri için white-label hazır." },
];

const TESTIMONIALS = [
  { q: "Bir influencer'ı anlamak için eskiden saatler harcardık. Inflect bunu 3 saniyeye indirdi.", n: "Ayça Kaya", r: "Dijital Ajans Direktörü", a: "AK" },
  { q: "Fraud skoru bizi büyük bir felaket kampanyasından kurtardı. Takipçilerin %73'ü sahteyi gerçek zamanlı gördük.", n: "Burak Şahin", r: "E-Ticaret Marka Yöneticisi", a: "BŞ" },
  { q: "Hız ve doğruluk açısından Inflect piyasada tartışmasız lider. ROI'yi direkt etkiledi.", n: "Merve Tuncel", r: "Growth Lead", a: "MT" },
];

const PLANS = [
  { n: "Starter", p: "$29", c: "50 analiz/ay",   f: ["50 analiz/ay","IG + TT + YT","Fraud skoru","Marka uyum raporu","30 gün geçmiş"], hot: false },
  { n: "Pro",     p: "$79", c: "200 analiz/ay",  f: ["200 analiz/ay","Kampanya planlayıcı","Gelişmiş raporlar","CSV dışa aktarım","90 gün geçmiş","Öncelikli destek"], hot: true },
  { n: "Business",p: "$199",c: "1000 analiz/ay", f: ["1000 analiz/ay","API erişimi","Takım (5 kişi)","White-label rapor","Sınırsız geçmiş","Özel hesap yöneticisi"], hot: false },
];

export default function Home() {
  return (
    <div style={{ background:"var(--bg)", overflowX:"hidden" }}>

      {/* ── TOPBAR ── */}
      <header style={{ position:"sticky", top:0, zIndex:50,
        background:"rgba(247,247,249,0.82)", backdropFilter:"blur(16px) saturate(180%)",
        borderBottom:"1px solid var(--line)", padding:"0 clamp(16px,5vw,72px)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", height:60, display:"flex", alignItems:"center", gap:32 }}>
          <Link href="/" style={{ display:"flex", alignItems:"center", gap:9, textDecoration:"none" }}>
            <span style={{ width:30, height:30, background:"var(--brand-600)", borderRadius:8,
              display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:14 }}>⬡</span>
            <span style={{ fontFamily:"var(--font-display)", fontSize:20, color:"var(--text-1)" }}>Inflect</span>
          </Link>
          <nav style={{ display:"flex", gap:2, marginLeft:"auto" }}>
            {[["Özellikler","#features"],["Fiyatlar","/pricing"],["Blog","/blog"]].map(([l,h])=>(
              <Link key={l} href={h} style={{ padding:"6px 14px", borderRadius:8, fontSize:14,
                color:"var(--text-2)", textDecoration:"none" }}>{l}</Link>
            ))}
          </nav>
          <div style={{ display:"flex", gap:8 }}>
            <Link href="/login" className="btn btn-ghost btn-sm">Giriş Yap</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Ücretsiz Başla</Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{ maxWidth:1200, margin:"0 auto",
        padding:"clamp(72px,12vw,136px) clamp(16px,5vw,72px) 80px", textAlign:"center" }}>

        <div style={{ display:"inline-flex", alignItems:"center", gap:7,
          background:"var(--green-bg)", color:"var(--green)",
          border:"1px solid rgba(34,197,94,0.2)",
          borderRadius:999, padding:"5px 16px", fontSize:12, fontWeight:500, marginBottom:32 }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--brand-500)", flexShrink:0 }}/>
          Gerçek veri · Sıfır tahmin · Gerçek karar
        </div>

        <h1 style={{ fontFamily:"var(--font-display)",
          fontSize:"clamp(44px,7vw,80px)", fontWeight:400, lineHeight:1.06,
          letterSpacing:"-0.03em", color:"var(--text-1)",
          margin:"0 auto 28px", maxWidth:820 }}>
          Doğru influencer'ı{" "}
          <em className="grad-text" style={{ fontStyle:"italic" }}>saniyeler içinde</em>
          {" "}bul.
        </h1>

        <p style={{ fontSize:"clamp(16px,2.2vw,20px)", color:"var(--text-2)",
          maxWidth:580, margin:"0 auto 48px", lineHeight:1.75 }}>
          Instagram, TikTok ve YouTube influencer'larını gerçek verilerle analiz et.
          Fraud riskini gör, marka uyumunu ölç, kampanyaları planla.
        </p>

        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <Link href="/register" className="btn btn-primary btn-lg">
            Ücretsiz Başla <span>→</span>
          </Link>
          <Link href="#features" className="btn btn-secondary btn-lg">
            Özellikleri Gör
          </Link>
        </div>
        <p style={{ fontSize:12, color:"var(--text-3)", marginTop:18 }}>
          Kredi kartı gerekmez · 5 ücretsiz analiz · Hemen başla
        </p>

        {/* Hero visual: mini dashboard mockup */}
        <div style={{ maxWidth:900, margin:"72px auto 0",
          background:"var(--bg-elevated)", border:"1px solid var(--line-strong)",
          borderRadius:"var(--radius-2xl)", overflow:"hidden",
          boxShadow:"0 32px 80px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.06)",
          padding:0 }}>
          {/* Fake browser bar */}
          <div style={{ background:"var(--bg-subtle)", borderBottom:"1px solid var(--line)",
            padding:"10px 18px", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:10, height:10, borderRadius:"50%", background:"#FF5F57" }}/>
            <span style={{ width:10, height:10, borderRadius:"50%", background:"#FEBC2E" }}/>
            <span style={{ width:10, height:10, borderRadius:"50%", background:"#28C840" }}/>
            <div style={{ flex:1, height:26, background:"var(--bg-elevated)",
              borderRadius:6, margin:"0 48px",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:12, color:"var(--text-3)", border:"1px solid var(--line)" }}>
              app.inflect.io/search
            </div>
          </div>
          {/* Dashboard preview */}
          <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", minHeight:320 }}>
            {/* Sidebar */}
            <div style={{ background:"var(--bg-elevated)", borderRight:"1px solid var(--line)", padding:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
                <span style={{ width:24, height:24, background:"var(--brand-600)", borderRadius:6,
                  display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11 }}>⬡</span>
                <span style={{ fontFamily:"var(--font-display)", fontSize:15, color:"var(--text-1)" }}>Inflect</span>
              </div>
              {["⬡ Dashboard","◎ Influencer Ara","⊛ Discovery","◈ Kampanyalar","◻ Raporlar"].map((item, i) => (
                <div key={item} style={{ padding:"7px 10px", borderRadius:8, fontSize:12, marginBottom:2,
                  background: i===1 ? "var(--green-bg)" : "transparent",
                  color: i===1 ? "var(--green)" : "var(--text-3)", fontWeight: i===1 ? 500 : 400 }}>{item}</div>
              ))}
            </div>
            {/* Content */}
            <div style={{ padding:24 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
                {[["247","Toplam Analiz"],["189","Güvenli Profil"],["450","Kalan Kredi"]].map(([v,l])=>(
                  <div key={l} className="card" style={{ padding:"14px 16px" }}>
                    <div style={{ fontSize:11, color:"var(--text-3)", marginBottom:6 }}>{l}</div>
                    <div style={{ fontSize:22, fontWeight:600, color:"var(--text-1)", fontFamily:"var(--font-display)" }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Profile analysis preview */}
              <div className="card" style={{ padding:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--brand-100)",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"var(--brand-700)", fontWeight:600 }}>AY</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"var(--text-1)" }}>Ayşe Yılmaz</div>
                    <div style={{ fontSize:11, color:"var(--text-3)" }}>@ayseyilmaz · 284K takipçi</div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", border:"3px solid var(--green)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:13, fontWeight:600, color:"var(--green)" }}>87</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                  {[["88","Özgünlük"],["18","Fraud"],["74","Momentum"],["91","Marka"]].map(([v,l])=>(
                    <div key={l} style={{ textAlign:"center", padding:"8px 6px", background:"var(--bg-subtle)", borderRadius:8 }}>
                      <div style={{ fontSize:16, fontWeight:600, color:Number(v)>50 && l!=="Fraud" ? "var(--green)" : l==="Fraud" && Number(v)<30 ? "var(--green)" : "var(--amber)" }}>{v}</div>
                      <div style={{ fontSize:10, color:"var(--text-3)" }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ borderTop:"1px solid var(--line)", borderBottom:"1px solid var(--line)", background:"var(--bg-elevated)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto",
          padding:"52px clamp(16px,5vw,72px)",
          display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:32, textAlign:"center" }}>
          {STATS.map(s=>(
            <div key={s.n}>
              <div style={{ fontFamily:"var(--font-display)", fontSize:"clamp(32px,5vw,48px)", fontWeight:400, color:"var(--brand-600)", lineHeight:1 }}>{s.n}</div>
              <div style={{ fontSize:13, color:"var(--text-3)", marginTop:8 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ maxWidth:1200, margin:"0 auto", padding:"96px clamp(16px,5vw,72px)" }}>
        <div style={{ textAlign:"center", marginBottom:64 }}>
          <h2 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(30px,5vw,48px)", fontWeight:400,
            letterSpacing:"-0.02em", margin:"0 0 16px", color:"var(--text-1)" }}>Neden Inflect?</h2>
          <p style={{ fontSize:17, color:"var(--text-2)", maxWidth:480, margin:"0 auto" }}>
            Piyasadaki her araç gerçek veri iddiasında bulunur. Biz kanıtlarız.
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
          {FEATURES.map(f=>(
            <div key={f.t} className="card" style={{ padding:28, transition:"box-shadow 0.2s, transform 0.2s" }}>
              <div style={{ width:46, height:46, borderRadius:14, background:"var(--green-bg)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:20, color:"var(--brand-600)", marginBottom:20 }}>{f.icon}</div>
              <h3 style={{ fontSize:16, fontWeight:500, color:"var(--text-1)", margin:"0 0 10px" }}>{f.t}</h3>
              <p style={{ fontSize:14, color:"var(--text-2)", lineHeight:1.7, margin:0 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ background:"var(--bg-subtle)", borderTop:"1px solid var(--line)", borderBottom:"1px solid var(--line)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"80px clamp(16px,5vw,72px)" }}>
          <h2 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(26px,4vw,40px)", fontWeight:400,
            textAlign:"center", margin:"0 0 52px", letterSpacing:"-0.02em", color:"var(--text-1)" }}>
            Müşterilerimiz ne diyor?
          </h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20 }}>
            {TESTIMONIALS.map(t=>(
              <div key={t.n} className="card" style={{ padding:28 }}>
                <p style={{ fontFamily:"var(--font-display)", fontSize:17, color:"var(--text-1)",
                  lineHeight:1.65, margin:"0 0 24px", fontStyle:"italic" }}>
                  &ldquo;{t.q}&rdquo;
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:38, height:38, borderRadius:"50%", background:"var(--green-bg)",
                    color:"var(--brand-700)", display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:12, fontWeight:600 }}>{t.a}</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:500, color:"var(--text-1)" }}>{t.n}</div>
                    <div style={{ fontSize:12, color:"var(--text-3)" }}>{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={{ maxWidth:1200, margin:"0 auto", padding:"96px clamp(16px,5vw,72px)" }}>
        <div style={{ textAlign:"center", marginBottom:56 }}>
          <h2 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(28px,4vw,44px)", fontWeight:400,
            letterSpacing:"-0.02em", margin:"0 0 14px", color:"var(--text-1)" }}>Şeffaf Fiyatlandırma</h2>
          <p style={{ fontSize:17, color:"var(--text-2)" }}>İhtiyacına göre büyü. İstediğin zaman iptal et.</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:20, alignItems:"start" }}>
          {PLANS.map(plan=>(
            <div key={plan.n} style={{
              background:"var(--bg-elevated)",
              border: plan.hot ? "2px solid var(--brand-500)" : "1px solid var(--line)",
              borderRadius:"var(--radius-lg)", padding:28, position:"relative",
              boxShadow: plan.hot ? "0 0 0 4px rgba(34,197,94,0.08), var(--shadow)" : "var(--shadow-xs)" }}>
              {plan.hot && (
                <div style={{ position:"absolute", top:-13, left:"50%", transform:"translateX(-50%)",
                  background:"var(--brand-600)", color:"#fff",
                  padding:"4px 16px", borderRadius:999, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
                  En Popüler
                </div>
              )}
              <div style={{ marginBottom:22 }}>
                <div style={{ fontSize:20, fontWeight:500, color:"var(--text-1)", marginBottom:4 }}>{plan.n}</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:3 }}>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:40, fontWeight:400, color:"var(--text-1)", lineHeight:1 }}>{plan.p}</span>
                  <span style={{ fontSize:13, color:"var(--text-3)" }}>/ay</span>
                </div>
                <span className="badge badge-brand" style={{ marginTop:10 }}>{plan.c}</span>
              </div>
              <ul style={{ listStyle:"none", padding:0, margin:"0 0 24px", display:"flex", flexDirection:"column", gap:9 }}>
                {plan.f.map(f=>(
                  <li key={f} style={{ display:"flex", gap:9, fontSize:13, color:"var(--text-2)", alignItems:"flex-start" }}>
                    <span style={{ color:"var(--green)", flexShrink:0, marginTop:1 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={`btn ${plan.hot?"btn-primary":"btn-secondary"}`}
                style={{ width:"100%", justifyContent:"center" }}>
                {plan.n === "Business" ? "Satış Ekibi ile Görüş" : "Başla"}
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign:"center", fontSize:13, color:"var(--text-3)", marginTop:28 }}>
          Tüm planlarda 14 gün ücretsiz deneme · Kredi kartı gerekmez
        </p>
      </section>

      {/* ── CTA ── */}
      <section style={{ maxWidth:1200, margin:"0 auto", padding:"0 clamp(16px,5vw,72px) 96px" }}>
        <div style={{ background:"var(--brand-600)", borderRadius:"var(--radius-2xl)",
          padding:"clamp(48px,8vw,80px) clamp(24px,5vw,64px)",
          textAlign:"center", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-60, right:-60, width:240, height:240, borderRadius:"50%",
            background:"rgba(255,255,255,0.05)", pointerEvents:"none" }}/>
          <div style={{ position:"absolute", bottom:-40, left:-40, width:180, height:180, borderRadius:"50%",
            background:"rgba(0,0,0,0.06)", pointerEvents:"none" }}/>
          <h2 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(26px,5vw,48px)", fontWeight:400,
            color:"#fff", margin:"0 0 16px", position:"relative" }}>
            Sonraki kampanyaı veriye dayalı başlat.
          </h2>
          <p style={{ fontSize:17, color:"rgba(255,255,255,0.78)", margin:"0 0 40px", position:"relative" }}>
            5 ücretsiz analiz hakkınla hemen başla.
          </p>
          <Link href="/register" className="btn btn-lg" style={{ background:"#fff", color:"var(--brand-700)", position:"relative" }}>
            Ücretsiz Hesap Oluştur →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop:"1px solid var(--line)", background:"var(--bg-elevated)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"52px clamp(16px,5vw,72px) 32px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:32, marginBottom:48 }}>
            <div>
              <Link href="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none", marginBottom:12 }}>
                <span style={{ width:26,height:26,background:"var(--brand-600)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12 }}>⬡</span>
                <span style={{ fontFamily:"var(--font-display)", fontSize:17, color:"var(--text-1)" }}>Inflect</span>
              </Link>
              <p style={{ fontSize:13,color:"var(--text-3)",lineHeight:1.6 }}>Influencer Intelligence<br/>Gerçek veri, akıllı karar.</p>
            </div>
            {[
              { t:"Ürün",   l:[["Özellikler","#features"],["Fiyatlar","/pricing"],["Demo","/demo"],["Changelog","/changelog"]] },
              { t:"Şirket", l:[["Hakkımızda","/about"],["Blog","/blog"],["Kariyer","/careers"],["İletişim","/contact"]] },
              { t:"Hukuki", l:[["Gizlilik","/privacy"],["Kullanım Koşulları","/terms"],["Cookie","/cookies"]] },
            ].map(col=>(
              <div key={col.t}>
                <div style={{ fontSize:12,fontWeight:600,color:"var(--text-1)",marginBottom:14,textTransform:"uppercase",letterSpacing:"0.06em" }}>{col.t}</div>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {col.l.map(([label,href])=>(
                    <Link key={label} href={href} style={{ fontSize:13,color:"var(--text-3)",textDecoration:"none" }}>{label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop:24,borderTop:"1px solid var(--line)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12 }}>
            <p style={{ fontSize:13,color:"var(--text-3)",margin:0 }}>© 2025 Inflect. Tüm hakları saklıdır.</p>
            <div style={{ display:"flex",gap:16 }}>
              {[["Twitter","https://twitter.com/inflect_io"],["LinkedIn","https://linkedin.com/company/inflect-io"]].map(([l,h])=>(
                <a key={l} href={h} target="_blank" rel="noopener noreferrer" style={{ fontSize:13,color:"var(--text-3)",textDecoration:"none" }}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
