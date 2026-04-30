/**
 * IStorage — 저장소 추상화.
 * UNIVERSAL_GAME_FRAMEWORK §1.3 Interface Layer.
 *
 * 구현체:
 *   - Phase 1: localStorage 래퍼 (web)
 *   - Phase 4+: Supabase storage_user_save 테이블 동기화
 *
 * core / systems는 IStorage 인터페이스만 안다. 구체 구현 import 금지.
 */

export interface IStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
