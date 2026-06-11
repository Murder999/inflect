import { NextRequest, NextResponse } from "next/server";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Security: URL Validation ─────────────────────────────────────────────────

const PRIVATE_IP_PATTERN = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|169\.254\.|fc00:|fe80:|::1)/i;

function validateUrl(raw: string): { valid: true; url: URL } | { valid: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { valid: false, reason: "Geçersiz URL formatı" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, reason: "Sadece http:// ve https:// protokolleri desteklenmektedir" };
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return { valid: false, reason: "Localhost erişimi güvenlik nedeniyle engellendi" };
  }

  if (PRIVATE_IP_PATTERN.test(hostname)) {
    return { valid: false, reason: "Özel/dahili IP adresleri güvenlik nedeniyle engellendi" };
  }

  return { valid: true, url };
}

// ── HTML Extraction (regex-based, no new deps) ────────────────────────────────

function extractMeta(html: string, name: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].slice(0, 300).trim();
  }
  return undefined;
}

function extractOg(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].slice(0, 300).trim();
  }
  return undefined;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractHeadings(html: string, tag: "h1" | "h2" | "h3"): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < 8) {
    const text = stripTags(m[1]).slice(0, 120);
    if (text.length > 2) out.push(text);
  }
  return out;
}

function extractPageTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).slice(0, 200).trim() : undefined;
}

function extractBodySnippets(html: string): string[] {
  // Remove script/style blocks first
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Extract paragraph-like text
  const paras = clean.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  const snippets: string[] = [];
  for (const p of paras) {
    const text = stripTags(p).trim();
    if (text.length > 40 && text.length < 500) {
      snippets.push(text.slice(0, 200));
      if (snippets.length >= 6) break;
    }
  }
  return snippets;
}

function extractKeywordHints(html: string, title: string | undefined, desc: string | undefined): string[] {
  const metaKw = extractMeta(html, "keywords");
  const raw = [title || "", desc || "", metaKw || ""].join(" ").toLowerCase();
  const words = raw.match(/\b[a-züşğıöçâ]{4,}\b/gi) || [];
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq)
    .filter(([, c]) => c >= 1)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([w]) => w);
}

function extractSocialLinks(html: string): string[] {
  const re = /href=["'](https?:\/\/(www\.)?(twitter|x|instagram|facebook|tiktok|youtube|linkedin|pinterest)\.com\/[^"'?\s]{1,60})["']/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && found.size < 8) {
    found.add(m[1]);
  }
  return Array.from(found);
}

function detectLanguage(html: string): string | undefined {
  const m = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
  return m ? m[1].slice(0, 10) : undefined;
}

function parseHtml(html: string): Omit<BrandWebsiteEvidence, "url" | "fetchStatus" | "fetchError" | "responseTimeMs" | "aiUsed" | "targetMarket"> {
  const pageTitle    = extractPageTitle(html);
  const metaDesc     = extractMeta(html, "description");
  const ogTitle      = extractOg(html, "title");
  const ogDesc       = extractOg(html, "description");
  const h1s          = extractHeadings(html, "h1");
  const h2s          = extractHeadings(html, "h2");
  const bodySnippets = extractBodySnippets(html);
  const socialLinks  = extractSocialLinks(html);
  const language     = detectLanguage(html);
  const keywordHints = extractKeywordHints(html, pageTitle, metaDesc);

  return { pageTitle, metaDescription: metaDesc, ogTitle, ogDescription: ogDesc, h1s, h2s, bodySnippets, socialLinks, language, keywordHints };
}

// ── AI Provider Abstraction ───────────────────────────────────────────────────

interface AiSignals {
  toneSignals?: string[];
  audienceSignals?: string[];
  categorySignals?: string[];
  positioning?: string;
  genomeDeltaReasoning?: string;
}

async function callAiProvider(brandContext: string): Promise<AiSignals | null> {
  const provider   = process.env.BRAND_ANALYSIS_PROVIDER?.toLowerCase() || "none";
  const apiKey     = process.env.BRAND_ANALYSIS_API_KEY || "";
  const model      = process.env.BRAND_ANALYSIS_MODEL || "";
  const baseUrl    = process.env.BRAND_ANALYSIS_BASE_URL || "";

  if (provider === "none" || !apiKey) return null;

  const systemPrompt = `You are a brand intelligence analyst. Analyze brand signals from website content and return a JSON object with these exact fields:
{
  "toneSignals": ["string", ...],       // 3-5 brand tone/voice descriptors
  "audienceSignals": ["string", ...],   // 3-5 target audience descriptors
  "categorySignals": ["string", ...],  // 3-5 content category signals
  "positioning": "string",              // 1-sentence brand positioning statement
  "genomeDeltaReasoning": "string"      // 1-sentence explanation of dominant genome dimensions
}
Return ONLY valid JSON. No markdown, no explanations. Be factual, no hallucination.`;

  const userPrompt = `Brand website content:\n${brandContext.slice(0, 3000)}`;

  try {
    if (provider === "deepseek" || provider === "openai" || provider === "openai-compatible") {
      const url = baseUrl || (provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com");
      const resolvedModel = model || (provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini");

      const resp = await fetch(`${url}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: 400,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) return null;
      const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content || "";
      return parseAiJson(content);
    }

    if (provider === "claude" || provider === "anthropic") {
      const resolvedModel = model || "claude-haiku-4-5-20251001";
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: resolvedModel,
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) return null;
      const data = await resp.json() as { content?: { type: string; text: string }[] };
      const content = data.content?.find(b => b.type === "text")?.text || "";
      return parseAiJson(content);
    }

    return null;
  } catch {
    return null;
  }
}

function parseAiJson(raw: string): AiSignals | null {
  try {
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const obj = JSON.parse(clean) as Record<string, unknown>;
    return {
      toneSignals:          Array.isArray(obj.toneSignals)     ? (obj.toneSignals as string[]).slice(0, 6)     : undefined,
      audienceSignals:      Array.isArray(obj.audienceSignals) ? (obj.audienceSignals as string[]).slice(0, 6) : undefined,
      categorySignals:      Array.isArray(obj.categorySignals) ? (obj.categorySignals as string[]).slice(0, 6) : undefined,
      positioning:          typeof obj.positioning === "string" ? obj.positioning.slice(0, 300)                : undefined,
      genomeDeltaReasoning: typeof obj.genomeDeltaReasoning === "string" ? obj.genomeDeltaReasoning.slice(0, 300) : undefined,
    };
  } catch {
    return null;
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { url?: string; targetMarket?: string } = {};
  try {
    body = await req.json() as { url?: string; targetMarket?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = (body.url || "").trim();
  const targetMarket = body.targetMarket || "Global";

  if (!rawUrl) {
    const evidence: BrandWebsiteEvidence = {
      url: "", fetchStatus: "invalid_url", fetchError: "URL sağlanmadı",
      h1s: [], h2s: [], keywordHints: [], bodySnippets: [], socialLinks: [],
      aiUsed: false, targetMarket,
    };
    return NextResponse.json(evidence);
  }

  const validation = validateUrl(rawUrl);
  if (!validation.valid) {
    const evidence: BrandWebsiteEvidence = {
      url: rawUrl, fetchStatus: "invalid_url", fetchError: validation.reason,
      h1s: [], h2s: [], keywordHints: [], bodySnippets: [], socialLinks: [],
      aiUsed: false, targetMarket,
    };
    return NextResponse.json(evidence);
  }

  const { url } = validation;
  const startMs = Date.now();

  // Fetch website
  let html = "";
  let fetchStatus: BrandWebsiteEvidence["fetchStatus"] = "success";
  let fetchError: string | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InflectBot/1.0; +https://inflect.io/bot)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      fetchStatus = "failed";
      fetchError = `HTTP ${resp.status}: ${resp.statusText}`;
    } else {
      const MAX_BYTES = 1_048_576; // 1MB
      const reader = resp.body?.getReader();
      if (reader) {
        let totalBytes = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            chunks.push(value);
            if (totalBytes > MAX_BYTES) {
              reader.cancel().catch(() => {});
              break;
            }
          }
        }
        html = new TextDecoder("utf-8", { fatal: false }).decode(
          chunks.reduce((acc, c) => {
            const merged = new Uint8Array(acc.length + c.length);
            merged.set(acc); merged.set(c, acc.length);
            return merged;
          }, new Uint8Array(0))
        );
      }
    }
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    fetchStatus = isAbort ? "timeout" : "failed";
    fetchError = isAbort ? "İstek zaman aşımına uğradı (8s)" : (err instanceof Error ? err.message.slice(0, 200) : "Bilinmeyen hata");
  }

  const responseTimeMs = Date.now() - startMs;

  if (fetchStatus !== "success" || !html) {
    const evidence: BrandWebsiteEvidence = {
      url: rawUrl, fetchStatus, fetchError, responseTimeMs,
      h1s: [], h2s: [], keywordHints: [], bodySnippets: [], socialLinks: [],
      aiUsed: false, targetMarket,
    };
    return NextResponse.json(evidence);
  }

  // Parse HTML
  const parsed = parseHtml(html);

  // Build AI context
  const aiContext = [
    parsed.pageTitle,
    parsed.metaDescription,
    parsed.ogDescription,
    ...(parsed.h1s || []),
    ...(parsed.h2s || []),
    ...(parsed.bodySnippets || []),
  ].filter(Boolean).join("\n");

  // Call AI provider
  const aiSignals = await callAiProvider(aiContext);
  const aiProvider = process.env.BRAND_ANALYSIS_PROVIDER || "none";

  const evidence: BrandWebsiteEvidence = {
    url: rawUrl,
    fetchStatus: "success",
    responseTimeMs,
    ...parsed,
    aiUsed: aiSignals !== null,
    aiProvider: aiSignals !== null ? aiProvider : undefined,
    aiToneSignals:          aiSignals?.toneSignals,
    aiAudienceSignals:      aiSignals?.audienceSignals,
    aiCategorySignals:      aiSignals?.categorySignals,
    aiPositioning:          aiSignals?.positioning,
    aiGenomeDeltaReasoning: aiSignals?.genomeDeltaReasoning,
    targetMarket,
  };

  return NextResponse.json(evidence);
}
