/**
 * StubRunSubmitter — 오프라인 / 개발용.
 *
 * 항상 valid 반환. 콘솔에 페이로드 요약 출력.
 *   - 네트워크 의존성 없는 단위 테스트용
 *   - 인터넷 없는 dev 환경
 */

import type {
  IRunSubmitter,
  RunReportPayload,
  RunSubmitResult,
} from '../IRunSubmitter.ts';

export class StubRunSubmitter implements IRunSubmitter {
  async submit(payload: RunReportPayload): Promise<RunSubmitResult> {
    if (import.meta.env.DEV) {
      console.info('[StubRunSubmitter] submit', {
        runId: payload.runId,
        veinCount: payload.veinCount,
        events: payload.events.length,
        rewardCrystals: payload.rewardCrystals,
      });
    }
    return { status: 'valid' };
  }
}
