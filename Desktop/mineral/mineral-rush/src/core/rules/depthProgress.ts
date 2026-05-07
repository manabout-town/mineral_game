/**
 * depthProgress — 광맥을 N개 부수면 깊이 1층 진행 + 스테이지 자동 전환.
 *
 * 5계명 §1 Pure Logic First — 외부 의존성 없음. 결정론.
 * 5계명 §2 Atomic Actions — 깊이 진행은 단일 DEPTH_ADVANCE 액션으로만.
 */

import type { RunState } from '../State.ts';
import { content } from '../content/index.ts';

export interface DepthProgressConfig {
  /** 깊이 1 → 2 진행에 필요한 광맥 수 */
  veinsPerDepthBase: number;
  /** 깊이마다 +veinsPerDepthGrowth 광맥 추가 (느린 가속) */
  veinsPerDepthGrowth: number;
  /** 한 런 내 최대 깊이 — 보스/엔드가드 */
  maxDepthPerRun: number;
}

export const DEFAULT_DEPTH_PROGRESS: DepthProgressConfig = {
  veinsPerDepthBase: 3,
  veinsPerDepthGrowth: 1,
  maxDepthPerRun: 30,
};

/**
 * 현재 RunState 기준 다음 깊이로 진행해야 할지 판단.
 * 진행해야 하면 새 깊이를, 아니면 null을 반환.
 *
 * 광맥 N개 부수면 진행. 단, 이미 동일 깊이 임계값을 통과한 경우는 다시 진행하지 않음
 * (DEPTH_ADVANCE 자체가 veinsDestroyed를 변경하지 않으므로 중복 발행 방지를 위해 호출 측이 사용).
 */
export function shouldAdvanceDepth(
  run: RunState,
  cfg: DepthProgressConfig = DEFAULT_DEPTH_PROGRESS,
): number | null {
  if (run.depth >= cfg.maxDepthPerRun) return null;

  // 깊이 d 도달까지 누적으로 필요한 광맥 수
  // d=1 → 0, d=2 → base, d=3 → base + (base + growth), ...
  const requiredForCurrent = totalVeinsRequired(run.depth, cfg);
  const requiredForNext = totalVeinsRequired(run.depth + 1, cfg);

  if (run.veinsDestroyed >= requiredForNext && run.veinsDestroyed > requiredForCurrent) {
    return run.depth + 1;
  }
  return null;
}

function totalVeinsRequired(targetDepth: number, cfg: DepthProgressConfig): number {
  // depth 1까지 필요한 누적 = 0
  if (targetDepth <= 1) return 0;
  let total = 0;
  for (let d = 1; d < targetDepth; d++) {
    total += cfg.veinsPerDepthBase + (d - 1) * cfg.veinsPerDepthGrowth;
  }
  return total;
}

/**
 * depth 값에 해당하는 stage를 content.stages에서 매칭.
 * depthRange가 포함하는 stage 중 첫 번째를 사용. 없으면 가장 깊은 스테이지.
 */
export function getStageForDepth(depth: number): string {
  const stages = [...content.stages.values()];
  // depthMin 오름차순 정렬
  stages.sort((a, b) => a.depthRange[0] - b.depthRange[0]);
  for (const s of stages) {
    if (depth >= s.depthRange[0] && depth <= s.depthRange[1]) {
      return s.id as string;
    }
  }
  // 깊이가 모든 스테이지 범위를 벗어남 → 마지막
  const last = stages[stages.length - 1];
  return (last?.id as string) ?? 'open_pit';
}
