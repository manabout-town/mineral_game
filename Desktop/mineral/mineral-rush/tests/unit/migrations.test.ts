/**
 * Migration 체인 단위 테스트.
 *
 * the-migration-expert: 100건 실 유저 데이터 샘플 회귀 검증의 토대.
 */

import { describe, it, expect } from 'vitest';
import { migrationsByVersion, v1_to_v2 } from '../../src/systems/migrations/index.ts';
import { createInitialState } from '../../src/core/State.ts';
import { SCHEMA_VERSION } from '../../src/shared/constants.ts';

const FIXED_NOW = 1_700_000_000_000;

describe('migrations chain', () => {
  it('현재 SCHEMA_VERSION에 맞춰 모든 v1→latest 변환 가능', () => {
    // v1 형태의 GameState (bestRunValueCrystals 없음)
    const v1 = {
      ...createInitialState('p', FIXED_NOW),
      schemaVersion: 1,
    };
    // bestRunValueCrystals 의도적으로 제거 (v1 시뮬레이션)
    const stats = { ...v1.meta.stats } as Record<string, number>;
    delete stats.bestRunValueCrystals;
    v1.meta = { ...v1.meta, stats: stats as never };

    let current = v1;
    let safety = 0;
    while (current.schemaVersion < SCHEMA_VERSION) {
      const fn = migrationsByVersion[current.schemaVersion];
      expect(fn).toBeDefined();
      current = fn!(current);
      if (++safety > 20) throw new Error('migration loop');
    }
    expect(current.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('v1_to_v2 — bestRunValueCrystals 기본값 0 채움 + 다른 stats 보존', () => {
    const v1 = {
      ...createInitialState('p', FIXED_NOW),
      schemaVersion: 1 as const,
    };
    const stats = { ...v1.meta.stats } as Record<string, number>;
    delete stats.bestRunValueCrystals;
    stats.totalRuns = 5;
    stats.totalOresMined = 1234;
    v1.meta = { ...v1.meta, stats: stats as never };

    const v2 = v1_to_v2(v1);
    expect(v2.schemaVersion).toBe(2);
    expect(v2.meta.stats.bestRunValueCrystals).toBe(0);
    expect(v2.meta.stats.totalRuns).toBe(5);
    expect(v2.meta.stats.totalOresMined).toBe(1234);
  });

  it('v1_to_v2 — schemaVersion이 1이 아니면 noop', () => {
    const v2 = {
      ...createInitialState('p', FIXED_NOW),
      schemaVersion: 2 as const,
    };
    const result = v1_to_v2(v2);
    expect(result).toEqual(v2);
  });

  it('idempotent — 같은 마이그레이션을 두 번 실행해도 결과 동일', () => {
    const v1 = {
      ...createInitialState('p', FIXED_NOW),
      schemaVersion: 1 as const,
    };
    const stats = { ...v1.meta.stats } as Record<string, number>;
    delete stats.bestRunValueCrystals;
    v1.meta = { ...v1.meta, stats: stats as never };

    const a = v1_to_v2(v1);
    const b = v1_to_v2(v1);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
