/**
 * Game — Reducer + TickSystem + Renderer + Persistence를 묶는 글루.
 *
 * 5계명 §3 No Hidden State — 모든 상태는 GameState 안에. 이 클래스는 라이프사이클만.
 */

import { rootReducer } from '../core/reducers/index.ts';
import { createInitialState, type GameState } from '../core/State.ts';
import type { Action } from '../core/Actions.ts';
import { TickSystem } from '../systems/TickSystem.ts';
import { validateAction } from '../systems/ValidationSystem.ts';
import { logger } from '../systems/Logger.ts';
import type { GameRenderer } from './GameRenderer.ts';
import type { IPlatformAdapter } from '../platform/IPlatformAdapter.ts';
import type { PersistenceSystem } from '../systems/PersistenceSystem.ts';
import type { Telemetry } from '../platform/Telemetry.ts';
import { asRunId, asStageId } from '../shared/ids.ts';
import { asGameTimeMs } from '../core/reducers/runReducer.ts';
import { RUN_DURATION_MS } from '../shared/constants.ts';

export class Game {
  private state: GameState;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private readonly tickSystem = new TickSystem();
  private subscribers: Array<(s: GameState) => void> = [];
  private endedHandled = false;

  constructor(
    private readonly renderer: GameRenderer,
    private readonly platform: IPlatformAdapter,
    private readonly persistence: PersistenceSystem,
  ) {
    this.state = createInitialState(this.platform.getDeviceInfo().deviceId);
  }

  async boot(container: HTMLElement): Promise<void> {
    await this.platform.init();
    await this.renderer.init(container);

    const loaded = await this.persistence.load();
    if (loaded) {
      // run은 hydrate 시 무효화 — 진행 중인 런은 다음 부팅에서 이어가지 않음
      // (Phase 4에서 in-progress 런 복원 결정)
      const cleared: GameState = { ...loaded, run: null };
      this.dispatch({ type: 'STATE_HYDRATE', payload: { state: cleared } });
      logger.info('hydrated from save');
    }

    this.renderer.onPointerDown((x, y) => this.handleTap(x, y));
    this.startNewRun();

    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.tickSystem.reset();
      else this.lastFrameTime = performance.now();
    });

    window.addEventListener('resize', () => {
      this.renderer.resize(container.clientWidth, container.clientHeight);
    });
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.renderer.destroy();
    this.subscribers = [];
  }

  subscribe(fn: (s: GameState) => void): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter((f) => f !== fn);
    };
  }

  getState(): GameState {
    return this.state;
  }

  dispatch(action: Action): void {
    const result = validateAction(this.state, action);
    if (!result.valid) {
      logger.warn('Action rejected by validator', { action: action.type, code: result.code });
      return;
    }
    this.state = rootReducer(this.state, action);
    for (const fn of this.subscribers) fn(this.state);
  }

  /** 결과 화면 → 보상 정산 + 새 런 시작 */
  claimRewardAndStartNewRun(): void {
    if (!this.state.run?.finished) return;
    const finished = this.state.run.finished;

    // META_RUN_REWARD 디스패치 (서버 검증 시 동일 액션을 다시 흘림)
    this.dispatch({
      type: 'META_RUN_REWARD',
      payload: { ores: finished.rewardOres, crystals: finished.veinsDestroyed * 5 },
    });

    // run을 명시적으로 null로 (RUN_END 이미 발행되어 finished만 있고 run은 아직 살아있음)
    // 새 런 시작이 자동으로 run을 교체.
    this.endedHandled = false;
    this.startNewRun();
    this.persistence.save(this.state).catch(() => {});
  }

  // -- private --

  private loop(now: number): void {
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // 카드 오퍼 또는 결과 화면이 떠있으면 게임 시간 일시정지 (탭 잠금)
    const paused = !!this.state.run?.cardOffer || !!this.state.run?.finished;
    if (!paused) {
      this.tickSystem.step(delta, (a) => this.dispatch(a));
    } else {
      this.tickSystem.reset();
    }

    // 30초 런 종료 자동 처리
    if (this.state.run && !this.state.run.finished && this.state.run.remaining <= 0 && !this.endedHandled) {
      this.endedHandled = true;
      this.dispatch({ type: 'RUN_END', payload: { reason: 'timeout', now: Date.now() } });
    }

    this.renderer.render(this.state, this.tickSystem.getInterpolationAlpha());
    this.rafId = requestAnimationFrame(this.loop);
  }

  private handleTap(x: number, y: number): void {
    if (!this.state.run) return;
    if (this.state.run.cardOffer) return; // 카드 선택 중엔 채굴 잠금
    if (this.state.run.finished) return; // 결과 화면 중엔 채굴 잠금

    const elapsed = this.state.run.duration - this.state.run.remaining;
    this.dispatch({
      type: 'MINE_HIT',
      payload: { t: asGameTimeMs(elapsed), x, y },
    });
    this.platform.haptic('light');
  }

  private startNewRun(): void {
    this.dispatch({
      type: 'RUN_START',
      payload: {
        runId: asRunId('run-' + Date.now()),
        seed: Math.floor(Math.random() * 1_000_000),
        stageId: asStageId('open_pit'),
        depth: 1,
        durationMs: RUN_DURATION_MS,
        now: Date.now(),
      },
    });
  }
}
