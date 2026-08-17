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
  const envConfig = buildConfigFromEnv();

  // 1. Explicit path if provided
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
      const merged = mergeWithEnv(parsed, envConfig);
      return validateAppConfig(merged);
    } catch (e: unknown) {
      if (e instanceof ConfigError) throw e;
      throw new ConfigError(
        `Failed to parse config file "${explicitPath}": ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  // 2. HOYOLAB_CONFIG_JSON environment variable (great for CI/CD like GitHub Actions)
  if (process.env.HOYOLAB_CONFIG_JSON) {
    logger.info('Loading configuration from HOYOLAB_CONFIG_JSON environment variable');
    try {
      const parsed = JSON.parse(process.env.HOYOLAB_CONFIG_JSON);
      const merged = mergeWithEnv(parsed, envConfig);
      return validateAppConfig(merged);
    } catch (e: unknown) {
      if (e instanceof ConfigError) throw e;
      throw new ConfigError(`Invalid JSON in HOYOLAB_CONFIG_JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. Standard config.json in working directory
  const defaultConfigPath = resolve(cwd, 'config.json');
  if (existsSync(defaultConfigPath)) {
    logger.info('Loading configuration from config.json');
    const file = Bun.file(defaultConfigPath);
    const content = await file.text();
    try {
      const parsed = JSON.parse(content);
      const merged = mergeWithEnv(parsed, envConfig);
      return validateAppConfig(merged);
    } catch (e: unknown) {
      if (e instanceof ConfigError) throw e;
      throw new ConfigError(`Failed to parse config.json: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. Configuration from environment variables (HOYOLAB_ACCOUNTS in .env)
  if (envConfig && Array.isArray(envConfig.profiles) && envConfig.profiles.length > 0) {
    logger.info('Loading configuration from environment variables (.env)');
    return validateAppConfig(envConfig);
  }

  throw new ConfigError(
    'No valid configuration found! Please create a "config.json" file (see config.example.json) or set "HOYOLAB_ACCOUNTS" in ".env".'
  );
}

/**
 * Merge parsed file configuration with environment variables (.env).
 * File values take precedence if explicitly provided, with .env providing secrets & notifications.
 */
function mergeWithEnv(
  fileConfig: Record<string, unknown>,
  envConfig: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...envConfig,
    ...fileConfig,
  };

  // Ensure notification objects merge cleanly
  if (fileConfig.discord || envConfig.discord) {
    merged.discord = fileConfig.discord ?? envConfig.discord;
  }
  if (fileConfig.telegram || envConfig.telegram) {
    merged.telegram = fileConfig.telegram ?? envConfig.telegram;
  }
  if (fileConfig.smtp || envConfig.smtp) {
    merged.smtp = fileConfig.smtp ?? envConfig.smtp;
  }
  if (fileConfig.webhook || envConfig.webhook) {
    merged.webhook = fileConfig.webhook ?? envConfig.webhook;
  }

  return merged;
}

function buildConfigFromEnv(): Record<string, unknown> {
  const rawConfig: Record<string, unknown> = {};
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

  if (profiles.length > 0) {
    rawConfig.profiles = profiles;
  }

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
    rawConfig.fetchRewardDetails =
      process.env.FETCH_REWARD_DETAILS === 'true' || process.env.FETCH_REWARD_DETAILS === '1';
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
      to: process.env.SMTP_TO.includes(',')
        ? process.env.SMTP_TO.split(',').map((s) => s.trim())
        : process.env.SMTP_TO,
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
