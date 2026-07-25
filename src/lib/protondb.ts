export interface ProtonDbSummary {
  tier: string; // "native" | "platinum" | "gold" | "silver" | "bronze" | "borka"
  confidence?: string;
  score?: number;
  totalReports?: number;
}

/**
 * Extracts Steam App ID from a string, integer, or full URL
 * (e.g. "413150", "https://www.protondb.com/app/413150", "https://store.steampowered.com/app/413150/Stardew_Valley/")
 */
export function extractSteamAppId(input: string | number): string | null {
  if (typeof input === "number") return input.toString();
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();

  // If already pure numeric string
  if (/^\d+$/.test(trimmed)) return trimmed;

  // Extract from URLs
  const protonMatch = trimmed.match(/protondb\.com\/app\/(\d+)/i);
  if (protonMatch) return protonMatch[1];

  const steamMatch = trimmed.match(/steampowered\.com\/app\/(\d+)/i);
  if (steamMatch) return steamMatch[1];

  return null;
}

/**
 * Auto-fetches ProtonDB rating tier & summary for a Steam App ID
 */
export async function fetchProtonDbSummary(input: string | number): Promise<ProtonDbSummary | null> {
  const appId = extractSteamAppId(input);
  if (!appId) return null;

  try {
    const url = `https://www.protondb.com/api/v1/reports/summaries/${appId}.json`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "hoGAMEGATA-Bot/1.0 (+https://gamegata.xyz)"
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || !data.tier) return null;

    return {
      tier: String(data.tier).toLowerCase(),
      confidence: data.confidence ? String(data.confidence) : undefined,
      score: typeof data.score === "number" ? data.score : undefined,
      totalReports: typeof data.total === "number" ? data.total : undefined,
    };
  } catch (err) {
    console.error(`Failed to fetch ProtonDB summary for AppID ${appId}:`, err);
    return null;
  }
}
