/**
 * AI Brand Match™ Engine
 *
 * Principles (same as Campaign Intelligence):
 * - No hallucinated Revenue, ROAS, Conversions, or Sales
 * - Every score is derived from real DiscoveryCard data or labeled as estimate
 * - Brand Genome is deterministic and category-driven
 * - Genome Compatibility is a real weighted similarity computation
 * - Confidence is explicit and breakdown is shown
 *
 * Future integration:
 *   Campaign Copilot, Competitor Intelligence, Influencer Genome,
 *   Risk Radar, Predictive Influencer Intelligence
 */

import type { DiscoveryCard } from "@/lib/api";
import { BRAND_TAXONOMY } from "@/lib/simulation-engine";

// ── Exported Types ──────────────────────────────────────────────────────────────

export type MarketTier    = "Luxury" | "Premium" | "Mid-Market" | "Mass Market" | "Value";
export type GeoScope      = "Global" | "Regional" | "Local";
export type BrandMaturity = "Startup" | "Growth" | "Established" | "Legacy";
export type RiskLevel     = "Low" | "Medium" | "High";

export interface BrandProfile {
  name:              string;
  domain:            string;
  industry:          string;
  primaryCategory:   string;
  subcategory:       string;
  positioning:       string;
  maturity:          BrandMaturity;
  geoScope:          GeoScope;
  marketTier:        MarketTier;
  brandPersonality:  string[];
  strategicSummary:  string;
  detectedFrom:      "url_lookup" | "taxonomy" | "domain_extraction";
}

export interface BrandGenome {
  performance:     number;  // Athletic execution, results-orientation
  trust:           number;  // Credibility, safety, expertise signal
  luxury:          number;  // Premium, exclusive, aspirational feel
  innovation:      number;  // Novelty, disruption, cutting-edge
  lifestyle:       number;  // Aspirational everyday identity
  education:       number;  // Knowledge depth, teaching authority
  entertainment:   number;  // Fun, engaging, playful energy
  authority:       number;  // Expert, professional, sector leadership
  community:       number;  // Belonging, tribe, social bonding
  competitiveness: number;  // Winning, high-stakes, achievement
  summary:         string;
  topTraits:       string[];
}

export interface BrandTone {
  primary:   string;
  secondary: string;
  avoid:     string[];
  summary:   string;
}

export interface AudienceProfile {
  primaryAudience:    string;
  secondaryAudience:  string;
  ageDistribution:    { segment: string; pct: number }[];
  genderTendency:     string;
  interestClusters:   string[];
  purchaseIntent:     "Low" | "Medium" | "High";
  platformPriorities: string[];
  marketSegments:     string[];
}

export interface CreatorGenome {
  performance:     number;
  trust:           number;
  luxury:          number;
  innovation:      number;
  lifestyle:       number;
  education:       number;
  entertainment:   number;
  authority:       number;
  community:       number;
  competitiveness: number;
}

export interface MatchScoreBreakdown {
  genomeCompatibility: number;   // 25%
  audienceMatch:       number;   // 20%
  categoryRelevance:   number;   // 20%
  personaMatch:        number;   // 15%
  qualityScore:        number;   // 10%
  trustScore:          number;   // 7%
  countryMatch:        number;   // 3%
  final:               number;   // weighted sum
}

export interface MatchedCreator {
  card:               DiscoveryCard;
  tier:               string;
  persona:            string;
  scores:             MatchScoreBreakdown;
  creatorGenome:      CreatorGenome;
  genomeAlignment:    string;      // Why genomes align
  whySelected:        string;
  riskLevel:          RiskLevel;
  isMismatch:         boolean;
  mismatchReason:     string;
  topMatchReasons:    string[];
}

export interface PortfolioTier {
  label:     string;
  count:     number;
  budgetPct: number;
  rationale: string;
  color:     string;
}

export interface PortfolioResult {
  strategy:     string;
  tiers:        PortfolioTier[];
  strength:     string;
  risks:        string[];
  opportunities:string[];
  diversity:    number;    // 0-100
  efficiency:   number;    // 0-100
}

export interface AudienceOverlapResult {
  estimatedOverlapPct: number;
  saturationRisk:      RiskLevel;
  effectiveReachMultiplier: number;
  warnings:            string[];
}

export interface MismatchWarning {
  creator:     DiscoveryCard;
  reason:      string;
  signals:     string[];
  riskScore:   number;
}

export interface ExpansionOpportunity {
  segment:    string;
  opportunity:string;
  rationale:  string;
  priority:   "High" | "Medium" | "Low";
  creatorType:string;
}

export interface BrandMatchConfidence {
  analysis:  number;
  audience:  number;
  creator:   number;
  genome:    number;
  overall:   number;
  grade:     "A" | "B" | "C" | "D";
  reasons:   string[];
}

export interface BrandWebsiteEvidence {
  url: string;
  fetchStatus: "success" | "failed" | "timeout" | "blocked" | "invalid_url";
  fetchError?: string;
  responseTimeMs?: number;
  pageTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  h1s: string[];
  h2s: string[];
  keywordHints: string[];
  bodySnippets: string[];
  language?: string;
  socialLinks: string[];
  aiProvider?: string;
  aiUsed: boolean;
  aiToneSignals?: string[];
  aiAudienceSignals?: string[];
  aiCategorySignals?: string[];
  aiPositioning?: string;
  aiGenomeDeltaReasoning?: string;
  targetMarket?: string;
}

export interface GenomeDimensionScore {
  value:      number;
  basis:      "Website Evidence" | "AI Interpretation" | "Known Brand Profile" | "Taxonomy Fallback" | "Unavailable";
  reason:     string;
  confidence: "High" | "Medium" | "Low";
}

export interface EvidenceGenome {
  performance:     GenomeDimensionScore;
  trust:           GenomeDimensionScore;
  luxury:          GenomeDimensionScore;
  innovation:      GenomeDimensionScore;
  lifestyle:       GenomeDimensionScore;
  education:       GenomeDimensionScore;
  entertainment:   GenomeDimensionScore;
  authority:       GenomeDimensionScore;
  community:       GenomeDimensionScore;
  competitiveness: GenomeDimensionScore;
  topTraits:       string[];
  summary:         string;
  overallEvidenceStrength: number;
}

export interface CreatorCoverage {
  total:                  number;
  withCountry:            number;
  withCategory:           number;
  withEngagementData:     number;
  withFraudData:          number;
  highConfidenceForMatch: number;
  coverageScore:          number;
  coverageNote:           string;
  limitation?:            string;
}

export interface BrandMatchResult {
  brand:           BrandProfile;
  genome:          BrandGenome;
  tone:            BrandTone;
  audience:        AudienceProfile;
  creators:        MatchedCreator[];
  portfolio:       PortfolioResult;
  overlap:         AudienceOverlapResult;
  mismatches:      MismatchWarning[];
  expansions:      ExpansionOpportunity[];
  confidence:      BrandMatchConfidence;
  insights:        string[];
  risks:           string[];
  opportunities:   string[];
  nextActions:     string[];
  summary:         string;
  dataSourceNotes: string[];
  analyzedUrl:     string;
  creatorsFromDB:  number;
  websiteEvidence?: BrandWebsiteEvidence;
  evidenceGenome:  EvidenceGenome;
  creatorCoverage: CreatorCoverage;
  targetMarket:    string;
  competitorUrl?:  string;
}

// ── URL → Brand Lookup ──────────────────────────────────────────────────────────

const URL_BRAND_MAP: Record<string, string> = {
  "nike":           "Nike",
  "adidas":         "Adidas",
  "puma":           "Puma",
  "newbalance":     "New Balance",
  "underarmour":    "Under Armour",
  "gymshark":       "Gymshark",
  "lululemon":      "Lululemon",
  "asics":          "Asics",
  "reebok":         "Reebok",
  "myprotein":      "MyProtein",
  "optimumnutrition": "Optimum Nutrition",
  "herbalife":      "Herbalife",
  "loreal":         "L'Oréal",
  "lorealparisusa": "L'Oréal Paris",
  "maybelline":     "Maybelline",
  "maccosmetics":   "MAC Cosmetics",
  "charlottetilbury":"Charlotte Tilbury",
  "hudabeauty":     "Huda Beauty",
  "cerave":         "CeraVe",
  "theordinary":    "The Ordinary",
  "larochposay":    "La Roche-Posay",
  "neutrogena":     "Neutrogena",
  "samsung":        "Samsung",
  "apple":          "Apple",
  "xiaomi":         "Xiaomi",
  "sony":           "Sony",
  "lenovo":         "Lenovo",
  "asus":           "Asus",
  "razer":          "Razer",
  "logitech":       "Logitech",
  "zara":           "Zara",
  "hm":             "H&M",
  "uniqlo":         "Uniqlo",
  "mango":          "Mango",
  "massimdutti":    "Massimo Dutti",
  "dior":           "Dior",
  "chanel":         "Chanel",
  "gucci":          "Gucci",
  "louisvuitton":   "Louis Vuitton",
  "playstation":    "PlayStation",
  "xbox":           "Xbox",
  "nintendo":       "Nintendo",
  "turkishairlines":"Turkish Airlines",
  "pegasus":        "Pegasus",
  "booking":        "Booking.com",
  "airbnb":         "Airbnb",
  "nestle":         "Nestlé",
  "cocacola":       "Coca-Cola",
  "pepsi":          "Pepsi",
  "redbull":        "Red Bull",
  "monster":        "Monster Energy",
  "mcdonalds":      "McDonald's",
  "starbucks":      "Starbucks",
  "ikea":           "IKEA",
  "dyson":          "Dyson",
};

function normalizeDomain(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(".")[0]
    .replace(/[^a-z0-9]/g, "");
}

function extractBrandName(url: string): { name: string; domain: string; method: BrandProfile["detectedFrom"] } {
  const full = url.trim().toLowerCase();
  const domain = full
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  const key = normalizeDomain(url);

  // 1. Direct URL map
  if (URL_BRAND_MAP[key]) return { name: URL_BRAND_MAP[key], domain, method: "url_lookup" };

  // 2. BRAND_TAXONOMY fuzzy match on brand name
  const lower = key.toLowerCase();
  const match = BRAND_TAXONOMY.find(b => {
    const bn = b.brand.toLowerCase().replace(/[^a-z0-9]/g, "");
    return bn.startsWith(lower) || lower.startsWith(bn.slice(0, 4));
  });
  if (match) return { name: match.brand, domain, method: "taxonomy" };

  // 3. Capitalize the domain segment
  const clean = key.charAt(0).toUpperCase() + key.slice(1);
  return { name: clean, domain, method: "domain_extraction" };
}

// ── Brand Genome Profiles (per category) ───────────────────────────────────────

interface GenomeTemplate {
  performance: number; trust: number; luxury: number; innovation: number;
  lifestyle: number; education: number; entertainment: number; authority: number;
  community: number; competitiveness: number;
}

const CATEGORY_GENOME: Record<string, GenomeTemplate> = {
  "Spor & Moda":       { performance:90, trust:72, luxury:22, innovation:55, lifestyle:78, education:30, entertainment:52, authority:65, community:62, competitiveness:82 },
  "Spor & Fitness":    { performance:88, trust:74, luxury:18, innovation:52, lifestyle:72, education:55, entertainment:48, authority:68, community:60, competitiveness:80 },
  "Spor & Outdoor":    { performance:85, trust:70, luxury:25, innovation:48, lifestyle:70, education:42, entertainment:55, authority:62, community:65, competitiveness:72 },
  "Fitness & Sağlık":  { performance:92, trust:78, luxury:15, innovation:50, lifestyle:68, education:68, entertainment:42, authority:72, community:65, competitiveness:75 },
  "Sağlık & Beslenme": { performance:75, trust:82, luxury:18, innovation:52, lifestyle:62, education:78, entertainment:38, authority:75, community:60, competitiveness:55 },
  "Güzellik & Bakım":  { performance:28, trust:65, luxury:58, innovation:55, lifestyle:88, education:62, entertainment:58, authority:58, community:75, competitiveness:38 },
  "Teknoloji":         { performance:68, trust:72, luxury:32, innovation:92, lifestyle:52, education:72, entertainment:55, authority:82, community:48, competitiveness:65 },
  "Moda & Giyim":      { performance:32, trust:52, luxury:58, innovation:58, lifestyle:92, education:38, entertainment:65, authority:48, community:72, competitiveness:42 },
  "Lüks Moda":         { performance:35, trust:72, luxury:96, innovation:62, lifestyle:88, education:40, entertainment:48, authority:82, community:52, competitiveness:45 },
  "Oyun & Eğlence":    { performance:68, trust:58, luxury:12, innovation:72, lifestyle:62, education:52, entertainment:96, authority:52, community:88, competitiveness:82 },
  "Seyahat & Turizm":  { performance:42, trust:68, luxury:52, innovation:45, lifestyle:88, education:55, entertainment:75, authority:52, community:72, competitiveness:38 },
  "Ev & Dekorasyon":   { performance:32, trust:68, luxury:48, innovation:45, lifestyle:82, education:65, entertainment:55, authority:58, community:72, competitiveness:28 },
  "Gıda & İçecek":     { performance:38, trust:68, luxury:38, innovation:50, lifestyle:75, education:60, entertainment:68, authority:52, community:82, competitiveness:42 },
};

function getCategoryGenome(cat: string): GenomeTemplate {
  const entry = Object.entries(CATEGORY_GENOME).find(([k]) =>
    cat.toLowerCase().includes(k.toLowerCase().split(" ")[0])
  );
  return entry
    ? entry[1]
    : { performance:55, trust:60, luxury:40, innovation:55, lifestyle:65, education:50, entertainment:55, authority:55, community:60, competitiveness:50 };
}

// ── Brand Intelligence Analysis ─────────────────────────────────────────────────

interface BrandKnowledge {
  positioning: string;
  maturity: BrandMaturity;
  geoScope: GeoScope;
  marketTier: MarketTier;
  personality: string[];
}

const BRAND_KNOWLEDGE: Record<string, BrandKnowledge> = {
  "Nike":             { positioning: "Premium Performance Sportswear",       maturity: "Legacy",      geoScope: "Global",   marketTier: "Premium",     personality: ["Ambitious", "Motivational", "Competitive", "Authentic"] },
  "Adidas":           { positioning: "Heritage & Contemporary Performance",   maturity: "Legacy",      geoScope: "Global",   marketTier: "Premium",     personality: ["Creative", "Inclusive", "Urban", "Collaborative"] },
  "Gymshark":         { positioning: "Community-First Fitness Apparel",       maturity: "Growth",      geoScope: "Global",   marketTier: "Mid-Market",  personality: ["Community", "Aspirational", "Energetic", "Authentic"] },
  "Lululemon":        { positioning: "Premium Mindful Athletic Wear",         maturity: "Established", geoScope: "Global",   marketTier: "Premium",     personality: ["Mindful", "Premium", "Community", "Wellness"] },
  "MyProtein":        { positioning: "Science-Backed Sports Nutrition",       maturity: "Established", geoScope: "Global",   marketTier: "Mid-Market",  personality: ["Scientific", "Trusted", "Performance", "Value"] },
  "Samsung":          { positioning: "Global Consumer Electronics Leader",    maturity: "Legacy",      geoScope: "Global",   marketTier: "Mid-Market",  personality: ["Innovative", "Reliable", "Premium", "Accessible"] },
  "Apple":            { positioning: "Premium Technology Ecosystem",          maturity: "Legacy",      geoScope: "Global",   marketTier: "Premium",     personality: ["Minimalist", "Premium", "Innovative", "Aspirational"] },
  "Zara":             { positioning: "Fast Fashion Trend Leader",             maturity: "Legacy",      geoScope: "Global",   marketTier: "Mid-Market",  personality: ["Trendy", "Fast", "Sophisticated", "Accessible"] },
  "H&M":              { positioning: "Affordable Fashion for Everyone",       maturity: "Legacy",      geoScope: "Global",   marketTier: "Mass Market", personality: ["Inclusive", "Sustainable", "Trendy", "Accessible"] },
  "CeraVe":           { positioning: "Dermatologist-Recommended Skincare",    maturity: "Established", geoScope: "Global",   marketTier: "Mid-Market",  personality: ["Trusted", "Scientific", "Gentle", "Accessible"] },
  "The Ordinary":     { positioning: "Democratizing Clinical Skincare",       maturity: "Established", geoScope: "Global",   marketTier: "Value",       personality: ["Transparent", "Scientific", "Accessible", "Honest"] },
  "Dior":             { positioning: "Maison de Couture & Luxury Beauty",     maturity: "Legacy",      geoScope: "Global",   marketTier: "Luxury",      personality: ["Luxurious", "Elegant", "Heritage", "Aspirational"] },
  "Red Bull":         { positioning: "Energy & Extreme Sports Lifestyle",     maturity: "Established", geoScope: "Global",   marketTier: "Mid-Market",  personality: ["Extreme", "Fearless", "Energetic", "Adventurous"] },
  "PlayStation":      { positioning: "Premium Gaming Ecosystem",              maturity: "Established", geoScope: "Global",   marketTier: "Premium",     personality: ["Passionate", "Immersive", "Community", "Competitive"] },
  "Turkish Airlines": { positioning: "Premium Full-Service Airline",          maturity: "Established", geoScope: "Regional", marketTier: "Premium",     personality: ["Reliable", "Cultural", "Global", "Welcoming"] },
};

function lookupBrandKnowledge(name: string): BrandKnowledge | null {
  const key = Object.keys(BRAND_KNOWLEDGE).find(k =>
    name.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(name.toLowerCase())
  );
  return key ? BRAND_KNOWLEDGE[key] : null;
}

export function analyzeBrand(url: string): { profile: BrandProfile; genome: BrandGenome; tone: BrandTone; audience: AudienceProfile } {
  const { name, domain, method } = extractBrandName(url);

  // Find category from taxonomy
  const taxEntry = BRAND_TAXONOMY.find(b =>
    b.brand.toLowerCase() === name.toLowerCase() ||
    name.toLowerCase().includes(b.brand.toLowerCase())
  );
  const primaryCategory = taxEntry?.category || "Marka & Ürün";
  const subcategory     = taxEntry?.sub        || "";

  // Brand knowledge lookup
  const knowledge = lookupBrandKnowledge(name);

  const profile: BrandProfile = {
    name,
    domain,
    industry:         getCategoryIndustry(primaryCategory),
    primaryCategory,
    subcategory,
    positioning:      knowledge?.positioning  || `${name} — ${primaryCategory} markası`,
    maturity:         knowledge?.maturity     || "Established",
    geoScope:         knowledge?.geoScope     || "Regional",
    marketTier:       knowledge?.marketTier   || "Mid-Market",
    brandPersonality: knowledge?.personality  || ["Güvenilir", "Erişilebilir", "Kaliteli"],
    strategicSummary: buildStrategicSummary(name, primaryCategory, knowledge),
    detectedFrom:     method,
  };

  const genomeTemplate = getCategoryGenome(primaryCategory);
  // Adjust genome for market tier
  const luxAdj = profile.marketTier === "Luxury" ? 20 : profile.marketTier === "Value" ? -15 : 0;
  const genome: BrandGenome = {
    ...genomeTemplate,
    luxury:   Math.min(100, Math.max(0, genomeTemplate.luxury + luxAdj)),
    trust:    Math.min(100, Math.max(0, genomeTemplate.trust   + (profile.maturity === "Legacy" ? 10 : 0))),
    innovation: Math.min(100, Math.max(0, genomeTemplate.innovation + (profile.maturity === "Startup" ? 15 : 0))),
    summary:    buildGenomeSummary(name, genomeTemplate),
    topTraits:  getTopGenomeTraits(genomeTemplate),
  };

  const tone = buildTone(profile);
  const audience = buildAudience(profile);

  return { profile, genome, tone, audience };
}

function getCategoryIndustry(cat: string): string {
  if (cat.includes("Spor") || cat.includes("Fitness"))  return "Sportswear & Athletic";
  if (cat.includes("Güzellik") || cat.includes("Cilt"))  return "Beauty & Personal Care";
  if (cat.includes("Teknoloji"))                          return "Consumer Electronics";
  if (cat.includes("Moda") || cat.includes("Giyim"))     return "Fashion & Apparel";
  if (cat.includes("Lüks"))                               return "Luxury Goods";
  if (cat.includes("Oyun") || cat.includes("Eğlence"))   return "Gaming & Entertainment";
  if (cat.includes("Seyahat"))                            return "Travel & Tourism";
  if (cat.includes("Gıda") || cat.includes("İçecek"))    return "Food & Beverage";
  if (cat.includes("Ev"))                                 return "Home & Living";
  if (cat.includes("Sağlık"))                             return "Health & Wellness";
  return "Consumer Goods";
}

function buildStrategicSummary(name: string, cat: string, k: BrandKnowledge | null): string {
  if (k) return `${name}, ${k.positioning.toLowerCase()} alanında ${k.geoScope === "Global" ? "küresel" : "bölgesel"} bir marka olarak ${k.maturity === "Legacy" ? "onlarca yıllık" : k.maturity === "Growth" ? "hızla büyüyen"  : "köklü"} bir konuma sahiptir. ${k.marketTier === "Luxury" ? "Lüks segment" : k.marketTier === "Premium" ? "Premium segment" : k.marketTier === "Mass Market" ? "Kitlesel pazar" : "Orta segment"} stratejisiyle ${cat} kategorisinde güçlü bir creator ortaklık fırsatı sunmaktadır.`;
  return `${name}, ${cat} kategorisinde faaliyet gösteren bir markadır. Creator pazarlama stratejisi kategori uzmanlığına ve kitleyle özgünlüğe dayanmalıdır.`;
}

function buildGenomeSummary(name: string, g: GenomeTemplate): string {
  const top = getTopGenomeTraits(g).slice(0, 3).join(", ").toLowerCase();
  return `${name}'ın marka DNA'sı en güçlü şekilde ${top} boyutlarında öne çıkmaktadır. Bu boyutlar, creator seçiminde öncelikli uyum kriterleri olarak kullanılmalıdır.`;
}

function getTopGenomeTraits(g: GenomeTemplate): string[] {
  const labels: Record<keyof GenomeTemplate, string> = {
    performance: "Performans", trust: "Güven", luxury: "Lüks",
    innovation: "İnovasyon", lifestyle: "Yaşam Tarzı", education: "Eğitim",
    entertainment: "Eğlence", authority: "Otorite", community: "Topluluk", competitiveness: "Rekabetçilik",
  };
  return (Object.entries(g) as [keyof GenomeTemplate, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => labels[k]);
}

function buildTone(profile: BrandProfile): BrandTone {
  const tier = profile.marketTier;
  const cat  = profile.primaryCategory;
  let primary   = "Professional";
  let secondary = "Motivational";
  let avoid:    string[] = [];

  if (tier === "Luxury")       { primary = "Luxury";       secondary = "Authority";   avoid = ["Playful", "Casual", "Discount-focused"]; }
  else if (tier === "Premium") { primary = "Professional"; secondary = "Aspirational"; avoid = ["Cheap", "Overly-casual"]; }
  else if (tier === "Value")   { primary = "Educational";  secondary = "Accessible";  avoid = ["Elitist", "Complex"]; }
  else if (cat.includes("Oyun") || cat.includes("Eğlence")) { primary = "Energetic"; secondary = "Community-driven"; avoid = ["Corporate", "Boring"]; }
  else if (cat.includes("Fitness") || cat.includes("Spor")) { primary = "Motivational"; secondary = "Competitive";   avoid = ["Passive", "Negative"]; }
  else if (cat.includes("Güzellik") || cat.includes("Cilt")) { primary = "Educational"; secondary = "Empowering"; avoid = ["Judgmental", "Unrealistic"]; }

  const summaryMap: Record<string, string> = {
    "Luxury":       `${profile.name} markasının sesi zarif, otoriter ve aspirasyonel olmalıdır. Creator içerikleri marka estetiğine uygun, yüksek prodüksiyon kalitesiyle üretilmelidir.`,
    "Motivational": `${profile.name} içerikleri enerji, başarı ve dönüşümü ön plana çıkarmalıdır. Creator sesi motive edici ve özgün olmalıdır.`,
    "Educational":  `${profile.name} için bilgi paylaşımı ve şeffaflık creator ortaklığının temeli olmalıdır. Güven, satıştan önce gelir.`,
    "Energetic":    `${profile.name} içerikleri dinamik, eğlenceli ve topluluk odaklı olmalıdır. Creator enerjisi marka kimliğini yansıtmalıdır.`,
    "Professional": `${profile.name} için creator ortaklıkları marka değerini korumalı ve yüksek güven sinyali vermelidir.`,
  };

  return {
    primary,
    secondary,
    avoid,
    summary: summaryMap[primary] || `${profile.name} için creator sesi ${primary.toLowerCase()} ve ${secondary.toLowerCase()} bir yapıda olmalıdır.`,
  };
}

function buildAudience(profile: BrandProfile): AudienceProfile {
  const cat = profile.primaryCategory;

  if (cat.includes("Spor") && cat.includes("Moda")) {
    return { primaryAudience: "18–35 Spor ve Aktif Yaşam Tüketicileri", secondaryAudience: "Fitness Meraklıları & Casual Sporcular", ageDistribution: [{ segment: "18–24", pct: 35 }, { segment: "25–34", pct: 40 }, { segment: "35–44", pct: 18 }, { segment: "45+", pct: 7 }], genderTendency: "Mix", interestClusters: ["Fitness", "Koşu", "Spor Salonu", "Outdoor", "Sağlıklı Yaşam"], purchaseIntent: "High", platformPriorities: ["Instagram", "TikTok", "YouTube"], marketSegments: ["Aktif Yaşam", "Performans Spor", "Casual Fitness"] };
  }
  if (cat.includes("Fitness") || cat.includes("Sağlık")) {
    return { primaryAudience: "18–35 Fitness & Sağlık Meraklıları", secondaryAudience: "Profesyonel Sporcular & Aktif Yetişkinler", ageDistribution: [{ segment: "18–24", pct: 30 }, { segment: "25–34", pct: 42 }, { segment: "35–44", pct: 20 }, { segment: "45+", pct: 8 }], genderTendency: "Mix (Erkek Ağırlıklı)", interestClusters: ["Supplement", "Antrenman", "Beslenme", "Vücut Geliştirme", "Sağlıklı Yaşam"], purchaseIntent: "High", platformPriorities: ["Instagram", "YouTube", "TikTok"], marketSegments: ["Supplement Kullanıcıları", "Gym Üyeleri", "Spor Beslenmesi"] };
  }
  if (cat.includes("Güzellik") || cat.includes("Cilt")) {
    return { primaryAudience: "18–40 Güzellik & Bakım Tüketicileri", secondaryAudience: "Profesyonel Makyaj Kullanıcıları & Skincare Meraklıları", ageDistribution: [{ segment: "18–24", pct: 38 }, { segment: "25–34", pct: 35 }, { segment: "35–44", pct: 18 }, { segment: "45+", pct: 9 }], genderTendency: "Kadın Ağırlıklı", interestClusters: ["Makyaj", "Cilt Bakımı", "Güzellik Rutini", "Trend", "K-Beauty"], purchaseIntent: "High", platformPriorities: ["TikTok", "Instagram", "YouTube"], marketSegments: ["Günlük Makyaj", "Skincare Routiners", "Beauty Educators"] };
  }
  if (cat.includes("Teknoloji")) {
    return { primaryAudience: "18–40 Teknoloji Meraklıları & Early Adopters", secondaryAudience: "Profesyoneller & Öğrenciler", ageDistribution: [{ segment: "18–24", pct: 28 }, { segment: "25–34", pct: 40 }, { segment: "35–44", pct: 22 }, { segment: "45+", pct: 10 }], genderTendency: "Erkek Ağırlıklı", interestClusters: ["Teknoloji", "Gadget", "Yazılım", "Oyun", "Üretkenlik"], purchaseIntent: "Medium", platformPriorities: ["YouTube", "Instagram", "TikTok"], marketSegments: ["Tech Enthusiasts", "Profesyoneller", "Gaming Kitlesi"] };
  }
  if (cat.includes("Moda") || cat.includes("Giyim")) {
    return { primaryAudience: "16–40 Moda & Trend Takipçileri", secondaryAudience: "Streetwear & Luxury Fashion Kitlesi", ageDistribution: [{ segment: "16–24", pct: 38 }, { segment: "25–34", pct: 35 }, { segment: "35–44", pct: 18 }, { segment: "45+", pct: 9 }], genderTendency: "Mix", interestClusters: ["Moda", "Stil", "Shopping", "Trend", "Streetwear"], purchaseIntent: "High", platformPriorities: ["Instagram", "TikTok", "YouTube"], marketSegments: ["Fast Fashion", "Trend Followers", "Style Conscious"] };
  }
  if (cat.includes("Lüks")) {
    return { primaryAudience: "25–55 Lüks Tüketiciler & Aspirational Buyers", secondaryAudience: "Status-Conscious Millennials", ageDistribution: [{ segment: "25–34", pct: 25 }, { segment: "35–44", pct: 32 }, { segment: "45–54", pct: 28 }, { segment: "55+", pct: 15 }], genderTendency: "Mix (Kadın Ağırlıklı)", interestClusters: ["Lüks", "Moda", "Sanat", "Seyahat", "Gastronomi"], purchaseIntent: "Medium", platformPriorities: ["Instagram", "YouTube", "Pinterest"], marketSegments: ["HNWI", "Aspirational Luxury", "Status Seekers"] };
  }
  if (cat.includes("Oyun") || cat.includes("Eğlence")) {
    return { primaryAudience: "13–35 Gaming & Esports Topluluğu", secondaryAudience: "Casual Gamers & Entertainment Kitlesi", ageDistribution: [{ segment: "13–17", pct: 20 }, { segment: "18–24", pct: 38 }, { segment: "25–34", pct: 28 }, { segment: "35+", pct: 14 }], genderTendency: "Erkek Ağırlıklı", interestClusters: ["Oyun", "Esports", "Yayın", "Anime", "Teknoloji"], purchaseIntent: "High", platformPriorities: ["YouTube", "TikTok", "Instagram"], marketSegments: ["Core Gamers", "Esports Fans", "Casual Players"] };
  }
  // Default
  return { primaryAudience: "18–45 Genel Tüketiciler", secondaryAudience: "Brand-Conscious Alıcılar", ageDistribution: [{ segment: "18–24", pct: 25 }, { segment: "25–34", pct: 35 }, { segment: "35–44", pct: 25 }, { segment: "45+", pct: 15 }], genderTendency: "Mix", interestClusters: ["Yaşam Tarzı", "Kalite", "Değer", "Trend"], purchaseIntent: "Medium", platformPriorities: ["Instagram", "TikTok", "YouTube"], marketSegments: ["Mass Market", "Value Conscious", "Quality Seekers"] };
}

// ── Creator Genome ──────────────────────────────────────────────────────────────

const CREATOR_CATEGORY_GENOME: Record<string, GenomeTemplate> = {
  "fitness":   { performance:88, trust:72, luxury:10, innovation:42, lifestyle:72, education:68, entertainment:45, authority:68, community:65, competitiveness:78 },
  "beauty":    { performance:25, trust:62, luxury:55, innovation:52, lifestyle:88, education:65, entertainment:62, authority:55, community:78, competitiveness:32 },
  "skincare":  { performance:22, trust:78, luxury:48, innovation:55, lifestyle:75, education:78, entertainment:42, authority:72, community:65, competitiveness:28 },
  "technology":{ performance:62, trust:70, luxury:28, innovation:88, lifestyle:50, education:75, entertainment:52, authority:80, community:48, competitiveness:62 },
  "gaming":    { performance:72, trust:55, luxury:12, innovation:70, lifestyle:58, education:52, entertainment:95, authority:52, community:88, competitiveness:85 },
  "fashion":   { performance:28, trust:50, luxury:62, innovation:60, lifestyle:92, education:38, entertainment:68, authority:48, community:72, competitiveness:38 },
  "travel":    { performance:40, trust:65, luxury:55, innovation:45, lifestyle:88, education:58, entertainment:72, authority:50, community:70, competitiveness:35 },
  "food":      { performance:35, trust:65, luxury:40, innovation:48, lifestyle:72, education:62, entertainment:68, authority:52, community:82, competitiveness:38 },
  "home":      { performance:30, trust:68, luxury:48, innovation:42, lifestyle:82, education:65, entertainment:55, authority:55, community:72, competitiveness:28 },
  "sport":     { performance:90, trust:70, luxury:20, innovation:48, lifestyle:68, education:45, entertainment:55, authority:65, community:62, competitiveness:85 },
  "lifestyle": { performance:38, trust:60, luxury:48, innovation:50, lifestyle:88, education:48, entertainment:68, authority:48, community:75, competitiveness:35 },
};

export function computeCreatorGenome(card: DiscoveryCard): CreatorGenome {
  const cat = (card.category || "").toLowerCase();
  const base = Object.entries(CREATOR_CATEGORY_GENOME).find(([k]) => cat.includes(k));
  const template = base ? base[1] : { performance:55, trust:60, luxury:38, innovation:52, lifestyle:65, education:55, entertainment:58, authority:55, community:60, competitiveness:50 };

  // Modulate by existing scores
  const engQ    = card.engagement_quality_score || 50;
  const brandFit= card.brand_fit_score          || 50;
  const momentum= card.momentum_score           || 50;
  const fraud   = card.fraud_score              || 30;

  const trustBonus   = Math.round((engQ - 50) * 0.3 + (100 - fraud - 50) * 0.15);
  const edBonus      = Math.round((brandFit - 50) * 0.2);
  const innovBonus   = Math.round((momentum - 50) * 0.25);
  const communityBonus = Math.round((engQ - 50) * 0.2);

  const clamp = (v: number) => Math.min(100, Math.max(0, v));

  return {
    performance:     clamp(template.performance),
    trust:           clamp(template.trust + trustBonus),
    luxury:          clamp(template.luxury),
    innovation:      clamp(template.innovation + innovBonus),
    lifestyle:       clamp(template.lifestyle),
    education:       clamp(template.education + edBonus),
    entertainment:   clamp(template.entertainment),
    authority:       clamp(template.authority + Math.round(edBonus * 0.5)),
    community:       clamp(template.community + communityBonus),
    competitiveness: clamp(template.competitiveness),
  };
}

// ── Genome Compatibility ────────────────────────────────────────────────────────

const GENOME_WEIGHTS = {
  performance: 0.12, trust: 0.14, luxury: 0.10, innovation: 0.10,
  lifestyle: 0.12,  education: 0.10, entertainment: 0.08,
  authority: 0.10,  community: 0.10, competitiveness: 0.04,
};

export function computeGenomeCompatibility(brand: BrandGenome, creator: CreatorGenome): { score: number; alignment: string } {
  const keys: (keyof typeof GENOME_WEIGHTS)[] = [
    "performance", "trust", "luxury", "innovation", "lifestyle",
    "education", "entertainment", "authority", "community", "competitiveness",
  ];

  let weighted = 0;
  let totalW   = 0;

  for (const key of keys) {
    const b = brand[key]   as number;
    const c = creator[key] as number;
    const w = GENOME_WEIGHTS[key];
    // Similarity = 100 - abs(b - c), higher when closer
    const sim = 100 - Math.abs(b - c);
    weighted += sim * w;
    totalW   += w;
  }

  const score = Math.round(weighted / totalW);

  // Explain alignment
  const topBrandTraits = keys
    .sort((a, b) => (brand[b] as number) - (brand[a] as number))
    .slice(0, 2)
    .map(k => ({ key: k, bv: brand[k] as number, cv: creator[k] as number }));

  const labelMap: Record<string, string> = {
    performance: "performans", trust: "güven", luxury: "lüks", innovation: "inovasyon",
    lifestyle: "yaşam tarzı", education: "eğitim", entertainment: "eğlence",
    authority: "otorite", community: "topluluk", competitiveness: "rekabetçilik",
  };

  const [top1, top2] = topBrandTraits;
  const alignment = score >= 80
    ? `Creator'ın ${labelMap[top1.key]} (${top1.cv}) ve ${labelMap[top2.key]} (${top2.cv}) genome değerleri marka DNA'sıyla (${top1.bv}, ${top2.bv}) güçlü biçimde örtüşüyor.`
    : score >= 60
    ? `Creator'ın ${labelMap[top1.key]} boyutunda marka ile makul uyum mevcut; ${labelMap[top2.key]} boyutunda kısmi sapma var.`
    : `Creator genome değerleri marka DNA'sından belirgin biçimde uzaklaşıyor. Dikkatli değerlendirin.`;

  return { score, alignment };
}

// ── Persona Match ───────────────────────────────────────────────────────────────

const PERSONA_KEYWORDS: Record<string, string[]> = {
  "Fitness Koçu":          ["fitness", "gym", "workout", "personal trainer", "antrenman"],
  "Supplement Uzmanı":     ["protein", "supplement", "beslenme", "nutrition", "whey"],
  "Sporcu Creator":        ["athlete", "runner", "koşu", "athletic", "spor"],
  "Beauty Educator":       ["skincare", "makeup", "makyaj", "cilt", "beauty", "güzellik"],
  "Moda Creator":          ["fashion", "style", "outfit", "moda", "giyim", "stil"],
  "Teknoloji İncelemecisi":["tech", "review", "unboxing", "gadget", "teknoloji"],
  "Gaming Creator":        ["gaming", "game", "oyun", "esports", "stream"],
  "Food Creator":          ["food", "recipe", "yemek", "tarif", "chef"],
  "Seyahat Creator":       ["travel", "seyahat", "destination", "tatil"],
  "Home Lifestyle":        ["home", "decor", "ev", "interior", "organizasyon"],
  "Lifestyle Creator":     ["lifestyle", "yaşam", "daily", "günlük", "vlog"],
  "Lüks Creator":          ["luxury", "lüks", "premium", "haute"],
};

function detectPersona(card: DiscoveryCard): { persona: string; score: number } {
  const haystack = `${card.category} ${card.bio}`.toLowerCase();
  let best = { persona: "Lifestyle Creator", score: 30 };

  for (const [persona, keywords] of Object.entries(PERSONA_KEYWORDS)) {
    const matches = keywords.filter(kw => haystack.includes(kw)).length;
    const score   = Math.round((matches / keywords.length) * 100);
    if (score > best.score) best = { persona, score };
  }
  return best;
}

function computePersonaMatch(creatorPersona: string, brandProfile: BrandProfile): number {
  const cat = brandProfile.primaryCategory.toLowerCase();
  const personaLower = creatorPersona.toLowerCase();

  if ((cat.includes("spor") || cat.includes("fitness")) && (personaLower.includes("fitness") || personaLower.includes("sporcu") || personaLower.includes("supplement"))) return 95;
  if (cat.includes("güzellik") && (personaLower.includes("beauty") || personaLower.includes("moda") || personaLower.includes("lifestyle"))) return 90;
  if (cat.includes("teknoloji") && personaLower.includes("teknoloji")) return 92;
  if (cat.includes("oyun") && personaLower.includes("gaming")) return 95;
  if (cat.includes("seyahat") && personaLower.includes("seyahat")) return 92;
  if (cat.includes("moda") && (personaLower.includes("moda") || personaLower.includes("lifestyle") || personaLower.includes("lüks"))) return 88;
  if (personaLower.includes("lifestyle")) return 55;
  return 40;
}

// ── Category Relevance ──────────────────────────────────────────────────────────

function computeCategoryRelevance(card: DiscoveryCard, profile: BrandProfile): number {
  const creatorCat = (card.category || "").toLowerCase();
  const brandCat   = profile.primaryCategory.toLowerCase();

  // Direct match
  const firstWord = brandCat.split(" ")[0];
  if (creatorCat.includes(firstWord)) return 90;

  // Similarity maps
  const SIMILAR: Record<string, string[]> = {
    "spor":     ["fitness", "sağlık", "outdoor", "spor"],
    "güzellik": ["cilt", "makyaj", "kozmetik", "beauty"],
    "teknoloji":["tech", "gadget", "bilgisayar", "elektro"],
    "moda":     ["giyim", "aksesuar", "stil", "fashion"],
    "gıda":     ["yemek", "food", "içecek", "beslenme"],
    "oyun":     ["gaming", "esports", "eğlence"],
    "seyahat":  ["turizm", "tatil", "travel"],
    "ev":       ["dekorasyon", "home", "interior"],
  };

  for (const [key, synonyms] of Object.entries(SIMILAR)) {
    if (brandCat.includes(key) && synonyms.some(s => creatorCat.includes(s))) return 72;
  }
  if (creatorCat.includes("lifestyle")) return 48;
  return 22;
}

// ── Audience Match ──────────────────────────────────────────────────────────────

function computeAudienceMatch(card: DiscoveryCard, audience: AudienceProfile): number {
  let score = 50;
  // Use brand_fit_score as proxy for audience alignment
  const bf = card.brand_fit_score || 50;
  score = Math.round(score * 0.5 + bf * 0.5);

  // Engagement quality → better audience quality
  const engQ = card.engagement_quality_score || 50;
  score = Math.round(score * 0.7 + engQ * 0.3);

  // Platform priority bonus
  const platform = card.platform?.toLowerCase() || "";
  if (audience.platformPriorities[0]?.toLowerCase().includes(platform)) score = Math.min(100, score + 8);

  return Math.min(100, Math.max(0, score));
}

// ── Country Match ───────────────────────────────────────────────────────────────

function computeCountryMatch(card: DiscoveryCard, profile: BrandProfile): number {
  if (profile.geoScope === "Global") return 70;
  const country = (card.country || "").toLowerCase();
  if (profile.geoScope === "Local" && (country.includes("türk") || country.includes("turkey"))) return 95;
  if (profile.geoScope === "Regional") {
    if (country.includes("türk") || country.includes("turkey")) return 90;
    if (country.includes("europe") || country.includes("avrupa")) return 75;
    return 50;
  }
  return 60;
}

// ── Evidence Genome Builder ─────────────────────────────────────────────────────

export function buildEvidenceGenome(
  base: BrandGenome,
  evidence: BrandWebsiteEvidence | undefined,
  profile: BrandProfile,
): EvidenceGenome {
  const allText = evidence?.fetchStatus === "success"
    ? [
        evidence.pageTitle || "",
        evidence.metaDescription || "",
        evidence.ogDescription || "",
        ...(evidence.h1s || []),
        ...(evidence.h2s || []),
        ...(evidence.bodySnippets || []),
        ...(evidence.keywordHints || []),
      ].join(" ").toLowerCase()
    : "";

  const isKnownBrand = profile.detectedFrom === "url_lookup";
  const hasWebsite   = evidence?.fetchStatus === "success" && allText.length > 100;
  const hasAi        = hasWebsite && (evidence?.aiUsed ?? false);

  function keywordHitCount(kws: string[]): number {
    return kws.filter(kw => allText.includes(kw)).length;
  }

  function makeDimension(
    dim: keyof typeof GENOME_KW,
    baseValue: number,
  ): GenomeDimensionScore {
    if (!hasWebsite) {
      return {
        value:      baseValue,
        basis:      isKnownBrand ? "Known Brand Profile" : "Taxonomy Fallback",
        confidence: isKnownBrand ? "Medium" : "Low",
        reason:     isKnownBrand
          ? `${profile.name} bilinen marka profili — web sitesi verisi mevcut değil`
          : `Kategori (${profile.primaryCategory}) taksonomisinden türetildi — web sitesi analizi yapılamadı`,
      };
    }

    const hits = keywordHitCount(GENOME_KW[dim] || []);
    const delta = Math.min(20, Math.max(-20, (hits - 1) * 5));
    const value = Math.min(100, Math.max(0, Math.round(baseValue + delta)));

    if (hits >= 3) {
      return {
        value,
        basis:      hasAi ? "AI Interpretation" : "Website Evidence",
        confidence: "High",
        reason:     `Web sitesinde "${dim}" boyutuna ait ${hits} güçlü sinyal bulundu (+${Math.max(0, delta)} delta)`,
      };
    }
    if (hits >= 1) {
      return {
        value,
        basis:      "Website Evidence",
        confidence: "Medium",
        reason:     `Web sitesinde ${hits} zayıf sinyal — ${isKnownBrand ? "bilinen profil ile desteklendi" : "taksonomi referansı ile tamamlandı"}`,
      };
    }
    return {
      value: baseValue,
      basis:      isKnownBrand ? "Known Brand Profile" : "Taxonomy Fallback",
      confidence: "Low",
      reason:     `Web sitesinde sinyal bulunamadı — ${isKnownBrand ? "bilinen marka profilinden" : "taksonomiden"} devralındı`,
    };
  }

  const dims = {
    performance:     makeDimension("performance",     base.performance),
    trust:           makeDimension("trust",           base.trust),
    luxury:          makeDimension("luxury",          base.luxury),
    innovation:      makeDimension("innovation",      base.innovation),
    lifestyle:       makeDimension("lifestyle",       base.lifestyle),
    education:       makeDimension("education",       base.education),
    entertainment:   makeDimension("entertainment",   base.entertainment),
    authority:       makeDimension("authority",       base.authority),
    community:       makeDimension("community",       base.community),
    competitiveness: makeDimension("competitiveness", base.competitiveness),
  };

  const topTraits = Object.entries(dims)
    .sort(([, a], [, b]) => b.value - a.value)
    .slice(0, 4)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));

  const highConfidence = Object.values(dims).filter(d => d.confidence === "High").length;
  const overallEvidenceStrength = hasWebsite
    ? Math.min(100, Math.round((highConfidence / 10) * 100))
    : isKnownBrand ? 40 : 20;

  const basisLabel = hasAi ? "AI + Web" : hasWebsite ? "Web Evidence" : isKnownBrand ? "Known Profile" : "Taxonomy";
  const summary = `Brand DNA ${basisLabel} kaynağından türetildi. En güçlü boyutlar: ${topTraits.slice(0, 3).join(", ")}. Kanıt gücü: ${overallEvidenceStrength}/100.`;

  return { ...dims, topTraits, summary, overallEvidenceStrength };
}

// ── Creator Coverage Analyzer ───────────────────────────────────────────────────

export function analyzeCreatorCoverage(creators: DiscoveryCard[], targetMarket?: string): CreatorCoverage {
  const total = creators.length;
  if (total === 0) {
    return {
      total: 0, withCountry: 0, withCategory: 0, withEngagementData: 0,
      withFraudData: 0, highConfidenceForMatch: 0, coverageScore: 0,
      coverageNote: "Veritabanında analiz edilecek creator bulunamadı.",
      limitation: "Creator veritabanı boş — tüm öneriler teorik çerçevede değerlendirilmelidir.",
    };
  }

  const withCountry       = creators.filter(c => c.country && c.country.trim().length > 0).length;
  const withCategory      = creators.filter(c => c.category && c.category.trim().length > 0).length;
  const withEngagement    = creators.filter(c => (c.engagement_quality_score || 0) > 0).length;
  const withFraud         = creators.filter(c => (c.fraud_score || 0) > 0).length;
  const highConf          = creators.filter(c =>
    c.country && c.category &&
    (c.engagement_quality_score || 0) > 0 &&
    (c.fraud_score || 0) > 0
  ).length;

  const countryPct    = withCountry    / total;
  const categoryPct   = withCategory   / total;
  const engagementPct = withEngagement / total;
  const fraudPct      = withFraud      / total;
  const coverageScore = Math.round((countryPct + categoryPct + engagementPct + fraudPct) / 4 * 100);

  const targetNote = targetMarket && targetMarket !== "Global"
    ? (() => {
        const inTarget = creators.filter(c => {
          const co = (c.country || "").toLowerCase();
          const tm = targetMarket.toLowerCase();
          return co.includes(tm) || (tm === "turkey" && (co.includes("türk") || co.includes("turkey")));
        }).length;
        return ` Hedef pazar (${targetMarket}): ${inTarget}/${total} creator eşleşiyor.`;
      })()
    : "";

  const coverageNote = `${total} creator analiz edildi. Ülke verisi: ${withCountry} (%${Math.round(countryPct * 100)}), Kategori: ${withCategory} (%${Math.round(categoryPct * 100)}), Engagement kalitesi: ${withEngagement} (%${Math.round(engagementPct * 100)}), Fraud verisi: ${withFraud} (%${Math.round(fraudPct * 100)}).${targetNote}`;

  const limitation = coverageScore < 50
    ? `Veri tamamlığı düşük (%${coverageScore}) — önerilerin güvenilirliği sınırlı. Daha fazla creator verisi sistemi güçlendirir.`
    : total < 50
    ? `Veritabanında yalnızca ${total} creator mevcut — ideal eşleşme için 50+ creator önerilir.`
    : undefined;

  return {
    total, withCountry, withCategory, withEngagementData: withEngagement,
    withFraudData: withFraud, highConfidenceForMatch: highConf,
    coverageScore, coverageNote, limitation,
  };
}

// ── Country Match with Target Market ───────────────────────────────────────────

function computeCountryMatchWithTarget(card: DiscoveryCard, profile: BrandProfile, targetMarket?: string): number {
  const base = computeCountryMatch(card, profile);
  if (!targetMarket || targetMarket === "Global") return base;

  const country = (card.country || "").toLowerCase();
  const tm      = targetMarket.toLowerCase();

  const COUNTRY_ALIASES: Record<string, string[]> = {
    "turkey":  ["türk", "turkey", "türkiye"],
    "usa":     ["united states", "usa", "us", "america"],
    "uk":      ["united kingdom", "uk", "britain", "england"],
    "germany": ["germany", "deutschland", "german"],
  };

  const aliases = COUNTRY_ALIASES[tm] || [tm];
  const isMatch = aliases.some(a => country.includes(a));

  if (isMatch) return Math.min(100, base + 20);
  return Math.max(0, base - 25);
}

// ── Top Match Reasons ───────────────────────────────────────────────────────────

function getTopMatchReasons(scores: MatchScoreBreakdown, persona: string, countryMatch: boolean): string[] {
  const reasons: string[] = [];

  if (scores.genomeCompatibility >= 75) reasons.push(`Genome uyumu: ${scores.genomeCompatibility}/100`);
  if (scores.categoryRelevance   >= 75) reasons.push(`Kategori uyumu: ${scores.categoryRelevance}/100`);
  if (scores.audienceMatch       >= 70) reasons.push(`Kitle uyumu: ${scores.audienceMatch}/100`);
  if (scores.personaMatch        >= 80) reasons.push(`Persona: ${persona}`);
  if (scores.trustScore          >= 80) reasons.push("Düşük fraud riski");
  if (countryMatch)                     reasons.push("Hedef pazar eşleşmesi");
  if (scores.qualityScore        >= 80) reasons.push(`Kalite skoru: ${scores.qualityScore}/100`);

  return reasons.slice(0, 3);
}

// ── Genome Keyword Map ──────────────────────────────────────────────────────────

const GENOME_KW: Record<string, string[]> = {
  performance:     ["performance", "training", "athletic", "speed", "results", "stronger", "faster", "power", "workout", "achieve"],
  trust:           ["clinically", "tested", "certified", "quality", "proven", "safe", "reliable", "trusted", "dermatologist", "science-backed"],
  luxury:          ["luxury", "premium", "exclusive", "limited edition", "prestige", "sophisticated", "artisan", "haute", "elite"],
  innovation:      ["innovation", "technology", "advanced", "cutting-edge", "breakthrough", "engineered", "smart", "next-gen", "patented"],
  lifestyle:       ["lifestyle", "everyday", "style", "inspire", "feel", "experience", "aspire", "journey", "belong"],
  education:       ["learn", "guide", "how-to", "discover", "understand", "knowledge", "science", "ingredients", "expert"],
  entertainment:   ["fun", "exciting", "adventure", "play", "enjoy", "community", "together", "share", "connect"],
  authority:       ["leader", "number one", "#1", "industry", "award", "recognized", "professional", "authority", "trusted by"],
  community:       ["community", "together", "join", "team", "family", "movement", "tribe", "belong", "connect"],
  competitiveness: ["compete", "win", "champion", "beat", "challenge", "race", "victory", "outperform", "push limits"],
};

// ── Full Match Score ────────────────────────────────────────────────────────────

const MATCH_WEIGHTS = {
  genomeCompatibility: 0.25,
  audienceMatch:       0.20,
  categoryRelevance:   0.20,
  personaMatch:        0.15,
  qualityScore:        0.10,
  trustScore:          0.07,
  countryMatch:        0.03,
};

export function computeCreatorMatchScore(
  card: DiscoveryCard,
  profile: BrandProfile,
  genome: BrandGenome,
  audience: AudienceProfile,
  targetMarket?: string,
): MatchedCreator {
  const creatorGenome = computeCreatorGenome(card);
  const { score: genomeSim, alignment: genomeAlignment } = computeGenomeCompatibility(genome, creatorGenome);

  const { persona } = detectPersona(card);
  const countryScore = computeCountryMatchWithTarget(card, profile, targetMarket);
  const scores: MatchScoreBreakdown = {
    genomeCompatibility: genomeSim,
    audienceMatch:       computeAudienceMatch(card, audience),
    categoryRelevance:   computeCategoryRelevance(card, profile),
    personaMatch:        computePersonaMatch(persona, profile),
    qualityScore:        Math.round((card.engagement_quality_score || 50) * 0.5 + (card.brand_fit_score || 50) * 0.5),
    trustScore:          Math.round(100 - (card.fraud_score || 30)),
    countryMatch:        countryScore,
    final:               0,
  };

  scores.final = Math.round(
    scores.genomeCompatibility * MATCH_WEIGHTS.genomeCompatibility +
    scores.audienceMatch       * MATCH_WEIGHTS.audienceMatch +
    scores.categoryRelevance   * MATCH_WEIGHTS.categoryRelevance +
    scores.personaMatch        * MATCH_WEIGHTS.personaMatch +
    scores.qualityScore        * MATCH_WEIGHTS.qualityScore +
    scores.trustScore          * MATCH_WEIGHTS.trustScore +
    scores.countryMatch        * MATCH_WEIGHTS.countryMatch
  );

  const tier = card.followers >= 1_000_000 ? "Hero" : card.followers >= 300_000 ? "Macro" : card.followers >= 50_000 ? "Mid-tier" : "Micro";
  const fraud = card.fraud_score || 30;
  const riskLevel: RiskLevel = fraud >= 70 ? "High" : fraud >= 45 ? "Medium" : "Low";

  const isMismatch = scores.final < 45 || (card.followers >= 500_000 && scores.genomeCompatibility < 40);
  const mismatchReason = isMismatch
    ? fraud >= 70
      ? `Yüksek fraud riski (${fraud}) — marka güvenilirliği tehdit altında.`
      : scores.genomeCompatibility < 40
      ? `Genome uyumsuzluğu — creator DNA'sı (${scores.genomeCompatibility}/100) marka DNA'sından belirgin biçimde uzaklaşıyor.`
      : `Düşük kategori uyumu (${scores.categoryRelevance}/100) ve kitle uyumsuzluğu — yüksek takipçi yanıltıcı olabilir.`
    : "";

  const whySelected = buildWhySelected(card, profile, scores, persona, genomeAlignment, isMismatch);

  const countryName = (card.country || "").toLowerCase();
  const tmAliases: Record<string, string[]> = {
    "turkey":  ["türk", "turkey"],
    "usa":     ["united states", "usa"],
    "uk":      ["uk", "britain"],
    "germany": ["germany", "deutsch"],
  };
  const tmKey = (targetMarket || "global").toLowerCase();
  const countryMatchBool = tmKey === "global"
    ? false
    : (tmAliases[tmKey] || [tmKey]).some(a => countryName.includes(a));

  const topMatchReasons = getTopMatchReasons(scores, persona, countryMatchBool);

  return { card, tier, persona, scores, creatorGenome, genomeAlignment, whySelected, riskLevel, isMismatch, mismatchReason, topMatchReasons };
}

function buildWhySelected(
  card: DiscoveryCard, profile: BrandProfile, scores: MatchScoreBreakdown,
  persona: string, genomeAlignment: string, isMismatch: boolean,
): string {
  if (isMismatch) return `⚠️ Bu creator görsel olarak çekici olabilir ancak ${profile.name} için düşük uyum gösteriyor. ${genomeAlignment}`;

  const parts: string[] = [];
  if (scores.genomeCompatibility >= 75) parts.push(`Genome uyumu güçlü (${scores.genomeCompatibility}/100)`);
  if (scores.categoryRelevance >= 75)   parts.push(`Kategori uyumu yüksek (${scores.categoryRelevance}/100)`);
  if (scores.audienceMatch >= 70)        parts.push(`Kitle uyumu iyi (${scores.audienceMatch}/100)`);
  if (scores.personaMatch >= 80)         parts.push(`Persona (${persona}) marka hedef kitlesine örtüşüyor`);
  if (scores.trustScore >= 80)          parts.push(`Güçlü güven sinyali — düşük fraud riski`);

  return parts.length > 0
    ? `${parts.join(" · ")}. ${genomeAlignment}`
    : `${profile.name} için orta düzey uyum. ${genomeAlignment}`;
}

// ── Portfolio Builder ───────────────────────────────────────────────────────────

export function buildBrandPortfolio(creators: MatchedCreator[], profile: BrandProfile): PortfolioResult {
  const micro   = creators.filter(c => c.tier === "Micro");
  const mid     = creators.filter(c => c.tier === "Mid-tier");
  const macro   = creators.filter(c => c.tier === "Macro");
  const hero    = creators.filter(c => c.tier === "Hero");

  const tierDist: Record<string, { pct: number; rationale: string; color: string }> = {
    "Micro":   { pct: 35, color: "#10B981", rationale: "Yüksek güven ve niche kitle erişimi — dönüşüm için güçlü" },
    "Mid-tier":{ pct: 40, color: "#6366F1", rationale: "Erişim ile güvenilirlik arasındaki altın denge" },
    "Macro":   { pct: 18, color: "#F59E0B", rationale: "Geniş erişim ve marka görünürlüğü" },
    "Hero":    { pct: 7,  color: "#EC4899", rationale: "Aspirasyonel konumlama ve en geniş kitlelere anlık erişim" },
  };

  // Adjust for market tier
  if (profile.marketTier === "Luxury") {
    tierDist["Hero"].pct    = 20;
    tierDist["Macro"].pct   = 40;
    tierDist["Mid-tier"].pct= 30;
    tierDist["Micro"].pct   = 10;
  } else if (profile.marketTier === "Mass Market" || profile.marketTier === "Value") {
    tierDist["Micro"].pct   = 50;
    tierDist["Mid-tier"].pct= 40;
    tierDist["Macro"].pct   = 8;
    tierDist["Hero"].pct    = 2;
  }

  const tiers: PortfolioTier[] = [
    { label: `Micro (${micro.length})`,    count: micro.length,  budgetPct: tierDist["Micro"].pct,    rationale: tierDist["Micro"].rationale,    color: tierDist["Micro"].color },
    { label: `Mid-tier (${mid.length})`,   count: mid.length,    budgetPct: tierDist["Mid-tier"].pct, rationale: tierDist["Mid-tier"].rationale,  color: tierDist["Mid-tier"].color },
    { label: `Macro (${macro.length})`,    count: macro.length,  budgetPct: tierDist["Macro"].pct,    rationale: tierDist["Macro"].rationale,     color: tierDist["Macro"].color },
    { label: `Hero (${hero.length})`,      count: hero.length,   budgetPct: tierDist["Hero"].pct,     rationale: tierDist["Hero"].rationale,      color: tierDist["Hero"].color },
  ].filter(t => t.count > 0);

  const avgScore  = creators.length > 0 ? Math.round(creators.reduce((s, c) => s + c.scores.final, 0) / creators.length) : 0;
  const diversity = Math.min(100, tiers.length * 22 + (new Set(creators.map(c => c.persona)).size) * 8);
  const efficiency= avgScore;

  const risks: string[] = [];
  if (creators.filter(c => c.riskLevel === "High").length > 0) risks.push(`${creators.filter(c => c.riskLevel === "High").length} creator yüksek fraud riski taşıyor.`);
  if (hero.length === 0 && profile.marketTier === "Premium") risks.push("Hero creator eksikliği — brand awareness potansiyeli sınırlı.");
  if (micro.length === 0) risks.push("Micro creator eksikliği — dönüşüm potansiyeli zayıf.");

  const opportunities: string[] = [];
  if (micro.length < 5) opportunities.push("Daha fazla micro creator eklenerek niche kitle dönüşümü güçlendirilebilir.");
  if (tiers.length < 3) opportunities.push("Farklı tier'lardan creator eklenerek portföy çeşitliliği artırılabilir.");

  return {
    strategy:  `${profile.name} için ${profile.marketTier}-uyumlu, genome-validated creator portföyü`,
    tiers,
    strength:  `Portföy Gücü: ${avgScore}/100 — ${avgScore >= 70 ? "Güçlü" : avgScore >= 50 ? "Orta" : "Zayıf"}`,
    risks,
    opportunities,
    diversity,
    efficiency,
  };
}

// ── Audience Overlap ────────────────────────────────────────────────────────────

export function analyzeAudienceOverlap(creators: MatchedCreator[]): AudienceOverlapResult {
  if (creators.length === 0) {
    return { estimatedOverlapPct: 0, saturationRisk: "Low", effectiveReachMultiplier: 1.0, warnings: [] };
  }

  // Same-category creators have higher overlap
  const cats     = creators.map(c => c.card.category || "");
  const uniqueCats = new Set(cats).size;
  const catDiversity = uniqueCats / Math.max(creators.length, 1);

  // Estimated overlap: 15-55% range based on diversity
  const baseOverlap   = 55 - catDiversity * 35;
  const creatorBonus  = Math.min(20, creators.length * 1.5);
  const overlapPct    = Math.round(Math.min(70, Math.max(10, baseOverlap + creatorBonus)));

  const multiplier   = Math.round((1 - overlapPct / 100 * 0.5) * 100) / 100;
  const satRisk: RiskLevel = overlapPct >= 50 ? "High" : overlapPct >= 30 ? "Medium" : "Low";

  const warnings: string[] = [];
  if (overlapPct >= 50) warnings.push(`Tahminsel kitle örtüşmesi yüksek (%${overlapPct}) — çok sayıda creator aynı kitleye ulaşıyor olabilir.`);
  if (uniqueCats < 2 && creators.length >= 3) warnings.push("Creator'lar aynı kategoriden geliyor — kitle çeşitliliği düşük.");

  return { estimatedOverlapPct: overlapPct, saturationRisk: satRisk, effectiveReachMultiplier: multiplier, warnings };
}

// ── Mismatch Detection ──────────────────────────────────────────────────────────

export function detectMismatches(creators: MatchedCreator[], profile: BrandProfile): MismatchWarning[] {
  return creators
    .filter(c => c.isMismatch)
    .map(c => ({
      creator: c.card,
      reason:  c.mismatchReason,
      signals: [
        c.scores.genomeCompatibility < 45 ? `Düşük genome uyumu: ${c.scores.genomeCompatibility}/100` : "",
        c.scores.categoryRelevance < 35   ? `Düşük kategori uyumu: ${c.scores.categoryRelevance}/100` : "",
        c.riskLevel === "High"             ? `Yüksek fraud riski: ${c.card.fraud_score}` : "",
        c.scores.audienceMatch < 40        ? `Kitle uyumsuzluğu: ${c.scores.audienceMatch}/100` : "",
      ].filter(Boolean),
      riskScore: Math.round(100 - c.scores.final),
    }));
}

// ── Expansion Opportunities ─────────────────────────────────────────────────────

export function generateExpansionOpportunities(
  profile: BrandProfile,
  audience: AudienceProfile,
  creators: MatchedCreator[],
): ExpansionOpportunity[] {
  const usedPersonas = new Set(creators.map(c => c.persona));
  const opportunities: ExpansionOpportunity[] = [];

  const ADJACENT: Record<string, ExpansionOpportunity[]> = {
    "Spor & Moda": [
      { segment: "Wellness & Mental Fitness",  opportunity: "Fiziksel performansın ötesinde mental sağlık kitlesi — büyüyen segment", rationale: "Mental wellness alanı spor markası için doğal genişleme", creatorType: "Wellness Creator",      priority: "High" },
      { segment: "Outdoor & Adventure Sports", opportunity: "Extreme outdoor kitlesi — marka adventurous boyutunu güçlendirir",         rationale: "Outdoor segment genellikle spor markalarında göz ardı edilir",   creatorType: "Outdoor Creator",       priority: "High" },
      { segment: "Women's Sports",             opportunity: "Kadın sporcu kitlesi — kategori ortalamasında yetersiz temsil",             rationale: "Kadın spor segmenti hızla büyüyor ve önemli fırsatlar sunuyor", creatorType: "Kadın Sporcu Creator",  priority: "High" },
    ],
    "Fitness & Sağlık": [
      { segment: "Plant-Based Nutrition",   opportunity: "Bitkisel protein kitlesi hızla büyüyor — erken konumlama avantajı",       rationale: "Vegan supplement pazarı yıllık %15+ büyüyor",                    creatorType: "Vegan Fitness Creator",  priority: "High" },
      { segment: "40+ Fitness Segment",     opportunity: "Yaşlanan aktif nüfus genellikle göz ardı edilir — güçlü satın alma niyeti", rationale: "Yüksek gelirli, sadık müşteri segmenti",                         creatorType: "Active Aging Creator",   priority: "High" },
      { segment: "Sports Medicine & Rehab", opportunity: "Sakatlanma önleme ve rehabilitasyon kitlesi — yüksek güven gerektirir",     rationale: "Expert creator ile güven ve otorite inşası",                     creatorType: "Spor Hekimliği Creator", priority: "High" },
    ],
    "Güzellik & Bakım": [
      { segment: "Men's Grooming",         opportunity: "Erkek cilt bakımı hızla büyüyen niş — genellikle göz ardı edilir",    rationale: "Erkek grooming pazarı global olarak yılda %6 büyüyor",            creatorType: "Men's Grooming Creator",   priority: "High" },
      { segment: "Inclusive Beauty",       opportunity: "Çeşitli ten tonları için kapsayıcı içerik — topluluk bağı güçlü",    rationale: "Kapsayıcı güzellik hareketi genç tüketicilerde marka bağlılığı artırıyor", creatorType: "Inclusive Beauty Creator", priority: "High" },
      { segment: "Clean Beauty Advocates", opportunity: "İçerik şeffaflığı talep eden kitle — marka güvenilirliğini artırır", rationale: "Şeffaflık odaklı creator'lar premium kitleye ulaşıyor",            creatorType: "Clean Beauty Creator",     priority: "High" },
    ],
    "Teknoloji": [
      { segment: "Content Creator Economy", opportunity: "Yaratıcı teknoloji araçları kullanan creator kitlesi — erken adopter",       rationale: "Creator economy segmenti hızla büyüyor ve çok harcıyor",    creatorType: "Tech Creator Ecosystem", priority: "High" },
      { segment: "Business & Productivity", opportunity: "Profesyonel kullanım kitlesi — B2B-adjacent yüksek değer segment",           rationale: "B2B-adjacent tüketici marketi yüksek bilet değeri sunar",    creatorType: "Productivity Creator",   priority: "High" },
      { segment: "Gaming Peripherals",      opportunity: "Gaming kitlesi tech segment içinde en yüksek satın alma niyetine sahip",      rationale: "Gaming kitlesi premium ürünler için en yüksek ödeme istekliliğine sahip", creatorType: "Gaming Tech Creator", priority: "High" },
    ],
  };

  const catKey = Object.keys(ADJACENT).find(k => profile.primaryCategory.includes(k.split(" ")[0]));
  const adj = catKey ? ADJACENT[catKey] : [];

  adj.forEach(opp => {
    if (!usedPersonas.has(opp.creatorType)) {
      opportunities.push(opp);
    }
  });

  // Always add geographic expansion if not global
  if (profile.geoScope !== "Global") {
    opportunities.push({ segment: "Uluslararası Pazar", opportunity: `${profile.name} için global creator ortaklığı büyüme fırsatı`, rationale: "Yeni coğrafi pazarlarda marka bilinirliği inşası", priority: "Medium", creatorType: "Global Content Creator" });
  }

  // Always add emerging creator types
  opportunities.push({ segment: "Short-Form Video Kitlesi", opportunity: "TikTok/Reels native creator'lar — Z kuşağı erişimi", rationale: "Kısa video formatında marka mesajı daha hızlı yayılıyor", priority: "Medium", creatorType: "Short-Form Creator" });

  return opportunities.slice(0, 6);
}

// ── Confidence Engine ───────────────────────────────────────────────────────────

export function buildBrandMatchConfidence(creators: MatchedCreator[], profile: BrandProfile): BrandMatchConfidence {
  const creatorCount = creators.length;
  const analysisConf = profile.detectedFrom === "url_lookup" ? 90 : profile.detectedFrom === "taxonomy" ? 78 : 55;
  const audienceConf = profile.detectedFrom === "url_lookup" ? 82 : 70;
  const creatorConf  = creatorCount >= 10 ? 85 : creatorCount >= 5 ? 70 : creatorCount >= 1 ? 55 : 20;
  const genomeConf   = profile.detectedFrom === "url_lookup" ? 80 : profile.detectedFrom === "taxonomy" ? 70 : 52;

  const overall = Math.round(
    analysisConf * 0.30 + audienceConf * 0.25 + creatorConf * 0.30 + genomeConf * 0.15
  );

  const grade: "A" | "B" | "C" | "D" = overall >= 80 ? "A" : overall >= 65 ? "B" : overall >= 50 ? "C" : "D";

  const reasons: string[] = [];
  if (profile.detectedFrom === "url_lookup") reasons.push("Marka doğrulaması: URL veritabanı eşleşmesi");
  if (profile.detectedFrom === "domain_extraction") reasons.push("Marka çıkarımı: domain tespiti — manuel doğrulama önerilir");
  if (creatorCount === 0) reasons.push("Creator verisi yok — genome analizi ve portföy teorik");
  if (creatorCount >= 10) reasons.push(`${creatorCount} creator verisi mevcut — güvenilir genome eşleşmesi`);
  reasons.push("Revenue, ROAS ve Conversion tahminleri bu raporda yer almaz — geçmiş kampanya verisi gerektirir");

  return { analysis: analysisConf, audience: audienceConf, creator: creatorConf, genome: genomeConf, overall, grade, reasons };
}

// ── Main Entry Point ────────────────────────────────────────────────────────────

export function runBrandMatchAnalysis(
  url: string,
  rawCreators: DiscoveryCard[],
  options?: {
    websiteEvidence?: BrandWebsiteEvidence;
    targetMarket?: string;
    competitorUrl?: string;
  },
): BrandMatchResult {
  const { profile, genome, tone, audience } = analyzeBrand(url);
  const targetMarket = options?.targetMarket || "Global";
  const websiteEvidence = options?.websiteEvidence;
  const competitorUrl = options?.competitorUrl;

  // Build evidence-annotated genome
  const evidenceGenome = buildEvidenceGenome(genome, websiteEvidence, profile);

  // Deduplicate creators
  const seen = new Set<string>();
  const unique = rawCreators.filter(c => {
    const key = `${c.username}::${c.platform}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  // Score every creator (with targetMarket awareness)
  const scored = unique
    .map(c => computeCreatorMatchScore(c, profile, genome, audience, targetMarket))
    .sort((a, b) => b.scores.final - a.scores.final)
    .slice(0, 50);

  const goodFits  = scored.filter(c => !c.isMismatch);
  const portfolio = buildBrandPortfolio(goodFits, profile);
  const overlap   = analyzeAudienceOverlap(goodFits);
  const mismatches= detectMismatches(scored, profile);
  const expansions= generateExpansionOpportunities(profile, audience, goodFits);
  const confidence= buildBrandMatchConfidence(scored, profile);
  const creatorCoverage = analyzeCreatorCoverage(rawCreators, targetMarket);

  const insights     = buildInsights(profile, scored, genome, confidence);
  const risks        = buildRisks(profile, mismatches, overlap, scored);
  const opportunities= buildOpportunities(profile, scored, expansions);
  const nextActions  = buildNextActions(profile, scored, confidence);
  const summary      = buildSummary(profile, scored, genome, confidence);
  const dataSourceNotes = buildDataNotes(profile, scored);

  return {
    brand: profile, genome, tone, audience,
    creators: scored, portfolio, overlap, mismatches, expansions, confidence,
    insights, risks, opportunities, nextActions, summary, dataSourceNotes,
    analyzedUrl: url, creatorsFromDB: rawCreators.length,
    websiteEvidence, evidenceGenome, creatorCoverage,
    targetMarket, competitorUrl,
  };
}

// ── Narrative Builders ──────────────────────────────────────────────────────────

function buildSummary(profile: BrandProfile, creators: MatchedCreator[], genome: BrandGenome, conf: BrandMatchConfidence): string {
  const top3 = genome.topTraits.slice(0, 3).join(", ").toLowerCase();
  const count = creators.length;
  const avg   = count > 0 ? Math.round(creators.reduce((s, c) => s + c.scores.final, 0) / count) : 0;

  return `${profile.name}, ${profile.industry} sektöründe ${profile.marketTier.toLowerCase()} segment konumlamasıyla faaliyet göstermektedir. Marka DNA'sı en güçlü şekilde ${top3} boyutlarında öne çıkmaktadır. ${count > 0 ? `${count} creator analiz edildi; ortalama AI Brand Match skoru ${avg}/100.` : "Creator veritabanı henüz yeterli veri içermiyor — güven analizi teorik çerçevede gerçekleştirildi."} Güven seviyesi: ${conf.grade} (${conf.overall}/100). Revenue, ROAS ve Conversion tahminleri bu raporda yer almaz.`;
}

function buildInsights(profile: BrandProfile, creators: MatchedCreator[], genome: BrandGenome, conf: BrandMatchConfidence): string[] {
  const out: string[] = [];
  if (genome.trust >= 75)       out.push(`${profile.name}'ın güven DNA'sı (${genome.trust}/100) yüksek — bu markaya creator seçiminde fraud güvenliği en kritik faktör.`);
  if (genome.community >= 70)   out.push(`Topluluk boyutu güçlü (${genome.community}/100) — engagement odaklı micro ve mid-tier creator'lar önceliklendirilmeli.`);
  if (genome.luxury >= 70)      out.push(`Lüks konumlama (${genome.luxury}/100) — hero ve macro creator'lar marka aspirasyonunu korumalı.`);
  if (genome.innovation >= 80)  out.push(`Yüksek inovasyon DNA'sı (${genome.innovation}/100) — early adopter ve tech-forward creator'lar öncelikli tercih.`);
  if (creators.length > 0) {
    const mismatches = creators.filter(c => c.isMismatch).length;
    if (mismatches > 0) out.push(`${mismatches} creator yüksek takipçi sayısına rağmen düşük brand uyumu gösteriyor — dikkatli değerlendirin.`);
  }
  if (profile.geoScope === "Regional") out.push("Bölgesel marka stratejisi — yerel dil ve kültürle içerik üreten creator'lar dönüşümü artırır.");
  if (out.length < 4) out.push(`${profile.name} için Genome Compatibility skoru, takipçi sayısından çok daha güvenilir bir seçim kriteridir.`);
  return out.slice(0, 5);
}

function buildRisks(profile: BrandProfile, mismatches: MismatchWarning[], overlap: AudienceOverlapResult, creators: MatchedCreator[]): string[] {
  const out: string[] = [];
  if (mismatches.length > 0) out.push(`${mismatches.length} creator düşük brand match riskine sahip — portföyde yer alması marka güvenilirliğini zayıflatabilir.`);
  if (overlap.saturationRisk === "High") out.push(`Kitle doygunluk riski yüksek (%${overlap.estimatedOverlapPct} örtüşme) — ek creator'lar farklı kategorilerden seçilmeli.`);
  if (creators.filter(c => c.riskLevel === "High").length > 0) out.push("Yüksek fraud riskli creator'lar portföyde yer alıyor — içerik yayınlanmadan önce doğrulama yapılmalı.");
  out.push("Revenue ve ROAS verileri olmadan finansal ROI garantisi verilemez — kampanya sonuçları gerçek verilerle ölçülmeli.");
  if (profile.geoScope === "Local" && creators.filter(c => c.scores.countryMatch >= 80).length === 0) out.push("Hedef ülke creator eşleşmesi yetersiz — yerel creator onboarding gerekebilir.");
  return out.slice(0, 5);
}

function buildOpportunities(profile: BrandProfile, creators: MatchedCreator[], expansions: ExpansionOpportunity[]): string[] {
  const out: string[] = [];
  const highMatch = creators.filter(c => c.scores.final >= 80);
  if (highMatch.length > 0) out.push(`${highMatch.length} creator %80+ Brand Match skoruna sahip — uzun vadeli ambassador programı için değerlendirilmeli.`);
  if (expansions.length > 0) out.push(`${expansions[0].segment} kitlesi için creator ortaklığı yeni büyüme potansiyeli sunuyor.`);
  if (profile.marketTier !== "Luxury") out.push("Micro creator odaklı UGC (kullanıcı içerik üretimi) kampanyası marka güvenilirliğini organik olarak artırır.");
  out.push("Genome Compatibility skoru ≥80 olan creator'larla uzun dönemli sözleşme, kısa vadeli bir kez işbirliğinden 3-4x daha etkili sonuç üretir.");
  return out.slice(0, 4);
}

function buildNextActions(profile: BrandProfile, creators: MatchedCreator[], conf: BrandMatchConfidence): string[] {
  const out: string[] = [
    `En yüksek Brand Match skorlu 5 creator'ı belirle ve önce engagement test kampanyası yap.`,
    `${conf.grade === "D" || conf.grade === "C" ? "Creator veritabanını genişlet — daha iyi eşleşme için daha fazla analiz gerekli." : "Portföydeki high-match creator'larla ilk iletişimi başlat."}`,
    "Genome Compatibility ≥75 olan creator'ları Campaign Intelligence'e aktar ve bütçe simülasyonu yap.",
    "Mismatch olarak işaretlenen creator'larla ortaklık yapmaktan kaçın — marka DNA'sı ile uyumsuz.",
    "Üç aylık içerik takvimi oluştur — sezonluk kampanyalar ve ürün lansmanlarını creator'larla planlı yürüt.",
    "Her kampanya sonunda gerçek engagement ve reach verilerini kaydet — gelecekteki tahminlerin güvenilirliği artar.",
  ];
  return out;
}

function buildDataNotes(profile: BrandProfile, creators: MatchedCreator[]): string[] {
  return [
    `Marka analizi: ${profile.detectedFrom === "url_lookup" ? "URL veritabanı doğrulaması" : profile.detectedFrom === "taxonomy" ? "Marka taksonomisi eşleşmesi" : "Domain çıkarımı — manuel doğrulama önerilir"}`,
    `Brand Genome: ${profile.primaryCategory} kategori profili + marka olgunluk ayarlaması`,
    `Creator skorları: Gerçek engagement_quality, brand_fit, fraud_score, momentum verileri kullanıldı`,
    `Genome Compatibility: 10 boyutlu ağırlıklı benzerlik hesabı (belirsiz değil, deterministik)`,
    `Kitle örtüşmesi: Kategori çeşitliliği tabanlı tahmin — gerçek kitle datası gerektirmez`,
    `Revenue / ROAS / Conversion: Bu raporda yer almaz — geçmiş kampanya verisi olmadan hesaplanamaz`,
  ];
}

// ── Autocomplete Brand Suggestions ─────────────────────────────────────────────

export const BRAND_URL_SUGGESTIONS = [
  "nike.com", "adidas.com", "myprotein.com", "gymshark.com", "lululemon.com",
  "samsung.com", "apple.com", "zara.com", "hm.com", "cerave.com",
  "theordinary.com", "loreal.com", "maybelline.com", "charlottetilbury.com",
  "sony.com", "razer.com", "playstation.com", "redbull.com", "airbnb.com",
  "booking.com", "turkishairlines.com", "gucci.com", "dior.com", "prada.com",
];
