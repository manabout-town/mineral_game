/**
 * ResultScreen — 런 종료 결과 화면 (Phase 5-C 폴리시).
 *
 * Phase 5-C 개선:
 *   - 런 종료 이유별 타이틀 + 아이콘
 *   - 점수(score) + 베스트런 갱신 배너
 *   - 크리스탈 보상 표시 (스킬 보너스 포함)
 *   - 광석 색상 박스 + 수량/가치 시각화
 *   - 깊이 / 광맥 / 카드 통계 요약
 *
 * Phase 6에서 슬라이드인 + 파티클로 교체.
 */

import { useMemo } from 'react';
import type { GameState } from '../../core/State.ts';
import { content } from '../../core/content/index.ts';
import { computeMetaCrystalBonus } from '../../core/rules/skillTree.ts';

interface Props {
  state: GameState;
  locale?: 'ko' | 'en';
  onClaim: () => void;
}

const REASON_TITLE: Record<string, { ko: string; en: string; icon: string }> = {
  timeout: { ko: '시간 종료', en: "TIME'S UP",  icon: '⏰' },
  quit:    { ko: '런 포기',   en: 'RUN ENDED',  icon: '🚪' },
  death:   { ko: '전투 불능', en: 'DEFEATED',   icon: '💀' },
};

// ─── 광석 행 ─────────────────────────────────────────────────

function OreRow({ oreId, count, locale }: { oreId: string; count: number; locale: 'ko' | 'en' }) {
  const def = content.minerals.get(oreId as never);
  const color = def?.color ?? '#aaa';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          width: 10, height: 10,
          background: color,
          borderRadius: 2,
          flexShrink: 0,
          boxShadow: `0 0 6px ${color}66`,
        }}
      />
      <span style={{ color, fontSize: 13, flex: 1 }}>{def?.name[locale] ?? oreId}</span>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>×{count}</span>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 11, minWidth: 40, textAlign: 'right' }}>
        {((def?.baseValue ?? 1) * count).toFixed(0)}
      </span>
    </div>
  );
}

// ─── 통계 아이템 ─────────────────────────────────────────────

function StatItem({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ color: accent ?? '#fff', fontFamily: 'monospace', fontSize: 18, fontWeight: 800 }}>
        {value}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </span>
    </div>
  );
}

// ─── 메인 ────────────────────────────────────────────────────

export function ResultScreen({ state, locale = 'ko', onClaim }: Props) {
  const finished = state.run?.finished;
  if (!finished) return null;

  const reason = finished.reason ?? 'quit';
  const title = REASON_TITLE[reason] ?? REASON_TITLE.quit!;

  const totalOreValue = useMemo(() =>
    Object.entries(finished.rewardOres).reduce((sum, [id, n]) => {
      const def = content.minerals.get(id as never);
      return sum + (def?.baseValue ?? 1) * n;
    }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finished.rewardOres],
  );

  const metaBonus = useMemo(() => computeMetaCrystalBonus(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.meta.skillTree],
  );
  const totalCrystals = finished.rewardCrystals + metaBonus;

  // 이번 런이 베스트 런인지 — claimReward 직전이라 stats가 아직 갱신 전
  const isBest = totalOreValue > 0 && totalOreValue >= state.meta.stats.bestRunScore;

  const oreEntries = Object.entries(finished.rewardOres).filter(([, n]) => n > 0);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(3px)',
        zIndex: 11,
        gap: 16,
        padding: '20px 16px',
        overflowY: 'auto',
      }}
    >
      {/* 타이틀 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 4 }}>{title.icon}</div>
        <div
          style={{
            color: reason === 'timeout' ? '#ffd166' : '#aaa',
            fontFamily: 'Impact, sans-serif',
            fontSize: 26,
            letterSpacing: 2,
          }}
        >
          {title[locale]}
        </div>
        {isBest && (
          <div
            style={{
              marginTop: 8,
              padding: '3px 14px',
              background: 'linear-gradient(90deg,#c08a2a,#ffd166,#c08a2a)',
              color: '#1a0e00',
              fontFamily: 'Impact, sans-serif',
              fontSize: 12,
              letterSpacing: 2,
              borderRadius: 20,
              display: 'inline-block',
            }}
          >
            ★ {locale === 'ko' ? '베스트 런 갱신!' : 'NEW BEST RUN!'}
          </div>
        )}
      </div>

      {/* 런 통계 */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          padding: '10px 20px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
        }}
      >
        <StatItem label={locale === 'ko' ? '깊이' : 'Depth'} value={state.run?.depth ?? 1} accent="#9ad9ea" />
        <StatItem label={locale === 'ko' ? '광맥' : 'Veins'} value={finished.veinsDestroyed} accent="#d97757" />
        <StatItem label={locale === 'ko' ? '카드' : 'Cards'} value={finished.cardsPicked} accent="#b96bff" />
        <StatItem label={locale === 'ko' ? '점수' : 'Score'} value={totalOreValue.toFixed(0)} accent="#f6c84c" />
      </div>

      {/* 광석 보상 */}
      <div
        style={{
          width: '100%',
          maxWidth: 320,
          padding: '12px 14px',
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          fontFamily: 'monospace',
        }}
      >
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          {locale === 'ko' ? '획득 광석' : 'Ore Rewards'}
        </div>

        {oreEntries.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            {locale === 'ko' ? '없음' : 'None'}
          </div>
        ) : (
          oreEntries.map(([id, n]) => (
            <OreRow key={id} oreId={id} count={n} locale={locale} />
          ))
        )}

        {/* 크리스탈 보상 */}
        {totalCrystals > 0 && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: '#b9f2ff', fontWeight: 700, fontSize: 15 }}>
                💎 +{totalCrystals}
              </span>
              {metaBonus > 0 && (
                <span style={{ color: '#9ad9ea', fontSize: 10 }}>
                  {locale === 'ko' ? `스킬 보너스 +${metaBonus}` : `Skill bonus +${metaBonus}`}
                </span>
              )}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
              {locale === 'ko' ? `보유 💎 ${state.economy.crystals}` : `Have 💎 ${state.economy.crystals}`}
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onClaim}
        style={{
          padding: '13px 36px',
          background: 'linear-gradient(180deg,#2a7a3a,#144a1e)',
          color: '#9aff9a',
          border: '2px solid #2faa55',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'Impact, sans-serif',
          fontSize: 18,
          letterSpacing: 2,
          boxShadow: '0 0 14px #2faa5544',
        }}
      >
        {locale === 'ko' ? '보상 받고 다음 런 ▶' : 'CLAIM & NEXT RUN ▶'}
      </button>
    </div>
  );
}
