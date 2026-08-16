import { describe, expect, it } from 'bun:test';
import { DiscordNotifier } from '../src/notifiers/discord.ts';
import { TelegramNotifier } from '../src/notifiers/telegram.ts';
import { SmtpNotifier } from '../src/notifiers/smtp.ts';
import type { ClaimSummary } from '../src/types/hoyolab.ts';

describe('Notifiers Formatting & Policies', () => {
  const mockSummary: ClaimSummary = {
    totalAccounts: 1,
    totalGames: 2,
    successCount: 1,
    alreadyClaimedCount: 1,
    failedCount: 0,
    captchaCount: 0,
    durationMs: 3200,
    startTime: new Date('2026-08-16T12:00:00Z'),
    endTime: new Date('2026-08-16T12:00:03Z'),
    accounts: [
      {
        accountName: 'TravelerMain',
        overallStatus: 'SUCCESS',
        results: [
          {
            gameKey: 'genshin',
            gameName: 'Genshin Impact',
            status: 'SUCCESS',
            message: 'Check-in successful',
            retcode: 0,
            reward: { name: 'Primogems', icon: '', count: 20 },
            signDays: 14,
            timestamp: new Date(),
          },
          {
            gameKey: 'honkai_star_rail',
            gameName: 'Honkai: Star Rail',
            status: 'ALREADY_CLAIMED',
            message: "You've already checked in today",
            retcode: -5003,
            reward: { name: 'Stellar Jade', icon: '', count: 20 },
            signDays: 10,
            timestamp: new Date(),
          },
        ],
      },
    ],
  };

  const mockFailureSummary: ClaimSummary = {
    ...mockSummary,
    successCount: 0,
    failedCount: 1,
    captchaCount: 1,
    accounts: [
      {
        accountName: 'AltAccount',
        overallStatus: 'FAILED',
        results: [
          {
            gameKey: 'zenless_zone_zero',
            gameName: 'Zenless Zone Zero',
            status: 'CAPTCHA_TRIGGERED',
            message: 'Auto check-in blocked by Geetest CAPTCHA',
            retcode: 1034,
            timestamp: new Date(),
          },
        ],
      },
    ],
  };

  it('DiscordNotifier should respect notification policy and format embeds', () => {
    const discord = new DiscordNotifier({
      enabled: true,
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      pingUserId: '1234567890',
      notifyOn: 'on_error',
    });

    expect(discord.isEnabled).toBe(true);
    expect(discord.shouldNotify(mockSummary)).toBe(false);
    expect(discord.shouldNotify(mockFailureSummary)).toBe(true);
  });

  it('TelegramNotifier should respect notification policy', () => {
    const telegram = new TelegramNotifier({
      enabled: true,
      botToken: '123:abc',
      chatId: '456',
      notifyOn: 'always',
    });

    expect(telegram.isEnabled).toBe(true);
    expect(telegram.shouldNotify(mockSummary)).toBe(true);
  });

  it('SmtpNotifier should build appropriate subject lines based on status', () => {
    const smtp = new SmtpNotifier({
      enabled: true,
      host: 'smtp.example.com',
      port: 587,
      user: 'test@example.com',
      pass: 'pass',
      from: 'test@example.com',
      to: 'me@example.com',
      subjectPrefix: '[HoYoLAB Test]',
      notifyOn: 'always',
    });

    expect(smtp.isEnabled).toBe(true);
    expect(smtp.shouldNotify(mockSummary)).toBe(true);
  });
});
