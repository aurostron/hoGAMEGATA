import type { APIRoute } from "astro";
import { getClientIp, blockIp, forbiddenResponse } from "../../../lib/rateLimit";
import { logSecurityEvent } from "../../../lib/auditLogger";

export const prerender = false;

/**
 * Honeypot Decoy Endpoint.
 * Simulated /api/v1/export target for API vulnerability fuzzers and harvesters.
 */
export const ALL: APIRoute = async ({ request, url }) => {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  // 1. Log security incident
  logSecurityEvent({
    eventType: "honeypot_triggered",
    severity: "critical",
    clientIp,
    path: url.pathname,
    method: request.method,
    userAgent,
    details: { trap: "v1_export_honeypot" },
  });

  // 2. Ban IP for 24 hours
  await blockIp(clientIp, "Triggered honeypot decoy /api/v1/export", 86400);

  // 3. Tar-pit delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return forbiddenResponse("Forbidden: Access denied.");
};
