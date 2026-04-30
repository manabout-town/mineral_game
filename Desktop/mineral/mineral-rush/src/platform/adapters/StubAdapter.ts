/**
 * StubAdapter — 테스트/개발용 noop 어댑터.
 *
 * 단위 테스트에서 IPlatformAdapter 의존성을 주입할 때 사용.
 */

import type { IPlatformAdapter, DeviceInfo, PurchaseReceipt, HapticStrength } from '../IPlatformAdapter.ts';

export class StubAdapter implements IPlatformAdapter {
  private events: Array<{ name: string; props?: Record<string, unknown> }> = [];

  async init(): Promise<void> {
    // noop
  }

  getDeviceInfo(): DeviceInfo {
    return {
      platform: 'web',
      model: 'stub-device',
      osVersion: '0.0.0',
      appVersion: '0.0.1',
      language: 'ko',
      deviceId: 'stub-device-id',
    };
  }

  async initIAP(): Promise<void> {
    // noop
  }

  async purchase(skuId: string): Promise<PurchaseReceipt> {
    return {
      productId: skuId,
      transactionId: `stub-tx-${Date.now()}`,
      purchaseToken: 'stub-token',
      purchasedAt: Date.now(),
    };
  }

  async restore(): Promise<PurchaseReceipt[]> {
    return [];
  }

  async showRewardedAd(_placementId: string): Promise<{ rewarded: boolean }> {
    return { rewarded: true }; // 개발 시 항상 보상
  }

  trackEvent(name: string, props?: Record<string, unknown>): void {
    this.events.push(props !== undefined ? { name, props } : { name });
  }

  haptic(_strength: HapticStrength): void {
    // noop
  }

  /** 테스트용: 추적된 이벤트 조회 */
  getTrackedEvents(): ReadonlyArray<{ name: string; props?: Record<string, unknown> }> {
    return this.events;
  }
}
