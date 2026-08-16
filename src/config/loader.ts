import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppConfig } from '../types/config.ts';
import { validateAppConfig, ConfigError } from './schema.ts';
import { logger } from '../utils/logger.ts';

export interface LoadConfigOptions {
  configPath?: string;
  cwd?: string;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<AppConfig> {
  const cwd = options.cwd ?? process.cwd();

  // 1. Try explicit path if provided
  if (options.configPath) {
    const explicitPath = resolve(cwd, options.configPath);
    if (!existsSync(explicitPath)) {
      throw new ConfigError(`Specified configuration file does not exist: ${explicitPath}`);
    }
    logger.info(`Loading configuration from ${options.configPath}`);
    const file = Bun.file(explicitPath);
    const content = await file.text();
    try {
      const parsed = JSON.parse(content);
      return validateAppConfig(parsed);
    } catch (e: unknown) {
      if (e instanceof ConfigError) throw e;
      throw new ConfigError(`Failed to parse config file "${explicitPath}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. Check for HOYOLAB_CONFIG_JSON environment variable (great for CI/CD like GitHub Actions)
  if (process.env.HOYOLAB_CONFIG_JSON) {
    logger.info('Loading configuration from HOYOLAB_CONFIG_JSON environment variable');
    try {
      const parsed = JSON.parse(process.env.HOYOLAB_CONFIG_JSON);
      return validateAppConfig(parsed);
    } catch (e: unknown) {
      if (e instanceof ConfigError) throw e;
      throw new ConfigError(`Invalid JSON in HOYOLAB_CONFIG_JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. Try standard config.json in working directory
  const defaultConfigPath = resolve(cwd, 'config.json');
  if (existsSync(defaultConfigPath)) {
    logger.info('Loading configuration from config.json');
    const file = Bun.file(defaultConfigPath);
    const content = await file.text();
    try {
      const parsed = JSON.parse(content);
      return validateAppConfig(parsed);
    } catch (e: unknown) {
      if (e instanceof ConfigError) throw e;
      throw new ConfigError(`Failed to parse config.json: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. Try building config from environment variables (.env is auto-loaded by Bun)
  const envConfig = buildConfigFromEnv();
  if (envConfig) {
    logger.info('Loading configuration from environment variables (.env)');
    return validateAppConfig(envConfig);
  }

  throw new ConfigError(
    'No configuration found! Please create a "config.json" file (see config.example.json) or set environment variables in ".env".'
  );
}

function buildConfigFromEnv(): Record<string, unknown> | null {
  const profiles: Record<string, unknown>[] = [];

  // Check for HOYOLAB_ACCOUNTS JSON string
  if (process.env.HOYOLAB_ACCOUNTS) {
    try {
      const parsedAccounts = JSON.parse(process.env.HOYOLAB_ACCOUNTS);
      if (Array.isArray(parsedAccounts)) {
        profiles.push(...parsedAccounts);
      }
    } catch {
      logger.warn('Failed to parse HOYOLAB_ACCOUNTS environment variable as JSON');
    }
  }

  // Check for single account env vars
  if (process.env.HOYOLAB_TOKEN || process.env.HOYOLAB_COOKIE) {
    const token = process.env.HOYOLAB_TOKEN || process.env.HOYOLAB_COOKIE || '';
    const accountName = process.env.HOYOLAB_ACCOUNT_NAME || 'Primary Account';
    const gamesEnv = process.env.HOYOLAB_GAMES; // e.g. "genshin,hsr,zzz"

    const profile: Record<string, unknown> = {
      accountName,
      token,
    };

    if (gamesEnv) {
      const gameList = gamesEnv.split(',').map((g) => g.trim().toLowerCase());
      profile.genshin = gameList.includes('genshin') || gameList.includes('gi');
      profile.honkai_star_rail = gameList.includes('star_rail') || gameList.includes('hsr') || gameList.includes('honkai_star_rail');
      profile.honkai_3 = gameList.includes('honkai_3') || gameList.includes('hi3') || gameList.includes('honkai_impact_3rd');
      profile.tears_of_themis = gameList.includes('themis') || gameList.includes('tot') || gameList.includes('tears_of_themis');
      profile.zenless_zone_zero = gameList.includes('zzz') || gameList.includes('zenless_zone_zero');
    }

    profiles.push(profile);
  }

  if (profiles.length === 0) {
    return null;
  }

  const rawConfig: Record<string, unknown> = {
    profiles,
  };

  // Delay Range
  if (process.env.DELAY_MIN_MS && process.env.DELAY_MAX_MS) {
    const min = parseInt(process.env.DELAY_MIN_MS, 10);
    const max = parseInt(process.env.DELAY_MAX_MS, 10);
    if (!isNaN(min) && !isNaN(max)) {
      rawConfig.delayRangeMs = [min, max];
    }
  }

  // Retry & Timeout
  if (process.env.RETRY_COUNT) {
    rawConfig.retryCount = parseInt(process.env.RETRY_COUNT, 10);
  }
  if (process.env.REQUEST_TIMEOUT_MS) {
    rawConfig.requestTimeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS, 10);
  }
  if (process.env.FETCH_REWARD_DETAILS !== undefined) {
    rawConfig.fetchRewardDetails = process.env.FETCH_REWARD_DETAILS === 'true' || process.env.FETCH_REWARD_DETAILS === '1';
  }

  // Discord
  if (process.env.DISCORD_WEBHOOK_URL) {
    rawConfig.discord = {
      enabled: process.env.DISCORD_NOTIFY_ENABLED !== 'false',
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      pingUserId: process.env.DISCORD_PING_USER_ID,
      notifyOn: process.env.DISCORD_NOTIFY_ON,
    };
  }

  // Telegram
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    rawConfig.telegram = {
      enabled: process.env.TELEGRAM_NOTIFY_ENABLED !== 'false',
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
      notifyOn: process.env.TELEGRAM_NOTIFY_ON,
    };
  }

  // SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_TO) {
    rawConfig.smtp = {
      enabled: process.env.SMTP_NOTIFY_ENABLED !== 'false',
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_TO.includes(',') ? process.env.SMTP_TO.split(',').map((s) => s.trim()) : process.env.SMTP_TO,
      subjectPrefix: process.env.SMTP_SUBJECT_PREFIX,
      notifyOn: process.env.SMTP_NOTIFY_ON,
    };
  }

  // Generic Webhook
  if (process.env.WEBHOOK_URL) {
    rawConfig.webhook = {
      enabled: process.env.WEBHOOK_NOTIFY_ENABLED !== 'false',
      url: process.env.WEBHOOK_URL,
      notifyOn: process.env.WEBHOOK_NOTIFY_ON,
    };
  }

  return rawConfig;
}
