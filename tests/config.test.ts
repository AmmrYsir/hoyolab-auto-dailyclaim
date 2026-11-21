import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

    assert.strictEqual(normalized, 'ltoken_v2=v2_CANARIA3406; ltuid_v2=260000000; account_mid_v2=mid123');
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

    assert.strictEqual(profile.accountName, 'TravelerMain');
    assert.strictEqual(profile.ltoken_v2, 'v2_CANARIA3406');
    assert.strictEqual(profile.ltuid_v2, '260000000');
    assert.strictEqual(profile.token, 'ltoken_v2=v2_CANARIA3406; ltuid_v2=260000000;');
    assert.strictEqual(profile.genshin, true);
    assert.strictEqual(profile.honkai_star_rail, true);
  });

  it('should validate legacy account profile with combined token string', () => {
    const rawProfile = {
      accountName: 'LegacyUser',
      token: 'ltoken_v2=v2_abc; ltuid_v2=123;',
    };
    const profile = validateAccountProfile(rawProfile, 0);

    assert.strictEqual(profile.accountName, 'LegacyUser');
    assert.strictEqual(profile.ltoken_v2, 'v2_abc');
    assert.strictEqual(profile.ltuid_v2, '123');
    assert.strictEqual(profile.token, 'ltoken_v2=v2_abc; ltuid_v2=123');
    assert.strictEqual(profile.genshin, true);
    assert.strictEqual(profile.honkai_star_rail, true);
    assert.strictEqual(profile.zenless_zone_zero, true);
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

    assert.strictEqual(profile.honkai_star_rail, true);
    assert.strictEqual(profile.zenless_zone_zero, true);
    assert.strictEqual(profile.genshin, false);
  });

  it('should throw ConfigError if credentials are missing or invalid', () => {
    assert.throws(() => {
      validateAccountProfile({ accountName: 'NoToken' }, 0);
    }, ConfigError);

    assert.throws(() => {
      validateAccountProfile({ accountName: 'BadToken', token: 'invalid_cookie_string' }, 0);
    }, ConfigError);
  });

  it('should validate Discord config', () => {
    const valid = validateDiscordConfig({
      enabled: true,
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      pingUserId: '987654321',
      notifyOn: 'on_error',
    });

    assert.notStrictEqual(valid, undefined);
    assert.strictEqual(valid?.enabled, true);
    assert.strictEqual(valid?.pingUserId, '987654321');
    assert.strictEqual(valid?.notifyOn, 'on_error');
  });

  it('should validate Telegram config', () => {
    const valid = validateTelegramConfig({
      enabled: true,
      botToken: '123456:ABC-DEF',
      chatId: '987654321',
    });

    assert.notStrictEqual(valid, undefined);
    assert.strictEqual(valid?.botToken, '123456:ABC-DEF');
    assert.strictEqual(valid?.notifyOn, 'always');
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

    assert.notStrictEqual(valid, undefined);
    assert.strictEqual(valid?.host, 'smtp.gmail.com');
    assert.strictEqual(valid?.port, 587);
    assert.strictEqual(valid?.secure, false);
    assert.deepStrictEqual(valid?.to, ['friend@example.com']);
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
    assert.strictEqual(validated.profiles.length, 1);
    assert.deepStrictEqual(validated.delayRangeMs, [2000, 4000]);
    assert.strictEqual(validated.retryCount, 3);
    assert.strictEqual(validated.requestTimeoutMs, 8000);
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
      const config = await loadConfig({ cwd: import.meta.dirname });
      assert.strictEqual(config.profiles.length, 2);
      assert.strictEqual(config.profiles[0]?.accountName, 'EnvAccount1');
      assert.strictEqual(config.profiles[1]?.accountName, 'EnvAccount2');
    } finally {
      if (prevAccounts !== undefined) {
        process.env.HOYOLAB_ACCOUNTS = prevAccounts;
      } else {
        delete process.env.HOYOLAB_ACCOUNTS;
      }
    }
  });
});
