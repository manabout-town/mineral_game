/**
 * Rules 엔진 단위 테스트 — damage / dropTable / cardOffer / veinHp.
 */

import { describe, it, expect } from 'vitest';
import { computeDamage } from '../../src/core/rules/damage.ts';
import { computeVeinHp } from '../../src/core/rules/veinHp.ts';
import { tryDrop, buildMineralPool, BASE_DROP_CHANCE } from '../../src/core/rules/dropTable.ts';
import {
  rollCardOffer,
  applyCardEffect,
  interpolateWeights,
  EARLY_WEIGHTS,
  LATE_WEIGHTS,
} from '../../src/core/rules/cardOffer.ts';
import { content } from '../../src/core/content/index.ts';
import { Mulberry32 } from '../../src/shared/SeededRandom.ts';
import { DEFAULT_RUN_MODIFIERS } from '../../src/core/State.ts';
import { asPickaxeId } from '../../src/shared/ids.ts';

describe('damage formula', () => {
  it('base damage × damageMul × (1 + comboMaxBonus × combo)', () => {
    const r = computeDamage({
      pickaxe: { pickaxeId: asPickaxeId('basic'), damage: 10, speed: 4, range: 50, comboBonus: 0 },
      modifiers: { ...DEFAULT_RUN_MODIFIERS, damageMul: 2, comboMaxBonus: 0.1 },
      combo: 5,
    });
    expect(r.base).toBe(10);
    expect(r.damageMul).toBe(2);
    expect(r.comboFactor).toBeCloseTo(1.5);
    expect(r.final).toBeCloseTo(30);
  });

  it('음수 damageMul은 0으로 클램프', () => {
    const r = computeDamage({
      pickaxe: { pickaxeId: asPickaxeId('basic'), damage: 10, speed: 4, range: 50, comboBonus: 0 },
      modifiers: { ...DEFAULT_RUN_MODIFIERS, damageMul: -1 },
      combo: 0,
    });
    expect(r.final).toBe(0);
  });
});

describe('veinHp', () => {
  it('depth가 깊을수록 HP가 증가 (지수)', () => {
    const stage = content.stages.values().next().value!;
    const hp1 = computeVeinHp(stage, 1, 0);
    const hp3 = computeVeinHp(stage, 3, 0);
    expect(hp3).toBeGreaterThan(hp1);
  });

  it('같은 depth에서도 veinIndex가 늘면 살짝 증가', () => {
    const stage = content.stages.values().next().value!;
    const hpA = computeVeinHp(stage, 1, 0);
    const hpB = computeVeinHp(stage, 1, 5);
    expect(hpB).toBeGreaterThan(hpA);
  });
});

describe('dropTable — 결정론', () => {
  it('동일 seed → 동일 드랍 시퀀스', () => {
    const pool = buildMineralPool(content, 1);
    const a = new Mulberry32(42);
    const b = new Mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const dA = tryDrop(pool, content, a, BASE_DROP_CHANCE, 1);
      const dB = tryDrop(pool, content, b, BASE_DROP_CHANCE, 1);
      expect(JSON.stringify(dA)).toBe(JSON.stringify(dB));
    }
  });

  it('dropRateMul=0이면 절대 드랍 안 함', () => {
    const pool = buildMineralPool(content, 1);
    const rng = new Mulberry32(7);
    for (let i = 0; i < 100; i++) {
      expect(tryDrop(pool, content, rng, BASE_DROP_CHANCE, 0)).toBeNull();
    }
  });

  it('dropRateMul=1로 1000회 → 평균 드랍률이 BASE_DROP_CHANCE 근처', () => {
    const pool = buildMineralPool(content, 1);
    const rng = new Mulberry32(123);
    let drops = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (tryDrop(pool, content, rng, BASE_DROP_CHANCE, 1) !== null) drops++;
    }
    const rate = drops / N;
    // BASE_DROP_CHANCE = 0.35, 표본 1000으로 ±0.05 허용
    expect(rate).toBeGreaterThan(BASE_DROP_CHANCE - 0.05);
    expect(rate).toBeLessThan(BASE_DROP_CHANCE + 0.05);
  });

  it('drop amount는 1~3 범위', () => {
    const pool = buildMineralPool(content, 1);
    const rng = new Mulberry32(999);
    for (let i = 0; i < 200; i++) {
      const d = tryDrop(pool, content, rng, BASE_DROP_CHANCE, 2);
      if (d) {
        expect(d.amount).toBeGreaterThanOrEqual(1);
        expect(d.amount).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('cardOffer', () => {
  it('동일 seed → 동일 오퍼', () => {
    const a = new Mulberry32(7);
    const b = new Mulberry32(7);
    const oA = rollCardOffer(content, a, { pickedCardIds: [], progress: 0, count: 3, rerollCost: 50 });
    const oB = rollCardOffer(content, b, { pickedCardIds: [], progress: 0, count: 3, rerollCost: 50 });
    expect(JSON.stringify(oA)).toBe(JSON.stringify(oB));
  });

  it('이미 픽한 카드는 다시 추첨되지 않음', () => {
    // 콘텐츠 카드 6종 모두 픽한 상태에서 추첨 → 빈 결과
    const allIds = Array.from(content.cards.keys());
    const rng = new Mulberry32(11);
    const o = rollCardOffer(content, rng, {
      pickedCardIds: allIds,
      progress: 0,
      count: 3,
      rerollCost: 50,
    });
    expect(o.cards.length).toBe(0);
  });

  it('가중치 보간이 [EARLY..LATE] 사이', () => {
    const w0 = interpolateWeights(0);
    const w1 = interpolateWeights(1);
    const wMid = interpolateWeights(0.5);
    expect(w0.common).toBe(EARLY_WEIGHTS.common);
    expect(w1.common).toBe(LATE_WEIGHTS.common);
    expect(wMid.common).toBeCloseTo((EARLY_WEIGHTS.common + LATE_WEIGHTS.common) / 2);
  });

  it('applyCardEffect — damage_mul 누적', () => {
    const m = applyCardEffect(DEFAULT_RUN_MODIFIERS, 'damage_mul', 0.15);
    expect(m.damageMul).toBeCloseTo(1.15);
  });
});
