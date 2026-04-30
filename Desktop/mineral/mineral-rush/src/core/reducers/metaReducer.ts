/**
 * Meta Reducer — 영구 진행 (스킬 트리, 언락).
 *
 * Phase 2 슬림: SKILL_NODE_UNLOCK만. Phase 3에서 비용/prerequisite 체크 추가.
 */

import type { GameState } from '../State.ts';
import type { SkillNodeUnlockAction } from '../Actions.ts';

export function unlockSkillNode(state: GameState, action: SkillNodeUnlockAction): GameState {
  const nodeId = action.payload.nodeId;
  const existing = state.meta.skillTree[nodeId];
  if (existing?.unlocked) return state;
  return {
    ...state,
    meta: {
      ...state.meta,
      skillTree: {
        ...state.meta.skillTree,
        [nodeId]: { unlocked: true, level: existing?.level ?? 1 },
      },
    },
  };
}

export const metaReducer = { unlockSkillNode } as const;
