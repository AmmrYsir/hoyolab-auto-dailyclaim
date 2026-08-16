import type { TelegramConfig } from '../types/config.ts';
import type { ClaimSummary } from '../types/hoyolab.ts';
import { BaseNotifier } from './base.ts';
import { requestJson } from '../utils/http.ts';
import { logger } from '../utils/logger.ts';
import { formatDuration } from '../utils/time.ts';

export class TelegramNotifier extends BaseNotifier {
  public readonly name = 'Telegram';
  public readonly isEnabled: boolean;
  private readonly config: TelegramConfig;

  constructor(config?: TelegramConfig) {
    super(config?.notifyOn ?? 'always');
    this.config = config ?? { enabled: false, botToken: '', chatId: '' };
    this.isEnabled = Boolean(this.config.enabled && this.config.botToken && this.config.chatId);
  }

  public async send(summary: ClaimSummary): Promise<void> {
    if (!this.shouldNotify(summary)) return;

    logger.info('Sending Telegram notification...');

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      const messageText = this.buildMessage(summary);

      await requestJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          chat_id: this.config.chatId,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        },
        timeoutMs: 10000,
        retries: 2,
      });

      logger.success('Telegram notification sent successfully.');
    } catch (err) {
      logger.error('Failed to send Telegram notification:', err);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private buildMessage(summary: ClaimSummary): string {
    const lines: string[] = ['<b>🌟 HoYoLAB Daily Check-In Report</b>\n'];

    for (const acc of summary.accounts) {
      lines.push(`👤 <b>Account: ${this.escapeHtml(acc.accountName)}</b>`);

      if (acc.results.length === 0) {
        lines.push('  <i>No games configured.</i>');
      } else {
        for (const res of acc.results) {
          const emoji = this.getStatusEmoji(res.status);
          let itemStr = `  ${emoji} <b>${this.escapeHtml(res.gameName)}</b>: ${this.escapeHtml(res.message)}`;

          if (res.reward) {
            itemStr += `\n    └ 🎁 <code>${this.escapeHtml(res.reward.name)} x${res.reward.count}</code>`;
          }
          if (res.signDays) {
            itemStr += ` <i>(Day ${res.signDays})</i>`;
          }

          lines.push(itemStr);
        }
      }
      lines.push('');
    }

    const stats = [
      `✅ Success: <b>${summary.successCount}</b>`,
      `🟡 Claimed: <b>${summary.alreadyClaimedCount}</b>`,
      `❌ Failed: <b>${summary.failedCount}</b>`,
    ];
    if (summary.captchaCount > 0) {
      stats.push(`🚨 CAPTCHA: <b>${summary.captchaCount}</b>`);
    }

    lines.push(`📊 ${stats.join(' | ')}`);
    lines.push(`⏱ Duration: <code>${formatDuration(summary.durationMs)}</code>`);

    return lines.join('\n');
  }
}
