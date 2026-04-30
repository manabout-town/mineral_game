/**
 * SeededRandom — 결정론적 난수.
 *
 * Mulberry32 알고리즘. 32-bit seed → 0..1 float.
 * 빠르고 분포 양호하며 결정론.
 *
 * 5계명 §1 Pure Logic First — 외부 의존성 없음.
 * 동일 seed → 동일 시퀀스. 서버 검증과 클라가 100% 일치.
 */

import type { SeededRandom } from './types.ts';

export class Mulberry32 implements SeededRandom {
  private state: number;

  constructor(seed: number) {
    // 32-bit unsigned로 정규화
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Mulberry32.pick on empty array');
    return arr[this.nextInt(arr.length)] as T;
  }

  /** 가중치 기반 추첨. weights는 양수여야 함. 0이면 절대 안 뽑힘. */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length !== weights.length) throw new Error('items/weights length mismatch');
    if (items.length === 0) throw new Error('Mulberry32.pickWeighted on empty');
    const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Mulberry32.pickWeighted: all weights zero');
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i]!);
      if (r <= 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** 현재 state를 직렬화 (저장/리플레이용) */
  getState(): number {
    return this.state;
  }

  /** state 복원 */
  setState(s: number): void {
    this.state = s >>> 0;
  }
}
