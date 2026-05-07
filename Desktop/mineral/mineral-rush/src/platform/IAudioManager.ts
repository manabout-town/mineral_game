/**
 * IAudioManager — 사운드/음악 추상화.
 *
 * UNIVERSAL_GAME_FRAMEWORK §1.3 Interface Layer:
 *   - 외부 라이브러리(WebAudio, Howler, Capacitor Sound) 교체 용이.
 *   - core/systems는 IAudioManager만 import. 구현체 직접 import 금지.
 *
 * Phase 3 단계: WebAudio 기반 단순 stub. Phase 4에서 audiosprite 통합.
 */

/** 게임에서 사용하는 SFX 식별자 — 하드코딩으로 명시. 데이터 시트화는 Phase 4. */
export type SfxId =
  | 'pickaxe_hit'
  | 'vein_destroyed'
  | 'ore_collected'
  | 'card_offer'
  | 'card_picked'
  | 'card_rerolled'
  | 'depth_advance'
  | 'run_start'
  | 'run_end'
  | 'ui_click';

export type BgmId =
  | 'lobby'
  | 'run_open_pit'
  | 'run_cave'
  | 'run_deep_shaft'
  | 'run_magma_layer'
  | 'run_core';

export interface IAudioManager {
  /** AudioContext 생성. 사용자 제스처 후 호출 안 하면 일부 브라우저는 suspend 상태 */
  init(): Promise<void>;

  /** 사용자 제스처 핸들러에서 호출 — 첫 클릭 후 한 번 */
  resumeOnUserGesture(): Promise<void>;

  playSfx(id: SfxId, opts?: { volume?: number; pitch?: number }): void;
  playBgm(id: BgmId, opts?: { fadeMs?: number; loop?: boolean }): void;
  stopBgm(opts?: { fadeMs?: number }): void;

  setMasterVolume(v: number): void;
  setSfxVolume(v: number): void;
  setBgmVolume(v: number): void;

  /** 메모리 정리 */
  dispose(): void;
}
