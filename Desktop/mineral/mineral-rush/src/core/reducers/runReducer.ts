/**
 * RunReducer — 런 라이프사이클 + 채굴 + 콤보 + 광맥 처리.
 *
 * 5계명 §1 Pure Logic First — 외부 의존성 없음. 모든 RNG는 state.rngState를 통해 결정론.
 * 5계명 §3 No Hidden State — 모든 변경은 새 객체 반환.
 */

import type { GameState, RunState, RunModifiers, VeinState, GameEvent } from '../State.ts';
import { DEFAULT_RUN_MODIFIERS } from '../State.ts';
import type {
  RunStartAction,
  RunTickAction,
  RunEndAction,
  MineHitAction,
  OreCollectedAction,
  ComboBreakAction,
  VeinDestroyedAction,
  DepthAdvanceAction,
  CardOfferGeneratedAction,
  CardPickedAction,
  CardRerollAction,
} from '../Actions.ts';
import { asPickaxeId } from '../../shared/ids.ts';
import { MAX_REPLAY_EVENTS, FIXED_DELTA_MS } from '../../shared/constants.ts';
import type { GameTimeMs } from '../../shared/types.ts';
import { Mulberry32 } from '../../shared/SeededRandom.ts';
import { content } from '../content/index.ts';
import { computeDamage } from '../rules/damage.ts';
import { computeVeinHp } from '../rules/veinHp.ts';
import { tryDrop, buildMineralPool, BASE_DROP_CHANCE } from '../rules/dropTable.ts';
import {
  rollCardOffer,
  applyCardEffect,
  progressFromVeinsDestroyed,
} from '../rules/cardOffer.ts';

// ============================================================
// Helpers
// ============================================================

function defaultPickaxe() {
  const def = content.pickaxes.get(asPickaxeId('basic_pickaxe'));
  if (def) {
    return {
      pickaxeId: def.id,
      damage: def.damage,
      speed: def.speed,
      range: def.range,
      comboBonus: def.comboBonus,
    };
  }
  return {
    pickaxeId: asPickaxeId('basic_pickaxe'),
    damage: 10,
    speed: 4,
    range: 50,
    comboBonus: 0.05,
  };
}

function appendRunEvent(run: RunState, event: GameEvent): RunState {
  const events =
    run.events.length >= MAX_REPLAY_EVENTS ? [...run.events.slice(1), event] : [...run.events, event];
  return { ...run, events };
}

function buildVein(stageId: string, depth: number, veinIndex: number, rngState: number): {
  vein: VeinState;
  rngState: number;
} {
  const stage = content.stages.get(stageId as never);
  if (!stage) throw new Error(`Unknown stage: ${stageId}`);
  const hp = computeVeinHp(stage, depth, veinIndex);
  const rng = new Mulberry32(rngState);
  // mineralPool은 광맥 시작 시 결정 — 같은 광맥 안에선 동일 분포
  const pool = buildMineralPool(content, depth);
  // RNG state 진행 (mineralPool 결정 시 RNG 호출 안 했지만, 깊이 변경 시 RNG가 한 칸 먹게 해서
  // 광맥마다 미세한 다양성을 가짐 — 결정론은 유지)
  rng.next();
  return {
    vein: { veinIndex, hp, maxHp: hp, mineralPool: pool },
    rngState: rng.getState(),
  };
}

function elapsed(run: RunState): GameTimeMs {
  return (run.duration - run.remaining) as GameTimeMs;
}

// ============================================================
// Reducers
// ============================================================

export function start(state: GameState, action: RunStartAction): GameState {
  const { runId, seed, stageId, depth, durationMs } = action.payload;

  const { vein, rngState } = buildVein(stageId as string, depth, 0, seed);

  const run: RunState = {
    runId,
    seed,
    rngState,
    startedAt: action.payload.now,
    duration: durationMs,
    remaining: durationMs,
    depth,
    stageId,
    pickaxe: defaultPickaxe(),
    vein,
    veinsDestroyed: 0,
    cards: [],
    modifiers: { ...DEFAULT_RUN_MODIFIERS },
    cardOffer: null,
    combo: 0,
    comboExpiresAt: null,
    oresCollected: {},
    damageDealt: 0,
    events: [],
    finished: null,
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
  let run: RunState = { ...state.run, remaining };

  // 콤보 만료 체크 — 결정론을 위해 게임시간 기준
  if (run.comboExpiresAt !== null) {
    const e = elapsed(run);
    if (e >= run.comboExpiresAt) {
      run = appendRunEvent({ ...run, combo: 0, comboExpiresAt: null }, {
        type: 'combo_break',
        t: e,
      });
    }
  }
  return { ...state, run };
}

export function end(state: GameState, action: RunEndAction): GameState {
  if (!state.run) return state;
  const playTimeMs = state.run.duration - state.run.remaining;
  // 보상 환산 (oreValueMul 적용)
  const rewardOres: Record<string, number> = {};
  for (const [id, count] of Object.entries(state.run.oresCollected)) {
    rewardOres[id] = Math.round(count * state.run.modifiers.oreValueMul);
  }
  const finished: NonNullable<RunState['finished']> = {
    endedAt: action.payload.now,
    reason: action.payload.reason,
    oresCollected: { ...state.run.oresCollected },
    veinsDestroyed: state.run.veinsDestroyed,
    cardsPicked: state.run.cards.length,
    rewardOres: rewardOres as Record<never, number>,
  };
  return {
    ...state,
    // run을 즉시 null로 만들지 않음 — 결과 화면 표시 후 dismiss 시 null로
    run: { ...state.run, finished },
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
  if (!state.run || state.run.finished) return state;
  let run = state.run;

  // 콤보 갱신 — 콤보 만료 전에 새 타격이면 +1
  const e = elapsed(run);
  const stillInCombo = run.comboExpiresAt !== null && e < run.comboExpiresAt;
  const newCombo = stillInCombo ? run.combo + 1 : 1;
  const comboExpiresAt = (e + run.modifiers.comboWindowMs) as GameTimeMs;

  // 데미지 계산
  const dmg = computeDamage({
    pickaxe: run.pickaxe,
    modifiers: run.modifiers,
    combo: newCombo,
  });

  // 광맥 HP 감소
  const newHp = Math.max(0, run.vein.hp - dmg.final);

  run = {
    ...run,
    combo: newCombo,
    comboExpiresAt,
    damageDealt: run.damageDealt + dmg.final,
    vein: { ...run.vein, hp: newHp },
  };

  run = appendRunEvent(run, {
    type: 'mine_hit',
    t: action.payload.t,
    x: action.payload.x,
    y: action.payload.y,
    damage: dmg.final,
    combo: newCombo,
  });

  // 광물 드랍 시도 (RNG 사용)
  const rng = new Mulberry32(run.rngState);
  const drop = tryDrop(
    run.vein.mineralPool,
    content,
    rng,
    BASE_DROP_CHANCE,
    run.modifiers.dropRateMul,
  );
  run = { ...run, rngState: rng.getState() };

  if (drop) {
    const current = run.oresCollected[drop.mineralId] ?? 0;
    run = {
      ...run,
      oresCollected: { ...run.oresCollected, [drop.mineralId]: current + drop.amount },
    };
    run = appendRunEvent(run, {
      type: 'ore_collected',
      t: action.payload.t,
      mineralId: drop.mineralId,
      amount: drop.amount,
    });
  }

  // 광맥 파괴 처리
  if (newHp <= 0) {
    run = appendRunEvent(run, {
      type: 'vein_destroyed',
      t: action.payload.t,
      veinIndex: run.vein.veinIndex,
    });

    const next = buildVein(run.stageId as string, run.depth, run.vein.veinIndex + 1, run.rngState);
    const veinsDestroyed = run.veinsDestroyed + 1;
    run = {
      ...run,
      vein: next.vein,
      rngState: next.rngState,
      veinsDestroyed,
    };

    // 광맥 부술 때마다 카드 오퍼 생성 (Phase 2: 매번)
    if (run.cardOffer === null) {
      const rng2 = new Mulberry32(run.rngState);
      const offer = rollCardOffer(content, rng2, {
        pickedCardIds: run.cards.map((c) => c.cardId),
        progress: progressFromVeinsDestroyed(veinsDestroyed),
        count: 3,
        rerollCost: 50 + veinsDestroyed * 20,
      });
      run = {
        ...run,
        rngState: rng2.getState(),
        cardOffer: {
          generatedAt: action.payload.t,
          cards: offer.cards.map((c) => ({ cardId: c.cardId, rarity: c.rarity })),
          rerollCost: offer.rerollCost,
        },
      };
      run = appendRunEvent(run, {
        type: 'card_offer_generated',
        t: action.payload.t,
        cardIds: offer.cards.map((c) => c.cardId),
      });
    }
  }

  return { ...state, run };
}

export function oreCollected(state: GameState, action: OreCollectedAction): GameState {
  // mineHit이 dropTable로 ORE_COLLECTED를 직접 발행하지 않고 상태를 바꾸므로,
  // 이 reducer는 외부 시스템(예: 보너스 광물, 보상 영상 광고)에서 강제 ORE_COLLECTED를 보낼 때 사용.
  if (!state.run) return state;
  const { mineralId, amount, t } = action.payload;
  const current = state.run.oresCollected[mineralId] ?? 0;
  const run = appendRunEvent(state.run, { type: 'ore_collected', t, mineralId, amount });
  return {
    ...state,
    run: {
      ...run,
      oresCollected: { ...run.oresCollected, [mineralId]: current + amount },
    },
  };
}

export function comboBreak(state: GameState, action: ComboBreakAction): GameState {
  if (!state.run) return state;
  const run = appendRunEvent(
    { ...state.run, combo: 0, comboExpiresAt: null },
    { type: 'combo_break', t: action.payload.t },
  );
  return { ...state, run };
}

export function veinDestroyed(state: GameState, _action: VeinDestroyedAction): GameState {
  // mineHit 안에서 처리되므로 이 reducer는 명시적 외부 트리거용 (디버그 등)
  return state;
}

export function depthAdvance(state: GameState, action: DepthAdvanceAction): GameState {
  if (!state.run) return state;
  const next = buildVein(
    state.run.stageId as string,
    action.payload.newDepth,
    0,
    state.run.rngState,
  );
  const run = appendRunEvent(
    {
      ...state.run,
      depth: action.payload.newDepth,
      vein: next.vein,
      rngState: next.rngState,
    },
    { type: 'depth_advance', t: action.payload.t, newDepth: action.payload.newDepth },
  );
  return { ...state, run };
}

export function cardOfferGenerated(state: GameState, action: CardOfferGeneratedAction): GameState {
  // 외부 트리거용. 일반적으로는 mineHit 안에서 자동 생성됨.
  if (!state.run) return state;
  // payload.cardIds로부터 rarity를 content에서 조회
  const cards = action.payload.cardIds
    .map((id) => {
      const def = content.cards.get(id);
      return def ? { cardId: id, rarity: def.rarity } : null;
    })
    .filter((x): x is { cardId: typeof action.payload.cardIds[number]; rarity: 'common' | 'rare' | 'epic' | 'legendary' } => x !== null);
  return {
    ...state,
    run: {
      ...state.run,
      cardOffer: {
        generatedAt: action.payload.t,
        cards,
        rerollCost: action.payload.rerollCost,
      },
    },
  };
}

export function cardPicked(state: GameState, action: CardPickedAction): GameState {
  if (!state.run || !state.run.cardOffer) return state;
  const def = content.cards.get(action.payload.cardId);
  if (!def) return state;

  const newModifiers: RunModifiers = applyCardEffect(
    state.run.modifiers,
    def.effect,
    def.magnitude,
  );

  let run = {
    ...state.run,
    modifiers: newModifiers,
    cards: [...state.run.cards, { cardId: def.id, pickedAt: action.payload.t }],
    cardOffer: null,
  };
  run = appendRunEvent(run, { type: 'card_picked', t: action.payload.t, cardId: def.id });
  return { ...state, run };
}

export function cardReroll(state: GameState, action: CardRerollAction): GameState {
  if (!state.run || !state.run.cardOffer) return state;
  // 비용 차감 (메타 화폐) — 실패 시 무시
  const cost = action.payload.cost;
  if (state.economy.crystals < cost) return state;
  const economy = { ...state.economy, crystals: state.economy.crystals - cost };

  // 새 오퍼 추첨
  const rng = new Mulberry32(state.run.rngState);
  const offer = rollCardOffer(content, rng, {
    pickedCardIds: state.run.cards.map((c) => c.cardId),
    progress: progressFromVeinsDestroyed(state.run.veinsDestroyed),
    count: 3,
    rerollCost: Math.round(state.run.cardOffer.rerollCost * 1.5),
  });

  let run = {
    ...state.run,
    rngState: rng.getState(),
    cardOffer: {
      generatedAt: action.payload.t,
      cards: offer.cards.map((c) => ({ cardId: c.cardId, rarity: c.rarity })),
      rerollCost: offer.rerollCost,
    },
  };
  run = appendRunEvent(run, { type: 'card_rerolled', t: action.payload.t });
  return { ...state, run, economy };
}

// ============================================================
// 단일 export
// ============================================================

export const runReducer = {
  start,
  tick,
  end,
  mineHit,
  oreCollected,
  comboBreak,
  veinDestroyed,
  depthAdvance,
  cardOfferGenerated,
  cardPicked,
  cardReroll,
} as const;

export function asGameTimeMs(ms: number): GameTimeMs {
  return ms as GameTimeMs;
}

export const TICK_DELTA_MS = FIXED_DELTA_MS;
