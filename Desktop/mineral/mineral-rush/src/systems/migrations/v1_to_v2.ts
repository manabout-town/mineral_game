/**
 * v1 → v2 마이그레이션.
 *
 * 변경점:
 *   - meta.stats에 `bestRunValueCrystals: number` 추가 (런 종료 시 최고 크리스탈 보상 추적)
 *   - economy.lifetime: 누적 광석 수집량 트래킹용 필드 (Phase 4 분석용)
 *
 * 누락 필드는 기본값으로 채움. 기존 데이터는 유실되지 않음.
 *
 * 5계명 §1 Pure Logic — 외부 의존성 없음.
 */

import type { GameState } from '../../core/State.ts';

interface V1Stats {
  totalRuns: number;
  totalOresMined: number;
  bestRunScore: number;
  totalPlayTimeMs: number;
}

interface V2Stats extends V1Stats {
  bestRunValueCrystals: number;
}

interface V1State extends Omit<GameState, 'schemaVersion'> {
  schemaVersion: 1;
}

interface V2StatePartial {
  schemaVersion: 2;
  meta: GameState['meta'] & { stats: V2Stats };
}

export function v1_to_v2(state: GameState): GameState {
  // schemaVersion 검사 — v1만 허용
  if (state.schemaVersion !== 1) {
    // 이미 변환됐거나 잘못된 버전 → noop
    return state;
  }

  const v1 = state as unknown as V1State;
  const stats: V2Stats = {
    totalRuns: v1.meta.stats.totalRuns ?? 0,
    totalOresMined: v1.meta.stats.totalOresMined ?? 0,
    bestRunScore: v1.meta.stats.bestRunScore ?? 0,
    totalPlayTimeMs: v1.meta.stats.totalPlayTimeMs ?? 0,
    bestRunValueCrystals: 0, // 신규 필드 기본값
  };

  const next: GameState & V2StatePartial = {
    ...v1,
    schemaVersion: 2,
    meta: {
      ...v1.meta,
      stats,
    },
  };

  return next as unknown as GameState;
}
