import { describe, expect, it } from 'bun:test';
import {
  maskCookieString,
  maskDiscordWebhook,
  maskSecret,
  maskTelegramToken,
  sanitizeText,
} from '../src/utils/sanitizer.ts';

describe('Sanitizer Utilities', () => {
  it('should mask generic secrets properly', () => {
    expect(maskSecret('')).toBe('');
    expect(maskSecret('short')).toBe('***');
    expect(maskSecret('abcdefghijklmnop', 3, 3)).toBe('abc***nop');
  });

  it('should mask sensitive cookie values', () => {
    const rawCookie =
      'ltoken_v2=v2_CANARIA1234567890ABCDEF3406; ltuid_v2=261234567; other_pref=darkmode;';
    const masked = maskCookieString(rawCookie);

    expect(masked).not.toContain('CANARIA1234567890ABCDEF');
    expect(masked).not.toContain('261234567');
    expect(masked).toContain('ltoken_v2=v2_***406');
    expect(masked).toContain('ltuid_v2=261***567');
    expect(masked).toContain('other_pref=da***de');
  });

  it('should mask Discord webhook URLs', () => {
    const webhook =
      'https://discord.com/api/webhooks/1050000000000000060/6aXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXnB';
    const masked = maskDiscordWebhook(webhook);

    expect(masked).toContain('https://discord.com/api/webhooks/1050000000000000060/6aX***XnB');
    expect(masked).not.toContain('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  });

  it('should mask Telegram bot tokens', () => {
    const token = '1234567890:ABC-DEF1234ghIkl-ZYX987654321_tokenPeko';
    const masked = maskTelegramToken(token);

    expect(masked).toContain('1234567890:ABC***eko');
    expect(masked).not.toContain('DEF1234ghIkl-ZYX987654321');
  });

  it('should sanitize full log strings containing mixed sensitive data', () => {
    const log =
      'Error occurred for account with cookie ltoken_v2=v2_SECRETTOKEN12345; ltuid_v2=12345678; sending to https://discord.com/api/webhooks/999999999/SecretWebhookTokenXYZ and Telegram 987654321:BotTokenSecretSecretSecretSecret12345';
    const sanitized = sanitizeText(log);

    expect(sanitized).not.toContain('SECRETTOKEN');
    expect(sanitized).not.toContain('SecretWebhookTokenXYZ');
    expect(sanitized).not.toContain('BotTokenSecretSecretSecretSecret12345');
    expect(sanitized).toContain('ltoken_v2=v2_***345');
    expect(sanitized).toContain('ltuid_v2=123***678');
  });
});
