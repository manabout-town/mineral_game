# Mineral Rush

광물 채굴 액션/로그라이트 게임. Timber Rush 스타일의 핵심 루프를 광물 테마로 재구성.

상위 폴더의 `MINERAL_RUSH_개발_로드맵.md`가 마스터 문서입니다. 본 README는 클라이언트 코드베이스 가이드.

## 프레임워크 준수

- **UNIVERSAL_GAME_FRAMEWORK_v1** — 4-Layer 아키텍처 (Core ← Systems ← Platform ← View)
- **GAME_STEP_NAVIGATOR_v1** — 5-Phase 진행 (현재 Phase 1: Skeleton)
- **CLAUDE_COWORK_PROMPT_PACK_v2** — 작업 시 6색 프롬프트 사용

### 5계명

1. Pure Logic First — 엔진 라이브러리 없이도 도는 순수 로직 우선
2. Atomic Actions — 하나의 Action은 하나의 상태만 바꾼다
3. No Hidden State — 모든 상태는 GameState에 명시
4. Validation Required — 모든 보상 지급 전 검증
5. Traceable — 모든 에러는 고유 코드 + 로깅

## 디렉토리

```
src/
├── core/        # State, Actions, Reducers, Rules — 순수 로직만
├── systems/     # TickSystem, ValidationSystem, PersistenceSystem, Logger
├── platform/    # IPlatformAdapter, IStorage, ISigner, 어댑터 구현
├── view/        # PixiJS 렌더러 + React UI
└── shared/      # 공통 타입/상수/ID
```

ESLint `boundaries` 플러그인으로 **레이어 의존 방향이 정적으로 강제**됩니다.
역방향 import (예: `core → view`)는 lint 에러로 차단됩니다.

## 개발 시작

```bash
cd mineral-rush
npm install
npm run dev          # http://localhost:5173
```

## 스크립트

| 명령 | 용도 |
|---|---|
| `npm run dev` | Vite dev 서버 (HMR) |
| `npm run build` | 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 로컬 미리보기 |
| `npm run lint` | ESLint (4-Layer 강제 포함) |
| `npm run typecheck` | TypeScript 타입 검사 |
| `npm test` | Vitest 단위 테스트 (1회) |
| `npm run test:watch` | 테스트 watch 모드 |
| `npm run format` | Prettier 적용 |

## 환경 변수

`.env.example`을 `.env`로 복사. `.env`는 git에 커밋하지 않습니다 (`.gitignore` 등록됨).

| 키 | 설명 |
|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `VITE_GAME_VERSION` | 빌드 버전 (CI에서 sha로 대체) |
| `VITE_SCHEMA_VERSION` | 저장 데이터 스키마 버전 |
| `VITE_DEV_HMAC_SECRET` | 로컬 저장 서명 secret (개발용) |

## Phase 1 Gate Check

다음을 모두 충족해야 Phase 2로 진입합니다.

- [ ] `npm run dev` 실행 시 에러 없이 빈 화면에 갈색 사각형(광맥)이 뜬다
- [ ] 사각형을 클릭하면 hits/dmg 카운터가 올라간다
- [ ] 30초 카운트다운이 끝나면 자동으로 새 런이 시작된다
- [ ] `npm run typecheck` 통과
- [ ] `npm test` 통과 (runReducer 단위 테스트 8개)
- [ ] `npm run lint` 통과 (4-Layer 의존 방향 위반 없음)
- [ ] 페이지 새로고침 후 `runs` 카운터가 보존된다 (localStorage 저장 동작)
- [ ] 의도적으로 `core/State.ts` 안에 `import { Application } from 'pixi.js'`를 넣어보면 lint 에러로 차단된다

## Phase 1 진행 상태 ✅ 완료

| 작업 | 상태 |
|---|---|
| 프로젝트 초기화 (Vite + TS + PixiJS + React) | ✅ |
| 4-Layer 디렉토리 + ESLint boundaries | ✅ |
| Core State + Actions 골격 | ✅ |
| Reducer + 단위 테스트 | ✅ |
| Platform Adapter (Stub/Web) + 저장소/서명 | ✅ |
| TickSystem (60Hz 고정 타임스텝) | ✅ |
| PixiGameRenderer (사각형 + HUD) | ✅ |
| Game (루프 글루) + React App 셸 | ✅ |
| CI/CD (GitHub Actions) | ✅ |

## Phase 2 진행 상태

| 작업 | 상태 |
|---|---|
| SeededRandom (Mulberry32) + 콘텐츠 데이터(JSON) + 로더 | ✅ |
| State / Actions 확장 (광맥 HP, 콤보, 카드 오퍼) | ✅ |
| Rules 엔진: damage / dropTable / cardOffer / veinHp | ✅ |
| Reducers 분리: run/economy/meta + 광맥 자동 교체 + 카드 효과 | ✅ |
| ValidationSystem 확장 + ReplaySystem (events 재생) | ✅ |
| PixiGameRenderer 확장 (HP 게이지, 콤보, 데미지 텍스트, 광석 점멸) | ✅ |
| UI: CardOfferModal + ResultScreen | ✅ |
| 단위 테스트(rules) + 회귀 테스트(tests/replay/) | ✅ |
| balance-sim 도구 (1000회 시뮬레이션 봇) | ✅ |
| **Gate Check (외부 테스터 5명)** | 진행 필요 |

## Phase 2 Gate Check

| 항목 | 검증 방법 |
|---|---|
| 30초 런 무한 반복 + 메타 화폐 누적 | 브라우저에서 30초 × 5번 반복, 우하단 💎 카운터 증가 확인 |
| 외부 테스터 5명 중 4명 "한 번 더 하고 싶다" | 외부 진행 필요 |
| 1000런 광석 카운트 음수 0회 | `npm run sim:1k` |
| 결정론 (동일 seed → 동일 결과) | `npm test` (tests/replay/determinism.test.ts) |
| 저장/불러오기 메타 화폐 보존 | 새로고침 후 💎 카운터 유지 |
| 동일 카드 픽률 30% 이하 | `npm run sim:1k` 후 card pick rates 확인 |

## 다음 단계 (Phase 3 Content Expansion)

`MINERAL_RUSH_개발_로드맵.md` §3 Phase 3 참조.

- 광물 12종 / 곡괭이 5종 / 카드 60종 / 스킬트리 60노드 / 스테이지 3종
- 다중 씬 (LobbyScene ↔ RunScene ↔ ResultScene)
- 메인 메뉴 / 스킬트리 / 일일 미션 / 도전과제
- 사운드 통합 (오디오 스프라이트)
- 텍스처 아틀라스 빌드 파이프라인

## 보안 / 안티치트 (Phase 4 본격 작업, 지금은 골격만)

- 로컬 저장 데이터는 HMAC-SHA256 서명 (`WebCryptoSigner`)
- `events[]` 배열은 액션 리플레이 원천 데이터 — 서버 검증 시 클라가 보낸 이벤트를 동일 reducer로 재생해 화폐 정산
- `ValidationSystem`이 클라 측에서도 sanity check (탭 속도 등)
- 출시 전 빌드는 강한 secret 주입 + 디바이스 fingerprint 결합 + 코드 난독화 필요

## Supabase

- 프로젝트: `mineral-rush` (region `ap-northeast-2`)
- URL/Key는 `.env`에 박힘
- Phase 1 단계에서는 클라이언트가 Supabase에 접근하지 않습니다 (테이블 0개)
- Phase 4에서 테이블 스키마(profiles, runs, ledger, feature_flags 등) 추가 예정
