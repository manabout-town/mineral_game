/**
 * LeaderboardPanel — Supabase runs 테이블에서 상위 10 런을 실시간 조회.
 *
 * - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 미설정 시 "리더보드 비활성" 안내.
 * - 네트워크 오류 시 에러 메시지 + Retry 버튼.
 * - 1분마다 자동 갱신 (페이지 포커스 시에도 갱신).
 * - replay_status = 'ok' 인 런만 표시 (검증된 점수만).
 *
 * 5계명 §1: 이 컴포넌트는 상태를 읽기만 한다. 수정은 없음.
 */

import { useEffect, useRef, useState } from 'react';

interface LeaderboardEntry {
  rank: number;
  playerId: string;
  veinCount: number;
  rewardCrystals: number;
  stageId: string;
  durationMs: number;
  endedAt: number;
}

interface Props {
  locale?: 'ko' | 'en';
}

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const REFRESH_MS    = 60_000;

const STAGE_LABEL: Record<string, string> = {
  open_pit:    'Open Pit',
  cave:        'Cave',
  deep_shaft:  'Deep Shaft',
  magma_layer: 'Magma Layer',
  core:        'Core',
};

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m   = Math.floor(sec / 60);
  const s   = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function rankColor(rank: number): string {
  if (rank === 1) return '#f6c84c';
  if (rank === 2) return '#b0b0b0';
  if (rank === 3) return '#cd7f32';
  return '#666';
}

// ─── 데이터 페치 ─────────────────────────────────────────────

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error('not_configured');
  }

  const url =
    `${SUPABASE_URL}/rest/v1/runs` +
    `?select=player_id,vein_count,reward_crystals,stage_id,duration_ms,ended_at` +
    `&replay_status=eq.ok` +
    `&order=reward_crystals.desc` +
    `&limit=10`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(`http_${res.status}`);

  const rows = (await res.json()) as Array<{
    player_id: string;
    vein_count: number;
    reward_crystals: number;
    stage_id: string;
    duration_ms: number;
    ended_at: number;
  }>;

  return rows.map((r, i) => ({
    rank: i + 1,
    playerId: r.player_id,
    veinCount: r.vein_count,
    rewardCrystals: r.reward_crystals,
    stageId: r.stage_id,
    durationMs: r.duration_ms,
    endedAt: r.ended_at,
  }));
}

// ─── 컴포넌트 ─────────────────────────────────────────────────

export function LeaderboardPanel({ locale = 'ko' }: Props) {
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      setError('not_configured');
      return;
    }
    setLoading(true);
    setError(null);
    fetchLeaderboard()
      .then((data) => {
        setEntries(data);
        setLastFetch(Date.now());
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isNotConfigured = error === 'not_configured';

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 320,
        maxWidth: 400,
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ color: '#f6c84c', fontFamily: 'Impact, sans-serif', fontSize: 15, letterSpacing: 1 }}>
          🏆 {locale === 'ko' ? '리더보드' : 'Leaderboard'}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastFetch > 0 && (
            <span style={{ color: '#444', fontFamily: 'monospace', fontSize: 10 }}>
              {Math.round((Date.now() - lastFetch) / 1000)}s ago
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4,
              color: loading ? '#444' : '#aaa',
              cursor: loading ? 'default' : 'pointer',
              fontFamily: 'monospace',
              fontSize: 11,
              padding: '2px 8px',
            }}
          >
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      {/* 상태 분기 */}
      {isNotConfigured ? (
        <div style={{ color: '#555', fontFamily: 'monospace', fontSize: 11, textAlign: 'center', padding: '16px 0' }}>
          {locale === 'ko'
            ? 'Supabase 미연결 — VITE_SUPABASE_URL 설정 필요'
            : 'Supabase not configured — set VITE_SUPABASE_URL'}
        </div>
      ) : error ? (
        <div style={{ color: '#cc4444', fontFamily: 'monospace', fontSize: 11, textAlign: 'center', padding: '8px 0' }}>
          {locale === 'ko' ? `오류: ${error}` : `Error: ${error}`}
        </div>
      ) : loading && entries.length === 0 ? (
        <div style={{ color: '#555', fontFamily: 'monospace', fontSize: 11, textAlign: 'center', padding: '16px 0' }}>
          {locale === 'ko' ? '불러오는 중...' : 'Loading...'}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ color: '#555', fontFamily: 'monospace', fontSize: 11, textAlign: 'center', padding: '16px 0' }}>
          {locale === 'ko' ? '런 기록 없음' : 'No runs yet'}
        </div>
      ) : (
        /* 순위 테이블 */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* 헤더 행 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 60px 48px',
              gap: 4,
              color: '#555',
              fontFamily: 'monospace',
              fontSize: 10,
              padding: '0 4px 4px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span>#</span>
            <span>{locale === 'ko' ? '스테이지' : 'Stage'}</span>
            <span style={{ textAlign: 'right' }}>💎</span>
            <span style={{ textAlign: 'right' }}>{locale === 'ko' ? '시간' : 'Time'}</span>
          </div>

          {/* 데이터 행 */}
          {entries.map((e) => (
            <div
              key={`${e.playerId}-${e.endedAt}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr 60px 48px',
                gap: 4,
                padding: '3px 4px',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.02)',
                fontFamily: 'monospace',
                fontSize: 12,
                alignItems: 'center',
              }}
            >
              <span style={{ color: rankColor(e.rank), fontWeight: 700, fontSize: 13 }}>
                {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `${e.rank}.`}
              </span>
              <span style={{ color: '#aaa', fontSize: 11 }}>
                {STAGE_LABEL[e.stageId] ?? e.stageId}
              </span>
              <span style={{ color: '#b9f2ff', textAlign: 'right' }}>
                {e.rewardCrystals}
              </span>
              <span style={{ color: '#888', textAlign: 'right', fontSize: 11 }}>
                {formatDuration(e.durationMs)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
