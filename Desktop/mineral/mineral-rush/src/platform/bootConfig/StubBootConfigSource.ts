/**
 * StubBootConfigSource — 오프라인 / 개발용.
 *
 * 모든 플래그 false, maintenance disabled.
 */

import { DEFAULT_BOOT_CONFIG, type BootConfig, type IBootConfigSource } from '../IBootConfig.ts';

export class StubBootConfigSource implements IBootConfigSource {
  async fetch(): Promise<BootConfig> {
    return { ...DEFAULT_BOOT_CONFIG, fetchedAt: Date.now() };
  }
}
