import type { APIRoute } from "astro";
import { getClientIp, blockIp, forbiddenResponse } from "../../../lib/rateLimit";
import { logSecurityEvent } from "../../../lib/auditLogger";

export const prerender = false;

/**
 * Honeypot Decoy Endpoint.
 * Real users never navigate here. Any traffic hitting this endpoint is an automated
 * scraper / scanner looking for whole-catalog database dumps.
 */
export const ALL: APIRoute = async ({ request, url }) => {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  // 1. Log critical security telemetry
  logSecurityEvent({
    eventType: "honeypot_triggered",
    severity: "critical",
    clientIp,
    path: url.pathname,
    method: request.method,
    userAgent,
    details: { trap: "games_dump_honeypot" },
  });

  // 2. Add client IP to 24-hour global KV blocklist
  await blockIp(clientIp, "Triggered honeypot decoy /api/games/dump", 86400);

  // 3. Tar-pit delay (2 seconds) to consume scraper worker pool concurrency
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return forbiddenResponse("Forbidden: Access denied.");
};
