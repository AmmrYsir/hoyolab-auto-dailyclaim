import type { ClaimSummary } from './hoyolab.ts';
import type { NotificationPolicy } from './config.ts';

export interface Notifier {
  readonly name: string;
  readonly isEnabled: boolean;
  readonly policy: NotificationPolicy;
  send(summary: ClaimSummary): Promise<void>;
}
