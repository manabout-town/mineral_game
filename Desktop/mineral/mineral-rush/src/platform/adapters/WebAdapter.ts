/**
 * WebAdapter — 브라우저(Vite dev) 환경용 어댑터.
 *
 * Phase 1: 광고/IAP는 mock. Phase 4~5에서 실제 SDK로 교체.
 */

import type { IPlatformAdapter, DeviceInfo, PurchaseReceipt, HapticStrength } from '../IPlatformAdapter.ts';

declare const navigator: { userAgent: string; language: string; vibrate?: (n: number) => boolean };

export class WebAdapter implements IPlatformAdapter {
  async init(): Promise<void> {
    // noop — Phase 4에서 분석 SDK 초기화
  }

  getDeviceInfo(): DeviceInfo {
    const deviceId = this.getOrCreateDeviceId();
    return {
      platform: 'web',
      model: this.detectBrowser(),
      osVersion: 'web',
      appVersion: import.meta.env.VITE_GAME_VERSION ?? '0.0.1',
      language: navigator.language || 'ko',
      deviceId,
    };
  }

  async initIAP(): Promise<void> {
    // Phase 5에서 RevenueCat web SDK
  }

  async purchase(_skuId: string): Promise<PurchaseReceipt> {
    throw new Error('E_IAP_NOT_AVAILABLE_WEB');
  }

  async restore(): Promise<PurchaseReceipt[]> {
    return [];
  }

  async showRewardedAd(_placementId: string): Promise<{ rewarded: boolean }> {
    // Phase 4에서 AdMob/Unity Ads
    console.info('[WebAdapter] showRewardedAd (mock)');
    return { rewarded: true };
  }

  trackEvent(name: string, props?: Record<string, unknown>): void {
    // Phase 4에서 Mixpanel/Amplitude
    if (import.meta.env.DEV) {
      console.info('[Analytics]', name, props ?? {});
    }
  }

  haptic(strength: HapticStrength): void {
    if (typeof navigator.vibrate !== 'function') return;
    const dur = strength === 'light' ? 10 : strength === 'medium' ? 20 : 40;
    navigator.vibrate(dur);
  }

  // -- private --
  private getOrCreateDeviceId(): string {
    const KEY = 'mineral_rush_device_id';
    try {
      const existing = localStorage.getItem(KEY);
      if (existing) return existing;
      const fresh = crypto.randomUUID();
      localStorage.setItem(KEY, fresh);
      return fresh;
    } catch {
      // 사파리 프라이빗 모드 등 — 메모리만 사용
      return 'no-storage-' + Math.random().toString(36).slice(2);
    }
  }

  private detectBrowser(): string {
    const ua = navigator.userAgent || '';
    if (/Chrome\//.test(ua)) return 'chrome';
    if (/Safari\//.test(ua)) return 'safari';
    if (/Firefox\//.test(ua)) return 'firefox';
    return 'unknown';
  }
}
