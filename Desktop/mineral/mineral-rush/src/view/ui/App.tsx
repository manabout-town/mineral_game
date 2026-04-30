/**
 * App — Phase 2 React 셸 + 카드 모달 + 결과 화면.
 *
 * Phase 3에서 본격 메인 메뉴 / 스킬 트리 화면 추가.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from '../Game.ts';
import { PixiGameRenderer } from '../pixi/PixiGameRenderer.ts';
import { WebAdapter } from '../../platform/adapters/WebAdapter.ts';
import { LocalStorageAdapter } from '../../platform/LocalStorageAdapter.ts';
import { WebCryptoSigner } from '../../platform/WebCryptoSigner.ts';
import { PersistenceSystem } from '../../systems/PersistenceSystem.ts';
import { logger } from '../../systems/Logger.ts';
import { CardOfferModal } from './CardOfferModal.tsx';
import { ResultScreen } from './ResultScreen.tsx';
import { asGameTimeMs } from '../../core/reducers/runReducer.ts';
import type { GameState } from '../../core/State.ts';
import type { CardId } from '../../shared/ids.ts';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new PixiGameRenderer();
    const platform = new WebAdapter();
    const storage = new LocalStorageAdapter();
    const signer = new WebCryptoSigner(import.meta.env.VITE_DEV_HMAC_SECRET);
    const persistence = new PersistenceSystem(storage, signer);
    const g = new Game(renderer, platform, persistence);
    gameRef.current = g;

    g.boot(containerRef.current)
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
    };
  }, []);

  // game 인스턴스의 state를 React에 동기화
  const state = useSyncExternalStore(
    (cb) => (game ? game.subscribe(() => cb()) : () => {}),
    () => game?.getState() ?? null,
  );

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {state && state.run?.cardOffer && (
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

      {state && state.run?.finished && (
        <ResultScreen state={state} onClaim={() => game?.claimRewardAndStartNewRun()} />
      )}

      {bootError && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
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
        }}
      >
        v{import.meta.env.VITE_GAME_VERSION ?? '0.0.1'} · schemaV{state?.schemaVersion ?? '?'} ·
        runs {state?.meta.stats.totalRuns ?? 0} ·{' '}
        💎{state?.economy.crystals ?? 0}
      </div>
    </div>
  );
}

function getElapsed(state: GameState) {
  if (!state.run) return asGameTimeMs(0);
  return asGameTimeMs(state.run.duration - state.run.remaining);
}
