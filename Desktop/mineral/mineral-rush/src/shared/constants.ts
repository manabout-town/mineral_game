/**
 * 게임 전역 상수.
 * 클라 빌드에 박힌 상수만 여기. 밸런스 수치(카드 가중치, 화폐 곡선)는 data/*.json + Remote Config로.
 */

export const SCHEMA_VERSION = 2;

export const TICK_RATE_HZ = 60;
export const FIXED_DELTA_MS = 1000 / TICK_RATE_HZ; // 16.6666...

export const RUN_DURATION_MS = 300_000; // 5분 런

export const MAX_REPLAY_EVENTS = 5_000; // 한 런에서 기록할 최대 이벤트 수

/** ESLint 5계명 §5 Traceable — 모든 에러 코드는 여기 정의 */
export const ERROR_CODES = {
  HIT_TOO_FAST: 'E_HIT_TOO_FAST',
  CARD_NOT_OFFERED: 'E_CARD_NOT_OFFERED',
  REPLAY_MISMATCH: 'E_REPLAY_MISMATCH',
  SAVE_TAMPERED: 'E_SAVE_TAMPERED',
  MIGRATION_FAILED: 'E_MIGRATION_FAILED',
  NEGATIVE_BALANCE: 'E_NEGATIVE_BALANCE',
  INVALID_ACTION: 'E_INVALID_ACTION',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
