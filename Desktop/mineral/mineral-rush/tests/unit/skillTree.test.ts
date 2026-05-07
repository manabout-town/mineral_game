/**
 * skillTree 단위 테스트.
 *   - 비용 곡선
 *   - prerequisites 검증
 *   - meta modifiers 누적
 */

import { describe, it, expect } from 'vitest';
import {
  SKILL_NODES,
  computeNodeCost,
  isUnlockable,
  computeMetaModifiers,
  computeMetaCrystalBonus,
} from '../../src/core/rules/skillTree.ts';
import { rootReducer } from '../../src/core/reducers/index.ts';
import { createInitialState } from '../../src/core/State.ts';
import { asSkillNodeId } from '../../src/shared/ids.ts';

const FIXED_NOW = 1_700_000_000_000;

describe('skillTree', () => {
  it('SKILL_NODES — 비어있지 않고 모든 노드의 prerequisites는 다른 노드 ID로 해소', () => {
    expect(SKILL_NODES.size).toBeGreaterThan(0);
    for (const n of SKILL_NODES.values()) {
      for (const pre of n.prerequisites) {
        expect(SKILL_NODES.has(pre)).toBe(true);
      }
    }
  });

  it('computeNodeCost — currentLevel=0이면 baseCost, level이 늘면 곡선 적용', () => {
    const node = [...SKILL_NODES.values()][0]!;
    expect(computeNodeCost(node, 0)).toBe(node.baseCost);
    const c1 = computeNodeCost(node, 1);
    expect(c1).toBeGreaterThanOrEqual(node.baseCost);
  });

  it('isUnlockable — root 노드는 빈 prerequisite로 해제 가능, 자식은 root unlock 후 해제 가능', () => {
    const initial = { ...createInitialState('p', FIXED_NOW) };
    initial.economy.crystals = 1_000_000;

    const root = [...SKILL_NODES.values()].find((n) => n.prerequisites.length === 0)!;
    expect(isUnlockable(initial, root.id)).toBe(true);

    const unlocked = rootReducer(initial, {
      type: 'SKILL_NODE_UNLOCK',
      payload: { nodeId: root.id },
    });
    expect(unlocked.meta.skillTree[root.id]?.unlocked).toBe(true);
    expect(unlocked.meta.skillTree[root.id]?.level).toBe(1);
    expect(unlocked.economy.crystals).toBe(initial.economy.crystals - root.baseCost);
  });

  it('SKILL_NODE_LEVEL_UP — 레벨 +1, maxLevel 도달 시 추가 노옵', () => {
    let state = createInitialState('p', FIXED_NOW);
    state = { ...state, economy: { ...state.economy, crystals: 1_000_000 } };
    const root = [...SKILL_NODES.values()].find((n) => n.prerequisites.length === 0)!;
    state = rootReducer(state, { type: 'SKILL_NODE_UNLOCK', payload: { nodeId: root.id } });

    for (let i = 1; i < root.maxLevel; i++) {
      const before = state.meta.skillTree[root.id]?.level ?? 0;
      state = rootReducer(state, {
        type: 'SKILL_NODE_LEVEL_UP',
        payload: { nodeId: root.id },
      });
      expect(state.meta.skillTree[root.id]?.level).toBe(before + 1);
    }
    // maxLevel 도달 → 더 이상 변경 없음
    const atMax = state.meta.skillTree[root.id]?.level;
    state = rootReducer(state, {
      type: 'SKILL_NODE_LEVEL_UP',
      payload: { nodeId: root.id },
    });
    expect(state.meta.skillTree[root.id]?.level).toBe(atMax);
  });

  it('비용 부족 — UNLOCK / LEVEL_UP 모두 거부', () => {
    let state = createInitialState('p', FIXED_NOW);
    // 크리스탈 1개로 시작
    state = { ...state, economy: { ...state.economy, crystals: 1 } };
    const root = [...SKILL_NODES.values()].find((n) => n.prerequisites.length === 0)!;
    const after = rootReducer(state, {
      type: 'SKILL_NODE_UNLOCK',
      payload: { nodeId: root.id },
    });
    expect(after.meta.skillTree[root.id]?.unlocked ?? false).toBe(false);
    expect(after.economy.crystals).toBe(1);
  });

  it('prerequisite 없으면 잠금 해제 거부', () => {
    let state = createInitialState('p', FIXED_NOW);
    state = { ...state, economy: { ...state.economy, crystals: 1_000_000 } };
    const child = [...SKILL_NODES.values()].find((n) => n.prerequisites.length > 0)!;
    const after = rootReducer(state, {
      type: 'SKILL_NODE_UNLOCK',
      payload: { nodeId: child.id },
    });
    expect(after.meta.skillTree[child.id]?.unlocked ?? false).toBe(false);
  });

  it('computeMetaModifiers — 잠금 해제된 노드 효과가 누적됨', () => {
    let state = createInitialState('p', FIXED_NOW);
    state = { ...state, economy: { ...state.economy, crystals: 1_000_000 } };
    const dmgRoot = SKILL_NODES.get(asSkillNodeId('pickaxe_root'))!;
    state = rootReducer(state, {
      type: 'SKILL_NODE_UNLOCK',
      payload: { nodeId: dmgRoot.id },
    });
    const m = computeMetaModifiers(state);
    // pickaxe_root: damage_mul +0.05/level, level 1
    expect(m.damageMul).toBeCloseTo(1 + 0.05);
  });

  it('computeMetaCrystalBonus — crystal_run_bonus 노드 합산', () => {
    let state = createInitialState('p', FIXED_NOW);
    state = { ...state, economy: { ...state.economy, crystals: 1_000_000 } };
    const cr = SKILL_NODES.get(asSkillNodeId('crystal_root'))!;
    state = rootReducer(state, { type: 'SKILL_NODE_UNLOCK', payload: { nodeId: cr.id } });
    expect(computeMetaCrystalBonus(state)).toBe(cr.effect.kind === 'crystal_run_bonus' ? 5 : 0);
  });

  it('cycle 없음 — 단순 깊이 우선 탐색으로 모든 노드 reachable', () => {
    const visited = new Set<string>();
    function visit(id: string): void {
      if (visited.has(id)) return;
      visited.add(id);
      const n = SKILL_NODES.get(id as never);
      if (!n) return;
      for (const pre of n.prerequisites) visit(pre);
    }
    for (const id of SKILL_NODES.keys()) visit(id as string);
    expect(visited.size).toBe(SKILL_NODES.size);
  });
});
