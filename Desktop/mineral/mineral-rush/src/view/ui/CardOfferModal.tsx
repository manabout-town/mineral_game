/**
 * CardOfferModal — 카드 선택 모달 (Phase 5-B 폴리시).
 *
 * Phase 5-B 개선:
 *   - 레어리티별 광택 외곽선 그림자 (glow)
 *   - 카드 효과 타입별 색상 레이블
 *   - 카드 아이콘 이모지 매핑
 *   - hover 시 부드러운 확대 (scale + boxShadow transition)
 *   - 레어리티 한글 표시 + 등급 뱃지
 *   - 크리스탈 잔액 / 리롤 비용 상태 표시
 *
 * Phase 6에서 픽셀 아트 + 슬라이드인 애니메이션으로 교체.
 */

import { useState } from 'react';
import type { GameState, CardRarity } from '../../core/State.ts';
import { content } from '../../core/content/index.ts';
import type { CardId } from '../../shared/ids.ts';

interface Props {
  state: GameState;
  locale?: 'ko' | 'en';
  onPick: (cardId: string) => void;
  onReroll: (cost: number) => void;
}

// ─── 레어리티 스타일 ──────────────────────────────────────────

const RARITY_BG: Record<CardRarity, string> = {
  common:    'linear-gradient(160deg,#3a3a3a 0%,#1e1e1e 100%)',
  rare:      'linear-gradient(160deg,#1e4a7a 0%,#0a1e3a 100%)',
  epic:      'linear-gradient(160deg,#5a2a82 0%,#1e0a34 100%)',
  legendary: 'linear-gradient(160deg,#c08a2a 0%,#5a3000 100%)',
};

const RARITY_BORDER: Record<CardRarity, string> = {
  common:    '#666',
  rare:      '#54a0ff',
  epic:      '#b96bff',
  legendary: '#ffd166',
};

const RARITY_GLOW: Record<CardRarity, string> = {
  common:    '0 0 0px transparent',
  rare:      '0 0 18px #54a0ff55, 0 0 4px #54a0ff88',
  epic:      '0 0 22px #b96bff66, 0 0 6px #b96bff99',
  legendary: '0 0 28px #ffd16688, 0 0 8px #ffd166cc',
};

const RARITY_LABEL: Record<CardRarity, { ko: string; en: string; color: string }> = {
  common:    { ko: '일반',     en: 'Common',    color: '#aaa' },
  rare:      { ko: '희귀',     en: 'Rare',      color: '#54a0ff' },
  epic:      { ko: '영웅',     en: 'Epic',      color: '#b96bff' },
  legendary: { ko: '전설',     en: 'Legendary', color: '#ffd166' },
};

// ─── 카드 효과 아이콘 ─────────────────────────────────────────

const EFFECT_ICON: Record<string, string> = {
  damage_mul:         '⚔️',
  combo_window_ms:    '⏱️',
  ore_value_mul:      '💰',
  drop_rate_mul:      '✨',
  combo_max_bonus:    '🔥',
  crystal_bonus:      '💎',
  heal_hp:            '❤️',
  run_duration_bonus: '⏳',
  combo_start:        '🎯',
};

const EFFECT_COLOR: Record<string, string> = {
  damage_mul:         '#ff7675',
  combo_window_ms:    '#74b9ff',
  ore_value_mul:      '#fdcb6e',
  drop_rate_mul:      '#a29bfe',
  combo_max_bonus:    '#fd79a8',
  crystal_bonus:      '#b9f2ff',
  heal_hp:            '#55efc4',
  run_duration_bonus: '#81ecec',
  combo_start:        '#ffeaa7',
};

function formatMagnitude(effect: string, magnitude: number): string {
  if (effect.endsWith('_ms')) return `+${magnitude | 0}ms`;
  if (effect.endsWith('_mul')) return `×${(1 + magnitude).toFixed(2)}`;
  return `+${magnitude}`;
}

// ─── 카드 컴포넌트 ────────────────────────────────────────────

interface CardProps {
  cardId: string;
  rarity: CardRarity;
  locale: 'ko' | 'en';
  onPick: (id: string) => void;
}

function CardButton({ cardId, rarity, locale, onPick }: CardProps) {
  const [hovered, setHovered] = useState(false);
  const def = content.cards.get(cardId as CardId);
  if (!def) return null;

  const rarityInfo = RARITY_LABEL[rarity];
  const icon = EFFECT_ICON[def.effect] ?? '🃏';
  const effectColor = EFFECT_COLOR[def.effect] ?? '#ddd';
  const magnitudeLabel = formatMagnitude(def.effect, def.magnitude);

  return (
    <button
      onClick={() => onPick(cardId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 176,
        minHeight: 252,
        padding: '12px 12px 14px',
        background: RARITY_BG[rarity],
        color: '#fff',
        border: `2px solid ${RARITY_BORDER[rarity]}`,
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        boxShadow: hovered
          ? RARITY_GLOW[rarity].replace('55', 'aa').replace('66', 'bb').replace('88', 'cc')
          : RARITY_GLOW[rarity],
        transform: hovered ? 'translateY(-6px) scale(1.03)' : 'translateY(0) scale(1)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 레어리티 배경 광택 */}
      {rarity === 'legendary' && (
        <div
          style={{
            position: 'absolute',
            top: -30,
            left: -30,
            width: 80,
            height: 80,
            background: 'rgba(255,209,102,0.08)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 레어리티 뱃지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 1,
            color: rarityInfo.color,
            background: `${RARITY_BORDER[rarity]}22`,
            padding: '2px 6px',
            borderRadius: 3,
            border: `1px solid ${RARITY_BORDER[rarity]}44`,
          }}
        >
          {rarityInfo[locale]}
        </span>
      </div>

      {/* 아이콘 */}
      <div style={{ fontSize: 32, lineHeight: 1, marginBottom: 8 }}>{icon}</div>

      {/* 카드 이름 */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          lineHeight: 1.25,
          marginBottom: 6,
          color: rarity === 'legendary' ? '#ffd166' : '#fff',
        }}
      >
        {def.name[locale]}
      </div>

      {/* 설명 */}
      <div style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)', flex: 1 }}>
        {def.description[locale]}
      </div>

      {/* 효과 레이블 */}
      <div
        style={{
          marginTop: 10,
          padding: '6px 8px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 6,
          border: `1px solid ${effectColor}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 10, color: effectColor, opacity: 0.85 }}>
          {def.effect.replace(/_/g, ' ')}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: effectColor }}>
          {magnitudeLabel}
        </span>
      </div>
    </button>
  );
}

// ─── 메인 모달 ────────────────────────────────────────────────

export function CardOfferModal({ state, locale = 'ko', onPick, onReroll }: Props) {
  const offer = state.run?.cardOffer;
  if (!offer) return null;

  const canReroll = state.economy.crystals >= offer.rerollCost;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(2px)',
        zIndex: 10,
        gap: 20,
        padding: 16,
      }}
    >
      {/* 헤더 */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            color: '#ffd166',
            fontFamily: 'Impact, sans-serif',
            fontSize: 26,
            letterSpacing: 2,
          }}
        >
          {locale === 'ko' ? '✦ 카드 선택 ✦' : '✦ CARD OFFER ✦'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', fontSize: 12, marginTop: 4 }}>
          {locale === 'ko' ? '하나를 골라 이번 런에 적용' : 'Pick one to apply this run'}
        </div>
      </div>

      {/* 카드 리스트 */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {offer.cards.map(({ cardId, rarity }) => (
          <CardButton
            key={cardId}
            cardId={cardId}
            rarity={rarity}
            locale={locale}
            onPick={onPick}
          />
        ))}
      </div>

      {/* 리롤 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onReroll(offer.rerollCost)}
          disabled={!canReroll}
          style={{
            padding: '9px 24px',
            background: canReroll
              ? 'linear-gradient(180deg,#7a5a1a,#4a3000)'
              : 'rgba(80,60,20,0.4)',
            color: canReroll ? '#ffd166' : '#6a5a30',
            border: `1px solid ${canReroll ? '#c08a2a' : '#4a3a10'}`,
            borderRadius: 6,
            cursor: canReroll ? 'pointer' : 'not-allowed',
            fontFamily: 'monospace',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1,
            transition: 'opacity 0.1s',
          }}
        >
          🔄 {locale === 'ko' ? '리롤' : 'Reroll'} — 💎 {offer.rerollCost}
        </button>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', fontSize: 11 }}>
          {locale === 'ko' ? `잔액 💎 ${state.economy.crystals}` : `Balance 💎 ${state.economy.crystals}`}
          {!canReroll && (
            <span style={{ color: '#ff6b6b', marginLeft: 8 }}>
              ({locale === 'ko' ? '부족' : 'insufficient'})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
