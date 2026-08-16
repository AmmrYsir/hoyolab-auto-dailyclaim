import type { GameKey } from './game.ts';

export type NotificationPolicy = 'always' | 'on_error' | 'on_claim';

export interface AccountProfile {
  accountName: string;
  token: string;
  games?: Partial<Record<GameKey, boolean>>;
  genshin?: boolean;
  honkai_star_rail?: boolean;
  honkai_3?: boolean;
  tears_of_themis?: boolean;
  zenless_zone_zero?: boolean;
}

export interface DiscordConfig {
  enabled: boolean;
  webhookUrl: string;
  pingUserId?: string;
  notifyOn?: NotificationPolicy;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  notifyOn?: NotificationPolicy;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure?: boolean; // true for port 465 (SSL/TLS), false for 587/25 (STARTTLS)
  user: string;
  pass: string;
  from: string;
  to: string | string[];
  subjectPrefix?: string;
  notifyOn?: NotificationPolicy;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  headers?: Record<string, string>;
  notifyOn?: NotificationPolicy;
}

export interface AppConfig {
  profiles: AccountProfile[];
  delayRangeMs?: [number, number]; // e.g. [1500, 3000]
  retryCount?: number;             // default: 2
  requestTimeoutMs?: number;       // default: 10000
  fetchRewardDetails?: boolean;    // default: true
  discord?: DiscordConfig;
  telegram?: TelegramConfig;
  smtp?: SmtpConfig;
  webhook?: WebhookConfig;
}
