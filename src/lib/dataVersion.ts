export interface DataVersionInfo {
  commitSha: string;
  commitUrl: string;
  commitMessage?: string;
  date: string;
  displayDate: string;
  totalGames?: number;
}

export const FALLBACK_VERSION: DataVersionInfo = {
  commitSha: "242b3a1",
  commitUrl: "https://github.com/project-hgg/project-hgg.github.io/commit/242b3a1e86a850effae20972aca6d639b0e7073f",
  commitMessage: "chore(catalog): auto-sync new itch horror games",
  date: "2026-09-05T14:33:36Z",
  displayDate: "Sep 5, 14:33 UTC",
  totalGames: 107891,
};

let cachedVersion: DataVersionInfo | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 1-minute server-side cache

export function formatDisplayDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "recently";

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getUTCMonth()];
    const day = date.getUTCDate();
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");

    return `${month} ${day}, ${hours}:${minutes} UTC`;
  } catch {
    return "recently";
  }
}

export async function getDataVersion(): Promise<DataVersionInfo> {
  const now = Date.now();
  if (cachedVersion && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedVersion;
  }

  // 1. Primary: Fetch static data-version.json with cache-busting query
  const endpoints = [
    `https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public/data-version.json?t=${now}`,
    `https://cdn.jsdelivr.net/gh/project-hgg/project-hgg.github.io@main/docs/public/data-version.json?t=${now}`,
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(url, {
        headers: { "User-Agent": "Gamegata-DataVersion-Checker" },
        signal: controller.signal,
        // @ts-ignore Cloudflare cache option
        cf: { cacheTtl: 60, cacheEverything: true },
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data && data.commitSha) {
          const sha = data.commitSha;
          const fullSha = data.fullSha || sha;
          const date = data.timestamp || FALLBACK_VERSION.date;

          cachedVersion = {
            commitSha: sha,
            commitUrl: `https://github.com/project-hgg/project-hgg.github.io/commit/${fullSha}`,
            commitMessage: data.commitMessage || "Catalog update",
            date,
            displayDate: formatDisplayDate(date),
            totalGames: data.totalGames || FALLBACK_VERSION.totalGames,
          };
          lastFetchedAt = now;
          return cachedVersion;
        }
      }
    } catch {}
  }

  return cachedVersion || FALLBACK_VERSION;
}
