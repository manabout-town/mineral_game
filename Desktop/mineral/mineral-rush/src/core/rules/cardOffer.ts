/**
 * Card Offer — 카드 추첨.
 *
 * 5계명 §1 Pure Logic First. 결정론적.
 *
 * 등급별 가중치는 런 진행도(veinsDestroyed)에 따라 점진 변화:
 *   - 초반: common 60% / rare 30% / epic 9% / legendary 1%
 *   - 후반: common 30% / rare 40% / epic 25% / legendary 5%
 */

import type { Content, CardDef } from '../content/Content.ts';
import type { Mulberry32 } from '../../shared/SeededRandom.ts';
import type { CardRarity } from '../State.ts';
import type { CardId } from '../../shared/ids.ts';

const RARITIES: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface RarityWeights {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
}

export const EARLY_WEIGHTS: RarityWeights = { common: 60, rare: 30, epic: 9, legendary: 1 };
export const LATE_WEIGHTS: RarityWeights = { common: 30, rare: 40, epic: 25, legendary: 5 };

/**
 * 진행도(0..1)에 따라 EARLY → LATE 선형 보간.
 * Phase 2 분량은 common/rare만 존재 → epic/legendary 가중치는 사실상 0이지만 인프라는 미리 준비.
 */
export function interpolateWeights(progress: number): RarityWeights {
  const p = Math.max(0, Math.min(1, progress));
  return {
    common: EARLY_WEIGHTS.common + (LATE_WEIGHTS.common - EARLY_WEIGHTS.common) * p,
    rare: EARLY_WEIGHTS.rare + (LATE_WEIGHTS.rare - EARLY_WEIGHTS.rare) * p,
    epic: EARLY_WEIGHTS.epic + (LATE_WEIGHTS.epic - EARLY_WEIGHTS.epic) * p,
    legendary:
      EARLY_WEIGHTS.legendary + (LATE_WEIGHTS.legendary - EARLY_WEIGHTS.legendary) * p,
  };
}

/** 진행도 0..1 산출. 기본: 부순 광맥 수 / 5 */
export function progressFromVeinsDestroyed(veinsDestroyed: number): number {
  return Math.max(0, Math.min(1, veinsDestroyed / 5));
}

export interface CardOfferResult {
  cards: Array<{ cardId: CardId; rarity: CardRarity }>;
  rerollCost: number;
}

/**
 * 카드 3장 추첨. 중복 방지 (이미 픽한 카드 제외 + 같은 오퍼 안에서 중복 제외).
 */
export function rollCardOffer(
  content: Content,
  rng: Mulberry32,
  options: {
    /** 이미 런에서 픽한 카드들 */
    pickedCardIds: ReadonlyArray<CardId>;
    /** 0..1 — 후반일수록 좋은 등급 */
    progress: number;
    /** 보통 3장 */
    count: number;
    /** 다음 리롤 비용 (메타 화폐) */
    rerollCost: number;
  },
): CardOfferResult {
  const weights = interpolateWeights(options.progress);
  const offered = new Set<string>();
  const cards: Array<{ cardId: CardId; rarity: CardRarity }> = [];

  for (let i = 0; i < options.count; i++) {
    const card = rollOne(content, rng, weights, options.pickedCardIds, offered);
    if (!card) break;
    offered.add(card.cardId as string);
    cards.push(card);
  }

  return { cards, rerollCost: options.rerollCost };
}

function rollOne(
  content: Content,
  rng: Mulberry32,
  weights: RarityWeights,
  pickedCardIds: ReadonlyArray<CardId>,
  offered: ReadonlySet<string>,
): { cardId: CardId; rarity: CardRarity } | null {
  // 1. 등급 추첨
  const rarityWeights = RARITIES.map((r) => weights[r]);
  let rarity: CardRarity;
  let pool: readonly CardDef[];

  // 추첨 가능한 등급 후보 (해당 등급에 카드가 존재하고, 픽되지 않은 것이 있는 것)
  // 실패 시 다른 등급으로 fallback
  const tries: CardRarity[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    tries.push(rng.pickWeighted(RARITIES, rarityWeights));
  }
  // 우선 추첨된 등급부터 시도, 후보 없으면 다른 등급으로
  rarity = tries[0]!;
  pool = content.cardsByRarity(rarity);
  if (!pickableExists(pool, pickedCardIds, offered)) {
    for (const r of RARITIES) {
      const p = content.cardsByRarity(r);
      if (pickableExists(p, pickedCardIds, offered)) {
        rarity = r;
        pool = p;
        break;
      }
    }
  }

  // 2. 카드 추첨
  const candidates = pool.filter(
    (c) => !pickedCardIds.includes(c.id) && !offered.has(c.id as string),
  );
  if (candidates.length === 0) return null;
  const ids = candidates.map((c) => c.id);
  const ws = candidates.map(() => 1); // 등급 내 균등
  const cardId = rng.pickWeighted(ids, ws);
  return { cardId, rarity };
}

function pickableExists(
  pool: readonly CardDef[],
  pickedCardIds: ReadonlyArray<CardId>,
  offered: ReadonlySet<string>,
): boolean {
  return pool.some((c) => !pickedCardIds.includes(c.id) && !offered.has(c.id as string));
}

/**
 * 카드 효과를 RunModifiers에 적용.
 */
import type { CardEffect } from '../content/Content.ts';
import type { RunModifiers } from '../State.ts';

export function applyCardEffect(
  current: RunModifiers,
  effect: CardEffect,
  magnitude: number,
): RunModifiers {
  switch (effect) {
    case 'damage_mul':
      return { ...current, damageMul: current.damageMul + magnitude };
    case 'combo_window_ms':
      return { ...current, comboWindowMs: current.comboWindowMs + magnitude };
    case 'ore_value_mul':
      return { ...current, oreValueMul: current.oreValueMul + magnitude };
    case 'drop_rate_mul':
      return { ...current, dropRateMul: current.dropRateMul + magnitude };
    case 'combo_max_bonus':
      return { ...current, comboMaxBonus: current.comboMaxBonus + magnitude };
    default: {
      const _exhaustive: never = effect;
      void _exhaustive;
      return current;
    }
  }
}
