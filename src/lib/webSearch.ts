export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Perform web search discovery using either Exa or Tavily depending on configured API keys.
 * Returns an array of search result snippets.
 */
export async function performWebSearch(query: string, env: any = {}): Promise<SearchResult[]> {
  const exaKey = env.EXA_API_KEY || process.env.EXA_API_KEY;
  const tavilyKey = env.TAVILY_API_KEY || process.env.TAVILY_API_KEY;

  if (!exaKey && !tavilyKey) {
    console.warn("⚠️ No web search API keys configured. Returning empty results.");
    return [];
  }

  // --- 1. TRY EXA.AI ---
  if (exaKey) {
    try {
      console.log(`🌐 [Exa Search] Querying: "${query}"`);
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": exaKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: query,
          numResults: 5,
          useAutoprompt: true,
          highlights: {
            numSentences: 3
          }
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        if (data.results && Array.isArray(data.results)) {
          return data.results.map((r: any) => {
            // Use highlight matches if available, otherwise fallback to title
            const snippet = (r.highlights && r.highlights[0]) || r.title || "";
            return {
              title: r.title || "Untitled",
              url: r.url || "",
              snippet
            };
          });
        }
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ Exa Search request failed: ${response.status} - ${errorText}`);
      }
    } catch (e) {
      console.error("❌ Exa Search crashed, falling back to Tavily:", e);
    }
  }

  // --- 2. FALLBACK TO TAVILY ---
  if (tavilyKey) {
    try {
      console.log(`🌐 [Tavily Search] Querying: "${query}"`);
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: query,
          search_depth: "basic",
          max_results: 5,
          include_answer: false
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        if (data.results && Array.isArray(data.results)) {
          return data.results.map((r: any) => ({
            title: r.title || "Untitled",
            url: r.url || "",
            snippet: r.content || ""
          }));
        }
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ Tavily Search request failed: ${response.status} - ${errorText}`);
      }
    } catch (e) {
      console.error("❌ Tavily Search crashed:", e);
    }
  }

  return [];
}
