/**
 * ITelemetrySink — 원격 분석 포워더 추상화 (Phase 4-G).
 *
 * Telemetry.ts는 이벤트를 LocalStorage에 쌓는 동시에,
 * 주입된 ITelemetrySink로 실시간 포워딩한다.
 *
 * 구현체:
 *   - NullTelemetrySink  : 기본 (no-op), 오프라인 / 개발 환경
 *   - AmplitudeSink      : Amplitude HTTP API v2 (Phase 5)
 *   - MixpanelSink       : Mixpanel HTTP API (Phase 5)
 *
 * 사용법:
 *   const telemetry = new Telemetry(platform, new AmplitudeSink(apiKey));
 *
 * 5계명 §1: platform 레이어 — core/systems import 금지.
 */

export interface SinkEvent {
  /** 이벤트 이름 */
  name: string;
  /** 이벤트 발생 epoch ms */
  ts: number;
  /** 이벤트 프로퍼티 */
  props: Record<string, unknown>;
  /** 세션 ID */
  sessionId: string;
  /** 게임 버전 */
  gameVersion: string;
}

export interface ITelemetrySink {
  /**
   * 이벤트를 원격으로 전송한다.
   * 실패는 silently 처리 — 게임 진행에 영향 없음.
   */
  send(event: SinkEvent): void;

  /**
   * 사용자 식별자 설정.
   * playerId 확보 후(GameState 로드 완료 시) 한 번 호출.
   */
  identify(userId: string, traits?: Record<string, unknown>): void;

  /** 싱크 초기화 (async 허용). 실패 시 silently 비활성화. */
  init(): Promise<void>;
}

// ─── 기본 구현: no-op ────────────────────────────────────────

export class NullTelemetrySink implements ITelemetrySink {
  async init(): Promise<void> { /* no-op */ }
  send(_event: SinkEvent): void { /* no-op */ }
  identify(_userId: string, _traits?: Record<string, unknown>): void { /* no-op */ }
}

// ─── Amplitude HTTP API v2 (Phase 5에서 사용) ─────────────────

/**
 * AmplitudeSink — Amplitude HTTP API v2로 이벤트를 일괄 전송.
 *
 * Phase 5 활성화 방법:
 *   const sink = new AmplitudeSink(import.meta.env.VITE_AMPLITUDE_API_KEY);
 *   const telemetry = new Telemetry(platform, sink);
 *
 * 기능:
 *   - 16이벤트 또는 3초마다 배치 전송
 *   - 실패 시 3번 재시도 후 드롭 (게임 진행 영향 없음)
 */
export class AmplitudeSink implements ITelemetrySink {
  private readonly endpoint = 'https://api2.amplitude.com/2/httpapi';
  private queue: SinkEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deviceId = '';
  private userId = '';
  private readonly BATCH_SIZE = 16;
  private readonly FLUSH_INTERVAL_MS = 3000;

  constructor(private readonly apiKey: string) {}

  async init(): Promise<void> {
    // 익명 디바이스 ID 생성 (persistent)
    const stored = localStorage.getItem('mineral_rush:amp_device_id');
    this.deviceId = stored ?? crypto.randomUUID();
    if (!stored) localStorage.setItem('mineral_rush:amp_device_id', this.deviceId);
  }

  identify(userId: string, _traits?: Record<string, unknown>): void {
    this.userId = userId;
  }

  send(event: SinkEvent): void {
    this.queue.push(event);
    if (this.queue.length >= this.BATCH_SIZE) {
      void this._flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => { void this._flush(); }, this.FLUSH_INTERVAL_MS);
    }
  }

  private async _flush(): Promise<void> {
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.BATCH_SIZE);
    const body = {
      api_key: this.apiKey,
      events: batch.map((e) => ({
        event_type: e.name,
        time: e.ts,
        event_properties: { ...e.props, gameVersion: e.gameVersion },
        device_id: this.deviceId,
        user_id: this.userId || undefined,
        insert_id: `${e.sessionId}_${e.ts}_${e.name}`,
      })),
    };

    let attempt = 0;
    while (attempt < 3) {
      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return;
        attempt++;
      } catch {
        attempt++;
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    // 드롭 — 게임 진행 영향 없음
  }
}
