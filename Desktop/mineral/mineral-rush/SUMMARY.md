# Mineral Rush — Code Summary (토큰 절약용 핵심 요약)

> 이 파일은 새 세션에서 전체 소스를 업로드하지 않고도 컨텍스트를 복구할 수 있도록
> 핵심 인터페이스, 상수, 진입점만 모아둔 참조 문서입니다.
> 전체 코드가 필요한 경우에만 개별 파일을 Read 하세요.
> 마지막 업데이트: 2026-05-01 (Phase 3.4 완료 기준)

---

## 1. 아키텍처 계층

```
Core (순수 로직)
  └─ State.ts, Actions.ts, reducers/, rules/, content/
Systems (부수효과 없는 서비스)
  └─ PersistenceSystem, ValidationSystem, TickSystem, Logger, Replay
Platform (외부 의존)
  └─ IAudioManager, IRunSubmitter, IBootConfig, Telemetry, WebAdapter
View (UI / 렌더링)
  └─ Game.ts, PixiGameRenderer.ts, App.tsx, ui/
```

**5계명**: Pure Logic First · Atomic Actions · No Hidden State · Validation Required · Traceable

---

## 2. 핵심 타입 (src/core/State.ts)

```typescript
interface GameState {
  schemaVersion: number;           // 현재 2
  run: RunState | null;
  economy: EconomyState;           // { crystals: number; ores: Record<MineralId,number> }
  meta: MetaState;                 // { skillTree, stats }
}

interface RunState {
  stageId: string;
  depth: number;                   // 1부터 시작
  vein: VeinState;                 // { hp, maxHp, mineralPool, veinIndex }
  combo: number;
  comboWindowMs: number;
  oresCollected: Record<MineralId, number>;
  damageDealt: number;
  veinsDestroyed: number;
  modifiers: RunModifiers;         // { damageMul, dropRateMul, comboWindowMs, oreValueMul }
  cards: ActiveCard[];
  cardOffer: CardOffer | null;
  remaining: number;               // ms
  duration: number;                // ms (총 런 시간)
  finished: RunFinishedSummary | null;
  events: RunEvent[];              // 텔레메트리용
}

interface RunFinishedSummary {
  endedAt: number;
  reason: 'timeout' | 'quit' | 'death';
  oresCollected: Record<MineralId, number>;
  veinsDestroyed: number;
  cardsPicked: number;
  rewardOres: Record<MineralId, number>;
  rewardCrystals: number;          // veinsDestroyed * 5 (Phase 3.4에서 추가)
}
```

---

## 3. 주요 Actions (src/core/Actions.ts)

| type | payload | 효과 |
|------|---------|------|
| `MINE_HIT` | `{ t, x, y }` | 광맥 데미지, 콤보, 드랍 판정 |
| `VEIN_DESTROYED` | `{ t, seedBase }` | 새 광맥 생성 |
| `DEPTH_ADVANCE` | `{ t, depth }` | 깊이 증가, 스테이지 전환 |
| `RUN_START` | `{ t, stageId, seed, duration }` | 런 초기화 |
| `RUN_END` | `{ t, now, reason }` | finished 채움 (run=null 안 함) |
| `CARD_PICKED` | `{ t, cardId }` | 카드 효과 적용 |
| `CARD_REROLL` | `{ t, cost }` | 크리스탈 소비 + 재오퍼 |
| `META_RUN_REWARD` | `{ ores, crystals }` | 보상 지급, stats 갱신 |
| `SKILL_NODE_UNLOCK` | `{ nodeId }` | 스킬 노드 해금 |
| `SKILL_NODE_LEVEL_UP` | `{ nodeId }` | 스킬 노드 레벨업 |

---

## 4. 스킬트리 노드 ID (src/shared/ids.ts 기반)

브랜치: `pickaxe` · `ore_value` · `combo` · `drop` · `crystal` · `meta`

효과 종류: `damage_mul` · `ore_value_mul` · `drop_rate_mul` · `combo_window_ms` · `starting_combo_window_ms` · `combo_max_bonus` · `crystal_run_bonus`

---

## 5. 데이터 파일 (src/core/data/)

| 파일 | 항목 수 | 주요 필드 |
|------|---------|----------|
| `minerals.json` | 11종 | id, name, baseValue, color(hex) |
| `pickaxes.json` | 8종 | id, damage, speed, comboBonus |
| `cards.json` | ~30종 | id, effect, magnitude, rarity, cost |
| `stages.json` | 5종 | id, name, depth(range), veinHp |

---

## 6. 플랫폼 인터페이스 (src/platform/)

```typescript
// IAudioManager — 10종 SFX
playSfx(id: SfxId, opts?): void
// SfxId: 'pickaxe_hit'|'vein_destroyed'|'ore_collected'|'card_offer'|
//         'card_picked'|'card_rerolled'|'depth_advance'|'run_start'|'run_end'|'ui_click'

// IRunSubmitter
submit(report: RunReport): Promise<{ status: 'accepted'|'rejected'|'mismatch'; reason?: string }>

// IBootConfig
interface BootConfig {
  maintenance: { enabled: boolean; messageKo: string; messageEn: string; minSupportedVersion: string }
  features: Record<string, boolean>
}
```

---

## 7. 렌더러 진입점 (src/view/pixi/PixiGameRenderer.ts)

```typescript
// 레이어: bgLayer → worldLayer → particleLayer → hudLayer
// ObjectPool<T>: src/shared/ObjectPool.ts (acquire/release, factory 패턴)
// 공개 메서드:
spawnVeinBurst(x?, y?, color?): void  // 광맥 파괴 이펙트

// Phase 3.4 추가 내부 상태:
//   stageNameText: 깊이 증가 시 1.5s 페이드 플래시
//   shakeAt: 화면 흔들림 (±8px, 300ms)
//   ambientAccum: 스테이지별 앰비언트 파티클 (dust/drip/spark/ember/crystal)
```

---

## 8. Game.ts 핵심 흐름 (src/view/Game.ts)

```
boot() → renderer.init() + audio.init() + persistence.load() → 'lobby' 모드 대기
startNewRun() → RUN_START dispatch → TickSystem 시작
  └─ 매 tick: MINE_HIT (자동) + depthProgress 체크 → DEPTH_ADVANCE
  └─ 타이머 만료: RUN_END dispatch
claimRewardAndStartNewRun()
  └─ baseCrystals = finished.rewardCrystals   ← Phase 3.4에서 변경
  └─ META_RUN_REWARD dispatch → 보상 지급
  └─ run = null (Lobby 복귀)
```

---

## 9. 현재 저장 스키마 (schemaVersion=2)

```
localStorage['mineral_rush_save'] = HMAC-SHA256 signed JSON {
  schemaVersion: 2,
  economy: { crystals, ores },
  meta: { skillTree: Record<SkillNodeId, { unlocked, level }>, stats: { ... } }
}
```

마이그레이션: `v0→v1` (skillTree 초기화), `v1→v2` (stats.bestRunScore 추가)

> `rewardCrystals`는 `run.finished`에만 존재하는 런타임 상태 — LocalStorage 비저장, 마이그레이션 불필요

---

## 10. 다음 구현 대상 (Phase 3.5 — Supabase)

```
supabase/functions/boot-config/index.ts   ← 미존재, 신규
supabase/functions/submit-run/index.ts    ← 미존재, 신규
src/platform/bootConfig/SupabaseBootConfigSource.ts  ← Stub → 실구현
src/platform/runSubmitter/SupabaseRunSubmitter.ts     ← Stub → 실구현
src/view/ui/LobbyScreen.tsx               ← 리더보드 패널 추가
```

---

## 세션 인계 루틴

새 세션 시작 시:
1. `UNIVERSAL_FRAMEWORK.md` + `GAME_STEP_NAVIGATOR.md` 업로드
2. 이 파일(`SUMMARY.md`) + `HANDOFF.md` 업로드 → "이전 세션 유언, 브리핑해줘"
3. 수정 대상 파일만 추가 업로드 (전체 소스 불필요)
