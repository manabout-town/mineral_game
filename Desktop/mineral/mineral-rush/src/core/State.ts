/**
 * Mineral Rush — Core GameState
 *
 * UNIVERSAL_GAME_FRAMEWORK §1.1 Core State (데이터 중심):
 *  - 게임의 모든 상태를 단일 객체에 담는다.
 *  - 데이터 변경은 reducer를 통해서만. 직접 mutation 금지.
 *  - schemaVersion 필드는 마이그레이션 안전망 — 절대 누락 금지.
 *
 * Phase 1 Skeleton 단계: 최소 구조만 정의. Phase 2~3에서 확장.
 */

import type { MineralId, PickaxeId, CardId, SkillNodeId, RunId, PlayerId, StageId } from '../shared/ids.ts';
import type { Seed, GameTimeMs } from '../shared/types.ts';

// ============================================================
// 최상위 GameState
// ============================================================

export interface GameState {
  /** 마이그레이션 버전. 절대 누락 금지 */
  schemaVersion: number;
  /** 마지막 저장 시각 (epoch ms) */
  updatedAt: number;
  /** 메타 진행 (영구) */
  meta: MetaState;
  /** 현재 런 상태. 런 종료 시 null */
  run: RunState | null;
  /** 플레이어 식별 */
  player: PlayerState;
  /** 화폐 잔액 */
  economy: EconomyState;
  /** 설정 */
  settings: SettingsState;
}

// ============================================================
// MetaState — 영구 진행
// ============================================================

export interface MetaState {
  skillTree: Record<SkillNodeId, SkillNodeState>;
  unlockedPickaxes: PickaxeId[];
  unlockedMinerals: MineralId[];
  unlockedStages: StageId[];
  prestige: number;
  stats: LifetimeStats;
}

export interface SkillNodeState {
  level: number;
  unlocked: boolean;
}

export interface LifetimeStats {
  totalRuns: number;
  totalOresMined: number;
  bestRunScore: number;
  totalPlayTimeMs: number;
}

// ============================================================
// RunState — 런 중에만 존재
// ============================================================

export interface RunState {
  runId: RunId;
  /** 결정론적 RNG seed — 서버 리플레이 검증용 */
  seed: Seed;
  /** RNG 현재 state — 직렬화 가능 (Mulberry32.getState) */
  rngState: number;
  startedAt: number; // epoch ms
  duration: number; // ms
  remaining: number; // ms
  /** 현재 깊이 층. 광물 게임 차별화 포인트 */
  depth: number;
  stageId: StageId;
  pickaxe: PickaxeStats;
  /** 현재 광맥 — 쪼개면 다음 광맥 자동 생성 */
  vein: VeinState;
  /** 누적 부순 광맥 수 */
  veinsDestroyed: number;
  /** 런 중 선택된 카드들 */
  cards: ActiveCard[];
  /** 카드 효과 누적값 — 매 카드 픽 시 재계산 */
  modifiers: RunModifiers;
  /** 현재 카드 선택지 (있을 때만) */
  cardOffer: CardOffer | null;
  combo: number;
  /** 콤보 만료 시각 — 절대 게임시간(ms). null이면 비활성. */
  comboExpiresAt: GameTimeMs | null;
  oresCollected: Record<MineralId, number>;
  damageDealt: number;
  /** 액션 리플레이 — 안티치트 + 디버그 (5계명 §5 Traceable) */
  events: GameEvent[];
  /** 종료 후 결과 화면 데이터 (RUN_END 액션이 채움) */
  finished: RunFinishedSummary | null;
}

export interface VeinState {
  veinIndex: number;
  hp: number;
  maxHp: number;
  /** 광맥별로 결정된 광물 풀 — 같은 광맥 안에서는 동일 분포 */
  mineralPool: Array<{ mineralId: MineralId; weight: number }>;
}

export interface RunModifiers {
  /** 곡괭이 데미지 곱연산 (1.0 + sum) */
  damageMul: number;
  /** 콤보 유지 시간(ms) */
  comboWindowMs: number;
  /** 광석 가치 곱연산 */
  oreValueMul: number;
  /** 드랍률 곱연산 */
  dropRateMul: number;
  /** 콤보 1당 추가 데미지 비율 */
  comboMaxBonus: number;
}

export const DEFAULT_RUN_MODIFIERS: RunModifiers = {
  damageMul: 1,
  comboWindowMs: 1500,
  oreValueMul: 1,
  dropRateMul: 1,
  comboMaxBonus: 0,
};

export interface RunFinishedSummary {
  endedAt: number;
  reason: 'timeout' | 'quit' | 'death';
  oresCollected: Record<MineralId, number>;
  veinsDestroyed: number;
  cardsPicked: number;
  /** 메타 화폐로 환산된 광석 (실제 지급은 META_RUN_REWARD에서) */
  rewardOres: Record<MineralId, number>;
}

export interface PickaxeStats {
  pickaxeId: PickaxeId;
  damage: number;
  speed: number; // 초당 타격 가능 횟수
  range: number; // 픽셀 또는 논리 단위
  comboBonus: number;
}

export interface ActiveCard {
  cardId: CardId;
  pickedAt: GameTimeMs;
}

export interface CardOffer {
  generatedAt: GameTimeMs;
  cards: CardOfferEntry[];
  rerollCost: number;
}

export interface CardOfferEntry {
  cardId: CardId;
  rarity: CardRarity;
}

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

/**
 * GameEvent — 런 중 발생한 모든 일을 기록.
 * 서버에서 reducer를 동일하게 돌려 화폐 정산을 재계산하기 위한 원천 데이터.
 */
export type GameEvent =
  | { type: 'mine_hit'; t: GameTimeMs; x: number; y: number; damage: number; combo: number }
  | { type: 'ore_collected'; t: GameTimeMs; mineralId: MineralId; amount: number }
  | { type: 'vein_destroyed'; t: GameTimeMs; veinIndex: number }
  | { type: 'card_offer_generated'; t: GameTimeMs; cardIds: CardId[] }
  | { type: 'card_picked'; t: GameTimeMs; cardId: CardId }
  | { type: 'card_rerolled'; t: GameTimeMs }
  | { type: 'combo_break'; t: GameTimeMs }
  | { type: 'depth_advance'; t: GameTimeMs; newDepth: number };

// ============================================================
// Player / Economy / Settings
// ============================================================

export interface PlayerState {
  playerId: PlayerId;
  /** Supabase auth 연동 시 사용 */
  supabaseUserId: string | null;
  createdAt: number;
}

export interface EconomyState {
  /** 광석별 잔액 (소프트 화폐) */
  ores: Record<MineralId, number>;
  /** 크리스탈 (하드 화폐) */
  crystals: number;
}

export interface SettingsState {
  audio: { master: number; sfx: number; bgm: number };
  haptic: boolean;
  language: string; // 'ko', 'en' ...
  reducedMotion: boolean;
}

// ============================================================
// 초기 상태 팩토리
// ============================================================

import { SCHEMA_VERSION } from '../shared/constants.ts';
import { asPlayerId } from '../shared/ids.ts';

export function createInitialState(playerId: string = 'local-dev', now: number = Date.now()): GameState {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    meta: {
      skillTree: {},
      unlockedPickaxes: [],
      unlockedMinerals: [],
      unlockedStages: [],
      prestige: 0,
      stats: {
        totalRuns: 0,
        totalOresMined: 0,
        bestRunScore: 0,
        totalPlayTimeMs: 0,
      },
    },
    run: null,
    player: {
      playerId: asPlayerId(playerId),
      supabaseUserId: null,
      createdAt: now,
    },
    economy: {
      ores: {},
      crystals: 0,
    },
    settings: {
      audio: { master: 1, sfx: 1, bgm: 0.7 },
      haptic: true,
      language: 'ko',
      reducedMotion: false,
    },
  };
}
