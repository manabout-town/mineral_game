/**
 * IPlatformAdapter — 외부 플랫폼 의존성 통합 인터페이스.
 *
 * UNIVERSAL_GAME_FRAMEWORK §1.3 Interface Layer:
 *   - 특정 SDK(Toss, Steam, AdMob, Capacitor)에 종속되지 않는 추상화.
 *   - 구현체: Web / Capacitor / Stub
 *
 * 5계명 §1: core / systems는 IPlatformAdapter만 import. 구현체 직접 import 금지.
 */

export interface DeviceInfo {
  platform: 'web' | 'ios' | 'android';
  model: string;
  osVersion: string;
  appVersion: string;
  language: string;
  /** 디바이스 fingerprint — 로컬 저장 서명에 결합 */
  deviceId: string;
}

export interface PurchaseReceipt {
  productId: string;
  transactionId: string;
  purchaseToken: string;
  purchasedAt: number; // epoch ms
}

export type HapticStrength = 'light' | 'medium' | 'heavy';

export interface IPlatformAdapter {
  // Lifecycle
  init(): Promise<void>;
  getDeviceInfo(): DeviceInfo;

  // IAP — Phase 5에서 RevenueCat으로 본격 통합
  initIAP(): Promise<void>;
  purchase(skuId: string): Promise<PurchaseReceipt>;
  restore(): Promise<PurchaseReceipt[]>;

  // Ads — Phase 5에서 AdMob 통합
  showRewardedAd(placementId: string): Promise<{ rewarded: boolean }>;

  // Analytics — Phase 4에서 Mixpanel/Amplitude
  trackEvent(name: string, props?: Record<string, unknown>): void;

  // Haptic
  haptic(strength: HapticStrength): void;
}
