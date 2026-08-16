import type { AppConfig } from '../types/config.ts';
import type { ClaimSummary } from '../types/hoyolab.ts';
import type { Notifier } from '../types/notification.ts';
import { ConsoleNotifier } from './console.ts';
import { DiscordNotifier } from './discord.ts';
import { TelegramNotifier } from './telegram.ts';
import { SmtpNotifier } from './smtp.ts';
import { GenericWebhookNotifier } from './webhook.ts';
import { logger } from '../utils/logger.ts';

export * from './base.ts';
export * from './console.ts';
export * from './discord.ts';
export * from './telegram.ts';
export * from './smtp.ts';
export * from './webhook.ts';

export class NotificationManager {
  private notifiers: Notifier[] = [];

  constructor(config: AppConfig) {
    if (config.discord) {
      this.notifiers.push(new DiscordNotifier(config.discord));
    }
    if (config.telegram) {
      this.notifiers.push(new TelegramNotifier(config.telegram));
    }
    if (config.smtp) {
      this.notifiers.push(new SmtpNotifier(config.smtp));
    }
    if (config.webhook) {
      this.notifiers.push(new GenericWebhookNotifier(config.webhook));
    }
  }

  public async dispatchAll(summary: ClaimSummary): Promise<void> {
    // 1. Always output console table summary
    ConsoleNotifier.printSummary(summary);

    // 2. Dispatch to all enabled remote notifiers
    const activeNotifiers = this.notifiers.filter((n) => n.isEnabled);

    if (activeNotifiers.length === 0) {
      logger.debug('No external notifiers configured or enabled.');
      return;
    }

    logger.info(`Dispatching notifications to ${activeNotifiers.length} channel(s): ${activeNotifiers.map((n) => n.name).join(', ')}`);

    await Promise.allSettled(
      activeNotifiers.map(async (notifier) => {
        try {
          await notifier.send(summary);
        } catch (err) {
          logger.error(`Error in notifier "${notifier.name}":`, err);
        }
      })
    );
  }
}
