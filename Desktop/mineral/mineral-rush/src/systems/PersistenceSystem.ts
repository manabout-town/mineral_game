/**
 * PersistenceSystem — 저장/불러오기 + HMAC 위변조 검증 + 마이그레이션.
 *
 * UNIVERSAL_GAME_FRAMEWORK §1.2 System Layer.
 * the-migration-expert: schemaVersion 기반 안전한 데이터 변환.
 * the-security-auditor: 로컬 저장 데이터 위변조 차단.
 *
 * Phase 1: localStorage + dev signer. 실제 schema 변환은 Phase 2부터.
 */

import type { GameState } from '../core/State.ts';
import type { IStorage } from '../platform/IStorage.ts';
import type { ISigner } from '../platform/ISigner.ts';
import { SCHEMA_VERSION, ERROR_CODES } from '../shared/constants.ts';
import { logger } from './Logger.ts';

const SAVE_KEY = 'game_state';

interface SignedPayload {
  payload: string; // JSON.stringify(GameState)
  signature: string;
  signedAt: number;
}

export class PersistenceSystem {
  constructor(
    private readonly storage: IStorage,
    private readonly signer: ISigner,
  ) {}

  async save(state: GameState): Promise<void> {
    try {
      const payload = JSON.stringify(state);
      const signature = await this.signer.sign(payload);
      const wrapper: SignedPayload = { payload, signature, signedAt: Date.now() };
      await this.storage.set(SAVE_KEY, wrapper);
    } catch (e) {
      logger.error(ERROR_CODES.SAVE_TAMPERED, 'PersistenceSystem.save failed', { error: String(e) });
      throw e;
    }
  }

  async load(): Promise<GameState | null> {
    const stored = await this.storage.get<SignedPayload>(SAVE_KEY);
    if (!stored) return null;

    const ok = await this.signer.verify(stored.payload, stored.signature);
    if (!ok) {
      logger.error(ERROR_CODES.SAVE_TAMPERED, 'Save signature mismatch — refusing to hydrate');
      return null;
    }

    let state: GameState;
    try {
      state = JSON.parse(stored.payload) as GameState;
    } catch (e) {
      logger.error(ERROR_CODES.SAVE_TAMPERED, 'Save payload not valid JSON', { error: String(e) });
      return null;
    }

    return this.migrate(state);
  }

  async clear(): Promise<void> {
    await this.storage.remove(SAVE_KEY);
  }

  /**
   * schemaVersion 기반 마이그레이션.
   * Phase 1: v1만 존재. Phase 2부터 v1→v2 변환 함수 추가.
   */
  private migrate(state: GameState): GameState {
    if (state.schemaVersion === SCHEMA_VERSION) return state;
    if (state.schemaVersion > SCHEMA_VERSION) {
      // 미래 버전 → 안전하게 거부 (다운그레이드는 데이터 유실 가능)
      logger.error(ERROR_CODES.MIGRATION_FAILED, 'Save is from a newer version', {
        saveVersion: state.schemaVersion,
        clientVersion: SCHEMA_VERSION,
      });
      throw new Error(ERROR_CODES.MIGRATION_FAILED);
    }
    // Phase 2~ 마이그레이션 체인
    let current = state;
    while (current.schemaVersion < SCHEMA_VERSION) {
      const fn = MIGRATIONS[current.schemaVersion];
      if (!fn) {
        logger.error(ERROR_CODES.MIGRATION_FAILED, 'Missing migration step', {
          fromVersion: current.schemaVersion,
        });
        throw new Error(ERROR_CODES.MIGRATION_FAILED);
      }
      current = fn(current);
    }
    return current;
  }
}

/** 버전 N → N+1 변환. Phase 2부터 채워짐. */
const MIGRATIONS: Record<number, (s: GameState) => GameState> = {
  // 0: (s) => ({ ...s, schemaVersion: 1 }), // 예시
};
