/**
 * Layer-cross 공통 타입.
 * UNIVERSAL_GAME_FRAMEWORK 5계명 §3 No Hidden State — 모든 상태는 명시적 타입.
 */

import type { ErrorCode } from './constants.ts';

/** Validation 결과. Action 검증 시 반환 */
export type ValidationResult = { valid: true } | { valid: false; code: ErrorCode; message?: string };

/** SeededRandom 인터페이스 — 결정론적 난수 (서버 검증과 동일 결과) */
export interface SeededRandom {
  next(): number; // [0, 1)
  nextInt(maxExclusive: number): number;
  pick<T>(arr: readonly T[]): T;
}

/** 게임플레이 시간(ms) — 런 시작 시각으로부터의 누적 */
export type GameTimeMs = number & { readonly __brand: 'GameTimeMs' };

/** 결정론적 RNG seed */
export type Seed = number;
