/**
 * validate-run — 런 종료 시 클라이언트가 보낸 events[]를 서버에서 동일 reducer로 재생.
 *
 * Phase 5-D: bundled reducer.js (esbuild)를 실제로 import해서 리플레이 실행.
 *
 * 검증 파이프라인:
 *   1. HMAC 서명 + 타임스탬프 윈도우 ±60s
 *   2. 정적 임계 검사 (이벤트 수 / 히트 수 / 화폐 음수)
 *   3. 리듀서 리플레이 — 빈 skillTree로 시작 (서버는 플레이어 저장 상태 불명)
 *      → ore 타입 정합성 + 크리스탈 상한 검증
 *   4. runs upsert (replay_status: 'ok' | 'mismatch' | 'error')
 *
 * 리플레이 한계:
 *   서버는 플레이어의 skillTree를 모르므로 ore 개수 완벽 일치 검증 불가.
 *   → ore 타입(seed에서 결정된 종류)과 크리스탈 상한만 엄격히 체크.
 *   → 향후 Phase 6: /me 엔드포인트로 저장 상태를 함께 전달해 완전 검증.
 */

// @ts-expect-error — Deno 런타임에서만 해석
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-expect-error — Deno 런타임에서만 해석
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Phase 5-D: esbuild로 번들된 rootReducer import
// @ts-expect-error — bundled ESM, Deno-호환
import { rootReducer } from './reducer.js';

// ─── 환경 변수 ────────────────────────────────────────────────

const env = (globalThis as Record<string, unknown>).Deno?.env?.get?.bind(
  (globalThis as Record<string, unknown>).Deno?.env,
) as ((k: string) => string | undefined) | undefined;

const HMAC_SECRET                = env?.('HMAC_SECRET');
const SUPABASE_URL               = env?.('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY  = env?.('SUPABASE_SERVICE_ROLE_KEY');

// ─── 상수 ─────────────────────────────────────────────────────

const TIMESTAMP_WINDOW_MS  = 60_000;
const MAX_EVENTS_PER_RUN   = 5_000;
const MAX_HITS_PER_RUN     = 1_500;
/** 베인 1개당 크리스탈 최대 보상 (스킬 보너스 포함 여유분 × 넉넉한 슬랙) */
const MAX_CRYSTALS_PER_VEIN = 20;
/** 카드 1장당 크리스탈 최대 보너스 */
const MAX_CRYSTALS_PER_CARD = 10;
/** 크리스탈 계산 슬랙 — skillTree 불명확성 보정 */
const CRYSTAL_SLACK = 100;

// ─── 페이로드 타입 ────────────────────────────────────────────

interface ReplayPayload {
  runId:            string;
  playerId:         string;
  seed:             number;
  stageId:          string;
  startDepth:       number;
  durationMs:       number;
  startedAt:        number;
  endedAt:          number;
  reason:           'timeout' | 'quit' | 'death';
  veinCount:        number;
  damageDealt:      number;
  cardsPicked:      number;
  oresCollected:    Record<string, number>;
  rewardOres:       Record<string, number>;
  rewardCrystals:   number;
  events:           unknown[];
  schemaVersion:    number;
  clientVersion:    string;
  timestamp:        number;
  signature:        string;
}

// ─── HMAC 검증 ───────────────────────────────────────────────

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return expected === signature;
}

// ─── 정적 검사 ───────────────────────────────────────────────

function staticChecks(p: ReplayPayload): { ok: boolean; reason?: string } {
  if (Math.abs(Date.now() - p.timestamp) > TIMESTAMP_WINDOW_MS) {
    return { ok: false, reason: 'E_TIMESTAMP_OUT_OF_WINDOW' };
  }
  if (!Array.isArray(p.events) || p.events.length > MAX_EVENTS_PER_RUN) {
    return { ok: false, reason: 'E_EVENTS_OVER_LIMIT' };
  }
  const hitCount = (p.events as { type?: string }[]).filter((e) => e.type === 'mine_hit').length;
  if (hitCount > MAX_HITS_PER_RUN) {
    return { ok: false, reason: 'E_HITS_OVER_LIMIT' };
  }
  if (p.rewardCrystals < 0) return { ok: false, reason: 'E_NEGATIVE_CRYSTALS' };
  for (const v of Object.values(p.rewardOres)) {
    if (typeof v !== 'number' || v < 0) return { ok: false, reason: 'E_NEGATIVE_ORE' };
  }
  return { ok: true };
}

// ─── 리플레이 이벤트 → 액션 매핑 ─────────────────────────────
// src/systems/Replay.ts 의 eventToAction() 와 동일해야 함.

interface GameEvent {
  type: string;
  t: number;
  x?: number;
  y?: number;
  cardId?: string;
  newDepth?: number;
}

function eventToAction(ev: GameEvent): Record<string, unknown> | null {
  switch (ev.type) {
    case 'mine_hit':
      return { type: 'MINE_HIT', payload: { t: ev.t, x: ev.x ?? 0, y: ev.y ?? 0 } };
    case 'card_picked':
      return { type: 'CARD_PICKED', payload: { t: ev.t, cardId: ev.cardId } };
    case 'depth_advance':
      return { type: 'DEPTH_ADVANCE', payload: { t: ev.t, newDepth: ev.newDepth } };
    // 부수 효과 이벤트 — mine_hit·depth_advance 결과로 자동 생성, 재생 불필요
    case 'ore_collected':
    case 'vein_destroyed':
    case 'card_offer_generated':
    case 'combo_break':
    case 'card_rerolled':
      return null;
    default:
      return null;
  }
}

// ─── 최소 초기 GameState 생성 ────────────────────────────────
// 서버는 플레이어 저장 상태를 모르므로 빈 skillTree로 시작.
// baseline 모디파이어(스킬 효과 없음)로 리플레이.

function buildInitialState(p: ReplayPayload): Record<string, unknown> {
  return {
    schemaVersion: p.schemaVersion ?? 2,
    updatedAt: p.startedAt,
    meta: {
      skillTree: {},
      unlockedPickaxes: ['basic_pickaxe'],
      unlockedMinerals: [],
      unlockedStages: [p.stageId],
      prestige: 0,
      stats: {
        totalRuns: 0,
        totalOresMined: 0,
        bestRunScore: 0,
        totalPlayTimeMs: 0,
        bestRunValueCrystals: 0,
      },
    },
    run: null,
    player: { playerId: p.playerId, supabaseUserId: null, createdAt: p.startedAt },
    economy: { ores: {}, crystals: 0 },
    settings: { audio: { master: 1, sfx: 0.8, bgm: 0.5 }, haptic: false },
  };
}

// ─── 리듀서 리플레이 ─────────────────────────────────────────

interface ReplayOutcome {
  status: 'ok' | 'mismatch' | 'error';
  reason?: string;
  serverVeinCount?: number;
}

function runReducerReplay(payload: ReplayPayload): ReplayOutcome {
  try {
    // 1. 초기 상태 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let state: any = buildInitialState(payload);

    // 2. RUN_START — seed·stage·depth 결정론적으로 초기화
    state = rootReducer(state, {
      type: 'RUN_START',
      payload: {
        runId: payload.runId,
        seed:  payload.seed,
        stageId: payload.stageId,
        depth: payload.startDepth,
        durationMs: payload.durationMs,
        now: payload.startedAt,
      },
    });
    if (!state?.run) return { status: 'error', reason: 'E_REPLAY_NO_RUN_AFTER_START' };

    // 3. 이벤트 리플레이
    let divergenceAt = -1;
    const events = payload.events as GameEvent[];
    for (let i = 0; i < events.length; i++) {
      const action = eventToAction(events[i]!);
      if (!action) continue; // 부수 효과 이벤트 건너뜀
      state = rootReducer(state, action);
      if (!state?.run) {
        divergenceAt = i;
        break;
      }
    }

    if (divergenceAt >= 0) {
      return { status: 'mismatch', reason: `E_REPLAY_RUN_LOST_AT_${divergenceAt}` };
    }

    // 4. RUN_END
    state = rootReducer(state, {
      type: 'RUN_END',
      payload: { reason: payload.reason, now: payload.endedAt },
    });

    const finished = state?.run?.finished as Record<string, unknown> | null;
    if (!finished) return { status: 'error', reason: 'E_REPLAY_NO_FINISHED' };

    const serverVeinCount = (finished.veinsDestroyed as number) ?? 0;

    // 5. Ore 타입 검사:
    //    서버 리플레이 결과에 없는 ore 종류를 클라가 주장하면 mismatch.
    //    (seed가 같으면 동일 광맥에서 동일 ore 종류만 드롭됨.)
    const serverOreTypes = new Set(Object.keys(finished.rewardOres as Record<string, number>));
    for (const oreId of Object.keys(payload.rewardOres)) {
      if ((payload.rewardOres[oreId] ?? 0) > 0 && !serverOreTypes.has(oreId)) {
        return {
          status: 'mismatch',
          reason: `E_REPLAY_FOREIGN_ORE:${oreId}`,
          serverVeinCount,
        };
      }
    }

    // 6. 크리스탈 상한 검사:
    //    skillTree 불명 → 너그러운 상한 (vein × 20 + card × 10 + 100 슬랙)
    const maxCrystals =
      serverVeinCount * MAX_CRYSTALS_PER_VEIN +
      payload.cardsPicked * MAX_CRYSTALS_PER_CARD +
      CRYSTAL_SLACK;
    if (payload.rewardCrystals > maxCrystals) {
      return {
        status: 'mismatch',
        reason: `E_REPLAY_CRYSTALS_OVERFLOW:claimed=${payload.rewardCrystals},max=${maxCrystals}`,
        serverVeinCount,
      };
    }

    return { status: 'ok', serverVeinCount };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 'error', reason: `E_REPLAY_EXCEPTION:${msg}` };
  }
}

// ─── HTTP 핸들러 ─────────────────────────────────────────────

// @ts-expect-error — serve는 Deno 전용
serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }
  if (!HMAC_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('server misconfigured', { status: 500 });
  }

  const body = await req.text();
  let payload: ReplayPayload;
  try {
    payload = JSON.parse(body) as ReplayPayload;
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  // HMAC 서명 검증
  const sigHeader = req.headers.get('x-signature');
  if (!sigHeader) return new Response('missing signature', { status: 401 });
  const hmacOk = await verifyHmac(
    body.replace(/,?\s*"signature"\s*:\s*"[^"]*"/, ''),
    sigHeader,
    HMAC_SECRET,
  );
  if (!hmacOk) return new Response('invalid signature', { status: 401 });

  // 정적 검사
  const sc = staticChecks(payload);
  if (!sc.ok) {
    return new Response(JSON.stringify({ status: 'rejected', reason: sc.reason }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 리듀서 리플레이 (Phase 5-D)
  const replay = runReducerReplay(payload);

  // DB 저장
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from('runs').upsert({
    id:               payload.runId,
    player_id:        payload.playerId,
    seed:             payload.seed,
    stage_id:         payload.stageId,
    start_depth:      payload.startDepth,
    duration_ms:      payload.durationMs,
    started_at:       payload.startedAt,
    ended_at:         payload.endedAt,
    reason:           payload.reason,
    vein_count:       replay.serverVeinCount ?? payload.veinCount,
    damage_dealt:     payload.damageDealt,
    cards_picked:     payload.cardsPicked,
    ores_collected:   payload.oresCollected,
    reward_ores:      payload.rewardOres,
    reward_crystals:  payload.rewardCrystals,
    events:           payload.events,
    events_count:     payload.events.length,
    hmac_signature:   sigHeader,
    client_version:   payload.clientVersion,
    schema_version:   payload.schemaVersion,
    replay_status:    replay.status,
    replay_reason:    replay.reason ?? null,
  });

  if (error) {
    return new Response(JSON.stringify({ status: 'error', message: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ status: replay.status, reason: replay.reason }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
