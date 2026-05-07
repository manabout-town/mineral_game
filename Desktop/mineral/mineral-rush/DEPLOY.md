# Mineral Rush — 배포 가이드

## 요구 사항

- Node.js 20+
- npm 10+
- Vercel CLI: `npm install -g vercel`

---

## 로컬 개발

```bash
npm install

# 개발 서버 (http://localhost:5173)
npm run dev
```

`.env` 파일이 이미 Supabase 연결 정보로 설정되어 있습니다.

---

## 배포 전 체크

```bash
npm run typecheck        # tsc 에러 0 확인
npm run lint             # ESLint
npm test                 # 단위 테스트
npm run validate-content # 콘텐츠 JSON 검증
npm run sim:1k           # 1000런 밸런스 시뮬
npm run build            # 프로덕션 빌드
```

---

## Vercel 배포 (권장: CLI)

```bash
cd /Users/park/Desktop/mineral/mineral-rush

# 첫 배포
vercel login             # 이미 로그인된 경우 생략
vercel                   # 프리뷰 배포 (설정 마법사 진행)

# 프로덕션 배포
vercel --prod
```

### Vercel 환경 변수 설정

Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables** 에 아래 값 입력:

| 변수명 | 값 |
|---|---|
| `VITE_GAME_VERSION` | `0.1.0` |
| `VITE_DEV_HMAC_SECRET` | `mr-prod-s3cr3t-k3y-2026-mineral-rush-h4x0r` |
| `VITE_SUPABASE_URL` | `https://xiysuzuizettnudmupuq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXN1enVpemV0dG51ZG11cHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjUzOTQsImV4cCI6MjA5MzA0MTM5NH0.dw3o3ndBgq1HIMRzgwUWhYhCOFnYvbd6y8MYMXuk0ec` |

> 환경변수 추가 후 반드시 **Redeploy** 필요.

### 방법 2: Vercel 대시보드 (GitHub 연동)

1. [vercel.com](https://vercel.com) → "Add New Project" → GitHub 저장소 연결
2. Framework Preset: **Vite** (자동 감지)
3. 위 환경 변수 4개 입력 후 Deploy

---

## Supabase 현황 (이미 완료)

| 항목 | 상태 |
|---|---|
| 프로젝트 | `mineral-rush` (`xiysuzuizettnudmupuq`, ap-northeast-2) |
| DB 마이그레이션 | ✅ `0001_init` + `0002_runs_replay_reason` 적용 완료 |
| Edge Function: `boot-config` | ✅ 배포 완료 (공개 GET, JWT 불필요) |
| Edge Function: `validate-run` | ✅ 배포 완료 (HMAC 서명 검증 + reducer 리플레이) |
| RLS | ✅ 활성화 (players/runs: 본인만, feature_flags/maintenance: 전체 읽기) |

### Supabase Edge Function 환경 변수 (설정 필요)

Supabase 대시보드 → Edge Functions → validate-run → **Secrets** 에 추가:

```
HMAC_SECRET=mr-prod-s3cr3t-k3y-2026-mineral-rush-h4x0r
```

> `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동 주입.

---

## 배포 후 확인

```
1. 게임 로딩 → DebugBar에 v0.1.0 표시 확인
2. PLAY → 런 진행 → 결과 화면 정상 표시
3. Supabase 대시보드 → Table Editor → runs 테이블에 런 기록 쌓이는지 확인
4. boot-config 호출: curl https://xiysuzuizettnudmupuq.supabase.co/functions/v1/boot-config
5. 브라우저 새로고침 → 진행상황 유지
```

---

## 롤백

Vercel 대시보드 → Deployments → 이전 배포의 "..." → **Promote to Production**

---

## CI/CD

`.github/workflows/ci.yml` — main 브랜치 push 시:  
lint → tsc → test → validate-content → sim:1k 자동 실행.  
Vercel GitHub 연동 시 PR마다 프리뷰 URL 자동 생성.

---

## 트러블슈팅

**빌드 실패: `Cannot find module @rollup/rollup-*`**  
→ macOS에서 `npm install` 후 재시도 (arm64 네이티브 바이너리 필요).

**게임이 흰 화면만 보임**  
→ 브라우저 콘솔 확인. `VITE_DEV_HMAC_SECRET` 누락 여부 점검.

**Supabase 연결 안 됨 (Stub으로 동작)**  
→ Vercel 환경변수에 `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` 모두 입력했는지 확인 후 Redeploy.

**validate-run 500 에러**  
→ Supabase Edge Function Secrets에 `HMAC_SECRET` 설정 여부 확인.

**저장 데이터 초기화**  
→ 개발자도구 → Application → Local Storage → 해당 도메인 삭제.
