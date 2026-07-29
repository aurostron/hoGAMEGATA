/**
 * Cloudflare Edge Cache Purging Helper
 * Uses Cloudflare Single-URL Purging API (Free & Unlimited).
 */

export interface CachePurgeResult {
  success: boolean;
  message?: string;
  purgedUrls?: string[];
  error?: string;
}

export async function purgeCloudflareUrls(
  urls: string[],
  env?: any
): Promise<CachePurgeResult> {
  try {
    const isDev =
      import.meta.env?.DEV ||
      (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "development");

    const zoneId = env?.CLOUDFLARE_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID;
    const apiToken = env?.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;

    if (!zoneId || !apiToken) {
      if (isDev) {
        console.log("ℹ️ [Cache Purge Mock] Skipping Cloudflare purge in dev (missing Zone ID or API Token):", urls);
        return {
          success: true,
          message: "Dev mode mock purge succeeded (no Cloudflare credentials configured).",
          purgedUrls: urls,
        };
      }
      console.warn("⚠️ [Cache Purge Warning] Cannot purge Cloudflare cache: missing CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN binding.");
      return {
        success: false,
        error: "Missing Cloudflare credentials.",
      };
    }

    const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: urls }),
    });

    const data = (await res.json()) as { success: boolean; errors?: any[] };

    if (res.ok && data.success) {
      console.log("✅ [Cache Purge Success] Purged URLs from Cloudflare Edge:", urls);
      return {
        success: true,
        message: "Successfully purged URLs from Cloudflare Edge.",
        purgedUrls: urls,
      };
    } else {
      console.error("❌ [Cache Purge Error] Cloudflare API error:", data.errors);
      return {
        success: false,
        error: JSON.stringify(data.errors || "Unknown Cloudflare API error"),
      };
    }
  } catch (err) {
    console.error("❌ [Cache Purge Exception]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Helper to purge cache for a specific game slug and related catalog pages.
 */
export async function purgeGameCache(
  slug: string,
  env?: any,
  domain: string = "https://gamegata.xyz"
): Promise<CachePurgeResult> {
  const targetUrls = [
    `${domain}/game/${slug}`,
    `${domain}/directory`,
    `${domain}/games`,
  ];
  return purgeCloudflareUrls(targetUrls, env);
}
