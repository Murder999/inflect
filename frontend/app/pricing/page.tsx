import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fiyatlandırma",
  description: "Inflect influencer analiz fiyatları. Starter $29/ay, Pro $79/ay, Business $199/ay. 14 gün ücretsiz.",
  alternates: { canonical: "/pricing" },
};

const ld = {
  "@context":"https://schema.org","@type":"ItemList",name:"Inflect Pricing",
  itemListElement:[
    {p:1,n:"Starter",price:"29"},{p:2,n:"Pro",price:"79"},{p:3,n:"Business",price:"199"}
  ].map(x=>({ "@type":"ListItem",position:x.p,item:{ "@type":"Product",name:x.n,
    offers:{"@type":"Offer",price:x.price,priceCurrency:"USD",availability:"InStock"} } })),
};

const PLANS = [
  { n:"Ücretsiz", p:"$0",  c:"5 analiz",      desc:"Platformu denemek için",
    f:["5 influencer analizi","IG + TT + YT","Temel fraud skoru","7 gün geçmiş"],
    hot:false, cta:"Ücretsiz Başla", href:"/register" },
  { n:"Starter",  p:"$29", c:"50 analiz/ay",  desc:"Bireysel pazarlamacılar",
    f:["50 analiz/ay","Fraud risk skoru","Marka uyum raporu","30 gün geçmiş","CSV dışa aktarım"],
    hot:false, cta:"Starter'a Geç", href:"/register?plan=starter" },
  { n:"Pro",      p:"$79", c:"200 analiz/ay", desc:"Büyüyen ajanslar",
    f:["200 analiz/ay","Kampanya planlayıcı","Gelişmiş raporlar","PDF indirme","90 gün geçmiş","Öncelikli destek","2 takım üyesi"],
    hot:true,  cta:"Pro'ya Geç",     href:"/register?plan=pro" },
  { n:"Business", p:"$199",c:"1000 analiz/ay",desc:"Büyük markalar & ajanslar",
    f:["1000 analiz/ay","API erişimi","White-label raporlar","5 takım üyesi","Sınırsız geçmiş","Özel hesap yöneticisi","SLA"],
    hot:false, cta:"Satış Ekibi ile Görüş", href:"/contact?plan=business" },
];

const FAQ = [
  {q:"14 gün deneme nasıl çalışır?", a:"Ücretli plana katılırsınız, 14 gün boyunca kart kesimi yapılmaz. İstediğiniz zaman iptal edebilirsiniz."},
  {q:"Aylık kredi bitmesi durumunda ne olur?", a:"Kredi bittiğinde yeni analiz yapılamaz. Planı yükseltebilir ya da sonraki ay resetini bekleyebilirsiniz."},
  {q:"Yıllık ödeme indirimi var mı?", a:"Yıllık abonelikte %20 indirim uygulanır. Kayıt sırasında 'Yıllık' seçeneğini seçebilirsiniz."},
  {q:"API erişimi neden sadece Business planında?", a:"API yüksek hacimli kullanım ve entegrasyon içindir. İhtiyaçlarınız için satış ekibimizle görüşebilirsiniz."},
  {q:"Verilerim güvende mi?", a:"Tüm veriler AES-256 ile şifrelenir. API anahtarları masked olarak saklanır. Güvenlik SOC2 sürecinde."},
];

export default function PricingPage() {
  return (
    <div style={{ background:"var(--bg)",minHeight:"100vh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html:JSON.stringify(ld) }}/>

      {/* Nav */}
      <header style={{ position:"sticky",top:0,zIndex:50,
        background:"rgba(247,247,249,0.82)",backdropFilter:"blur(16px)",
        borderBottom:"1px solid var(--line)",padding:"0 clamp(16px,5vw,72px)" }}>
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

      <div style={{ maxWidth:1200,margin:"0 auto",padding:"80px clamp(16px,5vw,72px)" }}>

        {/* Header */}
        <div style={{ textAlign:"center",marginBottom:64 }}>
          <h1 style={{ fontFamily:"var(--font-display)",fontSize:"clamp(32px,5vw,52px)",fontWeight:400,
            letterSpacing:"-0.02em",color:"var(--text-1)",margin:"0 0 16px" }}>Şeffaf Fiyatlandırma</h1>
          <p style={{ fontSize:18,color:"var(--text-2)",maxWidth:460,margin:"0 auto" }}>
            İhtiyacına göre büyü. 14 gün ücretsiz dene. İstediğin zaman iptal et.
          </p>
        </div>

        {/* Plans */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:20,marginBottom:80,alignItems:"start" }}>
          {PLANS.map(plan=>(
            <div key={plan.n} style={{
              background:"var(--bg-elevated)",
              border:plan.hot?"2px solid var(--brand-500)":"1px solid var(--line)",
              borderRadius:"var(--radius-lg)",padding:28,position:"relative",
              boxShadow:plan.hot?"0 0 0 4px rgba(34,197,94,0.08),var(--shadow)":"var(--shadow-xs)" }}>
              {plan.hot&&(
                <div style={{ position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",
                  background:"var(--brand-600)",color:"#fff",
                  padding:"4px 16px",borderRadius:999,fontSize:11,fontWeight:600,whiteSpace:"nowrap" }}>
                  En Popüler
                </div>
              )}
              <div style={{ marginBottom:22 }}>
                <div style={{ fontSize:18,fontWeight:500,color:"var(--text-1)",marginBottom:6 }}>{plan.n}</div>
                <div style={{ fontSize:12,color:"var(--text-3)",marginBottom:10 }}>{plan.desc}</div>
                <div style={{ display:"flex",alignItems:"baseline",gap:3 }}>
                  <span style={{ fontFamily:"var(--font-display)",fontSize:40,fontWeight:400,color:"var(--text-1)",lineHeight:1 }}>{plan.p}</span>
                  {plan.p!=="$0"&&<span style={{ fontSize:13,color:"var(--text-3)" }}>/ay</span>}
                </div>
                <span className="badge badge-brand" style={{ marginTop:10,display:"inline-flex" }}>{plan.c}</span>
              </div>
              <ul style={{ listStyle:"none",padding:0,margin:"0 0 24px",display:"flex",flexDirection:"column",gap:9 }}>
                {plan.f.map(fi=>(
                  <li key={fi} style={{ display:"flex",gap:8,fontSize:13,color:"var(--text-2)",alignItems:"flex-start" }}>
                    <span style={{ color:"var(--green)",flexShrink:0,marginTop:1 }}>✓</span>{fi}
                  </li>
                ))}
              </ul>
              <Link href={plan.href} className={`btn ${plan.hot?"btn-primary":"btn-secondary"}`}
                style={{ width:"100%",justifyContent:"center" }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ maxWidth:700,margin:"0 auto" }}>
          <h2 style={{ fontFamily:"var(--font-display)",fontSize:"clamp(24px,3vw,36px)",fontWeight:400,
            textAlign:"center",margin:"0 0 40px",color:"var(--text-1)" }}>
            Sık Sorulan Sorular
          </h2>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            {FAQ.map(item=>(
              <div key={item.q} className="card" style={{ padding:20 }}>
                <h3 style={{ fontSize:15,fontWeight:500,color:"var(--text-1)",margin:"0 0 8px" }}>{item.q}</h3>
                <p style={{ fontSize:14,color:"var(--text-2)",margin:0,lineHeight:1.65 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
