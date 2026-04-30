/**
 * WebCryptoSigner — Web Crypto API 기반 HMAC-SHA256 서명.
 *
 * the-security-auditor §1: 로컬 저장 데이터 위변조 차단.
 *
 * Phase 1: import.meta.env.VITE_DEV_HMAC_SECRET 사용 (개발용)
 * Phase 4+: 빌드 시 강한 secret 주입 + 디바이스 fingerprint 결합 + 서버 검증
 */

import type { ISigner } from './ISigner.ts';

const DEV_FALLBACK_SECRET = 'mineral-rush-dev-only-not-for-production';

export class WebCryptoSigner implements ISigner {
  private keyPromise: Promise<CryptoKey> | null = null;

  constructor(private readonly secret?: string) {}

  async sign(payload: string): Promise<string> {
    const key = await this.getKey();
    const data = new TextEncoder().encode(payload);
    const sig = await crypto.subtle.sign('HMAC', key, data);
    return this.toBase64(sig);
  }

  async verify(payload: string, signature: string): Promise<boolean> {
    try {
      const key = await this.getKey();
      const data = new TextEncoder().encode(payload);
      const sig = this.fromBase64(signature);
      return await crypto.subtle.verify('HMAC', key, sig, data);
    } catch (e) {
      console.error('[WebCryptoSigner.verify] failed', { error: e });
      return false;
    }
  }

  private getKey(): Promise<CryptoKey> {
    if (!this.keyPromise) {
      const secret = this.secret ?? DEV_FALLBACK_SECRET;
      this.keyPromise = crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      );
    }
    return this.keyPromise;
  }

  private toBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!);
    return btoa(bin);
  }

  private fromBase64(b64: string): ArrayBuffer {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
}
