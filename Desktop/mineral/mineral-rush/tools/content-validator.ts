/**
 * tools/content-validator.ts — JSON 데이터 시트 통합 검증.
 *
 * 빌드 시 (CI) 실행하여 잘못된 데이터를 사전 차단.
 * 주요 검증:
 *   1. id 유니크
 *   2. 외래 키 무결성 (skill_nodes.prerequisites → 존재하는 노드)
 *   3. 밸런스 곡선 이상치 (음수 비용/데미지, 곡선 역전)
 *   4. depth 범위 충돌 / 누락
 *   5. localized text 누락
 *
 * 사용:
 *   npm run validate-content
 *   exit 0 → 통과 / exit 1 → 실패
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data');

interface LocalizedText {
  ko: string;
  en: string;
}

interface MineralRow {
  id: string;
  name: LocalizedText;
  rarity: string;
  baseValue: number;
  color: string;
  depthMin: number;
  depthMax: number;
  dropWeight: number;
}

interface PickaxeRow {
  id: string;
  name: LocalizedText;
  damage: number;
  speed: number;
  range: number;
  comboBonus: number;
  unlockCost: number;
  description: LocalizedText;
}

interface CardRow {
  id: string;
  name: LocalizedText;
  rarity: string;
  effect: string;
  magnitude: number;
  description: LocalizedText;
}

interface StageRow {
  id: string;
  name: LocalizedText;
  depthRange: [number, number];
  biome: string;
  veinHpBase: number;
  veinHpPerDepth: number;
  description: LocalizedText;
}

interface SkillNodeRow {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  branch: string;
  prerequisites: string[];
  baseCost: number;
  costMul: number;
  maxLevel: number;
  effect: { kind: string; magnitudePerLevel: number };
  position: { x: number; y: number };
}

const ALLOWED_MINERAL_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);
const ALLOWED_CARD_RARITIES = new Set(['common', 'rare', 'epic', 'legendary']);
const ALLOWED_CARD_EFFECTS = new Set([
  'damage_mul',
  'combo_window_ms',
  'ore_value_mul',
  'drop_rate_mul',
  'combo_max_bonus',
]);
const ALLOWED_SKILL_BRANCHES = new Set([
  'pickaxe',
  'ore_value',
  'combo',
  'drop',
  'crystal',
  'meta',
]);
const ALLOWED_SKILL_EFFECT_KINDS = new Set([
  'damage_mul',
  'combo_window_ms',
  'starting_combo_window_ms',
  'ore_value_mul',
  'drop_rate_mul',
  'combo_max_bonus',
  'crystal_run_bonus',
]);

function loadJson<T>(file: string): T {
  const raw = readFileSync(resolve(DATA_DIR, file), 'utf-8');
  return JSON.parse(raw) as T;
}

function checkLocalized(prefix: string, l: unknown, errs: string[]): void {
  if (!l || typeof l !== 'object') {
    errs.push(`${prefix}: localized text missing`);
    return;
  }
  const obj = l as Partial<LocalizedText>;
  if (!obj.ko || obj.ko.length === 0) errs.push(`${prefix}: ko missing/empty`);
  if (!obj.en || obj.en.length === 0) errs.push(`${prefix}: en missing/empty`);
}

function validateUniqueIds(rows: { id: string }[], kind: string, errs: string[]): void {
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.id)) errs.push(`${kind}: duplicate id ${r.id}`);
    seen.add(r.id);
    if (!r.id.match(/^[a-z0-9_]+$/)) {
      errs.push(`${kind}.${r.id}: id must match [a-z0-9_]+`);
    }
  }
}

function validateMinerals(errs: string[]): void {
  const data = loadJson<{ minerals: MineralRow[] }>('minerals.json');
  validateUniqueIds(data.minerals, 'minerals', errs);
  for (const m of data.minerals) {
    checkLocalized(`minerals.${m.id}.name`, m.name, errs);
    if (!ALLOWED_MINERAL_RARITIES.has(m.rarity))
      errs.push(`minerals.${m.id}: rarity '${m.rarity}' not allowed`);
    if (m.baseValue <= 0) errs.push(`minerals.${m.id}: baseValue must be > 0`);
    if (m.dropWeight < 0) errs.push(`minerals.${m.id}: dropWeight must be >= 0`);
    if (m.depthMin < 1) errs.push(`minerals.${m.id}: depthMin must be >= 1`);
    if (m.depthMin > m.depthMax)
      errs.push(`minerals.${m.id}: depthMin > depthMax`);
    if (!m.color.match(/^#[0-9a-fA-F]{6}$/)) errs.push(`minerals.${m.id}: invalid color hex`);
  }
  // 깊이 1 보장 — 항상 적어도 1종이 깊이 1에 드랍 가능
  const depth1 = data.minerals.filter((m) => m.depthMin <= 1);
  if (depth1.length === 0) errs.push('minerals: no mineral covers depth 1 (newbie blocker)');
}

function validatePickaxes(errs: string[]): void {
  const data = loadJson<{ pickaxes: PickaxeRow[] }>('pickaxes.json');
  validateUniqueIds(data.pickaxes, 'pickaxes', errs);
  let prevDamage = 0;
  for (const p of data.pickaxes) {
    checkLocalized(`pickaxes.${p.id}.name`, p.name, errs);
    checkLocalized(`pickaxes.${p.id}.description`, p.description, errs);
    if (p.damage <= 0) errs.push(`pickaxes.${p.id}: damage must be > 0`);
    if (p.speed <= 0) errs.push(`pickaxes.${p.id}: speed must be > 0`);
    if (p.range <= 0) errs.push(`pickaxes.${p.id}: range must be > 0`);
    if (p.unlockCost < 0) errs.push(`pickaxes.${p.id}: unlockCost must be >= 0`);
    if (p.comboBonus < 0) errs.push(`pickaxes.${p.id}: comboBonus must be >= 0`);
    if (p.damage < prevDamage) {
      errs.push(`pickaxes.${p.id}: damage curve regressed (${p.damage} < ${prevDamage})`);
    }
    prevDamage = p.damage;
  }
  // 첫 곡괭이는 unlockCost=0
  const first = data.pickaxes[0];
  if (first && first.unlockCost !== 0)
    errs.push(`pickaxes.${first.id}: first pickaxe must have unlockCost=0`);
}

function validateCards(errs: string[]): void {
  const data = loadJson<{ cards: CardRow[] }>('cards.json');
  validateUniqueIds(data.cards, 'cards', errs);
  for (const c of data.cards) {
    checkLocalized(`cards.${c.id}.name`, c.name, errs);
    checkLocalized(`cards.${c.id}.description`, c.description, errs);
    if (!ALLOWED_CARD_RARITIES.has(c.rarity))
      errs.push(`cards.${c.id}: rarity '${c.rarity}' not allowed`);
    if (!ALLOWED_CARD_EFFECTS.has(c.effect))
      errs.push(`cards.${c.id}: effect '${c.effect}' not allowed`);
    if (!Number.isFinite(c.magnitude))
      errs.push(`cards.${c.id}: magnitude not finite`);
    if (c.magnitude <= 0) errs.push(`cards.${c.id}: magnitude must be > 0`);
  }
  // 카드 가중치 검사 — 각 effect 종류별로 적어도 1장의 common 카드가 있어야 함
  for (const eff of ALLOWED_CARD_EFFECTS) {
    const hasCommon = data.cards.some((c) => c.effect === eff && c.rarity === 'common');
    if (!hasCommon) errs.push(`cards: no common card for effect '${eff}' (early game blocker)`);
  }
}

function validateStages(errs: string[]): void {
  const data = loadJson<{ stages: StageRow[] }>('stages.json');
  validateUniqueIds(data.stages, 'stages', errs);
  // 깊이 범위 정렬 + 끊김 없음
  const sorted = [...data.stages].sort((a, b) => a.depthRange[0] - b.depthRange[0]);
  let prevMax = 0;
  for (const s of sorted) {
    checkLocalized(`stages.${s.id}.name`, s.name, errs);
    checkLocalized(`stages.${s.id}.description`, s.description, errs);
    if (s.veinHpBase <= 0) errs.push(`stages.${s.id}: veinHpBase must be > 0`);
    if (s.veinHpPerDepth < 1)
      errs.push(`stages.${s.id}: veinHpPerDepth must be >= 1 (no shrinking)`);
    if (s.depthRange[0] > s.depthRange[1])
      errs.push(`stages.${s.id}: depthRange invalid`);
    // 첫 스테이지는 depth 1부터
    if (sorted[0]?.id === s.id && s.depthRange[0] !== 1) {
      errs.push(`stages.${s.id}: first stage must start at depth 1`);
    } else if (s.depthRange[0] !== prevMax + 1) {
      errs.push(
        `stages.${s.id}: depthRange[0]=${s.depthRange[0]} not contiguous with previous max ${prevMax}`,
      );
    }
    prevMax = s.depthRange[1];
  }
}

function validateSkillNodes(errs: string[]): void {
  const data = loadJson<{ nodes: SkillNodeRow[] }>('skill_nodes.json');
  validateUniqueIds(data.nodes, 'skill_nodes', errs);
  const idSet = new Set(data.nodes.map((n) => n.id));
  for (const n of data.nodes) {
    checkLocalized(`skill_nodes.${n.id}.name`, n.name, errs);
    checkLocalized(`skill_nodes.${n.id}.description`, n.description, errs);
    if (!ALLOWED_SKILL_BRANCHES.has(n.branch))
      errs.push(`skill_nodes.${n.id}: branch '${n.branch}' not allowed`);
    if (!ALLOWED_SKILL_EFFECT_KINDS.has(n.effect.kind))
      errs.push(`skill_nodes.${n.id}: effect.kind '${n.effect.kind}' not allowed`);
    if (n.baseCost <= 0) errs.push(`skill_nodes.${n.id}: baseCost must be > 0`);
    if (n.costMul < 1) errs.push(`skill_nodes.${n.id}: costMul must be >= 1`);
    if (n.maxLevel < 1) errs.push(`skill_nodes.${n.id}: maxLevel must be >= 1`);
    if (!Number.isFinite(n.effect.magnitudePerLevel))
      errs.push(`skill_nodes.${n.id}: effect.magnitudePerLevel not finite`);
    if (n.position.x < 0 || n.position.x > 1 || n.position.y < 0 || n.position.y > 1) {
      errs.push(`skill_nodes.${n.id}: position must be in [0..1]`);
    }
    for (const pre of n.prerequisites) {
      if (pre === n.id) errs.push(`skill_nodes.${n.id}: self-prerequisite`);
      if (!idSet.has(pre))
        errs.push(`skill_nodes.${n.id}: prerequisite '${pre}' not found`);
    }
  }
  // 사이클 검출 (간단한 DFS)
  const adj = new Map<string, string[]>();
  for (const n of data.nodes) adj.set(n.id, n.prerequisites);
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  for (const id of idSet) color.set(id, WHITE);
  function dfs(id: string, path: string[]): boolean {
    color.set(id, GRAY);
    for (const dep of adj.get(id) ?? []) {
      const c = color.get(dep);
      if (c === GRAY) {
        errs.push(`skill_nodes: cycle detected ${[...path, id, dep].join(' -> ')}`);
        return true;
      }
      if (c === WHITE && dfs(dep, [...path, id])) return true;
    }
    color.set(id, BLACK);
    return false;
  }
  for (const id of idSet) if (color.get(id) === WHITE) dfs(id, []);
}

function main(): void {
  const errs: string[] = [];
  console.log('=== Mineral Rush content-validator ===');

  try {
    validateMinerals(errs);
  } catch (e) {
    errs.push(`minerals.json: ${(e as Error).message}`);
  }
  try {
    validatePickaxes(errs);
  } catch (e) {
    errs.push(`pickaxes.json: ${(e as Error).message}`);
  }
  try {
    validateCards(errs);
  } catch (e) {
    errs.push(`cards.json: ${(e as Error).message}`);
  }
  try {
    validateStages(errs);
  } catch (e) {
    errs.push(`stages.json: ${(e as Error).message}`);
  }
  try {
    validateSkillNodes(errs);
  } catch (e) {
    errs.push(`skill_nodes.json: ${(e as Error).message}`);
  }

  if (errs.length === 0) {
    console.log('PASS — content data integrity OK');
    process.exit(0);
  }
  console.error(`FAIL — ${errs.length} error(s):`);
  for (const e of errs) console.error('  ' + e);
  process.exit(1);
}

main();
