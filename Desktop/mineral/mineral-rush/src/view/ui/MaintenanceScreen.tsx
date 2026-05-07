/**
 * MaintenanceScreen — 점검 모드 / 강제 업데이트 화면.
 *
 * 두 가지 모드:
 *   - 'maintenance': 점검 중 안내 (재시도 버튼)
 *   - 'force_update': 최소 지원 버전 미만 → 스토어 안내 (현 단계는 가짜 링크)
 */

interface Props {
  mode: 'maintenance' | 'force_update';
  messageKo?: string;
  messageEn?: string;
  locale?: 'ko' | 'en';
  onRetry?: () => void;
}

export function MaintenanceScreen({
  mode,
  messageKo,
  messageEn,
  locale = 'ko',
  onRetry,
}: Props) {
  const title = mode === 'maintenance'
    ? locale === 'ko' ? '점검 중입니다' : 'Under Maintenance'
    : locale === 'ko' ? '업데이트가 필요합니다' : 'Update Required';

  const msg = locale === 'ko'
    ? messageKo ?? (mode === 'maintenance'
        ? '잠시만 기다려주세요. 곧 다시 만나요!'
        : '최신 버전으로 업데이트해주세요.')
    : messageEn ?? (mode === 'maintenance'
        ? 'Please hold on, we\'ll be right back!'
        : 'Please update to the latest version.');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg,#1a1208,#08070b)',
        color: '#fff',
        fontFamily: 'sans-serif',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        {mode === 'maintenance' ? '🛠️' : '⬆️'}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{title}</div>
      <div style={{ fontSize: 16, opacity: 0.85, maxWidth: 480, lineHeight: 1.5, marginBottom: 24 }}>
        {msg}
      </div>
      {mode === 'maintenance' && onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '12px 24px',
            background: '#1e7a3a',
            color: '#fff',
            border: '1px solid #2faa55',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {locale === 'ko' ? '다시 시도' : 'Retry'}
        </button>
      )}
      {mode === 'force_update' && (
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          {locale === 'ko' ? '스토어 링크는 출시 후 활성화됩니다.' : 'Store link will activate after launch.'}
        </div>
      )}
    </div>
  );
}
