/**
 * WebSearch — Live internet research for autonomous agents
 *
 * Powered by Tavily (free tier: 1000 searches/month).
 * Falls back to DuckDuckGo instant answers if no Tavily key.
 *
 * Used by:
 * - Researcher agent (always) — pulls live docs, APIs, tutorials
 * - Orchestrator — checks if target stack/library has recent changes
 * - Fixer — searches for error messages + Stack Overflow solutions
 * - AutoHeal — looks up runtime errors in real-time
 */

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface SearchBundle {
  query: string;
  results: SearchResult[];
  source: "tavily" | "ddg" | "none";
  took_ms: number;
}

// ── Tavily ────────────────────────────────────────────────────────────────────
async function tavilySearch(query: string, maxResults = 6): Promise<SearchResult[]> {
  const apiKey = (process.env["TAVILY_API_KEY"] || "").trim();
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "advanced",
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        include_domains: ["github.com", "stackoverflow.com", "developer.mozilla.org",
          "npmjs.com", "docs.rs", "reactjs.org", "nextjs.org", "vercel.com",
          "tailwindcss.com", "typescriptlang.org", "nodejs.org"],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: any[] };
    return (data.results ?? []).map((r: any) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      content: String(r.content ?? "").slice(0, 600),
      score: r.relevance_score,
    }));
  } catch {
    return [];
  }
}

// ── DuckDuckGo instant (fallback, no key needed) ──────────────────────────────
async function ddgSearch(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return [];
    const data = await res.json() as any;
    const results: SearchResult[] = [];
    if (data.AbstractText) {
      results.push({ title: data.Heading || query, url: data.AbstractURL || "", content: data.AbstractText.slice(0, 500) });
    }
    (data.RelatedTopics ?? []).slice(0, 4).forEach((t: any) => {
      if (t.Text && t.FirstURL) {
        results.push({ title: t.Text.slice(0, 80), url: t.FirstURL, content: t.Text.slice(0, 300) });
      }
    });
    return results;
  } catch {
    return [];
  }
}

// ── Main search function ──────────────────────────────────────────────────────
export async function webSearch(query: string, maxResults = 6): Promise<SearchBundle> {
  const start = Date.now();
  const hasTavily = !!(process.env["TAVILY_API_KEY"] || "").trim();

  if (hasTavily) {
    const results = await tavilySearch(query, maxResults);
    return { query, results, source: "tavily", took_ms: Date.now() - start };
  }

  const results = await ddgSearch(query);
  return { query, results, source: results.length > 0 ? "ddg" : "none", took_ms: Date.now() - start };
}

export function isTavilyEnabled(): boolean {
  return !!(process.env["TAVILY_API_KEY"] || "").trim();
}

// ── Query generation for different agent types ────────────────────────────────
export function buildResearchQueries(goal: string, agentType: string): string[] {
  const clean = goal.slice(0, 120).replace(/\[.*?\]/g, "").trim();

  const queryMap: Record<string, string[]> = {
    orchestrator: [
      `${clean} tech stack 2026`,
      `${clean} architecture best practices`,
    ],
    researcher: [
      clean,
      `${clean} tutorial documentation`,
      `${clean} implementation examples github`,
      `${clean} npm package api`,
    ],
    builder: [
      `${clean} react typescript example`,
      `${clean} code implementation`,
    ],
    fixer: [
      `${clean} fix solution`,
      `${clean} stackoverflow`,
    ],
    "autohealer": [
      `${clean} error fix`,
      `${clean} runtime error solution`,
    ],
  };

  return (queryMap[agentType] || [`${clean}`]).slice(0, 3);
}

// ── Format search results for injection into agent prompts ───────────────────
export function formatSearchResults(bundles: SearchBundle[]): string {
  const allResults = bundles.flatMap(b => b.results);
  if (allResults.length === 0) return "";

  const lines = ["\n\n🌐 LIVE WEB RESEARCH:"];
  allResults.slice(0, 8).forEach((r, i) => {
    lines.push(`\n[${i + 1}] ${r.title}`);
    lines.push(`URL: ${r.url}`);
    lines.push(`${r.content}`);
  });
  lines.push("\n[Use the above real-time data to inform your response. Prefer current sources over training knowledge for APIs, versions, and patterns.]\n");
  return lines.join("\n");
}

// ── Parallel multi-query search ───────────────────────────────────────────────
export async function multiSearch(queries: string[], maxPerQuery = 4): Promise<string> {
  const bundles = await Promise.all(queries.map(q => webSearch(q, maxPerQuery)));
  return formatSearchResults(bundles);
}
