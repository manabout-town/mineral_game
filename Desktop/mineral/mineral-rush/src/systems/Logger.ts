/**
 * Logger — 5계명 §5 Traceable.
 *
 * 모든 에러는 고유 코드 + 컨텍스트와 함께 로깅.
 *
 * Phase 4-D: IErrorReporter 연동.
 *   - logger.error() → ConsoleErrorReporter (기본) 또는 SentryErrorReporter.
 *   - setErrorReporter()로 런타임에 교체 가능 (App.tsx 부트 시).
 */

import type { ErrorCode } from '../shared/constants.ts';
import { getErrorReporter } from '../platform/IErrorReporter.ts';

export interface LogContext {
  [key: string]: unknown;
}

export interface ILogger {
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(code: ErrorCode | string, msg: string, ctx?: LogContext): void;
}

class ConsoleLogger implements ILogger {
  debug(msg: string, ctx?: LogContext): void {
    if (import.meta.env?.DEV) console.debug('[debug]', msg, ctx ?? '');
  }
  info(msg: string, ctx?: LogContext): void {
    console.info('[info]', msg, ctx ?? '');
  }
  warn(msg: string, ctx?: LogContext): void {
    console.warn('[warn]', msg, ctx ?? '');
  }
  error(code: ErrorCode | string, msg: string, ctx?: LogContext): void {
    console.error(`[error:${code}]`, msg, ctx ?? '');
    // Phase 4-D: IErrorReporter 위임 (Sentry 등으로 교체 가능)
    getErrorReporter().captureMessage(code as string, msg, ctx);
  }
}

export const logger: ILogger = new ConsoleLogger();
