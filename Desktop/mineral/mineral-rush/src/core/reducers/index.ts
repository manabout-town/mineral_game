/**
 * rootReducer — 모든 Action을 라우팅하는 단일 진입점.
 *
 * 5계명 §1 Pure Logic First: 외부 의존성 없는 순수 함수.
 * 동일 (state, action) → 동일 다음 state. 서버 검증과 동일하게 동작해야 한다.
 */

import type { GameState } from '../State.ts';
import type { Action } from '../Actions.ts';
import { runReducer } from './runReducer.ts';

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

    // -- Phase 2~3 placeholders --
    case 'COMBO_BREAK':
    case 'CARD_OFFER_GENERATED':
    case 'CARD_PICKED':
    case 'META_RUN_REWARD':
    case 'SKILL_NODE_UNLOCK':
      // Phase 2에서 구현. 일단 no-op.
      return state;

    // -- Persistence --
    case 'STATE_HYDRATE':
      return action.payload.state;
    case 'SCHEMA_MIGRATE':
      // 마이그레이션 자체는 PersistenceSystem에서 수행. reducer는 metadata만 갱신.
      return { ...state, schemaVersion: action.payload.toVersion };

    default: {
      // 컴파일러가 모든 케이스를 처리했는지 검증
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
