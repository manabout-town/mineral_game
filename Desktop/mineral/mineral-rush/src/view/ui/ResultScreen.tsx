/**
 * ResultScreen — 런 종료 후 결과 화면 (임시 React).
 *
 * Phase 3에서 픽셀 아트 / 보상 애니메이션으로 교체.
 */

import type { GameState } from '../../core/State.ts';
import { content } from '../../core/content/index.ts';

interface Props {
  state: GameState;
  locale?: 'ko' | 'en';
  onClaim: () => void;
}

export function ResultScreen({ state, locale = 'ko', onClaim }: Props) {
  const finished = state.run?.finished;
  if (!finished) return null;

  const totalValue = Object.entries(finished.rewardOres).reduce((sum, [id, n]) => {
    const def = content.minerals.get(id as never);
    return sum + (def?.baseValue ?? 1) * n;
  }, 0);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)',
        zIndex: 11,
        gap: 18,
        padding: 24,
      }}
    >
      <div style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: 28, fontWeight: 800 }}>
        {finished.reason === 'timeout' ? '시간 종료' : '런 종료'}
      </div>
      <div
        style={{
          color: '#fff',
          fontFamily: 'sans-serif',
          fontSize: 14,
          opacity: 0.85,
          textAlign: 'center',
        }}
      >
        부순 광맥: <strong>{finished.veinsDestroyed}</strong> · 카드:{' '}
        <strong>{finished.cardsPicked}</strong>
      </div>

      <div
        style={{
          minWidth: 280,
          padding: 16,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 14,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>획득 광석</div>
        {Object.keys(finished.rewardOres).length === 0 ? (
          <div style={{ opacity: 0.6 }}>없음</div>
        ) : (
          Object.entries(finished.rewardOres).map(([id, n]) => {
            const def = content.minerals.get(id as never);
            return (
              <div
                key={id}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}
              >
                <span style={{ color: def?.color ?? '#fff' }}>{def?.name[locale] ?? id}</span>
                <span>×{n}</span>
              </div>
            );
          })
        )}
        <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>가치</span>
          <span>{totalValue}</span>
        </div>
      </div>

      <button
        onClick={onClaim}
        style={{
          padding: '12px 32px',
          background: '#1e7a3a',
          color: '#fff',
          border: '1px solid #2faa55',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'sans-serif',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        보상 받고 다음 런
      </button>
    </div>
  );
}
