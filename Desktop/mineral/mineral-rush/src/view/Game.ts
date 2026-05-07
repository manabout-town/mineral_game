/**
 * Game — Reducer + TickSystem + Renderer + Persistence + Telemetry + Audio 글루.
 *
 * 5계명 §3 No Hidden State — 모든 상태는 GameState 안에. 이 클래스는 라이프사이클만.
 *
 * Phase 2 마무리: Telemetry 통합. 모든 dispatch 후 분류기로 이벤트 기록.
 * Phase 3: GameMode (auto/lobby), Audio, depth/stage 자동 진행.
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
import type { IAudioManager, BgmId, SfxId } from '../platform/IAudioManager.ts';
import type { IRunSubmitter } from '../platform/IRunSubmitter.ts';
import { buildRunReport } from '../platform/IRunSubmitter.ts';
import { asRunId, asStageId } from '../shared/ids.ts';
import { asGameTimeMs } from '../core/reducers/runReducer.ts';
import { RUN_DURATION_MS } from '../shared/constants.ts';
import {
  shouldAdvanceDepth,
  getStageForDepth,
  DEFAULT_DEPTH_PROGRESS,
} from '../core/rules/depthProgress.ts';
import { computeMetaCrystalBonus } from '../core/rules/skillTree.ts';

/** Game 컨텍스트에 주입되는 시스템 — Phase 3에서 옵션 추가에 호환 유지 */
export interface GameDeps {
  renderer: GameRenderer;
  platform: IPlatformAdapter;
  persistence: PersistenceSystem;
  telemetry: Telemetry;
  audio?: IAudioManager;
  /** Phase 4: 런 종료 시 서버 검증 제출. 미지정이면 제출 안 함 (오프라인 dev) */
  runSubmitter?: IRunSubmitter;
}

/** Game 모드. lobby면 boot 후 자동 런 시작 안 함 (사용자가 PLAY 눌러야 시작) */
export type GameMode = 'auto' | 'lobby';

const AUTOSAVE_INTERVAL_MS = 5_000;

export class Game {
  private state: GameState;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private readonly tickSystem = new TickSystem();
  private subscribers: Array<(s: GameState) => void> = [];
  private endedHandled = false;
  private mode: GameMode = 'auto';
  private autoSaveTimer: number | null = null;
  // Timber Rush: 자동공격 없음 — 플레이어가 직접 좌/우 탭

  private readonly renderer: GameRenderer;
  private readonly platform: IPlatformAdapter;
  private readonly persistence: PersistenceSystem;
  private readonly telemetry: Telemetry;
  private readonly audio: IAudioManager | null;
  private readonly runSubmitter: IRunSubmitter | null;

  constructor(deps: GameDeps) {
    this.renderer = deps.renderer;
    this.platform = deps.platform;
    this.persistence = deps.persistence;
    this.telemetry = deps.telemetry;
    this.audio = deps.audio ?? null;
    this.runSubmitter = deps.runSubmitter ?? null;
    this.state = createInitialState(this.platform.getDeviceInfo().deviceId);
  }

  async boot(container: HTMLElement, mode: GameMode = 'auto'): Promise<void> {
    this.mode = mode;
    await this.platform.init();
    await this.renderer.init(container);
    if (this.audio) {
      try {
        await this.audio.init();
      } catch (e) {
        logger.warn('Audio init failed (non-fatal)', { error: String(e) });
      }
    }

    const loaded = await this.persistence.load();
    if (loaded) {
      // run은 hydrate 시 무효화 — 진행 중인 런은 다음 부팅에서 이어가지 않음
      const cleared: GameState = { ...loaded, run: null };
      this.dispatch({ type: 'STATE_HYDRATE', payload: { state: cleared } });
      logger.info('hydrated from save');
    }

    // Phase 5-A: ITelemetrySink에 사용자 식별자 전달 (Amplitude 등 원격 분석용)
    this.telemetry.identify(this.state.player.playerId as string);

    this.telemetry.track('boot', {
      mode,
      hydrated: !!loaded,
      schemaVersion: this.state.schemaVersion,
      totalRuns: this.state.meta.stats.totalRuns,
    });

    this.renderer.onPointerDown((x, y) => this.handleTap(x, y));
    if (mode === 'auto') {
      this.startNewRun();
    } else {
      // lobby 모드: 로비 BGM 재생 (런 시작 시 교체됨)
      this.audio?.playBgm('lobby', { fadeMs: 2000 });
    }

    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);

    this.autoSaveTimer = window.setInterval(() => {
      void this.saveSilent();
    }, AUTOSAVE_INTERVAL_MS);

    document.addEventListener('visibilitychange', this.handleVisibility);

    window.addEventListener('resize', () => {
      this.renderer.resize(container.clientWidth, container.clientHeight);
    });
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.autoSaveTimer !== null) {
      window.clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    document.removeEventListener('visibilitychange', this.handleVisibility);
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

  getMode(): GameMode {
    return this.mode;
  }

  /**
   * dispatch — 모든 상태 변경의 단일 진입점.
   *
   * 1) ValidationSystem 검증
   * 2) rootReducer 적용
   * 3) Telemetry 기록 (액션 타입별 분류)
   * 4) 부수 효과 (사운드, 깊이 자동 진행)
   * 5) 구독자 알림
   */
  dispatch(action: Action): void {
    const result = validateAction(this.state, action);
    if (!result.valid) {
      logger.warn('Action rejected by validator', { action: action.type, code: result.code });
      this.telemetry.track('action_rejected', { action: action.type, code: result.code });
      return;
    }
    const prev = this.state;
    this.state = rootReducer(this.state, action);

    this.trackAction(prev, action);
    this.applySideEffects(prev, action);
    this.maybeAdvanceDepth();

    for (const fn of this.subscribers) fn(this.state);
  }

  /** 결과 화면 → 보상 정산 + (auto모드면) 새 런 시작, lobby모드면 정지 */
  claimRewardAndStartNewRun(): void {
    if (!this.state.run?.finished) return;
    const finished = this.state.run.finished;
    const baseCrystals = finished.rewardCrystals;
    const metaCrystalBonus = computeMetaCrystalBonus(this.state);
    const totalCrystals = baseCrystals + metaCrystalBonus;

    // Phase 4: 서버 검증 제출 (fire-and-forget. 응답 무시 — 클라는 보상 즉시 지급, 서버는 사후 마킹)
    if (this.runSubmitter) {
      const report = buildRunReport(
        this.state,
        this.platform.getDeviceInfo().appVersion,
        totalCrystals,
        Date.now(),
      );
      if (report) {
        this.runSubmitter
          .submit(report)
          .then((result) => {
            this.telemetry.track('run_submit_result', {
              status: result.status,
              reason: result.reason,
            });
            if (result.status === 'rejected' || result.status === 'mismatch') {
              logger.warn('Run rejected by server', { result });
            }
          })
          .catch((e) => {
            logger.warn('Run submit failed (non-fatal)', { error: String(e) });
          });
      }
    }

    this.dispatch({
      type: 'META_RUN_REWARD',
      payload: { ores: finished.rewardOres, crystals: totalCrystals },
    });

    this.telemetry.track('run_reward_claimed', {
      veinsDestroyed: finished.veinsDestroyed,
      cardsPicked: finished.cardsPicked,
      crystals: totalCrystals,
      metaCrystalBonus,
    });

    this.endedHandled = false;
    if (this.mode === 'auto') {
      this.startNewRun();
    } else {
      // Lobby 모드: run을 null로 만들어 결과 화면 닫기, 로비 BGM 복귀
      this.state = { ...this.state, run: null };
      for (const fn of this.subscribers) fn(this.state);
      this.audio?.playBgm('lobby', { fadeMs: 1500 });
    }
    void this.saveSilent();
  }

  /** Lobby 모드에서 사용자가 PLAY 클릭 시 호출 */
  startNewRun(stageOverride?: string, depthOverride?: number): void {
    const depth = depthOverride ?? this.recommendedStartDepth();
    const stageId = stageOverride ?? getStageForDepth(depth);
    this.dispatch({
      type: 'RUN_START',
      payload: {
        runId: asRunId('run-' + Date.now()),
        seed: Math.floor(Math.random() * 1_000_000),
        stageId: asStageId(stageId),
        depth,
        durationMs: RUN_DURATION_MS,
        now: Date.now(),
      },
    });
  }

  /** Lobby에서 결과 화면을 명시적으로 닫고 메뉴로 복귀 */
  exitToLobby(): void {
    if (!this.state.run) return;
    if (this.state.run.finished) {
      this.state = { ...this.state, run: null };
      for (const fn of this.subscribers) fn(this.state);
      this.audio?.playBgm('lobby', { fadeMs: 1500 });
      return;
    }
    // 진행 중인 런을 사용자가 quit → RUN_END dispatch (applySideEffects에서 stopBgm 처리됨)
    this.dispatch({ type: 'RUN_END', payload: { reason: 'quit', now: Date.now() } });
    // RUN_END 페이드아웃 후 로비 BGM 진입 (2s 딜레이로 크로스페이드)
    setTimeout(() => { this.audio?.playBgm('lobby', { fadeMs: 1500 }); }, 2000);
  }

  // -- private --

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.tickSystem.reset();
      void this.saveSilent();
      this.telemetry.track('visibility_hidden', {});
    } else {
      this.lastFrameTime = performance.now();
      this.telemetry.track('visibility_visible', {});
    }
  };

  private async saveSilent(): Promise<void> {
    try {
      await this.persistence.save(this.state);
    } catch (e) {
      logger.warn('Auto-save failed (non-fatal)', { error: String(e) });
    }
  }

  /** 부순 광맥 수가 임계 도달 시 자동 깊이 진행 */
  private maybeAdvanceDepth(): void {
    if (!this.state.run || this.state.run.finished || this.state.run.cardOffer) return;
    const elapsed = this.state.run.duration - this.state.run.remaining;
    const next = shouldAdvanceDepth(this.state.run, DEFAULT_DEPTH_PROGRESS);
    if (next === null) return;
    this.dispatch({
      type: 'DEPTH_ADVANCE',
      payload: { t: asGameTimeMs(elapsed), newDepth: next },
    });
  }

  /** 메타 진행도 기반 추천 시작 깊이 — 신규 유저는 1, 진행 시 누적 stats로 약간 상승 */
  private recommendedStartDepth(): number {
    const runs = this.state.meta.stats.totalRuns;
    if (runs < 5) return 1;
    if (runs < 15) return 2;
    return 3;
  }

  private loop(now: number): void {
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    const paused = !!this.state.run?.cardOffer || !!this.state.run?.finished;
    if (!paused) {
      this.tickSystem.step(delta, (a) => this.dispatch(a));
    } else {
      this.tickSystem.reset();
    }

    // 런 종료 자동 처리 (시간 소진)
    if (this.state.run && !this.state.run.finished && this.state.run.remaining <= 0 && !this.endedHandled) {
      this.endedHandled = true;
      this.dispatch({ type: 'RUN_END', payload: { reason: 'timeout', now: Date.now() } });
    }

    this.renderer.render(this.state, this.tickSystem.getInterpolationAlpha());
    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Timber Rush 좌/우 탭 — React UI 버튼에서 호출.
   * side: 'left' | 'right'
   */
  hitSide(side: 'left' | 'right'): void {
    if (!this.state.run) return;
    if (this.state.run.cardOffer) return;
    if (this.state.run.finished) return;
    const elapsed = this.state.run.duration - this.state.run.remaining;
    this.dispatch({
      type: 'MINE_HIT',
      payload: { t: asGameTimeMs(elapsed), x: side === 'left' ? 100 : 700, y: 300, side },
    });
    this.platform.haptic('light');
  }

  /** PixiJS 포인터다운 → x 위치로 좌/우 자동 판정 */
  private handleTap(x: number, _y: number): void {
    if (!this.state.run) return;
    if (this.state.run.cardOffer) return;
    if (this.state.run.finished) return;
    // 화면 절반 기준으로 side 결정
    const screenW = (this.renderer as { app?: { screen?: { width?: number } } }).app?.screen?.width ?? 800;
    const side: 'left' | 'right' = x < screenW / 2 ? 'left' : 'right';
    this.hitSide(side);
  }

  /** 액션 분류 → Telemetry 이벤트. 고빈도 mine_hit은 sampling. */
  private trackAction(prev: GameState, action: Action): void {
    switch (action.type) {
      case 'RUN_START':
        this.telemetry.track('run_start', {
          runId: action.payload.runId,
          stageId: action.payload.stageId,
          depth: action.payload.depth,
          seed: action.payload.seed,
        });
        break;
      case 'RUN_END': {
        const run = prev.run;
        this.telemetry.track('run_end', {
          reason: action.payload.reason,
          veinsDestroyed: run?.veinsDestroyed ?? 0,
          damageDealt: run?.damageDealt ?? 0,
          cardsPicked: run?.cards.length ?? 0,
          oresCollected: run?.oresCollected ?? {},
          finalDepth: run?.depth ?? 0,
        });
        break;
      }
      case 'MINE_HIT':
        // 1/10 샘플링 — 30초 × ~10탭 = 300탭이 그대로 들어가면 LocalStorage 폭발
        if (((prev.run?.events.filter((e) => e.type === 'mine_hit').length ?? 0) % 10) === 0) {
          this.telemetry.track('mine_hit_sample', {
            combo: prev.run?.combo ?? 0,
            depth: prev.run?.depth ?? 0,
          });
        }
        break;
      case 'CARD_PICKED':
        this.telemetry.track('card_picked', {
          cardId: action.payload.cardId,
          pickIndex: prev.run?.cards.length ?? 0,
        });
        break;
      case 'CARD_REROLL':
        this.telemetry.track('card_rerolled', { cost: action.payload.cost });
        break;
      case 'DEPTH_ADVANCE':
        this.telemetry.track('depth_advance', { newDepth: action.payload.newDepth });
        break;
      case 'META_RUN_REWARD':
        this.telemetry.track('meta_reward_applied', {
          crystals: action.payload.crystals,
          oreKeys: Object.keys(action.payload.ores),
        });
        break;
      case 'SKILL_NODE_UNLOCK':
      case 'SKILL_NODE_LEVEL_UP':
        this.telemetry.track('skill_changed', {
          type: action.type,
          nodeId: action.payload.nodeId,
        });
        break;
      // 그 외 (RUN_TICK 등 고빈도)는 추적 안 함
      default:
        break;
    }
  }

  /** 사운드 + 렌더 이펙트 부수 효과. Game은 글루이므로 View/Platform 양쪽 조율 OK */
  private applySideEffects(prev: GameState, action: Action): void {
    if (this.audio) {
      // SFX
      const sfx: SfxId | null = mapActionToSfx(prev, this.state, action);
      if (sfx) this.audio.playSfx(sfx);

      // BGM
      switch (action.type) {
        case 'RUN_START':
          this.audio.playBgm(mapStageIdToBgmId(action.payload.stageId), { fadeMs: 2000 });
          break;
        case 'DEPTH_ADVANCE': {
          const newStageId = getStageForDepth(action.payload.newDepth);
          const oldStageId = prev.run?.stageId ?? '';
          if (newStageId !== oldStageId) {
            this.audio.playBgm(mapStageIdToBgmId(newStageId), { fadeMs: 2500 });
          }
          break;
        }
        case 'RUN_END':
          this.audio.stopBgm({ fadeMs: 2000 });
          break;
        default:
          break;
      }
    }

    // 광맥 파괴 파티클 이펙트
    if (action.type === 'MINE_HIT') {
      const wasDestroyed =
        (prev.run?.veinsDestroyed ?? 0) < (this.state.run?.veinsDestroyed ?? 0);
      if (wasDestroyed) {
        this.renderer.spawnVeinBurst?.();
      }
    }
  }
}

/** stageId → BgmId 매핑. 콘텐츠 데이터의 stage id와 IAudioManager BgmId를 연결. */
function mapStageIdToBgmId(stageId: string): BgmId {
  switch (stageId) {
    case 'open_pit':    return 'run_open_pit';
    case 'cave':        return 'run_cave';
    case 'deep_shaft':  return 'run_deep_shaft';
    case 'magma_layer': return 'run_magma_layer';
    case 'core':        return 'run_core';
    default:            return 'run_open_pit';
  }
}

/** 액션 → SFX 매핑. 빈 결과면 사운드 재생 안 함. */
function mapActionToSfx(prev: GameState, next: GameState, action: Action): SfxId | null {
  switch (action.type) {
    case 'MINE_HIT': {
      // 광맥 부수면 destroy 사운드, 아니면 hit
      const wasDestroyed =
        (prev.run?.veinsDestroyed ?? 0) < (next.run?.veinsDestroyed ?? 0);
      return wasDestroyed ? 'vein_destroyed' : 'pickaxe_hit';
    }
    case 'CARD_PICKED':
      return 'card_picked';
    case 'CARD_REROLL':
      return 'card_rerolled';
    case 'RUN_END':
      return 'run_end';
    case 'DEPTH_ADVANCE':
      return 'depth_advance';
    default:
      return null;
  }
}
