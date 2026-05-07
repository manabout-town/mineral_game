/**
 * Replay — 액션 리플레이 검증.
 *
 * the-security-auditor §1: 클라가 보낸 events를 서버(또는 검증 시스템)가
 * 동일 reducer로 재생 → 최종 화폐 결과를 비교. 불일치하면 어뷰저로 마킹.
 *
 * Phase 2에선 클라 사이드에서 회귀 테스트 용도로 먼저 사용.
 * Phase 4에서 Supabase Edge Function 안에서 동일 함수를 호출.
 *
 * 5계명 §1 Pure Logic First — 외부 의존성 없음.
 */

import type { GameState, RunState, GameEvent } from '../core/State.ts';
import type { Action } from '../core/Actions.ts';
import { rootReducer } from '../core/reducers/index.ts';
import { asGameTimeMs } from '../core/reducers/runReducer.ts';
import { ERROR_CODES } from '../shared/constants.ts';

export interface ReplayResult {
  ok: boolean;
  code?: string;
  /** 재생된 RunState (실패 시 null) */
  finalState?: RunState | null;
  /** 첫 번째 불일치 발생 이벤트 인덱스 */
  divergenceAt?: number;
  message?: string;
}

/**
 * 시작 GameState + events[] → RunState를 재생.
 *
 * events[]는 RunState.events에 들어있는 그대로 사용.
 * 클라가 보낸 events를 서버가 동일하게 reducer에 흘려 화폐 정산을 재계산하기 위함.
 */
export function replayRun(initialState: GameState, events: readonly GameEvent[]): ReplayResult {
  if (!initialState.run) {
    return { ok: false, code: ERROR_CODES.INVALID_ACTION, message: 'No run in initial state' };
  }

  let state = initialState;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    const action = eventToAction(ev);
    // null = 재생 불필요한 부수 효과 이벤트 (ore_collected, vein_destroyed 등) → 건너뜀.
    // 이 이벤트들은 mine_hit·depth_advance 등 실제 액션의 결과로 자동 생성된다.
    if (!action) continue;
    state = rootReducer(state, action);
    if (!state.run) {
      return { ok: false, code: ERROR_CODES.REPLAY_MISMATCH, divergenceAt: i, message: 'Run lost' };
    }
  }

  return { ok: true, finalState: state.run };
}

/**
 * GameEvent → Action 매핑.
 *
 * card_offer_generated / vein_destroyed 같이 reducer 내부에서 자동 발생하는 이벤트는
 * 매핑하지 않음 (재생할 필요 없음 — mine_hit이 흘러가면 자동으로 같은 결과 도출).
 */
function eventToAction(ev: GameEvent): Action | null {
  switch (ev.type) {
    case 'mine_hit':
      return {
        type: 'MINE_HIT',
        payload: { t: ev.t, x: ev.x, y: ev.y, side: ev.side },
      };
    case 'card_picked':
      return { type: 'CARD_PICKED', payload: { t: ev.t, cardId: ev.cardId } };
    case 'card_rerolled':
      return null; // 비용 관련 — 별도 처리 필요. Phase 4에서 구현.
    case 'depth_advance':
      return { type: 'DEPTH_ADVANCE', payload: { t: ev.t, newDepth: ev.newDepth } };
    case 'ore_collected':
    case 'vein_destroyed':
    case 'card_offer_generated':
    case 'combo_break':
      // mine_hit 또는 tick의 부수 효과로 자동 발생 → 매핑 안 함
      return null;
    default: {
      const _exhaustive: never = ev;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * 클라이언트 보고와 리플레이 결과를 비교.
 *
 * 광석 카운트 + 부순 광맥 수가 일치해야 함.
 */
export function compareReports(
  clientReport: RunState,
  replayed: RunState,
): { match: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (clientReport.veinsDestroyed !== replayed.veinsDestroyed) {
    reasons.push(
      `veinsDestroyed mismatch: client=${clientReport.veinsDestroyed}, server=${replayed.veinsDestroyed}`,
    );
  }
  for (const [id, n] of Object.entries(clientReport.oresCollected)) {
    const r = replayed.oresCollected[id as never] ?? 0;
    if (r !== n) reasons.push(`ore[${id}] mismatch: client=${n}, server=${r}`);
  }
  for (const [id, n] of Object.entries(replayed.oresCollected)) {
    if (!(id in clientReport.oresCollected)) {
      reasons.push(`ore[${id}] missing in client (server=${n})`);
    }
  }
  if (Math.abs(clientReport.damageDealt - replayed.damageDealt) > 1e-3) {
    reasons.push(
      `damageDealt mismatch: client=${clientReport.damageDealt}, server=${replayed.damageDealt}`,
    );
  }
  return { match: reasons.length === 0, reasons };
}

/** 결정론 단위 테스트 헬퍼: 동일 시드/액션 시퀀스 → 동일 RunState */
export function assertDeterministic(
  initialState: GameState,
  actions: readonly Action[],
): { same: boolean; runs: RunState[] } {
  const a = actions.reduce(rootReducer, initialState).run;
  const b = actions.reduce(rootReducer, initialState).run;
  if (!a || !b) return { same: false, runs: [] };
  return { same: JSON.stringify(a) === JSON.stringify(b), runs: [a, b] };
}

// elapsed 계산 헬퍼 (회귀 테스트 작성용)
export { asGameTimeMs };
