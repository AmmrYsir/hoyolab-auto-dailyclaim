#!/usr/bin/env bun
import { loadConfig } from './config/loader.ts';
import { ClaimCoordinator } from './services/claimer.ts';
import { NotificationManager } from './notifiers/index.ts';
import { logger } from './utils/logger.ts';
import { maskCookieString } from './utils/sanitizer.ts';

const VERSION = '2.0.0';

function printHelp(): void {
  console.log(`
\x1b[1m\x1b[36mHoYoLAB Auto Daily Claim v${VERSION}\x1b[0m
Automated, secure, and lightweight daily check-in rewards claimer.

\x1b[1mUSAGE:\x1b[0m
  bun run start [OPTIONS]
  bun run src/index.ts [OPTIONS]

\x1b[1mOPTIONS:\x1b[0m
  -c, --config <path>    Path to JSON configuration file (default: config.json)
  -d, --dry-run          Test configuration & tokens without claiming rewards
      --validate         Validate configuration file and token format without making requests
  -h, --help             Show this help message and exit
  -v, --version          Show version and exit

\x1b[1mEXAMPLES:\x1b[0m
  bun run start
  bun run start --dry-run
  bun run start --config my-custom-config.json
  bun run start --validate

\x1b[1mDOCUMENTATION:\x1b[0m
  https://github.com/AmmrYsir/hoyolab-auto-dailyclaim
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse CLI flags
  let configPath: string | undefined;
  let isDryRun = false;
  let isValidateOnly = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '-v' || arg === '--version') {
      console.log(`v${VERSION}`);
      process.exit(0);
    }
    if (arg === '-d' || arg === '--dry-run') {
      isDryRun = true;
    }
    if (arg === '--validate') {
      isValidateOnly = true;
    }
    if ((arg === '-c' || arg === '--config') && i + 1 < args.length) {
      configPath = args[++i];
    }
  }

  logger.info(`Starting HoYoLAB Auto Daily Claim v${VERSION}`);

  try {
    const config = await loadConfig({ configPath });

    if (isValidateOnly) {
      logger.success('Configuration is valid!');
      logger.info(`Accounts configured: ${config.profiles.length}`);
      for (const p of config.profiles) {
        logger.info(`  • "${p.accountName}": ${maskCookieString(p.token)}`);
      }
      if (config.discord?.enabled) logger.info('  • Discord notifier: Enabled');
      if (config.telegram?.enabled) logger.info('  • Telegram notifier: Enabled');
      if (config.smtp?.enabled) logger.info(`  • SMTP notifier: Enabled (${config.smtp.host}:${config.smtp.port})`);
      if (config.webhook?.enabled) logger.info(`  • Generic Webhook notifier: Enabled`);
      process.exit(0);
    }

    const coordinator = new ClaimCoordinator(config);
    const notificationManager = new NotificationManager(config);

    const summary = await coordinator.run({ dryRun: isDryRun });

    await notificationManager.dispatchAll(summary);

    if (summary.failedCount > 0 && !isDryRun) {
      logger.warn(`Completed with ${summary.failedCount} error(s).`);
      process.exit(1);
    } else {
      logger.success('All tasks finished successfully.');
      process.exit(0);
    }
  } catch (error: unknown) {
    logger.error('Fatal execution error:', error);
    process.exit(1);
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

main();
