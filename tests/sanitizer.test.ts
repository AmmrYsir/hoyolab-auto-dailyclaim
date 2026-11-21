import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  maskCookieString,
  maskDiscordWebhook,
  maskSecret,
  maskTelegramToken,
  sanitizeText,
} from '../src/utils/sanitizer.ts';

describe('Sanitizer Utilities', () => {
  it('should mask generic secrets properly', () => {
    assert.strictEqual(maskSecret(''), '');
    assert.strictEqual(maskSecret('short'), '***');
    assert.strictEqual(maskSecret('abcdefghijklmnop', 3, 3), 'abc***nop');
  });

  it('should mask sensitive cookie values', () => {
    const rawCookie =
      'ltoken_v2=v2_CANARIA1234567890ABCDEF3406; ltuid_v2=261234567; other_pref=darkmode;';
    const masked = maskCookieString(rawCookie);

    assert.ok(!masked.includes('CANARIA1234567890ABCDEF'));
    assert.ok(!masked.includes('261234567'));
    assert.ok(masked.includes('ltoken_v2=v2_***406'));
    assert.ok(masked.includes('ltuid_v2=261***567'));
    assert.ok(masked.includes('other_pref=da***de'));
  });

  it('should mask Discord webhook URLs', () => {
    const webhook =
      'https://discord.com/api/webhooks/1050000000000000060/6aXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXnB';
    const masked = maskDiscordWebhook(webhook);

    assert.ok(masked.includes('https://discord.com/api/webhooks/1050000000000000060/6aX***XnB'));
    assert.ok(!masked.includes('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'));
  });

  it('should mask Telegram bot tokens', () => {
    const token = '1234567890:ABC-DEF1234ghIkl-ZYX987654321_tokenPeko';
    const masked = maskTelegramToken(token);

    assert.ok(masked.includes('1234567890:ABC***eko'));
    assert.ok(!masked.includes('DEF1234ghIkl-ZYX987654321'));
  });

  it('should sanitize full log strings containing mixed sensitive data', () => {
    const log =
      'Error occurred for account with cookie ltoken_v2=v2_SECRETTOKEN12345; ltuid_v2=12345678; sending to https://discord.com/api/webhooks/999999999/SecretWebhookTokenXYZ and Telegram 987654321:BotTokenSecretSecretSecretSecret12345';
    const sanitized = sanitizeText(log);

    assert.ok(!sanitized.includes('SECRETTOKEN'));
    assert.ok(!sanitized.includes('SecretWebhookTokenXYZ'));
    assert.ok(!sanitized.includes('BotTokenSecretSecretSecretSecret12345'));
    assert.ok(sanitized.includes('ltoken_v2=v2_***345'));
    assert.ok(sanitized.includes('ltuid_v2=123***678'));
  });
});
