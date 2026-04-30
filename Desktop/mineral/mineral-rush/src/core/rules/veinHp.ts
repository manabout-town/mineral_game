/**
 * Vein HP — 광맥 체력 산출.
 *
 * 5계명 §1 Pure Logic First.
 */

import type { StageDef } from '../content/Content.ts';

export function computeVeinHp(stage: StageDef, depth: number, veinIndex: number): number {
  const depthScale = Math.pow(stage.veinHpPerDepth, Math.max(0, depth - 1));
  // 같은 깊이에서도 부순 광맥 수가 늘수록 살짝 단단해지도록
  const veinScale = 1 + veinIndex * 0.08;
  return Math.round(stage.veinHpBase * depthScale * veinScale);
}
