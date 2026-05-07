/**
 * GameRenderer — 엔진 비종속 렌더링 인터페이스.
 *
 * UNIVERSAL_GAME_FRAMEWORK §1.4 View Layer (Engine Agnostic):
 *   - 로직은 순수 JS, 렌더링 엔진은 데이터만 받아 그린다.
 *   - 추후 PixiJS → Phaser / Three.js 교체 시 인터페이스만 다시 구현하면 됨.
 */

import type { GameState } from '../core/State.ts';

export interface GameRenderer {
  /** 캔버스 mount + 자원 로드. 한 번만 호출. */
  init(container: HTMLElement): Promise<void>;

  /** 매 프레임 호출. state는 read-only. */
  render(state: GameState, interpolationAlpha: number): void;

  /** 윈도우 리사이즈 또는 배율 변경 시 호출. */
  resize(width: number, height: number): void;

  /** 입력 콜백 등록. coords는 캔버스 로컬 좌표. */
  onPointerDown(handler: (x: number, y: number) => void): void;

  /** 자원 해제. */
  destroy(): void;

  /**
   * 광맥 파괴 시 파티클 폭발 이펙트 (선택적 구현).
   * PixiGameRenderer에서 구현. StubRenderer / 테스트 환경에서는 noop.
   */
  spawnVeinBurst?(x?: number, y?: number, color?: number): void;
}
