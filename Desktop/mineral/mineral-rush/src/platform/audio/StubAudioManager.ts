/**
 * StubAudioManager — 사운드 에셋 없이 console만 찍는 더미 구현.
 *
 * Phase 3에서 본격 WebAudioManager로 교체 시 동일 인터페이스 유지.
 */

import type { IAudioManager, SfxId, BgmId } from '../IAudioManager.ts';

export class StubAudioManager implements IAudioManager {
  private master = 1;
  private sfx = 1;
  private bgm = 0.7;

  async init(): Promise<void> {
    /* noop */
  }

  async resumeOnUserGesture(): Promise<void> {
    /* noop */
  }

  playSfx(id: SfxId, opts?: { volume?: number; pitch?: number }): void {
    if (import.meta.env.DEV) {
      console.debug('[Audio.sfx]', id, opts ?? {});
    }
  }

  playBgm(id: BgmId, opts?: { fadeMs?: number; loop?: boolean }): void {
    if (import.meta.env.DEV) {
      console.debug('[Audio.bgm]', id, opts ?? {});
    }
  }

  stopBgm(opts?: { fadeMs?: number }): void {
    if (import.meta.env.DEV) {
      console.debug('[Audio.bgm.stop]', opts ?? {});
    }
  }

  setMasterVolume(v: number): void {
    this.master = v;
  }
  setSfxVolume(v: number): void {
    this.sfx = v;
  }
  setBgmVolume(v: number): void {
    this.bgm = v;
  }

  /** 디버그용 — 현재 볼륨 상태 */
  getVolumes(): { master: number; sfx: number; bgm: number } {
    return { master: this.master, sfx: this.sfx, bgm: this.bgm };
  }

  dispose(): void {
    /* noop */
  }
}
