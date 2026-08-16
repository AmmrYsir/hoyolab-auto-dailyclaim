import type { ClaimSummary } from '../types/hoyolab.ts';
import { formatDuration } from '../utils/time.ts';

export class ConsoleNotifier {
  public static printSummary(summary: ClaimSummary): void {
    const divider = '─'.repeat(70);
    const doubleDivider = '═'.repeat(70);

    console.log(`\n${doubleDivider}`);
    console.log(`  🌟 HOYOLAB DAILY CHECK-IN SUMMARY`);
    console.log(doubleDivider);

    for (const acc of summary.accounts) {
      console.log(`\n  👤 Account: ${acc.accountName} (${acc.overallStatus})`);
      console.log(`  ${divider}`);

      if (acc.results.length === 0) {
        console.log('     No games configured.');
      } else {
        for (const res of acc.results) {
          const icon =
            res.status === 'SUCCESS'
              ? '\x1b[32m✔\x1b[0m'
              : res.status === 'ALREADY_CLAIMED'
              ? '\x1b[33m•\x1b[0m'
              : '\x1b[31m✖\x1b[0m';

          const reward = res.reward ? ` [${res.reward.name} x${res.reward.count}]` : '';
          const streak = res.signDays ? ` (Day ${res.signDays})` : '';

          console.log(`    ${icon} ${res.gameName.padEnd(20)} : ${res.message}${reward}${streak}`);
        }
      }
    }

    console.log(`\n${divider}`);
    console.log(
      `  📊 Stats: ` +
        `\x1b[32mSuccess: ${summary.successCount}\x1b[0m | ` +
        `\x1b[33mAlready Claimed: ${summary.alreadyClaimedCount}\x1b[0m | ` +
        `\x1b[31mFailed: ${summary.failedCount}\x1b[0m` +
        (summary.captchaCount > 0 ? ` (\x1b[35mCAPTCHA: ${summary.captchaCount}\x1b[0m)` : '') +
        ` | Duration: ${formatDuration(summary.durationMs)}`
    );
    console.log(`${doubleDivider}\n`);
  }
}
