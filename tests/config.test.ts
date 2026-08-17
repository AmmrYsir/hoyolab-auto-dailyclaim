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
import { loadConfig } from '../src/config/loader.ts';

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

  it('should validate account profile with separate ltoken_v2 and ltuid_v2 fields', () => {
    const rawProfile = {
      accountName: 'TravelerMain',
      ltoken_v2: 'v2_CANARIA3406',
      ltuid_v2: '260000000',
      genshin: true,
      honkai_star_rail: true,
    };
    const profile = validateAccountProfile(rawProfile, 0);

    expect(profile.accountName).toBe('TravelerMain');
    expect(profile.ltoken_v2).toBe('v2_CANARIA3406');
    expect(profile.ltuid_v2).toBe('260000000');
    expect(profile.token).toBe('ltoken_v2=v2_CANARIA3406; ltuid_v2=260000000;');
    expect(profile.genshin).toBe(true);
    expect(profile.honkai_star_rail).toBe(true);
  });

  it('should validate legacy account profile with combined token string', () => {
    const rawProfile = {
      accountName: 'LegacyUser',
      token: 'ltoken_v2=v2_abc; ltuid_v2=123;',
    };
    const profile = validateAccountProfile(rawProfile, 0);

    expect(profile.accountName).toBe('LegacyUser');
    expect(profile.ltoken_v2).toBe('v2_abc');
    expect(profile.ltuid_v2).toBe('123');
    expect(profile.token).toBe('ltoken_v2=v2_abc; ltuid_v2=123');
    expect(profile.genshin).toBe(true);
    expect(profile.honkai_star_rail).toBe(true);
    expect(profile.zenless_zone_zero).toBe(true);
  });

  it('should support game aliases (hsr, zzz, gi, hi3)', () => {
    const rawProfile = {
      accountName: 'Gamer',
      ltoken_v2: 'v2_abc',
      ltuid_v2: '123',
      hsr: true,
      zzz: true,
      genshin: false,
    };
    const profile = validateAccountProfile(rawProfile, 0);

    expect(profile.honkai_star_rail).toBe(true);
    expect(profile.zenless_zone_zero).toBe(true);
    expect(profile.genshin).toBe(false);
  });

  it('should throw ConfigError if credentials are missing or invalid', () => {
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
          ltoken_v2: 'v2_abc',
          ltuid_v2: '123',
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

  it('should load multi-account configuration from HOYOLAB_ACCOUNTS environment variable', async () => {
    const prevAccounts = process.env.HOYOLAB_ACCOUNTS;
    process.env.HOYOLAB_ACCOUNTS = JSON.stringify([
      {
        accountName: 'EnvAccount1',
        ltoken_v2: 'v2_token1',
        ltuid_v2: '111',
        genshin: true,
      },
      {
        accountName: 'EnvAccount2',
        ltoken_v2: 'v2_token2',
        ltuid_v2: '222',
        honkai_star_rail: true,
      },
    ]);

    try {
      const config = await loadConfig({ cwd: import.meta.dir });
      expect(config.profiles.length).toBe(2);
      expect(config.profiles[0]?.accountName).toBe('EnvAccount1');
      expect(config.profiles[1]?.accountName).toBe('EnvAccount2');
    } finally {
      if (prevAccounts !== undefined) {
        process.env.HOYOLAB_ACCOUNTS = prevAccounts;
      } else {
        delete process.env.HOYOLAB_ACCOUNTS;
      }
    }
  });
});
