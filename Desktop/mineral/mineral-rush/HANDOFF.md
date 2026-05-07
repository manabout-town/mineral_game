# [세션 인계] Mineral Rush — Phase 8 (한 손 스와이프 시스템) 완료

> 마지막 업데이트: 2026-05-01  
> 상태: **Phase 1~8 ✅ · DB 마이그레이션 ✅ · Edge Functions ✅ · Vercel 배포 → 사용자 직접 실행 필요**  
> tsc 에러: **0** ✅

---

## 🎮 Phase 8 완료 내용

### 한 손 스와이프 시스템 (앱 출시 대응)

#### 변경 개요
- **`TimberTapButtons` 제거** → **`SwipeOverlay`** 로 교체
- 화면 어디서나 좌우 드래그(22px 이상, 수평 우세) → `game.hitSide(side)` 발동
- 한 손으로 엄지 스와이프만으로 모든 조작 가능 (버튼 위치 조준 불필요)

#### SwipeOverlay 구현 (`src/view/ui/App.tsx`)
- `onPointerDown` → startX/Y 기록
- `onPointerMove` → `|dx| > 22 && |dx| > |dy|` → side 판정 → 1회만 발동 (dispatched ref)
- `onPointerUp/Cancel` → 리셋
- 위험 방향 반투명 빨간 그라디언트 힌트
- 🚫 아이콘 dangerSide에 pulsing 표시
- 스와이프 성공 시 ⟶/⟵ 트레일 플래시 애니메이션 (320ms)
- 중앙 흐린 `← SWIPE →` 가이드 텍스트

#### 캐릭터 스무스 이동 (`src/view/pixi/PixiGameRenderer.ts`)
- `charTargetX` 필드 추가
- 매 프레임 `charX += (charTargetX - charX) * 0.18` lerp
- 좌우 전환 시 딱딱하게 순간이동하지 않고 부드럽게 슬라이드

#### 변경 파일
| 파일 | 변경 내용 |
|---|---|
| `src/view/ui/App.tsx` | `TimberTapButtons` → `SwipeOverlay` 교체 |
| `src/view/pixi/PixiGameRenderer.ts` | `charTargetX` 추가, lerp 이동 적용 |

---

## 🎮 Phase 7 완료 내용

### 1. 플레이 타임 5분
- `src/shared/constants.ts`: `RUN_DURATION_MS = 300_000` (30s → 5min)

### 2. 캐릭터 미표시 버그 수정
- `src/view/pixi/PixiGameRenderer.ts`: `render()` 내 `charGfx.visible = true` 명시 추가  
  (기존: run이 null이면 visible=false 후 복구 안 됨 → 수정: run 있을 때 항상 true)

### 3. Timber Rush 메카닉 (팀버 러쉬 유사 게임로직)

#### 핵심 룰
- **광맥마다 dangerSide (`left`|`right`) 존재** — 막힌 쪽
- **플레이어가 dangerSide 탭 → MISS** (콤보 리셋, 데미지 0)
- **반대쪽 탭 → HIT** (데미지, 광물 드랍, EXP)
- **성공 타격마다 새 dangerSide 생성** (RNG 결정론)
- **자동공격 제거** → 100% 수동 좌/우 탭으로 진행

#### 변경 파일
| 파일 | 변경 내용 |
|---|---|
| `src/shared/constants.ts` | `RUN_DURATION_MS = 300_000` |
| `src/core/State.ts` | `VeinState.dangerSide`, `RunState.playerSide` 추가; `GameEvent.mine_hit`에 `side`/`miss` 추가 |
| `src/core/actions.ts` | `MineHitAction.payload.side: 'left'|'right'` 추가 |
| `src/core/reducers/runReducer.ts` | `buildVein()` dangerSide RNG, `start()` playerSide 초기화, `mineHit()` Timber Rush 판정 + 미스 처리 |
| `src/systems/Replay.ts` | `eventToAction` mine_hit에 side 전달 |
| `src/view/Game.ts` | `tickAutoAttack` 제거, `hitSide(side)` 공개 메서드 추가, `handleTap` → x 기반 자동 side 판정 |
| `src/view/pixi/PixiGameRenderer.ts` | charGfx.visible 버그 수정, playerSide에 따른 캐릭터 좌/우 이동, `drawDangerIndicator()` 추가 (붉은 가시 경고) |
| `src/view/ui/App.tsx` | `TimberTapButtons` 컴포넌트 추가 (화면 좌/우 40% 대형 버튼, dangerSide에 따라 🚫 표시) |
| `tests/unit/runReducer.test.ts` | `safeSide()`, `safeHit()` 헬퍼로 전면 재작성, 미스 판정 테스트 추가 |
| `tests/unit/depthProgress.test.ts` | `playerSide`, `dangerSide` 픽스처 추가 |
| `tests/replay/determinism.test.ts` | MINE_HIT에 alternating left/right side 추가 |

---

## 🧠 Logical State (현재 완료 상태)

### Phase 6 완료 내용 (이번 세션)

#### Phase 6A — EXP 시스템 + 자동공격 완성
- `src/core/State.ts` — `exp`, `expThreshold` 필드 RunState에 추가
- `src/core/reducers/runReducer.ts` — EXP 누적 (광석 드랍 시), 카드 오퍼 EXP-임계값 기반으로 전환
- `src/view/Game.ts` — `tickAutoAttack()` 자동공격 루프 (pickaxe.speed Hz), `handleTap()` 쿨다운 가속만
- `src/view/pixi/PixiGameRenderer.ts`
  - Phase 6 필드: `charGfx`, `charX/Y`, `charAttackT`, `lastAttackSignal`, `charBobT`, `expBg/expFg/expText`, `lastOreTotal`
  - `init()`: 캐릭터 스프라이트 + EXP 바 생성
  - `render()`: 광물 파편 이펙트, 캐릭터 스윙 애니메이션, EXP 바 업데이트
  - `resize()`: charGfx + expBg/expFg/expText 재배치
  - `destroy()`: 신규 필드 null 처리
  - `drawCharacter(g, swingT)`: 픽셀 아트 드워프 광부 (12×블록 스윙 포함)
  - `drawExpBar(bg, fg, W, ratio, threshold)`: 그라디언트 EXP 바
- `tests/unit/depthProgress.test.ts` — `exp: 0, expThreshold: 20` 픽스처 추가

#### Phase 6B — LoadingScreen + 메인메뉴 리디자인
- `src/view/ui/LoadingScreen.tsx` — **신규**: 픽셀 아트 애니메이션 스플래시
  - SVG 곡괭이 스윙 + 광부 바빙 애니메이션
  - 광물 컬러 도트 장식
  - `done` prop: true → 페이드아웃 → unmount
- `src/view/ui/LobbyScreen.tsx` — **전면 리디자인**:
  - 모바일 우선 단일 컬럼 레이아웃
  - 탭 네비게이션 [홈 | 스킬 | 순위 | 설정]
  - 홈 탭: 픽셀 아트 광부 일러스트 + 크게 PLAY 버튼 + 통계 카드
  - 설정 탭: 스테이지 직행 + PlaytestPanel (개발자 기능 분리)
- `src/view/ui/App.tsx`:
  - `LoadingScreen` import 추가
  - bootConfig 없을 때 → `<LoadingScreen done={false} />`
  - game 부팅 중 → `<LoadingScreen done={gameReady} />` 오버레이
  - 컨테이너 `position: absolute, inset: 0` 로 피하기

### 이전 세션 완료 내용

#### Supabase DB 마이그레이션 (MCP로 직접 적용 완료)
- `0001_init` — players / runs / feature_flags / maintenance / leaderboard_entries 테이블 생성, RLS 정책 적용
- `0002_runs_replay_reason` — runs 테이블에 `replay_reason` 컬럼 추가

#### Supabase Edge Functions (배포 완료)
- **`boot-config`** (ID: `37fe84ba`) — GET, JWT 불필요, maintenance + feature_flags 조회, safe default, 60s CDN 캐시
- **`validate-run`** (ID: `75f6a10b`) — POST, HMAC 서명 검증 + reducer 리플레이 + DB upsert, reducer.js 번들 포함

#### 환경 변수 정비
- `.env` — `VITE_SUPABASE_ANON_KEY` 추가 (anon JWT), `VITE_DEV_HMAC_SECRET` 추가
- `src/vite-env.d.ts` — `VITE_SUPABASE_ANON_KEY?: string` 타입 추가 (옵셔널)
- `DEPLOY.md` — 전체 갱신 (Supabase 현황표, Vercel 환경변수 값 포함)

### 남은 작업 (사용자 직접 실행)

**1. Vercel 배포 (macOS 터미널에서)**
```bash
cd /Users/park/Desktop/mineral/mineral-rush
npm install -g vercel   # CLI 없으면
vercel login
vercel --prod
```
Vercel 대시보드 환경변수 4개 설정 후 Redeploy:
- `VITE_GAME_VERSION` = `0.1.0`
- `VITE_DEV_HMAC_SECRET` = `mr-prod-s3cr3t-k3y-2026-mineral-rush-h4x0r`
- `VITE_SUPABASE_URL` = `https://xiysuzuizettnudmupuq.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXN1enVpemV0dG51ZG11cHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjUzOTQsImV4cCI6MjA5MzA0MTM5NH0.dw3o3ndBgq1HIMRzgwUWhYhCOFnYvbd6y8MYMXuk0ec`

**2. Supabase Edge Function 시크릿 설정**  
Supabase 대시보드 → Edge Functions → validate-run → Secrets:
```
HMAC_SECRET=mr-prod-s3cr3t-k3y-2026-mineral-rush-h4x0r
```

**3. 배포 후 검증**
```bash
# boot-config 정상 응답 확인
curl https://xiysuzuizettnudmupuq.supabase.co/functions/v1/boot-config
# → {"maintenance":{"enabled":false},"flags":{...},"minSupportedVersion":null}
```

---

## 🏗️ Supabase 인프라 현황

| 항목 | 상태 | 세부 |
|---|---|---|
| 프로젝트 | ✅ ACTIVE_HEALTHY | `xiysuzuizettnudmupuq`, ap-northeast-2 |
| `players` 테이블 | ✅ | RLS: 본인만 select/update |
| `runs` 테이블 | ✅ | RLS: 본인만 insert/select; `replay_reason` 컬럼 포함 |
| `feature_flags` | ✅ | RLS: 전체 read-only |
| `maintenance` | ✅ | 싱글톤(id=1), enabled=false 초기값 |
| `leaderboard_entries` | ✅ | RLS: 전체 read-only |
| Edge: `boot-config` | ✅ | v1, JWT 불필요, CORS 설정 |
| Edge: `validate-run` | ✅ | v1, HMAC 검증 + reducer 리플레이 |

---

## 📋 Phase 4 완료 내용 (이전 세션)

### Phase 4.1 — VeinSpriteFactory
- `src/view/pixi/VeinSpriteFactory.ts` — 12종 광물 × 5형태 절차적 RenderTexture
- `src/view/pixi/PixiGameRenderer.ts` — veinBaseSprite 통합, HP 페이드, drawVeinOverlay

### Phase 4.2 — 절차적 BGM
- `src/platform/audio/WebAudioManager.ts` — 6스테이지 BGM, LFO 트레몰로, crossfade
- `src/platform/IAudioManager.ts` — BgmId 6종 확장
- `src/view/Game.ts` — RUN_START/DEPTH_ADVANCE/RUN_END BGM 트리거

### Phase 4.3 — 모바일 최적화
- `index.html` — viewport-fit=cover, iOS safe area, touch-action: none
- `src/view/pixi/PixiGameRenderer.ts` — hitArea Rectangle(-88,-88,176,176)

---

## 🔬 Active Hypotheses

- **ObjectPool 풀 크기**: PARTICLE_POOL_SIZE=80. burst 28 + ambient 1~2/frame → 안전 추정. 성능 테스트 후 조정 필요.
- **migration 누락 여부**: `rewardCrystals`는 런타임 상태만. economy/meta/schemaVersion만 localStorage 저장 → migration 불필요 (PersistenceSystem.ts 확인 권장).
- **validate-run HMAC_SECRET**: Edge Function Secrets에 설정 전까지 validate-run이 500 반환.

---

## ⚠️ 주의사항

1. **HMAC_SECRET 비밀 관리** — 현재 `.env`에 하드코딩된 시크릿. 프로덕션에서 강력한 랜덤값으로 교체 권장
2. **npm install 불가 (샌드박스)** — 패키지 추가 시 macOS에서 직접 실행
3. **vitest 샌드박스 실패** — `@rollup/rollup-linux-arm64-gnu` 없음. macOS에서 정상
4. **4-Layer 아키텍처 엄수** — core는 systems/platform/view import 금지
5. **결정론** — reducer 내 Date.now() 절대 금지
6. **tsc 에러 0 유지** — 작업 후 `npx tsc --noEmit` 필수

---

## 빠른 확인 명령

```bash
cd /sessions/eloquent-peaceful-feynman/mnt/mineral/mineral-rush

npx tsc --noEmit          # 타입 에러 확인 (샌드박스 동작)
tsx tools/content-validator.ts   # 콘텐츠 JSON 검증
tsx tools/balance-sim.ts         # 1000런 밸런스 시뮬
```

---

## 🔗 세션 인계 루틴 (다음 Claude가 읽을 것)

1. **지식 주입**: `UNIVERSAL_FRAMEWORK.md` + `GAME_STEP_NAVIGATOR.md` 업로드 후 원칙 주입
2. **상태 복구**: 이 파일(`HANDOFF.md`)을 업로드하며 "이전 세션의 너가 남긴 마지막 유언이야. 현재 상황을 브리핑해 줘"
3. **정합성 체크**: "브리핑 내용이 현재 소스 코드와 일치하는지 확인해 봐"

---

## 프로젝트 경로

```
워크스페이스: /Users/park/Desktop/mineral/mineral-rush/
샌드박스:     /sessions/eloquent-peaceful-feynman/mnt/mineral/mineral-rush/
```
