/**
 * IBootConfig — 부팅 시 서버 설정 페치.
 *
 * COWORK_PROMPT_PACK §6 + 로드맵 §4.4 LiveOps:
 *   - Feature Flags: 사고 시 1클릭 비활성화
 *   - Maintenance Mode: 점검 시 부팅 차단 + 안내 화면
 *   - Force Update: 최소 지원 버전 미만이면 스토어 안내
 *
 * 5계명 §1: core / systems는 IBootConfig 인터페이스만 안다.
 *   - 구현체: SupabaseBootConfig / StubBootConfig
 *   - 네트워크 실패 시 fallback (캐시 또는 기본값)
 */

export interface FeatureFlags {
  /** 광고 표시 여부 */
  ads_enabled: boolean;
  /** 결제 활성 여부 */
  iap_enabled: boolean;
  /** 새 카드 시스템 토글 (예) */
  new_card_system: boolean;
  /** 그 외 임의 키 — 서버에서 동적으로 추가 가능 */
  [key: string]: boolean;
}

export interface MaintenanceState {
  enabled: boolean;
  messageKo?: string;
  messageEn?: string;
  /** 미만이면 강제 업데이트 안내 (semver: '1.2.0' 형식) */
  minSupportedVersion?: string;
}

export interface BootConfig {
  flags: FeatureFlags;
  maintenance: MaintenanceState;
  /** 페치 성공 여부. false면 fallback 사용 */
  fetchedFromServer: boolean;
  /** 페치 시각 (epoch ms) */
  fetchedAt: number;
}

export interface IBootConfigSource {
  fetch(): Promise<BootConfig>;
}

export const DEFAULT_BOOT_CONFIG: BootConfig = {
  flags: {
    ads_enabled: false,
    iap_enabled: false,
    new_card_system: false,
  },
  maintenance: { enabled: false },
  fetchedFromServer: false,
  fetchedAt: 0,
};

/** semver 비교: a < b면 음수, ==이면 0, >이면 양수. 잘못된 입력은 0 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10));
  const pb = b.split('.').map((n) => parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ai = Number.isFinite(pa[i]) ? pa[i]! : 0;
    const bi = Number.isFinite(pb[i]) ? pb[i]! : 0;
    if (ai < bi) return -1;
    if (ai > bi) return 1;
  }
  return 0;
}

/**
 * 현재 클라 버전이 최소 지원 버전 미만이면 강제 업데이트 필요.
 * minSupportedVersion이 없으면 false.
 */
export function needsForceUpdate(currentVersion: string, cfg: BootConfig): boolean {
  const min = cfg.maintenance.minSupportedVersion;
  if (!min) return false;
  return compareSemver(currentVersion, min) < 0;
}
