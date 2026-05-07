/**
 * App — Phase 3 React 셸.
 *
 * 화면 라우팅:
 *   - bootConfig 로딩 중 → 스피너
 *   - maintenance.enabled → MaintenanceScreen
 *   - needsForceUpdate    → 강제 업데이트 안내
 *   - run이 null          → LobbyScreen (스킬트리 / PLAY)
 *   - run.cardOffer       → CardOfferModal
 *   - run.finished        → ResultScreen
 *   - 그 외               → 인게임 (PauseButton)
 *
 * 환경 분기:
 *   - VITE_SUPABASE_URL 설정 시 → SupabaseBootConfigSource + SupabaseRunSubmitter
 *   - 미설정 시 → StubBootConfigSource + StubRunSubmitter (로컬 개발)
 *
 * 5계명 §1: 이 컴포넌트는 GameState를 읽기만, 변경은 game.dispatch / game.* 콜백으로만.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from '../Game.ts';
import { PixiGameRenderer } from '../pixi/PixiGameRenderer.ts';
import { WebAdapter } from '../../platform/adapters/WebAdapter.ts';
import { LocalStorageAdapter } from '../../platform/LocalStorageAdapter.ts';
import { WebCryptoSigner } from '../../platform/WebCryptoSigner.ts';
import { PersistenceSystem } from '../../systems/PersistenceSystem.ts';
import { Telemetry } from '../../platform/Telemetry.ts';
import { WebAudioManager } from '../../platform/audio/WebAudioManager.ts';
import { StubRunSubmitter } from '../../platform/runSubmitter/StubRunSubmitter.ts';
import { StubBootConfigSource } from '../../platform/bootConfig/StubBootConfigSource.ts';
import { SupabaseBootConfigSource } from '../../platform/bootConfig/SupabaseBootConfigSource.ts';
import { SupabaseRunSubmitter } from '../../platform/runSubmitter/SupabaseRunSubmitter.ts';
import {
  DEFAULT_BOOT_CONFIG,
  needsForceUpdate,
  type BootConfig,
} from '../../platform/IBootConfig.ts';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
import { logger } from '../../systems/Logger.ts';
import { CardOfferModal } from './CardOfferModal.tsx';
import { ResultScreen } from './ResultScreen.tsx';
import { LobbyScreen } from './LobbyScreen.tsx';
import { LoadingScreen } from './LoadingScreen.tsx';
import { PauseButton } from './PauseButton.tsx';
import { MaintenanceScreen } from './MaintenanceScreen.tsx';
import { asGameTimeMs } from '../../core/reducers/runReducer.ts';
import type { GameState } from '../../core/State.ts';
import type { CardId, SkillNodeId } from '../../shared/ids.ts';

const GAME_VERSION = import.meta.env.VITE_GAME_VERSION ?? '0.0.1';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const telemetryRef = useRef<Telemetry | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [bootConfig, setBootConfig] = useState<BootConfig | null>(null);

  // ① Boot config 페치 — 게임 init 전에 먼저 실행
  useEffect(() => {
    const src = SUPABASE_URL && SUPABASE_ANON
      ? new SupabaseBootConfigSource({ baseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON })
      : new StubBootConfigSource();
    src
      .fetch()
      .then((cfg) => setBootConfig(cfg))
      .catch((e) => {
        logger.warn('BootConfig fetch failed, using default', { error: String(e) });
        setBootConfig(DEFAULT_BOOT_CONFIG);
      });
  }, []);

  // ② Boot config 확보 후 게임 초기화
  useEffect(() => {
    if (!bootConfig) return;
    if (bootConfig.maintenance.enabled) return; // MaintenanceScreen 표시만
    if (!containerRef.current) return;

    const renderer = new PixiGameRenderer();
    const platform = new WebAdapter();
    const storage = new LocalStorageAdapter();
    const signer = new WebCryptoSigner(import.meta.env.VITE_DEV_HMAC_SECRET);
    const persistence = new PersistenceSystem(storage, signer);
    const telemetry = new Telemetry(platform);
    const audio = new WebAudioManager();
    // Supabase 환경변수가 있으면 실제 제출 사용, 없으면 Stub
    const runSubmitter = SUPABASE_URL && SUPABASE_ANON
      ? new SupabaseRunSubmitter({
          endpoint: `${SUPABASE_URL}/functions/v1/validate-run`,
          authToken: SUPABASE_ANON,
          signer,
        })
      : new StubRunSubmitter();
    telemetryRef.current = telemetry;

    const g = new Game({ renderer, platform, persistence, telemetry, audio, runSubmitter });
    gameRef.current = g;

    // 첫 포인터 다운 시 AudioContext resume (브라우저 정책)
    const resumeAudio = () => { void audio.resumeOnUserGesture(); };
    window.addEventListener('pointerdown', resumeAudio, { once: true });

    g.boot(containerRef.current, 'lobby')
      .then(() => {
        logger.info('Game booted');
        setGame(g);
      })
      .catch((e) => {
        logger.error('E_BOOT_FAILED', 'Game boot failed', { error: String(e) });
        setBootError(String(e));
      });

    return () => {
      g.destroy();
      gameRef.current = null;
      telemetryRef.current = null;
    };
  }, [bootConfig]);

  // game 인스턴스의 state를 React에 동기화
  const state = useSyncExternalStore(
    (cb) => (game ? game.subscribe(() => cb()) : () => {}),
    () => game?.getState() ?? null,
  );

  // game이 아직 초기화 중이면 로딩 화면 유지 (done=false → 페이드아웃 안 함)
  // game이 준비되면 done=true → LoadingScreen이 스스로 페이드아웃
  const gameReady = !!game;

  const eventCount = telemetryRef.current?.getEventCount() ?? 0;
  const telemetryMeta = telemetryRef.current?.getMeta() ?? null;

  const handleExportTelemetry = () => {
    if (!telemetryRef.current) return;
    const { url, filename } = telemetryRef.current.exportAsBlobUrl();
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleResetSave = () => {
    if (!confirm('정말 모든 저장 데이터를 초기화할까요? (되돌릴 수 없습니다)')) return;
    try {
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      logger.error('E_RESET_FAILED', 'Save reset failed', { error: String(e) });
    }
  };

  // ─── 특수 화면 분기 ──────────────────────────────────────────
  // LoadingScreen은 bootConfig가 없는 동안 표시; done=true가 되면 스스로 페이드아웃
  if (!bootConfig) {
    return <LoadingScreen done={false} />;
  }

  if (bootConfig.maintenance.enabled) {
    return (
      <MaintenanceScreen
        mode="maintenance"
        messageKo={bootConfig.maintenance.messageKo}
        messageEn={bootConfig.maintenance.messageEn}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (needsForceUpdate(GAME_VERSION, bootConfig)) {
    return (
      <MaintenanceScreen
        mode="force_update"
        messageKo={`최소 지원 버전: ${bootConfig.maintenance.minSupportedVersion}`}
        messageEn={`Minimum supported version: ${bootConfig.maintenance.minSupportedVersion}`}
      />
    );
  }

  // ─── 인게임 화면 분기 ─────────────────────────────────────────
  const showLobby = !!state && state.run === null;
  const showResult = !!state && !!state.run?.finished;
  const showCardOffer = !!state && !!state.run?.cardOffer && !showResult;
  const inGame = !!state && !!state.run && !state.run.finished;

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0d0b08' }}>
      {/* PixiJS 캔버스 컨테이너 */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* 게임 부팅 로딩 오버레이 (PixiJS init 전) */}
      <LoadingScreen done={gameReady} />

      {state && showLobby && (
        <LobbyScreen
          state={state}
          onPlay={(depth) => game?.startNewRun(undefined, depth)}
          onUnlock={(nodeId: SkillNodeId) =>
            game?.dispatch({ type: 'SKILL_NODE_UNLOCK', payload: { nodeId } })
          }
          onLevelUp={(nodeId: SkillNodeId) =>
            game?.dispatch({ type: 'SKILL_NODE_LEVEL_UP', payload: { nodeId } })
          }
          onExportTelemetry={handleExportTelemetry}
          onResetSave={handleResetSave}
          eventCount={eventCount}
          telemetryMeta={telemetryMeta}
        />
      )}

      {/* Timber Rush: 풀스크린 스와이프 오버레이 (인게임 + 카드오퍼 없을 때) */}
      {state && inGame && !showCardOffer && (
        <SwipeOverlay
          dangerSide={state.run?.vein.dangerSide ?? null}
          onSwipe={(side) => game?.hitSide(side)}
        />
      )}

      {state && inGame && !showCardOffer && (
        <PauseButton onPause={() => game?.exitToLobby()} />
      )}

      {state && showCardOffer && (
        <CardOfferModal
          state={state}
          onPick={(cardId) =>
            game?.dispatch({
              type: 'CARD_PICKED',
              payload: { t: getElapsed(state), cardId: cardId as CardId },
            })
          }
          onReroll={(cost) =>
            game?.dispatch({
              type: 'CARD_REROLL',
              payload: { t: getElapsed(state), cost },
            })
          }
        />
      )}

      {state && showResult && (
        <ResultScreen state={state} onClaim={() => game?.claimRewardAndStartNewRun()} />
      )}

      {bootError && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 60,
            padding: 12,
            background: '#7a1f1f',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: 12,
            maxWidth: 380,
            whiteSpace: 'pre-wrap',
          }}
        >
          BOOT ERROR: {bootError}
        </div>
      )}

      <DebugBar state={state} eventCount={eventCount} />
    </div>
  );
}

function DebugBar({
  state,
  eventCount,
}: {
  state: GameState | null;
  eventCount: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        padding: 8,
        background: 'rgba(0,0,0,0.6)',
        color: '#9aff9a',
        fontFamily: 'monospace',
        fontSize: 11,
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    >
      v{GAME_VERSION} · schemaV
      {state?.schemaVersion ?? '?'} · runs {state?.meta.stats.totalRuns ?? 0} ·{' '}
      💎{state?.economy.crystals ?? 0} · ev{eventCount}
    </div>
  );
}

function getElapsed(state: GameState) {
  if (!state.run) return asGameTimeMs(0);
  return asGameTimeMs(state.run.duration - state.run.remaining);
}

// ─── Timber Rush 풀스크린 스와이프 오버레이 ─────────────────────
// 화면 어디서나 좌우 드래그 → 채굴 방향 결정 (한 손 조작 최적화)

function SwipeOverlay({
  dangerSide,
  onSwipe,
}: {
  dangerSide: 'left' | 'right' | null;
  onSwipe: (side: 'left' | 'right') => void;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dispatched = useRef(false);
  const [trailX, setTrailX] = useState<number | null>(null);
  const [trailDir, setTrailDir] = useState<'left' | 'right' | null>(null);
  const [trailVisible, setTrailVisible] = useState(false);
  const trailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SWIPE_THRESHOLD = 22; // px — 이 거리 초과 + 수평 우세 시 발동

  const showTrail = (x: number, dir: 'left' | 'right') => {
    setTrailX(x);
    setTrailDir(dir);
    setTrailVisible(true);
    if (trailTimer.current) clearTimeout(trailTimer.current);
    trailTimer.current = setTimeout(() => setTrailVisible(false), 320);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    dispatched.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startX.current === null || startY.current === null || dispatched.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) <= Math.abs(dy)) return; // 수직 우세면 무시
    dispatched.current = true;
    const side: 'left' | 'right' = dx > 0 ? 'right' : 'left';
    showTrail(e.clientX, side);
    onSwipe(side);
  };

  const handlePointerUp = () => {
    startX.current = null;
    startY.current = null;
    dispatched.current = false;
  };

  // 위험 방향 힌트 그라디언트 (반투명)
  const dangerGradient = dangerSide === 'left'
    ? 'linear-gradient(to right, rgba(220,40,40,0.13) 0%, transparent 38%)'
    : dangerSide === 'right'
    ? 'linear-gradient(to left, rgba(220,40,40,0.13) 0%, transparent 38%)'
    : 'none';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        background: dangerGradient,
        // 최상단 힌트: 위험 방향 텍스트
        pointerEvents: 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 위험 방향 고정 힌트 아이콘 */}
      {dangerSide && (
        <div
          style={{
            position: 'absolute',
            top: '42%',
            [dangerSide]: 14,
            fontSize: 28,
            opacity: 0.75,
            pointerEvents: 'none',
            animation: 'dangerPulse 0.8s ease-in-out infinite alternate',
          }}
        >
          🚫
        </div>
      )}

      {/* 스와이프 트레일 (발동 시 잠깐 표시) */}
      {trailVisible && trailX !== null && trailDir !== null && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: trailX,
            transform: 'translate(-50%, -50%)',
            fontSize: 36,
            opacity: 0.9,
            pointerEvents: 'none',
            animation: 'swipeFlash 0.32s ease-out forwards',
          }}
        >
          {trailDir === 'right' ? '⟶' : '⟵'}
        </div>
      )}

      {/* 중앙 스와이프 가이드 힌트 (항상 표시, 흐리게) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          opacity: 0.18,
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: 30, color: '#fff' }}>←</span>
        <span style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace', letterSpacing: 2 }}>SWIPE</span>
        <span style={{ fontSize: 30, color: '#fff' }}>→</span>
      </div>

      <style>{`
        @keyframes dangerPulse {
          from { opacity: 0.55; transform: scale(1); }
          to   { opacity: 0.95; transform: scale(1.18); }
        }
        @keyframes swipeFlash {
          0%   { opacity: 0.9; transform: translate(-50%, -50%) scale(1.2); }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(0.7); }
        }
      `}</style>
    </div>
  );
}
