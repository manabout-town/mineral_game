-- 0002_runs_replay_reason.sql
-- Phase 5-D: replay_reason 컬럼 추가 (리플레이 불일치 원인 코드 저장)

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS replay_reason text DEFAULT NULL;

COMMENT ON COLUMN public.runs.replay_reason IS
  'E_REPLAY_FOREIGN_ORE / E_REPLAY_CRYSTALS_OVERFLOW 등 리플레이 실패 원인 코드. ok이면 NULL.';
