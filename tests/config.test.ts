import { describe, expect, it } from 'bun:test';
import {
  ConfigError,
  normalizeCookieString,
  validateAccountProfile,
  validateAppConfig,
  validateDiscordConfig,
  validateSmtpConfig,
  validateTelegramConfig,
} from '../src/config/schema.ts';

describe('Config Schema & Normalization', () => {
  it('should normalize multiline and raw cookie strings', () => {
    const raw = `
      Cookie: ltoken_v2=v2_CANARIA3406;
      ltuid_v2=260000000;
      account_mid_v2=mid123;
    `;
    const normalized = normalizeCookieString(raw);

    expect(normalized).toBe('ltoken_v2=v2_CANARIA3406; ltuid_v2=260000000; account_mid_v2=mid123');
  });

  it('should validate account profile with default games if none specified', () => {
    const rawProfile = {
      accountName: 'TestUser',
      token: 'ltoken_v2=v2_abc; ltuid_v2=123;',
    };
    const profile = validateAccountProfile(rawProfile, 0);

    expect(profile.accountName).toBe('TestUser');
    expect(profile.genshin).toBe(true);
    expect(profile.honkai_star_rail).toBe(true);
    expect(profile.zenless_zone_zero).toBe(true);
  });

  it('should support game aliases (hsr, zzz, gi, hi3)', () => {
    const rawProfile = {
      accountName: 'Gamer',
      token: 'ltoken_v2=v2_abc; ltuid_v2=123;',
      hsr: true,
      zzz: true,
      genshin: false,
    };
    const profile = validateAccountProfile(rawProfile, 0);

    expect(profile.honkai_star_rail).toBe(true);
    expect(profile.zenless_zone_zero).toBe(true);
    expect(profile.genshin).toBe(false);
  });

  it('should throw ConfigError if token is missing or invalid', () => {
    expect(() => {
      validateAccountProfile({ accountName: 'NoToken' }, 0);
    }).toThrow(ConfigError);

    expect(() => {
      validateAccountProfile({ accountName: 'BadToken', token: 'invalid_cookie_string' }, 0);
    }).toThrow(ConfigError);
  });

  it('should validate Discord config', () => {
    const valid = validateDiscordConfig({
      enabled: true,
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      pingUserId: '987654321',
      notifyOn: 'on_error',
    });

    expect(valid).toBeDefined();
    expect(valid?.enabled).toBe(true);
    expect(valid?.pingUserId).toBe('987654321');
    expect(valid?.notifyOn).toBe('on_error');
  });

  it('should validate Telegram config', () => {
    const valid = validateTelegramConfig({
      enabled: true,
      botToken: '123456:ABC-DEF',
      chatId: '987654321',
    });

    expect(valid).toBeDefined();
    expect(valid?.botToken).toBe('123456:ABC-DEF');
    expect(valid?.notifyOn).toBe('always');
  });

  it('should validate SMTP config', () => {
    const valid = validateSmtpConfig({
      enabled: true,
      host: 'smtp.gmail.com',
      port: 587,
      user: 'user@gmail.com',
      pass: 'secretpass',
      from: 'user@gmail.com',
      to: ['friend@example.com'],
      notifyOn: 'always',
    });

    expect(valid).toBeDefined();
    expect(valid?.host).toBe('smtp.gmail.com');
    expect(valid?.port).toBe(587);
    expect(valid?.secure).toBe(false);
    expect(valid?.to).toEqual(['friend@example.com']);
  });

  it('should validate full AppConfig', () => {
    const fullConfig = {
      profiles: [
        {
          accountName: 'Main',
          token: 'ltoken_v2=v2_abc; ltuid_v2=123;',
          genshin: true,
          star_rail: true,
        },
      ],
      delayRangeMs: [2000, 4000],
      retryCount: 3,
      requestTimeoutMs: 8000,
    };

    const validated = validateAppConfig(fullConfig);
    expect(validated.profiles.length).toBe(1);
    expect(validated.delayRangeMs).toEqual([2000, 4000]);
    expect(validated.retryCount).toBe(3);
    expect(validated.requestTimeoutMs).toBe(8000);
  });
});
