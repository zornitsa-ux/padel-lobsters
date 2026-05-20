-- RBAC Phase 1: add per-player role column
--
-- Creates a player_role enum and adds a `role` column to players.
-- All existing players default to 'player'.
--
-- Admin players must be designated manually AFTER running this migration:
--   update public.players set role = 'admin' where name = '<admin name>';
--
-- There is no automated backfill because admin identity is currently a shared
-- bcrypt PIN in private.admin_secrets — it is not a per-player flag.

create type public.player_role as enum ('player', 'admin');

alter table public.players
  add column role public.player_role not null default 'player';

-- Expose role through the public view so clients can read it without direct
-- table access (players_public is the only anon-readable path to player rows).
create or replace view public.players_public as
  select
    id,
    name,
    status,
    gender,
    is_left_handed,
    preferred_position,
    country,
    tagline,
    tagline_label,
    playtomic_level,
    adjustment,
    adjusted_level,
    avatar_url,
    created_at,
    case when birthday is null then null::text
         else to_char(birthday::timestamptz, 'MM-DD')
    end as birthday_md,
    extract(month from birthday)::integer as birthday_month,
    extract(day from birthday)::integer as birthday_day,
    coalesce(pin_changes, 0) as pin_changes,
    learned_rating,
    learned_rd,
    learned_volatility,
    learned_matches_count,
    learned_updated_at,
    role
  from public.players;
