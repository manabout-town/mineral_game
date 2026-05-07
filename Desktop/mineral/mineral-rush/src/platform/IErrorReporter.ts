/**
 * IErrorReporter — Sentry-ready 에러 리포터 추상화 (Phase 4-D).
 *
 * 기본 구현: ConsoleErrorReporter (콘솔 출력).
 * Phase 5: SentryErrorReporter로 교체 — import 한 줄만 변경.
 *
 * 사용처: Logger.ts → logger.error() 호출 시 자동 위임.
 *
 * 5계명 §1: 이 파일은 platform 레이어. core/systems import 금지.
 */

export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * 런타임 에러를 외부 서비스(Sentry, Datadog 등)에 전달하는 인터페이스.
 * captureException: 예외 객체 직접 전달.
 * captureMessage: 에러 코드 + 메시지 + 컨텍스트.
 */
export interface IErrorReporter {
  captureException(err: unknown, ctx?: ErrorContext): void;
  captureMessage(code: string, message: string, ctx?: ErrorContext): void;
  /** 사용자 세션 식별자 설정 (playerId 확보 후 호출). */
  setUser(id: string): void;
  /** 앱 전역 태그 설정 (버전, 환경 등). */
  setTag(key: string, value: string): void;
}

// ─── 기본 구현: 콘솔 ─────────────────────────────────────────

export class ConsoleErrorReporter implements IErrorReporter {
  captureException(err: unknown, ctx?: ErrorContext): void {
    console.error('[ErrorReporter] Exception:', err, ctx ?? '');
  }

  captureMessage(code: string, message: string, ctx?: ErrorContext): void {
    console.error(`[ErrorReporter:${code}]`, message, ctx ?? '');
  }

  setUser(_id: string): void {
    // no-op in console mode
  }

  setTag(_key: string, _value: string): void {
    // no-op in console mode
  }
}

// ─── 싱글톤 레지스트리 ────────────────────────────────────────

let _reporter: IErrorReporter = new ConsoleErrorReporter();

/**
 * 앱 부트 시 한 번 호출해 리포터를 교체.
 * (예: SentryErrorReporter 주입)
 */
export function setErrorReporter(reporter: IErrorReporter): void {
  _reporter = reporter;
}

export function getErrorReporter(): IErrorReporter {
  return _reporter;
}
