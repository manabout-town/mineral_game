/**
 * RunReducer 단위 테스트.
 *
 * Phase 1 Gate Check: rootReducer가 RUN_START / RUN_TICK / RUN_END / MINE_HIT를
 * 결정론적으로 처리하는지 검증.
 */

import { describe, it, expect } from 'vitest';
import { rootReducer } from '../../src/core/reducers/index.ts';
import { createInitialState } from '../../src/core/State.ts';
import { asRunId, asStageId, asMineralId } from '../../src/shared/ids.ts';
import type { Action } from '../../src/core/Actions.ts';
import { asGameTimeMs } from '../../src/core/reducers/runReducer.ts';

const FIXED_NOW = 1_700_000_000_000;

function startRun(): { state: ReturnType<typeof createInitialState> } {
  const initial = createInitialState('test-player', FIXED_NOW);
  const action: Action = {
    type: 'RUN_START',
    payload: {
      runId: asRunId('run-1'),
      seed: 12345,
      stageId: asStageId('open_pit'),
      depth: 1,
      durationMs: 30_000,
      now: FIXED_NOW,
    },
  };
  return { state: rootReducer(initial, action) };
}

describe('runReducer', () => {
  it('RUN_START — 새 RunState를 생성하고 totalRuns를 증가시킨다', () => {
    const initial = createInitialState('test-player', FIXED_NOW);
    expect(initial.run).toBeNull();
    expect(initial.meta.stats.totalRuns).toBe(0);

    const { state } = startRun();
    expect(state.run).not.toBeNull();
    expect(state.run?.runId).toBe('run-1');
    expect(state.run?.seed).toBe(12345);
    expect(state.run?.depth).toBe(1);
    expect(state.run?.remaining).toBe(30_000);
    expect(state.run?.events).toEqual([]);
    expect(state.meta.stats.totalRuns).toBe(1);
  });

  it('RUN_TICK — remaining을 감소시킨다 (음수로 떨어지지 않음)', () => {
    const { state } = startRun();
    const tickedOnce = rootReducer(state, { type: 'RUN_TICK', payload: { deltaMs: 16.66 } });
    expect(tickedOnce.run?.remaining).toBeCloseTo(30_000 - 16.66, 2);

    // 충분히 많이 틱
    let s = tickedOnce;
    for (let i = 0; i < 10_000; i++) {
      s = rootReducer(s, { type: 'RUN_TICK', payload: { deltaMs: 16.66 } });
    }
    expect(s.run?.remaining).toBe(0);
    expect(s.run?.remaining).not.toBeLessThan(0);
  });

  it('MINE_HIT — events에 기록되고 damageDealt가 누적된다', () => {
    const { state } = startRun();
    const hit = rootReducer(state, {
      type: 'MINE_HIT',
      payload: { t: asGameTimeMs(100), x: 50, y: 50 },
    });
    expect(hit.run?.events).toHaveLength(1);
    expect(hit.run?.events[0]?.type).toBe('mine_hit');
    expect(hit.run?.damageDealt).toBe(10); // basic_pickaxe.damage

    const hit2 = rootReducer(hit, {
      type: 'MINE_HIT',
      payload: { t: asGameTimeMs(200), x: 60, y: 60 },
    });
    expect(hit2.run?.damageDealt).toBe(20);
  });

  it('ORE_COLLECTED — oresCollected 카운터에 누적된다', () => {
    const { state } = startRun();
    const copper = asMineralId('copper');
    const s1 = rootReducer(state, {
      type: 'ORE_COLLECTED',
      payload: { t: asGameTimeMs(100), mineralId: copper, amount: 5 },
    });
    expect(s1.run?.oresCollected[copper]).toBe(5);

    const s2 = rootReducer(s1, {
      type: 'ORE_COLLECTED',
      payload: { t: asGameTimeMs(200), mineralId: copper, amount: 3 },
    });
    expect(s2.run?.oresCollected[copper]).toBe(8);
  });

  it('RUN_END — run을 null로 만들고 totalPlayTimeMs를 누적한다', () => {
    const { state } = startRun();
    const ticked = rootReducer(state, { type: 'RUN_TICK', payload: { deltaMs: 5_000 } });
    const ended = rootReducer(ticked, { type: 'RUN_END', payload: { reason: 'quit' } });
    expect(ended.run).toBeNull();
    expect(ended.meta.stats.totalPlayTimeMs).toBe(5_000);
  });

  it('결정론 — 동일 (state, action) 시퀀스는 동일 결과', () => {
    const initial = createInitialState('test-player', FIXED_NOW);
    const sequence: Action[] = [
      {
        type: 'RUN_START',
        payload: {
          runId: asRunId('run-2'),
          seed: 999,
          stageId: asStageId('cave'),
          depth: 2,
          durationMs: 30_000,
          now: FIXED_NOW,
        },
      },
      { type: 'RUN_TICK', payload: { deltaMs: 16.66 } },
      { type: 'MINE_HIT', payload: { t: asGameTimeMs(100), x: 0, y: 0 } },
      { type: 'MINE_HIT', payload: { t: asGameTimeMs(200), x: 0, y: 0 } },
      {
        type: 'ORE_COLLECTED',
        payload: { t: asGameTimeMs(250), mineralId: asMineralId('copper'), amount: 2 },
      },
      { type: 'RUN_END', payload: { reason: 'timeout' } },
    ];

    const runOnce = sequence.reduce(rootReducer, initial);
    const runTwice = sequence.reduce(rootReducer, initial);
    expect(runOnce).toEqual(runTwice);
  });

  it('Immutability — reducer는 원본 state를 변경하지 않는다', () => {
    const { state } = startRun();
    const before = JSON.stringify(state);
    rootReducer(state, { type: 'RUN_TICK', payload: { deltaMs: 100 } });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('SCHEMA_MIGRATE — schemaVersion 갱신', () => {
    const initial = createInitialState('test-player', FIXED_NOW);
    const migrated = rootReducer(initial, {
      type: 'SCHEMA_MIGRATE',
      payload: { fromVersion: 1, toVersion: 2 },
    });
    expect(migrated.schemaVersion).toBe(2);
  });
});
