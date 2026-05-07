/**
 * VeinSpriteFactory — 광물별 절차적 픽셀 아트 RenderTexture 생성 + 캐시.
 *
 * PixiJS v8 Graphics API로 외부 이미지 파일 없이 생성.
 * - 12종 광물 × 고유 형태 (boulder / layered / crystal / cluster / radiant)
 * - RenderTexture 캐싱 — 광물 변경 시 즉시 반환, 재생성 없음
 * - 128×128 px 텍스처, 픽셀 아트 스타일 (4px 격자 스냅)
 *
 * 5계명 §1: core를 import 금지. MineralId는 shared에서만.
 */

import { Graphics, RenderTexture } from 'pixi.js';
import type { Renderer } from 'pixi.js';

export const VEIN_TEX_SIZE = 128;
const C = VEIN_TEX_SIZE / 2; // center = 64

// ─── 컬러 유틸 ───────────────────────────────────────────────

function darken(c: number, f: number): number {
  const r = Math.round(((c >> 16) & 0xff) * f);
  const g = Math.round(((c >> 8)  & 0xff) * f);
  const b = Math.round((c & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

function lighten(c: number, f: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 0xff) + (255 - ((c >> 16) & 0xff)) * f));
  const g = Math.min(255, Math.round(((c >> 8)  & 0xff) + (255 - ((c >> 8)  & 0xff)) * f));
  const b = Math.min(255, Math.round((c & 0xff)          + (255 - (c & 0xff))          * f));
  return (r << 16) | (g << 8) | b;
}

/** 4px 픽셀 격자 스냅 */
function s(v: number): number { return Math.round(v / 4) * 4; }

// ─── 형태 & 광물 정의 ─────────────────────────────────────────

type Shape = 'boulder' | 'layered' | 'crystal' | 'cluster' | 'radiant';

interface VeinDef {
  base:  number;           // 기본 색 (0xRRGGBB)
  gem:   number;           // 결정체 강조색
  shape: Shape;
  /** 결정체 위치 [cx offset, cy offset, size] — 중심점(64,64) 기준 */
  gems:  Array<[number, number, number]>;
}

const DEFS: Record<string, VeinDef> = {
  copper:     { base: 0xb87333, gem: 0xff9a44, shape: 'boulder',  gems: [[-18, -16, 9],  [16, 12, 7]] },
  iron:       { base: 0xa7a7a7, gem: 0xddeeff, shape: 'boulder',  gems: [[8,  -20, 8],   [-20, 16, 6]] },
  silver:     { base: 0xcfcfcf, gem: 0xeef5ff, shape: 'layered',  gems: [[0,  -14, 11],  [-18, 12, 7], [20, 8, 6]] },
  gold:       { base: 0xffd700, gem: 0xfffaaa, shape: 'layered',  gems: [[-12, -12, 13], [18, 6, 8],  [0, 20, 7]] },
  ruby:       { base: 0xe0115f, gem: 0xff6699, shape: 'crystal',  gems: [[0,  -22, 12],  [-18, 12, 8]] },
  sapphire:   { base: 0x0f52ba, gem: 0x4488ff, shape: 'crystal',  gems: [[-8, -20, 11],  [20, 6, 7],  [-16, 18, 6]] },
  emerald:    { base: 0x50c878, gem: 0x88ffaa, shape: 'crystal',  gems: [[0,  -20, 13],  [20, 12, 8], [-18, 16, 7]] },
  diamond:    { base: 0xb9f2ff, gem: 0xeefaff, shape: 'cluster',  gems: [[0,  -16, 15],  [18, 14, 10], [-20, 12, 9]] },
  obsidian:   { base: 0x3d2c4d, gem: 0x9922cc, shape: 'cluster',  gems: [[10, -18, 9],   [-16, 6, 7], [16, 16, 6]] },
  mithril:    { base: 0x9ad9ea, gem: 0xccf0ff, shape: 'radiant',  gems: [[-14, -18, 11], [18, -8, 9], [0, 24, 8],  [-20, 14, 7]] },
  adamantite: { base: 0x7e1f1f, gem: 0xcc4444, shape: 'radiant',  gems: [[0,  -20, 12],  [20, 8,  9], [-18, 12, 8], [8, 20, 6]] },
  orichalcum: { base: 0xf6c84c, gem: 0xfff4aa, shape: 'radiant',  gems: [[-16, -16, 13], [20, -6, 10], [0, 22, 9], [-22, 12, 7], [18, 16, 6]] },
};

const FALLBACK: VeinDef = {
  base: 0x6b4423, gem: 0xaa7744, shape: 'boulder',
  gems: [[0, -14, 9]],
};

// ─── 형태 드로어 (좌표는 텍스처 절대 좌표) ─────────────────────

function drawBoulder(g: Graphics, base: number): void {
  const dk = darken(base, 0.42);
  const lk = lighten(base, 0.22);
  // 비정형 다각형 — 바위 실루엣
  g.poly([
    C + s(-44), C + s(36),
    C + s(-52), C + s(0),
    C + s(-36), C + s(-44),
    C + s(-8),  C + s(-56),
    C + s(24),  C + s(-48),
    C + s(48),  C + s(-20),
    C + s(52),  C + s(16),
    C + s(36),  C + s(44),
    C + s(4),   C + s(52),
    C + s(-28), C + s(48),
  ]).fill(base).stroke({ width: 3, color: dk });
  // 좌상단 하이라이트 면
  g.poly([
    C + s(-36), C + s(-44),
    C + s(-8),  C + s(-56),
    C + s(24),  C + s(-48),
    C + s(16),  C + s(-28),
    C + s(-28), C + s(-18),
  ]).fill({ color: lk, alpha: 0.5 });
  // 우측 내부 그림자
  g.rect(C + s(24), C + s(-16), s(16), s(36)).fill({ color: dk, alpha: 0.32 });
}

function drawLayered(g: Graphics, base: number): void {
  const dk = darken(base, 0.38);
  const lk = lighten(base, 0.32);
  const md = darken(base, 0.72);
  // 4단 수평 슬래브 (오프셋으로 입체감)
  const slabs: Array<[number, number, number, number, number]> = [
    [C - s(40), C - s(48), s(80), s(24), lk],
    [C - s(44), C - s(20), s(84), s(24), base],
    [C - s(40), C + s(8),  s(84), s(24), md],
    [C - s(36), C + s(36), s(72), s(20), dk],
  ];
  for (const [x, y, w, h, col] of slabs) {
    g.rect(x, y, w, h).fill(col).stroke({ width: 2, color: dk });
  }
  // 수평 솔기선
  for (let i = 1; i <= 3; i++) {
    const sy = C - s(48) + i * s(24);
    g.moveTo(C - s(44), sy).lineTo(C + s(44), sy)
      .stroke({ width: 1, color: dk, alpha: 0.55 });
  }
}

function drawCrystal(g: Graphics, base: number): void {
  const dk = darken(base, 0.35);
  const lk = lighten(base, 0.32);
  // 전면
  g.poly([
    C - s(24), C - s(52),
    C + s(24), C - s(52),
    C + s(32), C + s(44),
    C - s(32), C + s(44),
  ]).fill(base).stroke({ width: 3, color: dk });
  // 좌측 어두운 면
  g.poly([
    C - s(32), C - s(28),
    C - s(24), C - s(52),
    C - s(32), C + s(44),
    C - s(44), C + s(24),
  ]).fill(darken(base, 0.55));
  // 상단 꼭짓점 면
  g.poly([
    C - s(12), C - s(60),
    C + s(12), C - s(60),
    C + s(24), C - s(52),
    C - s(24), C - s(52),
  ]).fill(lk);
  // 중앙 패싯 선
  g.moveTo(C, C - s(52)).lineTo(C, C + s(44))
    .stroke({ width: 1, color: lk, alpha: 0.22 });
}

/** 단일 결정 기둥 (cluster용) */
function pillar(
  g: Graphics, px: number, py: number,
  hw: number, hh: number,
  body: number, edge: number, tip: number,
): void {
  // 전면
  g.poly([px - hw, py - hh + s(12), px + hw, py - hh + s(12), px + hw, py + hh, px - hw, py + hh])
    .fill(body).stroke({ width: 2, color: edge });
  // 상단 팁
  g.poly([px, py - hh, px - hw, py - hh + s(12), px + hw, py - hh + s(12)])
    .fill(tip);
}

function drawCluster(g: Graphics, base: number): void {
  const dk = darken(base, 0.33);
  const lk = lighten(base, 0.28);
  // 뒤 작은 결정들 (먼저 그려 앞이 가림)
  pillar(g, C - s(12), C - s(4),  s(8),  s(28), darken(base, 0.80), dk, lighten(base, 0.15));
  pillar(g, C + s(12), C,         s(10), s(32), darken(base, 0.75), dk, lighten(base, 0.10));
  // 좌우 보조 결정
  pillar(g, C - s(28), C + s(12), s(16), s(40), darken(base, 0.78), dk, base);
  pillar(g, C + s(28), C + s(4),  s(18), s(44), darken(base, 0.72), dk, base);
  // 중앙 메인 결정
  pillar(g, C, C - s(4), s(24), s(52), base, dk, lk);
}

function drawRadiant(g: Graphics, base: number): void {
  const dk = darken(base, 0.28);
  const lk = lighten(base, 0.38);
  // 6각 별 외곽
  const outer: number[] = [];
  const inner2: number[] = [];
  for (let i = 0; i < 12; i++) {
    const r     = i % 2 === 0 ? s(52) : s(28);
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    outer.push(C + s(Math.cos(angle) * r / 4) * 4, C + s(Math.sin(angle) * r / 4) * 4);
    // inner ring
    const r2 = i % 2 === 0 ? s(36) : s(18);
    inner2.push(C + s(Math.cos(angle) * r2 / 4) * 4, C + s(Math.sin(angle) * r2 / 4) * 4);
  }
  g.poly(outer).fill(base).stroke({ width: 3, color: dk });
  g.poly(inner2).fill(lk);
  // 방사형 선
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    g.moveTo(C, C)
      .lineTo(C + Math.round(Math.cos(angle) * s(48)), C + Math.round(Math.sin(angle) * s(48)))
      .stroke({ width: 1, color: dk, alpha: 0.38 });
  }
}

// ─── 결정체 오버레이 ──────────────────────────────────────────

function drawGem(g: Graphics, cx: number, cy: number, size: number, color: number): void {
  const sz = Math.max(4, s(size));
  const lk = lighten(color, 0.3);
  // 다이아몬드 모양 (회전된 정사각형)
  g.poly([cx, cy - sz, cx + sz, cy, cx, cy + sz, cx - sz, cy])
    .fill(color)
    .stroke({ width: 1, color: lk });
  // 하이라이트 점
  const hSz = Math.max(2, Math.round(sz * 0.22));
  g.circle(cx - Math.round(sz * 0.24), cy - Math.round(sz * 0.24), hSz)
    .fill({ color: 0xffffff, alpha: 0.65 });
}

// ─── 팩토리 클래스 ────────────────────────────────────────────

export class VeinSpriteFactory {
  private cache = new Map<string, RenderTexture>();
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /** 광물 ID → RenderTexture (캐시 미스 시 즉시 생성) */
  getTexture(mineralId: string): RenderTexture {
    const hit = this.cache.get(mineralId);
    if (hit) return hit;
    const def = DEFS[mineralId] ?? FALLBACK;
    const tex = this._bake(def);
    this.cache.set(mineralId, tex);
    return tex;
  }

  /** 모든 광물 텍스처를 미리 생성 (init 시 warm-up) */
  warmUp(): void {
    for (const id of Object.keys(DEFS)) {
      this.getTexture(id);
    }
  }

  dispose(): void {
    for (const tex of this.cache.values()) {
      tex.destroy(true);
    }
    this.cache.clear();
  }

  // ─── private ──────────────────────────────────────────────

  private _bake(def: VeinDef): RenderTexture {
    const tex = RenderTexture.create({ width: VEIN_TEX_SIZE, height: VEIN_TEX_SIZE });
    const g   = new Graphics();

    // 형태 그리기
    switch (def.shape) {
      case 'boulder':  drawBoulder(g, def.base);  break;
      case 'layered':  drawLayered(g, def.base);  break;
      case 'crystal':  drawCrystal(g, def.base);  break;
      case 'cluster':  drawCluster(g, def.base);  break;
      case 'radiant':  drawRadiant(g, def.base);  break;
    }

    // 결정체 오버레이
    for (const [ox, oy, sz] of def.gems) {
      drawGem(g, C + s(ox), C + s(oy), sz, def.gem);
    }

    this.renderer.render({ container: g, target: tex, clear: true });
    g.destroy();
    return tex;
  }
}
