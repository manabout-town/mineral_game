# Mineral Rush — 광물 채굴 게임 개발 로드맵

> **본 로드맵은 다음 3개 프레임워크를 엄격히 준수한다:**
> - `UNIVERSAL_GAME_FRAMEWORK_v1` — 4-Layer 범용 아키텍처
> - `GAME_STEP_NAVIGATOR_v1` — 5-Phase 개발 진행 가이드
> - `CLAUDE_COWORK_PROMPT_PACK_v2` — 아키텍처 통제 프롬프트 팩
>
> **레퍼런스 게임:** Timber Rush (목재 → 광물 컨버전)
> **장르:** 2D 픽셀 액션 / 채집 / 로그라이트 / 인크리멘탈
> **타깃 플랫폼:** Mobile(iOS/Android) 우선, WebView 호환, 추후 PC 포팅 고려
> **UI:** 본 단계에서는 미정 (추후 입힘) — 따라서 모든 로직은 View 비종속으로 설계

---

## 0. 게임 컨셉 컨버전 매핑

레퍼런스(Timber Rush) 요소를 광물 채굴로 1:1 대응시켜 일관성 있는 컨셉을 확보한다.

| 영역 | 레퍼런스 (목재) | 광물 게임 컨버전 |
|---|---|---|
| 주재료 | 통나무(Log) | 광석(Ore) — 구리, 철, 은, 금, 다이아몬드, 미스릴, 아다만타이트, 오리하르콘 |
| 주된 행위 | 도끼로 나무 쪼개기 | 곡괭이로 광맥 채굴 |
| 필드 오브젝트 | 거대 나무 | 거대 광맥 / 광산 코어 |
| 특수 자원 | 자석 통나무, 번개 통나무 | 자석 광석, 충전 광석, 폭발 광석, 보석 원석 |
| 보조 유닛 | 드론 / 크루(나무꾼) | 채굴 로봇, NPC 광부, 카나리아 |
| 화폐 | 통나무(소프트), 코인(하드) | 광석(소프트), 크리스탈(하드) |
| 메타 진행 | 스킬 트리 | 광산 길드 연구소 (테크 트리) |
| 런-기반 빌드 | 카드 (블루/퍼플/골드) | 모디파이어 카드 (커먼/레어/에픽/레전더리) |
| 스테이지 | 묘지 숲 등 | 노천광 → 동굴 → 심층광 → 마그마층 → 코어층 |

> **차별화 포인트:** "깊이(Depth)" 개념. 한 런이 진행될수록 더 깊은 층으로 내려가 더 희귀한 광석이 등장. 목재 게임에는 없는 광물 테마만의 독자적 차별점.

---

# 🏗️ 1. UNIVERSAL_GAME_FRAMEWORK 적용 (4-Layer Architecture)

본 게임은 4개 레이어로 엄격히 분리한다. **레이어 간 의존 방향은 단방향(Core ← Systems ← Interface ← View)**이며, 역방향 import는 금지된다.

### 1.1 Core State (`src/core/`) — 데이터 중심

**State Definition** — 게임의 모든 상태를 단일 객체에 담는다.

```ts
// src/core/State.ts
export interface GameState {
  schemaVersion: number;          // 마이그레이션용 (절대 누락 금지)
  meta: MetaState;                 // 메타 진행 (영구)
  run: RunState | null;            // 현재 런 상태 (런 종료 시 null)
  player: PlayerState;             // 유저 식별, 설정
  economy: EconomyState;           // 화폐 잔액
}

export interface MetaState {
  skillTree: Record<NodeId, SkillNodeState>; // 노드별 잠금/레벨
  unlockedPickaxes: PickaxeId[];
  unlockedMinerals: MineralId[];
  prestige: number;
  stats: LifetimeStats;
}

export interface RunState {
  runId: string;
  seed: number;                    // 결정론적 난수
  startedAt: number;
  duration: number;                // 30초 등
  remaining: number;
  depth: number;                   // 현재 깊이 층
  pickaxe: PickaxeStats;
  cards: ActiveCard[];             // 런 중 선택한 카드들
  cardOffer: CardOffer | null;     // 현재 카드 선택지
  combo: number;
  oresCollected: Record<MineralId, number>;
  damageDealt: number;
  events: GameEvent[];             // 액션 리플레이용 (안티치트)
}

export interface EconomyState {
  ores: Record<MineralId, number>; // 소프트 화폐
  crystals: number;                // 하드 화폐
}
```

**Action 정의** — 데이터 변경은 반드시 Action을 발행하고 Reducer를 통해서만 수행한다. **직접 수정 절대 금지.**

```ts
// src/core/Actions.ts
export type Action =
  // Run lifecycle
  | { type: 'RUN_START'; payload: { seed: number; depth: number } }
  | { type: 'RUN_TICK'; payload: { deltaMs: number } }
  | { type: 'RUN_END'; payload: { reason: 'timeout' | 'quit' | 'death' } }
  // Mining
  | { type: 'MINE_HIT'; payload: { x: number; y: number; t: number } }
  | { type: 'ORE_COLLECTED'; payload: { mineralId: MineralId; amount: number; t: number } }
  | { type: 'COMBO_INCREMENT'; payload: { t: number } }
  | { type: 'COMBO_BREAK' }
  // Cards
  | { type: 'CARD_OFFER_GENERATED'; payload: { offer: CardOffer } }
  | { type: 'CARD_PICKED'; payload: { cardId: CardId; t: number } }
  | { type: 'CARD_REROLL'; payload: { cost: number } }
  // Meta
  | { type: 'META_RUN_REWARD'; payload: { ores: Record<MineralId, number>; crystals: number } }
  | { type: 'SKILL_NODE_UNLOCK'; payload: { nodeId: NodeId } }
  | { type: 'SKILL_NODE_LEVEL_UP'; payload: { nodeId: NodeId } }
  // Persistence
  | { type: 'STATE_HYDRATE'; payload: { state: GameState } }
  // System
  | { type: 'SCHEMA_MIGRATE'; payload: { fromVersion: number; toVersion: number } };
```

**Reducer** — 순수 함수. 외부 의존성 없음. 동일 입력 → 동일 출력.

```ts
// src/core/reducers/index.ts
export function rootReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'RUN_START': return runReducer.start(state, action);
    case 'RUN_TICK': return runReducer.tick(state, action);
    case 'MINE_HIT': return miningReducer.hit(state, action);
    case 'ORE_COLLECTED': return economyReducer.addOre(state, action);
    case 'CARD_PICKED': return cardReducer.pick(state, action);
    case 'META_RUN_REWARD': return metaReducer.applyReward(state, action);
    case 'SCHEMA_MIGRATE': return migrate(state, action.payload);
    // ...
    default: return state;
  }
}
```

### 1.2 System Layer (`src/systems/`) — 로직 중심

**Tick System** — 시간 흐름 관리. 결정론적(deterministic). 서버-클라 동기화의 기반.

```ts
// src/systems/TickSystem.ts
export class TickSystem {
  private accumulator = 0;
  private readonly fixedDeltaMs = 16.666; // 60Hz

  step(realDeltaMs: number, dispatch: (a: Action) => void) {
    this.accumulator += realDeltaMs;
    while (this.accumulator >= this.fixedDeltaMs) {
      dispatch({ type: 'RUN_TICK', payload: { deltaMs: this.fixedDeltaMs } });
      this.accumulator -= this.fixedDeltaMs;
    }
  }
}
```

**Validation System** — 모든 액션의 정당성 검증 (안티치트).

```ts
// src/systems/ValidationSystem.ts
export function validateAction(state: GameState, action: Action): ValidationResult {
  switch (action.type) {
    case 'MINE_HIT': {
      // 너무 빠른 탭(인간 한계 초과) 차단
      const lastHit = state.run?.events.slice(-1)[0];
      if (lastHit?.type === 'MINE_HIT' && action.payload.t - lastHit.payload.t < 30) {
        return { valid: false, code: 'E_HIT_TOO_FAST' };
      }
      return { valid: true };
    }
    case 'CARD_PICKED': {
      if (!state.run?.cardOffer?.cards.find(c => c.id === action.payload.cardId)) {
        return { valid: false, code: 'E_CARD_NOT_OFFERED' };
      }
      return { valid: true };
    }
    // ...
    default: return { valid: true };
  }
}
```

**Persistence System** — 저장/불러오기 + 스키마 마이그레이션.

```ts
// src/systems/PersistenceSystem.ts
export class PersistenceSystem {
  constructor(private storage: IStorage, private signer: ISigner) {}

  async save(state: GameState): Promise<void> {
    const payload = JSON.stringify(state);
    const signature = await this.signer.sign(payload);
    await this.storage.set('game_state', { payload, signature });
  }

  async load(): Promise<GameState | null> {
    const stored = await this.storage.get('game_state');
    if (!stored) return null;
    if (!await this.signer.verify(stored.payload, stored.signature)) {
      throw new Error('E_SAVE_TAMPERED');
    }
    let state = JSON.parse(stored.payload);
    state = migrate(state, { fromVersion: state.schemaVersion, toVersion: LATEST_VERSION });
    return state;
  }
}
```

### 1.3 Interface Layer (`src/platform/`) — 연결 중심

**Platform Adapter** — 특정 SDK에 종속되지 않는 인터페이스.

```ts
// src/platform/IPlatformAdapter.ts
export interface IPlatformAdapter {
  // 결제
  initIAP(): Promise<void>;
  purchase(skuId: string): Promise<PurchaseReceipt>;
  restore(): Promise<PurchaseReceipt[]>;
  // 광고
  showRewardedAd(placementId: string): Promise<{ rewarded: boolean }>;
  // 분석
  trackEvent(name: string, props: Record<string, unknown>): void;
  // 디바이스
  getDeviceInfo(): DeviceInfo;
  // 진동/햅틱
  haptic(strength: 'light' | 'medium' | 'heavy'): void;
}

// src/platform/adapters/CapacitorAdapter.ts
export class CapacitorAdapter implements IPlatformAdapter { /* ... */ }
// src/platform/adapters/WebAdapter.ts
export class WebAdapter implements IPlatformAdapter { /* ... */ }
// src/platform/adapters/StubAdapter.ts (테스트용)
export class StubAdapter implements IPlatformAdapter { /* ... */ }
```

**Sound/Asset Manager** — 외부 라이브러리 교체 용이한 래퍼.

```ts
// src/platform/IAssetManager.ts
export interface IAssetManager {
  loadAtlas(url: string): Promise<TextureAtlas>;
  loadAudioSprite(url: string, json: string): Promise<AudioSprite>;
  releaseUnused(): void;
}
```

### 1.4 View Layer (`src/view/`) — 표현 중심 (Engine Agnostic)

로직은 순수 JS/TS, 렌더링 엔진은 데이터만 받아 그린다. **로직 → View 데이터 흐름은 단방향.**

```ts
// src/view/GameRenderer.ts
export interface GameRenderer {
  render(state: GameState, dt: number): void;
  resize(w: number, h: number): void;
  destroy(): void;
}

// src/view/pixi/PixiGameRenderer.ts
export class PixiGameRenderer implements GameRenderer { /* PixiJS 구현 */ }
// 추후 Phaser / Three.js로 갈아끼울 수 있음
```

> **UI는 추후 입힌다고 했으므로**, 본 로드맵 동안 View Layer는 디버그용 텍스트/사각형만으로 충분하다. 핵심 로직과 데이터 모델만 견고히 만든다.

### 1.5 표준 디렉토리 구조

```
mineral-rush/
├── src/
│   ├── core/
│   │   ├── State.ts
│   │   ├── Actions.ts
│   │   ├── reducers/
│   │   │   ├── runReducer.ts
│   │   │   ├── miningReducer.ts
│   │   │   ├── economyReducer.ts
│   │   │   ├── cardReducer.ts
│   │   │   └── metaReducer.ts
│   │   └── rules/                # 데미지 공식, 드랍률, 가격 등 순수 함수
│   │       ├── damage.ts
│   │       ├── dropTable.ts
│   │       └── pricing.ts
│   ├── systems/
│   │   ├── TickSystem.ts
│   │   ├── ValidationSystem.ts
│   │   ├── PersistenceSystem.ts
│   │   ├── migrations/           # 스키마 버전 마이그레이션
│   │   │   ├── v1_to_v2.ts
│   │   │   └── index.ts
│   │   └── Replay.ts             # 액션 리플레이 (안티치트)
│   ├── platform/
│   │   ├── IPlatformAdapter.ts
│   │   ├── IAssetManager.ts
│   │   ├── ISigner.ts
│   │   ├── IStorage.ts
│   │   └── adapters/
│   │       ├── CapacitorAdapter.ts
│   │       ├── WebAdapter.ts
│   │       └── StubAdapter.ts
│   ├── view/
│   │   ├── GameRenderer.ts       # 인터페이스
│   │   ├── pixi/
│   │   │   ├── PixiGameRenderer.ts
│   │   │   └── sprites/
│   │   └── ui/                   # React UI (추후)
│   └── shared/
│       ├── constants.ts
│       ├── types.ts
│       └── ids.ts
├── data/                         # 콘텐츠 데이터 (JSON/CSV)
│   ├── minerals.json
│   ├── pickaxes.json
│   ├── cards.json
│   └── skill_nodes.json
├── server/                       # 서버 검증 로직 (Supabase Edge Functions)
│   ├── validateRun.ts
│   ├── grantReward.ts
│   └── verifyReceipt.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── replay/                   # 알려진 런 리플레이 회귀 테스트
└── tools/
    ├── balance-sim.ts            # 1000런 시뮬레이션
    └── content-validator.ts
```

---

# 🛡️ 2. 개발 가드레일 5계명 (UNIVERSAL_GAME_FRAMEWORK 준수)

매 PR에서 self-check 한다.

1. **Pure Logic First** — 엔진(PixiJS, React) 라이브러리 없이도 도는 순수 로직 우선. `core/`, `systems/`는 PixiJS/React import 금지.
2. **Atomic Actions** — 하나의 Action은 하나의 상태만 바꾼다. `MINE_HIT`이 한 번에 ore도 주고 콤보도 올리고 카드도 뽑는다 → 분해.
3. **No Hidden State** — 모듈 스코프 변수 금지. 모든 상태는 `GameState`에 명시.
4. **Validation Required** — 모든 보상 지급 전 `ValidationSystem`을 거친다. 클라이언트는 신뢰하지 않는다.
5. **Traceable** — 모든 에러는 고유 코드(`E_HIT_TOO_FAST` 등) + Sentry 로깅. `try/catch` 빈 블록 금지.

---

# 📊 3. GAME_STEP_NAVIGATOR — 5-Phase 로드맵

본 로드맵은 NAVIGATOR의 5단계를 광물 채굴 게임에 구체화한 것이다. **각 단계 끝에 Gate Check를 통과해야 다음 단계로 진입한다.** 통과 못하면 절대 다음 단계로 가지 않는다.

---

## 🟦 Phase 1: Skeleton (뼈대 구축) — 2~3주

**목표:** 엔진 초기화 및 4-Layer 아키텍처 뼈대 완성. 화면에 사각형 띄우기 수준.

### 1.1 작업 목록

- [ ] 프로젝트 초기화 (Vite + TypeScript + PixiJS + React + Tailwind)
- [ ] 디렉토리 구조 확정 (위 1.5 그대로)
- [ ] `src/core/State.ts` — 최소 GameState 인터페이스 정의
- [ ] `src/core/Actions.ts` — 최소 Action 7종 정의 (`RUN_START`, `RUN_TICK`, `RUN_END`, `MINE_HIT`, `ORE_COLLECTED`, `STATE_HYDRATE`, `SCHEMA_MIGRATE`)
- [ ] `src/core/reducers/index.ts` — rootReducer 빈 골격 + RUN_START만 동작
- [ ] `src/platform/IPlatformAdapter.ts` 인터페이스 정의 + `StubAdapter` 구현
- [ ] `src/platform/IStorage.ts` + `localStorage` 래퍼
- [ ] `src/systems/TickSystem.ts` — 60Hz 고정 타임스텝
- [ ] `src/view/pixi/PixiGameRenderer.ts` — 빈 화면에 사각형 1개
- [ ] CI/CD 셋업 (GitHub Actions: lint + tsc + test)
- [ ] ESLint + Prettier + 커밋 훅(husky)

### 1.2 Gate Check (반드시 통과)

- [ ] `npm run dev` 실행 시 에러 없이 빈 화면에 PixiJS 사각형이 뜬다
- [ ] `core/`, `systems/`에서 PixiJS/React import가 없는지 정적 검증 (eslint-rule)
- [ ] `RUN_START` 디스패치 시 GameState가 변경되고 콘솔에 출력된다
- [ ] `npm run typecheck` 통과
- [ ] `npm test` 통과 (이 단계에선 Reducer 단위 테스트 1개만)

### 1.3 산출물

- 코드 리포지토리 초기 커밋
- README.md (실행법, 디렉토리 가이드, 5계명)
- 아키텍처 다이어그램 1장

---

## 🟩 Phase 2: Heartbeat (핵심 루프) — 4~5주

**목표:** "30초 런 → 광맥 탭 → 광석 획득 → 카드 1장 선택 → 결과 화면"이 동작. 게임의 가장 작은 재미 단위 검증.

### 2.1 작업 목록

**Core/Systems:**

- [ ] `RunState` 확장 (depth, pickaxe, combo, oresCollected, events)
- [ ] `core/rules/damage.ts` — 베이스 데미지 공식 (pickaxe.damage × combo × cardModifiers × meta)
- [ ] `core/rules/dropTable.ts` — 광물 드랍 테이블 (현재 깊이 + RNG seed → 광물 종류와 개수)
- [ ] `core/rules/cardOffer.ts` — 카드 추첨 (등급별 가중치, 깊이/런 진행도 가중)
- [ ] `core/reducers/miningReducer.ts` — `MINE_HIT` 처리, 광맥 HP 감소, 광석 드랍 결정
- [ ] `core/reducers/cardReducer.ts` — `CARD_OFFER_GENERATED`, `CARD_PICKED`, `CARD_REROLL`
- [ ] `core/reducers/economyReducer.ts` — `ORE_COLLECTED` → ores 누적, 런 종료 시 `META_RUN_REWARD`
- [ ] `systems/TickSystem` 통합 → `RUN_TICK` 발행
- [ ] `systems/ValidationSystem` — `MINE_HIT` 속도 제한, `CARD_PICKED` 추첨 검증
- [ ] `systems/PersistenceSystem` — localStorage 저장/불러오기 + schemaVersion=1
- [ ] `systems/Replay.ts` — 모든 Action을 events 배열에 기록 (안티치트 + 디버그용)

**Platform/View:**

- [ ] `WebAdapter` — 브라우저용 Stub (광고/IAP는 mock)
- [ ] `view/pixi/` — 광맥 스프라이트 1종, 광석 드랍 애니메이션, 데미지 텍스트, 타이머 UI(임시)
- [ ] `view/ui/` — 카드 선택 화면(임시 React), 결과 화면(임시 텍스트)
- [ ] 입력: 마우스 클릭 + 터치 지원

**콘텐츠 (Phase 2 분량):**

- 광물 1종 (구리)
- 곡괭이 1종 (기본)
- 카드 6종 (커먼 4 + 레어 2): 데미지 +x%, 콤보 시간 +초, 광석 가치 +x%, 등
- 깊이 1층

### 2.2 Gate Check

- [ ] **무한 반복 가능성:** 30초 런을 끝낸 뒤 다시 시작이 가능하고, 메타 광석이 계속 누적된다
- [ ] **재미 단위 검증:** 외부 테스터 5명 중 4명이 "한 번 더 하고 싶다"
- [ ] **불변식 검증:** 1000회 시뮬레이션 봇 실행 → 광석 카운트 음수 발생 0회
- [ ] **저장/불러오기:** 페이지 새로고침 후 메타 화폐 보존
- [ ] **결정론:** 동일 seed로 두 번 실행 시 동일 결과
- [ ] **자동 회귀:** `tests/replay/` 디렉토리에 알려진 런 1개 리플레이 → 재현 통과

### 2.3 No-Go 트리거

외부 테스터 합격선(80%)을 통과하지 못하면 **절대 Phase 3로 가지 않는다.** 핵심 루프 재설계로 회귀.

### 2.4 산출물

- 플레이어블 빌드 (웹 URL)
- 외부 테스트 보고서 (영상 + 5점 척도 설문)
- 핵심 KPI 1차 측정 (평균 세션 길이, 카드 픽률, 막힘 지점)
- Go/No-Go 결정 문서

---

## 🟨 Phase 3: Content Expansion (콘텐츠 확장) — 6~8주

**목표:** 양적 팽창 + 다중 씬/UI + 사운드 통합. 최소 10분~30분 플레이 타임.

### 3.1 데이터 시트 기반 콘텐츠 등록

모든 콘텐츠는 **JSON/CSV로 외부화**한다. 코드 수정 없이 밸런스 패치 가능하도록.

```
data/
├── minerals.json     # 12종: id, name, baseValue, dropDepthMin, dropDepthMax, color
├── pickaxes.json     # 8종: id, name, damage, speed, range, combo, unlockCost
├── cards.json        # 100종: id, rarity, effect, magnitude, conflictsWith
├── skill_nodes.json  # 100종: id, branch, prerequisites, effect, costCurve
├── stages.json       # 5종: id, name, depthRange, biome, modifiers
└── enemies.json      # 보스/엘리트 광맥 5종
```

콘텐츠 검증 도구를 만든다 — `tools/content-validator.ts`. 누락된 prerequisite, 잘못된 ID 참조, 밸런스 곡선 이상치를 빌드 시 잡는다.

### 3.2 작업 목록

**시스템 확장:**

- [ ] 다중 씬: `LobbyScene` (스킬트리, 상점, 시작) ↔ `RunScene` (인게임) ↔ `ResultScene` (결과)
- [ ] 씬 전환 매니저 (state machine)
- [ ] UI 시스템: 메인 메뉴, 스킬트리 화면, 카드 선택 모달, 결과 화면, 일시정지 메뉴
- [ ] HUD: 타이머, 광석 카운터, 콤보 게이지, 활성 카드 인디케이터
- [ ] `core/reducers/metaReducer.ts` — 스킬트리 노드 잠금/레벨업, 효과 적용
- [ ] 곡괭이 업그레이드 시스템
- [ ] 일일 미션 시스템 (소박하게: 3개 슬롯 일일 로테이션)
- [ ] 도전과제 시스템

**에셋 파이프라인:**

- [ ] 텍스처 아틀라스 빌드 스크립트 (TexturePacker CLI 또는 free-tex-packer)
- [ ] 오디오 스프라이트 (audiosprite tool)
- [ ] 에셋 사전 로딩 + 프로그레스 바
- [ ] 사운드: 곡괭이 타격(광물별 5종), 광석 획득, 카드 선택, BGM 3트랙

**콘텐츠 (Phase 3 분량):**

- 광물 8종, 곡괭이 5종, 카드 60종, 스킬 노드 60종, 스테이지 3종
- 보스 광맥 2종

### 3.3 Gate Check

- [ ] **플레이 타임:** 평균 신규 유저 첫 세션 10분 이상
- [ ] **선택지 다양성:** 동일 카드를 매번 고르는 비율 30% 이하
- [ ] **빌드 정체성:** 1000런 시뮬레이션 → 카드 빌드 클러스터 분석 결과 5개 이상 아키타입
- [ ] **씬 전환 안정성:** 씬 100회 전환 메모리 누수 측정 → 30MB 이하 증가
- [ ] **UI 작동:** 메인 메뉴부터 결과 화면까지 풀 플로우 무에러
- [ ] **사운드:** 동시 5개 SFX 재생 시 끊김 없음

### 3.4 산출물

- 베타 빌드 (사내 클로즈드)
- 콘텐츠 데이터베이스 (12종 광물, 60종 카드 등 풀 등록)
- 자동 밸런스 시뮬레이터 (`tools/balance-sim.ts` 1000런 결과 리포트)

---

## 🟧 Phase 4: Hardening (강화 및 보안) — 4~6주

**목표:** 상용 수준의 안정성 + 보안 + 성능 최적화. 출시 차단 항목 모두 해결.

### 4.1 안티치트 (서버 권위)

`CLAUDE_COWORK_PROMPT_PACK` §4 안티치트 강제 프롬프트를 그대로 따른다. **클라이언트 데이터는 절대 신뢰하지 않는다.**

**서버 사이드 검증 (Supabase Edge Functions):**

- [ ] **HMAC 시그니처:** 모든 클라이언트→서버 요청에 `X-Signature: hmac(payload + timestamp, secret)`. 키는 빌드 시 환경변수 주입, 코드에 하드코딩 절대 금지.
- [ ] **타임스탬프 윈도우:** ±60초 외 요청은 reject (replay attack 방지).
- [ ] **액션 리플레이:** 클라가 보낸 `events[]`를 서버에서 동일 reducer로 재생 → 최종 화폐 산출. 클라 주장 화폐와 다르면 reject + 어뷰저 마킹.
- [ ] **통계 임계:** "30초 런에서 광석 X개 이상은 통계적으로 불가능" → reject.
- [ ] **결제 영수증 검증:** Apple/Google 영수증을 서버에서 재검증. 클라가 "구매 성공했어요"는 신뢰하지 않음.
- [ ] **시간 검증:** 일일 보상은 서버 시간 기준. 디바이스 시간 변경 차단.
- [ ] **로컬 저장 서명:** 로컬 GameState에 디바이스 fingerprint + HMAC 서명. 평문 JSON 저장 금지.

**클라이언트 사이드 보호:**

- [ ] 코드 난독화 (Webpack obfuscator) — 완벽하지 않지만 진입 장벽
- [ ] 디버거/루팅/탈옥 감지 (Capacitor 플러그인)
- [ ] 비정상 메모리 변경 감지 (canary values)

### 4.2 성능 최적화

**60FPS 안정 유지가 목표.** 16.6ms 프레임 예산 안에 update + render.

- [ ] **텍스처 아틀라스 통합** → Draw call 100+ → 5 미만
- [ ] **오디오 스프라이트** 적용
- [ ] **오브젝트 풀링** — 광석, 데미지 텍스트, 파티클은 풀에서 재활용. 게임 루프 안 `new` 금지
- [ ] **렌더링 컬링** — 화면 밖 오브젝트 update/draw 스킵
- [ ] **iOS Safari / Android WebView 특화:**
  - WebGL context lost 핸들러
  - 백그라운드 진입 시 RAF 정지 + 자동 일시정지 (Page Visibility API)
  - 메모리 압박 신호 수신 시 텍스처 다운그레이드
  - 동적 해상도 다운스케일 (저사양 60FPS 미달 시 0.75x → 0.5x)
- [ ] **메모리 누수 점검** — Chrome Performance 프로파일러로 30분 플레이 후 heap 증가 확인

**디바이스 매트릭스 60FPS 검증:**

| OS | 등급 | 대표 기종 | 목표 |
|---|---|---|---|
| iOS | 저 | iPhone SE 2 | 60FPS |
| iOS | 중 | iPhone 13 | 60FPS |
| iOS | 고 | iPhone 15 Pro | 120FPS |
| Android | 저 | Galaxy A14 | 60FPS (또는 30FPS 옵션) |
| Android | 중 | Galaxy A54 | 60FPS |
| Android | 고 | Pixel 8 | 60FPS |

### 4.3 에러 트래킹 + 분석

`COWORK_PROMPT_PACK` §6 디버깅/안정성 강화 규칙 적용:

- [ ] **에러 로깅 강제:** 모든 `catch`에 Sentry 로깅. 메시지에 상황 컨텍스트 포함. `try { ... } catch {}` 빈 블록 ESLint로 차단.
- [ ] **에러 코드 체계:** `E_HIT_TOO_FAST`, `E_SAVE_TAMPERED`, `E_REPLAY_MISMATCH` 등 고유 코드. 운영 시 검색 가능.
- [ ] **분석 도구 통합:** Mixpanel 또는 Amplitude (1개로 시작). 표준 이벤트(install, run_start, run_end, purchase, ad_view, retention_marker_d1).
- [ ] **퍼널 측정:** 튜토리얼 단계별 이탈률, 첫 결제 전 평균 런 수, 카드별 픽률.
- [ ] **A/B 테스트 인프라:** Supabase에 `experiment_assignments` 테이블, 클라에서 `useExperiment(key)` hook.
- [ ] **원격 설정(Remote Config):** 카드 가중치, 화폐 곡선, 광고 빈도는 클라 빌드에 박지 말고 서버에서 페치. 앱스토어 심사 우회 핫픽스.

### 4.4 LiveOps 인프라 사전 구축

`the-safety-first-pm` 스킬: **"Feature Flags를 먼저 박아두지 않으면 라이브 사고 시 대응 불가"**

- [ ] **Feature Flags:** 모든 신규 기능에 토글. 사고 시 1클릭 비활성화. Supabase에 `feature_flags` 테이블.
- [ ] **롤백 시나리오:** 시즌 패스 잘못 출시 → 회수 + 보상 자동 지급 함수 사전 작성.
- [ ] **CS 어드민 패널:** 유저 검색 → 화폐 지급/회수, 데이터 백업 복원, 어뷰저 마킹.
- [ ] **점검 모드 (Maintenance Mode):** 클라이언트 부팅 시 `/maintenance.json` 페치. `enabled: true`면 안내 화면.
- [ ] **강제 업데이트:** 최소 지원 버전 명시. 미만이면 스토어 링크 안내.

### 4.5 마이그레이션 안전망

`the-migration-expert` 스킬: 출시 후 데이터 손실 = 게임 사망.

- [ ] schemaVersion 필드는 모든 저장 데이터에 박혀있는가? (Phase 1부터 박혀있음)
- [ ] `systems/migrations/` 모든 버전 페어에 단위 테스트 존재
- [ ] 100건 실제 유저 데이터 샘플 → 신규 마이그레이션 실행 → 크래시 없음 검증
- [ ] 마이그레이션 실패 시 fallback 로직 (안내 후 클라우드 백업 복원)

### 4.6 Gate Check

- [ ] **치팅 시도 차단:** Cheat Engine으로 클라 화폐 조작 → 서버 검증에서 reject 확인
- [ ] **HMAC 위조 시도:** 잘못된 서명으로 요청 → 401 응답
- [ ] **저사양 60FPS:** 디바이스 매트릭스 매트릭스 모든 기종에서 30분 연속 플레이 시 평균 FPS 55+
- [ ] **메모리 누수:** 30분 플레이 후 heap 증가 50MB 이하
- [ ] **크래시율:** 내부 200시간 누적 플레이에서 크래시 0건
- [ ] **Sentry 통합:** 의도적 에러 발생 → 5분 내 대시보드에 노출
- [ ] **Feature Flag:** 임의 기능 토글 OFF → 클라이언트에서 사라짐 (재시작 없이)

### 4.7 산출물

- 릴리즈 후보 빌드 (RC1)
- 보안 감사 보고서 (`the-security-auditor` 스킬 활용)
- 성능 벤치마크 보고서
- 어드민 대시보드 v1
- 운영 SOP 문서

---

## 🟪 Phase 5: Soft Launch & Live (출시 및 배포) — 4~8주

**목표:** 실제 유저 배포 + 운영 모드 전환.

### 5.1 플랫폼 SDK 최종 연동

- [ ] **결제(IAP):** RevenueCat 통합. iOS Sandbox + Google Play 라이센스 테스터에서 SKU 풀세트 검증.
  - 구매 → 환불 → 복원 플로우
  - 영수증 서버 재검증
  - 결제 실패 케이스(네트워크 끊김, 잔액 부족 등)
- [ ] **광고:** AdMob 보상형 광고. mediation 셋업 (선택).
- [ ] **푸시:** FCM (Android) + APNs (iOS) — Capacitor Push Notifications 플러그인.
- [ ] **딥링크:** 마케팅 캠페인 추적 (Firebase Dynamic Links 또는 Branch).
- [ ] **소셜 공유:** 결과 화면 공유 (Capacitor Share API).

### 5.2 CI/CD 파이프라인

- [ ] **빌드 자동화:** GitHub Actions
  - lint + typecheck + test (모든 PR)
  - PR 라벨 `release-candidate` 시 자동 빌드 + Capacitor sync
  - main 머지 시 staging 환경 자동 배포
  - 태그 push 시 production 빌드
- [ ] **앱스토어 자동 업로드:** Fastlane (iOS) + Gradle Play Publisher (Android)
- [ ] **단계 배포 (Phased Release):** Android 5% → 20% → 50% → 100%, iOS는 phased release 활성

### 5.3 출시 전 컴플라이언스

- [ ] **개인정보 처리방침** 페이지 (KISA, GDPR, CCPA, COPPA)
- [ ] **이용약관 / 환불 정책**
- [ ] **광고 정책** (보상형 광고 명시)
- [ ] **게임물 자체등급분류** (한국)
- [ ] **사업자 등록 / 통신판매업 신고** (한국 출시 시)
- [ ] **미성년자 결제 차단 / 한도** (한국법)
- [ ] **모든 에셋 라이센스 트레이서블 보관** (폰트, 사운드, 일러스트)

### 5.4 스토어 등록 자산

**Google Play:**
- 앱 아이콘 512×512, 피처 그래픽 1024×500
- 스크린샷 폰 8장 + 태블릿 8장
- 프로모션 영상 30초~2분
- 짧은 설명 80자, 자세한 설명 4000자
- 콘텐츠 등급 설문, 개인정보 처리방침 URL

**App Store:**
- 앱 아이콘 1024×1024 (알파 채널 금지)
- 스크린샷 iPhone 6.7"/6.5"/5.5" + iPad 12.9"/11" 각 1~10장
- 키워드 100자, 설명 4000자
- 등급 설문, 개인정보 처리방침, 지원 URL

### 5.5 소프트런칭

리스크 낮은 1~3개 국가 우선 출시 → 핵심 지표 확보 후 글로벌 출시.

**추천 국가:** 캐나다, 호주, 뉴질랜드 (영어, 영미권 지표 근사) + 필리핀/베트남 (저비용 UA) + 한국 (홈마켓이라면)

**KPI 합격선 (장르 평균):**

| 지표 | 합격 | 우수 |
|---|---|---|
| D1 리텐션 | 35%+ | 45%+ |
| D7 리텐션 | 12%+ | 20%+ |
| D30 리텐션 | 4%+ | 8%+ |
| ARPDAU | $0.05+ | $0.15+ |
| 평균 세션 길이 | 5분+ | 8분+ |
| 일일 세션 수 | 3회+ | 5회+ |
| 크래시율 | 1% 미만 | 0.3% 미만 |

> KPI 미달 시 **글로벌 출시 보류 + 라이브 튜닝.** 소프트런칭은 "검증 단계"가 아니라 "데이터로 게임을 다시 만드는 단계".

### 5.6 Gate Check

- [ ] **실 결제 성공:** 테스트 계정으로 실 결제 → 영수증 서버 검증 → 화폐 지급 + 환불 → 회수
- [ ] **원격 제어:** 어드민에서 Feature Flag 토글 → 5분 내 클라이언트 반영
- [ ] **점검 모드:** maintenance.json 활성화 → 클라이언트 부팅 차단 + 안내 화면
- [ ] **강제 업데이트:** 최소 지원 버전 변경 → 구버전 클라이언트가 스토어로 안내
- [ ] **CI/CD:** 태그 push → 5분 내 자동 빌드 + 스토어 업로드 (테스트 트랙)
- [ ] **소프트런칭 KPI:** 위 합격선 충족
- [ ] **온콜 체제:** 출시 후 72시간 P0/P1 이슈 30분 내 대응 검증

### 5.7 출시 D-Day 운영

- [ ] 서버 용량 예상치의 5배 프로비저닝
- [ ] CDN 캐시 워밍업
- [ ] Feature Flag로 신규 가입 throttle 가능 상태
- [ ] 어드민 대시보드 모니터 4개 (가입/매출/크래시/서버)
- [ ] 롤백 빌드 준비 (이전 안정 버전)
- [ ] 핫픽스 빌드 파이프라인 6시간 내 배포 검증
- [ ] CS 매크로 답변 한/영 30종

---

# 🤖 4. CLAUDE_COWORK_PROMPT_PACK 활용 가이드

본 게임 개발 동안 Claude/AI에게 **반드시** 다음 프롬프트를 사용해 구조 무너짐을 방지한다.

### 4.1 매 작업 시작 전 (필수)

```
[🟠 작업 시작 전 이해 강제]
작업 시작 전에 다음을 먼저 수행해라:
1. 현재 GameState 구조를 코드 기반으로 요약
2. Action 타입 목록을 정리
3. 서버와 클라이언트의 역할 분리 설명

추측 금지. 실제 src/core/State.ts와 src/core/Actions.ts를 읽고 답해라.
```

### 4.2 매 작업마다 (필수)

```
[🔴 구조 강제]
다음 규칙 위반 시 작업 중단하고 먼저 수정해라:
- 모든 상태 변경은 reducer를 통해서만 수행
- 클라이언트는 상태를 계산하지 않는다 (서버 권위)
- 서버는 action replay 기반으로만 상태를 계산한다
- 직접 state mutation 금지
- 단일 책임 원칙

이번 작업의 범위는 [TASK]이다. 다음을 절대 벗어나지 마라:
- 새로운 시스템 추가 금지
- 기존 구조 변경 금지
- 요청된 파일만 수정
```

### 4.3 보상/재화 관련 작업 시 (필수)

```
[🟢 안티치트 강제]
- 클라이언트 데이터는 절대 신뢰하지 않는다
- 서버에서 모든 보상을 재계산한다 (action replay)
- HMAC 시그니처 + 타임스탬프 윈도우 검증
- 비정상적인 값은 즉시 reject하고 어뷰저 마킹
```

### 4.4 코드 수정 출력 시

```
[🔵 코드 생성 방식]
- 코드 전체를 다시 작성하지 마라
- 변경된 부분만 명확히 보여줘라
- // ... existing code ... 주석 활용
- 수정 결과가 5계명을 위반하는지 최종 점검
```

### 4.5 에러/디버깅 작업 시

```
[🟣 디버깅/안정성]
- 모든 catch에 Sentry/Logger 호출 포함, 빈 catch 금지
- 새 데이터 구조는 Type/Interface 먼저 정의 → 검토 → 로직 작성
- 결제/재화 변경 시 서버 재검증 단계 포함 확인
- 네트워크 장애 시 롤백 또는 강제 동기화 로직 고려
```

---

# 📅 5. 일정 요약

소규모 팀(개발 2~3, 아트 1, 기획 1) 기준 **출시까지 약 9~12개월**. 1인 개발이라면 1.5~2배.

| Phase | 단계 | 기간 | 누적 |
|---|---|---|---|
| 1 | Skeleton | 2~3주 | 1개월 |
| 2 | Heartbeat | 4~5주 | 2~2.5개월 |
| 3 | Content Expansion | 6~8주 | 4~4.5개월 |
| 4 | Hardening | 4~6주 | 5.5~6.5개월 |
| 5 | Soft Launch & Live | 4~8주 | 6.5~8.5개월 |
| - | 글로벌 출시 + 라이브 운영 | 영구 | - |

> 위 일정은 콘텐츠 양 최소(광물 8종, 카드 60종) 기준이다. 권장 분량(광물 12종, 카드 100종)은 +30%.
> 게임은 항상 늦어진다. 1인/소규모는 위 일정의 1.3~1.7배가 평균.

---

# 🚦 6. 세션 동기화 프로토콜 (NAVIGATOR 준수)

새 채팅 세션마다 AI에게 다음을 입력한다.

```
이 프로젝트는 GAME_STEP_NAVIGATOR_v1을 따른다.

지금까지의 진행 상황을 NAVIGATOR 형식에 맞춰 브리핑해줘:
- Current Phase: (Phase 1~5 중 어디)
- Tasks Completed: (이번 Phase에서 완료된 항목)
- Gate Check 잔여: (다음 Phase로 가기 위해 남은 항목)
- Blocking Issues: (블로커)
- Next Session Goal: (이번 세션에서 시작할 작업)

코드 기반으로 답해라. 추측 금지.
```

세션 종료 시:

```
[세션 종료 요약]
- Current Phase: 
- Tasks Completed (이번 세션):
- Files Modified:
- Blocking Issues:
- Next Session Goal:
```

---

# 🛡️ 7. 리스크 레지스터

| 리스크 | 발생 가능성 | 영향도 | 대응 |
|---|---|---|---|
| 핵심 루프 재미 부족 | 중 | 치명 | Phase 2 Gate Check 외부 테스트, No-Go 트리거 엄수 |
| 일정 지연 | 고 | 큼 | 매 Phase Gate Check, 스코프 컷 우선순위 사전 합의 |
| 출시 후 치팅으로 경제 붕괴 | 중 | 큼 | Phase 1부터 4-Layer + 서버 권위 + HMAC, Phase 4 안티치트 검증 |
| 마이그레이션 실패 데이터 손실 | 중 | 치명 | Phase 1부터 schemaVersion, 100건 샘플 검증, 단계 배포 |
| 저사양 60FPS 미달 | 중 | 큼 | Phase 4 디바이스 매트릭스, 동적 해상도 |
| 결제/광고 수익 미달 | 중 | 큼 | 소프트런칭 KPI 합격선, A/B 테스트 |
| 스토어 심사 거절 | 저~중 | 큼 | 가이드라인 사전 검토, 컴플라이언스 체크리스트 |
| Layer 침범으로 스파게티화 | 고 | 큼 | ESLint rule로 import 방향 강제, 매 PR self-check 5계명 |

---

# 🎯 8. 즉시 시작 가능한 다음 액션

### Week 1 (Phase 1 진입)

1. **Day 1~2:** GDD v0.1 초안 (광물 12종 가치 곡선, 카드 풀 1차, 스킬트리 가지 7개)
2. **Day 3:** 기술 스택 최종 확정 (Vite + TypeScript + PixiJS + React + Tailwind + Capacitor + Supabase)
3. **Day 4:** 디렉토리 구조 셋업 (위 1.5)
4. **Day 5:** `core/State.ts` + `core/Actions.ts` 골격
5. **Day 6~7:** `StubAdapter` + `TickSystem` + 빈 PixiJS 화면

### Week 2

1. **Phase 1 완성** — Gate Check 통과 검증
2. **Phase 2 시작** — `RUN_START` → `MINE_HIT` → `RUN_END` 핵심 루프

### Week 3

1. 프로토타입 외부 테스터 5명 모집
2. Phase 2 작업 지속

---

## 부록 A. UI 통합 시 고려사항 (추후)

> 현재 UI는 미정. 추후 입힐 때 반드시 다음을 검토.

- **레이어 분리:** UI 컴포넌트는 `view/ui/`만. core/systems에 절대 안 섞이게.
- **상태 단방향 흐름:** UI는 GameState **읽기만**. 변경은 dispatch(Action)로만.
- **반응형:** 폰 세로 / 폰 가로 / 태블릿 3개 레이아웃.
- **테마:** 다크/라이트, 색약 모드, 폰트 크기. CSS 변수로 일괄 변경.
- **로컬라이제이션:** 모든 텍스트는 i18n 키. 하드코딩 금지.
- **UI 애니메이션 예산:** Framer Motion 동시 5개 이상 시 모바일 프레임 드롭 → spring/tween 분기.

## 부록 B. 권장 조직 구성

| 역할 | 인원 | 핵심 책임 |
|---|---|---|
| 게임 디자이너 | 1 | GDD, 밸런스, 콘텐츠 설계 |
| 클라이언트 개발 | 2 | 게임 로직, 렌더링, UI |
| 서버 개발 | 1 (또는 풀스택) | API, 보안, LiveOps 인프라 |
| 아트 / 애니메이터 | 1 | 픽셀 아트, 애니, UI 비주얼 |
| 사운드 디자이너 | 외주 | SFX 50종, BGM 5트랙 |
| QA | 1 (또는 외주) | 테스트, 자동화 |
| PM | 1 (또는 디자이너 겸직) | 일정, 우선순위 |
| LiveOps (출시 후) | 1 | 운영, CS, 콘텐츠 갱신 |

## 부록 C. KPI 대시보드 필수 지표

- **수익:** DAU, ARPDAU, ARPPU, 결제전환율, LTV
- **리텐션:** D1/D7/D30, 평균 세션 길이/수, 7일 누적 플레이
- **콘텐츠:** 카드별 픽률/승률, 스킬트리 노드 도달률, 막힘 스테이지
- **기술:** 크래시율, ANR, 평균 FPS, P95 로딩 시간, 서버 응답 시간
- **마케팅:** CPI, ROAS, 채널별 LTV/CPI

---

*문서 버전: 2.0 (UNIVERSAL_GAME_FRAMEWORK + GAME_STEP_NAVIGATOR + COWORK_PROMPT_PACK 통합) / 작성일: 2026-04-30*
