/**
 * Telemetry — LocalStorage 기반 이벤트 적재.
 *
 * Phase 2 플레이테스트용. 테스터가 brower devtools 없이도
 * UI의 "Export" 버튼으로 JSON 다운로드 가능.
 *
 * Phase 4에서 Mixpanel/Amplitude로 forwarding 추가 (LocalStorage는 백업으로 유지).
 */

import type { IPlatformAdapter } from './IPlatformAdapter.ts';

const KEY = 'mineral_rush:telemetry';
const SESSION_KEY = 'mineral_rush:session_id';
const META_KEY = 'mineral_rush:telemetry_meta';
/** 메모리 한계 — 한 세션에 최대 이벤트 수 (1만 = 약 1MB) */
const MAX_EVENTS = 10_000;

export interface TelemetryEvent {
  id: number;
  ts: number; // epoch ms
  name: string;
  props: Record<string, unknown>;
}

export interface TelemetryMeta {
  sessionId: string;
  /** 세션 첫 이벤트 ts */
  firstEventAt: number;
  /** 마지막 이벤트 ts */
  lastEventAt: number;
  /** 빌드 버전 */
  gameVersion: string;
  schemaVersion: number;
  /** 디바이스 정보 (PII 없음) */
  device: {
    platform: string;
    model: string;
    osVersion: string;
    language: string;
    deviceId: string; // 익명 디바이스 ID (UUID)
  };
}

export interface TelemetryExport {
  meta: TelemetryMeta;
  events: TelemetryEvent[];
}

export class Telemetry {
  private nextId = 0;
  private buffer: TelemetryEvent[] = [];
  private meta: TelemetryMeta;
  private flushTimer: number | null = null;

  constructor(private readonly platform: IPlatformAdapter) {
    this.meta = this.loadOrCreateMeta();
    this.buffer = this.loadEvents();
    this.nextId = this.buffer.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  }

  track(name: string, props: Record<string, unknown> = {}): void {
    const ev: TelemetryEvent = {
      id: this.nextId++,
      ts: Date.now(),
      name,
      props,
    };
    this.buffer.push(ev);
    if (this.buffer.length > MAX_EVENTS) this.buffer.shift();
    this.meta.lastEventAt = ev.ts;
    if (this.meta.firstEventAt === 0) this.meta.firstEventAt = ev.ts;
    this.scheduleFlush();
    // 분석 SDK로도 전달 (Phase 4)
    this.platform.trackEvent(name, props);
  }

  /** 모든 이벤트와 메타를 export 가능한 단일 객체로 직렬화 */
  exportAll(): TelemetryExport {
    return { meta: { ...this.meta }, events: [...this.buffer] };
  }

  /** 다운로드용 Blob URL — UI에서 <a download> 트리거 */
  exportAsBlobUrl(): { url: string; filename: string } {
    const data = this.exportAll();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const sid = this.meta.sessionId.slice(0, 8);
    return { url, filename: `mineral-rush-playtest-${sid}-${ts}.json` };
  }

  /** 새 세션 시작. 이전 데이터는 export 후 호출 */
  reset(): void {
    this.buffer = [];
    this.nextId = 0;
    this.meta = this.createMeta();
    try {
      localStorage.removeItem(KEY);
      localStorage.setItem(META_KEY, JSON.stringify(this.meta));
    } catch (e) {
      console.error('[Telemetry.reset] failed', e);
    }
  }

  getMeta(): Readonly<TelemetryMeta> {
    return this.meta;
  }

  getEventCount(): number {
    return this.buffer.length;
  }

  // -- private --

  private loadOrCreateMeta(): TelemetryMeta {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) return JSON.parse(raw) as TelemetryMeta;
    } catch (e) {
      console.error('[Telemetry.loadOrCreateMeta] failed, creating new', e);
    }
    const m = this.createMeta();
    try {
      localStorage.setItem(META_KEY, JSON.stringify(m));
    } catch {
      /* 사파리 프라이빗 모드 등 — 메모리만 사용 */
    }
    return m;
  }

  private createMeta(): TelemetryMeta {
    const di = this.platform.getDeviceInfo();
    const sessionId = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return 'sid-' + Math.random().toString(36).slice(2);
      }
    })();
    try {
      localStorage.setItem(SESSION_KEY, sessionId);
    } catch {
      /* noop */
    }
    return {
      sessionId,
      firstEventAt: 0,
      lastEventAt: 0,
      gameVersion: di.appVersion,
      schemaVersion: parseInt(import.meta.env.VITE_SCHEMA_VERSION ?? '1', 10),
      device: {
        platform: di.platform,
        model: di.model,
        osVersion: di.osVersion,
        language: di.language,
        deviceId: di.deviceId,
      },
    };
  }

  private loadEvents(): TelemetryEvent[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
    } catch (e) {
      console.error('[Telemetry.loadEvents] failed', e);
      return [];
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, 500);
  }

  private flush(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.buffer));
      localStorage.setItem(META_KEY, JSON.stringify(this.meta));
    } catch (e) {
      // QuotaExceeded — 가장 오래된 이벤트 절반 삭제 후 재시도
      console.warn('[Telemetry.flush] storage full, trimming', e);
      this.buffer = this.buffer.slice(this.buffer.length / 2);
      try {
        localStorage.setItem(KEY, JSON.stringify(this.buffer));
      } catch (e2) {
        console.error('[Telemetry.flush] retry failed', e2);
      }
    }
  }
}
