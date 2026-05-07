/**
 * Economy Reducer — 메타 화폐 입출금.
 *
 * 5계명 §1 Pure Logic First — 외부 의존성 없음. logger 호출 금지.
 *   ValidationSystem이 사전에 음수 보상 차단 + Game.dispatch에서 reject 로깅.
 *   여기서는 sanity check 후 무효 입력은 silent reject.
 * 5계명 §4 Validation Required — 음수 잔액 절대 허용 안 함.
 * Phase 4: 서버 권위로 재검증.
 */

import type { GameState } from '../State.ts';
import type { MetaRunRewardAction } from '../Actions.ts';

export function applyRunReward(state: GameState, action: MetaRunRewardAction): GameState {
  // sanity: 모든 보상 값이 양수 — 음수면 silent reject
  if (action.payload.crystals < 0) return state;
  for (const n of Object.values(action.payload.ores)) {
    if (n < 0) return state;
  }

  const newOres: Record<string, number> = { ...state.economy.ores };
  for (const [id, amount] of Object.entries(action.payload.ores)) {
    newOres[id] = (newOres[id] ?? 0) + amount;
  }

  // 메타 통계: 단일 런 최고 크리스탈 보상 갱신
  const bestRunValueCrystals = Math.max(
    state.meta.stats.bestRunValueCrystals ?? 0,
    action.payload.crystals,
  );

  return {
    ...state,
    economy: {
      ores: newOres as Record<never, number>,
      crystals: state.economy.crystals + action.payload.crystals,
    },
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        bestRunValueCrystals,
      },
    },
  };
}

export const economyReducer = { applyRunReward } as const;
