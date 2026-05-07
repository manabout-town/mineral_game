#!/usr/bin/env tsx
/**
 * playtest-analyze — 플레이테스트 텔레메트리 분석 + Gate Check 자동 판정.
 *
 * 사용법:
 *   tsx tools/playtest-analyze.ts <exported_telemetry.json>
 *   tsx tools/playtest-analyze.ts ./telemetry1.json ./telemetry2.json  (복수 파일 합산)
 *
 * 출력:
 *   - 세션 요약 (테스터별)
 *   - 런 통계 (평균 시간, 광석 수집, 카드 픽)
 *   - 카드 픽률 분포
 *   - 이벤트 히트맵 (광맥 파괴 분포)
 *   - Gate Check 자동 판정 (PASS / FAIL)
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── 타입 (Telemetry.ts와 동기화) ────────────────────────────

interface TelemetryEvent {
  id: number;
  ts: number;
  name: string;
  props: Record<string, unknown>;
}

interface TelemetryMeta {
  sessionId: string;
  firstEventAt: number;
  lastEventAt: number;
  gameVersion: string;
  schemaVersion: number;
  device: { platform: string; language: string; deviceId: string };
}

interface TelemetryExport {
  meta: TelemetryMeta;
  events: TelemetryEvent[];
}

// ─── Gate Check 기준 ─────────────────────────────────────────

const GATE = {
  /** 평균 런 시간 (초) */
  minAvgRunSec: 60,
  /** 광석 0개 런의 최대 비율 */
  maxZeroOrePct: 0,
  /** 카드 픽 평균 개수 */
  minAvgCardsPicked: 1.5,
  /** 런 시작 이벤트가 있어야 할 최소 런 수 */
  minRuns: 3,
};

// ─── 분석 유틸 ──────────────────────────────────────────────

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function pct(n: number, total: number): string {
  if (!total) return '0.0%';
  return ((n / total) * 100).toFixed(1) + '%';
}

function fmtSec(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

function colorGreen(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function colorRed(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function colorYellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }
function colorCyan(s: string) { return `\x1b[36m${s}\x1b[0m`; }
function bold(s: string) { return `\x1b[1m${s}\x1b[0m`; }

function check(pass: boolean, label: string, detail: string) {
  const icon = pass ? colorGreen('✅') : colorRed('❌');
  console.log(`  ${icon} ${label}: ${pass ? colorGreen(detail) : colorRed(detail)}`);
  return pass;
}

// ─── 런 단위 파싱 ────────────────────────────────────────────

interface RunSummary {
  runId: string;
  durationSec: number;
  oresCollected: number;
  cardsPicked: number;
  veinsDestroyed: number;
  cardIds: string[];
  reason: string;
}

function extractRuns(events: TelemetryEvent[]): RunSummary[] {
  const runs: RunSummary[] = [];
  let current: Partial<RunSummary> | null = null;

  for (const e of events) {
    if (e.name === 'run_start') {
      current = {
        runId: (e.props['runId'] as string) ?? 'unknown',
        durationSec: 0,
        oresCollected: 0,
        cardsPicked: 0,
        veinsDestroyed: 0,
        cardIds: [],
        reason: 'unknown',
      };
    } else if (e.name === 'ore_collected' && current) {
      current.oresCollected = (current.oresCollected ?? 0) + ((e.props['amount'] as number) ?? 1);
    } else if (e.name === 'card_picked' && current) {
      current.cardsPicked = (current.cardsPicked ?? 0) + 1;
      const cardId = e.props['cardId'] as string;
      if (cardId) current.cardIds?.push(cardId);
    } else if (e.name === 'vein_destroyed' && current) {
      current.veinsDestroyed = (current.veinsDestroyed ?? 0) + 1;
    } else if (e.name === 'run_end' && current) {
      current.durationSec = ((e.props['durationMs'] as number) ?? 0) / 1000;
      current.reason = (e.props['reason'] as string) ?? 'unknown';
      runs.push(current as RunSummary);
      current = null;
    }
  }
  return runs;
}

// ─── 메인 분석 ───────────────────────────────────────────────

function analyzeFile(filepath: string): { meta: TelemetryMeta; runs: RunSummary[]; events: TelemetryEvent[] } | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filepath, 'utf-8');
  } catch {
    console.error(colorRed(`파일 읽기 실패: ${filepath}`));
    return null;
  }

  let data: TelemetryExport;
  try {
    data = JSON.parse(raw) as TelemetryExport;
  } catch {
    console.error(colorRed(`JSON 파싱 실패: ${filepath}`));
    return null;
  }

  if (!data.meta || !Array.isArray(data.events)) {
    console.error(colorRed(`유효하지 않은 텔레메트리 형식: ${filepath}`));
    return null;
  }

  return { meta: data.meta, runs: extractRuns(data.events), events: data.events };
}

// ─── 카드 픽률 집계 ─────────────────────────────────────────

function buildCardPickDist(runs: RunSummary[]): Map<string, number> {
  const dist = new Map<string, number>();
  for (const r of runs) {
    for (const c of r.cardIds) {
      dist.set(c, (dist.get(c) ?? 0) + 1);
    }
  }
  return dist;
}

// ─── 진입점 ─────────────────────────────────────────────────

const args = process.argv.slice(2);
if (!args.length) {
  console.log(`사용법: tsx tools/playtest-analyze.ts <telemetry.json> [파일2.json ...]`);
  process.exit(1);
}

console.log(bold(colorCyan('\n══════════════════════════════════════════════')));
console.log(bold(colorCyan('  Mineral Rush — Playtest Analyzer')));
console.log(bold(colorCyan('══════════════════════════════════════════════\n')));

const allRuns: RunSummary[] = [];
const sessions: Array<{ meta: TelemetryMeta; runs: RunSummary[] }> = [];

for (const filepath of args) {
  const abs = path.resolve(filepath);
  const result = analyzeFile(abs);
  if (!result) continue;

  const { meta, runs } = result;
  allRuns.push(...runs);
  sessions.push({ meta, runs });

  console.log(bold(`📁 ${path.basename(filepath)}`));
  console.log(`   세션 ID : ${meta.sessionId.slice(0, 12)}…`);
  console.log(`   버전    : ${meta.gameVersion} (schemaV${meta.schemaVersion})`);
  console.log(`   플랫폼  : ${meta.device.platform} · 언어 ${meta.device.language}`);
  console.log(`   런 수   : ${runs.length}회`);
  console.log(`   세션 시간: ${fmtSec(meta.lastEventAt - meta.firstEventAt)}\n`);
}

if (!allRuns.length) {
  console.log(colorYellow('분석할 런 데이터가 없습니다. 텔레메트리 파일에 run_start/run_end 이벤트가 있어야 합니다.'));
  process.exit(0);
}

// ─── 런 통계 ─────────────────────────────────────────────────

const totalRuns = allRuns.length;
const durations = allRuns.map((r) => r.durationSec);
const ores = allRuns.map((r) => r.oresCollected);
const cards = allRuns.map((r) => r.cardsPicked);
const veins = allRuns.map((r) => r.veinsDestroyed);
const zeroOreRuns = allRuns.filter((r) => r.oresCollected === 0).length;

const reasonCounts: Record<string, number> = {};
for (const r of allRuns) {
  reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
}

console.log(bold('─── 런 통계 ────────────────────────────────────'));
console.log(`  총 런 수        : ${totalRuns}회`);
console.log(`  평균 런 시간    : ${fmtSec(avg(durations) * 1000)}`);
console.log(`  최단 런         : ${fmtSec(Math.min(...durations) * 1000)}`);
console.log(`  최장 런         : ${fmtSec(Math.max(...durations) * 1000)}`);
console.log(`  평균 광석 수집  : ${avg(ores).toFixed(1)}개`);
console.log(`  평균 카드 픽    : ${avg(cards).toFixed(2)}개/런`);
console.log(`  평균 광맥 파괴  : ${avg(veins).toFixed(1)}개/런`);
console.log(`  광석 0개 런     : ${zeroOreRuns}회 (${pct(zeroOreRuns, totalRuns)})`);
console.log('');
console.log('  종료 이유 분포:');
for (const [reason, count] of Object.entries(reasonCounts)) {
  console.log(`    ${reason.padEnd(10)}: ${count}회 (${pct(count, totalRuns)})`);
}
console.log('');

// ─── 카드 픽률 ───────────────────────────────────────────────

const cardDist = buildCardPickDist(allRuns);
if (cardDist.size > 0) {
  const totalCardPicks = [...cardDist.values()].reduce((s, v) => s + v, 0);
  const sorted = [...cardDist.entries()].sort((a, b) => b[1] - a[1]);

  console.log(bold('─── 카드 픽률 TOP 10 ──────────────────────────'));
  for (const [cardId, count] of sorted.slice(0, 10)) {
    const bar = '█'.repeat(Math.round((count / (sorted[0]![1])) * 20));
    console.log(`  ${cardId.padEnd(28)} ${bar} ${pct(count, totalCardPicks)} (${count}회)`);
  }
  console.log('');
}

// ─── Gate Check ──────────────────────────────────────────────

console.log(bold('─── Gate Check ─────────────────────────────────'));
const avgRunSec = avg(durations);
const avgCardsPicked = avg(cards);
const zeroOrePct = (zeroOreRuns / totalRuns) * 100;

const results = [
  check(totalRuns >= GATE.minRuns,          '최소 런 수',         `${totalRuns}회 (기준: ${GATE.minRuns}회 이상)`),
  check(avgRunSec >= GATE.minAvgRunSec,     '평균 런 시간',       `${avgRunSec.toFixed(1)}초 (기준: ${GATE.minAvgRunSec}초 이상)`),
  check(zeroOrePct <= GATE.maxZeroOrePct,   '광석 0개 런',        `${zeroOrePct.toFixed(1)}% (기준: ${GATE.maxZeroOrePct}% 이하)`),
  check(avgCardsPicked >= GATE.minAvgCardsPicked, '평균 카드 픽',  `${avgCardsPicked.toFixed(2)}개 (기준: ${GATE.minAvgCardsPicked}개 이상)`),
];

console.log('');
const pass = results.every(Boolean);
if (pass) {
  console.log(bold(colorGreen('🎉 Gate Check PASS — 플레이테스터 배포 준비 완료!')));
} else {
  const failed = results.filter((r) => !r).length;
  console.log(bold(colorRed(`❌ Gate Check FAIL — ${failed}개 항목 미달. 수정 후 재확인 필요.`)));
}
console.log(bold(colorCyan('\n══════════════════════════════════════════════\n')));

process.exit(pass ? 0 : 1);
