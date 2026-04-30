/**
 * LocalStorageAdapter — Web localStorage 기반 IStorage 구현.
 *
 * Phase 1 슬림. Phase 4+에서 Capacitor Preferences / Supabase 동기화로 교체.
 */

import type { IStorage } from './IStorage.ts';

export class LocalStorageAdapter implements IStorage {
  constructor(private readonly prefix: string = 'mineral_rush:') {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (e) {
      console.error('[LocalStorageAdapter.get] failed', { key, error: e });
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) {
      // QuotaExceededError, 사파리 프라이빗 모드 등
      console.error('[LocalStorageAdapter.set] failed', { key, error: e });
      throw e;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (e) {
      console.error('[LocalStorageAdapter.remove] failed', { key, error: e });
    }
  }
}
