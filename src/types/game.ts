export type GameKey =
  | 'genshin'
  | 'honkai_star_rail'
  | 'honkai_3'
  | 'tears_of_themis'
  | 'zenless_zone_zero';

export interface GameDefinition {
  id: GameKey;
  code: string;
  name: string;
  shortName: string;
  actId: string;
  signUrl: string;
  infoUrl: string;
  homeUrl: string;
  headers?: Record<string, string>;
  iconUrl: string;
  colorHex: number; // For Discord embed colors
}
