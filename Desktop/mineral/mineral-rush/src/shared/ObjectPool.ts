/**
 * ObjectPool<T> — 제네릭 오브젝트 풀 (Phase 4-E).
 *
 * GC 압박을 줄이기 위해 자주 생성/소멸되는 오브젝트를 재사용.
 * PixiGameRenderer의 플로팅 텍스트·파티클 풀에서 사용.
 *
 * 사용법:
 *   const pool = new ObjectPool(() => new Particle(), 60);
 *   const p = pool.acquire();   // 풀에서 꺼냄 (없으면 새로 생성)
 *   pool.release(p);            // 다 쓴 객체 풀에 반환
 *
 * 5계명 §1: shared 레이어 — 외부 import 없음.
 */

export class ObjectPool<T> {
  private readonly free: T[] = [];
  private _totalCreated = 0;
  private _peakActive = 0;
  private _currentActive = 0;

  /**
   * @param factory   풀이 비었을 때 새 인스턴스를 만드는 함수
   * @param initialSize 초기 생성 개수 (0이면 지연 생성)
   * @param maxSize 풀 최대 크기 (release 시 초과분은 버림, 0 = 무제한)
   */
  constructor(
    private readonly factory: () => T,
    initialSize = 0,
    private readonly maxSize = 0,
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.free.push(factory());
      this._totalCreated++;
    }
  }

  /** 풀에서 인스턴스 하나를 꺼낸다. 비어 있으면 factory로 새로 만든다. */
  acquire(): T {
    const obj = this.free.pop() ?? this._create();
    this._currentActive++;
    if (this._currentActive > this._peakActive) {
      this._peakActive = this._currentActive;
    }
    return obj;
  }

  /** 사용이 끝난 인스턴스를 풀에 반환한다. */
  release(obj: T): void {
    this._currentActive = Math.max(0, this._currentActive - 1);
    if (this.maxSize > 0 && this.free.length >= this.maxSize) {
      // 초과분은 GC에 맡김
      return;
    }
    this.free.push(obj);
  }

  /** 현재 풀에 대기 중인(쉬는) 인스턴스 수 */
  get available(): number {
    return this.free.length;
  }

  /** 현재 acquire 상태인 인스턴스 수 */
  get active(): number {
    return this._currentActive;
  }

  /** 지금까지 pool이 생성한 총 인스턴스 수 (디버그용) */
  get totalCreated(): number {
    return this._totalCreated;
  }

  /** 피크 동시 사용 수 (디버그용) */
  get peakActive(): number {
    return this._peakActive;
  }

  /** 풀에 있는 모든 대기 인스턴스에 콜백 적용 (bulk reset 등) */
  forEach(cb: (obj: T) => void): void {
    for (const obj of this.free) cb(obj);
  }

  /** 풀 내용을 모두 비운다. 소멸 콜백이 필요하면 onDestroy를 넘긴다. */
  clear(onDestroy?: (obj: T) => void): void {
    if (onDestroy) {
      for (const obj of this.free) onDestroy(obj);
    }
    this.free.length = 0;
  }

  private _create(): T {
    this._totalCreated++;
    return this.factory();
  }
}
