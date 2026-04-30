/**
 * CardOfferModal — 카드 선택 모달 (임시 React).
 *
 * Phase 3에서 픽셀 아트 + 애니메이션으로 교체. 본 컴포넌트는 핵심 플로우 검증용.
 */

import type { GameState, CardRarity } from '../../core/State.ts';
import { content } from '../../core/content/index.ts';

interface Props {
  state: GameState;
  locale?: 'ko' | 'en';
  onPick: (cardId: string) => void;
  onReroll: (cost: number) => void;
}

const RARITY_BG: Record<CardRarity, string> = {
  common: 'linear-gradient(180deg,#3a3a3a,#222)',
  rare: 'linear-gradient(180deg,#1e4a7a,#0d2440)',
  epic: 'linear-gradient(180deg,#5a2a82,#2a0e44)',
  legendary: 'linear-gradient(180deg,#c08a2a,#5a3c0e)',
};

const RARITY_BORDER: Record<CardRarity, string> = {
  common: '#777',
  rare: '#54a0ff',
  epic: '#b96bff',
  legendary: '#ffd166',
};

export function CardOfferModal({ state, locale = 'ko', onPick, onReroll }: Props) {
  const offer = state.run?.cardOffer;
  if (!offer) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        zIndex: 10,
        gap: 16,
        padding: 16,
      }}
    >
      <div style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: 22, fontWeight: 700 }}>
        카드를 선택하세요
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {offer.cards.map(({ cardId, rarity }) => {
          const def = content.cards.get(cardId);
          if (!def) return null;
          return (
            <button
              key={cardId}
              onClick={() => onPick(cardId)}
              style={{
                width: 200,
                minHeight: 240,
                padding: 14,
                background: RARITY_BG[rarity],
                color: '#fff',
                border: `2px solid ${RARITY_BORDER[rarity]}`,
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'sans-serif',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase' }}>{rarity}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{def.name[locale]}</div>
              <div style={{ fontSize: 14, lineHeight: 1.4, opacity: 0.92 }}>
                {def.description[locale]}
              </div>
              <div style={{ marginTop: 'auto', fontSize: 12, opacity: 0.6 }}>
                effect: {def.effect}
                <br />
                magnitude: {def.magnitude}
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onReroll(offer.rerollCost)}
        disabled={state.economy.crystals < offer.rerollCost}
        style={{
          padding: '8px 20px',
          background: '#7a5a1a',
          color: state.economy.crystals < offer.rerollCost ? '#999' : '#fff',
          border: '1px solid #b8862a',
          borderRadius: 6,
          cursor: state.economy.crystals < offer.rerollCost ? 'not-allowed' : 'pointer',
          fontFamily: 'sans-serif',
          fontSize: 14,
        }}
      >
        리롤 ({offer.rerollCost} 💎)
      </button>
    </div>
  );
}
