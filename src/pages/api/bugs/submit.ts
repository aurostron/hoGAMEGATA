import type { APIRoute } from 'astro';
import { turso } from '../../../lib/turso';
import { bugReports } from '../../../db/schema';
import { sendDiscordEditNotification } from '../../../lib/discord';
import { rateLimit, getClientIp, tooManyRequests } from '../../../lib/rateLimit';
import { env as cfEnv } from 'cloudflare:workers';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const clientIp = getClientIp(request, clientAddress);
    const rl = await rateLimit(`bugs:${clientIp}`, 3, 3600);
    if (!rl.allowed) return tooManyRequests(rl.retryAfter, 'Too many bug reports. Please try again later.');

    const body = await request.json().catch(() => null);
    if (!body || !body.title || !body.description || !body.pageUrl) {
      return new Response(
        JSON.stringify({ error: "Title, description, and page URL are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify Turnstile CAPTCHA token
    const turnstileToken = body.turnstileToken;
    if (!turnstileToken) {
      return new Response(
        JSON.stringify({ error: 'CAPTCHA verification required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isDev = import.meta.env?.DEV || (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development');
    const runtimeEnv = isDev
      ? (typeof process !== 'undefined' && process.env ? process.env : cfEnv)
      : (cfEnv || (typeof process !== 'undefined' ? process.env : {}));
    const turnstileSecret = (runtimeEnv as any).TURNSTILE_SECRET_KEY;

    if (turnstileSecret) {
      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: turnstileSecret,
            response: turnstileToken,
            remoteip: clientIp,
          }),
        });
        const verifyData = await verifyRes.json() as { success: boolean };
        if (!verifyData.success) {
          return new Response(
            JSON.stringify({ error: 'CAPTCHA verification failed. Please try again.' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (err) {
        console.warn('[Turnstile] Verification request failed, allowing submission:', err);
      }
    }

    const {
      title,
      description,
      pageUrl,
      category = 'bug',
      severity = 'medium',
      contactEmail,
      userId,
      userAgent,
    } = body;

    // Generate 6-digit support ticket ID (e.g. "BUG-839201")
    const numPart = Math.floor(100000 + Math.random() * 900000).toString();
    const ticketId = `BUG-${numPart}`;
    const id = `bug_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const userIp = clientAddress || request.headers.get("x-forwarded-for") || "unknown";
    const userAgentStr = userAgent || request.headers.get("user-agent") || "unknown";

    await turso.insert(bugReports).values({
      id,
      ticketId,
      category: String(category).trim(),
      severity: String(severity).trim(),
      title: String(title).trim().substring(0, 200),
      description: String(description).trim().substring(0, 3000),
      pageUrl: String(pageUrl).trim().substring(0, 500),
      userAgent: String(userAgentStr).substring(0, 300),
      contactEmail: contactEmail ? String(contactEmail).trim().substring(0, 150) : null,
      userId: userId ? String(userId).trim() : null,
      status: "new",
    });

    // Color based on severity
    const severityColors: Record<string, number> = {
      high: 0xef4444, // Red
      medium: 0xf59e0b, // Amber
      low: 0x3b82f6, // Blue
    };

    // Dispatch Discord Webhook Alert
    try {
      await sendDiscordEditNotification({
        title: `🐛 Bug Report Received (#${ticketId})`,
        description: `**${title.trim()}**\n\n${description.trim().substring(0, 500)}`,
        color: severityColors[severity] || 0xef4444,
        fields: [
          { name: 'Category', value: category.toUpperCase(), inline: true },
          { name: 'Severity', value: severity.toUpperCase(), inline: true },
          { name: 'Ticket ID', value: `#${ticketId}`, inline: true },
          { name: 'Reported Page', value: pageUrl.trim(), inline: false },
          { name: 'Contact Email', value: contactEmail ? contactEmail.trim() : '*(None provided)*', inline: true },
          { name: 'User IP', value: userIp, inline: true },
        ],
        footerText: `Ticket ID: #${ticketId} • hoGAMEGATA Bug Tracker`,
      });
    } catch (discordErr) {
      console.warn('⚠️ Discord bug notification error:', discordErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Bug report submitted successfully",
        ticketId,
        id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error submitting bug report:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "Failed to submit bug report" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
