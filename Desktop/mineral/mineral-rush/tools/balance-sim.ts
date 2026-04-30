/**
 * Balance Simulator — 1000런 자동 시뮬레이션 봇.
 *
 * 사용:
 *   npx tsx tools/balance-sim.ts
 *   npx tsx tools/balance-sim.ts --runs 5000 --depth 1 --tps 5
 *
 * 출력:
 *   - 평균 광석 획득량 (광물별)
 *   - 평균 부순 광맥 수
 *   - 평균 누적 데미지
 *   - 카드 픽률
 *   - 평균 결과 가치 (총 베이스 가치 합산)
 *
 * 봇은 매 런 시작 → tick + 일정 간격 MINE_HIT → 카드 오퍼 뜨면 첫 번째 자동 픽 → 30초 후 종료.
 *
 * Node 환경에서 실행 (Vite 의존성 import 없음 — 순수 core/systems만 사용).
 */

import { createInitialState, type GameState } from '../src/core/State.ts';
import { rootReducer } from '../src/core/reducers/index.ts';
import type { Action } from '../src/core/Actions.ts';
import { asRunId, asStageId } from '../src/shared/ids.ts';
import { asGameTimeMs } from '../src/core/reducers/runReducer.ts';
import { content } from '../src/core/content/index.ts';

interface SimOptions {
  runs: number;
  depth: number;
  /** 봇이 초당 몇 번 탭하는지 (1~25). 인간 평균 5~8 */
  tps: number;
  /** 카드를 픽할지 (false면 무시) */
  pickCards: boolean;
  durationMs: number;
}

interface RunReport {
  veinsDestroyed: number;
  damageDealt: number;
  oresCollected: Record<string, number>;
  cardsPicked: string[];
  totalValue: number;
  hitCount: number;
}

function parseArgs(): SimOptions {
  const args = process.argv.slice(2);
  const get = (k: string, dflt: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] ?? dflt : dflt;
  };
  return {
    runs: parseInt(get('runs', '1000')),
    depth: parseInt(get('depth', '1')),
    tps: parseFloat(get('tps', '6')),
    pickCards: get('pickCards', 'true') !== 'false',
    durationMs: parseInt(get('duration', '30000')),
  };
}

function simulateOne(seed: number, opts: SimOptions): RunReport {
  let state = createInitialState('sim-bot', 1_700_000_000_000);
  state = rootReducer(state, {
    type: 'RUN_START',
    payload: {
      runId: asRunId(`sim-${seed}`),
      seed,
      stageId: asStageId('open_pit'),
      depth: opts.depth,
      durationMs: opts.durationMs,
      now: 1_700_000_000_000,
    },
  });

  const intervalMs = 1000 / opts.tps;
  const tickMs = 100; // 봇은 100ms 단위로 진행
  let elapsed = 0;
  let nextHitAt = intervalMs;
  let hitCount = 0;

  while (elapsed < opts.durationMs) {
    // tick (시간 진행)
    const advance = Math.min(tickMs, opts.durationMs - elapsed);
    state = rootReducer(state, { type: 'RUN_TICK', payload: { deltaMs: advance } });
    elapsed += advance;

    // 카드 오퍼가 떴으면 픽 (또는 무시)
    if (state.run?.cardOffer) {
      if (opts.pickCards) {
        const first = state.run.cardOffer.cards[0];
        if (first) {
          state = rootReducer(state, {
            type: 'CARD_PICKED',
            payload: { t: asGameTimeMs(elapsed), cardId: first.cardId },
          });
        } else {
          // 빈 오퍼 (모든 카드 픽됨) — 무시
          state = { ...state, run: { ...state.run, cardOffer: null } };
        }
      } else {
        // 카드 무시 — cardOffer null 처리
        state = { ...state, run: { ...state.run, cardOffer: null } };
      }
    }

    // 탭
    while (elapsed >= nextHitAt && elapsed < opts.durationMs && !state.run?.cardOffer) {
      state = rootReducer(state, {
        type: 'MINE_HIT',
        payload: { t: asGameTimeMs(nextHitAt), x: 0, y: 0 },
      });
      hitCount++;
      nextHitAt += intervalMs;
    }
  }

  state = rootReducer(state, {
    type: 'RUN_END',
    payload: { reason: 'timeout', now: 1_700_000_000_000 + opts.durationMs },
  });

  if (!state.run?.finished) throw new Error('No finished state');

  const ores = state.run.oresCollected;
  let totalValue = 0;
  for (const [id, n] of Object.entries(ores)) {
    const def = content.minerals.get(id as never);
    totalValue += (def?.baseValue ?? 1) * n;
  }

  return {
    veinsDestroyed: state.run.veinsDestroyed,
    damageDealt: state.run.damageDealt,
    oresCollected: { ...ores } as Record<string, number>,
    cardsPicked: state.run.cards.map((c) => c.cardId as string),
    totalValue,
    hitCount,
  };
}

function aggregate(reports: RunReport[]) {
  const N = reports.length;
  const oresSum: Record<string, number> = {};
  const cardCount: Record<string, number> = {};
  let veinsSum = 0;
  let dmgSum = 0;
  let valueSum = 0;
  let hitsSum = 0;
  let negativeFound = 0;

  for (const r of reports) {
    veinsSum += r.veinsDestroyed;
    dmgSum += r.damageDealt;
    valueSum += r.totalValue;
    hitsSum += r.hitCount;
    for (const [id, n] of Object.entries(r.oresCollected)) {
      oresSum[id] = (oresSum[id] ?? 0) + n;
      if (n < 0) negativeFound++;
    }
    for (const cid of r.cardsPicked) {
      cardCount[cid] = (cardCount[cid] ?? 0) + 1;
    }
  }

  return {
    runs: N,
    avgVeinsDestroyed: veinsSum / N,
    avgDamage: dmgSum / N,
    avgValue: valueSum / N,
    avgHits: hitsSum / N,
    oreAverages: Object.fromEntries(
      Object.entries(oresSum).map(([id, n]) => [id, +(n / N).toFixed(2)]),
    ),
    cardPickRates: Object.fromEntries(
      Object.entries(cardCount).map(([id, n]) => [id, +((n / N) * 100).toFixed(1) + '%']),
    ),
    invariants: { negativeOreCounts: negativeFound },
  };
}

function main() {
  const opts = parseArgs();
  const t0 = Date.now();
  const reports: RunReport[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const seed = (i + 1) * 31337;
    reports.push(simulateOne(seed, opts));
    if (i % 100 === 0 && i > 0) process.stdout.write(`  ${i}/${opts.runs}\r`);
  }
  const ms = Date.now() - t0;

  const summary = aggregate(reports);

  console.log('\n=== Mineral Rush — Balance Sim ===');
  console.log(`runs: ${summary.runs}  (took ${ms}ms, ${(ms / summary.runs).toFixed(2)}ms/run)`);
  console.log(`opts: depth=${opts.depth} tps=${opts.tps} pickCards=${opts.pickCards}`);
  console.log('');
  console.log(`avg veinsDestroyed: ${summary.avgVeinsDestroyed.toFixed(2)}`);
  console.log(`avg damage:         ${summary.avgDamage.toFixed(0)}`);
  console.log(`avg value:          ${summary.avgValue.toFixed(1)}`);
  console.log(`avg hits:           ${summary.avgHits.toFixed(0)}`);
  console.log('');
  console.log('avg ores per run:');
  for (const [id, n] of Object.entries(summary.oreAverages)) {
    console.log(`  ${id.padEnd(12)} ${n}`);
  }
  console.log('');
  console.log('card pick rates:');
  if (Object.keys(summary.cardPickRates).length === 0) {
    console.log('  (no cards picked)');
  } else {
    for (const [id, rate] of Object.entries(summary.cardPickRates)) {
      console.log(`  ${id.padEnd(20)} ${rate}`);
    }
  }
  console.log('');
  console.log(`invariants: negative ore counts = ${summary.invariants.negativeOreCounts}`);
  if (summary.invariants.negativeOreCounts > 0) {
    console.error('FAIL — negative ore counts detected');
    process.exit(1);
  }
  console.log('OK');
}

main();
