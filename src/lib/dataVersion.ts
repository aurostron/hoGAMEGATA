export interface DataVersionInfo {
  commitSha: string;
  commitUrl: string;
  date: string;
  displayDate: string;
}

const FALLBACK_VERSION: DataVersionInfo = {
  commitSha: "06dc807",
  commitUrl: "https://github.com/project-hgg/project-hgg.github.io/commit/06dc807",
  date: "2026-09-03T19:43:00Z",
  displayDate: "Sep 3, 19:43 UTC",
};

let cachedVersion: DataVersionInfo | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes in-memory cache

function formatDisplayDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Sep 3, 19:43 UTC";

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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s quick timeout

    const res = await fetch("https://api.github.com/repos/project-hgg/project-hgg.github.io/commits/main", {
      headers: {
        "User-Agent": "Gamegata-DataVersion-Checker",
        Accept: "application/vnd.github.v3+json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as any;
      const sha = (data.sha || "").slice(0, 7) || FALLBACK_VERSION.commitSha;
      const date = data.commit?.committer?.date || data.commit?.author?.date || FALLBACK_VERSION.date;

      cachedVersion = {
        commitSha: sha,
        commitUrl: `https://github.com/project-hgg/project-hgg.github.io/commit/${data.sha || sha}`,
        date,
        displayDate: formatDisplayDate(date),
      };
      lastFetchedAt = now;
      return cachedVersion;
    }
  } catch (err) {
    // Fail silently to fallback on timeout or network error
  }

  return cachedVersion || FALLBACK_VERSION;
}
