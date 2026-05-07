# 실행 방법

샌드박스에서 npm registry 접근이 막혀있어, 의존성 설치는 사용자 macOS 터미널에서 직접 실행합니다.

## 1. 의존성 설치 (최초 1회)

터미널을 열고 다음을 실행:

```bash
cd ~/Desktop/mineral/mineral-rush
npm install
```

## 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`이 자동으로 열립니다.

## 3. Phase 1 Gate Check (체감 검증)

브라우저에서 확인할 것:

1. ✅ 갈색 사각형(임시 광맥)이 화면 중앙에 표시
2. ✅ 좌상단 HUD에 `runs / remaining / hits / dmg` 표시
3. ✅ 사각형을 클릭하면 hits 증가 + 색이 어두워짐 (피격 피드백)
4. ✅ 30초가 지나면 자동으로 새 런 시작 (`runs` 카운터 +1)
5. ✅ 페이지 새로고침 후에도 `runs` 카운터 유지 (localStorage 저장)
6. ✅ 우하단에 `v0.0.1 · schemaV1 · runs N` 디버그 정보

## 4. 자동 검증

```bash
npm run typecheck         # TypeScript 타입 검사
npm test                  # Vitest (runReducer / rules / replay / skillTree / depthProgress)
npm run lint              # ESLint + 4-Layer 의존 방향 검증
npm run validate-content  # data/*.json 시트 무결성 (id/곡선/prerequisite/cycle)
npm run sim:1k            # 1000회 자동 시뮬레이션 (불변식 + 카드 픽률)
```

다섯 명령 모두 종료 코드 0이어야 통과.

## 4-1. Phase 2 체감 검증

브라우저에서:

1. ✅ 화면 중앙 갈색 광맥 + 위쪽 빨간 HP 게이지 + 상단 타이머
2. ✅ 광맥 클릭 → HP 줄어들고 균열이 늘어남
3. ✅ 연속 클릭 → 콤보 카운터 표시 (`x2`, `x3`, ...)
4. ✅ 광석 드랍 시 광물별 색상으로 `+1` 텍스트 부유
5. ✅ 광맥 부수면 새 광맥 + **카드 선택 모달**(3장) 등장
6. ✅ 카드 픽 → 모달 사라지고 채굴 재개. modifiers HUD에 효과 반영
7. ✅ 30초 끝 → **결과 화면** (광석 목록 + 가치) → "보상 받고 다음 런" 버튼
8. ✅ 새로고침해도 `runs` / `💎` 카운터 보존

## 4-2. Phase 3 체감 검증

브라우저에서:

1. ✅ 부팅 시 **Lobby 화면** — `MINERAL RUSH` 타이틀, PLAY 버튼, 스킬트리 패널
2. ✅ **PLAY** 클릭 → 추천 깊이로 런 시작 (총 런 수에 따라 D1~D3)
3. ✅ 인게임 우상단 **‖ Pause** 버튼 → Lobby로 즉시 복귀 (현재 런 quit)
4. ✅ Result 화면 "보상 받고 다음 런" → Lobby로 복귀 (lobby 모드)
5. ✅ 스킬트리에서 root 노드(테두리만 있는 사각형) 클릭 → 크리스탈 차감 + 노드 색상 활성
6. ✅ 활성 노드 다시 클릭 → 레벨업 (비용 곡선 적용)
7. ✅ 깊이 진행 — 광맥 3개 부수면 자동 D1→D2 (events에 `depth_advance`)
8. ✅ 깊이가 5 넘어가면 stage가 `cave`로 자동 전환 (광맥 HP 베이스 상승)
9. ✅ Lobby의 **플레이테스트 로그 Export** → JSON 파일 다운로드
10. ✅ Lobby의 **저장 데이터 초기화** → confirm 후 새 게임 (runs=0)

## 4-3. balance-sim 출력 예시

```
=== Mineral Rush — Balance Sim ===
runs: 1000  (took 1234ms, 1.23ms/run)
opts: depth=1 tps=6 pickCards=true

avg veinsDestroyed: 4.83
avg damage:         2150
avg value:          78.4
avg hits:           172

avg ores per run:
  copper       18.42
  iron         8.21
  gold         0.93

card pick rates:
  sharp_edge           34.2%
  steady_hands         28.7%
  appraiser_eye        22.4%
  ...

invariants: negative ore counts = 0
OK
```

## 5. 4-Layer 강제 검증 (선택)

`src/core/State.ts` 맨 위에 다음 줄을 임시로 추가:

```ts
import { Application } from 'pixi.js';
```

`npm run lint` 실행 → ESLint가 다음 에러를 내면 boundaries 강제가 정상 작동:

```
core/systems는 PixiJS를 import 할 수 없습니다 (5계명 §1 Pure Logic First).
```

확인 후 줄 삭제.

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `npm install` 실패 (E403 등) | macOS 터미널의 npm registry 정책 확인 |
| 브라우저 화면이 검정만 | 콘솔 확인. PixiJS init 실패 시 WebGL 지원 여부 점검 |
| `npm test` 실패 | 단위 테스트는 결정론에 의존. 시간 의존 코드가 들어갔는지 확인 |
| `npm run lint` 가 boundaries 에러 못 잡음 | `eslint-plugin-boundaries` 설치 확인 |

## 다음 작업 (Phase 2 진입 시)

`mineral-rush/` 안에서 다음 명령으로 Phase 2 작업 분기 만들기 (선택):

```bash
git init
git add -A
git commit -m "Phase 1: Skeleton 완성"
git checkout -b phase-2-heartbeat
```
