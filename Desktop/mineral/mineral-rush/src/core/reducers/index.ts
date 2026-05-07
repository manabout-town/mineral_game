/**
 * rootReducer — 모든 Action을 라우팅하는 단일 진입점.
 *
 * 5계명 §1 Pure Logic First: 외부 의존성 없는 순수 함수.
 * 동일 (state, action) → 동일 다음 state. 서버 검증과 동일하게 동작해야 한다.
 */

import type { GameState } from '../State.ts';
import type { Action } from '../Actions.ts';
import { runReducer } from './runReducer.ts';
import { economyReducer } from './economyReducer.ts';
import { metaReducer } from './metaReducer.ts';

export function rootReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    // -- Run lifecycle --
    case 'RUN_START':
      return runReducer.start(state, action);
    case 'RUN_TICK':
      return runReducer.tick(state, action);
    case 'RUN_END':
      return runReducer.end(state, action);

    // -- Mining --
    case 'MINE_HIT':
      return runReducer.mineHit(state, action);
    case 'ORE_COLLECTED':
      return runReducer.oreCollected(state, action);
    case 'COMBO_BREAK':
      return runReducer.comboBreak(state, action);
    case 'VEIN_DESTROYED':
      return runReducer.veinDestroyed(state, action);
    case 'DEPTH_ADVANCE':
      return runReducer.depthAdvance(state, action);

    // -- Cards --
    case 'CARD_OFFER_GENERATED':
      return runReducer.cardOfferGenerated(state, action);
    case 'CARD_PICKED':
      return runReducer.cardPicked(state, action);
    case 'CARD_REROLL':
      return runReducer.cardReroll(state, action);

    // -- Economy / Meta --
    case 'META_RUN_REWARD':
      return economyReducer.applyRunReward(state, action);
    case 'SKILL_NODE_UNLOCK':
      return metaReducer.unlockSkillNode(state, action);
    case 'SKILL_NODE_LEVEL_UP':
      return metaReducer.levelUpSkillNode(state, action);

    // -- Persistence --
    case 'STATE_HYDRATE':
      return action.payload.state;
    case 'SCHEMA_MIGRATE':
      return { ...state, schemaVersion: action.payload.toVersion };

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
