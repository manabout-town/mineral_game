/**
 * RunReducer 단위 테스트 — Phase 7 (Timber Rush 메카닉 반영).
 *
 * 변경: MINE_HIT에 side 필드 추가. dangerSide 반대편을 탭해야 히트.
 * safeSide() 헬퍼로 항상 안전한 쪽을 선택해 기존 테스트 의미를 보존.
 */

import { describe, it, expect } from 'vitest';
import { rootReducer } from '../../src/core/reducers/index.ts';
import { createInitialState, type GameState } from '../../src/core/State.ts';
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

/** Timber Rush: 현재 dangerSide의 반대쪽을 반환 (항상 HIT 보장) */
function safeSide(s: GameState): 'left' | 'right' {
  return s.run?.vein.dangerSide === 'left' ? 'right' : 'left';
}

/** 안전한 MINE_HIT 액션 생성 (dangerSide 반대편 선택) */
function safeHit(s: GameState, t: number): Action {
  return {
    type: 'MINE_HIT',
    payload: { t: asGameTimeMs(t), x: 0, y: 0, side: safeSide(s) },
  };
}

describe('runReducer — Phase 7 (Timber Rush)', () => {
  it('RUN_START — 광맥, modifiers, rngState, playerSide, dangerSide 초기화', () => {
    const s = startRun();
    expect(s.run).not.toBeNull();
    expect(s.run?.vein.hp).toBeGreaterThan(0);
    expect(s.run?.vein.hp).toBe(s.run?.vein.maxHp);
    expect(s.run?.vein.veinIndex).toBe(0);
    expect(s.run?.vein.mineralPool.length).toBeGreaterThan(0);
    expect(s.run?.vein.dangerSide).toMatch(/^(left|right)$/);
    expect(s.run?.playerSide).toMatch(/^(left|right)$/);
    expect(s.run?.modifiers.damageMul).toBe(1);
    expect(s.run?.combo).toBe(0);
    expect(s.run?.events).toHaveLength(0);
    expect(s.meta.stats.totalRuns).toBe(1);
    expect(s.run?.finished).toBeNull();
  });

  it('MINE_HIT (안전한 쪽) — vein HP 감소 + damageDealt + 콤보 시작', () => {
    const s0 = startRun();
    const s1 = rootReducer(s0, safeHit(s0, 100));
    expect(s1.run?.combo).toBe(1);
    expect(s1.run?.comboExpiresAt).not.toBeNull();
    expect(s1.run?.vein.hp).toBeLessThan(s1.run!.vein.maxHp);
    expect(s1.run?.damageDealt).toBeGreaterThan(0);
    const mineHit = s1.run?.events.find((e) => e.type === 'mine_hit');
    expect(mineHit).toBeDefined();
    if (mineHit?.type === 'mine_hit') {
      expect(mineHit.miss).toBe(false);
    }
  });

  it('MINE_HIT (위험한 쪽) — 미스: HP 변화 없음, 콤보 리셋', () => {
    const s0 = startRun();
    // 먼저 1회 안전 타격해서 콤보 1 만들기
    const s1 = rootReducer(s0, safeHit(s0, 100));
    expect(s1.run?.combo).toBe(1);
    // 이제 dangerSide를 탭 → MISS
    const dangerSide = s1.run!.vein.dangerSide!;
    const s2 = rootReducer(s1, {
      type: 'MINE_HIT',
      payload: { t: asGameTimeMs(200), x: 0, y: 0, side: dangerSide },
    });
    expect(s2.run?.combo).toBe(0);         // 콤보 리셋
    expect(s2.run?.damageDealt).toBe(s1.run!.damageDealt); // 데미지 없음
    const allHits = s2.run?.events.filter((e) => e.type === 'mine_hit') ?? [];
    const missEvent = allHits[allHits.length - 1];
    if (missEvent?.type === 'mine_hit') {
      expect(missEvent.miss).toBe(true);
    }
  });

  it('연속 MINE_HIT (안전한 쪽만) — 콤보 누적', () => {
    let s = startRun();
    for (let i = 0; i < 5; i++) {
      s = rootReducer(s, safeHit(s, 100 + i * 50));
    }
    expect(s.run?.combo).toBe(5);
  });

  it('콤보 만료 — RUN_TICK이 윈도우 초과 후 콤보 0', () => {
    let s = startRun();
    s = rootReducer(s, safeHit(s, 100));
    expect(s.run?.combo).toBe(1);
    s = rootReducer(s, { type: 'RUN_TICK', payload: { deltaMs: 2_000 } });
    expect(s.run?.combo).toBe(0);
    expect(s.run?.events.some((e) => e.type === 'combo_break')).toBe(true);
  });

  it('광맥 파괴 — HP 0 → 새 광맥 + EXP 축적', () => {
    let s = startRun();
    for (let i = 0; i < 60; i++) {
      s = rootReducer(s, safeHit(s, 50 + i * 60));
      if ((s.run?.veinsDestroyed ?? 0) >= 1) break;
    }
    expect(s.run?.veinsDestroyed).toBeGreaterThanOrEqual(1);
    expect(s.run?.vein.veinIndex).toBeGreaterThanOrEqual(1);
    // 새 광맥도 dangerSide를 갖고 있어야 함
    expect(s.run?.vein.dangerSide).toMatch(/^(left|right)$/);
  });

  it('CARD_PICKED — modifiers에 효과 누적 (EXP 임계 도달 후)', () => {
    let s = startRun();
    // 카드 오퍼 생성될 때까지 안전 타격
    for (let i = 0; i < 120 && !s.run?.cardOffer; i++) {
      s = rootReducer(s, safeHit(s, 50 + i * 60));
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
    expect(s.run).not.toBeNull();
    expect(s.run?.finished).not.toBeNull();
    expect(s.run?.finished?.reason).toBe('timeout');
    expect(s.meta.stats.totalPlayTimeMs).toBe(5_000);
  });

  it('결정론 — 동일 seed/액션 시퀀스 → 동일 결과', () => {
    // 먼저 시퀀스를 한 번 실행해 dangerSide를 미리 알고 안전 side를 결정
    const initial = createInitialState('test-player', FIXED_NOW);
    const startAction: Action = {
      type: 'RUN_START',
      payload: {
        runId: asRunId('run-2'),
        seed: 999,
        stageId: asStageId('open_pit'),
        depth: 1,
        durationMs: 30_000,
        now: FIXED_NOW,
      },
    };

    // 결정론 시퀀스: alternating sides (결과가 seed에 의존해서 다양)
    const sides: Array<'left' | 'right'> = ['left', 'right', 'left', 'right', 'left'];
    const sequence: Action[] = [
      startAction,
      { type: 'RUN_TICK', payload: { deltaMs: 16.66 } },
      ...sides.map((side, i) => ({
        type: 'MINE_HIT' as const,
        payload: { t: asGameTimeMs(100 + i * 100), x: 0, y: 0, side },
      })),
      { type: 'RUN_END', payload: { reason: 'timeout' as const, now: FIXED_NOW + 600 } },
    ];

    const a = sequence.reduce(rootReducer, initial);
    const b = sequence.reduce(rootReducer, initial);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('Immutability — reducer는 원본 state를 변경하지 않음', () => {
    const s = startRun();
    const before = JSON.stringify(s);
    rootReducer(s, safeHit(s, 100));
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
