/**
 * RunReducer — 런 라이프사이클 관련 액션 처리.
 *
 * 5계명 §3 No Hidden State: 모든 변경은 새 객체 반환 (immutable).
 * 5계명 §2 Atomic: 하나의 Action은 한 가지 상태만 바꾼다.
 *
 * Phase 1 Skeleton: RUN_START / RUN_TICK / RUN_END / MINE_HIT 만 동작.
 * 광물 드랍 / 카드 / 콤보 등은 Phase 2에서 본격 구현.
 */

import type { GameState, RunState } from '../State.ts';
import type {
  RunStartAction,
  RunTickAction,
  RunEndAction,
  MineHitAction,
  OreCollectedAction,
} from '../Actions.ts';
import { asPickaxeId } from '../../shared/ids.ts';
import { MAX_REPLAY_EVENTS } from '../../shared/constants.ts';
import type { GameTimeMs } from '../../shared/types.ts';

// ============================================================
// Helpers
// ============================================================

function defaultPickaxe() {
  return {
    pickaxeId: asPickaxeId('basic_pickaxe'),
    damage: 10,
    speed: 4, // 초당 4타
    range: 50,
    comboBonus: 0.05,
  };
}

/** 이벤트 추가. MAX_REPLAY_EVENTS 초과 시 가장 오래된 것부터 폐기 (서버는 매 chunk 보내는 방식으로 대비) */
function appendRunEvent(run: RunState, event: RunState['events'][number]): RunState {
  const events =
    run.events.length >= MAX_REPLAY_EVENTS ? [...run.events.slice(1), event] : [...run.events, event];
  return { ...run, events };
}

// ============================================================
// Reducers
// ============================================================

export function start(state: GameState, action: RunStartAction): GameState {
  const { runId, seed, stageId, depth, durationMs } = action.payload;

  const run: RunState = {
    runId,
    seed,
    startedAt: action.payload.now,
    duration: durationMs,
    remaining: durationMs,
    depth,
    stageId,
    pickaxe: defaultPickaxe(),
    cards: [],
    cardOffer: null,
    combo: 0,
    comboTimerMs: null,
    oresCollected: {},
    damageDealt: 0,
    events: [],
  };

  return {
    ...state,
    run,
    updatedAt: action.payload.now,
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        totalRuns: state.meta.stats.totalRuns + 1,
      },
    },
  };
}

export function tick(state: GameState, action: RunTickAction): GameState {
  if (!state.run) return state;
  const remaining = Math.max(0, state.run.remaining - action.payload.deltaMs);
  return {
    ...state,
    run: { ...state.run, remaining },
  };
}

export function end(state: GameState, _action: RunEndAction): GameState {
  if (!state.run) return state;
  const playTimeMs = state.run.duration - state.run.remaining;
  return {
    ...state,
    run: null,
    meta: {
      ...state.meta,
      stats: {
        ...state.meta.stats,
        totalPlayTimeMs: state.meta.stats.totalPlayTimeMs + playTimeMs,
      },
    },
  };
}

export function mineHit(state: GameState, action: MineHitAction): GameState {
  if (!state.run) return state;
  const run = appendRunEvent(state.run, {
    type: 'mine_hit',
    t: action.payload.t,
    x: action.payload.x,
    y: action.payload.y,
  });
  // Phase 1: 데미지 누적만. 광물 드랍 결정은 Phase 2 dropTable에서.
  const damageDealt = run.damageDealt + run.pickaxe.damage;
  return {
    ...state,
    run: { ...run, damageDealt },
  };
}

export function oreCollected(state: GameState, action: OreCollectedAction): GameState {
  if (!state.run) return state;
  const { mineralId, amount, t } = action.payload;
  const currentInRun = state.run.oresCollected[mineralId] ?? 0;
  const run = appendRunEvent(state.run, { type: 'ore_collected', t, mineralId, amount });
  return {
    ...state,
    run: {
      ...run,
      oresCollected: { ...run.oresCollected, [mineralId]: currentInRun + amount },
    },
  };
}

// ============================================================
// 단일 export — 외부에서는 runReducer 객체로 참조
// ============================================================

export const runReducer = {
  start,
  tick,
  end,
  mineHit,
  oreCollected,
} as const;

// 게임플레이 시간 헬퍼 (브랜드 타입 캐스팅용)
export function asGameTimeMs(ms: number): GameTimeMs {
  return ms as GameTimeMs;
}
