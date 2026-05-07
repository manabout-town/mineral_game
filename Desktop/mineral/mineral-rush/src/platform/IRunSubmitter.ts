/**
 * IRunSubmitter — 런 종료 후 서버에 events + 보고서 제출.
 *
 * the-security-auditor: 클라 데이터는 신뢰 안 함 — 서버 측에서 액션 리플레이로 재계산.
 *
 * Phase 4: HMAC 서명 + 타임스탬프 윈도우 + 통계 임계.
 *   - StubRunSubmitter: 오프라인 / 개발용. 항상 valid.
 *   - SupabaseRunSubmitter: validate-run Edge Function POST.
 */

import type { GameState, RunFinishedSummary, GameEvent } from '../core/State.ts';

export interface RunReportPayload {
  runId: string;
  playerId: string;
  seed: number;
  stageId: string;
  startDepth: number;
  durationMs: number;
  startedAt: number; // epoch ms
  endedAt: number;
  reason: RunFinishedSummary['reason'];
  veinCount: number;
  damageDealt: number;
  cardsPicked: number;
  oresCollected: Record<string, number>;
  rewardOres: Record<string, number>;
  rewardCrystals: number;
  events: readonly GameEvent[];
  schemaVersion: number;
  clientVersion: string;
  /** epoch ms — 서버 ±60s 윈도우 검증용 */
  timestamp: number;
}

export type RunSubmitStatus = 'valid' | 'mismatch' | 'rejected' | 'pending' | 'error';

export interface RunSubmitResult {
  status: RunSubmitStatus;
  reason?: string;
  /** 서버가 재계산한 화폐 (mismatch 시) */
  serverReward?: { ores: Record<string, number>; crystals: number };
}

export interface IRunSubmitter {
  /** RUN_END 직후 호출. 비동기 — 결과는 무시해도 게임 진행에 영향 없음 (클라는 보상 즉시 지급, 서버에서 사후 검증) */
  submit(payload: RunReportPayload): Promise<RunSubmitResult>;
}

/**
 * GameState + finished → RunReportPayload 생성 헬퍼.
 * Game.claimRewardAndStartNewRun 직전에 한 번 호출.
 */
export function buildRunReport(
  state: GameState,
  clientVersion: string,
  totalCrystals: number,
  now: number,
): RunReportPayload | null {
  if (!state.run?.finished) return null;
  const r = state.run;
  const f = r.finished!;
  return {
    runId: r.runId as string,
    playerId: state.player.playerId as string,
    seed: r.seed,
    stageId: r.stageId as string,
    startDepth: r.depth,
    durationMs: r.duration,
    startedAt: r.startedAt,
    endedAt: f.endedAt,
    reason: f.reason,
    veinCount: f.veinsDestroyed,
    damageDealt: r.damageDealt,
    cardsPicked: f.cardsPicked,
    oresCollected: { ...f.oresCollected } as Record<string, number>,
    rewardOres: { ...f.rewardOres } as Record<string, number>,
    rewardCrystals: totalCrystals,
    events: r.events,
    schemaVersion: state.schemaVersion,
    clientVersion,
    timestamp: now,
  };
}
