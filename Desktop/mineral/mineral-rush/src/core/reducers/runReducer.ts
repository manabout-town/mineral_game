/**
 * RunReducer — 런 라이프사이클 + 채굴 + 콤보 + 광맥 처리.
 *
 * 5계명 §1 Pure Logic First — 외부 의존성 없음. 모든 RNG는 state.rngState를 통해 결정론.
 * 5계명 §3 No Hidden State — 모든 변경은 새 객체 반환.
 */

import type { GameState, RunState, RunModifiers, VeinState, GameEvent } from '../State.ts';
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
import { computeMetaModifiers } from '../rules/skillTree.ts';

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
  const pool = buildMineralPool(content, depth);
  // Timber Rush: dangerSide 결정 (50/50, null 없음 — 항상 한 쪽이 막힘)
  const dangerSide: 'left' | 'right' = rng.next() < 0.5 ? 'left' : 'right';
  return {
    vein: { veinIndex, hp, maxHp: hp, mineralPool: pool, dangerSide },
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
  // 메타 진행도(skillTree) 효과를 baseline 모디파이어로 적용. 카드는 이 위에 누적.
  const baselineModifiers = computeMetaModifiers(state);

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
    modifiers: baselineModifiers,
    cardOffer: null,
    combo: 0,
    comboExpiresAt: null,
    playerSide: 'right',   // Timber Rush: 시작 시 오른쪽에 위치
    exp: 0,
    expThreshold: 20,
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
  const rewardCrystals = state.run.veinsDestroyed * 5;
  const finished: NonNullable<RunState['finished']> = {
    endedAt: action.payload.now,
    reason: action.payload.reason,
    oresCollected: { ...state.run.oresCollected },
    veinsDestroyed: state.run.veinsDestroyed,
    cardsPicked: state.run.cards.length,
    rewardOres: rewardOres as Record<never, number>,
    rewardCrystals,
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
  const { side } = action.payload;
  const e = elapsed(run);

  // ── Timber Rush 핵심 판정 ─────────────────────────────────────
  // 플레이어가 탭한 방향 = dangerSide → MISS (콤보 리셋, 데미지 없음)
  const isMiss = run.vein.dangerSide !== null && side === run.vein.dangerSide;

  // 플레이어 위치 업데이트 (미스든 성공이든 해당 쪽으로 이동)
  run = { ...run, playerSide: side };

  if (isMiss) {
    // MISS: 콤보 끊김. 이벤트 기록 후 dangerSide 교체
    run = appendRunEvent({ ...run, combo: 0, comboExpiresAt: null }, {
      type: 'mine_hit',
      t: e,
      x: action.payload.x,
      y: action.payload.y,
      damage: 0,
      combo: 0,
      side,
      miss: true,
    });
    // 미스 후 새 dangerSide 생성 (RNG)
    const rngMiss = new Mulberry32(run.rngState);
    const newDanger: 'left' | 'right' = rngMiss.next() < 0.5 ? 'left' : 'right';
    run = {
      ...run,
      rngState: rngMiss.getState(),
      vein: { ...run.vein, dangerSide: newDanger },
    };
    return { ...state, run };
  }

  // ── HIT: 정상 채굴 ───────────────────────────────────────────
  const stillInCombo = run.comboExpiresAt !== null && e < run.comboExpiresAt;
  const newCombo = stillInCombo ? run.combo + 1 : 1;
  const comboExpiresAt = (e + run.modifiers.comboWindowMs) as GameTimeMs;

  const dmg = computeDamage({ pickaxe: run.pickaxe, modifiers: run.modifiers, combo: newCombo });
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
    t: e,
    x: action.payload.x,
    y: action.payload.y,
    damage: dmg.final,
    combo: newCombo,
    side,
    miss: false,
  });

  // 광물 드랍 + RNG 기반 새 dangerSide 동시 결정 (결정론 유지)
  const rng = new Mulberry32(run.rngState);
  const drop = tryDrop(run.vein.mineralPool, content, rng, BASE_DROP_CHANCE, run.modifiers.dropRateMul);
  // 성공 타격마다 dangerSide 교체 (Timber Rush: 세그먼트 스크롤)
  const newDangerSide: 'left' | 'right' = rng.next() < 0.5 ? 'left' : 'right';
  run = {
    ...run,
    rngState: rng.getState(),
    vein: { ...run.vein, hp: newHp, dangerSide: newDangerSide },
  };

  if (drop) {
    const current = run.oresCollected[drop.mineralId] ?? 0;
    run = {
      ...run,
      oresCollected: { ...run.oresCollected, [drop.mineralId]: current + drop.amount },
    };
    run = appendRunEvent(run, {
      type: 'ore_collected',
      t: e,
      mineralId: drop.mineralId,
      amount: drop.amount,
    });
    const mineralDef = content.minerals.get(drop.mineralId);
    const expGain = mineralDef ? Math.max(1, Math.ceil(mineralDef.baseValue / 6)) : 1;
    run = { ...run, exp: run.exp + expGain };
  }

  // 광맥 파괴 처리
  if (newHp <= 0) {
    run = appendRunEvent(run, {
      type: 'vein_destroyed',
      t: e,
      veinIndex: run.vein.veinIndex,
    });
    const next = buildVein(run.stageId as string, run.depth, run.vein.veinIndex + 1, run.rngState);
    run = {
      ...run,
      vein: next.vein,
      rngState: next.rngState,
      veinsDestroyed: run.veinsDestroyed + 1,
      exp: run.exp + 5,
    };
  }

  // EXP 임계값 도달 → 카드 오퍼
  if (run.cardOffer === null && run.exp >= run.expThreshold) {
    const rng2 = new Mulberry32(run.rngState);
    const offer = rollCardOffer(content, rng2, {
      pickedCardIds: run.cards.map((c) => c.cardId),
      progress: progressFromVeinsDestroyed(run.veinsDestroyed),
      count: 3,
      rerollCost: 50 + run.cards.length * 20,
    });
    run = {
      ...run,
      rngState: rng2.getState(),
      exp: run.exp - run.expThreshold,
      expThreshold: run.expThreshold + 10,
      cardOffer: {
        generatedAt: e,
        cards: offer.cards.map((c) => ({ cardId: c.cardId, rarity: c.rarity })),
        rerollCost: offer.rerollCost,
      },
    };
    run = appendRunEvent(run, {
      type: 'card_offer_generated',
      t: e,
      cardIds: offer.cards.map((c) => c.cardId),
    });
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

  let run: RunState = {
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

  let run: RunState = {
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
