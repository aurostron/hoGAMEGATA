export type SecurityEventType =
  | "honeypot_triggered"
  | "rate_limit_exceeded"
  | "ip_blocked"
  | "auth_failure"
  | "unauthorized_scope"
  | "admin_mutation"
  | "admin_2fa_failure"
  | "invalid_payload";

export interface SecurityAuditLog {
  timestamp: string;
  eventType: SecurityEventType;
  severity: "low" | "medium" | "high" | "critical";
  clientIp: string;
  path: string;
  method: string;
  userAgent?: string | null;
  userId?: string | null;
  details?: Record<string, any>;
}

/**
 * Log structured security events to stdout / Cloudflare Workers log stream.
 */
export function logSecurityEvent(event: Omit<SecurityAuditLog, "timestamp">): void {
  const logEntry: SecurityAuditLog = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  // Structured JSON output for Cloudflare Logs and observability pipelines
  const prefix = `[SECURITY_AUDIT:${logEntry.severity.toUpperCase()}]`;
  if (logEntry.severity === "critical" || logEntry.severity === "high") {
    console.error(`${prefix} ${JSON.stringify(logEntry)}`);
  } else if (logEntry.severity === "medium") {
    console.warn(`${prefix} ${JSON.stringify(logEntry)}`);
  } else {
    console.info(`${prefix} ${JSON.stringify(logEntry)}`);
  }
}
