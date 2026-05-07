/**
 * LoadingScreen — Phase 6 픽셀 아트 스플래시/로딩 화면.
 *
 * bootConfig 페치 완료 전에 표시.
 * CSS 애니메이션만 사용 (PixiJS 의존 없음).
 */

import { useEffect, useState } from 'react';

interface Props {
  /** 로딩 완료 여부 — true가 되면 페이드아웃 후 사라짐 */
  done?: boolean;
}

export function LoadingScreen({ done = false }: Props) {
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [dot, setDot] = useState(0);

  // 로딩 도트 애니메이션
  useEffect(() => {
    const id = setInterval(() => setDot((d) => (d + 1) % 4), 380);
    return () => clearInterval(id);
  }, []);

  // done이 되면 페이드아웃 → unmount
  useEffect(() => {
    if (!done) return;
    setFadeOut(true);
    const t = setTimeout(() => setHidden(true), 600);
    return () => clearTimeout(t);
  }, [done]);

  if (hidden) return null;

  const dots = '.'.repeat(dot);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(180deg,#1a1208 0%,#08070b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.5s ease',
        opacity: fadeOut ? 0 : 1,
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      {/* 픽셀 아트 곡괭이 애니메이션 (SVG) */}
      <PickaxeAnimation />

      {/* 타이틀 */}
      <div
        style={{
          marginTop: 28,
          color: '#f6c84c',
          fontSize: 38,
          fontFamily: 'Impact, "Arial Black", sans-serif',
          fontWeight: 900,
          letterSpacing: 4,
          textShadow: '0 0 24px rgba(246,200,76,0.5), 2px 2px 0 #7a4a00',
          userSelect: 'none',
        }}
      >
        MINERAL RUSH
      </div>

      {/* 서브타이틀 */}
      <div
        style={{
          marginTop: 8,
          color: '#7a6a3a',
          fontSize: 13,
          fontFamily: 'monospace',
          letterSpacing: 2,
          userSelect: 'none',
        }}
      >
        ROGUELITE MINING
      </div>

      {/* 로딩 텍스트 */}
      <div
        style={{
          marginTop: 48,
          color: '#5a8a5a',
          fontSize: 14,
          fontFamily: 'monospace',
          letterSpacing: 1,
          minWidth: 120,
          textAlign: 'center',
        }}
      >
        {done ? 'Ready!' : `Loading${dots}`}
      </div>

      {/* 광물 장식 도트 */}
      <MineralDots />
    </div>
  );
}

// ─── 픽셀 아트 곡괭이 SVG 애니메이션 ────────────────────────────

function PickaxeAnimation() {
  return (
    <div style={{ position: 'relative', width: 96, height: 96 }}>
      <style>{`
        @keyframes swing {
          0%   { transform: rotate(-30deg); }
          35%  { transform: rotate(30deg); }
          50%  { transform: rotate(25deg); }
          65%  { transform: rotate(30deg); }
          100% { transform: rotate(-30deg); }
        }
        @keyframes bobChar {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-3px); }
        }
        @keyframes sparkle {
          0%   { opacity: 0; transform: scale(0.5) translate(0,0); }
          30%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.2) translate(8px,-10px); }
        }
        .swing-arm {
          transform-origin: 12px 12px;
          animation: swing 0.7s ease-in-out infinite;
        }
        .bob-char {
          animation: bobChar 0.7s ease-in-out infinite;
        }
        .spark1 { animation: sparkle 0.7s 0.35s ease-out infinite; }
        .spark2 { animation: sparkle 0.7s 0.38s ease-out infinite; }
      `}</style>

      <svg
        viewBox="0 0 48 48"
        width={96}
        height={96}
        style={{ imageRendering: 'pixelated' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 광맥 (배경 블록) */}
        <rect x="28" y="16" width="16" height="16" fill="#6b4423" rx="1" />
        <rect x="30" y="18" width="12" height="12" fill="#8b5e2a" rx="1" />
        {/* 광맥 광물 반짝임 */}
        <rect x="32" y="21" width="3" height="3" fill="#ffd700" opacity="0.8" />
        <rect x="37" y="24" width="2" height="2" fill="#f6c84c" opacity="0.6" />

        {/* 캐릭터 바디 */}
        <g className="bob-char">
          {/* 몸통 */}
          <rect x="10" y="24" width="10" height="8" fill="#3a6fbd" />
          {/* 머리 */}
          <rect x="11" y="16" width="8" height="8" fill="#f5c89a" />
          {/* 머리카락 */}
          <rect x="11" y="16" width="8" height="2" fill="#5c3a10" />
          <rect x="11" y="18" width="2" height="2" fill="#5c3a10" />
          {/* 눈 */}
          <rect x="13" y="20" width="2" height="2" fill="#222" />
          <rect x="16" y="20" width="2" height="2" fill="#222" />
          {/* 바지 */}
          <rect x="10" y="32" width="4" height="6" fill="#2b4a2b" />
          <rect x="16" y="32" width="4" height="6" fill="#2b4a2b" />
          {/* 부츠 */}
          <rect x="10" y="37" width="4" height="3" fill="#3d2408" />
          <rect x="16" y="37" width="4" height="3" fill="#3d2408" />

          {/* 곡괭이 팔 */}
          <g className="swing-arm">
            {/* 손잡이 */}
            <rect x="18" y="20" width="14" height="2" fill="#8b5e2a" />
            {/* 헤드 */}
            <rect x="30" y="16" width="4" height="8" fill="#aaaacc" />
            <rect x="32" y="15" width="2" height="2" fill="#ffffff" opacity="0.8" />
          </g>
        </g>

        {/* 충격 파티클 */}
        <circle className="spark1" cx="30" cy="26" r="1.5" fill="#ffd700" />
        <circle className="spark2" cx="32" cy="24" r="1" fill="#ffffff" />
      </svg>
    </div>
  );
}

// ─── 하단 광물 장식 도트 ─────────────────────────────────────────

const MINERAL_COLORS = [
  '#b87333', '#a7a7a7', '#ffd700', '#e0115f',
  '#0f52ba', '#50c878', '#b9f2ff', '#9ad9ea',
];

function MineralDots() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      {MINERAL_COLORS.map((c, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            background: c,
            borderRadius: 1,
            opacity: 0.7,
            animation: `bobChar ${0.5 + i * 0.08}s ease-in-out infinite`,
            animationDelay: `${i * 0.07}s`,
          }}
        />
      ))}
    </div>
  );
}
