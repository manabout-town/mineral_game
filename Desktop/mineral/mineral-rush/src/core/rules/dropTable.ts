/**
 * Drop Table — 광물 드랍 결정.
 *
 * 5계명 §1 Pure Logic First. 결정론적.
 *
 * 광맥 시작 시 한 번 mineralPool을 결정 (현재 깊이 범위 내 광물들 + 가중치).
 * 채굴 타격 시 dropRateMul 확률 검사 → 통과 시 mineralPool에서 가중 추첨 → amount 1~3.
 */

import type { Content, MineralDef } from '../content/Content.ts';
import type { Mulberry32 } from '../../shared/SeededRandom.ts';
import type { MineralId } from '../../shared/ids.ts';

export interface MineralPoolEntry {
  mineralId: MineralId;
  weight: number;
}

export function buildMineralPool(content: Content, depth: number): MineralPoolEntry[] {
  const candidates: MineralDef[] = [...content.mineralsByDepth(depth)];
  if (candidates.length === 0) return [];
  return candidates.map((m) => ({ mineralId: m.id, weight: m.dropWeight }));
}

export interface DropResult {
  mineralId: MineralId;
  amount: number;
  /** 가치(메타 보상 환산용) — economyReducer에서 곱연산 */
  unitValue: number;
}

/**
 * 광물 드랍 시도. 드랍 안 하면 null.
 *
 * @param baseDropChance 기본 드랍 확률 (Phase 2: 0.35로 시작)
 * @param dropRateMul 카드 효과로 곱해지는 드랍률 배수
 */
export function tryDrop(
  pool: readonly MineralPoolEntry[],
  content: Content,
  rng: Mulberry32,
  baseDropChance: number,
  dropRateMul: number,
): DropResult | null {
  if (pool.length === 0) return null;
  const chance = Math.min(1, Math.max(0, baseDropChance * dropRateMul));
  if (rng.next() >= chance) return null;

  const items = pool.map((p) => p.mineralId);
  const weights = pool.map((p) => p.weight);
  const mineralId = rng.pickWeighted(items, weights);
  // 1~3개 (가중: 1=70%, 2=25%, 3=5%)
  const amountRoll = rng.next();
  const amount = amountRoll < 0.7 ? 1 : amountRoll < 0.95 ? 2 : 3;
  const def = content.minerals.get(mineralId);
  const unitValue = def?.baseValue ?? 1;
  return { mineralId, amount, unitValue };
}

export const BASE_DROP_CHANCE = 0.35;
