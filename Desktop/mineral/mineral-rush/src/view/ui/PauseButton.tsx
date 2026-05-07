/**
 * PauseButton — 우상단 일시정지 버튼.
 * 클릭 시 onPause 콜백 → App에서 lobby로 복귀 등 처리.
 */

interface Props {
  onPause: () => void;
}

export function PauseButton({ onPause }: Props) {
  return (
    <button
      onClick={onPause}
      title="메뉴로"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 5,
        width: 44,
        height: 44,
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'monospace',
        fontSize: 16,
      }}
    >
      ‖
    </button>
  );
}
