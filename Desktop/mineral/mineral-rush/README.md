# Mineral Rush

광물 채굴 액션/로그라이트 게임. Timber Rush 스타일의 핵심 루프를 광물 테마로 재구성.

상위 폴더의 `MINERAL_RUSH_개발_로드맵.md`가 마스터 문서입니다. 본 README는 클라이언트 코드베이스 가이드.

## 프레임워크 준수

- **UNIVERSAL_GAME_FRAMEWORK_v1** — 4-Layer 아키텍처 (Core ← Systems ← Platform ← View)
- **GAME_STEP_NAVIGATOR_v1** — 5-Phase 진행 (현재 Phase 3: Content Expansion 진입)
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
| `npm run sim` / `sim:1k` / `sim:no-cards` | balance-sim 봇 (광석 음수 0 검증, 카드 픽률 등) |
| `npm run validate-content` | data/*.json 시트 무결성 검사 (id 유니크, prerequisites, 곡선 등) |

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

## Phase 2 진행 상태 ✅ 완료

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
| Telemetry 어댑터 + Game 통합 (이벤트 자동 추적 + Lobby Export 버튼) | ✅ |
| **Gate Check (외부 테스터 5명)** | 외부 진행 |

## Phase 3 진행 상태 (Content Expansion)

| 작업 | 상태 |
|---|---|
| 콘텐츠 시트 확장 — 광물 12 / 곡괭이 8 / 카드 32 / 스테이지 5 / 스킬노드 22 | ✅ |
| `tools/content-validator.ts` (id/곡선/prerequisite/cycle 검증) | ✅ |
| Scene 시스템 — Lobby ↔ Run ↔ Result + Pause로 Lobby 복귀 | ✅ |
| 스킬트리 패널 (UI) + metaReducer.unlockSkillNode / levelUpSkillNode | ✅ |
| `core/rules/skillTree.ts` — 비용 곡선 + computeMetaModifiers + crystal_run_bonus | ✅ |
| `core/rules/depthProgress.ts` — 광맥 N개 부수면 자동 DEPTH_ADVANCE | ✅ |
| Stage 매칭 (depth → stageId) + RUN_START 시 stage override | ✅ |
| `IAudioManager` + `StubAudioManager` + Game 액션→SFX 매핑 | ✅ |
| Supabase 스캐폴드 — `supabase/migrations/0001_init.sql` + `functions/validate-run/` | ✅ |
| CI에 `validate-content` + `sim:1k` 추가 | ✅ |
| **Gate Check** (베타 빌드 + 평균 세션 10분 + 카드 다양성) | 외부 진행 |

## Phase 3 Gate Check

| 항목 | 검증 방법 |
|---|---|
| 평균 신규 유저 첫 세션 10분 이상 | 외부 베타 |
| 동일 카드를 매번 고르는 비율 30% 이하 | `npm run sim:1k` 후 card pick rates |
| 1000런 시뮬에서 카드 빌드 클러스터 5+ 아키타입 | balance-sim 결과 분석 |
| 씬 전환 100회 메모리 누수 30MB 이하 | Chrome Performance |
| 메인 메뉴 → 결과 화면까지 풀 플로우 무에러 | 수동 + Playwright (Phase 4) |

## Phase 3 → Phase 4 인계

- 메타 진행도(skillTree)가 RunStart의 baseline 모디파이어로 적용됨 — 카드 효과는 그 위에 누적
- 깊이 자동 진행 (광맥 N개 → depth+1)이 동작 — stage 자동 전환 포함
- `supabase/migrations/0001_init.sql` 적용 후 `validate-run` Edge Function 배포로 Phase 4 안티치트 본격 진입
- Telemetry는 LocalStorage 저장 → Lobby에서 JSON Export 가능. Phase 4에서 Mixpanel/Amplitude로 forwarding 추가

## Phase 2 Gate Check

| 항목 | 검증 방법 |
|---|---|
| 30초 런 무한 반복 + 메타 화폐 누적 | 브라우저에서 30초 × 5번 반복, 우하단 💎 카운터 증가 확인 |
| 외부 테스터 5명 중 4명 "한 번 더 하고 싶다" | 외부 진행 필요 |
| 1000런 광석 카운트 음수 0회 | `npm run sim:1k` |
| 결정론 (동일 seed → 동일 결과) | `npm test` (tests/replay/determinism.test.ts) |
| 저장/불러오기 메타 화폐 보존 | 새로고침 후 💎 카운터 유지 |
| 동일 카드 픽률 30% 이하 | `npm run sim:1k` 후 card pick rates 확인 |

## 다음 단계 (Phase 4 Hardening)

`MINERAL_RUSH_개발_로드맵.md` §3 Phase 4 참조.

- 서버 권위 안티치트: Edge Function `validate-run` 본격 구현 (`src/core` 코드를 Deno bundle 로 사용)
- HMAC 시그니처 + 타임스탬프 윈도우 ±60s + 통계 임계
- 텍스처 아틀라스 + 오디오 스프라이트 + 오브젝트 풀링 + 동적 해상도
- Sentry / Mixpanel(Amplitude) 통합 — Telemetry forwarder
- Feature Flags + Maintenance Mode 클라 부팅 핸들러
- 디바이스 매트릭스 60FPS 검증 (저사양 폰 포함)

## 보안 / 안티치트 (Phase 4 본격 작업, 지금은 골격만)

- 로컬 저장 데이터는 HMAC-SHA256 서명 (`WebCryptoSigner`)
- `events[]` 배열은 액션 리플레이 원천 데이터 — 서버 검증 시 클라가 보낸 이벤트를 동일 reducer로 재생해 화폐 정산
- `ValidationSystem`이 클라 측에서도 sanity check (탭 속도 등)
- 출시 전 빌드는 강한 secret 주입 + 디바이스 fingerprint 결합 + 코드 난독화 필요

## Supabase

- 프로젝트: `mineral-rush` (region `ap-southeast-2` 또는 사용자 선택 — `.env` 갱신)
- URL/Key는 `.env`에 박힘 (git 커밋 금지)
- Phase 3 시점: 클라이언트는 아직 Supabase에 접속하지 않음. **로컬 스캐폴드만 작성된 상태.**
- 배포 절차 (사용자 직접 수행 권장):
  ```bash
  # 1) Supabase CLI 설치 후 프로젝트 link
  npx supabase login
  npx supabase link --project-ref <YOUR_PROJECT_REF>

  # 2) 마이그레이션 적용
  npx supabase db push

  # 3) Edge Function 배포 (HMAC_SECRET 환경변수 사전 설정)
  npx supabase secrets set HMAC_SECRET=<32+자 랜덤 문자열>
  npx supabase functions deploy validate-run
  ```
- 본 단계의 마이그레이션 (`supabase/migrations/0001_init.sql`)이 만드는 객체:
  - `players`, `runs` (RLS: 본인 row만 select/insert)
  - `feature_flags`, `maintenance` (모두 read-only)
  - `leaderboard_entries` (read-only, insert는 service_role 전용)
- `validate-run` Edge Function은 현재 스캐폴드 — Phase 4에서 src/core를 Deno bundle하여 실제 액션 리플레이로 강화
