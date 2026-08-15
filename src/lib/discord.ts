export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordWebhookParams {
  title: string;
  description?: string;
  color?: number; // Decimal color code (e.g. 0xef4444 for red, 0x10b981 for green, 0x8b5cf6 for purple)
  fields?: DiscordEmbedField[];
  footerText?: string;
  url?: string;
}

export async function sendDiscordEditNotification(
  params: DiscordWebhookParams,
  env?: any
) {
  try {
    let cfEnv: any = {};
    try {
      const cf = await import('cloudflare:workers');
      cfEnv = cf.env || {};
    } catch {}

    const getEnvVal = (key: string) => {
      return (env && env[key]) || (typeof process !== 'undefined' && process.env ? process.env[key] : cfEnv?.[key]);
    };

    const webhookUrl = getEnvVal('DISCORD_EDIT_WEBHOOK_URL');
    const pingUserId = getEnvVal('DISCORD_PING_USER_ID'); // e.g. "123456789012345678"
    const pingRole = getEnvVal('DISCORD_PING_ROLE'); // e.g. "here" or "everyone"

    if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      // Webhook not configured yet, skip silently
      return;
    }

    let pingContent = '';
    if (pingUserId) {
      pingContent = `<@${pingUserId}>`;
    } else if (pingRole === 'here') {
      pingContent = '@here';
    } else if (pingRole === 'everyone') {
      pingContent = '@everyone';
    }

    const payload = {
      username: 'hoGAMEGATA Edits Bot',
      avatar_url: 'https://gamegata.xyz/favicon.ico',
      content: pingContent || undefined,
      embeds: [
        {
          title: params.title,
          description: params.description || '',
          url: params.url || 'https://gamegata.xyz/admin/edits',
          color: params.color || 0xef4444, // Default hoGAMEGATA Red
          fields: params.fields || [],
          footer: {
            text: params.footerText || 'hoGAMEGATA Edit & Moderation Engine',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    // Dispatch webhook asynchronously
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn('⚠️ Discord webhook request error:', err);
    });
  } catch (err) {
    console.warn('⚠️ Failed to dispatch Discord notification:', err);
  }
}
