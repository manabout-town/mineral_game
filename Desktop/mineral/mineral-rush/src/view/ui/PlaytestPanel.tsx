/**
 * PlaytestPanel — 플레이테스트용 디버그 패널.
 *
 * Phase 2.10-B: 텔레메트리 Export + 메타 리셋.
 * LobbyScreen 하단에 마운트. 항상 표시 (테스터가 쉽게 접근 가능).
 *
 * 5계명 §1: 읽기 전용. 변경은 콜백으로만.
 */

import { useState, useEffect } from 'react';
import type { TelemetryMeta } from '../../platform/Telemetry.ts';

interface Props {
  eventCount: number;
  meta: Readonly<TelemetryMeta> | null;
  onExportTelemetry: () => void;
  onResetSave: () => void;
}

function fmtTime(epochMs: number): string {
  if (!epochMs) return '—';
  return new Date(epochMs).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtDuration(fromMs: number, toMs: number): string {
  if (!fromMs || !toMs) return '—';
  const sec = Math.floor((toMs - fromMs) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s}초`;
}

export function PlaytestPanel({ eventCount, meta, onExportTelemetry, onResetSave }: Props) {
  const [now, setNow] = useState(Date.now());

  // 1초마다 현재 시간 갱신 (세션 경과 시간 표시용)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const sessionAge = meta?.firstEventAt
    ? fmtDuration(meta.firstEventAt, now)
    : '—';

  return (
    <div
      style={{
        background: 'rgba(0,0,10,0.7)',
        border: '1px solid rgba(100,200,255,0.2)',
        borderRadius: 6,
        padding: '10px 12px',
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#8cf',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* 헤더 */}
      <div style={{ color: '#6df', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>
        🔬 PLAYTEST PANEL
      </div>

      {/* 세션 메타 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2px 8px',
          color: '#aaa',
        }}
      >
        <span>세션 ID</span>
        <span style={{ color: '#fff' }}>{meta?.sessionId.slice(0, 12) ?? '—'}…</span>

        <span>이벤트 수</span>
        <span style={{ color: eventCount > 0 ? '#9aff9a' : '#aaa' }}>{eventCount.toLocaleString()}</span>

        <span>세션 시작</span>
        <span style={{ color: '#fff' }}>{fmtTime(meta?.firstEventAt ?? 0)}</span>

        <span>마지막 이벤트</span>
        <span style={{ color: '#fff' }}>{fmtTime(meta?.lastEventAt ?? 0)}</span>

        <span>경과 시간</span>
        <span style={{ color: '#fff' }}>{sessionAge}</span>

        <span>게임 버전</span>
        <span style={{ color: '#fff' }}>{meta?.gameVersion ?? '—'}</span>

        <span>스키마 버전</span>
        <span style={{ color: '#fff' }}>v{meta?.schemaVersion ?? '—'}</span>

        <span>플랫폼</span>
        <span style={{ color: '#fff' }}>{meta?.device.platform ?? '—'}</span>
      </div>

      {/* 액션 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4 }}>
        <button
          onClick={onExportTelemetry}
          disabled={eventCount === 0}
          style={{
            padding: '7px 10px',
            background: eventCount > 0 ? '#1e4a7a' : '#111',
            color: eventCount > 0 ? '#fff' : '#555',
            border: `1px solid ${eventCount > 0 ? '#2c6db4' : '#333'}`,
            borderRadius: 4,
            cursor: eventCount > 0 ? 'pointer' : 'default',
            fontFamily: 'monospace',
            fontSize: 11,
            textAlign: 'left',
          }}
        >
          ↓ 텔레메트리 Export (JSON) {eventCount > 0 ? `— ${eventCount}개 이벤트` : '— 이벤트 없음'}
        </button>

        <button
          onClick={onResetSave}
          style={{
            padding: '7px 10px',
            background: '#3a1010',
            color: '#ff8888',
            border: '1px solid #6c2020',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: 11,
            textAlign: 'left',
          }}
        >
          ✕ 저장 데이터 초기화 (되돌릴 수 없음)
        </button>
      </div>
    </div>
  );
}
