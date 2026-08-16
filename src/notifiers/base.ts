import type { ClaimSummary, ClaimResult, ClaimStatus } from '../types/hoyolab.ts';
import type { NotificationPolicy } from '../types/config.ts';
import type { Notifier } from '../types/notification.ts';

export abstract class BaseNotifier implements Notifier {
  public abstract readonly name: string;
  public abstract readonly isEnabled: boolean;
  public readonly policy: NotificationPolicy;

  constructor(policy: NotificationPolicy = 'always') {
    this.policy = policy;
  }

  public shouldNotify(summary: ClaimSummary): boolean {
    if (!this.isEnabled) return false;

    if (this.policy === 'on_error') {
      return summary.failedCount > 0 || summary.captchaCount > 0;
    }

    if (this.policy === 'on_claim') {
      return summary.successCount > 0;
    }

    return true; // 'always'
  }

  public abstract send(summary: ClaimSummary): Promise<void>;

  protected getStatusEmoji(status: ClaimStatus): string {
    switch (status) {
      case 'SUCCESS':
        return '✅';
      case 'ALREADY_CLAIMED':
        return '🟡';
      case 'CAPTCHA_TRIGGERED':
        return '🚨';
      case 'INVALID_TOKEN':
        return '🔑';
      case 'NO_CHARACTER':
        return '👤';
      case 'NETWORK_ERROR':
        return '🌐';
      case 'UNKNOWN_ERROR':
      default:
        return '❌';
    }
  }

  protected formatResultLine(res: ClaimResult): string {
    const emoji = this.getStatusEmoji(res.status);
    let line = `${emoji} <b>${res.gameName}</b>: ${res.message}`;

    if (res.reward) {
      line += ` [${res.reward.name} x${res.reward.count}]`;
    }
    if (res.signDays) {
      line += ` (Day ${res.signDays})`;
    }

    return line;
  }
}
