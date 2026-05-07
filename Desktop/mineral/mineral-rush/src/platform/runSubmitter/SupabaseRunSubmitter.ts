/**
 * SupabaseRunSubmitter — validate-run Edge Function POST.
 *
 * the-security-auditor:
 *   - HMAC 서명 헤더 (X-Signature)
 *   - 타임스탬프 윈도우 ±60s — 서버에서 거부
 *   - schema_version + client_version 함께 전송
 *
 * 본 클래스는 platform 레이어 — 외부 fetch 의존을 캡슐화.
 */

import type {
  IRunSubmitter,
  RunReportPayload,
  RunSubmitResult,
} from '../IRunSubmitter.ts';
import type { ISigner } from '../ISigner.ts';

interface SubmitterConfig {
  /** validate-run 엔드포인트 URL (예: https://xxx.supabase.co/functions/v1/validate-run) */
  endpoint: string;
  /** 인증 토큰 (auth.uid 검증용) — anon key 또는 user JWT */
  authToken: string;
  signer: ISigner;
  /** AbortController 타임아웃 ms. 기본 8s */
  timeoutMs?: number;
}

export class SupabaseRunSubmitter implements IRunSubmitter {
  constructor(private readonly cfg: SubmitterConfig) {}

  async submit(payload: RunReportPayload): Promise<RunSubmitResult> {
    const body = JSON.stringify(payload);
    const signature = await this.cfg.signer.sign(body);

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 8000);

    try {
      const res = await fetch(this.cfg.endpoint, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          Authorization: `Bearer ${this.cfg.authToken}`,
        },
        body,
      });
      window.clearTimeout(timer);

      if (!res.ok) {
        return { status: 'error', reason: `http_${res.status}` };
      }
      const data = (await res.json()) as RunSubmitResult;
      return data;
    } catch (e) {
      window.clearTimeout(timer);
      const reason = (e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message;
      return { status: 'error', reason };
    }
  }
}
