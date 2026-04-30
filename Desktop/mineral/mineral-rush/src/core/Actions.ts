/**
 * Mineral Rush — Core Actions
 *
 * UNIVERSAL_GAME_FRAMEWORK §1.1 Core State:
 *   - 데이터 변경은 반드시 Action을 발행 → Reducer를 거친다.
 *   - 5계명 §2 Atomic Actions: 하나의 Action은 하나의 상태만 바꾼다.
 *
 * Phase 1: 최소 7종. Phase 2~3에서 카드/메타/마이그레이션 등 확장.
 */

import type { GameState, GameEvent } from './State.ts';
import type { MineralId, CardId, SkillNodeId, RunId, StageId } from '../shared/ids.ts';
import type { Seed, GameTimeMs } from '../shared/types.ts';

// ============================================================
// Action 유니온
// ============================================================

export type Action =
  // -- Run lifecycle --
  | RunStartAction
  | RunTickAction
  | RunEndAction
  // -- Mining --
  | MineHitAction
  | OreCollectedAction
  | ComboBreakAction
  | VeinDestroyedAction
  | DepthAdvanceAction
  // -- Cards (Phase 2 본격 사용) --
  | CardOfferGeneratedAction
  | CardPickedAction
  | CardRerollAction
  // -- Meta (Phase 2~3) --
  | MetaRunRewardAction
  | SkillNodeUnlockAction
  // -- Persistence / System --
  | StateHydrateAction
  | SchemaMigrateAction;

// ============================================================
// Action 정의
// ============================================================

export interface RunStartAction {
  type: 'RUN_START';
  payload: {
    runId: RunId;
    seed: Seed;
    stageId: StageId;
    depth: number;
    durationMs: number;
    now: number; // epoch ms — 결정론을 위해 외부 주입
  };
}

export interface RunTickAction {
  type: 'RUN_TICK';
  payload: { deltaMs: number };
}

export interface RunEndAction {
  type: 'RUN_END';
  payload: { reason: 'timeout' | 'quit' | 'death'; now: number };
}

export interface MineHitAction {
  type: 'MINE_HIT';
  payload: { t: GameTimeMs; x: number; y: number };
}

export interface OreCollectedAction {
  type: 'ORE_COLLECTED';
  payload: { t: GameTimeMs; mineralId: MineralId; amount: number };
}

export interface ComboBreakAction {
  type: 'COMBO_BREAK';
  payload: { t: GameTimeMs };
}

export interface VeinDestroyedAction {
  type: 'VEIN_DESTROYED';
  payload: { t: GameTimeMs };
}

export interface DepthAdvanceAction {
  type: 'DEPTH_ADVANCE';
  payload: { t: GameTimeMs; newDepth: number };
}

export interface CardOfferGeneratedAction {
  type: 'CARD_OFFER_GENERATED';
  payload: { t: GameTimeMs; cardIds: CardId[]; rerollCost: number };
}

export interface CardPickedAction {
  type: 'CARD_PICKED';
  payload: { t: GameTimeMs; cardId: CardId };
}

export interface CardRerollAction {
  type: 'CARD_REROLL';
  payload: { t: GameTimeMs; cost: number };
}

export interface MetaRunRewardAction {
  type: 'META_RUN_REWARD';
  payload: { ores: Record<MineralId, number>; crystals: number };
}

export interface SkillNodeUnlockAction {
  type: 'SKILL_NODE_UNLOCK';
  payload: { nodeId: SkillNodeId };
}

export interface StateHydrateAction {
  type: 'STATE_HYDRATE';
  payload: { state: GameState };
}

export interface SchemaMigrateAction {
  type: 'SCHEMA_MIGRATE';
  payload: { fromVersion: number; toVersion: number };
}

// ============================================================
// Helpers
// ============================================================

export function appendEvent(state: GameState, event: GameEvent): GameState {
  if (!state.run) return state;
  // 5계명 §3 No Hidden State — 새 객체 반환
  return {
    ...state,
    run: {
      ...state.run,
      events: [...state.run.events, event],
    },
  };
}

/** Action 타입만 추출 (디버그/로그용) */
export type ActionType = Action['type'];
