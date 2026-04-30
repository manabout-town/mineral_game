/**
 * Economy Reducer — 메타 화폐 입출금.
 *
 * 5계명 §4 Validation Required — 음수 잔액 절대 허용 안 함.
 * Phase 4: 서버 권위로 재검증.
 */

import type { GameState } from '../State.ts';
import type { MetaRunRewardAction } from '../Actions.ts';
import { logger } from '../../systems/Logger.ts';
import { ERROR_CODES } from '../../shared/constants.ts';

export function applyRunReward(state: GameState, action: MetaRunRewardAction): GameState {
  // sanity: 모든 보상 값이 양수
  for (const [id, n] of Object.entries(action.payload.ores)) {
    if (n < 0) {
      logger.error(ERROR_CODES.NEGATIVE_BALANCE, 'Negative ore reward refused', {
        mineralId: id,
        amount: n,
      });
      return state;
    }
  }
  if (action.payload.crystals < 0) {
    logger.error(ERROR_CODES.NEGATIVE_BALANCE, 'Negative crystal reward refused');
    return state;
  }

  const newOres: Record<string, number> = { ...state.economy.ores };
  for (const [id, amount] of Object.entries(action.payload.ores)) {
    newOres[id] = (newOres[id] ?? 0) + amount;
  }

  return {
    ...state,
    economy: {
      ores: newOres as Record<never, number>,
      crystals: state.economy.crystals + action.payload.crystals,
    },
  };
}

export const economyReducer = { applyRunReward } as const;
