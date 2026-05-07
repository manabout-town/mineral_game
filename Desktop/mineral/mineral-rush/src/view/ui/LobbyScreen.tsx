/**
 * LobbyScreen — Phase 6 메인 메뉴 리디자인.
 *
 * 변경사항:
 *   - 모바일 우선 단일 컬럼 레이아웃
 *   - 탭 네비게이션: [홈 | 스킬트리 | 리더보드 | 설정]
 *   - 크게 PLAY 버튼을 영웅 영역으로
 *   - 설정 탭에 스테이지 직행 / PlaytestPanel 이동
 *
 * 5계명 §1: 이 컴포넌트는 GameState를 읽기만. 변경은 콜백으로만.
 */

import { useMemo, useState } from 'react';
import type { GameState } from '../../core/State.ts';
import type { SkillNodeId } from '../../shared/ids.ts';
import { content } from '../../core/content/index.ts';
import { SkillTreePanel } from './SkillTreePanel.tsx';
import { PlaytestPanel } from './PlaytestPanel.tsx';
import { LeaderboardPanel } from './LeaderboardPanel.tsx';
import { computeMetaCrystalBonus } from '../../core/rules/skillTree.ts';
import type { TelemetryMeta } from '../../platform/Telemetry.ts';

type TabId = 'home' | 'skills' | 'leaderboard' | 'settings';

interface Props {
  state: GameState;
  locale?: 'ko' | 'en';
  onPlay: (depth: number) => void;
  onUnlock: (nodeId: SkillNodeId) => void;
  onLevelUp: (nodeId: SkillNodeId) => void;
  onExportTelemetry: () => void;
  onResetSave: () => void;
  eventCount: number;
  telemetryMeta: Readonly<TelemetryMeta> | null;
}

// ─── 색상 팔레트 ──────────────────────────────────────────────────

const C = {
  bg: '#0d0b08',
  bgCard: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  gold: '#f6c84c',
  goldDim: '#7a5a1a',
  accent: '#d97757',
  accentDim: '#7a3f1f',
  accentBorder: '#f1a282',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
  crystal: '#9ad9ea',
  green: '#5a8a5a',
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

export function LobbyScreen({
  state,
  locale = 'ko',
  onPlay,
  onUnlock,
  onLevelUp,
  onExportTelemetry,
  onResetSave,
  eventCount,
  telemetryMeta,
}: Props) {
  const [tab, setTab] = useState<TabId>('home');

  const totalOres = useMemo(
    () => Object.values(state.economy.ores).reduce((s, n) => s + n, 0),
    [state.economy.ores],
  );

  const metaBonus = useMemo(
    () => computeMetaCrystalBonus(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.meta.skillTree],
  );

  const recommendedDepth =
    state.meta.stats.totalRuns < 5 ? 1 : state.meta.stats.totalRuns < 15 ? 2 : 3;

  const stages = useMemo(
    () => [...content.stages.values()].sort((a, b) => a.depthRange[0] - b.depthRange[0]),
    [],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 12,
        background: `linear-gradient(180deg,#1a1208 0%,${C.bg} 40%)`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── 헤더 ── */}
      <Header crystals={state.economy.crystals} totalOres={totalOres} metaBonus={metaBonus} />

      {/* ── 탭 바 ── */}
      <TabBar active={tab} onChange={setTab} />

      {/* ── 탭 콘텐츠 ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {tab === 'home' && (
          <HomeTab
            state={state}
            recommendedDepth={recommendedDepth}
            onPlay={onPlay}
          />
        )}
        {tab === 'skills' && (
          <div style={{ padding: '16px 12px' }}>
            <SkillTreePanel
              state={state}
              locale={locale}
              onUnlock={onUnlock}
              onLevelUp={onLevelUp}
            />
          </div>
        )}
        {tab === 'leaderboard' && (
          <div style={{ padding: '16px 12px' }}>
            <LeaderboardPanel locale={locale} />
          </div>
        )}
        {tab === 'settings' && (
          <SettingsTab
            state={state}
            locale={locale}
            stages={stages}
            eventCount={eventCount}
            telemetryMeta={telemetryMeta}
            onPlay={onPlay}
            onExportTelemetry={onExportTelemetry}
            onResetSave={onResetSave}
          />
        )}
      </div>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────────

function Header({
  crystals,
  totalOres,
  metaBonus,
}: {
  crystals: number;
  totalOres: number;
  metaBonus: number;
}) {
  return (
    <div
      style={{
        padding: '20px 20px 12px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}
    >
      {/* 타이틀 */}
      <div>
        <div
          style={{
            color: C.gold,
            fontSize: 32,
            fontFamily: 'Impact, "Arial Black", sans-serif',
            fontWeight: 900,
            letterSpacing: 3,
            textShadow: `0 0 16px rgba(246,200,76,0.4), 2px 2px 0 ${C.goldDim}`,
            lineHeight: 1,
          }}
        >
          MINERAL RUSH
        </div>
        <div style={{ color: C.textDim, fontSize: 11, fontFamily: 'monospace', marginTop: 3 }}>
          v{import.meta.env.VITE_GAME_VERSION ?? '0.0.1'} · ROGUELITE MINING
        </div>
      </div>

      {/* 화폐 표시 */}
      <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
        <div style={{ color: C.crystal, fontSize: 15, fontWeight: 700 }}>
          💎 {crystals}
        </div>
        <div style={{ color: C.textMuted, fontSize: 11 }}>
          ⛏ {totalOres} ore{totalOres !== 1 ? 's' : ''}
        </div>
        {metaBonus > 0 && (
          <div style={{ color: C.crystal, fontSize: 10, opacity: 0.8 }}>
            +{metaBonus}/런
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home',        label: '홈',       icon: '🏠' },
  { id: 'skills',      label: '스킬',     icon: '⚡' },
  { id: 'leaderboard', label: '순위',     icon: '🏆' },
  { id: 'settings',    label: '설정',     icon: '⚙️' },
];

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'rgba(0,0,0,0.35)',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1,
            padding: '10px 4px',
            background: active === t.id ? 'rgba(246,200,76,0.10)' : 'transparent',
            border: 'none',
            borderBottom: active === t.id ? `2px solid ${C.gold}` : '2px solid transparent',
            color: active === t.id ? C.gold : C.textMuted,
            fontFamily: 'monospace',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          <span style={{ fontSize: 16 }}>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── HomeTab ──────────────────────────────────────────────────────

function HomeTab({
  state,
  recommendedDepth,
  onPlay,
}: {
  state: GameState;
  recommendedDepth: number;
  onPlay: (depth: number) => void;
}) {
  const isFirstRun = state.meta.stats.totalRuns === 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px 24px',
        gap: 20,
        maxWidth: 480,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 광부 픽셀 아트 장식 */}
      <MinerIllustration />

      {/* 메인 PLAY 버튼 */}
      <button
        onClick={() => onPlay(recommendedDepth)}
        style={{
          width: '100%',
          padding: '18px 0',
          background: `linear-gradient(180deg,${C.accent},${C.accentDim})`,
          color: C.text,
          border: `2px solid ${C.accentBorder}`,
          borderRadius: 10,
          cursor: 'pointer',
          fontSize: 28,
          fontWeight: 900,
          fontFamily: 'Impact, "Arial Black", sans-serif',
          letterSpacing: 4,
          textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
          boxShadow: '0 4px 24px rgba(217,119,87,0.35)',
          transition: 'transform 0.08s, box-shadow 0.08s',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        {isFirstRun ? 'START MINING' : 'PLAY ▶'}
      </button>

      {/* 힌트 텍스트 */}
      {isFirstRun ? (
        <div style={{ color: C.textMuted, fontSize: 13, fontFamily: 'monospace', textAlign: 'center' }}>
          광맥을 탭하여 광석을 채굴하세요!<br />
          <span style={{ color: C.textDim, fontSize: 11 }}>자동 공격이 활성화됩니다</span>
        </div>
      ) : (
        <div style={{ color: C.textMuted, fontSize: 12, fontFamily: 'monospace', textAlign: 'center' }}>
          깊이 {recommendedDepth}부터 시작 (Depth {recommendedDepth})
        </div>
      )}

      {/* 통계 카드 */}
      <StatsCard state={state} />
    </div>
  );
}

// ─── StatsCard ────────────────────────────────────────────────────

function StatsCard({ state }: { state: GameState }) {
  const s = state.meta.stats;
  return (
    <div
      style={{
        width: '100%',
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '14px 16px',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px 20px',
        fontFamily: 'monospace',
      }}
    >
      <StatItem label="총 런" value={`${s.totalRuns}`} />
      <StatItem label="최고 점수" value={s.bestRunScore.toFixed(0)} />
      <StatItem label="총 채굴" value={`${s.totalOresMined}`} />
      <StatItem label="결정 보상" value={`💎 ${s.bestRunValueCrystals}`} />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: C.textDim, fontSize: 10 }}>{label}</div>
      <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

// ─── SettingsTab ──────────────────────────────────────────────────

function SettingsTab({
  state,
  locale,
  stages,
  eventCount,
  telemetryMeta,
  onPlay,
  onExportTelemetry,
  onResetSave,
}: {
  state: GameState;
  locale: 'ko' | 'en';
  stages: ReturnType<typeof Array.prototype.sort>;
  eventCount: number;
  telemetryMeta: Readonly<TelemetryMeta> | null;
  onPlay: (depth: number) => void;
  onExportTelemetry: () => void;
  onResetSave: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '16px 16px 32px',
        maxWidth: 480,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 게임 정보 */}
      <SectionCard title="게임 정보">
        <InfoRow label="버전" value={import.meta.env.VITE_GAME_VERSION ?? '0.0.1'} />
        <InfoRow label="Schema" value={`v${state.schemaVersion}`} />
        <InfoRow label="Player ID" value={state.player.playerId.slice(0, 12) + '…'} />
      </SectionCard>

      {/* 스테이지 직행 */}
      <SectionCard title="스테이지 직행 (개발자)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(stages as Array<{ id: string; depthRange: [number, number]; name: Record<string, string> }>).map((s) => (
            <button
              key={s.id}
              onClick={() => onPlay(s.depthRange[0])}
              style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.text,
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: 13,
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{s.name[locale]}</span>
              <span style={{ color: C.textMuted, fontSize: 11 }}>D{s.depthRange[0]}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Playtest Panel */}
      <SectionCard title="플레이테스트">
        <PlaytestPanel
          eventCount={eventCount}
          meta={telemetryMeta}
          onExportTelemetry={onExportTelemetry}
          onResetSave={onResetSave}
        />
      </SectionCard>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 14px',
          background: 'rgba(0,0,0,0.3)',
          color: C.textMuted,
          fontSize: 11,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: 1,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {title}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'monospace',
        fontSize: 13,
        padding: '4px 0',
        borderBottom: `1px solid rgba(255,255,255,0.04)`,
      }}
    >
      <span style={{ color: C.textMuted }}>{label}</span>
      <span style={{ color: C.text }}>{value}</span>
    </div>
  );
}

// ─── MinerIllustration ────────────────────────────────────────────

function MinerIllustration() {
  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <style>{`
        @keyframes floatMiner {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes glowGold {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        .miner-float { animation: floatMiner 2s ease-in-out infinite; }
        .gold-glow   { animation: glowGold 1.5s ease-in-out infinite; }
      `}</style>

      {/* 황금빛 배경 글로우 */}
      <div
        className="gold-glow"
        style={{
          position: 'absolute',
          inset: '-20px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(246,200,76,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <svg
        className="miner-float"
        viewBox="0 0 64 64"
        width={128}
        height={128}
        style={{ imageRendering: 'pixelated', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 광맥 블록 */}
        <rect x="38" y="20" width="20" height="20" fill="#6b4423" rx="1" />
        <rect x="40" y="22" width="16" height="16" fill="#8b5e2a" rx="1" />
        <rect x="42" y="26" width="4" height="4" fill="#ffd700" opacity="0.9" />
        <rect x="48" y="30" width="3" height="3" fill="#f6c84c" opacity="0.7" />
        <rect x="44" y="22" width="2" height="2" fill="#ffd700" opacity="0.5" />

        {/* 캐릭터 */}
        {/* 부츠 */}
        <rect x="12" y="48" width="6" height="5" fill="#3d2408" />
        <rect x="20" y="48" width="6" height="5" fill="#3d2408" />
        {/* 바지 */}
        <rect x="12" y="40" width="6" height="10" fill="#2b4a2b" />
        <rect x="20" y="40" width="6" height="10" fill="#2b4a2b" />
        {/* 벨트 */}
        <rect x="12" y="39" width="14" height="2" fill="#5c3a10" />
        {/* 셔츠 몸통 */}
        <rect x="10" y="28" width="18" height="12" fill="#3a6fbd" />
        {/* 소매 */}
        <rect x="8" y="28" width="4" height="8" fill="#3a6fbd" />
        <rect x="26" y="28" width="4" height="8" fill="#3a6fbd" />
        {/* 손 */}
        <rect x="8" y="34" width="4" height="4" fill="#f5c89a" />
        <rect x="26" y="34" width="4" height="4" fill="#f5c89a" />
        {/* 목 */}
        <rect x="16" y="24" width="6" height="5" fill="#f5c89a" />
        {/* 머리 */}
        <rect x="12" y="12" width="14" height="14" fill="#f5c89a" rx="1" />
        {/* 헬멧 */}
        <rect x="12" y="10" width="14" height="6" fill="#5c3a10" rx="1" />
        <rect x="10" y="12" width="18" height="4" fill="#7a5020" />
        {/* 헬멧 랜턴 */}
        <rect x="17" y="8" width="4" height="4" fill="#ffd700" />
        <circle cx="19" cy="10" r="2" fill="#ffee88" opacity="0.9" />
        {/* 눈 */}
        <rect x="15" y="18" width="3" height="3" fill="#222" />
        <rect x="20" y="18" width="3" height="3" fill="#222" />
        {/* 콧수염 */}
        <rect x="15" y="22" width="8" height="2" fill="#5c3a10" />

        {/* 곡괭이 (오른손에서 대각선으로) */}
        <rect x="28" y="24" width="14" height="2" fill="#8b5e2a" transform="rotate(-30 28 24)" />
        <rect x="36" y="12" width="6" height="12" fill="#aaaacc" rx="1" transform="rotate(-30 36 12)" />
        <rect x="38" y="10" width="3" height="3" fill="#ffffff" opacity="0.8" transform="rotate(-30 38 10)" />

        {/* 충격 별 파티클 */}
        <polygon points="42,22 43,19 44,22 47,22 45,24 46,27 43,25 40,27 41,24 39,22"
          fill="#ffd700" opacity="0.85" />
      </svg>
    </div>
  );
}
