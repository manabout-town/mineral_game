/**
 * SkillTreePanel — Lobby 화면용 스킬트리 패널 (Phase 3 강화).
 *
 * Phase 3 개선:
 *   - 노드 클릭 시 상세 정보 패널 (이름/설명/현재효과/다음레벨효과/비용)
 *   - prerequisite 연결선 해금 여부 색상 + 점선 구분
 *   - 레벨 진행 바
 *   - 브랜치별 색상 범례
 *   - 잔액 부족 시 비용 빨간색 표시
 *
 * Phase 4에서 픽셀 아트 아이콘 + 애니메이션으로 교체.
 */

import { useState } from 'react';
import {
  SKILL_NODES,
  computeNodeCost,
  isUnlockable,
  type SkillNodeDef,
} from '../../core/rules/skillTree.ts';
import type { GameState } from '../../core/State.ts';
import type { SkillNodeId } from '../../shared/ids.ts';

interface Props {
  state: GameState;
  locale?: 'ko' | 'en';
  onUnlock: (nodeId: SkillNodeId) => void;
  onLevelUp: (nodeId: SkillNodeId) => void;
}

const BRANCH_COLOR: Record<string, string> = {
  pickaxe:   '#d97757',
  ore_value: '#f6c84c',
  combo:     '#54a0ff',
  drop:      '#9ad9ea',
  crystal:   '#b96bff',
  meta:      '#50c878',
};

const BRANCH_LABEL: Record<string, { ko: string; en: string }> = {
  pickaxe:   { ko: '⛏ 곡괭이',   en: '⛏ Pickaxe' },
  ore_value: { ko: '💰 광석가치', en: '💰 Ore Value' },
  combo:     { ko: '🔥 콤보',    en: '🔥 Combo' },
  drop:      { ko: '✨ 드랍률',   en: '✨ Drop Rate' },
  crystal:   { ko: '💎 크리스탈', en: '💎 Crystal' },
  meta:      { ko: '🌟 특성',    en: '🌟 Meta' },
};

function effectLabel(def: SkillNodeDef, level: number, locale: 'ko' | 'en'): string {
  const { effect } = def;
  const v = effect.magnitudePerLevel * level;
  switch (effect.kind) {
    case 'damage_mul':
      return locale === 'ko' ? `데미지 +${v.toFixed(2)}배` : `Damage +${v.toFixed(2)}x`;
    case 'combo_window_ms':
    case 'starting_combo_window_ms':
      return locale === 'ko' ? `콤보 창 +${v | 0}ms` : `Combo window +${v | 0}ms`;
    case 'ore_value_mul':
      return locale === 'ko' ? `광석 가치 +${v.toFixed(2)}배` : `Ore value +${v.toFixed(2)}x`;
    case 'drop_rate_mul':
      return locale === 'ko' ? `드랍률 +${v.toFixed(2)}배` : `Drop rate +${v.toFixed(2)}x`;
    case 'combo_max_bonus':
      return locale === 'ko' ? `콤보 데미지 +${v.toFixed(2)}/콤보` : `Combo dmg +${v.toFixed(2)}/combo`;
    case 'crystal_run_bonus':
      return locale === 'ko' ? `런당 💎 +${v | 0}` : `+${v | 0} 💎/run`;
    default:
      return '';
  }
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────

export function SkillTreePanel({ state, locale = 'ko', onUnlock, onLevelUp }: Props) {
  const [selected, setSelected] = useState<SkillNodeId | null>(null);

  const nodes = [...SKILL_NODES.values()];
  const W = 520;
  const H = 380;
  const NODE_R = 20;

  const selectedDef = selected ? (SKILL_NODES.get(selected) ?? null) : null;
  const selectedState = selected ? state.meta.skillTree[selected] : undefined;
  const selectedLevel = selectedState?.level ?? 0;
  const selectedUnlocked = !!selectedState?.unlocked;
  const selectedCost = selectedDef ? computeNodeCost(selectedDef, selectedLevel) : 0;
  const selectedMaxed = selectedDef ? selectedLevel >= selectedDef.maxLevel : false;
  const selectedCanBuy = selectedDef
    ? selectedUnlocked
      ? !selectedMaxed && state.economy.crystals >= selectedCost
      : isUnlockable(state, selected!) && state.economy.crystals >= selectedCost
    : false;

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 560,
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: 16, fontWeight: 700 }}>
          스킬 트리
        </div>
        <div style={{ color: '#b9f2ff', fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
          💎 {state.economy.crystals}
        </div>
      </div>

      {/* 트리 캔버스 */}
      <div
        style={{
          position: 'relative',
          width: W,
          height: H,
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* 연결선 SVG */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {nodes.flatMap((n) =>
            n.prerequisites.map((preId) => {
              const pre = SKILL_NODES.get(preId);
              if (!pre) return null;
              const x1 = pre.position.x * W;
              const y1 = pre.position.y * H;
              const x2 = n.position.x * W;
              const y2 = n.position.y * H;
              const preState = state.meta.skillTree[preId];
              const connected = !!preState?.unlocked && (preState?.level ?? 0) >= 1;
              return (
                <line
                  key={`${preId}->${n.id}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={connected ? (BRANCH_COLOR[n.branch] ?? '#888') : 'rgba(255,255,255,0.12)'}
                  strokeWidth={connected ? 2 : 1}
                  strokeDasharray={connected ? undefined : '5 3'}
                  opacity={connected ? 0.65 : 0.35}
                />
              );
            }),
          )}
        </svg>

        {/* 노드 버튼 */}
        {nodes.map((n) => {
          const s = state.meta.skillTree[n.id as SkillNodeId];
          const unlocked = !!s?.unlocked;
          const level = s?.level ?? 0;
          const maxed = level >= n.maxLevel;
          const cost = computeNodeCost(n, level);
          const canUnlock = !unlocked && isUnlockable(state, n.id as SkillNodeId);
          const affordable = state.economy.crystals >= cost;
          const isSelected = selected === n.id;
          const baseColor = BRANCH_COLOR[n.branch] ?? '#aaa';

          const x = n.position.x * W;
          const y = n.position.y * H;

          let borderColor = 'rgba(255,255,255,0.15)';
          let bgColor = 'rgba(0,0,0,0.6)';
          let opacity = 0.4;

          if (unlocked && maxed) {
            bgColor = `${baseColor}44`; borderColor = baseColor; opacity = 1;
          } else if (unlocked) {
            bgColor = `${baseColor}22`; borderColor = baseColor; opacity = 1;
          } else if (canUnlock) {
            borderColor = affordable ? baseColor : '#aa3333'; opacity = affordable ? 0.85 : 0.6;
          }

          return (
            <button
              key={n.id}
              onClick={() => setSelected(isSelected ? null : (n.id as SkillNodeId))}
              title={`${n.name[locale]} (${n.branch})\n${n.description[locale]}`}
              style={{
                position: 'absolute',
                left: x - NODE_R,
                top: y - NODE_R,
                width: NODE_R * 2,
                height: NODE_R * 2,
                background: isSelected ? `${baseColor}66` : bgColor,
                border: `2px solid ${isSelected ? baseColor : borderColor}`,
                borderRadius: 6,
                cursor: 'pointer',
                opacity,
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                boxShadow: isSelected ? `0 0 10px ${baseColor}99` : 'none',
                transition: 'box-shadow 0.12s, border-color 0.12s',
              }}
            >
              <span style={{ fontSize: 11, lineHeight: 1 }}>
                {maxed ? '✓' : `${level}/${n.maxLevel}`}
              </span>
              {n.maxLevel > 1 && (
                <div
                  style={{
                    width: 28,
                    height: 3,
                    background: 'rgba(255,255,255,0.15)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (level / n.maxLevel) * 100)}%`,
                      height: '100%',
                      background: baseColor,
                      borderRadius: 2,
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택된 노드 상세 패널 */}
      {selectedDef ? (
        <div
          style={{
            background: 'rgba(0,0,0,0.5)',
            border: `1px solid ${BRANCH_COLOR[selectedDef.branch] ?? '#888'}55`,
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: BRANCH_COLOR[selectedDef.branch] ?? '#fff', fontWeight: 700, fontSize: 14 }}>
              {selectedDef.name[locale]}
            </span>
            <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 11 }}>
              {BRANCH_LABEL[selectedDef.branch]?.[locale] ?? selectedDef.branch}
            </span>
          </div>

          <div style={{ color: '#bbb', fontSize: 12, lineHeight: 1.5 }}>
            {selectedDef.description[locale]}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: 'monospace', fontSize: 12 }}>
            <span style={{ color: '#9aff9a' }}>
              현재: {selectedUnlocked && selectedLevel > 0
                ? effectLabel(selectedDef, selectedLevel, locale)
                : locale === 'ko' ? '잠금됨' : 'Locked'}
            </span>
            {!selectedMaxed && (
              <span style={{ color: '#ffcc66' }}>
                다음 Lv: {effectLabel(selectedDef, selectedLevel + 1, locale)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>
              Lv {selectedLevel} / {selectedDef.maxLevel}
              {selectedMaxed && <span style={{ color: '#f6c84c', marginLeft: 8 }}>MAX</span>}
            </div>
            {!selectedMaxed && (
              <button
                onClick={() => {
                  if (!selectedCanBuy || !selected) return;
                  if (selectedUnlocked) onLevelUp(selected);
                  else onUnlock(selected);
                }}
                disabled={!selectedCanBuy}
                style={{
                  padding: '5px 14px',
                  background: selectedCanBuy ? '#1a3a1a' : '#1a1a1a',
                  color: selectedCanBuy ? '#9aff9a' : '#555',
                  border: `1px solid ${
                    selectedCanBuy
                      ? '#2c8c2c'
                      : state.economy.crystals < selectedCost
                      ? '#6c2020'
                      : '#333'
                  }`,
                  borderRadius: 4,
                  cursor: selectedCanBuy ? 'pointer' : 'not-allowed',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color: state.economy.crystals < selectedCost ? '#ff6666' : '#b9f2ff',
                  }}
                >
                  💎 {selectedCost}
                </span>
                <span>{selectedUnlocked ? (locale === 'ko' ? '레벨업' : 'Level Up') : (locale === 'ko' ? '해금' : 'Unlock')}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 범례 */
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.entries(BRANCH_LABEL).map(([branch, label]) => (
            <div
              key={branch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontFamily: 'monospace',
                color: BRANCH_COLOR[branch] ?? '#aaa',
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  background: BRANCH_COLOR[branch] ?? '#aaa',
                  borderRadius: 2,
                }}
              />
              {label[locale]}
            </div>
          ))}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontFamily: 'monospace' }}>
            — 노드 클릭 시 상세
          </span>
        </div>
      )}
    </div>
  );
}
