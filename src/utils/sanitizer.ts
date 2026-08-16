/**
 * Utility functions for masking sensitive data (tokens, cookies, webhooks, passwords).
 * Used across loggers, error dumps, and notification formatters for security compliance.
 */

export function maskSecret(value: string, visiblePrefix = 4, visibleSuffix = 4): string {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length <= visiblePrefix + visibleSuffix) {
    return '***';
  }
  const prefix = trimmed.slice(0, visiblePrefix);
  const suffix = trimmed.slice(-visibleSuffix);
  return `${prefix}***${suffix}`;
}

export function maskCookieString(cookie: string): string {
  if (!cookie || typeof cookie !== 'string') return '';
  
  // Splits cookies by semicolon and masks values for known sensitive keys
  return cookie
    .split(';')
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) return trimmed;

      const key = trimmed.slice(0, eqIndex).trim();
      const val = trimmed.slice(eqIndex + 1).trim();

      const sensitiveKeys = [
        'ltoken',
        'ltoken_v2',
        'ltuid',
        'ltuid_v2',
        'account_id',
        'account_id_v2',
        'account_mid_v2',
        'ltmid_v2',
        'cookie_token',
        'cookie_token_v2',
        'authkey',
      ];

      if (sensitiveKeys.some((s) => s.toLowerCase() === key.toLowerCase())) {
        return `${key}=${maskSecret(val, 3, 3)}`;
      }
      return `${key}=${maskSecret(val, 2, 2)}`;
    })
    .filter(Boolean)
    .join('; ');
}

export function maskDiscordWebhook(url: string): string {
  if (!url || typeof url !== 'string') return '';
  // Pattern: https://discord.com/api/webhooks/<id>/<token>
  const match = url.match(/^(https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/)(.+)$/i);
  if (match && match[1] && match[2]) {
    return `${match[1]}${maskSecret(match[2], 3, 3)}`;
  }
  return maskSecret(url, 15, 4);
}

export function maskTelegramToken(token: string): string {
  if (!token || typeof token !== 'string') return '';
  // Pattern: <bot_id>:<token>
  const parts = token.split(':');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return `${parts[0]}:${maskSecret(parts[1], 3, 3)}`;
  }
  return maskSecret(token, 4, 4);
}

export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // Mask Discord webhooks
  sanitized = sanitized.replace(
    /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+/gi,
    (m) => maskDiscordWebhook(m)
  );

  // Mask Telegram bot tokens
  sanitized = sanitized.replace(
    /\b\d{8,12}:[A-Za-z0-9_-]{30,50}\b/g,
    (m) => maskTelegramToken(m)
  );

  // Mask common cookie patterns
  sanitized = sanitized.replace(
    /(ltoken_v2|ltoken|ltuid_v2|ltuid|account_mid_v2|ltmid_v2)=([^;,\s]+)/gi,
    (_match, key, val) => `${key}=${maskSecret(val, 3, 3)}`
  );

  return sanitized;
}
