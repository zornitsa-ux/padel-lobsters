-- Matchmaking V2 rollout flag (PLAN M3.5, D-019 fork #1: silent V2 swap on the
-- Lobster path when on). Global, admin-toggled; a plain boolean column on the
-- single settings row, added the same way raffle_cooldown_tournaments was.
-- No new RLS needed: settings_admin_write covers any column; SELECT posture
-- unchanged (clients read the flag to branch the Lobster generate path).
-- Dropped at cutover (M4.3) alongside the legacy Lobster generator.

alter table public.settings
  add column if not exists matchmaking_v2_enabled boolean not null default false;
