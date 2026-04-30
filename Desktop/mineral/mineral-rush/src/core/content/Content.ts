/**
 * Content — JSON 데이터 시트 → 타입 안전 콘텐츠 객체.
 *
 * 5계명 §1: 순수 로직. fetch 등 비동기 I/O는 platform / view에서 처리해 주입.
 * 5계명 §3: 콘텐츠는 빌드 시 한 번 로드 → 게임 중 readonly.
 *
 * Vite의 import.meta.glob 또는 정적 JSON import로 로드 (LoaderImpl 측에서 처리).
 */

import type { MineralId, PickaxeId, CardId, StageId } from '../../shared/ids.ts';
import { asMineralId, asPickaxeId, asCardId, asStageId } from '../../shared/ids.ts';
import type { CardRarity } from '../State.ts';

// ============================================================
// 콘텐츠 타입
// ============================================================

export type Locale = 'ko' | 'en';
export type LocalizedText = Record<Locale, string>;

export type MineralRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface MineralDef {
  id: MineralId;
  name: LocalizedText;
  rarity: MineralRarity;
  baseValue: number;
  color: string; // hex
  depthMin: number;
  depthMax: number;
  dropWeight: number; // 광맥 깊이 범위 내일 때 가중치
}

export interface PickaxeDef {
  id: PickaxeId;
  name: LocalizedText;
  damage: number;
  speed: number;
  range: number;
  comboBonus: number;
  unlockCost: number;
  description: LocalizedText;
}

export type CardEffect =
  | 'damage_mul'
  | 'combo_window_ms'
  | 'ore_value_mul'
  | 'drop_rate_mul'
  | 'combo_max_bonus';

export interface CardDef {
  id: CardId;
  name: LocalizedText;
  rarity: CardRarity;
  effect: CardEffect;
  magnitude: number;
  description: LocalizedText;
}

export interface StageDef {
  id: StageId;
  name: LocalizedText;
  depthRange: [number, number];
  biome: string;
  veinHpBase: number;
  veinHpPerDepth: number; // exponential base — depth N → veinHp = base × (perDepth^(N-1))
  description: LocalizedText;
}

// ============================================================
// Content 컨테이너 (불변 readonly)
// ============================================================

export interface Content {
  readonly minerals: ReadonlyMap<MineralId, MineralDef>;
  readonly pickaxes: ReadonlyMap<PickaxeId, PickaxeDef>;
  readonly cards: ReadonlyMap<CardId, CardDef>;
  readonly stages: ReadonlyMap<StageId, StageDef>;

  mineralsByDepth(depth: number): readonly MineralDef[];
  cardsByRarity(rarity: CardRarity): readonly CardDef[];
}

// ============================================================
// 빌드 / 검증
// ============================================================

interface RawMineral {
  id: string;
  name: LocalizedText;
  rarity: MineralRarity;
  baseValue: number;
  color: string;
  depthMin: number;
  depthMax: number;
  dropWeight: number;
}

interface RawPickaxe {
  id: string;
  name: LocalizedText;
  damage: number;
  speed: number;
  range: number;
  comboBonus: number;
  unlockCost: number;
  description: LocalizedText;
}

interface RawCard {
  id: string;
  name: LocalizedText;
  rarity: CardRarity;
  effect: CardEffect;
  magnitude: number;
  description: LocalizedText;
}

interface RawStage {
  id: string;
  name: LocalizedText;
  depthRange: [number, number];
  biome: string;
  veinHpBase: number;
  veinHpPerDepth: number;
  description: LocalizedText;
}

export interface ContentSources {
  minerals: { minerals: RawMineral[] };
  pickaxes: { pickaxes: RawPickaxe[] };
  cards: { cards: RawCard[] };
  stages: { stages: RawStage[] };
}

class ContentImpl implements Content {
  readonly minerals: ReadonlyMap<MineralId, MineralDef>;
  readonly pickaxes: ReadonlyMap<PickaxeId, PickaxeDef>;
  readonly cards: ReadonlyMap<CardId, CardDef>;
  readonly stages: ReadonlyMap<StageId, StageDef>;

  constructor(src: ContentSources) {
    this.minerals = new Map(
      src.minerals.minerals.map((m): [MineralId, MineralDef] => [
        asMineralId(m.id),
        { ...m, id: asMineralId(m.id) },
      ]),
    );
    this.pickaxes = new Map(
      src.pickaxes.pickaxes.map((p): [PickaxeId, PickaxeDef] => [
        asPickaxeId(p.id),
        { ...p, id: asPickaxeId(p.id) },
      ]),
    );
    this.cards = new Map(
      src.cards.cards.map((c): [CardId, CardDef] => [
        asCardId(c.id),
        { ...c, id: asCardId(c.id) },
      ]),
    );
    this.stages = new Map(
      src.stages.stages.map((s): [StageId, StageDef] => [
        asStageId(s.id),
        { ...s, id: asStageId(s.id) },
      ]),
    );
  }

  mineralsByDepth(depth: number): readonly MineralDef[] {
    const result: MineralDef[] = [];
    for (const m of this.minerals.values()) {
      if (depth >= m.depthMin && depth <= m.depthMax) result.push(m);
    }
    return result;
  }

  cardsByRarity(rarity: CardRarity): readonly CardDef[] {
    const result: CardDef[] = [];
    for (const c of this.cards.values()) {
      if (c.rarity === rarity) result.push(c);
    }
    return result;
  }
}

/** 콘텐츠 빌드 + 검증. 잘못된 데이터는 즉시 throw. */
export function buildContent(src: ContentSources): Content {
  validate(src);
  return new ContentImpl(src);
}

function validate(src: ContentSources): void {
  // 광물 ID 유니크
  const mineralIds = new Set<string>();
  for (const m of src.minerals.minerals) {
    if (mineralIds.has(m.id)) throw new Error(`Duplicate mineral id: ${m.id}`);
    mineralIds.add(m.id);
    if (m.depthMin > m.depthMax) throw new Error(`Mineral ${m.id}: depthMin > depthMax`);
    if (m.dropWeight < 0) throw new Error(`Mineral ${m.id}: negative dropWeight`);
    if (m.baseValue < 0) throw new Error(`Mineral ${m.id}: negative baseValue`);
  }
  // 곡괭이
  const pickaxeIds = new Set<string>();
  for (const p of src.pickaxes.pickaxes) {
    if (pickaxeIds.has(p.id)) throw new Error(`Duplicate pickaxe id: ${p.id}`);
    pickaxeIds.add(p.id);
    if (p.damage <= 0) throw new Error(`Pickaxe ${p.id}: non-positive damage`);
    if (p.speed <= 0) throw new Error(`Pickaxe ${p.id}: non-positive speed`);
  }
  // 카드
  const cardIds = new Set<string>();
  for (const c of src.cards.cards) {
    if (cardIds.has(c.id)) throw new Error(`Duplicate card id: ${c.id}`);
    cardIds.add(c.id);
    if (!Number.isFinite(c.magnitude)) throw new Error(`Card ${c.id}: invalid magnitude`);
  }
  // 스테이지
  const stageIds = new Set<string>();
  for (const s of src.stages.stages) {
    if (stageIds.has(s.id)) throw new Error(`Duplicate stage id: ${s.id}`);
    stageIds.add(s.id);
    if (s.depthRange[0] > s.depthRange[1]) throw new Error(`Stage ${s.id}: depthRange invalid`);
    if (s.veinHpBase <= 0) throw new Error(`Stage ${s.id}: non-positive veinHpBase`);
    if (s.veinHpPerDepth < 1) throw new Error(`Stage ${s.id}: veinHpPerDepth must be >= 1`);
  }
}
