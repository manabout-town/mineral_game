/**
 * Meta Reducer — 영구 진행 (스킬 트리, 언락, 레벨업).
 *
 * Phase 3:
 *   - SKILL_NODE_UNLOCK — 첫 잠금 해제 (비용 차감)
 *   - SKILL_NODE_LEVEL_UP — 레벨 +1 (레벨별 비용 곡선)
 *
 * 5계명 §1 Pure Logic: 외부 의존성은 content (불변).
 * 5계명 §4 Validation Required: prerequisites + 비용 검증을 reducer 안에서 직접 수행.
 *   잘못된 액션은 state 그대로 반환 (조용한 거부) → ValidationSystem이 따로 잡음.
 */

import type { GameState } from '../State.ts';
import type { SkillNodeUnlockAction, SkillNodeLevelUpAction } from '../Actions.ts';
import { computeNodeCost, getNodeDef, isUnlockable } from '../rules/skillTree.ts';

export function unlockSkillNode(state: GameState, action: SkillNodeUnlockAction): GameState {
  const nodeId = action.payload.nodeId;
  const def = getNodeDef(nodeId);
  if (!def) return state;
  const existing = state.meta.skillTree[nodeId];
  if (existing?.unlocked) return state;

  if (!isUnlockable(state, nodeId)) return state;

  const cost = computeNodeCost(def, 0);
  if (state.economy.crystals < cost) return state;

  return {
    ...state,
    economy: { ...state.economy, crystals: state.economy.crystals - cost },
    meta: {
      ...state.meta,
      skillTree: {
        ...state.meta.skillTree,
        [nodeId]: { unlocked: true, level: 1 },
      },
    },
  };
}

export function levelUpSkillNode(state: GameState, action: SkillNodeLevelUpAction): GameState {
  const nodeId = action.payload.nodeId;
  const def = getNodeDef(nodeId);
  if (!def) return state;
  const existing = state.meta.skillTree[nodeId];
  if (!existing?.unlocked) return state;
  if (existing.level >= def.maxLevel) return state;

  const cost = computeNodeCost(def, existing.level);
  if (state.economy.crystals < cost) return state;

  return {
    ...state,
    economy: { ...state.economy, crystals: state.economy.crystals - cost },
    meta: {
      ...state.meta,
      skillTree: {
        ...state.meta.skillTree,
        [nodeId]: { unlocked: true, level: existing.level + 1 },
      },
    },
  };
}

export const metaReducer = { unlockSkillNode, levelUpSkillNode } as const;
