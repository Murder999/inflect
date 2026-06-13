/**
 * Campaign Intelligence System — Simulation Engine
 *
 * Principles:
 * - No hallucinated ROAS, Revenue, Sales, Conversions, CTR, CVR
 * - Every metric is based on real DiscoveryCard data or clearly labeled as an estimate
 * - Confidence and feasibility are explicit outputs, not hidden assumptions
 * - Creator selection is relevance-driven, not follower-count-driven
 */

import type { DiscoveryCard } from "@/lib/api";

// ── Exported Types ─────────────────────────────────────────────────────────────

export type GoalType = "brand_awareness" | "sales" | "engagement" | "product_launch";
export type PlatformType = "instagram" | "tiktok" | "youtube" | "all";
export type TierName = "Micro" | "Mid-tier" | "Macro" | "Hero";
export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface SimConfig {
  name:     string;
  product:  string;
  goal:     GoalType;
  platform: PlatformType;
  category: string;
  country:  string;
  budget:   number;
  duration: number;
}

export interface CampaignProfile {
  detectedFrom:        "brand_taxonomy" | "keyword" | "user_input" | "fallback";
  primaryCategory:     string;
  subcategory:         string;
  purchaseIntentLevel: "Low" | "Medium" | "High";
  campaignComplexity:  "Low" | "Medium" | "High";
  audienceAgeRange:    string;
  audienceGender:      string;
  audienceInterests:   string[];
  recommendedPersonas: string[];
  recommendedPlatforms:string[];
  strategicNotes:      string[];
}

export interface AudienceIntelligence {
  primaryAudience:    string;
  secondaryAudience:  string;
  ageRange:           string;
  purchaseIntent:     string;
  interestClusters:   string[];
  platformPriority:   string[];
  personaPriority:    string[];
}

export interface QualityBreakdown {
  engagementQuality: number;
  countryRelevance:  number;
  categoryRelevance: number;
  fraudSafety:       number;
  brandSafety:       number;
  brandFit:          number;
  growthStability:   number;
}

export interface RangeEstimate {
  low:        number;
  expected:   number;
  high:       number;
  confidence: ConfidenceLevel;
  basis:      string;
}

export type DataCompleteness = "complete" | "partial" | "minimal";

export type DataCompletenessLevel = "normal" | "low_confidence" | "excluded";

/** Completeness thresholds (mirrors backend campaign_discovery_service.py) */
export const COMPLETENESS_EXCLUDE_THRESHOLD  = 60;   // < 60% → excluded
export const COMPLETENESS_LOW_CONF_THRESHOLD = 75;   // 60–75% → low confidence, budget cap
export const BUDGET_CAP_LOW_CONF             = 0.15; // max 15% for low-confidence creators

/** Quality badge labels in Turkish (replaces ~EST) */
export function completenessLabel(completeness: DataCompleteness, fieldsWithData: number): string {
  const pct = (fieldsWithData / 7) * 100;
  if (pct >= COMPLETENESS_LOW_CONF_THRESHOLD) return "";      // normal — no badge needed
  if (pct >= COMPLETENESS_EXCLUDE_THRESHOLD)  return "Düşük Güven";
  return "Veri Eksik";
}

export function completenessLevelFromPct(pct: number): DataCompletenessLevel {
  if (pct < COMPLETENESS_EXCLUDE_THRESHOLD)  return "excluded";
  if (pct < COMPLETENESS_LOW_CONF_THRESHOLD) return "low_confidence";
  return "normal";
}

export interface EnrichedCreator {
  card:               DiscoveryCard;
  qualityScore:       number | null;   // null when insufficient data (replaces default 49/50)
  qualityBreakdown:   QualityBreakdown;
  tier:               TierName;
  tierLabel:          string;
  persona:            string;
  whySelected:        string;
  countryMatch:       boolean;
  categoryMatch:      boolean;
  allocatedBudget:    number;
  budgetPct:          number;
  budgetCapApplied:   boolean;         // true when low-confidence cap was applied
  estimatedReach:     RangeEstimate;
  estimatedEngagement:RangeEstimate;
  dataCompleteness:   DataCompleteness;
  dataCompletenessFields: number;
  dataCompletenessPct:number;          // 0-100
  completenessLevel:  DataCompletenessLevel;
  completenessLabel:  string;          // "Düşük Güven" | "Veri Eksik" | ""
  sourceLabel:        string;
}

export interface PortfolioTierSummary {
  name:       TierName;
  label:      string;
  count:      number;
  budgetPct:  number;
  budgetAbs:  number;
  rationale:  string;
  color:      string;
}

export interface PortfolioSummary {
  strategy:       string;
  goalRationale:  string;
  tiers:          PortfolioTierSummary[];
  totalCreators:  number;
}

export interface ConfidenceScore {
  overall:                  number;
  grade:                    "A" | "B" | "C" | "D";
  creatorDataQuality:       number;
  audienceMatchConfidence:  number;
  countryMatchConfidence:   number;
  categoryMatchConfidence:  number;
  portfolioReliability:     number;
  forecastAvailability:     "Low" | "Unavailable";
  forecastReason:           string;
}

export interface FeasibilityScore {
  level:   "High" | "Medium" | "Low";
  score:   number;
  reasons: string[];
}

export interface SimResultV2 {
  campaignProfile:   CampaignProfile;
  audienceIntelligence: AudienceIntelligence;
  creators:          EnrichedCreator[];
  portfolio:         PortfolioSummary;
  totalReach:        RangeEstimate;
  totalEngagement:   RangeEstimate;
  estimatedCPE:      { low: number; high: number } | null;
  // Forecasts explicitly unavailable — no historical conversion data
  revenueUnavailable:    true;
  conversionUnavailable: true;
  roasUnavailable:       true;
  confidence:        ConfidenceScore;
  feasibility:       FeasibilityScore;
  insights:          string[];
  opportunities:     string[];
  risks:             string[];
  nextActions:       string[];
  summary:           string;
  dataSourceNotes:   string[];
  creatorsFromDB:          number;
  excludedFromPortfolio:   number;  // count excluded due to < 60% completeness
  usedFallbackData:        boolean;
  reportSource:            "client_simulation_preview" | "insufficient_data";
}

// ── Brand Taxonomy ─────────────────────────────────────────────────────────────

export interface BrandEntry {
  brand:    string;
  category: string;
  sub?:     string;
}

export const BRAND_TAXONOMY: BrandEntry[] = [
  // Sports & Fashion
  { brand: "Nike",              category: "Spor & Moda" },
  { brand: "Nike Türkiye",      category: "Spor & Moda" },
  { brand: "Nike Running",      category: "Spor & Moda",    sub: "Koşu" },
  { brand: "Nike Training",     category: "Spor & Moda",    sub: "Antrenman" },
  { brand: "Nike Sportswear",   category: "Spor & Moda" },
  { brand: "Adidas",            category: "Spor & Moda" },
  { brand: "Adidas Türkiye",    category: "Spor & Moda" },
  { brand: "Adidas Originals",  category: "Spor & Moda" },
  { brand: "Adidas Running",    category: "Spor & Moda",    sub: "Koşu" },
  { brand: "Puma",              category: "Spor & Moda" },
  { brand: "Under Armour",      category: "Spor & Fitness" },
  { brand: "New Balance",       category: "Spor & Moda" },
  { brand: "Asics",             category: "Spor & Moda",    sub: "Koşu" },
  { brand: "Reebok",            category: "Spor & Moda" },
  { brand: "Salomon",           category: "Spor & Outdoor" },
  { brand: "The North Face",    category: "Spor & Outdoor" },
  { brand: "Columbia",          category: "Spor & Outdoor" },
  { brand: "Gymshark",          category: "Spor & Moda",    sub: "Fitness Giyim" },
  { brand: "Lululemon",         category: "Spor & Moda",    sub: "Fitness Giyim" },
  // Fitness & Nutrition
  { brand: "MyProtein",         category: "Fitness & Sağlık", sub: "Supplement" },
  { brand: "MyProtein Türkiye", category: "Fitness & Sağlık", sub: "Supplement" },
  { brand: "Optimum Nutrition", category: "Fitness & Sağlık", sub: "Supplement" },
  { brand: "Gold Standard Whey",category: "Fitness & Sağlık", sub: "Supplement" },
  { brand: "BSN",               category: "Fitness & Sağlık", sub: "Supplement" },
  { brand: "Dymatize",          category: "Fitness & Sağlık", sub: "Supplement" },
  { brand: "MuscleTech",        category: "Fitness & Sağlık", sub: "Supplement" },
  { brand: "Scitec Nutrition",  category: "Fitness & Sağlık", sub: "Supplement" },
  { brand: "Universal Nutrition",category:"Fitness & Sağlık", sub: "Supplement" },
  { brand: "Herbalife",         category: "Sağlık & Beslenme" },
  { brand: "BioTechUSA",        category: "Fitness & Sağlık", sub: "Supplement" },
  // Beauty & Cosmetics
  { brand: "L'Oréal",           category: "Güzellik & Bakım" },
  { brand: "L'Oréal Paris",     category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Maybelline",        category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "MAC Cosmetics",     category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "NARS",              category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Charlotte Tilbury", category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Dior Beauty",       category: "Güzellik & Bakım", sub: "Lüks Makyaj" },
  { brand: "Chanel Beauty",     category: "Güzellik & Bakım", sub: "Lüks Makyaj" },
  { brand: "Huda Beauty",       category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "NYX Professional Makeup", category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Urban Decay",       category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Too Faced",         category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Flormar",           category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Golden Rose",       category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Rimmel",            category: "Güzellik & Bakım", sub: "Makyaj" },
  { brand: "Catrice",           category: "Güzellik & Bakım", sub: "Makyaj" },
  // Skincare
  { brand: "CeraVe",            category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  { brand: "The Ordinary",      category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  { brand: "La Roche-Posay",    category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  { brand: "Neutrogena",        category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  { brand: "Clinique",          category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  { brand: "Estée Lauder",      category: "Güzellik & Bakım" },
  { brand: "Kiehl's",           category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  { brand: "The Body Shop",     category: "Güzellik & Bakım" },
  { brand: "Garnier",           category: "Güzellik & Bakım" },
  { brand: "Dove",              category: "Güzellik & Bakım" },
  { brand: "Vichy",             category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  { brand: "Bioderma",          category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  { brand: "COSRX",             category: "Güzellik & Bakım", sub: "Cilt Bakımı" },
  // Technology
  { brand: "Samsung",           category: "Teknoloji" },
  { brand: "Samsung Galaxy",    category: "Teknoloji",         sub: "Akıllı Telefon" },
  { brand: "Samsung Türkiye",   category: "Teknoloji" },
  { brand: "Apple",             category: "Teknoloji" },
  { brand: "iPhone",            category: "Teknoloji",         sub: "Akıllı Telefon" },
  { brand: "MacBook",           category: "Teknoloji",         sub: "Bilgisayar" },
  { brand: "AirPods",           category: "Teknoloji",         sub: "Ses" },
  { brand: "Apple Watch",       category: "Teknoloji",         sub: "Giyilebilir" },
  { brand: "Xiaomi",            category: "Teknoloji",         sub: "Akıllı Telefon" },
  { brand: "Redmi",             category: "Teknoloji",         sub: "Akıllı Telefon" },
  { brand: "Huawei",            category: "Teknoloji" },
  { brand: "OPPO",              category: "Teknoloji",         sub: "Akıllı Telefon" },
  { brand: "Sony",              category: "Teknoloji" },
  { brand: "Lenovo",            category: "Teknoloji",         sub: "Bilgisayar" },
  { brand: "HP",                category: "Teknoloji",         sub: "Bilgisayar" },
  { brand: "Asus",              category: "Teknoloji" },
  { brand: "Razer",             category: "Teknoloji",         sub: "Gaming" },
  { brand: "Corsair",           category: "Teknoloji",         sub: "Gaming" },
  { brand: "Logitech",          category: "Teknoloji" },
  { brand: "JBL",               category: "Teknoloji",         sub: "Ses" },
  { brand: "Anker",             category: "Teknoloji" },
  // Home & Kitchen
  { brand: "Tefal",             category: "Ev & Mutfak" },
  { brand: "Le Creuset",        category: "Ev & Mutfak" },
  { brand: "KitchenAid",        category: "Ev & Mutfak" },
  { brand: "Cuisinart",         category: "Ev & Mutfak" },
  { brand: "WMF",               category: "Ev & Mutfak" },
  { brand: "Pyrex",             category: "Ev & Mutfak" },
  { brand: "Arçelik",           category: "Ev Elektroniği" },
  { brand: "Vestel",            category: "Ev Elektroniği" },
  { brand: "Bosch",             category: "Ev Elektroniği" },
  { brand: "Philips",           category: "Ev Elektroniği" },
  { brand: "IKEA",              category: "Ev & Dekorasyon" },
  { brand: "Zara Home",         category: "Ev & Dekorasyon" },
  { brand: "H&M Home",          category: "Ev & Dekorasyon" },
  // Food & Beverage
  { brand: "Nestlé",            category: "Gıda & İçecek" },
  { brand: "Ülker",             category: "Gıda & İçecek" },
  { brand: "Pınar",             category: "Gıda & İçecek" },
  { brand: "Danone",            category: "Gıda & İçecek" },
  { brand: "Red Bull",          category: "Gıda & İçecek",   sub: "Enerji İçeceği" },
  { brand: "Monster Energy",    category: "Gıda & İçecek",   sub: "Enerji İçeceği" },
  { brand: "Coca-Cola",         category: "Gıda & İçecek" },
  { brand: "Pepsi",             category: "Gıda & İçecek" },
  { brand: "Starbucks",         category: "Gıda & İçecek",   sub: "Kahve" },
  // Fashion
  { brand: "Zara",              category: "Moda & Giyim" },
  { brand: "H&M",               category: "Moda & Giyim" },
  { brand: "Mango",             category: "Moda & Giyim" },
  { brand: "Pull & Bear",       category: "Moda & Giyim" },
  { brand: "Bershka",           category: "Moda & Giyim" },
  { brand: "LC Waikiki",        category: "Moda & Giyim" },
  { brand: "Koton",             category: "Moda & Giyim" },
  { brand: "Defacto",           category: "Moda & Giyim" },
  { brand: "Trendyol",          category: "Moda & Giyim" },
  { brand: "Tommy Hilfiger",    category: "Moda & Giyim" },
  { brand: "Calvin Klein",      category: "Moda & Giyim" },
  { brand: "Ralph Lauren",      category: "Moda & Giyim" },
  { brand: "Gucci",             category: "Lüks Moda" },
  { brand: "Louis Vuitton",     category: "Lüks Moda" },
  { brand: "Balenciaga",        category: "Lüks Moda" },
  { brand: "Versace",           category: "Lüks Moda" },
  { brand: "Prada",             category: "Lüks Moda" },
  // Gaming
  { brand: "PlayStation",       category: "Oyun & Eğlence" },
  { brand: "Xbox",              category: "Oyun & Eğlence" },
  { brand: "Nintendo",          category: "Oyun & Eğlence" },
  { brand: "Steam",             category: "Oyun & Eğlence" },
  // Travel
  { brand: "Turkish Airlines",  category: "Seyahat & Turizm" },
  { brand: "Pegasus",           category: "Seyahat & Turizm" },
  { brand: "Booking.com",       category: "Seyahat & Turizm" },
  { brand: "Airbnb",            category: "Seyahat & Turizm" },
  { brand: "Expedia",           category: "Seyahat & Turizm" },
];

// ── Category Profile Taxonomy ─────────────────────────────────────────────────

interface CategoryProfile {
  keywords:           string[];
  primaryCategory:    string;
  subcategory:        string;
  purchaseIntent:     "Low" | "Medium" | "High";
  complexity:         "Low" | "Medium" | "High";
  audienceAgeRange:   string;
  audienceGender:     string;
  audienceInterests:  string[];
  personas:           string[];
  platforms:          string[];
  strategicNotes:     string[];
}

const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  fitness: {
    keywords: ["protein", "supplement", "gym", "workout", "fitness", "whey", "creatine", "bcaa", "pre-workout", "casein", "mass gainer", "amino", "spor beslenmesi", "protein tozu"],
    primaryCategory: "Fitness & Sağlık",
    subcategory: "Supplement & Spor Beslenmesi",
    purchaseIntent: "High",
    complexity: "Medium",
    audienceAgeRange: "18–34",
    audienceGender: "Mix (Erkek Ağırlıklı)",
    audienceInterests: ["Spor salonu", "Beslenme", "Vücut geliştirme", "Sağlıklı yaşam", "Antrenman"],
    personas: ["Fitness Koçu", "Supplement Yorumcusu", "Bodybuilder Creator", "Dönüşüm Creator'ı", "Lifestyle Fitness Creator'ı", "Nutrition Creator'ı"],
    platforms: ["Instagram", "YouTube", "TikTok"],
    strategicNotes: [
      "Supplement kampanyaları güven üzerine kurulur — uzman creator'lar önceliklendirilmeli.",
      "Before/after içerik formatları bu kategoride yüksek dönüşüm oranı sağlar.",
      "Mikro ve mid-tier fitness creator'ları niş kitleye daha güvenilir mesaj iletir.",
    ],
  },
  cooking: {
    keywords: ["cookware", "kitchen", "food", "recipe", "chef", "pot", "pan", "mutfak", "tencere", "tava", "bıçak", "cook", "grill", "bake", "yemek", "tarif", "tableware", "cutlery"],
    primaryCategory: "Ev & Mutfak",
    subcategory: "Mutfak & Yemek",
    purchaseIntent: "Medium",
    complexity: "Low",
    audienceAgeRange: "25–55",
    audienceGender: "Mix (Kadın Ağırlıklı)",
    audienceInterests: ["Yemek pişirme", "Tarifler", "Ev dekorasyonu", "Mutfak organizasyonu", "Gastronomi"],
    personas: ["Şef Creator", "Yemek Creator'ı", "Tarif Creator'ı", "Ev Yaşam Stili Creator'ı", "Mutfak Organizasyon Creator'ı", "Food Influencer"],
    platforms: ["Instagram", "YouTube", "TikTok"],
    strategicNotes: [
      "Ürünün kullanımını gerçek bir tarifle gösteren demo içerikler çok etkilidir.",
      "Uzun biçimli video içerik (YouTube) bu kategoride yüksek izlenme süresi üretir.",
      "Sezonluk özel günler (bayram, yılbaşı) kampanya zamanlaması için idealdir.",
    ],
  },
  beauty: {
    keywords: ["makeup", "lipstick", "foundation", "mascara", "blush", "eyeshadow", "contour", "concealer", "palette", "makyaj", "beauty", "cosmetics", "güzellik", "kozmetik", "ruj", "fondöten", "highlight", "bronzer"],
    primaryCategory: "Güzellik & Bakım",
    subcategory: "Makyaj",
    purchaseIntent: "High",
    complexity: "Medium",
    audienceAgeRange: "18–40",
    audienceGender: "Kadın Ağırlıklı",
    audienceInterests: ["Makyaj", "Güzellik rutini", "Trend", "Saç bakımı", "Moda"],
    personas: ["Makyaj Sanatçısı", "Beauty Yorumcusu", "Beauty Trend Creator'ı", "Dermatolog Odaklı Creator", "Lifestyle Beauty Creator"],
    platforms: ["Instagram", "TikTok", "YouTube"],
    strategicNotes: [
      "Tutorial ve how-to içerikler güzellik ürünleri için en yüksek dönüşümü sağlar.",
      "TikTok bu kategoride organik viral potansiyeli en yüksek platformdur.",
      "Creator'ın kişisel marka değeri ürün güvenilirliği ile doğrudan bağlantılıdır.",
    ],
  },
  skincare: {
    keywords: ["skincare", "serum", "moisturizer", "sunscreen", "retinol", "vitamin c", "cleanser", "toner", "cilt bakımı", "nemlendirici", "güneş kremi", "serum", "exfoliant", "aha", "bha", "niacinamide", "hyaluronic"],
    primaryCategory: "Güzellik & Bakım",
    subcategory: "Cilt Bakımı",
    purchaseIntent: "Medium",
    complexity: "High",
    audienceAgeRange: "20–45",
    audienceGender: "Mix (Kadın Ağırlıklı)",
    audienceInterests: ["Cilt sağlığı", "Güzellik rutini", "Dermatoloji", "Anti-aging", "Doğal bakım"],
    personas: ["Skincare Uzmanı", "Dermatolog Odaklı Creator", "Güzellik Eğiticisi", "Sağlıklı Yaşam Creator'ı", "Minimalist Beauty Creator"],
    platforms: ["Instagram", "TikTok", "YouTube"],
    strategicNotes: [
      "Cilt bakımı yüksek eğitim içeriği gerektiren bir kategoridir — uzman creator'lar şarttır.",
      "Uzun vadeli kullanım sonuçları (before/after) güvenilirliği artırır.",
      "Dermatoloji odaklı creator'lar bu kategoride premium güven sağlar.",
    ],
  },
  technology: {
    keywords: ["phone", "smartphone", "laptop", "tablet", "computer", "headphone", "earphone", "camera", "tech", "teknoloji", "telefon", "bilgisayar", "kulaklık", "akıllı saat", "smartwatch", "gadget", "drone", "speaker", "bluetooth"],
    primaryCategory: "Teknoloji",
    subcategory: "Tüketici Elektroniği",
    purchaseIntent: "Medium",
    complexity: "Medium",
    audienceAgeRange: "18–40",
    audienceGender: "Mix (Erkek Ağırlıklı)",
    audienceInterests: ["Teknoloji", "Gadget", "İnceleme", "Yazılım", "Oyun"],
    personas: ["Teknoloji Yorumcusu", "Tech Creator", "Gadget İncelemecisi", "Gaming Creator", "Yaşam Tarzı Teknoloji Creator'ı"],
    platforms: ["YouTube", "Instagram", "TikTok"],
    strategicNotes: [
      "Detaylı ürün inceleme içerikleri teknoloji kararlarını doğrudan etkiler.",
      "YouTube bu kategoride en yüksek purchase intent üretir.",
      "Comparison ve benchmark içerikler teknik kitlelerde çok etkilidir.",
    ],
  },
  fashion: {
    keywords: ["clothing", "fashion", "dress", "shirt", "pants", "jacket", "shoe", "sneaker", "accessories", "bag", "moda", "giyim", "elbise", "kıyafet", "ayakkabı", "çanta", "aksesuar", "outfit", "streetwear", "style"],
    primaryCategory: "Moda & Giyim",
    subcategory: "Hazır Giyim",
    purchaseIntent: "High",
    complexity: "Low",
    audienceAgeRange: "16–40",
    audienceGender: "Mix",
    audienceInterests: ["Moda", "Trend", "Stil", "Shopping", "Influencer stili"],
    personas: ["Moda Creator'ı", "Stil Danışmanı", "Trend Editörü", "Lifestyle Creator", "Lüks Moda Creator'ı"],
    platforms: ["Instagram", "TikTok", "YouTube"],
    strategicNotes: [
      "Moda kampanyaları görsel estetik açısından en yüksek standartlara ihtiyaç duyar.",
      "Creator'ın kişisel stil ve kitleyle uyum ürün seçiminden daha önemlidir.",
      "Sezonluk koleksiyon lansmanları için zamanlama kritik önem taşır.",
    ],
  },
  food_beverage: {
    keywords: ["food", "drink", "beverage", "snack", "energy", "coffee", "tea", "juice", "protein bar", "gıda", "içecek", "atıştırmalık", "yiyecek", "enerji içeceği", "kahve", "çay", "smoothie", "healthy", "organic"],
    primaryCategory: "Gıda & İçecek",
    subcategory: "Tüketici Gıdası",
    purchaseIntent: "Medium",
    complexity: "Low",
    audienceAgeRange: "16–45",
    audienceGender: "Mix",
    audienceInterests: ["Yemek", "Sağlıklı beslenme", "Gastronomi", "Kahve kültürü", "Foodie"],
    personas: ["Food Creator", "Yemek Blogcusu", "Sağlıklı Beslenme Creator'ı", "Gastronomi Creator'ı", "Lifestyle Creator"],
    platforms: ["Instagram", "TikTok", "YouTube"],
    strategicNotes: [
      "Gıda ürünleri görsel çekicilik ile satılır — yüksek kalite içerik üretimi zorunlu.",
      "Tarif entegrasyonu ürünü doğal bir bağlamda gösterir ve alım niyetini artırır.",
      "Micro creator'lar niche food community'lerinde daha güvenilir bulunur.",
    ],
  },
  gaming: {
    keywords: ["game", "gaming", "esport", "console", "pc gaming", "streamer", "twitch", "discord", "oyun", "konsol", "bilgisayar oyunu", "fps", "moba", "rpg", "controller", "headset", "gaming chair"],
    primaryCategory: "Oyun & Eğlence",
    subcategory: "Video Oyunları",
    purchaseIntent: "High",
    complexity: "Medium",
    audienceAgeRange: "13–35",
    audienceGender: "Erkek Ağırlıklı",
    audienceInterests: ["Oyun", "Esports", "Yayın", "Teknoloji", "Anime"],
    personas: ["Oyun Yayıncısı", "Gaming Yorumcusu", "Esports Creator", "Teknoloji Gaming Creator'ı", "Casual Gaming Creator"],
    platforms: ["YouTube", "TikTok", "Instagram"],
    strategicNotes: [
      "Gaming kitlesi reklam karşıtlığıyla bilinir — özgün entegrasyon zorunlu.",
      "Livestream ve gerçek zamanlı içerikler bu kitlede en yüksek etkileşimi üretir.",
      "Creator güvenilirliği bu kategoride marka değerinden önce gelir.",
    ],
  },
  travel: {
    keywords: ["travel", "tourism", "hotel", "flight", "vacation", "adventure", "destination", "seyahat", "turizm", "otel", "tatil", "macera", "backpacking", "cruise", "resort", "holiday"],
    primaryCategory: "Seyahat & Turizm",
    subcategory: "Tatil & Destinasyon",
    purchaseIntent: "Medium",
    complexity: "Medium",
    audienceAgeRange: "22–50",
    audienceGender: "Mix",
    audienceInterests: ["Seyahat", "Kültür", "Macera", "Fotoğraf", "Gastronomi"],
    personas: ["Seyahat Creator'ı", "Destinasyon Rehberi", "Bütçe Gezgin Creator'ı", "Lüks Seyahat Creator'ı", "Macera Creator'ı"],
    platforms: ["Instagram", "YouTube", "TikTok"],
    strategicNotes: [
      "Seyahat içerikleri görsel kalitesi en yüksek kategoridir — sinematik üretim şart.",
      "Mevsimsel zamanlama (yaz, kış tatilleri) kritik öneme sahiptir.",
      "Uzun biçimli vlog içerikler bu kategoride en yüksek izlenme süresi üretir.",
    ],
  },
  home: {
    keywords: ["home", "decor", "interior", "furniture", "organization", "cleaning", "ev", "dekorasyon", "mobilya", "organizasyon", "temizlik", "iç mimari", "tasarım", "diy", "apartment", "bedroom", "living room"],
    primaryCategory: "Ev & Dekorasyon",
    subcategory: "Ev Yaşamı",
    purchaseIntent: "Medium",
    complexity: "Low",
    audienceAgeRange: "25–50",
    audienceGender: "Kadın Ağırlıklı",
    audienceInterests: ["İç dekorasyon", "Ev organizasyonu", "DIY", "Minimalizm", "Sürdürülebilirlik"],
    personas: ["Home Lifestyle Creator", "İç Mimar Creator", "DIY Creator", "Organizasyon Creator'ı", "Dekorasyon Creator'ı"],
    platforms: ["Instagram", "TikTok", "YouTube"],
    strategicNotes: [
      "Ev ürünleri gerçek ortamda gösterildiğinde en yüksek ilgiyi çeker.",
      "Before/after dönüşüm içerikleri bu kategoride viral potansiyel taşır.",
      "Mevsimsel dekorasyon trendi kampanya zamanlaması için kullanılabilir.",
    ],
  },
};

// ── Goal Metadata ─────────────────────────────────────────────────────────────

export const GOAL_META: Record<GoalType, {
  label: string; icon: string; desc: string;
  portfolioStrategy: Record<TierName, number>;
  portfolioRationale: string;
}> = {
  brand_awareness: {
    label: "Marka Bilinirliği",
    icon: "📢",
    desc: "Maksimum görünürlük ve izlenim",
    portfolioStrategy: { "Micro": 10, "Mid-tier": 25, "Macro": 40, "Hero": 25 },
    portfolioRationale: "Farkındalık kampanyaları geniş kitleye ulaşmak için makro ve hero creator'lara ağırlık verir. Mikro creator'lar niche topluluklar için destekleyici rol üstlenir.",
  },
  sales: {
    label: "Satış",
    icon: "💰",
    desc: "Dönüşüm ve gelir odaklı",
    portfolioStrategy: { "Micro": 40, "Mid-tier": 45, "Macro": 12, "Hero": 3 },
    portfolioRationale: "Satış kampanyaları güven ve niş kitle için mikro ve mid-tier creator'lara yoğunlaşır. Bu tier'larda etkileşim kalitesi ve kitle güveni daha yüksektir.",
  },
  engagement: {
    label: "Etkileşim",
    icon: "💬",
    desc: "Topluluk oluşturma ve etkileşim",
    portfolioStrategy: { "Micro": 35, "Mid-tier": 45, "Macro": 15, "Hero": 5 },
    portfolioRationale: "Etkileşim kampanyaları güçlü topluluk bağlantısı olan creator'larla çalışır. Mikro ve mid-tier creator'lar daha yüksek ER oranı sergiler.",
  },
  product_launch: {
    label: "Ürün Lansmanı",
    icon: "🚀",
    desc: "Yeni ürün farkındalığı ve talebi",
    portfolioStrategy: { "Micro": 20, "Mid-tier": 35, "Macro": 30, "Hero": 15 },
    portfolioRationale: "Lansman kampanyaları farkındalık ve güven dengesini kurar. Dengeli tier dağılımı hem geniş kitleye ulaşım hem de satışa dönüşüm sağlar.",
  },
};

const TIER_COLORS: Record<TierName, string> = {
  "Micro":    "#10B981",
  "Mid-tier": "#6366F1",
  "Macro":    "#F59E0B",
  "Hero":     "#EC4899",
};

const TIER_LABELS: Record<TierName, string> = {
  "Micro":    "Mikro",
  "Mid-tier": "Mid-tier",
  "Macro":    "Makro",
  "Hero":     "Hero",
};

// ── Helper: Country Normalization ─────────────────────────────────────────────

const COUNTRY_ALIASES: Record<string, string> = {
  "turkey": "türkiye", "tr": "türkiye", "türkiye": "türkiye", "turkiye": "türkiye",
  "usa": "usa", "united states": "usa", "us": "usa", "america": "usa",
  "uk": "uk", "united kingdom": "uk", "england": "uk", "britain": "uk", "gb": "uk",
  "germany": "almanya", "almanya": "almanya", "de": "almanya", "deutschland": "almanya",
  "france": "fransa", "fransa": "fransa", "fr": "fransa",
  "spain": "ispanya", "ispanya": "ispanya", "es": "ispanya",
  "italy": "italya", "italya": "italya", "it": "italya",
  "russia": "rusya", "rusya": "rusya", "ru": "rusya",
  "brazil": "brezilya", "brezilya": "brezilya", "br": "brezilya",
};

function normalizeCountry(raw: string): string {
  const c = raw.toLowerCase().trim();
  return COUNTRY_ALIASES[c] || c;
}

// ── Helper: Creator Tier ───────────────────────────────────────────────────────

export function getCreatorTier(followers: number): TierName {
  if (followers < 100_000)   return "Micro";
  if (followers < 500_000)   return "Mid-tier";
  if (followers < 2_000_000) return "Macro";
  return "Hero";
}

// ── Module 1: Campaign Understanding Engine ───────────────────────────────────

export function interpretCampaign(config: SimConfig): CampaignProfile {
  const productLower   = (config.product || "").toLowerCase();
  const categoryLower  = (config.category || "").toLowerCase();

  // 1. Check brand taxonomy (exact/partial match)
  const brandMatch = BRAND_TAXONOMY.find(b =>
    b.brand.toLowerCase() === productLower ||
    productLower.includes(b.brand.toLowerCase()) ||
    b.brand.toLowerCase().includes(productLower)
  );

  if (brandMatch) {
    const catKey = inferCategoryKey(brandMatch.category);
    const profile = CATEGORY_PROFILES[catKey];
    if (profile) {
      return buildProfile(profile, "brand_taxonomy", brandMatch.category, brandMatch.sub);
    }
  }

  // 2. Keyword detection on product name + user category
  const searchText = `${productLower} ${categoryLower}`;
  let bestKey = "";
  let bestScore = 0;
  for (const [key, prof] of Object.entries(CATEGORY_PROFILES)) {
    const hits = prof.keywords.filter(kw => searchText.includes(kw)).length;
    if (hits > bestScore) { bestScore = hits; bestKey = key; }
  }
  if (bestScore > 0) {
    return buildProfile(CATEGORY_PROFILES[bestKey], "keyword");
  }

  // 3. User category field as hint
  if (categoryLower) {
    for (const [key, prof] of Object.entries(CATEGORY_PROFILES)) {
      if (categoryLower.includes(key) || prof.primaryCategory.toLowerCase().includes(categoryLower)) {
        return buildProfile(prof, "user_input");
      }
    }
  }

  // 4. Fallback: general profile
  return {
    detectedFrom:        "fallback",
    primaryCategory:     config.category || "Genel",
    subcategory:         "Belirsiz",
    purchaseIntentLevel: "Medium",
    campaignComplexity:  "Medium",
    audienceAgeRange:    "18–45",
    audienceGender:      "Mix",
    audienceInterests:   ["Genel tüketici", "Yaşam tarzı"],
    recommendedPersonas: ["Lifestyle Creator", "Genel İçerik Creator'ı"],
    recommendedPlatforms:["Instagram", "TikTok"],
    strategicNotes:      ["Kategori belirtilmediğinde creator seçimi daha genel kriterler üzerinden yapılır."],
  };
}

function inferCategoryKey(brandCategory: string): string {
  const bc = brandCategory.toLowerCase();
  if (bc.includes("fitness") || bc.includes("sağlık") || bc.includes("supplement")) return "fitness";
  if (bc.includes("güzellik") && bc.includes("bakım")) {
    if (bc.includes("cilt")) return "skincare";
    return "beauty";
  }
  if (bc.includes("ev") && bc.includes("mutfak")) return "cooking";
  if (bc.includes("ev")) return "home";
  if (bc.includes("teknoloji")) return "technology";
  if (bc.includes("moda") || bc.includes("giyim") || bc.includes("lüks")) return "fashion";
  if (bc.includes("spor")) return "fitness";
  if (bc.includes("gıda") || bc.includes("içecek")) return "food_beverage";
  if (bc.includes("oyun") || bc.includes("eğlence")) return "gaming";
  if (bc.includes("seyahat")) return "travel";
  return "";
}

function buildProfile(prof: CategoryProfile, source: CampaignProfile["detectedFrom"], overrideCat?: string, overrideSub?: string): CampaignProfile {
  return {
    detectedFrom:        source,
    primaryCategory:     overrideCat || prof.primaryCategory,
    subcategory:         overrideSub  || prof.subcategory,
    purchaseIntentLevel: prof.purchaseIntent,
    campaignComplexity:  prof.complexity,
    audienceAgeRange:    prof.audienceAgeRange,
    audienceGender:      prof.audienceGender,
    audienceInterests:   prof.audienceInterests,
    recommendedPersonas: prof.personas,
    recommendedPlatforms:prof.platforms,
    strategicNotes:      prof.strategicNotes,
  };
}

// ── Module 3: Audience Intelligence Engine ────────────────────────────────────

export function buildAudienceIntelligence(profile: CampaignProfile, config: SimConfig): AudienceIntelligence {
  const goal = config.goal;
  const country = config.country || "Global";

  const platformPriority = config.platform === "all"
    ? profile.recommendedPlatforms
    : [config.platform.charAt(0).toUpperCase() + config.platform.slice(1)];

  let personaPriority = [...profile.recommendedPersonas];
  if (goal === "sales")           personaPriority = personaPriority.filter((_, i) => i < 3);
  if (goal === "brand_awareness") personaPriority = personaPriority;
  if (goal === "engagement")      personaPriority = [...personaPriority].reverse().slice(0, 4);

  const primaryAud  = `${profile.audienceAgeRange} yaş, ${profile.audienceGender.toLowerCase()}, ${profile.primaryCategory} ilgili tüketiciler`;
  const secondaryAud = `${country} pazarında genel yaşam tarzı ve benzer kategori ilgili kitle`;

  return {
    primaryAudience:   primaryAud,
    secondaryAudience: secondaryAud,
    ageRange:          profile.audienceAgeRange,
    purchaseIntent:    profile.purchaseIntentLevel === "High" ? "Yüksek" : profile.purchaseIntentLevel === "Medium" ? "Orta" : "Düşük",
    interestClusters:  profile.audienceInterests,
    platformPriority,
    personaPriority,
  };
}

// ── Module 5: Category Relevance ──────────────────────────────────────────────

function computeCategoryRelevance(creatorCategory: string, campaignProfile: CampaignProfile): number {
  if (!creatorCategory) return 40;

  const c = creatorCategory.toLowerCase();
  const cat = campaignProfile.primaryCategory.toLowerCase();
  const sub = campaignProfile.subcategory.toLowerCase();

  if (c === cat) return 100;
  if (c.includes(cat) || cat.includes(c)) return 90;
  if (c.includes(sub) || sub.includes(c)) return 85;

  // Related category groups
  const GROUPS = [
    ["fitness", "spor", "sağlık", "supplement", "beslenme", "gym", "wellness"],
    ["güzellik", "beauty", "makyaj", "makeup", "cilt", "skincare", "kozmetik", "cosmetics"],
    ["ev", "mutfak", "yemek", "kitchen", "cooking", "food", "home", "lifestyle"],
    ["teknoloji", "tech", "gadget", "elektronik", "gaming", "oyun", "bilgisayar"],
    ["moda", "fashion", "giyim", "style", "clothing", "accessories"],
    ["gıda", "food", "içecek", "beverage", "yemek", "tarif", "recipe"],
    ["seyahat", "travel", "turizm", "tourism", "adventure"],
  ];

  for (const group of GROUPS) {
    const creatorInGroup = group.some(kw => c.includes(kw));
    const campaignInGroup = group.some(kw => cat.includes(kw) || sub.includes(kw));
    if (creatorInGroup && campaignInGroup) return 75;
  }

  // Lifestyle as broad relevance
  if (c.includes("lifestyle") || c.includes("yaşam")) return 55;

  return 25;
}

// ── Module 4: Country Filtering ───────────────────────────────────────────────

function computeCountryRelevance(card: DiscoveryCard, config: SimConfig): number {
  if (!config.country) return 65; // no filter = neutral
  const target  = normalizeCountry(config.country);
  const creator = normalizeCountry(card.country || "");
  if (!creator || creator === "global" || creator === "") return 45;
  if (creator === target) return 100;
  // partial / regional match
  if (creator.includes(target) || target.includes(creator)) return 90;
  return 20; // different country
}

// ── Module 7: Creator Quality Score ──────────────────────────────────────────

export function computeCreatorQualityScore(
  card: DiscoveryCard,
  config: SimConfig,
  profile: CampaignProfile
): {
  total: number | null;
  breakdown: QualityBreakdown;
  completeness: DataCompleteness;
  fieldsWithData: number;
  completenessLevel: DataCompletenessLevel;
  completenessLabel: string;
  completenessLevelPct: number;
} {
  // Track which scoring dimensions have real (non-null, non-zero) data
  const hasEngQ      = (card.engagement_quality_score ?? 0) > 0;
  const hasCountry   = !!card.country;
  const hasCategory  = !!card.category;
  const hasFraud     = (card.fraud_score ?? 0) > 0;
  const hasBrandSafe = (card.reputation_risk_score ?? 0) > 0;
  const hasBrandFit  = (card.brand_fit_score ?? 0) > 0;
  const hasGrowth    = (card.momentum_score ?? 0) > 0;

  const fieldsWithData = [hasEngQ, hasCountry, hasCategory, hasFraud, hasBrandSafe, hasBrandFit, hasGrowth]
    .filter(Boolean).length;

  const completenessLevelPct = Math.round((fieldsWithData / 7) * 100);
  const level = completenessLevelFromPct(completenessLevelPct);

  const completeness: DataCompleteness =
    fieldsWithData >= 5 ? "complete" :
    fieldsWithData >= 3 ? "partial"  : "minimal";

  const badge = completenessLabel(completeness, fieldsWithData);

  const countryRel = computeCountryRelevance(card, config);
  const catRel     = computeCategoryRelevance(card.category, profile);

  // If excluded (< 60% completeness), don't produce a score — return null
  // (prevents default 49/50 pattern for insufficient data)
  if (level === "excluded") {
    return {
      total: null,
      completeness,
      fieldsWithData,
      completenessLevel: level,
      completenessLabel: badge,
      completenessLevelPct,
      breakdown: {
        engagementQuality: 0,
        countryRelevance:  Math.round(countryRel),
        categoryRelevance: Math.round(catRel),
        fraudSafety:       0,
        brandSafety:       0,
        brandFit:          0,
        growthStability:   0,
      },
    };
  }

  // Use real values where available; fall back to neutral estimates only when missing
  const engQ      = Math.min(100, hasEngQ ? card.engagement_quality_score! : 50);
  const fraudSafe = Math.max(0, 100 - (hasFraud ? card.fraud_score! : 50));
  const brandSafe = Math.max(0, 100 - (hasBrandSafe ? card.reputation_risk_score! : 30));
  const brandFit  = Math.min(100, hasBrandFit ? card.brand_fit_score! : 50);
  const growth    = Math.min(100, hasGrowth ? card.momentum_score! : 50);

  const total = Math.round(
    engQ       * 0.20 +
    countryRel * 0.20 +
    catRel     * 0.20 +
    fraudSafe  * 0.15 +
    brandSafe  * 0.10 +
    brandFit   * 0.10 +
    growth     * 0.05
  );

  return {
    total,
    completeness,
    fieldsWithData,
    completenessLevel: level,
    completenessLabel: badge,
    completenessLevelPct,
    breakdown: {
      engagementQuality: Math.round(engQ),
      countryRelevance:  Math.round(countryRel),
      categoryRelevance: Math.round(catRel),
      fraudSafety:       Math.round(fraudSafe),
      brandSafety:       Math.round(brandSafe),
      brandFit:          Math.round(brandFit),
      growthStability:   Math.round(growth),
    },
  };
}

// ── Module 6: Creator Persona Matching ────────────────────────────────────────

function matchPersona(card: DiscoveryCard, profile: CampaignProfile): { persona: string; reason: string } {
  const personas = profile.recommendedPersonas;
  if (!personas.length) {
    return { persona: "Genel Creator", reason: "Kampanya kategorisi ile geniş uyum." };
  }

  const cat = (card.category || "").toLowerCase();
  const bio = (card.bio || "").toLowerCase();
  const combined = `${cat} ${bio}`;

  // Score each persona by keyword overlap
  const scored = personas.map(persona => {
    const pLower = persona.toLowerCase();
    const words  = pLower.split(/[\s']+/);
    const hits   = words.filter(w => w.length > 3 && combined.includes(w)).length;
    return { persona, hits };
  });
  scored.sort((a, b) => b.hits - a.hits);

  const best = scored[0];
  const er   = card.engagement_rate || 0;

  let reason = "";
  if (best.hits > 0) {
    reason = `Creator'ın içerik kategorisi (${card.category || "genel"}) ${best.persona} profiline doğrudan uyum gösteriyor.`;
  } else {
    reason = er >= 5
      ? `Yüksek etkileşim oranı (${er.toFixed(1)}%) ile kampanya hedef kitlesine güçlü bağlantı kurabilir.`
      : `${card.category || "Genel"} kategorisinde hedef kitle uyumu gözlemleniyor.`;
  }

  return { persona: best.persona, reason };
}

// ── Module 13: Explainability Engine ─────────────────────────────────────────

function buildWhySelected(
  card: DiscoveryCard,
  config: SimConfig,
  breakdown: QualityBreakdown,
  persona: string
): string {
  const parts: string[] = [];

  if (breakdown.countryRelevance >= 85)      parts.push(`güçlü ${config.country || "yerel"} kitle uyumu`);
  else if (breakdown.countryRelevance >= 65)  parts.push(`${config.country || "hedef"} pazarında varlık`);

  if (breakdown.categoryRelevance >= 85)     parts.push(`${card.category} kategorisinde yüksek uyum`);
  else if (breakdown.categoryRelevance >= 65) parts.push(`alakalı içerik kategorisi`);

  if (breakdown.engagementQuality >= 75)     parts.push(`yüksek etkileşim kalitesi`);
  if (breakdown.fraudSafety >= 85)           parts.push(`düşük fraud riski`);
  if (breakdown.brandSafety >= 85)           parts.push(`güvenli marka profili`);
  if (breakdown.brandFit >= 75)              parts.push(`güçlü marka uyum skoru`);

  const base = parts.length
    ? `${parts.join(", ")} nedeniyle önerildi`
    : "Genel kampanya kriterleriyle uyum nedeniyle önerildi";

  return `${base}. ${persona} olarak hedef kitleye doğrudan hitap kapasitesine sahip.`;
}

// ── Module 10: Forecast Estimation (ranges only, no conversions) ──────────────

const REACH_RATES: Record<string, { low: number; expected: number; high: number }> = {
  instagram: { low: 0.07, expected: 0.13, high: 0.22 },
  tiktok:    { low: 0.12, expected: 0.22, high: 0.40 },
  youtube:   { low: 0.18, expected: 0.28, high: 0.45 },
};

function estimateCreatorReach(card: DiscoveryCard, config: SimConfig): RangeEstimate {
  const platform = config.platform === "all" ? card.platform : config.platform;
  const rates    = REACH_RATES[platform] || REACH_RATES.instagram;
  const durMult  = Math.min(2.2, Math.sqrt(Math.max(1, config.duration) / 4));
  const erBoost  = 0.85 + ((card.engagement_quality_score || 50) / 100) * 0.30;

  const low      = Math.floor(card.followers * rates.low  * durMult);
  const expected = Math.floor(card.followers * rates.expected * durMult * erBoost);
  const high     = Math.floor(card.followers * rates.high * durMult);

  const conf: ConfidenceLevel = (card.engagement_quality_score || 0) >= 70 ? "High"
    : (card.engagement_quality_score || 0) >= 40 ? "Medium" : "Low";

  return {
    low, expected, high, confidence: conf,
    basis: "Takipçi sayısı, platform organik erişim oranı ve etkileşim kalitesi verisine dayalı tahmin.",
  };
}

function estimateCreatorEngagement(card: DiscoveryCard, reach: RangeEstimate): RangeEstimate {
  const er = (card.engagement_rate || 0) / 100;
  return {
    low:      Math.floor(reach.low      * er * 0.8),
    expected: Math.floor(reach.expected * er),
    high:     Math.floor(reach.high     * er * 1.2),
    confidence: reach.confidence,
    basis: "Gerçek etkileşim oranı ve tahminsel erişim aralığına dayalı hesaplama.",
  };
}

// ── Module 8: Portfolio Builder ───────────────────────────────────────────────

function buildPortfolio(creators: EnrichedCreator[], config: SimConfig): PortfolioSummary {
  const goalMeta    = GOAL_META[config.goal];
  const strategy    = goalMeta.portfolioStrategy;

  const tierGroups: Record<TierName, EnrichedCreator[]> = {
    "Micro": [], "Mid-tier": [], "Macro": [], "Hero": [],
  };
  creators.forEach(c => tierGroups[c.tier].push(c));

  const tiers: PortfolioTierSummary[] = (Object.entries(tierGroups) as [TierName, EnrichedCreator[]][])
    .filter(([, cs]) => cs.length > 0)
    .map(([name, cs]) => {
      const allocBudget = cs.reduce((s, c) => s + c.allocatedBudget, 0);
      const tierPct     = Math.round((allocBudget / config.budget) * 100);
      const stratPct    = strategy[name];
      const rationale   = tierPct >= stratPct
        ? `${TIER_LABELS[name]} creator'lar bu hedefe uygun bütçe payı aldı.`
        : `Veritabanındaki ${TIER_LABELS[name]} creator sayısı stratejik hedefin altında — portföy optimizasyon fırsatı var.`;
      return {
        name, label: TIER_LABELS[name],
        count: cs.length, budgetPct: tierPct, budgetAbs: Math.round(allocBudget),
        rationale, color: TIER_COLORS[name],
      };
    });

  return {
    strategy:      `${goalMeta.label} hedefi için optimal portföy yapısı`,
    goalRationale: goalMeta.portfolioRationale,
    tiers,
    totalCreators: creators.length,
  };
}

// ── Module 11: Confidence Engine ─────────────────────────────────────────────

function computeConfidence(
  creators: EnrichedCreator[],
  config: SimConfig,
): ConfidenceScore {
  const n = creators.length;
  if (n === 0) {
    return {
      overall: 15, grade: "D",
      creatorDataQuality: 0, audienceMatchConfidence: 15,
      countryMatchConfidence: 0, categoryMatchConfidence: 0,
      portfolioReliability: 0,
      forecastAvailability: "Unavailable",
      forecastReason: "Creator veritabanı boş — tüm tahminler yetersiz veri nedeniyle kullanılamaz.",
    };
  }

  const avgQuality   = creators.reduce((s, c) => s + (c.qualityScore ?? 0), 0) / n;
  const countryHits  = creators.filter(c => c.countryMatch).length;
  const countryConf  = config.country ? Math.round((countryHits / n) * 100) : 60;
  const catConf      = Math.round(creators.reduce((s, c) => s + c.qualityBreakdown.categoryRelevance, 0) / n);
  const audConf      = Math.round(avgQuality * 0.85);
  const portRel      = Math.min(100, n * 12 + 15);

  const overall = Math.round(
    avgQuality * 0.30 +
    countryConf * 0.20 +
    catConf     * 0.20 +
    audConf     * 0.15 +
    portRel     * 0.15
  );
  const grade: ConfidenceScore["grade"] = overall >= 80 ? "A" : overall >= 65 ? "B" : overall >= 50 ? "C" : "D";

  return {
    overall, grade,
    creatorDataQuality:      Math.round(avgQuality),
    audienceMatchConfidence: audConf,
    countryMatchConfidence:  countryConf,
    categoryMatchConfidence: catConf,
    portfolioReliability:    Math.round(portRel),
    forecastAvailability:    "Low",
    forecastReason: "Dönüşüm ve gelir tahminleri için geçmiş kampanya verisi gereklidir. Bu simülasyon yalnızca erişim ve etkileşim aralıkları üretmektedir. ROAS, Revenue ve Conversion metrikleri gerçek kampanya çalıştırılıp performans verisi birikene kadar hesaplanamaz.",
  };
}

// ── Module 12: Feasibility Engine ─────────────────────────────────────────────

function assessFeasibility(
  config: SimConfig,
  creators: EnrichedCreator[],
): FeasibilityScore {
  const reasons: string[] = [];
  let score = 65;

  // Budget check
  if (config.budget < 1000) {
    score -= 25;
    reasons.push("Bütçe çok düşük — seçili hedef ve creator tier için minimum etki beklenmektedir.");
  } else if (config.budget < 5000) {
    score -= 10;
    reasons.push("Bütçe sınırlı — mikro-tier portföy ile verimli kullanılabilir.");
  } else if (config.budget >= 20000) {
    score += 10;
    reasons.push("Güçlü bütçe — makro ve mid-tier portföy stratejisi için uygun.");
  } else {
    reasons.push("Bütçe mid-tier portföy yapısı için dengeli seviyede.");
  }

  // Creator count
  if (creators.length === 0) {
    score -= 40;
    reasons.push("Veritabanında eşleşen creator bulunamadı — simülasyon kapsamı çok sınırlı.");
  } else if (creators.length < 3) {
    score -= 15;
    reasons.push(`${creators.length} creator ile portföy çeşitliliği yetersiz — risk yoğunlaşmış.`);
  } else if (creators.length >= 5) {
    score += 8;
    reasons.push(`${creators.length} creator ile portföy çeşitliliği iyi düzeyde.`);
  }

  // Country match
  if (config.country && creators.length > 0) {
    const matchPct = (creators.filter(c => c.countryMatch).length / creators.length) * 100;
    if (matchPct < 25) {
      score -= 12;
      reasons.push(`Ülke eşleşmesi düşük (%${matchPct.toFixed(0)}) — yerel kitle kalitesi sınırlı.`);
    } else if (matchPct > 60) {
      score += 8;
      reasons.push(`Güçlü ülke eşleşmesi (%${matchPct.toFixed(0)}) — yerel hedefleme optimize.`);
    }
  }

  // Duration
  if (config.duration < 4) {
    score -= 8;
    reasons.push("Kısa kampanya süresi platform algoritmalarının optimizasyonunu kısıtlar.");
  } else if (config.duration >= 8) {
    score += 5;
    reasons.push("Uzun kampanya süresi momentum ve markalaşma için avantaj sağlar.");
  }

  score = Math.max(0, Math.min(100, score));
  const level: FeasibilityScore["level"] = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";
  return { level, score, reasons };
}

// ── Module 9: Duplicate Protection ───────────────────────────────────────────

function deduplicateCreators(cards: DiscoveryCard[]): DiscoveryCard[] {
  const seen = new Set<string>();
  return cards.filter(c => {
    const key = `${c.username.toLowerCase()}::${c.platform.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main: runIntelligentSimulation ────────────────────────────────────────────

export function runIntelligentSimulation(
  config: SimConfig,
  rawCards: DiscoveryCard[]
): SimResultV2 {
  // Campaign understanding
  const campaignProfile      = interpretCampaign(config);
  const audienceIntelligence = buildAudienceIntelligence(campaignProfile, config);

  // Deduplicate
  const unique = deduplicateCreators(rawCards);
  const usedFallback = rawCards.length === 0;

  if (unique.length === 0) {
    return buildEmptyResult(config, campaignProfile, audienceIntelligence);
  }

  // Count how many will be excluded for data source notes
  const excludedCount = unique.filter(card => {
    const hasEngQ      = (card.engagement_quality_score ?? 0) > 0;
    const hasCountry   = !!card.country;
    const hasCategory  = !!card.category;
    const hasFraud     = (card.fraud_score ?? 0) > 0;
    const hasBrandSafe = (card.reputation_risk_score ?? 0) > 0;
    const hasBrandFit  = (card.brand_fit_score ?? 0) > 0;
    const hasGrowth    = (card.momentum_score ?? 0) > 0;
    const fieldsWithData = [hasEngQ, hasCountry, hasCategory, hasFraud, hasBrandSafe, hasBrandFit, hasGrowth].filter(Boolean).length;
    return (fieldsWithData / 7) * 100 < COMPLETENESS_EXCLUDE_THRESHOLD;
  }).length;

  // Score every creator with the new quality engine
  const scored = unique.map(card => {
    const result = computeCreatorQualityScore(card, config, campaignProfile);
    return { card, ...result };
  });

  // Filter out EXCLUDED creators (completeness < 60%) — no archive fallback
  const eligible = scored.filter(s => s.completenessLevel !== "excluded");

  // Sort by quality score (null scores last, then by score desc)
  eligible.sort((a, b) => {
    if (a.total === null && b.total === null) return 0;
    if (a.total === null) return 1;
    if (b.total === null) return -1;
    return b.total - a.total;
  });

  // Select top 8 creators
  const selected = eligible.slice(0, 8);

  // Budget allocation: quality-weighted with confidence scaling
  // Low-confidence creators are capped at BUDGET_CAP_LOW_CONF of total budget
  const weights = selected.map(s => {
    if (s.total === null) return 0;
    const confMult =
      s.completenessLevel === "low_confidence" ? 0.6 :
      s.completenessLevel === "normal" ? 1.0 : 0.0;
    return Math.pow(s.total / 100, 1.8) * confMult;
  });
  const totalWt = weights.reduce((a, b) => a + b, 0);

  // Build EnrichedCreator list
  const creators: EnrichedCreator[] = selected.map((s, i) => {
    let allocBudget = totalWt > 0
      ? (weights[i] / totalWt) * config.budget
      : config.budget / Math.max(1, selected.length);

    let budgetCapApplied = false;

    // Apply budget cap for low-confidence creators
    if (s.completenessLevel === "low_confidence") {
      const cap = config.budget * BUDGET_CAP_LOW_CONF;
      if (allocBudget > cap) {
        allocBudget = cap;
        budgetCapApplied = true;
      }
    }

    const budgetPct   = (allocBudget / config.budget) * 100;
    const tier        = getCreatorTier(s.card.followers);
    const { persona } = matchPersona(s.card, campaignProfile);
    const reach       = estimateCreatorReach(s.card, config);
    const engagement  = estimateCreatorEngagement(s.card, reach);
    const countryMatch = config.country
      ? normalizeCountry(s.card.country || "") === normalizeCountry(config.country)
      : false;
    const catScore    = s.breakdown.categoryRelevance;
    const whySelected = buildWhySelected(s.card, config, s.breakdown, persona);

    let sourceLabel: string;
    if (s.card.source === "archive") {
      sourceLabel =
        s.completenessLevel === "low_confidence" ? "Arşiv · Düşük Güven" :
        s.completeness === "minimal" ? "Arşiv · Veri Yetersiz" : "Arşiv · Kısmi Veri";
    } else {
      sourceLabel = "Analiz · Gerçek Veri";
    }

    return {
      card:               s.card,
      qualityScore:       s.total,      // may be null if somehow missed filter
      qualityBreakdown:   s.breakdown,
      tier,
      tierLabel:          TIER_LABELS[tier],
      persona,
      whySelected,
      countryMatch,
      categoryMatch:      catScore >= 65,
      allocatedBudget:    allocBudget,
      budgetPct,
      budgetCapApplied,
      estimatedReach:     reach,
      estimatedEngagement:engagement,
      dataCompleteness:   s.completeness,
      dataCompletenessFields: s.fieldsWithData,
      dataCompletenessPct: s.completenessLevelPct,
      completenessLevel:  s.completenessLevel,
      completenessLabel:  s.completenessLabel,
      sourceLabel,
    };
  });

  // Aggregate reach & engagement (independent ranges, not sum — audience overlap)
  const overlapFactor = 0.75; // conservative de-duplication
  const totalReach: RangeEstimate = {
    low:      Math.floor(creators.reduce((s, c) => s + c.estimatedReach.low, 0) * overlapFactor),
    expected: Math.floor(creators.reduce((s, c) => s + c.estimatedReach.expected, 0) * overlapFactor),
    high:     Math.floor(creators.reduce((s, c) => s + c.estimatedReach.high, 0) * overlapFactor),
    confidence: aggregateConfidence(creators.map(c => c.estimatedReach.confidence)),
    basis: "Audience overlap faktörü (%75) uygulanarak hesaplanmış kümülatif erişim tahmini.",
  };
  const totalEngagement: RangeEstimate = {
    low:      creators.reduce((s, c) => s + c.estimatedEngagement.low, 0),
    expected: creators.reduce((s, c) => s + c.estimatedEngagement.expected, 0),
    high:     creators.reduce((s, c) => s + c.estimatedEngagement.high, 0),
    confidence: aggregateConfidence(creators.map(c => c.estimatedEngagement.confidence)),
    basis: "Gerçek etkileşim oranları ve tahminsel erişim aralığına dayalı hesaplama.",
  };

  // CPE estimate (based on real engagement data only)
  const estimatedCPE: { low: number; high: number } | null =
    totalEngagement.expected > 0
      ? {
          low:  parseFloat((config.budget / totalEngagement.high).toFixed(2)),
          high: parseFloat((config.budget / Math.max(1, totalEngagement.low)).toFixed(2)),
        }
      : null;

  const portfolio   = buildPortfolio(creators, config);
  const confidence  = computeConfidence(creators, config);
  const feasibility = assessFeasibility(config, creators);

  const avgQuality  = Math.round(creators.reduce((s, c) => s + (c.qualityScore ?? 0), 0) / creators.length);
  const avgFraud    = Math.round(creators.reduce((s, c) => s + c.card.fraud_score, 0) / creators.length);
  const countryHits = creators.filter(c => c.countryMatch).length;
  const catHits     = creators.filter(c => c.categoryMatch).length;
  const microCount  = creators.filter(c => c.tier === "Micro").length;
  const macroCount  = creators.filter(c => c.tier === "Macro" || c.tier === "Hero").length;

  const insights = buildInsights(creators, config, campaignProfile, avgQuality, avgFraud, countryHits, catHits);
  const opportunities = buildOpportunities(creators, config, confidence);
  const risks = buildRisks(creators, config, avgFraud, microCount, macroCount);
  const nextActions = buildNextActions(config, creators);
  const summary = buildSummary(config, campaignProfile, creators, totalReach, confidence, feasibility, countryHits, catHits);
  const dataSourceNotes = buildDataSourceNotes(creators, excludedCount);

  return {
    campaignProfile,
    audienceIntelligence,
    creators,
    portfolio,
    totalReach,
    totalEngagement,
    estimatedCPE,
    revenueUnavailable:    true,
    conversionUnavailable: true,
    roasUnavailable:       true,
    confidence,
    feasibility,
    insights,
    opportunities,
    risks,
    nextActions,
    summary,
    dataSourceNotes,
    creatorsFromDB: unique.length,
    excludedFromPortfolio: excludedCount,
    usedFallbackData: usedFallback,
    reportSource: "client_simulation_preview",
  };
}

function aggregateConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.every(l => l === "High"))   return "High";
  if (levels.some(l => l === "Low"))     return "Low";
  return "Medium";
}

function buildEmptyResult(config: SimConfig, profile: CampaignProfile, aud: AudienceIntelligence): SimResultV2 {
  const conf: ConfidenceScore = {
    overall: 12, grade: "D",
    creatorDataQuality: 0, audienceMatchConfidence: 20,
    countryMatchConfidence: 0, categoryMatchConfidence: 0,
    portfolioReliability: 0,
    forecastAvailability: "Unavailable",
    forecastReason: "Creator veritabanı boş — erişim ve etkileşim tahminleri yapılamıyor.",
  };
  const feas: FeasibilityScore = { level: "Low", score: 15, reasons: ["Veritabanında creator bulunamadı — discovery veya analyze bölümünden influencer ekleyin."] };
  const zeroRange: RangeEstimate = { low: 0, expected: 0, high: 0, confidence: "Low", basis: "Veri yetersiz." };
  return {
    campaignProfile: profile, audienceIntelligence: aud,
    creators: [], portfolio: { strategy: "", goalRationale: GOAL_META[config.goal].portfolioRationale, tiers: [], totalCreators: 0 },
    totalReach: zeroRange, totalEngagement: zeroRange, estimatedCPE: null,
    revenueUnavailable: true, conversionUnavailable: true, roasUnavailable: true,
    confidence: conf, feasibility: feas,
    insights: ["Veritabanında influencer verisi bulunamadı. Simülasyon için önce Discovery veya Analyze bölümünden creator analizi yapın."],
    opportunities: ["Discovery'den influencer aratın → Analyze edin → simülasyon tekrar çalıştırın."],
    risks: ["Creator olmadan simülasyon genel endüstri ortalamalarına bile dayanamaz — sonuçlar anlamsız olur."],
    nextActions: ["Discovery sayfasından kategori ve ülke filtresiyle influencer aratın.", "En az 5 influencer analiz edin.", "Bu simülasyonu yeniden çalıştırın."],
    summary: "Creator veritabanı boş olduğundan bu simülasyon anlamlı sonuç üretemiyor. Discovery bölümünden influencer analizi yapıldıkça simülasyon gerçek veri ile çalışacak.",
    dataSourceNotes: ["Creator verisi bulunamadı. Tüm tahminler yapılamaz durumda."],
    creatorsFromDB: 0, excludedFromPortfolio: 0, usedFallbackData: true,
    reportSource: "insufficient_data",
  };
}

function buildInsights(
  creators: EnrichedCreator[], config: SimConfig, profile: CampaignProfile,
  avgQuality: number, avgFraud: number, countryHits: number, catHits: number
): string[] {
  const n = creators.length;
  const insights: string[] = [];

  insights.push(
    avgQuality >= 70
      ? `Portföy ortalama ${avgQuality} kalite skoru ile güçlü uyum sergiliyor.`
      : `Portföy ortalama ${avgQuality} kalite skoru — daha alakalı creator'lar eklenerek iyileştirilebilir.`
  );

  if (config.country) {
    insights.push(
      countryHits === n
        ? `Tüm creator'lar ${config.country} pazarında konumlanmış — güçlü yerel hedefleme.`
        : countryHits > n / 2
        ? `Creator'ların %${Math.round((countryHits / n) * 100)}'i ${config.country} pazarında — yerel odak dengeli.`
        : `Creator'ların yalnızca %${Math.round((countryHits / n) * 100)}'i ${config.country}'den — ülke filtresini güçlendirmek faydalı olabilir.`
    );
  }

  insights.push(
    catHits >= n * 0.7
      ? `Creator'ların %${Math.round((catHits / n) * 100)}'i ${profile.primaryCategory} kategorisiyle yüksek uyum gösteriyor.`
      : `Kategori uyumu geliştirilebilir — ${profile.primaryCategory} odaklı creator sayısını artırmak verimlilik sağlar.`
  );

  insights.push(
    avgFraud < 20
      ? `Portföy istisnai düşük fraud riski sergiliyor (Ort: ${avgFraud}) — güvenli içerik ortağı.`
      : avgFraud < 40
      ? `Fraud riski kabul edilebilir sınırlarda (Ort: ${avgFraud}) — rutin izleme yeterli.`
      : `Fraud riski yüksek (Ort: ${avgFraud}) — kampanya öncesi ek doğrulama zorunlu.`
  );

  insights.push(...profile.strategicNotes.slice(0, 1));

  return insights.slice(0, 5);
}

function buildOpportunities(creators: EnrichedCreator[], config: SimConfig, conf: ConfidenceScore): string[] {
  const opps: string[] = [];
  const n = creators.length;

  if (n < 4) opps.push("Creator portföyünü genişletmek audience overlap riskini azaltır ve güvenilirliği artırır.");
  else        opps.push("Mevcut portföy çeşitliliği iyi — uzun vadeli creator ortaklıkları maliyetleri düşürür.");

  if (config.country && conf.countryMatchConfidence < 50)
    opps.push(`${config.country} pazarına özel creator araması yapılarak yerel uyum güçlendirilebilir.`);
  else
    opps.push("Coğrafi hedeflemeli creator seçimi yerel audience trust'ı önemli ölçüde artırır.");

  if (creators.filter(c => c.tier === "Micro").length < 2)
    opps.push("Portföye 2–3 mikro creator eklenmesi CPE verimliliğini ve etkileşim derinliğini artırır.");
  else
    opps.push("Mikro creator tabanı sağlıklı — video formatı çeşitlendirmesi ek değer yaratabilir.");

  opps.push(`${config.duration < 8 ? "Kampanya süresini 8 haftaya çıkarmak" : "Uzun kampanya süresi"} platform algoritması optimizasyonunu destekler ve CPE'yi düşürür.`);

  return opps;
}

function buildRisks(
  creators: EnrichedCreator[], config: SimConfig,
  avgFraud: number, microCount: number, macroCount: number
): string[] {
  const risks: string[] = [];
  const n = creators.length;

  if (n <= 2) risks.push("Düşük creator çeşitliliği — tek creator'ın başarısızlığı kampanya bütçesinin büyük bölümünü etkiler.");
  else        risks.push("Creator sayısı dengeli — bütçe yeterince dağıtılmış, konsantrasyon riski makul.");

  if (avgFraud > 35) risks.push(`Yüksek ortalama fraud riski (${avgFraud}) — kampanya başlamadan creator doğrulaması yapılmalı.`);
  else risks.push(`Fraud riski kontrol altında (${avgFraud}) — standart izleme süreci yeterli.`);

  if (macroCount > microCount && n > 2)
    risks.push("Büyük creator ağırlığı bütçe konsantrasyonu riski oluşturur — performans garantisi olmadan yüksek taahhüt.");
  else
    risks.push("Bütçe dağılımı dengeli — büyük creator'lara aşırı bağımlılık yok.");

  if (config.duration < 4)
    risks.push("4 haftadan kısa kampanya süreleri optimizasyon için yetersiz — platform algoritmalarının öğrenmesi sınırlı kalır.");
  else
    risks.push("Kampanya süresi yeterli — platform momentum oluşturmak için uygun pencere mevcut.");

  return risks;
}

function buildNextActions(config: SimConfig, creators: EnrichedCreator[]): string[] {
  const budget1st = config.budget * 0.3;
  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`;
  return [
    "Creator'larla resmi iletişime geçin — availability ve rate kart talep edin.",
    "Her creator için kampanya briefi hazırlayın — ürün pozisyonlama ve mesaj kılavuzu dahil.",
    "UTM tracking parametrelerini ve tıklama attribution sistemini kurun.",
    `İlk hafta ${fmt(budget1st)} pilot bütçeyle başlayın — performans verisi toplayıp ölçeklendirin.`,
    "Günlük izleme dashboard'u kurun — ilk 72 saatte etkileşim trendini analiz edin.",
    creators.length > 0
      ? `En yüksek kalite skoru alan @${creators[0].card.username}'a öncelikli bütçe tahsis edin.`
      : "Veritabanına creator eklendikten sonra bu simülasyonu tekrar çalıştırın.",
  ];
}

function buildSummary(
  config: SimConfig,
  profile: CampaignProfile,
  creators: EnrichedCreator[],
  reach: RangeEstimate,
  conf: ConfidenceScore,
  feas: FeasibilityScore,
  countryHits: number,
  catHits: number
): string {
  const n = creators.length;
  const platLabel = config.platform === "all" ? "çoklu platform" : config.platform;
  const goal = GOAL_META[config.goal].label;
  const budget = config.budget >= 1000 ? `$${(config.budget / 1000).toFixed(0)}K` : `$${config.budget}`;

  if (n === 0) return "Veritabanında creator bulunamadığından strateji üretilemedi. Discovery bölümünden creator analizi ekleyin.";

  const countryNote = config.country && countryHits > 0
    ? `, ${n} creator'dan ${countryHits}'i ${config.country} pazarında konumlanmış`
    : "";

  const catNote = catHits > 0
    ? `${catHits}'i ${profile.primaryCategory} kategorisiyle yüksek uyum gösteriyor`
    : `kategori uyumu geliştirilmesi öneriliyor`;

  return (
    `Bu ${budget} bütçeli, ${config.duration} haftalık ${platLabel} kampanyası ` +
    `${goal} hedefine yönelik ${n} creator ile yapılandırılmıştır. ` +
    `Creator portföyünün ${catNote}${countryNote}. ` +
    `Portföy güven skoru ${conf.overall}/100 (${conf.grade} seviye) — ` +
    `${conf.grade === "A" || conf.grade === "B" ? "güvenilir bir veri tabanına dayanıyor" : "veri kalitesi artırılarak iyileştirilebilir"}. ` +
    `Kampanya fizibilite değerlendirmesi: ${feas.level === "High" ? "Yüksek" : feas.level === "Medium" ? "Orta" : "Düşük"}. ` +
    `Tahmini erişim aralığı: ${fmt(reach.low)}–${fmt(reach.high)} kişi (${reach.confidence} güven). ` +
    `Dönüşüm, gelir ve ROAS metrikleri gerçek kampanya verisi birikene kadar gösterilememektedir — bu bir güvenilirlik taahhüdüdür.`
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

function buildDataSourceNotes(creators: EnrichedCreator[], excludedCount = 0): string[] {
  const notes: string[] = [
    "Erişim ve etkileşim tahminleri: Gerçek takipçi sayısı, platform organik erişim oranı ve etkileşim kalitesi verisine dayalı — tahmini aralık.",
    "Creator Kalite Skoru: Etkileşim kalitesi, ülke uyumu, kategori uyumu, fraud güvenliği, marka güvenliği ve büyüme stabilitesine dayalı — gerçek veri.",
    "Fraud Skoru, Marka Uyum Skoru, ROI Potansiyeli: İç analiz motorundan alınan gerçek skorlar — tahminsel değil.",
    "Revenue / ROAS / Conversion: Geçmiş kampanya performans verisi olmadığından hesaplanamıyor — gerçek kampanya sonrası ölçülmeli.",
    "Bütçe tahsisi: Creator kalite ve veri güveni ağırlıklı algoritmik dağılım — marka tercihine göre manuel ayar önerilir.",
  ];

  if (excludedCount > 0) {
    notes.push(
      `${excludedCount} creator yetersiz veri kalitesi nedeniyle (veri tamamlama skoru < %60) portföye alınmadı. ` +
      `Bu creator'lar için gerçek analiz yapılması simülasyon kalitesini artıracaktır.`
    );
  }

  const archiveCount = creators.filter(c => c.card.source === "archive").length;
  const lowConfCount = creators.filter(c => c.completenessLevel === "low_confidence").length;

  if (archiveCount > 0) {
    notes.push(
      `${archiveCount} creator arşivden geliyor — kişisel analizinizden değil. ` +
      `Arşiv verisi yalnızca doğrulanmış profillere ait — ham import verisi portföye dahil edilmez.`
    );
  }
  if (lowConfCount > 0) {
    notes.push(
      `${lowConfCount} creator düşük veri güveniyle portföyde (%60–%75 tamamlanma). ` +
      `Bu creator'ların bütçesi %${Math.round((BUDGET_CAP_LOW_CONF * 100))} ile sınırlandırıldı.`
    );
  }
  if (creators.some(c => !c.card.country)) {
    notes.push("Bazı creator'larda ülke verisi eksik — ülke uyum skoru konservatif hesaplandı.");
  }
  return notes;
}
