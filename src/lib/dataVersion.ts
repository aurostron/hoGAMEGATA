export interface DataVersionInfo {
  commitSha: string;
  fullSha?: string;
  commitUrl: string;
  commitMessage?: string;
  date: string;
  displayDate: string;
  totalGames?: number;
}

export const FALLBACK_VERSION: DataVersionInfo = {
  commitSha: "22f51f9",
  fullSha: "22f51f95aa204ce84b0828b511efe09cf4bcae55",
  commitUrl: "https://github.com/project-hgg/project-hgg.github.io/commit/22f51f95aa204ce84b0828b511efe09cf4bcae55",
  commitMessage: "fix(data): align data-version.json to valid commit 1bcac49",
  date: "2026-09-06T19:10:59Z",
  displayDate: "Sep 6, 19:10 UTC",
  totalGames: 107932,
};

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

let cachedVersion: DataVersionInfo | null = null;
let lastFetchedAt = 0;
const isDev = typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
const CACHE_TTL_MS = isDev ? 5000 : 60000;

export async function getDataVersion(): Promise<DataVersionInfo> {
  const now = Date.now();
  if (cachedVersion && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedVersion;
  }

  // 1. Primary: Fetch public Atom feed of main branch commits (unauthenticated, no GitHub API rate limit, reflects true git HEAD)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`https://github.com/project-hgg/project-hgg.github.io/commits/main.atom?t=${now}`, {
      headers: {
        "User-Agent": "Gamegata-DataVersion-Checker",
        "Accept": "application/atom+xml, text/xml, */*",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const xml = await res.text();
      const match = xml.match(/<entry>[\s\S]*?<id>tag:github\.com,2008:Grit::Commit\/([a-f0-9]{40})<\/id>[\s\S]*?<title>\s*([\s\S]*?)\s*<\/title>[\s\S]*?<updated>([^<]+)<\/updated>/);
      if (match) {
        const fullSha = match[1];
        const commitSha = fullSha.slice(0, 7);
        const commitMessage = match[2].trim().replace(/\s+/g, " ");
        const date = match[3];

        cachedVersion = {
          commitSha,
          fullSha,
          commitUrl: `https://github.com/project-hgg/project-hgg.github.io/commit/${fullSha}`,
          commitMessage,
          date,
          displayDate: formatDisplayDate(date),
          totalGames: FALLBACK_VERSION.totalGames,
        };
        lastFetchedAt = now;
        return cachedVersion;
      }
    }
  } catch {}

  // 2. Secondary fallback: check docs/public/data-version.json
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://raw.githubusercontent.com/project-hgg/project-hgg.github.io/main/docs/public/data-version.json?t=${now}`, {
      headers: { "User-Agent": "Gamegata-DataVersion-Checker" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json() as any;
      if (data && data.commitSha) {
        const fullSha = data.fullSha || data.commitSha;
        cachedVersion = {
          commitSha: data.commitSha,
          fullSha,
          commitUrl: `https://github.com/project-hgg/project-hgg.github.io/commit/${fullSha}`,
          commitMessage: data.commitMessage || "chore(catalog): auto-sync new itch horror games",
          date: data.timestamp || FALLBACK_VERSION.date,
          displayDate: formatDisplayDate(data.timestamp || FALLBACK_VERSION.date),
          totalGames: data.totalGames || FALLBACK_VERSION.totalGames,
        };
        lastFetchedAt = now;
        return cachedVersion;
      }
    }
  } catch {}

  return cachedVersion || FALLBACK_VERSION;
}
