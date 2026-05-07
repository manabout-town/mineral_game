/**
 * PixiGameRenderer — Phase 3 강화 렌더러.
 *
 * Phase 3.1 추가:
 *   - 스테이지별 배경 그라디언트 (5종 테마)
 *   - 11종 광물 색상 팔레트 (data/minerals.json 연동)
 *   - 광맥 파괴 파티클 시스템 (오브젝트 풀 60개)
 *   - 광맥 모양 지배 광물 색상 반영
 *   - 데미지 플로팅 텍스트 콤보 색상 구분
 *   - 10초 이하 타이머 빨간색 경고
 *   - 깊이 증가 시 파란 파티클 폭발
 *
 * Phase 3.4 추가:
 *   - 스테이지 이름 플래시 텍스트 (깊이 증가 시 1.5초 페이드아웃)
 *   - 화면 흔들림 (depth_advance 시 ±8px, 300ms 감쇠)
 *   - 스테이지별 앰비언트 파티클 (dust/drip/spark/ember/crystal)
 *
 * Phase 4에서 텍스처 아틀라스 / 픽셀 스프라이트로 교체.
 */

import { Application, Container, Graphics, Rectangle, Sprite, Text, TextStyle } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import type { GameRenderer } from '../GameRenderer.ts';
import type { GameState } from '../../core/State.ts';
import { logger } from '../../systems/Logger.ts';
import { ObjectPool } from '../../shared/ObjectPool.ts';
import { VeinSpriteFactory, VEIN_TEX_SIZE } from './VeinSpriteFactory.ts';

// ─── 타입 ────────────────────────────────────────────────────

interface FloatingText {
  text: Text;
  vy: number;
  life: number;
  maxLife: number;
}

interface Particle {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

interface AmbientConfig {
  color: number;
  altColor: number;
  /** ms between spawns */
  rate: number;
  vxRange: [number, number];
  vyRange: [number, number];
  lifeRange: [number, number];
  sizeRange: [number, number];
  /** 'top' | 'sides' | 'bottom' */
  origin: 'top' | 'sides' | 'bottom';
}

// ─── 상수 ────────────────────────────────────────────────────

const FLOAT_TEXT_LIFE_MS = 700;
const FLOAT_TEXT_POOL_SIZE = 24;
const PARTICLE_POOL_SIZE = 80; // 60 burst + 20 ambient headroom
const PARTICLE_LIFE_MS = 500;
const BG_FADE_DURATION_MS = 600;
const STAGE_FLASH_DURATION_MS = 1500;
const SHAKE_DURATION_MS = 300;
const SHAKE_AMPLITUDE = 8;

// ─── 스테이지 테마 ────────────────────────────────────────────

const STAGE_THEMES: Record<string, { top: number; bottom: number; accent: number }> = {
  open_pit:    { top: 0x2a1a08, bottom: 0x0e0a04, accent: 0x8b5e2a },
  cave:        { top: 0x0c1a1a, bottom: 0x060d10, accent: 0x2a5a6a },
  deep_shaft:  { top: 0x0a0c1c, bottom: 0x040508, accent: 0x2a2a5a },
  magma_layer: { top: 0x2a0800, bottom: 0x0f0300, accent: 0xc04010 },
  core:        { top: 0x1a001a, bottom: 0x06000a, accent: 0x8a008a },
};
const DEFAULT_THEME = { top: 0x1a1208, bottom: 0x08070b, accent: 0x4a3a1a };

// ─── 스테이지 이름 (HUD 플래시용) ─────────────────────────────

const STAGE_NAMES: Record<string, string> = {
  open_pit:    'Open Pit',
  cave:        'Cave',
  deep_shaft:  'Deep Shaft',
  magma_layer: 'Magma Layer',
  core:        'Core',
};

// ─── 앰비언트 파티클 설정 ─────────────────────────────────────

const AMBIENT_CONFIGS: Record<string, AmbientConfig> = {
  open_pit: {
    color: 0x8b5e2a, altColor: 0xc4a070,
    rate: 280,
    vxRange: [-0.02, 0.02], vyRange: [0.04, 0.10],
    lifeRange: [1200, 2400], sizeRange: [1.5, 3.5],
    origin: 'top',
  },
  cave: {
    color: 0x2a5a6a, altColor: 0x88ccdd,
    rate: 350,
    vxRange: [-0.005, 0.005], vyRange: [0.06, 0.14],
    lifeRange: [1500, 2800], sizeRange: [1, 2.5],
    origin: 'top',
  },
  deep_shaft: {
    color: 0xaaaacc, altColor: 0xddddff,
    rate: 200,
    vxRange: [-0.03, 0.03], vyRange: [-0.05, 0.01],
    lifeRange: [800, 1600], sizeRange: [1, 2],
    origin: 'sides',
  },
  magma_layer: {
    color: 0xff4400, altColor: 0xff9933,
    rate: 150,
    vxRange: [-0.04, 0.04], vyRange: [-0.12, -0.04],
    lifeRange: [600, 1200], sizeRange: [2, 4],
    origin: 'bottom',
  },
  core: {
    color: 0xcc44ff, altColor: 0xffffff,
    rate: 240,
    vxRange: [-0.03, 0.03], vyRange: [-0.03, 0.03],
    lifeRange: [1000, 2000], sizeRange: [1.5, 3],
    origin: 'sides',
  },
};

// ─── 광물 색상 팔레트 (data/minerals.json 동기) ───────────────

const MINERAL_COLORS: Record<string, number> = {
  copper:     0xb87333,
  iron:       0xa7a7a7,
  silver:     0xcfcfcf,
  gold:       0xffd700,
  ruby:       0xe0115f,
  sapphire:   0x0f52ba,
  emerald:    0x50c878,
  diamond:    0xb9f2ff,
  obsidian:   0x3d2c4d,
  mithril:    0x9ad9ea,
  adamantite: 0x7e1f1f,
  orichalcum: 0xf6c84c,
};

// ─── 색상 유틸 ────────────────────────────────────────────────

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

// ─── PixiGameRenderer ────────────────────────────────────────

export class PixiGameRenderer implements GameRenderer {
  private app: Application | null = null;

  // 레이어 계층: bg → world → particles → hud
  private bgLayer: Container | null = null;
  private worldLayer: Container | null = null;
  private particleLayer: Container | null = null;
  private hudLayer: Container | null = null;

  // 배경
  private bgGfx: Graphics | null = null;
  private currentTheme = DEFAULT_THEME;
  private targetTheme = DEFAULT_THEME;
  private bgTransitionAt = 0;

  // 광맥
  private veinGfx: Graphics | null = null;
  private veinHpBg: Graphics | null = null;
  private veinHpFg: Graphics | null = null;
  private veinColor = 0x6b4423;

  // Phase 4.1: 픽셀 아트 스프라이트 (veinGfx 아래 레이어)
  private veinFactory: VeinSpriteFactory | null = null;
  private veinBaseSprite: Sprite | null = null;
  private lastVeinMineralId = '';

  // Phase 6: 캐릭터 스프라이트
  private charGfx: Graphics | null = null;
  private charX = 0;
  private charTargetX = 0;   // lerp 목표 X (스무스 이동)
  private charY = 0;
  private charAttackT = 0;   // 0=idle, >0=swing 진행 중 (ms)
  private lastAttackSignal = 0; // 마지막 damageDealt 값 (공격 감지)
  private charBobT = 0;      // 걸음 보빙 타이머

  // Phase 6: EXP 바 HUD
  private expBg: Graphics | null = null;
  private expFg: Graphics | null = null;
  private expText: Text | null = null;

  // Phase 6: 광물 파편 파티클 트래킹
  private lastOreTotal = 0;

  // HUD
  private comboText: Text | null = null;
  private timerText: Text | null = null;
  private depthText: Text | null = null;
  private hudText: Text | null = null;

  // Phase 3.4: 스테이지 플래시 텍스트
  private stageNameText: Text | null = null;
  private stageNameFlashAt = 0;

  // Phase 3.4: 화면 흔들림
  private shakeAt = 0;

  // Phase 3.4: 앰비언트 파티클 타이머
  private ambientAccum = 0;

  // Phase 4-E: 제네릭 ObjectPool 사용
  private floatPool: ObjectPool<FloatingText> | null = null;
  private floatActive: FloatingText[] = [];
  private particlePool: ObjectPool<Particle> | null = null;
  private particleActive: Particle[] = [];

  // Phase 4-F: WebGL context-lost 핸들러
  private _onContextLost: ((e: Event) => void) | null = null;
  private _onContextRestored: ((e: Event) => void) | null = null;

  // 상태 추적
  private pointerHandlers: Array<(x: number, y: number) => void> = [];
  private lastFrameMs = performance.now();
  private lastVeinFlashAt = 0;
  private lastOreCount = 0;
  private lastVeinIndex = -1;
  private lastDepth = -1;
  private lastStageId = '';
  private lastDamageDealt = 0;

  // ─── init ─────────────────────────────────────────────────

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
      background: 0x121212,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    container.appendChild(this.app.canvas);

    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // 레이어
    this.bgLayer = new Container();
    this.worldLayer = new Container();
    this.particleLayer = new Container();
    this.hudLayer = new Container();
    this.app.stage.addChild(this.bgLayer);
    this.app.stage.addChild(this.worldLayer);
    this.app.stage.addChild(this.particleLayer);
    this.app.stage.addChild(this.hudLayer);

    // 배경
    const bg = new Graphics();
    this.bgLayer.addChild(bg);
    this.bgGfx = bg;
    this.drawBackground(bg, DEFAULT_THEME, W, H);

    // Phase 4.1: 픽셀 아트 베이스 스프라이트 (광맥 뒤 레이어)
    this.veinFactory = new VeinSpriteFactory(this.app.renderer as Renderer);
    this.veinFactory.warmUp();
    const baseSpr = new Sprite(this.veinFactory.getTexture('copper'));
    baseSpr.anchor.set(0.5, 0.5);
    baseSpr.x = W / 2;
    baseSpr.y = H / 2;
    this.worldLayer.addChild(baseSpr);
    this.veinBaseSprite = baseSpr;

    // 광맥 (이펙트 오버레이 — 균열·플래시·위험 펄스)
    const vein = new Graphics();
    this.drawVeinOverlay(vein, 1, 0);
    vein.x = W / 2;
    vein.y = H / 2;
    vein.eventMode = 'static';
    vein.cursor = 'pointer';
    // Phase 4.3: 모바일 터치 히트 영역 ±24px 패딩 확장
    vein.hitArea = new Rectangle(-88, -88, 176, 176);
    this.worldLayer.addChild(vein);
    this.veinGfx = vein;

    // HP 게이지
    const hpBg = new Graphics();
    const hpFg = new Graphics();
    this.worldLayer.addChild(hpBg);
    this.worldLayer.addChild(hpFg);
    this.veinHpBg = hpBg;
    this.veinHpFg = hpFg;

    // 콤보
    const combo = new Text({
      text: '',
      style: new TextStyle({
        fill: 0xffd166,
        fontFamily: 'Impact, sans-serif',
        fontSize: 36,
        stroke: { color: 0x000000, width: 4 },
      }),
    });
    combo.anchor.set(0.5);
    combo.x = W / 2;
    combo.y = H / 2 - 140;
    this.worldLayer.addChild(combo);
    this.comboText = combo;

    // 타이머
    const timer = new Text({
      text: '0:00',
      style: new TextStyle({
        fill: 0xffffff,
        fontFamily: 'monospace',
        fontSize: 28,
        stroke: { color: 0x000000, width: 3 },
      }),
    });
    timer.anchor.set(0.5, 0);
    timer.x = W / 2;
    timer.y = 12;
    this.hudLayer.addChild(timer);
    this.timerText = timer;

    // 깊이
    const depth = new Text({
      text: '',
      style: new TextStyle({
        fill: 0xaaaaaa,
        fontFamily: 'monospace',
        fontSize: 14,
        stroke: { color: 0x000000, width: 2 },
      }),
    });
    depth.anchor.set(1, 0);
    depth.x = W - 12;
    depth.y = 12;
    this.hudLayer.addChild(depth);
    this.depthText = depth;

    // HUD 디버그
    const hud = new Text({
      text: '',
      style: new TextStyle({ fill: 0x888888, fontFamily: 'monospace', fontSize: 11 }),
    });
    hud.x = 12;
    hud.y = 50;
    this.hudLayer.addChild(hud);
    this.hudText = hud;

    // Phase 6: 캐릭터 스프라이트 (광맥 아래)
    const charGfx = new Graphics();
    this.charX = W / 2;
    this.charTargetX = W / 2;
    this.charY = H * 0.72;
    charGfx.x = this.charX;
    charGfx.y = this.charY;
    this.worldLayer.addChild(charGfx);
    this.charGfx = charGfx;
    this.drawCharacter(charGfx, 0);

    // Phase 6: EXP 바 (하단 중앙)
    const expBg = new Graphics();
    const expFg = new Graphics();
    const expTxt = new Text({
      text: 'EXP',
      style: new TextStyle({ fill: 0xaaffaa, fontFamily: 'monospace', fontSize: 10, stroke: { color: 0x000000, width: 2 } }),
    });
    expBg.x = W / 2; expBg.y = H - 38;
    expFg.x = W / 2; expFg.y = H - 38;
    expTxt.anchor.set(0.5, 0.5); expTxt.x = W / 2; expTxt.y = H - 28;
    this.hudLayer.addChild(expBg);
    this.hudLayer.addChild(expFg);
    this.hudLayer.addChild(expTxt);
    this.expBg = expBg; this.expFg = expFg; this.expText = expTxt;
    this.drawExpBar(expBg, expFg, W, 0, 20);

    // Phase 3.4: 스테이지 이름 플래시 텍스트
    const stageName = new Text({
      text: '',
      style: new TextStyle({
        fill: 0xffffff,
        fontFamily: 'Impact, sans-serif',
        fontSize: 42,
        stroke: { color: 0x000000, width: 5 },
        letterSpacing: 4,
      }),
    });
    stageName.anchor.set(0.5, 0.5);
    stageName.x = W / 2;
    stageName.y = H / 2 - 180;
    stageName.alpha = 0;
    this.hudLayer.addChild(stageName);
    this.stageNameText = stageName;

    // Phase 4-E: ObjectPool — 플로팅 텍스트
    this.floatPool = new ObjectPool<FloatingText>(
      () => {
        const t = new Text({
          text: '',
          style: new TextStyle({
            fill: 0xffffff,
            fontFamily: 'monospace',
            fontSize: 18,
            fontWeight: 'bold',
            stroke: { color: 0x000000, width: 2 },
          }),
        });
        t.anchor.set(0.5);
        t.visible = false;
        this.worldLayer!.addChild(t);
        return { text: t, vy: 0, life: 0, maxLife: FLOAT_TEXT_LIFE_MS };
      },
      FLOAT_TEXT_POOL_SIZE,
      FLOAT_TEXT_POOL_SIZE,
    );

    // Phase 4-E: ObjectPool — 파티클
    this.particlePool = new ObjectPool<Particle>(
      () => {
        const g = new Graphics();
        g.visible = false;
        this.particleLayer!.addChild(g);
        return { gfx: g, vx: 0, vy: 0, life: 0, maxLife: PARTICLE_LIFE_MS, color: 0xffffff, size: 4 };
      },
      PARTICLE_POOL_SIZE,
      PARTICLE_POOL_SIZE,
    );

    // Phase 4-F: WebGL context-lost / context-restored
    const canvas = this.app.canvas as HTMLCanvasElement;
    this._onContextLost = (e: Event) => {
      e.preventDefault();
      logger.warn('WebGL context lost — pausing render');
    };
    this._onContextRestored = () => {
      logger.info('WebGL context restored — reinitialising');
      // PixiJS v8 restores textures automatically; just redraw background.
      if (this.bgGfx) this.drawBackground(this.bgGfx, this.targetTheme, W, H);
    };
    canvas.addEventListener('webglcontextlost', this._onContextLost);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored);

    // 입력
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', (e) => {
      const { x, y } = e.global;
      for (const h of this.pointerHandlers) h(x, y);
    });

    logger.info('PixiGameRenderer initialized', { width: W, height: H });
  }

  // ─── render ───────────────────────────────────────────────

  render(state: GameState, _alpha: number): void {
    if (!this.app || !this.veinGfx) return;

    const now = performance.now();
    const dt = now - this.lastFrameMs;
    this.lastFrameMs = now;

    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // 스테이지 테마 전환
    const stageId = (state.run?.stageId as string) ?? '';
    if (stageId && stageId !== this.lastStageId) {
      this.lastStageId = stageId;
      this.currentTheme = this.targetTheme;
      this.targetTheme = STAGE_THEMES[stageId] ?? DEFAULT_THEME;
      this.bgTransitionAt = now;
    }

    // 배경 페이드
    if (this.bgGfx) {
      let blendedTheme = this.targetTheme;
      if (this.bgTransitionAt > 0) {
        const t = Math.min(1, (now - this.bgTransitionAt) / BG_FADE_DURATION_MS);
        if (t < 1) {
          blendedTheme = {
            top: lerpColor(this.currentTheme.top, this.targetTheme.top, t),
            bottom: lerpColor(this.currentTheme.bottom, this.targetTheme.bottom, t),
            accent: lerpColor(this.currentTheme.accent, this.targetTheme.accent, t),
          };
        } else {
          this.bgTransitionAt = 0;
        }
      }
      this.drawBackground(this.bgGfx, blendedTheme, W, H);
    }

    // 새 광맥 플래시 + Phase 4.1: 광물 스프라이트 교체
    const veinIndex = state.run?.vein.veinIndex ?? -1;
    if (veinIndex !== this.lastVeinIndex) {
      this.lastVeinIndex = veinIndex;
      this.lastVeinFlashAt = now;

      // 지배 광물 ID로 스프라이트 텍스처 교체
      if (this.veinBaseSprite && this.veinFactory && state.run?.vein.mineralPool.length) {
        const dominant = state.run.vein.mineralPool.reduce((a, b) => (a.weight > b.weight ? a : b));
        const mineralId = dominant.mineralId as string;
        if (mineralId !== this.lastVeinMineralId) {
          this.veinBaseSprite.texture = this.veinFactory.getTexture(mineralId);
          this.lastVeinMineralId = mineralId;
        }
      }
    }

    // 광석 드랍 플로팅
    const totalOres = state.run
      ? Object.values(state.run.oresCollected).reduce((s, n) => s + n, 0)
      : 0;
    if (totalOres > this.lastOreCount && state.run) {
      const diff = totalOres - this.lastOreCount;
      const last = [...state.run.events].reverse().find((e) => e.type === 'ore_collected');
      const color =
        last?.type === 'ore_collected'
          ? (MINERAL_COLORS[last.mineralId as string] ?? 0xffffff)
          : 0xffffff;
      this.spawnFloat(`+${diff}`, this.veinGfx.x, this.veinGfx.y - 40, color);
    }
    this.lastOreCount = totalOres;

    // 데미지 플로팅
    const dmg = state.run?.damageDealt ?? 0;
    if (dmg > this.lastDamageDealt && state.run) {
      const lastHit = [...state.run.events].reverse().find((e) => e.type === 'mine_hit');
      if (lastHit?.type === 'mine_hit') {
        const comboColor = lastHit.combo > 3 ? 0xff6600 : lastHit.combo > 1 ? 0xffcc00 : 0xdddddd;
        this.spawnFloat(
          `-${lastHit.damage.toFixed(0)}`,
          this.veinGfx.x + (Math.random() - 0.5) * 80,
          this.veinGfx.y,
          comboColor,
          15,
        );
      }
    }
    this.lastDamageDealt = dmg;

    // 깊이 증가 → 파티클 폭발 + 스테이지 플래시 + 흔들림
    const depth = state.run?.depth ?? 1;
    if (depth !== this.lastDepth && this.lastDepth !== -1) {
      this.spawnBurst(this.veinGfx.x, this.veinGfx.y, 0x44aaff, 20);
      // 스테이지 이름 플래시
      if (this.stageNameText && stageId) {
        this.stageNameText.text = STAGE_NAMES[stageId] ?? stageId;
        this.stageNameText.alpha = 1;
        this.stageNameFlashAt = now;
      }
      // 화면 흔들림
      this.shakeAt = now;
    }
    this.lastDepth = depth;

    // Phase 3.4: 스테이지 플래시 페이드
    if (this.stageNameText && this.stageNameFlashAt > 0) {
      const elapsed = now - this.stageNameFlashAt;
      if (elapsed < STAGE_FLASH_DURATION_MS) {
        // 처음 300ms는 유지, 이후 페이드아웃
        const holdMs = 300;
        const fadeMs = STAGE_FLASH_DURATION_MS - holdMs;
        this.stageNameText.alpha = elapsed < holdMs
          ? 1
          : 1 - (elapsed - holdMs) / fadeMs;
      } else {
        this.stageNameText.alpha = 0;
        this.stageNameFlashAt = 0;
      }
    }

    // Phase 3.4: 화면 흔들림
    if (this.worldLayer && this.shakeAt > 0) {
      const elapsed = now - this.shakeAt;
      if (elapsed < SHAKE_DURATION_MS) {
        const t = elapsed / SHAKE_DURATION_MS;
        const amplitude = SHAKE_AMPLITUDE * (1 - t);
        this.worldLayer.x = (Math.random() - 0.5) * 2 * amplitude;
        this.worldLayer.y = (Math.random() - 0.5) * 2 * amplitude;
      } else {
        this.worldLayer.x = 0;
        this.worldLayer.y = 0;
        this.shakeAt = 0;
      }
    }

      // Timber Rush: dangerSide 시각 인디케이터 (vein 옆 위험 표시)
    if (this.veinGfx && state.run) {
      this.drawDangerIndicator(this.veinGfx, state.run.vein.dangerSide, W, H, now);
    }

    // Phase 6: 광물 파편 이펙트 (ore total 증가 감지)
    const oreTotal = state.run
      ? Object.values(state.run.oresCollected).reduce((s, n) => s + n, 0)
      : 0;
    if (oreTotal > this.lastOreTotal && state.run) {
      const lastOreEv = [...state.run.events].reverse().find((e) => e.type === 'ore_collected');
      const fragColor = lastOreEv?.type === 'ore_collected'
        ? (MINERAL_COLORS[lastOreEv.mineralId as string] ?? 0xffffff)
        : 0xffd700;
      // 파편 3~5개 — 사방으로 퍼진 뒤 캐릭터 방향으로 중력 곡선
      const veinX = this.veinGfx?.x ?? W / 2;
      const veinY = this.veinGfx?.y ?? H / 2;
      const fragCount = 3 + Math.floor(Math.random() * 3);
      for (let fi = 0; fi < fragCount; fi++) {
        const angle = (Math.PI * 2 * fi) / fragCount + Math.random() * 1.0;
        const speed = 0.18 + Math.random() * 0.22;
        this.spawnSingle(veinX, veinY, fragColor,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - 0.12,
          900, 5 + Math.random() * 4);
      }
    }
    this.lastOreTotal = oreTotal;

    // Phase 6 / Timber Rush: 캐릭터 공격 감지 + 애니메이션
    const curDmg = state.run?.damageDealt ?? 0;
    if (curDmg > this.lastAttackSignal) {
      this.charAttackT = 220; // 220ms 스윙 애니메이션
    }
    this.lastAttackSignal = curDmg;
    this.charBobT += dt;
    if (this.charAttackT > 0) this.charAttackT -= dt;

    if (this.charGfx && state.run) {
      this.charGfx.visible = true; // 항상 visible (핵심 버그 수정)
      const swingT = Math.max(0, this.charAttackT) / 220;
      const bob = state.run.cardOffer ? 0 : Math.sin(this.charBobT / 240) * 2;

      // Timber Rush: playerSide에 따라 좌/우로 캐릭터 위치 이동 (lerp 스무딩)
      const playerSide = state.run.playerSide;
      const veinCX = this.veinGfx?.x ?? W / 2;
      const sideOffsetX = playerSide === 'left' ? -110 : 110;
      this.charTargetX = veinCX + sideOffsetX;
      this.charY = H * 0.5;
      // 부드러운 이동: 목표 X를 향해 매 프레임 18% 접근
      this.charX += (this.charTargetX - this.charX) * 0.18;
      this.charGfx.x = this.charX;
      this.charGfx.y = this.charY + bob;
      // 목표 방향에 따라 캐릭터 좌우 뒤집기
      this.charGfx.scale.x = playerSide === 'right' ? -1 : 1;
      this.drawCharacter(this.charGfx, swingT);
    } else if (this.charGfx) {
      this.charGfx.visible = false;
    }

    // Phase 6: EXP 바 업데이트
    if (this.expBg && this.expFg && this.expText && state.run) {
      const expRatio = Math.min(1, state.run.exp / state.run.expThreshold);
      this.drawExpBar(this.expBg, this.expFg, W, expRatio, state.run.expThreshold);
      this.expText.text = `EXP ${state.run.exp}/${state.run.expThreshold}`;
      this.expBg.x = W / 2; this.expBg.y = H - 38;
      this.expFg.x = W / 2; this.expFg.y = H - 38;
      this.expText.x = W / 2; this.expText.y = H - 28;
      this.expBg.visible = true;
      this.expFg.visible = true;
      this.expText.visible = true;
    } else if (this.expBg) {
      this.expBg.visible = false;
      this.expFg!.visible = false;
      this.expText!.visible = false;
    }

    // 광맥 지배 광물 색상
    if (state.run?.vein.mineralPool.length) {
      const dominant = state.run.vein.mineralPool.reduce((a, b) => (a.weight > b.weight ? a : b));
      this.veinColor = MINERAL_COLORS[dominant.mineralId as string] ?? 0x6b4423;
    }

    // 광맥 렌더 — 베이스 스프라이트 위에 이펙트 오버레이
    const hpRatio = state.run ? state.run.vein.hp / state.run.vein.maxHp : 1;
    const flashT = Math.max(0, 1 - (now - this.lastVeinFlashAt) / 250);
    // 베이스 스프라이트 HP 페이드 (낮을수록 어둡게)
    if (this.veinBaseSprite) {
      this.veinBaseSprite.alpha = 0.45 + hpRatio * 0.55;
    }
    this.drawVeinOverlay(this.veinGfx, hpRatio, flashT);

    if (this.veinHpBg && this.veinHpFg) {
      this.drawHpBar(this.veinHpBg, this.veinHpFg, this.veinGfx.x, this.veinGfx.y - 108, hpRatio);
    }

    // 콤보
    if (this.comboText) {
      const combo = state.run?.combo ?? 0;
      if (combo > 1) {
        this.comboText.text = `x${combo}`;
        this.comboText.scale.set(1 + Math.min(combo - 2, 8) * 0.05);
        this.comboText.alpha = 1;
      } else {
        this.comboText.text = '';
      }
    }

    // 타이머
    if (this.timerText) {
      const remaining = state.run?.remaining ?? 0;
      const sec = Math.max(0, remaining / 1000);
      const min = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      this.timerText.text = `${min}:${s.toString().padStart(2, '0')}`;
      this.timerText.style.fill = remaining < 10_000 ? 0xff4444 : 0xffffff;
    }

    // 깊이 HUD
    if (this.depthText && state.run) {
      this.depthText.text = `Depth ${state.run.depth}  Vein ×${state.run.veinsDestroyed}`;
    }

    // 디버그 HUD
    if (this.hudText && state.run) {
      const oresStr =
        Object.entries(state.run.oresCollected)
          .map(([k, v]) => `${k}:${v}`)
          .join(' ') || '—';
      this.hudText.text =
        `dmgMul ${state.run.modifiers.damageMul.toFixed(2)} · ` +
        `dropMul ${state.run.modifiers.dropRateMul.toFixed(2)} · ` +
        `cWin ${state.run.modifiers.comboWindowMs}ms\n` +
        `ores ${oresStr}`;
    }

    this.tickFloats(dt);
    this.tickParticles(dt);

    // Phase 3.4: 앰비언트 파티클 (인게임일 때만)
    if (state.run && stageId) {
      this.tickAmbient(dt, stageId, W, H);
    }
  }

  // ─── resize / destroy ────────────────────────────────────

  resize(width: number, height: number): void {
    if (!this.app) return;
    this.app.renderer.resize(width, height);
    if (this.veinGfx) { this.veinGfx.x = width / 2; this.veinGfx.y = height / 2; }
    if (this.veinBaseSprite) { this.veinBaseSprite.x = width / 2; this.veinBaseSprite.y = height / 2; }
    if (this.comboText) { this.comboText.x = width / 2; this.comboText.y = height / 2 - 140; }
    if (this.timerText) this.timerText.x = width / 2;
    if (this.depthText) this.depthText.x = width - 12;
    if (this.stageNameText) { this.stageNameText.x = width / 2; this.stageNameText.y = height / 2 - 180; }
    if (this.bgGfx) this.drawBackground(this.bgGfx, this.targetTheme, width, height);
    // Phase 6: 캐릭터 + EXP 바 재배치
    this.charX = width / 2;
    this.charTargetX = width / 2;
    this.charY = height * 0.72;
    if (this.charGfx) { this.charGfx.x = this.charX; this.charGfx.y = this.charY; }
    if (this.expBg) { this.expBg.x = width / 2; this.expBg.y = height - 38; }
    if (this.expFg) { this.expFg.x = width / 2; this.expFg.y = height - 38; }
    if (this.expText) { this.expText.x = width / 2; this.expText.y = height - 28; }
    this.app.stage.hitArea = this.app.screen;
  }

  onPointerDown(handler: (x: number, y: number) => void): void {
    this.pointerHandlers.push(handler);
  }

  destroy(): void {
    this.pointerHandlers = [];

    // Phase 4-F: WebGL 이벤트 해제
    if (this.app) {
      const canvas = this.app.canvas as HTMLCanvasElement;
      if (this._onContextLost) canvas.removeEventListener('webglcontextlost', this._onContextLost);
      if (this._onContextRestored) canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
      this._onContextLost = null;
      this._onContextRestored = null;
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }

    this.veinFactory?.dispose();
    this.veinFactory = null;
    this.veinBaseSprite = null;

    this.bgGfx = null;
    this.veinGfx = null;
    this.veinHpBg = null;
    this.veinHpFg = null;
    this.comboText = null;
    this.timerText = null;
    this.depthText = null;
    this.hudText = null;
    this.stageNameText = null;
    // Phase 6: 캐릭터 + EXP 바
    this.charGfx = null;
    this.expBg = null;
    this.expFg = null;
    this.expText = null;

    // Phase 4-E: ObjectPool 정리
    this.floatPool?.clear();
    this.floatPool = null;
    this.floatActive = [];
    this.particlePool?.clear();
    this.particlePool = null;
    this.particleActive = [];
  }

  // ─── 외부 호출: 광맥 파괴 이펙트 ───────────────────────────

  spawnVeinBurst(x?: number, y?: number, color?: number): void {
    const cx = x ?? (this.veinGfx?.x ?? 400);
    const cy = y ?? (this.veinGfx?.y ?? 300);
    this.spawnBurst(cx, cy, color ?? this.veinColor, 20);
    this.spawnBurst(cx, cy, 0xffffff, 8);
  }

  // ─── private: 드로잉 ─────────────────────────────────────

  private drawBackground(
    g: Graphics,
    theme: { top: number; bottom: number; accent: number },
    W: number,
    H: number,
  ): void {
    g.clear();
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      g.rect(0, (H / steps) * i, W, H / steps + 1).fill(lerpColor(theme.top, theme.bottom, t));
    }
    // 빛줄기 악센트
    g.moveTo(W * 0.3, 0)
      .lineTo(W * 0.5, H)
      .lineTo(W * 0.35, H)
      .lineTo(W * 0.15, 0)
      .fill({ color: theme.accent, alpha: 0.04 });
  }

  /**
   * drawVeinOverlay — Phase 4.1 이후: 베이스 스프라이트 위에 그려지는 이펙트 레이어.
   * 몸통/색상은 VeinSpriteFactory 스프라이트가 담당, 여기서는 HP 균열·플래시·위험 펄스만.
   */
  private drawVeinOverlay(g: Graphics, hpRatio: number, flashT: number): void {
    g.clear();

    // 새 광맥 플래시 — 흰색 오버레이 페이드
    if (flashT > 0) {
      g.rect(-64, -64, VEIN_TEX_SIZE, VEIN_TEX_SIZE)
        .fill({ color: 0xffffff, alpha: flashT * 0.38 });
    }

    // 균열 (HP 낮을수록 많아짐)
    const cracks = Math.floor((1 - hpRatio) * 8);
    const crackColor = 0x110000;
    for (let i = 0; i < cracks; i++) {
      const x1 = -44 + (i % 4) * 24;
      const y1 = -52 + Math.floor(i / 4) * 68 + (i % 2) * 18;
      g.moveTo(x1, y1)
        .lineTo(x1 + 18 + (i % 3) * 8, y1 + 36)
        .stroke({ width: 2, color: crackColor, alpha: 0.75 });
    }

    // 위험 펄스 (HP < 15%)
    if (hpRatio < 0.15) {
      const pulse = (Math.sin(Date.now() / 80) + 1) / 2;
      g.rect(-64, -64, VEIN_TEX_SIZE, VEIN_TEX_SIZE)
        .fill({ color: 0xff2200, alpha: pulse * 0.32 });
    }
  }

  private drawHpBar(bg: Graphics, fg: Graphics, x: number, y: number, ratio: number): void {
    const W = 140, H = 10;
    bg.clear().rect(x - W / 2, y, W, H).fill(0x111111).stroke({ width: 1, color: 0x333333 });
    if (ratio > 0) {
      const barColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xffaa00 : 0xff3333;
      fg.clear()
        .rect(x - W / 2 + 1, y + 1, (W - 2) * Math.max(0, Math.min(1, ratio)), H - 2)
        .fill(barColor);
    } else {
      fg.clear();
    }
  }

  // ─── private: 플로팅 텍스트 ──────────────────────────────

  private spawnFloat(label: string, x: number, y: number, color: number, fontSize = 18): void {
    if (!this.floatPool) return;
    const slot = this.floatPool.acquire();
    slot.text.text = label;
    slot.text.style.fill = color;
    slot.text.style.fontSize = fontSize;
    slot.text.x = x + (Math.random() - 0.5) * 60;
    slot.text.y = y;
    slot.text.alpha = 1;
    slot.text.visible = true;
    slot.life = 0;
    slot.vy = -0.09;
    this.floatActive.push(slot);
  }

  private tickFloats(dt: number): void {
    const survivors: FloatingText[] = [];
    for (const f of this.floatActive) {
      f.life += dt;
      f.text.y += f.vy * dt;
      f.text.alpha = 1 - f.life / f.maxLife;
      if (f.life >= f.maxLife) {
        f.text.visible = false;
        this.floatPool?.release(f);
      } else {
        survivors.push(f);
      }
    }
    this.floatActive = survivors;
  }

  // ─── private: 파티클 ─────────────────────────────────────

  private spawnBurst(x: number, y: number, color: number, count: number): void {
    if (!this.particlePool) return;
    for (let i = 0; i < count; i++) {
      if (this.particlePool.available === 0 && this.particlePool.active >= PARTICLE_POOL_SIZE) break;
      const slot = this.particlePool.acquire();
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 0.15 + Math.random() * 0.25;
      slot.vx = Math.cos(angle) * speed;
      slot.vy = Math.sin(angle) * speed - 0.1;
      slot.life = 0;
      slot.maxLife = PARTICLE_LIFE_MS * (0.6 + Math.random() * 0.8);
      slot.color = color;
      slot.size = 3 + Math.random() * 5;
      slot.gfx.x = x;
      slot.gfx.y = y;
      slot.gfx.visible = true;
      this.particleActive.push(slot);
    }
  }

  private spawnSingle(
    x: number, y: number, color: number,
    vx: number, vy: number, life: number, size: number,
  ): void {
    if (!this.particlePool) return;
    if (this.particlePool.available === 0 && this.particlePool.active >= PARTICLE_POOL_SIZE) return;
    const slot = this.particlePool.acquire();
    slot.vx = vx;
    slot.vy = vy;
    slot.life = 0;
    slot.maxLife = life;
    slot.color = color;
    slot.size = size;
    slot.gfx.x = x;
    slot.gfx.y = y;
    slot.gfx.visible = true;
    this.particleActive.push(slot);
  }

  private tickParticles(dt: number): void {
    const survivors: Particle[] = [];
    for (const p of this.particleActive) {
      p.life += dt;
      p.gfx.x += p.vx * dt;
      p.gfx.y += p.vy * dt;
      p.vy += 0.0004 * dt; // 중력
      const alpha = 1 - p.life / p.maxLife;
      const size = p.size * alpha;
      p.gfx.clear().rect(-size / 2, -size / 2, size, size).fill({ color: p.color, alpha });
      if (p.life >= p.maxLife) {
        p.gfx.clear();
        p.gfx.visible = false;
        this.particlePool?.release(p);
      } else {
        survivors.push(p);
      }
    }
    this.particleActive = survivors;
  }

  // ─── Phase 3.4: 앰비언트 파티클 ─────────────────────────

  private tickAmbient(dt: number, stageId: string, W: number, H: number): void {
    const cfg = AMBIENT_CONFIGS[stageId];
    if (!cfg) return;

    this.ambientAccum += dt;
    if (this.ambientAccum < cfg.rate) return;
    this.ambientAccum -= cfg.rate;

    // 스폰 위치 결정
    let sx: number;
    let sy: number;
    if (cfg.origin === 'top') {
      sx = Math.random() * W;
      sy = -8;
    } else if (cfg.origin === 'bottom') {
      sx = Math.random() * W;
      sy = H + 8;
    } else {
      // sides
      sx = Math.random() < 0.5 ? -8 : W + 8;
      sy = Math.random() * H;
    }

    const color = Math.random() < 0.3 ? cfg.altColor : cfg.color;
    const vx = randRange(cfg.vxRange[0], cfg.vxRange[1]);
    const vy = randRange(cfg.vyRange[0], cfg.vyRange[1]);
    const life = randRange(cfg.lifeRange[0], cfg.lifeRange[1]);
    const size = randRange(cfg.sizeRange[0], cfg.sizeRange[1]);

    this.spawnSingle(sx, sy, color, vx, vy, life, size);
  }

  // ─── Timber Rush: 위험 방향 인디케이터 ───────────────────────
  /**
   * drawDangerIndicator — vein 왼쪽/오른쪽에 붉은 가시 경고 표시.
   * worldLayer의 veinGfx에 직접 그리지 않고, 별도 좌표계로 worldLayer에 그린다.
   * (veinGfx는 origin이 vein 중앙이므로, offset으로 좌/우 표시)
   */
  private drawDangerIndicator(
    veinGfx: Graphics,
    dangerSide: 'left' | 'right' | null,
    _W: number,
    _H: number,
    now: number,
  ): void {
    // veinGfx.clear() 후 drawVeinOverlay가 그려지므로, 여기선 별도 Graphics 없이
    // veinGfx 위에 추가로 그린다 (veinGfx는 center origin).
    if (!dangerSide) return;

    const pulse = (Math.sin(now / 120) + 1) / 2; // 0~1 펄스
    const alpha = 0.55 + pulse * 0.45;           // 0.55~1.0
    const spikeX = dangerSide === 'left' ? -88 : 88; // vein 경계
    const dir = dangerSide === 'left' ? -1 : 1;

    // 경고 배경 패널
    veinGfx.rect(spikeX - dir * 42, -72, 42, 144)
      .fill({ color: 0xff1111, alpha: alpha * 0.18 });

    // 가시 3개 (위/중/아래)
    const spikeLen = 20 + pulse * 8;
    for (const sy of [-36, 0, 36]) {
      veinGfx.moveTo(spikeX, sy)
        .lineTo(spikeX + dir * spikeLen, sy - 10)
        .lineTo(spikeX + dir * (spikeLen + 8), sy)
        .lineTo(spikeX + dir * spikeLen, sy + 10)
        .fill({ color: 0xff3333, alpha });
    }

    // 경고 외곽선
    veinGfx.rect(spikeX - dir * 42, -72, 42, 144)
      .stroke({ width: 2, color: 0xff4444, alpha: alpha * 0.6 });

    // "DANGER" 방향 화살표 (작은 삼각형)
    veinGfx.moveTo(spikeX + dir * 44, -8)
      .lineTo(spikeX + dir * 56, 0)
      .lineTo(spikeX + dir * 44, 8)
      .fill({ color: 0xff8888, alpha });
  }

  // ─── Phase 6: 캐릭터 픽셀 아트 ──────────────────────────────
  /**
   * drawCharacter — 픽셀 아트 드워프 광부.
   * swingT: 0=idle, 1=swing 시작, 0=swing 끝 (0→1→0 cycle 아님; 250ms로 0→1→0 이 아닌
   * charAttackT/250 이므로 1→0 방향으로 감소).
   */
  private drawCharacter(g: Graphics, swingT: number): void {
    g.clear();

    // 픽셀 사이즈 (2×2 블록)
    const px = 2;

    // 색상 팔레트
    const skinColor  = 0xf5c89a;
    const hairColor  = 0x5c3a10;
    const shirtColor = 0x3a6fbd;
    const pantsColor = 0x2b4a2b;
    const bootColor  = 0x3d2408;
    const axeHandle  = 0x8b5e2a;
    const axeHead    = 0xaaaacc;
    const axeEdge    = 0xffffff;

    // 스윙 각도 — pickaxe 팔 오프셋
    const swingAngle = swingT * (Math.PI * 0.55); // 최대 ~100°
    const armOffX = Math.sin(swingAngle) * 14;
    const armOffY = -Math.cos(swingAngle) * 8 + 8;

    // ── 몸통 (픽셀 블록 그리기 헬퍼) ──
    const blk = (bx: number, by: number, color: number, alpha = 1) => {
      g.rect(bx * px, by * px, px, px).fill({ color, alpha });
    };

    // 머리 (5×5, y=-12~-7)
    const hx = -2, hy = -12;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const isHair = row === 0 || (row === 1 && (col === 0 || col === 4));
        blk(hx + col, hy + row, isHair ? hairColor : skinColor);
      }
    }
    // 눈 (검정)
    blk(hx + 1, hy + 2, 0x111111);
    blk(hx + 3, hy + 2, 0x111111);

    // 몸통 셔츠 (5×4, y=-7~-3)
    const bx2 = -2, by2 = -7;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        blk(bx2 + col, by2 + row, shirtColor);
      }
    }

    // 바지 (5×3, y=-3~0)
    const px2 = -2, py2 = -3;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        blk(px2 + col, py2 + row, pantsColor);
      }
    }

    // 부츠 (각 2×2, y=0~2)
    blk(-2, 0, bootColor); blk(-1, 0, bootColor); blk(-2, 1, bootColor); blk(-1, 1, bootColor);
    blk(2,  0, bootColor); blk(3,  0, bootColor); blk(2,  1, bootColor); blk(3,  1, bootColor);

    // 곡괭이 팔 (스윙 오프셋 적용)
    const ax = Math.round(armOffX / px);
    const ay = Math.round(armOffY / px) - 4;
    // 손잡이 (3×1)
    for (let i = 0; i < 5; i++) {
      blk(ax + 2 + i, ay + i, axeHandle);
    }
    // 곡괭이 헤드
    blk(ax + 6, ay - 1, axeHead);
    blk(ax + 7, ay - 1, axeHead);
    blk(ax + 7, ay,     axeHead);
    blk(ax + 7, ay + 1, axeEdge); // 날 끝 하이라이트
  }

  // ─── Phase 6: EXP 바 ─────────────────────────────────────────

  private drawExpBar(bg: Graphics, fg: Graphics, W: number, ratio: number, _threshold: number): void {
    const barW = Math.min(W - 32, 320);
    const barH = 8;
    const ox = -barW / 2; // 중앙 기준 오프셋 (Graphics.x = W/2)

    // 배경
    bg.clear()
      .rect(ox, 0, barW, barH)
      .fill({ color: 0x111111, alpha: 0.85 })
      .rect(ox, 0, barW, barH)
      .stroke({ width: 1, color: 0x334433 });

    // 전경 (채워진 부분)
    fg.clear();
    if (ratio > 0) {
      const fillW = (barW - 2) * Math.max(0, Math.min(1, ratio));
      // 그라디언트 효과: 두 색상 줄무늬
      fg.rect(ox + 1, 1, fillW, barH - 2).fill({ color: 0x44dd44, alpha: 0.9 });
      // 상단 하이라이트 줄
      fg.rect(ox + 1, 1, fillW, 2).fill({ color: 0x88ff88, alpha: 0.6 });
    }
  }
}
