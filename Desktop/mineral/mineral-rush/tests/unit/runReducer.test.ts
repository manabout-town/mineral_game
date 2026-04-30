/**
 * RunReducer 단위 테스트 — Phase 2 갱신본.
 *
 * 광맥 HP, 콤보, 카드 오퍼, 결정론 모두 검증.
 */

import { describe, it, expect } from 'vitest';
import { rootReducer } from '../../src/core/reducers/index.ts';
import { createInitialState } from '../../src/core/State.ts';
import { asRunId, asStageId } from '../../src/shared/ids.ts';
import type { Action } from '../../src/core/Actions.ts';
import { asGameTimeMs } from '../../src/core/reducers/runReducer.ts';

const FIXED_NOW = 1_700_000_000_000;
const FIXED_SEED = 12345;

function startRun(seed: number = FIXED_SEED) {
  const initial = createInitialState('test-player', FIXED_NOW);
  const action: Action = {
    type: 'RUN_START',
    payload: {
      runId: asRunId('run-1'),
      seed,
      stageId: asStageId('open_pit'),
      depth: 1,
      durationMs: 30_000,
      now: FIXED_NOW,
    },
  };
  return rootReducer(initial, action);
}

describe('runReducer — Phase 2', () => {
  it('RUN_START — 광맥, modifiers, rngState 모두 초기화', () => {
    const s = startRun();
    expect(s.run).not.toBeNull();
    expect(s.run?.vein.hp).toBeGreaterThan(0);
    expect(s.run?.vein.hp).toBe(s.run?.vein.maxHp);
    expect(s.run?.vein.veinIndex).toBe(0);
    expect(s.run?.vein.mineralPool.length).toBeGreaterThan(0);
    expect(s.run?.modifiers.damageMul).toBe(1);
    expect(s.run?.combo).toBe(0);
    expect(s.run?.events).toHaveLength(0);
    expect(s.meta.stats.totalRuns).toBe(1);
    expect(s.run?.finished).toBeNull();
  });

  it('MINE_HIT — vein HP 감소 + damageDealt + 콤보 시작', () => {
    const s0 = startRun();
    const s1 = rootReducer(s0, {
      type: 'MINE_HIT',
      payload: { t: asGameTimeMs(100), x: 0, y: 0 },
    });
    expect(s1.run?.combo).toBe(1);
    expect(s1.run?.comboExpiresAt).not.toBeNull();
    expect(s1.run?.vein.hp).toBeLessThan(s1.run!.vein.maxHp);
    expect(s1.run?.damageDealt).toBeGreaterThan(0);
    const mineHit = s1.run?.events.find((e) => e.type === 'mine_hit');
    expect(mineHit).toBeDefined();
  });

  it('연속 MINE_HIT — 콤보 누적', () => {
    let s = startRun();
    for (let i = 0; i < 5; i++) {
      s = rootReducer(s, {
        type: 'MINE_HIT',
        payload: { t: asGameTimeMs(100 + i * 50), x: 0, y: 0 },
      });
    }
    expect(s.run?.combo).toBe(5);
  });

  it('콤보 만료 — RUN_TICK이 윈도우 초과 후 콤보 0', () => {
    let s = startRun();
    s = rootReducer(s, { type: 'MINE_HIT', payload: { t: asGameTimeMs(100), x: 0, y: 0 } });
    expect(s.run?.combo).toBe(1);
    // remaining을 30초 - (윈도우+여유) 만큼 흘리려면 큰 deltaMs 한 번에
    // 콤보 윈도우는 1500ms, 첫 hit가 t=100에 있고 만료는 t=1600 부근
    // RUN_TICK은 deltaMs를 받으니 2000ms 흘림
    s = rootReducer(s, { type: 'RUN_TICK', payload: { deltaMs: 2_000 } });
    expect(s.run?.combo).toBe(0);
    expect(s.run?.events.some((e) => e.type === 'combo_break')).toBe(true);
  });

  it('광맥 파괴 — HP 0 → 새 광맥 + cardOffer 자동 생성', () => {
    let s = startRun();
    // 광맥을 부수기 위해 충분히 많이 타격 (damage=10, hp=200 → 20+ 타격)
    for (let i = 0; i < 30; i++) {
      s = rootReducer(s, {
        type: 'MINE_HIT',
        payload: { t: asGameTimeMs(50 + i * 60), x: 0, y: 0 },
      });
      if ((s.run?.veinsDestroyed ?? 0) >= 1) break;
    }
    expect(s.run?.veinsDestroyed).toBeGreaterThanOrEqual(1);
    expect(s.run?.vein.veinIndex).toBeGreaterThanOrEqual(1);
    expect(s.run?.cardOffer).not.toBeNull();
    expect(s.run?.cardOffer?.cards.length).toBeGreaterThan(0);
  });

  it('CARD_PICKED — modifiers에 효과 누적', () => {
    let s = startRun();
    // 광맥 부수기
    for (let i = 0; i < 30 && (s.run?.veinsDestroyed ?? 0) < 1; i++) {
      s = rootReducer(s, {
        type: 'MINE_HIT',
        payload: { t: asGameTimeMs(50 + i * 60), x: 0, y: 0 },
      });
    }
    const offer = s.run?.cardOffer;
    expect(offer).not.toBeNull();
    const firstCard = offer!.cards[0]!;
    const before = { ...s.run!.modifiers };
    s = rootReducer(s, {
      type: 'CARD_PICKED',
      payload: { t: asGameTimeMs(2000), cardId: firstCard.cardId },
    });
    expect(s.run?.cards.length).toBe(1);
    expect(s.run?.cardOffer).toBeNull();
    // modifiers 중 어느 하나는 변경되어야 함
    const after = s.run!.modifiers;
    const changed =
      after.damageMul !== before.damageMul ||
      after.comboWindowMs !== before.comboWindowMs ||
      after.oreValueMul !== before.oreValueMul ||
      after.dropRateMul !== before.dropRateMul ||
      after.comboMaxBonus !== before.comboMaxBonus;
    expect(changed).toBe(true);
  });

  it('RUN_END — finished 채움 + run은 보존(결과 화면용)', () => {
    let s = startRun();
    s = rootReducer(s, { type: 'RUN_TICK', payload: { deltaMs: 5_000 } });
    s = rootReducer(s, {
      type: 'RUN_END',
      payload: { reason: 'timeout', now: FIXED_NOW + 5_000 },
    });
    expect(s.run).not.toBeNull(); // 결과 화면 위해 유지
    expect(s.run?.finished).not.toBeNull();
    expect(s.run?.finished?.reason).toBe('timeout');
    expect(s.meta.stats.totalPlayTimeMs).toBe(5_000);
  });

  it('결정론 — 동일 seed/액션 시퀀스 → 동일 결과', () => {
    const sequence: Action[] = [
      {
        type: 'RUN_START',
        payload: {
          runId: asRunId('run-2'),
          seed: 999,
          stageId: asStageId('open_pit'),
          depth: 1,
          durationMs: 30_000,
          now: FIXED_NOW,
        },
      },
      { type: 'RUN_TICK', payload: { deltaMs: 16.66 } },
      { type: 'MINE_HIT', payload: { t: asGameTimeMs(100), x: 0, y: 0 } },
      { type: 'MINE_HIT', payload: { t: asGameTimeMs(200), x: 0, y: 0 } },
      { type: 'MINE_HIT', payload: { t: asGameTimeMs(300), x: 0, y: 0 } },
      { type: 'MINE_HIT', payload: { t: asGameTimeMs(400), x: 0, y: 0 } },
      { type: 'MINE_HIT', payload: { t: asGameTimeMs(500), x: 0, y: 0 } },
      { type: 'RUN_END', payload: { reason: 'timeout', now: FIXED_NOW + 600 } },
    ];

    const initial = createInitialState('test-player', FIXED_NOW);
    const a = sequence.reduce(rootReducer, initial);
    const b = sequence.reduce(rootReducer, initial);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('Immutability — reducer는 원본 state를 변경하지 않음', () => {
    const s = startRun();
    const before = JSON.stringify(s);
    rootReducer(s, { type: 'MINE_HIT', payload: { t: asGameTimeMs(100), x: 0, y: 0 } });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('SCHEMA_MIGRATE — schemaVersion 갱신', () => {
    const s = startRun();
    const m = rootReducer(s, {
      type: 'SCHEMA_MIGRATE',
      payload: { fromVersion: 1, toVersion: 2 },
    });
    expect(m.schemaVersion).toBe(2);
  });
});
