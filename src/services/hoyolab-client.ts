import type { GameKey, GameDefinition } from '../types/game.ts';
import type {
  ClaimResult,
  ClaimStatus,
  CheckInInfo,
  HoYoLabApiResponse,
  HoYoLabHomeAward,
  HoYoLabHomeData,
  HoYoLabInfoData,
  HoYoLabSignData,
  RewardInfo,
} from '../types/hoyolab.ts';
import { GAMES, DEFAULT_HOYOLAB_HEADERS } from '../constants/games.ts';
import { requestJson, HttpError } from '../utils/http.ts';
import { logger } from '../utils/logger.ts';

export interface HoYoLabClientOptions {
  timeoutMs?: number;
  retryCount?: number;
  fetchRewardDetails?: boolean;
}

export class HoYoLabClient {
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly fetchRewardDetails: boolean;
  private rewardCache = new Map<GameKey, HoYoLabHomeAward[]>();

  constructor(token: string, options: HoYoLabClientOptions = {}) {
    this.token = token;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.retryCount = options.retryCount ?? 2;
    this.fetchRewardDetails = options.fetchRewardDetails ?? true;
  }

  private buildHeaders(gameDef: GameDefinition): Record<string, string> {
    return {
      ...DEFAULT_HOYOLAB_HEADERS,
      ...(gameDef.headers ?? {}),
      Cookie: this.token,
    };
  }

  /**
   * Perform daily sign-in claim for a specific game.
   */
  public async claimGame(gameKey: GameKey): Promise<ClaimResult> {
    const gameDef = GAMES[gameKey];
    if (!gameDef) {
      return {
        gameKey,
        gameName: gameKey,
        status: 'UNKNOWN_ERROR',
        message: `Unknown game key: ${gameKey}`,
        retcode: -1,
        timestamp: new Date(),
      };
    }

    const headers = this.buildHeaders(gameDef);
    const body = { act_id: gameDef.actId };

    try {
      const response = await requestJson<HoYoLabApiResponse<HoYoLabSignData>>(gameDef.signUrl, {
        method: 'POST',
        headers,
        body,
        timeoutMs: this.timeoutMs,
        retries: this.retryCount,
      });

      return await this.parseSignResponse(gameDef, response);
    } catch (error: unknown) {
      logger.error(`Network/HTTP error claiming ${gameDef.name}:`, error);
      const message = error instanceof HttpError ? error.message : error instanceof Error ? error.message : String(error);

      return {
        gameKey,
        gameName: gameDef.name,
        status: 'NETWORK_ERROR',
        message: `Request failed: ${message}`,
        retcode: error instanceof HttpError ? error.status ?? -1 : -1,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Query check-in status (total signed in days, is_sign today).
   */
  public async getInfo(gameKey: GameKey): Promise<CheckInInfo | null> {
    const gameDef = GAMES[gameKey];
    if (!gameDef) return null;

    try {
      const headers = this.buildHeaders(gameDef);
      const response = await requestJson<HoYoLabApiResponse<HoYoLabInfoData>>(gameDef.infoUrl, {
        method: 'GET',
        headers,
        timeoutMs: this.timeoutMs,
        retries: 1,
      });

      if (response.retcode === 0 && response.data) {
        return {
          totalSignDays: response.data.total_sign_day,
          isSignToday: response.data.is_sign,
          isSub: response.data.is_sub,
          today: response.data.today,
        };
      }
      return null;
    } catch (err) {
      logger.debug(`Failed to fetch info for ${gameDef.name}:`, err);
      return null;
    }
  }

  /**
   * Fetch the monthly rewards calendar for a game.
   */
  public async getHomeRewards(gameKey: GameKey): Promise<HoYoLabHomeAward[] | null> {
    if (this.rewardCache.has(gameKey)) {
      return this.rewardCache.get(gameKey)!;
    }

    const gameDef = GAMES[gameKey];
    if (!gameDef) return null;

    try {
      const headers = this.buildHeaders(gameDef);
      const response = await requestJson<HoYoLabApiResponse<HoYoLabHomeData>>(gameDef.homeUrl, {
        method: 'GET',
        headers,
        timeoutMs: this.timeoutMs,
        retries: 1,
      });

      if (response.retcode === 0 && response.data?.awards) {
        this.rewardCache.set(gameKey, response.data.awards);
        return response.data.awards;
      }
      return null;
    } catch (err) {
      logger.debug(`Failed to fetch monthly awards for ${gameDef.name}:`, err);
      return null;
    }
  }

  /**
   * Look up today's reward details and streak count.
   */
  public async getTodayReward(
    gameKey: GameKey,
    signDaysOverride?: number
  ): Promise<{ reward?: RewardInfo; signDays?: number }> {
    try {
      let signDays = signDaysOverride;
      if (signDays === undefined) {
        const info = await this.getInfo(gameKey);
        if (info) {
          signDays = info.totalSignDays;
        }
      }

      if (signDays === undefined || signDays <= 0) {
        return { signDays };
      }

      const awards = await this.getHomeRewards(gameKey);
      if (awards && awards.length > 0) {
        // Awards array is 0-indexed (day 1 is index 0)
        const awardIndex = Math.min(signDays - 1, awards.length - 1);
        const award = awards[awardIndex];
        if (award) {
          return {
            signDays,
            reward: {
              name: award.name,
              icon: award.icon,
              count: award.cnt,
            },
          };
        }
      }

      return { signDays };
    } catch (err) {
      logger.debug(`Failed to resolve today's reward for ${gameKey}:`, err);
      return {};
    }
  }

  private async parseSignResponse(
    gameDef: GameDefinition,
    response: HoYoLabApiResponse<HoYoLabSignData>
  ): Promise<ClaimResult> {
    const { retcode, message, data } = response;
    const isCaptchaRisk = data?.gt_result?.is_risk === true || retcode === 1034;

    let status: ClaimStatus = 'UNKNOWN_ERROR';
    let statusMessage = message || 'Unknown response';
    let rewardInfo: RewardInfo | undefined;
    let signDays: number | undefined;

    if (isCaptchaRisk) {
      status = 'CAPTCHA_TRIGGERED';
      statusMessage = 'Auto check-in blocked by Geetest CAPTCHA / Risk verification';
    } else if (retcode === 0) {
      status = 'SUCCESS';
      statusMessage = 'Check-in successful';

      if (this.fetchRewardDetails) {
        const details = await this.getTodayReward(gameDef.id);
        rewardInfo = details.reward;
        signDays = details.signDays;
      }
    } else if (retcode === -5003) {
      status = 'ALREADY_CLAIMED';
      statusMessage = message || "You've already checked in today";

      if (this.fetchRewardDetails) {
        const details = await this.getTodayReward(gameDef.id);
        rewardInfo = details.reward;
        signDays = details.signDays;
      }
    } else if (retcode === -100 || retcode === 10001) {
      status = 'INVALID_TOKEN';
      statusMessage = 'HoYoLAB cookie/token has expired or is invalid. Please update your tokens.';
    } else if (retcode === -10002) {
      status = 'NO_CHARACTER';
      statusMessage = 'No game account / character found bound to this HoYoLAB profile.';
    } else {
      status = 'UNKNOWN_ERROR';
      statusMessage = `Check-in failed (${retcode}): ${message}`;
    }

    return {
      gameKey: gameDef.id,
      gameName: gameDef.name,
      status,
      message: statusMessage,
      retcode,
      reward: rewardInfo,
      signDays,
      timestamp: new Date(),
    };
  }
}
