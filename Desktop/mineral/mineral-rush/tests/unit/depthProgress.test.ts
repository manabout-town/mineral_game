/**
 * depthProgress 단위 테스트.
 *   - 광맥 부순 수에 따른 깊이 진행
 *   - stage 매칭
 */

import { describe, it, expect } from 'vitest';
import {
  shouldAdvanceDepth,
  getStageForDepth,
  DEFAULT_DEPTH_PROGRESS,
} from '../../src/core/rules/depthProgress.ts';
import type { RunState } from '../../src/core/State.ts';
import { DEFAULT_RUN_MODIFIERS } from '../../src/core/State.ts';
import { asMineralId, asPickaxeId, asRunId, asStageId } from '../../src/shared/ids.ts';

function makeRun(veinsDestroyed: number, depth = 1): RunState {
  return {
    runId: asRunId('test'),
    seed: 1,
    rngState: 1,
    startedAt: 0,
    duration: 30_000,
    remaining: 30_000,
    depth,
    stageId: asStageId('open_pit'),
    pickaxe: {
      pickaxeId: asPickaxeId('basic_pickaxe'),
      damage: 10,
      speed: 4,
      range: 50,
      comboBonus: 0.05,
    },
    vein: { veinIndex: 0, hp: 200, maxHp: 200, mineralPool: [], dangerSide: 'left' as const },
    veinsDestroyed,
    cards: [],
    modifiers: { ...DEFAULT_RUN_MODIFIERS },
    cardOffer: null,
    combo: 0,
    comboExpiresAt: null,
    playerSide: 'right' as const,
    exp: 0,
    expThreshold: 20,
    oresCollected: { [asMineralId('copper')]: 1 },
    damageDealt: 0,
    events: [],
    finished: null,
  };
}

describe('depthProgress', () => {
  it('shouldAdvanceDepth — 임계값 미만이면 null', () => {
    const run = makeRun(2, 1); // base=3 필요
    expect(shouldAdvanceDepth(run, DEFAULT_DEPTH_PROGRESS)).toBeNull();
  });

  it('shouldAdvanceDepth — 임계값 이상이면 다음 깊이 반환', () => {
    const run = makeRun(3, 1);
    expect(shouldAdvanceDepth(run, DEFAULT_DEPTH_PROGRESS)).toBe(2);
  });

  it('depth 2 → 3는 base + (base+growth) = 3+4 = 7', () => {
    const run = makeRun(7, 2);
    expect(shouldAdvanceDepth(run, DEFAULT_DEPTH_PROGRESS)).toBe(3);
    const before = makeRun(6, 2);
    expect(shouldAdvanceDepth(before, DEFAULT_DEPTH_PROGRESS)).toBeNull();
  });

  it('maxDepthPerRun — 도달 시 진행 없음', () => {
    const run = makeRun(10_000, DEFAULT_DEPTH_PROGRESS.maxDepthPerRun);
    expect(shouldAdvanceDepth(run, DEFAULT_DEPTH_PROGRESS)).toBeNull();
  });

  it('getStageForDepth — depth 1은 첫 스테이지(open_pit)', () => {
    expect(getStageForDepth(1)).toBe('open_pit');
  });

  it('getStageForDepth — 매우 깊은 depth는 마지막 스테이지', () => {
    const id = getStageForDepth(99);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
