/**
 * TickSystem — 결정론적 고정 타임스텝.
 *
 * UNIVERSAL_GAME_FRAMEWORK §1.2 System Layer:
 *   - 시간 흐름 관리. 서버-클라 동기화의 기반.
 *   - 60Hz 고정 (FIXED_DELTA_MS = 16.666...).
 *   - accumulator 패턴: realDelta가 흔들려도 게임 로직은 항상 16.66ms 단위로 진행.
 *
 * 5계명 §1 Pure Logic First: PixiJS / React 의존 없음.
 */

import type { Action } from '../core/Actions.ts';
import { FIXED_DELTA_MS } from '../shared/constants.ts';

export type Dispatch = (action: Action) => void;

export class TickSystem {
  private accumulator = 0;
  /** 한 프레임에 실행할 수 있는 최대 틱 수 — death-spiral 방지 */
  private readonly maxTicksPerFrame: number;

  constructor(maxTicksPerFrame = 5) {
    this.maxTicksPerFrame = maxTicksPerFrame;
  }

  /**
   * 매 프레임 호출. realDeltaMs 만큼 시간을 누적하고
   * 16.66ms 단위로 RUN_TICK 액션을 발행.
   */
  step(realDeltaMs: number, dispatch: Dispatch): void {
    // 탭 비활성/일시정지 등으로 큰 delta가 들어오면 클램프
    const clamped = Math.min(realDeltaMs, FIXED_DELTA_MS * this.maxTicksPerFrame);
    this.accumulator += clamped;

    let ticks = 0;
    while (this.accumulator >= FIXED_DELTA_MS && ticks < this.maxTicksPerFrame) {
      dispatch({ type: 'RUN_TICK', payload: { deltaMs: FIXED_DELTA_MS } });
      this.accumulator -= FIXED_DELTA_MS;
      ticks++;
    }
  }

  reset(): void {
    this.accumulator = 0;
  }

  /** 보간 alpha — View Layer에서 부드러운 렌더링용 */
  getInterpolationAlpha(): number {
    return this.accumulator / FIXED_DELTA_MS;
  }
}
