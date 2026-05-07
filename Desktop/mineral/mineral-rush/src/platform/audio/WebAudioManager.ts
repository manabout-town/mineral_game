/**
 * WebAudioManager — Web Audio API 기반 절차적 사운드.
 *
 * 외부 파일 없이 AudioContext 합성만으로 게임 SFX/BGM을 생성.
 * Phase 4: BGM 절차적 생성 (지속 오실레이터 + LFO 트레몰로). audiosprite 교체 시 인터페이스 유지.
 *
 * 5계명 §1: core/systems는 이 파일을 import하지 않는다.
 *           IAudioManager 인터페이스만 사용.
 *
 * SFX 설계:
 *   pickaxe_hit   — 짧은 타격 클릭 (노이즈 + 피치다운)
 *   vein_destroyed — 폭발 붐 (노이즈 버스트 + 저음 서브)
 *   ore_collected  — 경쾌한 틱 (사인파 고음 짧게)
 *   card_offer     — 마법 글리터 (4음 상승 아르페지오)
 *   card_picked    — 확인 클릭 (2음 상승)
 *   card_rerolled  — 휙 (피치업 스윕)
 *   depth_advance  — 굉음 하강 (피치다운 두꺼운 사인)
 *   run_start      — 팡파르 (3음 상승)
 *   run_end        — 종료 (3음 하강 + 잔향)
 *   ui_click       — 미니 클릭 (짧은 사인파)
 *
 * BGM 설계 (절차적 합성):
 *   lobby          — 평온한 A장조 드론 (sine 오실레이터 + 느린 트레몰로)
 *   run_open_pit   — 지상/흙 느낌 (저음 sawtooth + 중음 drone)
 *   run_cave       — 동굴/에코 (G단조 하모닉스, 느린 LFO)
 *   run_deep_shaft — 기계/펌프 (초저음 + 0.5Hz 리드미컬 LFO)
 *   run_magma_layer — 강렬/용암 (3도 불협화음 sawtooth + 빠른 LFO)
 *   run_core       — 신비/외계 (A1 서브 + 고음 배음, 매우 느린 LFO)
 */

import type { IAudioManager, SfxId, BgmId } from '../IAudioManager.ts';

type BiquadFilterType =
  | 'lowpass' | 'highpass' | 'bandpass' | 'lowshelf'
  | 'highshelf' | 'peaking' | 'notch' | 'allpass';

// ─── BGM 타입 ────────────────────────────────────────────────

/** BGM 레이어 정의 — 오실레이터 하나의 파라미터 */
interface BgmLayerDef {
  freq: number;
  type: OscillatorType;
  /** 기본 진폭 (0–1) */
  gain: number;
  /** 트레몰로 LFO 주파수 (Hz). 미지정이면 LFO 없음 */
  lfoFreq?: number;
  /** 트레몰로 깊이 (0–1, gain 대비 비율) */
  lfoDepth?: number;
}

/** 스테이지 BGM 전체 설정 */
interface BgmStageDef {
  layers: BgmLayerDef[];
  /** 마스터 로우패스 필터 주파수 (Hz) — 고음 제거로 앰비언트 질감 */
  filterFreq: number;
}

/** 재생 중인 BGM 레이어 노드 */
interface BgmLayer {
  osc: OscillatorNode;
  oscGain: GainNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
}

/** 현재 재생 중인 BGM 트랙 */
interface ActiveBgm {
  id: BgmId;
  masterGain: GainNode;
  filter: BiquadFilterNode;
  layers: BgmLayer[];
}

// ─── BGM 스테이지 정의 ─────────────────────────────────────

const BGM_DEFS: Record<BgmId, BgmStageDef> = {
  // A장조 드론 — 110/165/220/330Hz, 느린 트레몰로
  lobby: {
    filterFreq: 700,
    layers: [
      { freq: 110,   type: 'sine',     gain: 0.16, lfoFreq: 0.08,  lfoDepth: 0.07 },
      { freq: 165,   type: 'sine',     gain: 0.09, lfoFreq: 0.11,  lfoDepth: 0.06 },
      { freq: 220,   type: 'sine',     gain: 0.06, lfoFreq: 0.06,  lfoDepth: 0.05 },
      { freq: 330,   type: 'sine',     gain: 0.04, lfoFreq: 0.14,  lfoDepth: 0.04 },
    ],
  },

  // D장조 오픈 드론 — 73/110/147/220Hz, 저음 sawtooth
  run_open_pit: {
    filterFreq: 800,
    layers: [
      { freq: 73.4,  type: 'sawtooth', gain: 0.09, lfoFreq: 0.12,  lfoDepth: 0.10 },
      { freq: 110,   type: 'sine',     gain: 0.13, lfoFreq: 0.09,  lfoDepth: 0.08 },
      { freq: 146.8, type: 'triangle', gain: 0.07, lfoFreq: 0.18,  lfoDepth: 0.06 },
      { freq: 220,   type: 'sine',     gain: 0.04, lfoFreq: 0.22,  lfoDepth: 0.05 },
    ],
  },

  // G단조 동굴 — 98/147/196/294Hz, 천천히 흔들리는 LFO
  run_cave: {
    filterFreq: 550,
    layers: [
      { freq: 98,    type: 'sine',     gain: 0.14, lfoFreq: 0.05,  lfoDepth: 0.10 },
      { freq: 146.8, type: 'sine',     gain: 0.09, lfoFreq: 0.08,  lfoDepth: 0.08 },
      { freq: 196,   type: 'sine',     gain: 0.06, lfoFreq: 0.12,  lfoDepth: 0.07 },
      { freq: 293.7, type: 'sine',     gain: 0.03, lfoFreq: 0.04,  lfoDepth: 0.12 },
    ],
  },

  // E1 기계 드론 — 41/82/124/247Hz, 0.5Hz 리드미컬 펌프
  run_deep_shaft: {
    filterFreq: 450,
    layers: [
      { freq: 41.2,  type: 'sine',     gain: 0.18, lfoFreq: 0.50,  lfoDepth: 0.16 },
      { freq: 82.4,  type: 'triangle', gain: 0.11, lfoFreq: 0.50,  lfoDepth: 0.09 },
      { freq: 123.5, type: 'sine',     gain: 0.07, lfoFreq: 0.25,  lfoDepth: 0.06 },
      { freq: 247,   type: 'sine',     gain: 0.03, lfoFreq: 0.50,  lfoDepth: 0.05 },
    ],
  },

  // 용암 불협화음 — C2+F#2(tritone) + 빠른 LFO
  run_magma_layer: {
    filterFreq: 600,
    layers: [
      { freq: 65.4,  type: 'sawtooth', gain: 0.14, lfoFreq: 0.35,  lfoDepth: 0.14 },
      { freq: 92.5,  type: 'sawtooth', gain: 0.10, lfoFreq: 0.28,  lfoDepth: 0.11 },
      { freq: 130.8, type: 'triangle', gain: 0.07, lfoFreq: 0.42,  lfoDepth: 0.09 },
      { freq: 261.6, type: 'sine',     gain: 0.04, lfoFreq: 0.20,  lfoDepth: 0.07 },
    ],
  },

  // 핵심/외계 — A1 서브 + E4/A4 배음, 매우 느린 LFO
  run_core: {
    filterFreq: 650,
    layers: [
      { freq: 55,    type: 'sine',     gain: 0.18, lfoFreq: 0.04,  lfoDepth: 0.05 },
      { freq: 110,   type: 'sine',     gain: 0.09, lfoFreq: 0.07,  lfoDepth: 0.04 },
      { freq: 329.6, type: 'sine',     gain: 0.05, lfoFreq: 0.03,  lfoDepth: 0.08 },
      { freq: 440,   type: 'sine',     gain: 0.03, lfoFreq: 0.06,  lfoDepth: 0.06 },
    ],
  },
};

// ─── 메인 클래스 ──────────────────────────────────────────────

export class WebAudioManager implements IAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  private volumes = { master: 1, sfx: 1, bgm: 0.7 };
  private resumed = false;

  private activeBgm: ActiveBgm | null = null;

  // ─── 초기화 ─────────────────────────────────────────────

  async init(): Promise<void> {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.bgmGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.bgmGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.applyVolumes();
  }

  async resumeOnUserGesture(): Promise<void> {
    if (this.resumed || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.resumed = true;
  }

  // ─── 볼륨 ───────────────────────────────────────────────

  setMasterVolume(v: number): void {
    this.volumes.master = Math.max(0, Math.min(1, v));
    this.applyVolumes();
  }
  setSfxVolume(v: number): void {
    this.volumes.sfx = Math.max(0, Math.min(1, v));
    this.applyVolumes();
  }
  setBgmVolume(v: number): void {
    this.volumes.bgm = Math.max(0, Math.min(1, v));
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.masterGain || !this.sfxGain || !this.bgmGain) return;
    const t = this.ctx!.currentTime;
    this.masterGain.gain.setTargetAtTime(this.volumes.master, t, 0.01);
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx, t, 0.01);
    this.bgmGain.gain.setTargetAtTime(this.volumes.bgm, t, 0.01);
  }

  // ─── SFX ────────────────────────────────────────────────

  playSfx(id: SfxId, opts?: { volume?: number; pitch?: number }): void {
    if (!this.ctx || !this.sfxGain) return;
    const vol = opts?.volume ?? 1;
    const pitch = opts?.pitch ?? 1;

    switch (id) {
      case 'pickaxe_hit':    return this.playPickaxeHit(vol, pitch);
      case 'vein_destroyed': return this.playVeinDestroyed(vol);
      case 'ore_collected':  return this.playOreCollected(vol, pitch);
      case 'card_offer':     return this.playCardOffer(vol);
      case 'card_picked':    return this.playCardPicked(vol);
      case 'card_rerolled':  return this.playCardRerolled(vol);
      case 'depth_advance':  return this.playDepthAdvance(vol);
      case 'run_start':      return this.playRunStart(vol);
      case 'run_end':        return this.playRunEnd(vol);
      case 'ui_click':       return this.playUiClick(vol);
    }
  }

  // ─── BGM ────────────────────────────────────────────────

  playBgm(id: BgmId, opts?: { fadeMs?: number; loop?: boolean }): void {
    if (!this.ctx || !this.bgmGain) return;

    // 이미 같은 트랙이 재생 중이면 무시
    if (this.activeBgm?.id === id) return;

    const fadeMs  = opts?.fadeMs ?? 1500;
    const fadeSec = Math.max(0.05, fadeMs / 1000);
    const ctx     = this.ctx;
    const t       = ctx.currentTime;

    // 기존 트랙 페이드아웃 + 노드 해제
    if (this.activeBgm) {
      this._fadeOutAndStop(this.activeBgm, fadeSec);
    }

    // 새 트랙 구축
    const track = this._buildBgmTrack(id);
    this.activeBgm = track;

    // 페이드인
    track.masterGain.gain.setValueAtTime(0, t);
    track.masterGain.gain.linearRampToValueAtTime(1, t + fadeSec);
  }

  stopBgm(opts?: { fadeMs?: number }): void {
    if (!this.activeBgm || !this.ctx) return;

    const fadeMs  = opts?.fadeMs ?? 1000;
    const fadeSec = Math.max(0.05, fadeMs / 1000);
    const track   = this.activeBgm;
    this.activeBgm = null;

    this._fadeOutAndStop(track, fadeSec);
  }

  dispose(): void {
    // BGM 노드 즉시 정리
    if (this.activeBgm) {
      const track = this.activeBgm;
      this.activeBgm = null;
      track.layers.forEach(({ osc, lfo }) => {
        try { osc.stop(); } catch { /* 이미 종료 */ }
        try { lfo?.stop(); } catch { /* 이미 종료 */ }
      });
      try { track.masterGain.disconnect(); } catch { /* ok */ }
      try { track.filter.disconnect(); } catch { /* ok */ }
    }
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
  }

  // ─── BGM 내부 빌더 ──────────────────────────────────────

  /** 오실레이터 네트워크를 구성하고 bgmGain에 연결 (무음 상태로 시작) */
  private _buildBgmTrack(id: BgmId): ActiveBgm {
    const ctx  = this.ctx!;
    const def  = BGM_DEFS[id];
    const t    = ctx.currentTime;

    // masterGain → filter → bgmGain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, t);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = def.filterFreq;
    filter.Q.value = 0.707;

    masterGain.connect(filter);
    filter.connect(this.bgmGain!);

    const layers: BgmLayer[] = [];

    for (const layerDef of def.layers) {
      const osc = ctx.createOscillator();
      osc.type = layerDef.type;
      osc.frequency.value = layerDef.freq;

      const oscGain = ctx.createGain();
      oscGain.gain.value = layerDef.gain;

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      const layer: BgmLayer = { osc, oscGain };

      // 트레몰로 LFO (진폭 변조)
      if (layerDef.lfoFreq !== undefined && layerDef.lfoDepth !== undefined) {
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = layerDef.lfoFreq;

        const lfoGain = ctx.createGain();
        // LFO depth = baseGain * lfoDepth. 이 범위로 gain을 ±변조
        lfoGain.gain.value = layerDef.gain * layerDef.lfoDepth;

        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain); // AudioParam에 연결 (변조)

        lfo.start(t);
        layer.lfo = lfo;
        layer.lfoGain = lfoGain;
      }

      osc.start(t);
      layers.push(layer);
    }

    return { id, masterGain, filter, layers };
  }

  /** fadeSec 초 동안 페이드아웃 후 노드 전부 정리 */
  private _fadeOutAndStop(track: ActiveBgm, fadeSec: number): void {
    const ctx = this.ctx;
    if (!ctx) {
      // ctx 없으면 바로 정리
      track.layers.forEach(({ osc, lfo }) => {
        try { osc.stop(); } catch { /* ok */ }
        try { lfo?.stop(); } catch { /* ok */ }
      });
      return;
    }

    const t = ctx.currentTime;
    track.masterGain.gain.cancelScheduledValues(t);
    track.masterGain.gain.setValueAtTime(track.masterGain.gain.value, t);
    track.masterGain.gain.linearRampToValueAtTime(0, t + fadeSec);

    const stopAt = t + fadeSec + 0.1;
    track.layers.forEach(({ osc, lfo }) => {
      try { osc.stop(stopAt); } catch { /* 이미 종료 */ }
      try { lfo?.stop(stopAt); } catch { /* 이미 종료 */ }
    });

    // GC를 위해 disconnect (stopAt 이후)
    setTimeout(() => {
      try { track.masterGain.disconnect(); } catch { /* ok */ }
      try { track.filter.disconnect(); } catch { /* ok */ }
    }, (fadeSec + 0.5) * 1000);
  }

  // ─── 합성 빌더 ──────────────────────────────────────────

  /** 단일 사인파 노드 생성 */
  private makeSine(freq: number, startTime: number, duration: number, gainPeak: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /** 피치 슬라이드 사인파 */
  private makeSlide(
    freqStart: number, freqEnd: number,
    startTime: number, duration: number,
    gainPeak: number,
    type: OscillatorType = 'sine',
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), startTime + duration);
    gain.gain.setValueAtTime(gainPeak, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  /** 화이트 노이즈 버스트 */
  private makeNoise(
    startTime: number, duration: number, gainPeak: number,
    filterType?: BiquadFilterType, filterFreq?: number,
  ): void {
    const ctx = this.ctx!;
    const bufLen = Math.ceil(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    if (filterType && filterFreq) {
      const filt = ctx.createBiquadFilter();
      filt.type = filterType;
      filt.frequency.value = filterFreq;
      src.connect(filt);
      filt.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(this.sfxGain!);
    src.start(startTime);
  }

  // ─── 개별 SFX 합성 ──────────────────────────────────────

  private playPickaxeHit(vol: number, pitch: number): void {
    const t = this.ctx!.currentTime;
    this.makeNoise(t, 0.04, 0.35 * vol, 'bandpass', 2200 * pitch);
    this.makeSlide(180 * pitch, 60 * pitch, t, 0.08, 0.2 * vol, 'triangle');
  }

  private playVeinDestroyed(vol: number): void {
    const t = this.ctx!.currentTime;
    this.makeNoise(t, 0.35, 0.7 * vol, 'lowpass', 600);
    this.makeSlide(120, 28, t, 0.4, 0.6 * vol, 'sine');
    this.makeNoise(t + 0.02, 0.12, 0.3 * vol, 'highpass', 3000);
  }

  private playOreCollected(vol: number, pitch: number): void {
    const t = this.ctx!.currentTime;
    this.makeSine(1200 * pitch, t, 0.08, 0.25 * vol);
    this.makeSine(1600 * pitch, t + 0.03, 0.06, 0.2 * vol);
  }

  private playCardOffer(vol: number): void {
    const t = this.ctx!.currentTime;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      this.makeSine(freq, t + i * 0.08, 0.18, 0.3 * vol);
    });
  }

  private playCardPicked(vol: number): void {
    const t = this.ctx!.currentTime;
    this.makeSine(660, t, 0.08, 0.3 * vol);
    this.makeSine(880, t + 0.06, 0.12, 0.35 * vol);
  }

  private playCardRerolled(vol: number): void {
    const t = this.ctx!.currentTime;
    this.makeSlide(400, 1200, t, 0.12, 0.25 * vol, 'sawtooth');
    this.makeNoise(t, 0.08, 0.15 * vol, 'highpass', 2000);
  }

  private playDepthAdvance(vol: number): void {
    const t = this.ctx!.currentTime;
    this.makeSlide(220, 55, t, 0.5, 0.5 * vol, 'sawtooth');
    this.makeNoise(t, 0.2, 0.3 * vol, 'lowpass', 400);
    this.makeSlide(1000, 300, t, 0.3, 0.2 * vol);
  }

  private playRunStart(vol: number): void {
    const t = this.ctx!.currentTime;
    const notes = [392, 523, 784]; // G4 C5 G5
    notes.forEach((freq, i) => {
      this.makeSine(freq, t + i * 0.1, 0.2, 0.35 * vol);
    });
  }

  private playRunEnd(vol: number): void {
    const t = this.ctx!.currentTime;
    const notes = [784, 523, 392]; // G5 C5 G4
    notes.forEach((freq, i) => {
      this.makeSine(freq, t + i * 0.13, 0.28, 0.35 * vol);
    });
    this.makeNoise(t + 0.35, 0.3, 0.1 * vol, 'lowpass', 800);
  }

  private playUiClick(vol: number): void {
    const t = this.ctx!.currentTime;
    this.makeSine(440, t, 0.05, 0.2 * vol);
  }
}
