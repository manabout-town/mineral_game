-- Mineral Rush — initial schema (Phase 4 안티치트 + LiveOps 토대)
--
-- 적용 방법:
--   supabase login
--   supabase link --project-ref <your-project-ref>
--   supabase db push
--
-- 본 마이그레이션은 schema 변경에 해당하므로 PR에서 별도 리뷰 필수.

-- Players (auth.users 1:1)
create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  banned_at timestamptz,
  abuse_score integer not null default 0,
  -- 영구 진행 (schemaVersion 기반 마이그레이션 호환)
  schema_version integer not null default 1,
  meta jsonb not null default '{}'::jsonb,
  economy jsonb not null default '{}'::jsonb
);

create index if not exists idx_players_device_id on public.players (device_id);

-- Runs — 한 런 1행. 액션 리플레이 events 포함
create table if not exists public.runs (
  id text primary key,                            -- runId (클라가 발행)
  player_id uuid not null references public.players(id) on delete cascade,
  seed bigint not null,
  stage_id text not null,
  start_depth integer not null,
  duration_ms integer not null,
  started_at bigint not null,                     -- epoch ms (클라 시각)
  ended_at bigint,
  reason text,                                    -- 'timeout' | 'quit' | 'death'
  -- 클라 보고
  vein_count integer,
  damage_dealt numeric,
  cards_picked integer,
  ores_collected jsonb,
  reward_ores jsonb,
  reward_crystals integer,
  -- 서버 검증 결과 (Edge Function 채움)
  replay_status text not null default 'pending',  -- 'pending' | 'valid' | 'mismatch' | 'rejected'
  replay_diff text,                                -- 불일치 사유
  events jsonb,                                    -- 이벤트 배열 (감사용 보관, 30일 후 archival)
  events_count integer,                            -- 임계 검증용
  hmac_signature text,                             -- 클라이언트 측 서명
  client_version text,
  schema_version integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_runs_player on public.runs (player_id, created_at desc);
create index if not exists idx_runs_status on public.runs (replay_status);

-- Feature Flags — LiveOps. Phase 4에서 클라가 부팅 시 페치
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  payload jsonb,
  description text,
  updated_at timestamptz not null default now()
);

-- Maintenance — 점검 모드
create table if not exists public.maintenance (
  id smallint primary key default 1,
  enabled boolean not null default false,
  message_ko text,
  message_en text,
  min_supported_version text,                      -- 미만이면 강제 업데이트 안내
  updated_at timestamptz not null default now(),
  constraint maintenance_singleton check (id = 1)
);

insert into public.maintenance (id, enabled) values (1, false)
  on conflict (id) do nothing;

-- Leaderboard — 일/주/시즌별
create table if not exists public.leaderboard_entries (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  run_id text not null references public.runs(id) on delete cascade,
  category text not null,                          -- 'daily' | 'weekly' | 'season'
  bucket text not null,                            -- 일자 / 주 / 시즌
  score numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_leaderboard_lookup
  on public.leaderboard_entries (category, bucket, score desc);

-- ===== RLS =====

alter table public.players enable row level security;
alter table public.runs enable row level security;
alter table public.feature_flags enable row level security;
alter table public.maintenance enable row level security;
alter table public.leaderboard_entries enable row level security;

-- 본인 player row만 읽기/수정
drop policy if exists players_select_self on public.players;
create policy players_select_self on public.players
  for select using (auth.uid() = id);

drop policy if exists players_update_self on public.players;
create policy players_update_self on public.players
  for update using (auth.uid() = id);

-- 본인 run만 insert/select. mutation은 Edge Function에서만 (service_role)
drop policy if exists runs_select_self on public.runs;
create policy runs_select_self on public.runs
  for select using (auth.uid() = player_id);

drop policy if exists runs_insert_self on public.runs;
create policy runs_insert_self on public.runs
  for insert with check (auth.uid() = player_id);

-- feature flags / maintenance — 모두 read-only
drop policy if exists ff_read on public.feature_flags;
create policy ff_read on public.feature_flags
  for select using (true);

drop policy if exists maint_read on public.maintenance;
create policy maint_read on public.maintenance
  for select using (true);

-- 리더보드 — 누구나 읽기, insert는 Edge Function에서만
drop policy if exists lb_read on public.leaderboard_entries;
create policy lb_read on public.leaderboard_entries
  for select using (true);
