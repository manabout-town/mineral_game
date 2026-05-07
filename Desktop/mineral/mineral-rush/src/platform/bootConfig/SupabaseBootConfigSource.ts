/**
 * SupabaseBootConfigSource — feature_flags + maintenance 테이블 페치.
 *
 * RLS: 공개 read-only.
 * 네트워크 실패 시 LocalStorage 캐시 fallback (비어있으면 DEFAULT_BOOT_CONFIG).
 *
 * Phase 4 시점: maintenance.maintenance singleton row + feature_flags 다중 row.
 */

import {
  DEFAULT_BOOT_CONFIG,
  type BootConfig,
  type FeatureFlags,
  type IBootConfigSource,
  type MaintenanceState,
} from '../IBootConfig.ts';

const CACHE_KEY = 'mineral_rush:boot_config_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간

interface SupabaseBootConfigOptions {
  /** Supabase 프로젝트 base URL (예: https://xxx.supabase.co) */
  baseUrl: string;
  /** anon publishable key */
  anonKey: string;
  /** 타임아웃 ms — 기본 4초 (느린 망에서도 게임은 떠야 함) */
  timeoutMs?: number;
}

interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  payload: unknown;
}

interface MaintenanceRow {
  id: number;
  enabled: boolean;
  message_ko: string | null;
  message_en: string | null;
  min_supported_version: string | null;
}

export class SupabaseBootConfigSource implements IBootConfigSource {
  constructor(private readonly opts: SupabaseBootConfigOptions) {}

  async fetch(): Promise<BootConfig> {
    try {
      const cfg = await this.fetchFromServer();
      this.writeCache(cfg);
      return cfg;
    } catch (e) {
      const cached = this.readCache();
      if (cached) {
        return { ...cached, fetchedFromServer: false };
      }
      console.warn('[BootConfig] fetch failed, using default', e);
      return { ...DEFAULT_BOOT_CONFIG, fetchedAt: Date.now() };
    }
  }

  private async fetchFromServer(): Promise<BootConfig> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 4000);
    try {
      const headers = {
        apikey: this.opts.anonKey,
        Authorization: `Bearer ${this.opts.anonKey}`,
        'Content-Type': 'application/json',
      };

      const [flagsRes, maintRes] = await Promise.all([
        fetch(`${this.opts.baseUrl}/rest/v1/feature_flags?select=key,enabled,payload`, {
          headers,
          signal: ctrl.signal,
        }),
        fetch(
          `${this.opts.baseUrl}/rest/v1/maintenance?select=id,enabled,message_ko,message_en,min_supported_version&id=eq.1`,
          { headers, signal: ctrl.signal },
        ),
      ]);
      clearTimeout(timer);

      if (!flagsRes.ok || !maintRes.ok) {
        throw new Error(`http ${flagsRes.status}/${maintRes.status}`);
      }

      const flagsRows = (await flagsRes.json()) as FeatureFlagRow[];
      const maintRows = (await maintRes.json()) as MaintenanceRow[];

      const flags: FeatureFlags = {
        ads_enabled: false,
        iap_enabled: false,
        new_card_system: false,
      };
      for (const r of flagsRows) {
        flags[r.key] = !!r.enabled;
      }

      const m = maintRows[0];
      const maintenance: MaintenanceState = m
        ? {
            enabled: !!m.enabled,
            messageKo: m.message_ko ?? undefined,
            messageEn: m.message_en ?? undefined,
            minSupportedVersion: m.min_supported_version ?? undefined,
          }
        : { enabled: false };

      return {
        flags,
        maintenance,
        fetchedFromServer: true,
        fetchedAt: Date.now(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private readCache(): BootConfig | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw) as BootConfig;
      if (Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
      return cached;
    } catch {
      return null;
    }
  }

  private writeCache(cfg: BootConfig): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
    } catch {
      /* 사파리 프라이빗 등 — 무시 */
    }
  }
}
