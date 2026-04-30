/**
 * 결정론 회귀 테스트 (tests/replay/).
 *
 * Phase 2 Gate Check:
 *   - 알려진 시드/액션 시퀀스가 미래 코드 변경 후에도 동일 결과를 낸다.
 *   - 클라가 보낸 events[]를 서버(rootReducer 재생)가 동일하게 reproduce 가능.
 *
 * 5계명 §1 Pure Logic First — 외부 의존성 없음. CI에서 매 PR 실행.
 */

import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/core/State.ts';
import { rootReducer } from '../../src/core/reducers/index.ts';
import type { Action } from '../../src/core/Actions.ts';
import { asGameTimeMs } from '../../src/core/reducers/runReducer.ts';
import { asRunId, asStageId } from '../../src/shared/ids.ts';
import { replayRun } from '../../src/systems/Replay.ts';

const FIXED_NOW = 1_700_000_000_000;

/** 30초 런을 시뮬레이션하는 표준 액션 시퀀스 */
function generateRunSequence(seed: number): Action[] {
  const seq: Action[] = [
    {
      type: 'RUN_START',
      payload: {
        runId: asRunId(`run-${seed}`),
        seed,
        stageId: asStageId('open_pit'),
        depth: 1,
        durationMs: 30_000,
        now: FIXED_NOW,
      },
    },
  ];
  // 50회 탭 (간격 200ms = 5 hits/sec)
  for (let i = 0; i < 50; i++) {
    seq.push({
      type: 'MINE_HIT',
      payload: { t: asGameTimeMs(200 + i * 200), x: 0, y: 0 },
    });
  }
  // 결과적으로 광맥 여러 개 부수고 카드 오퍼가 생기지만, 카드 픽은 안 함 (Phase 2 회귀)
  seq.push({ type: 'RUN_END', payload: { reason: 'timeout', now: FIXED_NOW + 30_000 } });
  return seq;
}

describe('Determinism regression — Phase 2', () => {
  it('동일 시드: 50회 탭 후 oresCollected가 동일', () => {
    const init = createInitialState('test', FIXED_NOW);
    const seq = generateRunSequence(42);
    const a = seq.reduce(rootReducer, init).run;
    const b = seq.reduce(rootReducer, init).run;
    expect(JSON.stringify(a?.oresCollected)).toBe(JSON.stringify(b?.oresCollected));
    expect(a?.veinsDestroyed).toBe(b?.veinsDestroyed);
    expect(a?.damageDealt).toBe(b?.damageDealt);
  });

  it('다른 시드: 결과가 달라질 수도 있다 (RNG 검증)', () => {
    const init = createInitialState('test', FIXED_NOW);
    const a = generateRunSequence(11).reduce(rootReducer, init).run;
    const b = generateRunSequence(99).reduce(rootReducer, init).run;
    // 모든 시드에서 정확히 같으면 RNG가 안 도는 것 → 다른 시드 중 하나는 달라야 함
    const same =
      JSON.stringify(a?.oresCollected) === JSON.stringify(b?.oresCollected) &&
      a?.damageDealt === b?.damageDealt;
    expect(same).toBe(false);
  });

  it('Replay — events[]를 reducer 재생 시 결과 일치', () => {
    const init = createInitialState('test', FIXED_NOW);
    const seq = generateRunSequence(777);
    const final = seq.reduce(rootReducer, init);
    expect(final.run).not.toBeNull();
    const events = final.run!.events;

    // 서버 측: RUN_START만 적용된 init state에서 events 재생
    const startState = rootReducer(init, seq[0]!);
    const replay = replayRun(startState, events);
    expect(replay.ok).toBe(true);
    expect(replay.finalState?.veinsDestroyed).toBe(final.run!.veinsDestroyed);
    expect(replay.finalState?.oresCollected).toEqual(final.run!.oresCollected);
  });

  it('1000런 시뮬레이션: 광석 카운트 음수 발생 0회 (Phase 2 Gate Check 불변식)', () => {
    let negativeCount = 0;
    for (let i = 0; i < 100; i++) {
      // CI에서 1000은 너무 길어서 100. balance-sim에서 1000.
      const init = createInitialState('test', FIXED_NOW);
      const seq = generateRunSequence(i * 31);
      const final = seq.reduce(rootReducer, init);
      if (!final.run) continue;
      for (const v of Object.values(final.run.oresCollected)) {
        if (v < 0) negativeCount++;
      }
    }
    expect(negativeCount).toBe(0);
  });
});
