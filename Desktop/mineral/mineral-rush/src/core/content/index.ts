/**
 * Content 단일 인스턴스 export.
 *
 * 5계명 §3 No Hidden State — content는 불변. 한 번 로드되면 절대 변경 안 됨.
 *
 * Vite의 정적 JSON import. 빌드 시 데이터가 번들에 포함됨.
 * Phase 4+ Remote Config로 교체 시: 동일 ContentSources 인터페이스를 만족하는
 *   원격 fetch 결과를 buildContent(...)로 감싸기만 하면 됨.
 */

import { buildContent, type Content, type ContentSources } from './Content.ts';

import mineralsJson from '../../../data/minerals.json';
import pickaxesJson from '../../../data/pickaxes.json';
import cardsJson from '../../../data/cards.json';
import stagesJson from '../../../data/stages.json';

const sources: ContentSources = {
  minerals: mineralsJson as ContentSources['minerals'],
  pickaxes: pickaxesJson as ContentSources['pickaxes'],
  cards: cardsJson as ContentSources['cards'],
  stages: stagesJson as ContentSources['stages'],
};

export const content: Content = buildContent(sources);

export type {
  Content,
  ContentSources,
  MineralDef,
  PickaxeDef,
  CardDef,
  StageDef,
  CardEffect,
  MineralRarity,
} from './Content.ts';
