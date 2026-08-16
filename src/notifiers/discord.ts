import type { DiscordConfig } from '../types/config.ts';
import type { ClaimSummary } from '../types/hoyolab.ts';
import { BaseNotifier } from './base.ts';
import { requestJson } from '../utils/http.ts';
import { logger } from '../utils/logger.ts';
import { formatDuration, formatTimestamp } from '../utils/time.ts';

export class DiscordNotifier extends BaseNotifier {
  public readonly name = 'Discord';
  public readonly isEnabled: boolean;
  private readonly config: DiscordConfig;

  constructor(config?: DiscordConfig) {
    super(config?.notifyOn ?? 'always');
    this.config = config ?? { enabled: false, webhookUrl: '' };
    this.isEnabled = Boolean(this.config.enabled && this.config.webhookUrl);
  }

  public async send(summary: ClaimSummary): Promise<void> {
    if (!this.shouldNotify(summary)) return;

    logger.info('Sending Discord webhook notification...');

    try {
      const payload = this.buildPayload(summary);
      await requestJson(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        timeoutMs: 10000,
        retries: 2,
      });
      logger.success('Discord notification sent successfully.');
    } catch (err) {
      logger.error('Failed to send Discord notification:', err);
    }
  }

  private buildPayload(summary: ClaimSummary): Record<string, unknown> {
    const hasFailures = summary.failedCount > 0 || summary.captchaCount > 0;
    const isAllAlreadyClaimed = summary.alreadyClaimedCount > 0 && summary.successCount === 0 && !hasFailures;

    let embedColor = 0x2ecc71; // Green
    if (hasFailures) {
      embedColor = 0xe74c3c; // Red
    } else if (isAllAlreadyClaimed) {
      embedColor = 0xf1c40f; // Yellow/Gold
    }

    const fields = summary.accounts.map((acc) => {
      let lines: string[] = [];

      if (acc.results.length === 0) {
        lines.push('No games configured.');
      } else {
        lines = acc.results.map((res) => {
          const emoji = this.getStatusEmoji(res.status);
          let text = `${emoji} **${res.gameName}**: ${res.message}`;

          if (res.reward) {
            text += `\n└ 🎁 **${res.reward.name}** ×${res.reward.count}`;
          }
          if (res.signDays) {
            text += ` *(Day ${res.signDays})*`;
          }

          return text;
        });
      }

      return {
        name: `👤 ${acc.accountName}`,
        value: lines.join('\n') || 'None',
        inline: false,
      };
    });

    let content = '';
    if (this.config.pingUserId && hasFailures) {
      content = `<@${this.config.pingUserId}> ⚠️ Check-in encountered issues!`;
    }

    const embed = {
      title: '🌟 HoYoLAB Daily Check-In Report',
      color: embedColor,
      fields,
      footer: {
        text: `Success: ${summary.successCount} | Claimed: ${summary.alreadyClaimedCount} | Failed: ${summary.failedCount} | ${formatDuration(summary.durationMs)}`,
      },
      timestamp: summary.endTime.toISOString(),
    };

    return {
      username: 'HoYoLAB Daily Claim',
      avatar_url: 'https://i.imgur.com/LI1D4hP.png',
      content: content || undefined,
      embeds: [embed],
    };
  }
}
