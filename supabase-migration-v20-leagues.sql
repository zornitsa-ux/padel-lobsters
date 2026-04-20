-- ============================================================================
--  v20 — Lobster League (Phase 1+2): league + interest + team tables
--
--  Models a multi-week league alongside the existing single-day tournaments.
--
--    leagues            one row per league instance (Summer 2026, Winter 2026…)
--    league_interests   "I'm interested in playing" — one per player per league
--    league_teams       partnership rows: pending / confirmed / declined
--
--  Signup flow:
--    1. Player taps "Register interest" on the league page → row in
--       league_interests with status='looking'.
--    2. Player finds someone else in league_interests (same division) and
--       invites them → row in league_teams with status='pending'.
--    3. Invitee accepts → status='confirmed'. Both interest rows flip to
--       'matched' and their first-name list shows up on the page as
--       "Team <name>".
--
--  Idempotent — safe to re-run.
-- ============================================================================

create table if not exists leagues (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  description_md    text default '',
  signup_closes_at  timestamptz,
  starts_at         date,
  ends_at           date,
  status            text not null default 'signups_open',  -- signups_open | signups_closed | group_stage | playoffs | finished
  divisions         text[] default array['mens', 'womens'],
  created_at        timestamptz default now(),
  created_by        uuid references players(id) on delete set null
);

create table if not exists league_interests (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid references leagues(id) on delete cascade,
  player_id         uuid references players(id) on delete cascade,
  division          text not null,                           -- mens | womens | open
  experience_level  text not null,                           -- beginner | intermediate | advanced
  status            text not null default 'looking',         -- looking | matched | withdrawn
  created_at        timestamptz default now(),
  unique (league_id, player_id)
);

create index if not exists league_interests_by_league_division
  on league_interests (league_id, division, status);

create table if not exists league_teams (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid references leagues(id) on delete cascade,
  proposer_id       uuid references players(id) on delete cascade,
  invitee_id        uuid references players(id) on delete cascade,
  team_name         text not null,
  team_song         text default '',
  division          text not null,
  experience_level  text,
  status            text not null default 'pending',          -- pending | confirmed | declined | withdrawn
  created_at        timestamptz default now(),
  responded_at      timestamptz,
  check (proposer_id <> invitee_id)
);

create index if not exists league_teams_by_league      on league_teams (league_id, status);
create index if not exists league_teams_by_proposer   on league_teams (proposer_id, status);
create index if not exists league_teams_by_invitee    on league_teams (invitee_id, status);

-- Publish all three to realtime so the whole league page updates live as
-- invitations fly around and are accepted/declined.
do $$
begin
  begin alter publication supabase_realtime add table leagues;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table league_interests; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table league_teams;     exception when duplicate_object then null; end;
end $$;
