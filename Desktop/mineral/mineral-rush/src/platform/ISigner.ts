/**
 * ISigner — HMAC 서명 / 검증.
 * the-security-auditor: Zero Trust 원칙으로 로컬 저장 데이터 변조 차단.
 *
 * Phase 1: 단순 SHA-256 + dev-key (개발용)
 * Phase 4+: 빌드 시 환경변수로 secret 주입, 디바이스 fingerprint 결합
 */

export interface ISigner {
  /** payload + secret을 받아 base64 시그니처 반환 */
  sign(payload: string): Promise<string>;
  /** payload + 시그니처 검증 */
  verify(payload: string, signature: string): Promise<boolean>;
}
