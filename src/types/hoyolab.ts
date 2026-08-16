import type { GameKey } from './game.ts';

export type ClaimStatus =
  | 'SUCCESS'
  | 'ALREADY_CLAIMED'
  | 'CAPTCHA_TRIGGERED'
  | 'INVALID_TOKEN'
  | 'NO_CHARACTER'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface RewardInfo {
  name: string;
  icon: string;
  count: number;
}

export interface CheckInInfo {
  totalSignDays: number;
  isSignToday: boolean;
  isSub: boolean;
  today: string;
}

export interface HoYoLabApiResponse<T = unknown> {
  retcode: number;
  message: string;
  data?: T;
}

export interface HoYoLabSignData {
  code?: string;
  risk_code?: number;
  gt_result?: {
    is_risk?: boolean;
    gt?: string;
    challenge?: string;
    success?: number;
  };
}

export interface HoYoLabInfoData {
  total_sign_day: number;
  today: string;
  is_sign: boolean;
  is_sub: boolean;
  region: string;
}

export interface HoYoLabHomeAward {
  icon: string;
  name: string;
  cnt: number;
}

export interface HoYoLabHomeData {
  month: number;
  awards: HoYoLabHomeAward[];
  resign: boolean;
}

export interface ClaimResult {
  gameKey: GameKey;
  gameName: string;
  status: ClaimStatus;
  message: string;
  retcode: number;
  reward?: RewardInfo;
  signDays?: number;
  timestamp: Date;
}

export interface AccountClaimResult {
  accountName: string;
  results: ClaimResult[];
  overallStatus: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'ALREADY_CLAIMED' | 'FAILED';
}

export interface ClaimSummary {
  totalAccounts: number;
  totalGames: number;
  successCount: number;
  alreadyClaimedCount: number;
  failedCount: number;
  captchaCount: number;
  durationMs: number;
  accounts: AccountClaimResult[];
  startTime: Date;
  endTime: Date;
}
