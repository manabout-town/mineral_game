/**
 * skillTree — 스킬 트리 노드 정의 + 비용 곡선 + 효과 누적.
 *
 * 5계명 §1 Pure Logic: 외부 의존성 없음. data/skill_nodes.json만 참조.
 *
 * 효과 누적:
 *   skillTree에 잠금 해제된 모든 노드를 순회하며 RunModifiers를 출력.
 *   런 시작 시 이 함수를 호출해 RunState.modifiers의 baseline을 설정.
 *   카드 효과는 그 위에 추가로 누적된다.
 */

import type { GameState, RunModifiers } from '../State.ts';
import { DEFAULT_RUN_MODIFIERS } from '../State.ts';
import type { SkillNodeId } from '../../shared/ids.ts';
import { asSkillNodeId } from '../../shared/ids.ts';
import skillNodesJson from '../../../data/skill_nodes.json';

export type SkillNodeBranch =
  | 'pickaxe'
  | 'ore_value'
  | 'combo'
  | 'drop'
  | 'crystal'
  | 'meta';

/** 효과 종류 — Phase 4에서 광물별 가중치 등으로 확장 가능 */
export type SkillNodeEffect =
  | { kind: 'damage_mul'; magnitudePerLevel: number } // 광맥 데미지 곱연산 누적
  | { kind: 'combo_window_ms'; magnitudePerLevel: number } // 콤보 유지 시간(ms) 누적
  | { kind: 'ore_value_mul'; magnitudePerLevel: number } // 광석 가치 곱연산 누적
  | { kind: 'drop_rate_mul'; magnitudePerLevel: number } // 드랍률 곱연산 누적
  | { kind: 'combo_max_bonus'; magnitudePerLevel: number } // 콤보 1당 추가 데미지 비율
  | { kind: 'crystal_run_bonus'; magnitudePerLevel: number } // 런 종료 시 크리스탈 보너스 +x
  | { kind: 'starting_combo_window_ms'; magnitudePerLevel: number };

export interface SkillNodeDef {
  id: SkillNodeId;
  name: { ko: string; en: string };
  description: { ko: string; en: string };
  branch: SkillNodeBranch;
  /** 의존 노드 ID들. 모두 잠금 해제 + 레벨 1 이상이어야 활성. */
  prerequisites: SkillNodeId[];
  /** 최초 잠금 해제 비용 + 레벨업 비용 곡선의 시작값 */
  baseCost: number;
  /** 비용 곡선 비율 — cost(L) = baseCost × costMul^L */
  costMul: number;
  /** 최대 레벨 */
  maxLevel: number;
  effect: SkillNodeEffect;
  /** 트리 화면에서의 좌표 (정규화 0~1, 추후 UI에서 사용) */
  position: { x: number; y: number };
}

interface RawSkillNode {
  id: string;
  name: { ko: string; en: string };
  description: { ko: string; en: string };
  branch: SkillNodeBranch;
  prerequisites: string[];
  baseCost: number;
  costMul: number;
  maxLevel: number;
  effect: SkillNodeEffect;
  position: { x: number; y: number };
}

interface RawSkillNodes {
  nodes: RawSkillNode[];
}

const RAW = skillNodesJson as RawSkillNodes;

const NODE_MAP: ReadonlyMap<SkillNodeId, SkillNodeDef> = new Map(
  RAW.nodes.map((n): [SkillNodeId, SkillNodeDef] => [
    asSkillNodeId(n.id),
    {
      id: asSkillNodeId(n.id),
      name: n.name,
      description: n.description,
      branch: n.branch,
      prerequisites: n.prerequisites.map(asSkillNodeId),
      baseCost: n.baseCost,
      costMul: n.costMul,
      maxLevel: n.maxLevel,
      effect: n.effect,
      position: n.position,
    },
  ]),
);

export const SKILL_NODES: ReadonlyMap<SkillNodeId, SkillNodeDef> = NODE_MAP;

export function getNodeDef(id: SkillNodeId): SkillNodeDef | null {
  return NODE_MAP.get(id) ?? null;
}

/**
 * 다음 비용 (현재 레벨 → 다음 레벨).
 * - currentLevel = 0 (잠금 해제 전): baseCost
 * - currentLevel = N: baseCost × costMul^N
 */
export function computeNodeCost(def: SkillNodeDef, currentLevel: number): number {
  return Math.round(def.baseCost * Math.pow(def.costMul, currentLevel));
}

/** prerequisites 모두 unlocked + level >= 1 이어야 새 노드를 잠금 해제 가능 */
export function isUnlockable(state: GameState, nodeId: SkillNodeId): boolean {
  const def = NODE_MAP.get(nodeId);
  if (!def) return false;
  if (state.meta.skillTree[nodeId]?.unlocked) return false;
  for (const pre of def.prerequisites) {
    const s = state.meta.skillTree[pre];
    if (!s?.unlocked || s.level < 1) return false;
  }
  return true;
}

/**
 * RunStart 시점 → 현재 메타 진행도를 RunModifiers로 변환.
 *
 * 카드 효과는 이 위에 추가로 누적된다 (cardOffer.applyCardEffect).
 */
export function computeMetaModifiers(state: GameState): RunModifiers {
  let m = { ...DEFAULT_RUN_MODIFIERS };
  for (const [nodeId, nodeState] of Object.entries(state.meta.skillTree)) {
    if (!nodeState.unlocked) continue;
    const def = NODE_MAP.get(nodeId as SkillNodeId);
    if (!def) continue;
    const level = nodeState.level;
    if (level <= 0) continue;

    switch (def.effect.kind) {
      case 'damage_mul':
        m = { ...m, damageMul: m.damageMul + def.effect.magnitudePerLevel * level };
        break;
      case 'combo_window_ms':
        m = {
          ...m,
          comboWindowMs: m.comboWindowMs + def.effect.magnitudePerLevel * level,
        };
        break;
      case 'starting_combo_window_ms':
        m = {
          ...m,
          comboWindowMs: m.comboWindowMs + def.effect.magnitudePerLevel * level,
        };
        break;
      case 'ore_value_mul':
        m = { ...m, oreValueMul: m.oreValueMul + def.effect.magnitudePerLevel * level };
        break;
      case 'drop_rate_mul':
        m = { ...m, dropRateMul: m.dropRateMul + def.effect.magnitudePerLevel * level };
        break;
      case 'combo_max_bonus':
        m = {
          ...m,
          comboMaxBonus: m.comboMaxBonus + def.effect.magnitudePerLevel * level,
        };
        break;
      case 'crystal_run_bonus':
        // crystal_run_bonus는 런 종료 정산 시 별도 합산 — RunModifiers에는 미반영.
        break;
    }
  }
  return m;
}

/** 메타 노드로 인한 런 종료 크리스탈 보너스 합 */
export function computeMetaCrystalBonus(state: GameState): number {
  let bonus = 0;
  for (const [nodeId, nodeState] of Object.entries(state.meta.skillTree)) {
    if (!nodeState.unlocked || nodeState.level <= 0) continue;
    const def = NODE_MAP.get(nodeId as SkillNodeId);
    if (!def) continue;
    if (def.effect.kind === 'crystal_run_bonus') {
      bonus += def.effect.magnitudePerLevel * nodeState.level;
    }
  }
  return bonus;
}
