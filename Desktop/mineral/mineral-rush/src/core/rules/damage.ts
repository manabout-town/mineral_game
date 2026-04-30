/**
 * Damage Formula — 데미지 계산 순수 함수.
 *
 * 5계명 §1 Pure Logic First. 서버 검증과 동일.
 *
 * 공식:
 *   base = pickaxe.damage
 *   combo_factor = 1 + comboMaxBonus × combo
 *   final = base × damageMul × combo_factor
 */

import type { PickaxeStats, RunModifiers } from '../State.ts';

export interface DamageInput {
  pickaxe: PickaxeStats;
  modifiers: RunModifiers;
  combo: number;
}

export interface DamageBreakdown {
  base: number;
  damageMul: number;
  comboFactor: number;
  final: number;
}

export function computeDamage(input: DamageInput): DamageBreakdown {
  const base = input.pickaxe.damage;
  const damageMul = Math.max(0, input.modifiers.damageMul);
  const comboFactor = 1 + Math.max(0, input.modifiers.comboMaxBonus) * Math.max(0, input.combo);
  const final = base * damageMul * comboFactor;
  return { base, damageMul, comboFactor, final };
}
