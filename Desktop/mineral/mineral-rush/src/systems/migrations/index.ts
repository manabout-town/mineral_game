/**
 * 마이그레이션 체인 — schemaVersion N → N+1 변환 함수 모음.
 *
 * the-migration-expert: 출시 후 데이터 손실 = 게임 사망.
 *   - 모든 변환은 idempotent (같은 입력 두 번 실행해도 동일 결과)
 *   - 변환은 순수 함수. 외부 I/O 금지.
 *   - 새 스키마 버전마다 단위 테스트 + 100건 실 유저 데이터 샘플 회귀 검증.
 *
 * 사용:
 *   import { migrationsByVersion } from './migrations';
 *   const fn = migrationsByVersion[currentVersion];
 *   if (fn) state = fn(state);
 *
 * 5계명 §1 Pure Logic First — 외부 의존성 없음.
 * 5계명 §3 No Hidden State — 새 객체 반환.
 */

import type { GameState } from '../../core/State.ts';
import { v1_to_v2 } from './v1_to_v2.ts';

/** 버전 N → N+1 변환 함수. 누락 키 = 마이그레이션 실패로 간주 */
export const migrationsByVersion: Readonly<Record<number, (s: GameState) => GameState>> = {
  1: v1_to_v2,
  // 2: v2_to_v3, // 추가 시 여기에 등록
};

export { v1_to_v2 };
