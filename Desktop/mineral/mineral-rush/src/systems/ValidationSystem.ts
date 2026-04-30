/**
 * ValidationSystem — 5계명 §4 Validation Required.
 *
 * 모든 보상/이득 지급 전 검증을 거친다.
 * Phase 2: 클라이언트 sanity check. Phase 4에서 서버 측 통계 임계 + 리플레이 추가.
 *
 * 5계명 §1 Pure Logic First — 순수 함수.
 */

import type { GameState } from '../core/State.ts';
import type { Action } from '../core/Actions.ts';
import type { ValidationResult } from '../shared/types.ts';
import { ERROR_CODES } from '../shared/constants.ts';

/** 인간 한계: 30ms 안에 두 번 탭은 사실상 불가능 */
const MIN_HIT_INTERVAL_MS = 30;
/** 한 런에서 최대 탭 수 (30초 × 25 hps = 750 + 여유) */
const MAX_HITS_PER_RUN = 1500;

export function validateAction(state: GameState, action: Action): ValidationResult {
  switch (action.type) {
    case 'MINE_HIT': {
      if (!state.run) {
        return { valid: false, code: ERROR_CODES.INVALID_ACTION, message: 'No active run' };
      }
      if (state.run.finished) {
        return { valid: false, code: ERROR_CODES.INVALID_ACTION, message: 'Run already finished' };
      }
      // 직전 mine_hit과의 간격 검증
      const last = [...state.run.events].reverse().find((e) => e.type === 'mine_hit');
      if (last && action.payload.t - last.t < MIN_HIT_INTERVAL_MS) {
        return { valid: false, code: ERROR_CODES.HIT_TOO_FAST };
      }
      const hitCount = state.run.events.filter((e) => e.type === 'mine_hit').length;
      if (hitCount >= MAX_HITS_PER_RUN) {
        return { valid: false, code: ERROR_CODES.HIT_TOO_FAST, message: 'Hit cap reached' };
      }
      return { valid: true };
    }

    case 'CARD_PICKED': {
      if (!state.run?.cardOffer) {
        return { valid: false, code: ERROR_CODES.CARD_NOT_OFFERED };
      }
      const offered = state.run.cardOffer.cards.some((c) => c.cardId === action.payload.cardId);
      if (!offered) return { valid: false, code: ERROR_CODES.CARD_NOT_OFFERED };
      return { valid: true };
    }

    case 'CARD_REROLL': {
      if (!state.run?.cardOffer) return { valid: false, code: ERROR_CODES.CARD_NOT_OFFERED };
      if (state.economy.crystals < action.payload.cost) {
        return { valid: false, code: ERROR_CODES.NEGATIVE_BALANCE, message: 'Not enough crystals' };
      }
      return { valid: true };
    }

    case 'ORE_COLLECTED': {
      if (action.payload.amount <= 0) {
        return { valid: false, code: ERROR_CODES.NEGATIVE_BALANCE };
      }
      if (action.payload.amount > 100) {
        // 한 번에 100개 초과는 의심스러움 (Phase 4 통계 임계로 정교화)
        return { valid: false, code: ERROR_CODES.INVALID_ACTION, message: 'amount too large' };
      }
      return { valid: true };
    }

    case 'META_RUN_REWARD': {
      for (const n of Object.values(action.payload.ores)) {
        if (n < 0) return { valid: false, code: ERROR_CODES.NEGATIVE_BALANCE };
      }
      if (action.payload.crystals < 0) return { valid: false, code: ERROR_CODES.NEGATIVE_BALANCE };
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}
