/**
 * Logger — 5계명 §5 Traceable.
 *
 * 모든 에러는 고유 코드 + 컨텍스트와 함께 로깅.
 * Phase 4에서 Sentry 어댑터로 교체.
 */

import type { ErrorCode } from '../shared/constants.ts';

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
    // Phase 4: Sentry.captureException
  }
}

export const logger: ILogger = new ConsoleLogger();
