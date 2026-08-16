import type { WebhookConfig } from '../types/config.ts';
import type { ClaimSummary } from '../types/hoyolab.ts';
import { BaseNotifier } from './base.ts';
import { requestJson } from '../utils/http.ts';
import { logger } from '../utils/logger.ts';

export class GenericWebhookNotifier extends BaseNotifier {
  public readonly name = 'Generic Webhook';
  public readonly isEnabled: boolean;
  private readonly config: WebhookConfig;

  constructor(config?: WebhookConfig) {
    super(config?.notifyOn ?? 'always');
    this.config = config ?? { enabled: false, url: '' };
    this.isEnabled = Boolean(this.config.enabled && this.config.url);
  }

  public async send(summary: ClaimSummary): Promise<void> {
    if (!this.shouldNotify(summary)) return;

    logger.info(`Sending generic webhook notification to ${this.config.url}...`);

    try {
      await requestJson(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.headers ?? {}),
        },
        body: {
          event: 'hoyolab.checkin.completed',
          timestamp: summary.endTime.toISOString(),
          summary,
        },
        timeoutMs: 10000,
        retries: 2,
      });
      logger.success('Generic webhook notification sent successfully.');
    } catch (err) {
      logger.error('Failed to send generic webhook notification:', err);
    }
  }
}
