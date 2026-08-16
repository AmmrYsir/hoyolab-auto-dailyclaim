import type { AppConfig, AccountProfile } from '../types/config.ts';
import type { GameKey } from '../types/game.ts';
import type {
  AccountClaimResult,
  ClaimResult,
  ClaimSummary,
} from '../types/hoyolab.ts';
import { GAMES } from '../constants/games.ts';
import { HoYoLabClient } from './hoyolab-client.ts';
import { randomDelay } from '../utils/time.ts';
import { logger } from '../utils/logger.ts';

export interface ClaimOptions {
  dryRun?: boolean;
}

export class ClaimCoordinator {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Run the complete daily check-in routine across all accounts and configured games.
   */
  public async run(options: ClaimOptions = {}): Promise<ClaimSummary> {
    const startTime = new Date();
    const accountResults: AccountClaimResult[] = [];

    const delayRange = this.config.delayRangeMs ?? [1500, 3000];
    const isDryRun = Boolean(options.dryRun);

    if (isDryRun) {
      logger.info('--- RUNNING IN DRY-RUN MODE (No check-in requests will be committed) ---');
    }

    logger.info(`Starting check-in for ${this.config.profiles.length} account(s)...`);

    for (let pIdx = 0; pIdx < this.config.profiles.length; pIdx++) {
      const profile = this.config.profiles[pIdx]!;
      logger.info(`[${pIdx + 1}/${this.config.profiles.length}] Processing account: "${profile.accountName}"`);

      const client = new HoYoLabClient(profile.token, {
        timeoutMs: this.config.requestTimeoutMs,
        retryCount: this.config.retryCount,
        fetchRewardDetails: this.config.fetchRewardDetails,
      });

      const enabledGames = this.getEnabledGames(profile);
      if (enabledGames.length === 0) {
        logger.warn(`No games enabled for profile "${profile.accountName}". Skipping.`);
        accountResults.push({
          accountName: profile.accountName,
          results: [],
          overallStatus: 'SUCCESS',
        });
        continue;
      }

      const claimResults: ClaimResult[] = [];

      for (let gIdx = 0; gIdx < enabledGames.length; gIdx++) {
        const gameKey = enabledGames[gIdx]!;
        const gameDef = GAMES[gameKey];

        logger.info(`Checking in ${gameDef.name} for ${profile.accountName}...`);

        let result: ClaimResult;

        if (isDryRun) {
          // In dry-run mode, query the info endpoint to check credentials without claiming
          const info = await client.getInfo(gameKey);
          if (info) {
            const rewardDetails = await client.getTodayReward(gameKey, info.totalSignDays);
            result = {
              gameKey,
              gameName: gameDef.name,
              status: info.isSignToday ? 'ALREADY_CLAIMED' : 'SUCCESS',
              message: info.isSignToday
                ? `[DRY-RUN] Already signed in today (${info.totalSignDays} days total)`
                : `[DRY-RUN] Valid token. Ready to claim (Streak: ${info.totalSignDays} days)`,
              retcode: 0,
              reward: rewardDetails.reward,
              signDays: info.totalSignDays,
              timestamp: new Date(),
            };
          } else {
            result = {
              gameKey,
              gameName: gameDef.name,
              status: 'INVALID_TOKEN',
              message: '[DRY-RUN] Could not fetch account info. Token may be invalid or expired.',
              retcode: -100,
              timestamp: new Date(),
            };
          }
        } else {
          result = await client.claimGame(gameKey);
        }

        claimResults.push(result);

        // Log result
        if (result.status === 'SUCCESS') {
          const rewardText = result.reward ? ` (${result.reward.name} x${result.reward.count})` : '';
          const dayText = result.signDays ? ` [Day ${result.signDays}]` : '';
          logger.success(`  ✓ ${gameDef.name}: ${result.message}${rewardText}${dayText}`);
        } else if (result.status === 'ALREADY_CLAIMED') {
          const rewardText = result.reward ? ` (${result.reward.name} x${result.reward.count})` : '';
          const dayText = result.signDays ? ` [Day ${result.signDays}]` : '';
          logger.info(`  • ${gameDef.name}: ${result.message}${rewardText}${dayText}`);
        } else if (result.status === 'CAPTCHA_TRIGGERED') {
          logger.error(`  ✗ ${gameDef.name}: CAPTCHA / Geetest risk triggered!`);
        } else {
          logger.warn(`  ✗ ${gameDef.name}: ${result.message}`);
        }

        // Apply delay between requests (except after the last game of the last profile)
        const isLastRequest = pIdx === this.config.profiles.length - 1 && gIdx === enabledGames.length - 1;
        if (!isLastRequest && delayRange[1] > 0) {
          const delayTime = await randomDelay(delayRange[0], delayRange[1]);
          logger.debug(`Waiting ${(delayTime / 1000).toFixed(1)}s before next request...`);
        }
      }

      accountResults.push({
        accountName: profile.accountName,
        results: claimResults,
        overallStatus: this.computeOverallAccountStatus(claimResults),
      });
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    return this.buildSummary(accountResults, startTime, endTime, durationMs);
  }

  private getEnabledGames(profile: AccountProfile): GameKey[] {
    const allKeys = Object.keys(GAMES) as GameKey[];
    return allKeys.filter((key) => {
      if (profile.games && profile.games[key] !== undefined) {
        return profile.games[key] === true;
      }
      return profile[key] === true;
    });
  }

  private computeOverallAccountStatus(results: ClaimResult[]): AccountClaimResult['overallStatus'] {
    if (results.length === 0) return 'SUCCESS';

    const hasFailure = results.some((r) => r.status !== 'SUCCESS' && r.status !== 'ALREADY_CLAIMED');
    const hasSuccess = results.some((r) => r.status === 'SUCCESS');
    const allAlreadyClaimed = results.every((r) => r.status === 'ALREADY_CLAIMED');

    if (allAlreadyClaimed) return 'ALREADY_CLAIMED';
    if (!hasFailure) return 'SUCCESS';
    if (hasSuccess) return 'PARTIAL_SUCCESS';
    return 'FAILED';
  }

  private buildSummary(
    accounts: AccountClaimResult[],
    startTime: Date,
    endTime: Date,
    durationMs: number
  ): ClaimSummary {
    let totalGames = 0;
    let successCount = 0;
    let alreadyClaimedCount = 0;
    let failedCount = 0;
    let captchaCount = 0;

    for (const acc of accounts) {
      for (const res of acc.results) {
        totalGames++;
        if (res.status === 'SUCCESS') {
          successCount++;
        } else if (res.status === 'ALREADY_CLAIMED') {
          alreadyClaimedCount++;
        } else if (res.status === 'CAPTCHA_TRIGGERED') {
          captchaCount++;
          failedCount++;
        } else {
          failedCount++;
        }
      }
    }

    return {
      totalAccounts: accounts.length,
      totalGames,
      successCount,
      alreadyClaimedCount,
      failedCount,
      captchaCount,
      durationMs,
      accounts,
      startTime,
      endTime,
    };
  }
}
