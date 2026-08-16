import type {
  AccountProfile,
  AppConfig,
  DiscordConfig,
  NotificationPolicy,
  SmtpConfig,
  TelegramConfig,
  WebhookConfig,
} from '../types/config.ts';
import type { GameKey } from '../types/game.ts';
import { GAMES, GAME_KEY_ALIASES } from '../constants/games.ts';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Clean and normalize a raw cookie string into standard 'key=value; key2=value2;' format.
 */
export function normalizeCookieString(cookieInput: string): string {
  if (!cookieInput || typeof cookieInput !== 'string') {
    return '';
  }

  // Handle case where user pasted whole header "Cookie: ltoken_v2=...; ltuid_v2=..."
  let cleaned = cookieInput.trim();
  if (cleaned.toLowerCase().startsWith('cookie:')) {
    cleaned = cleaned.slice(7).trim();
  }

  // Split by semicolon or newline
  const pairs = cleaned
    .split(/[;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);

  const cookieMap = new Map<string, string>();

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx !== -1) {
      const key = pair.slice(0, eqIdx).trim();
      const val = pair.slice(eqIdx + 1).trim();
      if (key && val) {
        cookieMap.set(key, val);
      }
    }
  }

  const result: string[] = [];
  for (const [key, val] of cookieMap.entries()) {
    result.push(`${key}=${val}`);
  }

  return result.join('; ');
}

export function validateAccountProfile(profile: unknown, index: number): AccountProfile {
  if (!profile || typeof profile !== 'object') {
    throw new ConfigError(`Profile at index ${index} must be an object`);
  }

  const raw = profile as Record<string, unknown>;
  const accountName = typeof raw.accountName === 'string' && raw.accountName.trim()
    ? raw.accountName.trim()
    : `Account #${index + 1}`;

  const rawToken = typeof raw.token === 'string' ? raw.token : '';
  const token = normalizeCookieString(rawToken);

  if (!token) {
    throw new ConfigError(`Profile "${accountName}" is missing a valid 'token' (cookies).`);
  }

  const hasV2 = token.includes('ltoken_v2=') && token.includes('ltuid_v2=');
  const hasV1 = token.includes('ltoken=') && token.includes('ltuid=');

  if (!hasV2 && !hasV1) {
    // Check if at least one token cookie is present
    if (!token.includes('ltoken') && !token.includes('cookie_token') && !token.includes('account_mid_v2')) {
      throw new ConfigError(
        `Profile "${accountName}" token does not appear to contain valid HoYoLAB cookies (expected ltoken_v2 / ltuid_v2).`
      );
    }
  }

  // Parse enabled games
  const games: Partial<Record<GameKey, boolean>> = {};

  // Check nested games object
  if (raw.games && typeof raw.games === 'object') {
    const gamesObj = raw.games as Record<string, unknown>;
    for (const [key, val] of Object.entries(gamesObj)) {
      const canonicalKey = GAME_KEY_ALIASES[key.toLowerCase()];
      if (canonicalKey && typeof val === 'boolean') {
        games[canonicalKey] = val;
      }
    }
  }

  // Check top-level boolean properties (e.g. genshin: true, honkai_star_rail: true)
  const allGameKeys = Object.keys(GAMES) as GameKey[];
  for (const gameKey of allGameKeys) {
    if (typeof raw[gameKey] === 'boolean') {
      games[gameKey] = raw[gameKey] as boolean;
    }
  }

  // Check alias properties (e.g. star_rail, zzz, gi, hsr)
  for (const [alias, canonicalKey] of Object.entries(GAME_KEY_ALIASES)) {
    if (typeof raw[alias] === 'boolean' && games[canonicalKey] === undefined) {
      games[canonicalKey] = raw[alias] as boolean;
    }
  }

  // If no game is explicitly enabled, enable all by default
  const hasExplicitTrue = Object.values(games).some((v) => v === true);
  if (!hasExplicitTrue) {
    for (const gameKey of allGameKeys) {
      if (games[gameKey] === undefined) {
        games[gameKey] = true;
      }
    }
  }

  return {
    accountName,
    token,
    games,
    genshin: games.genshin ?? false,
    honkai_star_rail: games.honkai_star_rail ?? false,
    honkai_3: games.honkai_3 ?? false,
    tears_of_themis: games.tears_of_themis ?? false,
    zenless_zone_zero: games.zenless_zone_zero ?? false,
  };
}

export function validateDiscordConfig(cfg?: unknown): DiscordConfig | undefined {
  if (!cfg || typeof cfg !== 'object') return undefined;
  const raw = cfg as Record<string, unknown>;
  const enabled = Boolean(raw.enabled ?? true);
  const webhookUrl = typeof raw.webhookUrl === 'string' ? raw.webhookUrl.trim() : '';

  if (enabled && !webhookUrl) {
    return undefined;
  }

  const pingUserId = typeof raw.pingUserId === 'string' ? raw.pingUserId.trim() : undefined;
  const notifyOn = validateNotificationPolicy(raw.notifyOn);

  return {
    enabled,
    webhookUrl,
    pingUserId,
    notifyOn,
  };
}

export function validateTelegramConfig(cfg?: unknown): TelegramConfig | undefined {
  if (!cfg || typeof cfg !== 'object') return undefined;
  const raw = cfg as Record<string, unknown>;
  const enabled = Boolean(raw.enabled ?? true);
  const botToken = typeof raw.botToken === 'string' ? raw.botToken.trim() : '';
  const chatId = typeof raw.chatId === 'string' || typeof raw.chatId === 'number' ? String(raw.chatId).trim() : '';

  if (enabled && (!botToken || !chatId)) {
    return undefined;
  }

  const notifyOn = validateNotificationPolicy(raw.notifyOn);

  return {
    enabled,
    botToken,
    chatId,
    notifyOn,
  };
}

export function validateSmtpConfig(cfg?: unknown): SmtpConfig | undefined {
  if (!cfg || typeof cfg !== 'object') return undefined;
  const raw = cfg as Record<string, unknown>;
  const enabled = Boolean(raw.enabled ?? true);
  const host = typeof raw.host === 'string' ? raw.host.trim() : '';
  const port = typeof raw.port === 'number' ? raw.port : parseInt(String(raw.port || '587'), 10);
  const user = typeof raw.user === 'string' ? raw.user.trim() : '';
  const pass = typeof raw.pass === 'string' ? raw.pass : '';
  const from = typeof raw.from === 'string' ? raw.from.trim() : user;
  const to = Array.isArray(raw.to)
    ? (raw.to as string[]).map((e) => String(e).trim()).filter(Boolean)
    : typeof raw.to === 'string'
    ? raw.to.trim()
    : '';

  if (enabled && (!host || !user || !pass || !to || (Array.isArray(to) && to.length === 0))) {
    return undefined;
  }

  const secure = typeof raw.secure === 'boolean' ? raw.secure : port === 465;
  const subjectPrefix = typeof raw.subjectPrefix === 'string' ? raw.subjectPrefix.trim() : '[HoYoLAB Claim]';
  const notifyOn = validateNotificationPolicy(raw.notifyOn);

  return {
    enabled,
    host,
    port: isNaN(port) ? 587 : port,
    secure,
    user,
    pass,
    from,
    to,
    subjectPrefix,
    notifyOn,
  };
}

export function validateWebhookConfig(cfg?: unknown): WebhookConfig | undefined {
  if (!cfg || typeof cfg !== 'object') return undefined;
  const raw = cfg as Record<string, unknown>;
  const enabled = Boolean(raw.enabled ?? true);
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';

  if (enabled && !url) {
    return undefined;
  }

  const headers = typeof raw.headers === 'object' && raw.headers ? (raw.headers as Record<string, string>) : undefined;
  const notifyOn = validateNotificationPolicy(raw.notifyOn);

  return {
    enabled,
    url,
    headers,
    notifyOn,
  };
}

function validateNotificationPolicy(val: unknown): NotificationPolicy {
  if (typeof val === 'string') {
    const normalized = val.toLowerCase().trim();
    if (normalized === 'on_error' || normalized === 'error') return 'on_error';
    if (normalized === 'on_claim' || normalized === 'claim' || normalized === 'on_success') return 'on_claim';
    if (normalized === 'always') return 'always';
  }
  return 'always';
}

export function validateAppConfig(rawConfig: unknown): AppConfig {
  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new ConfigError('Configuration must be a valid JSON object');
  }

  const raw = rawConfig as Record<string, unknown>;

  // Profiles validation
  const profilesRaw = Array.isArray(raw.profiles) ? raw.profiles : [];
  if (profilesRaw.length === 0) {
    throw new ConfigError('No profiles found in configuration. Please provide at least one account profile.');
  }

  const profiles = profilesRaw.map((p, idx) => validateAccountProfile(p, idx));

  // Delay Range
  let delayRangeMs: [number, number] = [1500, 3000];
  if (Array.isArray(raw.delayRangeMs) && raw.delayRangeMs.length === 2) {
    const min = Number(raw.delayRangeMs[0]);
    const max = Number(raw.delayRangeMs[1]);
    if (!isNaN(min) && !isNaN(max) && min >= 0 && max >= min) {
      delayRangeMs = [min, max];
    }
  }

  const retryCount = typeof raw.retryCount === 'number' && raw.retryCount >= 0 ? raw.retryCount : 2;
  const requestTimeoutMs = typeof raw.requestTimeoutMs === 'number' && raw.requestTimeoutMs > 0 ? raw.requestTimeoutMs : 10000;
  const fetchRewardDetails = typeof raw.fetchRewardDetails === 'boolean' ? raw.fetchRewardDetails : true;

  const discord = validateDiscordConfig(raw.discord);
  const telegram = validateTelegramConfig(raw.telegram);
  const smtp = validateSmtpConfig(raw.smtp);
  const webhook = validateWebhookConfig(raw.webhook);

  return {
    profiles,
    delayRangeMs,
    retryCount,
    requestTimeoutMs,
    fetchRewardDetails,
    discord,
    telegram,
    smtp,
    webhook,
  };
}
