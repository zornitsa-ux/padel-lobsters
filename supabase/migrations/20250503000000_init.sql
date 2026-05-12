-- Padel Lobsters — baseline schema
-- Generated from production on 2025-05-03

-- ============================================================
-- 0. Extensions
-- ============================================================
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";

-- ============================================================
-- 1. Private schema
-- ============================================================
create schema if not exists private;

create table private.admin_secrets (
  id          integer primary key,
  admin_pin_hash text
);

-- ============================================================
-- 2. Public tables (dependency order)
-- ============================================================

-- players -----------------------------------------------------------------
create table public.players (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  email                 text,
  phone                 text,
  playtomic_level       numeric default 0,
  adjustment            numeric default 0,
  adjusted_level        numeric default 0,
  playtomic_username    text,
  notes                 text,
  created_at            timestamptz default now(),
  gender                text default '',
  status                text default 'active',
  is_left_handed        boolean default false,
  country               text,
  avatar_url            text default '',
  pin                   text default '',
  birthday              date,
  tagline               text,
  playtomic_updated_at  timestamptz,
  preferred_position    text,
  tagline_label         text default '',
  pin_hash              text,
  locked_until          timestamptz,
  pin_changes           integer not null default 0,
  learned_rating        numeric,
  learned_rd            numeric,
  learned_volatility    numeric,
  learned_matches_count integer not null default 0,
  learned_updated_at    timestamptz
);

comment on column public.players.learned_rating is
  'Glicko-2 rating on a 1200..1800 scale anchored to Playtomic: 1500 = Playtomic 3.0, +100 per Padel level. NULL means uncalibrated.';
comment on column public.players.learned_rd is
  'Glicko-2 rating deviation. ~350 = no info, ~80 = stable enough to use for matching.';

-- tournaments -------------------------------------------------------------
create table public.tournaments (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  date                date,
  time                text,
  max_players         integer default 16,
  format              text default 'americano',
  courts              jsonb default '[]'::jsonb,
  notes               text,
  status              text default 'upcoming',
  created_at          timestamptz default now(),
  location            text default '',
  court_booking_mode  text default 'admin_all',
  total_price         numeric default 0,
  tikkie_link         text default '',
  duration            integer default 90,
  gender_mode         text default 'mixed',
  prize_item_ids      integer[] default '{}',
  completed_at        timestamptz,
  ratings_applied_at  timestamptz
);

comment on column public.tournaments.ratings_applied_at is
  'Set when this tournament''s matches have been folded into player Glicko ratings.';

-- settings ----------------------------------------------------------------
create table public.settings (
  id               integer primary key default 1,
  whatsapp_link    text default '',
  group_name       text default 'Padel Lobsters',
  padel_tips       jsonb,
  auto_trust_until timestamptz default (now() + interval '21 days')
);

-- registrations -----------------------------------------------------------
create table public.registrations (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid references public.tournaments(id) on delete cascade,
  player_id       uuid references public.players(id) on delete cascade,
  status          text default 'registered',
  payment_status  text default 'unpaid',
  payment_method  text default '',
  created_at      timestamptz default now()
);

-- matches -----------------------------------------------------------------
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  round         integer default 1,
  court         text,
  team1_ids     uuid[] default '{}',
  team2_ids     uuid[] default '{}',
  team1_level   numeric default 0,
  team2_level   numeric default 0,
  score1        integer,
  score2        integer,
  completed     boolean default false,
  created_at    timestamptz default now()
);

-- merch_items -------------------------------------------------------------
create table public.merch_items (
  id              serial primary key,
  name            text not null,
  description     text default '',
  price           numeric default 0,
  sizes           text[] default '{}',
  image_url       text default '',
  category        text default 'apparel',
  active          boolean default true,
  created_at      timestamptz default now(),
  image_urls      jsonb default '[]'::jsonb,
  display_order   integer default 0,
  external_orders integer not null default 0
);

-- merch_interests ---------------------------------------------------------
create table public.merch_interests (
  id              serial primary key,
  player_id       text,
  merch_item_id   integer,
  size            text default '',
  created_at      timestamptz default now(),
  custom_name     text,
  paid            boolean default false,
  delivered       boolean default false,
  display_order   integer default 0,
  status          text default 'ordered',
  admin_comment   text default '',
  cancelled_at    timestamptz,
  unique (player_id, merch_item_id)
);

-- leagues -----------------------------------------------------------------
create table public.leagues (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  description_md        text default '',
  signup_closes_at      timestamptz,
  starts_at             date,
  ends_at               date,
  status                text not null default 'signups_open',
  divisions             text[] default array['mens','womens'],
  created_at            timestamptz default now(),
  created_by            uuid references public.players(id) on delete set null,
  group_stage_start     date,
  group_stage_end       date,
  quarters_start        date,
  quarters_end          date,
  semis_start           date,
  semis_end             date,
  finals_start          date,
  finals_end            date,
  description_sections  jsonb default '{}'::jsonb
);

-- league_interests --------------------------------------------------------
create table public.league_interests (
  id               uuid primary key default gen_random_uuid(),
  league_id        uuid not null references public.leagues(id) on delete cascade,
  player_id        uuid not null references public.players(id) on delete cascade,
  division         text not null,
  experience_level text not null,
  status           text not null default 'looking',
  created_at       timestamptz default now(),
  unique (league_id, player_id)
);

-- league_teams ------------------------------------------------------------
create table public.league_teams (
  id               uuid primary key default gen_random_uuid(),
  league_id        uuid not null references public.leagues(id) on delete cascade,
  proposer_id      uuid not null references public.players(id) on delete cascade,
  invitee_id       uuid not null references public.players(id) on delete cascade,
  team_name        text not null,
  team_song        text default '',
  division         text not null,
  experience_level text,
  status           text not null default 'pending',
  created_at       timestamptz default now(),
  responded_at     timestamptz,
  check (proposer_id <> invitee_id)
);

-- player_aliases ----------------------------------------------------------
create table public.player_aliases (
  historical_name text primary key,
  player_id       uuid references public.players(id) on delete cascade,
  created_at      timestamptz not null default now(),
  skipped         boolean not null default false,
  check ((player_id is not null) <> skipped)
);

-- pin_attempts ------------------------------------------------------------
create table public.pin_attempts (
  id            bigserial primary key,
  player_id     uuid,
  device_id     text,
  ip_address    inet,
  user_agent    text,
  attempt_kind  text not null check (attempt_kind = any(array[
    'player','admin','pii_dump','approve_device','admin_unlock','admin_action','signup','pin_reset'
  ])),
  succeeded     boolean not null,
  was_new_device boolean,
  attempted_at  timestamptz not null default now()
);

-- player_devices ----------------------------------------------------------
create table public.player_devices (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  device_id  text not null,
  user_agent text,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  trusted_at timestamptz,
  unique (player_id, device_id)
);

-- lobster_oscars_sessions -------------------------------------------------
create table public.lobster_oscars_sessions (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  started_at    timestamptz,
  closed_at     timestamptz,
  shared_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (tournament_id),
  check (
    (closed_at is null or started_at is not null)
    and (shared_at is null or closed_at is not null)
    and (started_at is null or closed_at is null or closed_at >= started_at)
    and (closed_at is null or shared_at is null or shared_at >= closed_at)
  )
);

comment on table public.lobster_oscars_sessions is
  'One Lobster Oscars voting session per tournament. Lifecycle: created → started → ended → shared.';

-- lobster_oscars_categories -----------------------------------------------
create table public.lobster_oscars_categories (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.lobster_oscars_sessions(id) on delete cascade,
  name          text not null check (length(btrim(name)) > 0),
  icon          text not null default '🦞',
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table public.lobster_oscars_categories is
  'Per-tournament Oscars categories (e.g., Best Smash, Best Outfit). Admin-editable before session starts.';

-- lobster_oscars_votes ----------------------------------------------------
create table public.lobster_oscars_votes (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.lobster_oscars_categories(id) on delete cascade,
  voter_id    uuid not null references public.players(id) on delete cascade,
  target_id   uuid not null references public.players(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (category_id, voter_id),
  check (voter_id <> target_id)
);

comment on table public.lobster_oscars_votes is
  'Votes cast in Lobster Oscars. One row per (category, voter); updates via upsert in RPC. Self-vote blocked at DB level.';

-- registration_transfers --------------------------------------------------
create table public.registration_transfers (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  from_player_id  uuid not null references public.players(id),
  to_player_id    uuid not null references public.players(id),
  status          text not null default 'pending' check (status = any(array[
    'pending','accepted','declined','cancelled','auto_closed'
  ])),
  closed_reason   text,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  closed_at       timestamptz,
  check (from_player_id <> to_player_id)
);

-- tournament_reminders_sent -----------------------------------------------
create table public.tournament_reminders_sent (
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  sent_at        timestamptz not null default now(),
  net_request_id bigint,
  status         text not null default 'queued' check (status = any(array[
    'queued','sent','failed','skipped_no_email'
  ])),
  error          text,
  primary key (tournament_id, player_id)
);

comment on table public.tournament_reminders_sent is
  'One row per (tournament_id, player_id) for whom a 48h reminder has been queued or sent. Used for idempotency.';

-- ============================================================
-- 3. Indexes
-- ============================================================
create index player_aliases_player_id_idx on public.player_aliases using btree (player_id);

create index league_interests_by_league_division on public.league_interests using btree (league_id, division, status);
create index league_teams_by_league on public.league_teams using btree (league_id, status);
create index league_teams_by_proposer on public.league_teams using btree (proposer_id, status);
create index league_teams_by_invitee on public.league_teams using btree (invitee_id, status);

create index player_devices_by_player on public.player_devices using btree (player_id);
create index player_devices_by_device on public.player_devices using btree (device_id);

create index pin_attempts_by_device_time on public.pin_attempts using btree (device_id, attempted_at desc);
create index pin_attempts_by_player_time on public.pin_attempts using btree (player_id, attempted_at desc) where player_id is not null;
create index pin_attempts_recent_failures on public.pin_attempts using btree (attempted_at desc) where succeeded = false;

create index lobster_oscars_categories_session_idx on public.lobster_oscars_categories using btree (session_id, display_order);
create index lobster_oscars_votes_voter_idx on public.lobster_oscars_votes using btree (voter_id);
create index lobster_oscars_votes_target_idx on public.lobster_oscars_votes using btree (category_id, target_id);

create unique index registration_transfers_one_pending_per_from on public.registration_transfers using btree (tournament_id, from_player_id) where status = 'pending';
create index registration_transfers_to_player_pending on public.registration_transfers using btree (to_player_id) where status = 'pending';
create index registration_transfers_tournament_pending on public.registration_transfers using btree (tournament_id) where status = 'pending';

-- ============================================================
-- 4. Trigger functions
-- ============================================================

create or replace function public.sync_player_pin_hash()
returns trigger language plpgsql
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  if NEW.pin is not null and NEW.pin <> '' then
    if TG_OP = 'INSERT' then
      NEW.pin_hash := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 6));
    elsif NEW.pin is distinct from OLD.pin then
      NEW.pin_hash    := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 6));
      NEW.pin_changes := coalesce(OLD.pin_changes, 0) + 1;
    end if;
  end if;
  return NEW;
end
$function$;

create or replace function public.lobster_oscars_set_updated_at()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  NEW.updated_at := now();
  return NEW;
end;
$function$;

-- ============================================================
-- 5. Triggers
-- ============================================================
create trigger trg_sync_player_pin_hash
  before insert or update of pin on public.players
  for each row execute function public.sync_player_pin_hash();

create trigger lobster_oscars_votes_updated_at
  before update on public.lobster_oscars_votes
  for each row execute function public.lobster_oscars_set_updated_at();

-- ============================================================
-- 6. Views
-- ============================================================

create or replace view public.players_public as
select
  id, name, status, gender, is_left_handed, preferred_position, country,
  tagline, tagline_label, playtomic_level, adjustment, adjusted_level,
  avatar_url, created_at,
  case when birthday is null then null::text
       else to_char(birthday::timestamptz, 'MM-DD')
  end as birthday_md,
  extract(month from birthday)::integer as birthday_month,
  extract(day from birthday)::integer as birthday_day,
  coalesce(pin_changes, 0) as pin_changes,
  learned_rating, learned_rd, learned_volatility,
  learned_matches_count, learned_updated_at
from public.players;

create or replace view public.public_tournament_registration_counts as
select
  tournament_id,
  count(*) filter (where status = 'registered')::integer as registered_count,
  count(*) filter (where status = 'cancelled')::integer as cancelled_count,
  count(*)::integer as total_count
from public.registrations
where tournament_id is not null
group by tournament_id;

-- ============================================================
-- 7. Public SECURITY DEFINER functions
-- ============================================================

create or replace function public.verify_admin_pin(input_pin text)
returns boolean language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare hash text;
begin
  if input_pin is null or length(input_pin) < 4 then return false; end if;
  select admin_pin_hash into hash from private.admin_secrets where id = 1 limit 1;
  if hash is null then return false; end if;
  return hash = extensions.crypt(input_pin, hash);
end
$function$;

create or replace function public.verify_admin_pin_v2(input_pin text, input_device_id text, input_user_agent text default null)
returns table(is_admin boolean, status text) language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_failures_24h int; c_max_per_device_24h constant int := 5;
begin
  set local statement_timeout = '30s';
  if input_pin is null or length(input_pin) < 4 or input_device_id is null then
    return query select false, 'wrong_pin'::text; return;
  end if;
  select count(*) into v_failures_24h from public.pin_attempts
   where device_id = input_device_id and succeeded = false and attempt_kind = 'admin'
     and attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_per_device_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'admin', false);
    return query select false, 'rate_limited'::text; return;
  end if;
  if not public.verify_admin_pin(input_pin) then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'admin', false);
    return query select false, 'wrong_pin'::text; return;
  end if;
  insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
  values (input_device_id, input_user_agent, 'admin', true);
  return query select true, 'ok'::text;
end $function$;

create or replace function public.verify_player_pin(input_pin text)
returns uuid language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare found_id uuid;
begin
  set local statement_timeout = '30s';
  if input_pin is null or length(input_pin) < 4 then return null; end if;
  select id into found_id from public.players
   where pin is not null and pin = input_pin and coalesce(status, 'active') = 'active' limit 1;
  if found_id is not null then return found_id; end if;
  select id into found_id from public.players
   where pin_hash is not null and pin_hash = crypt(input_pin, pin_hash)
     and coalesce(status, 'active') = 'active' limit 1;
  return found_id;
end;
$function$;

create or replace function public.verify_player_pin_v2(input_pin text, input_device_id text, input_user_agent text default null)
returns table(player_id uuid, is_new_device boolean, trusted boolean, status text) language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_player_id uuid; v_attached_player uuid; v_is_known_device boolean;
  v_is_trusted boolean; v_failures_24h int; v_failures_since_ok int;
  v_existing_trusted_count int; v_auto_trust_until timestamptz;
  c_max_per_device_24h constant int := 10; c_strikes_known_dev constant int := 5;
  c_lockout constant interval := '24 hours';
begin
  set local statement_timeout = '30s';
  if input_pin is null or length(input_pin) < 4 or input_device_id is null then
    return query select null::uuid, false, false, 'wrong_pin'::text; return;
  end if;
  select count(*) into v_failures_24h from public.pin_attempts pa
   where pa.device_id = input_device_id and pa.succeeded = false and pa.attempt_kind = 'player'
     and pa.attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_per_device_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, false, false, 'rate_limited'::text; return;
  end if;
  select p.id into v_player_id from public.players p
   where p.pin_hash is not null and p.pin_hash = extensions.crypt(input_pin, p.pin_hash)
     and coalesce(p.status,'active') = 'active' limit 1;
  if v_player_id is null then
    select pd.player_id into v_attached_player from public.player_devices pd
     where pd.device_id = input_device_id order by pd.last_seen desc limit 1;
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_attached_player, input_device_id, input_user_agent, 'player', false);
    if v_attached_player is not null then
      select count(*) into v_failures_since_ok from public.pin_attempts pa
       where pa.device_id = input_device_id and pa.player_id = v_attached_player
         and pa.succeeded = false and pa.attempt_kind = 'player'
         and pa.attempted_at > coalesce(
           (select max(pa2.attempted_at) from public.pin_attempts pa2
             where pa2.device_id = input_device_id and pa2.player_id = v_attached_player
               and pa2.succeeded = true and pa2.attempt_kind = 'player'),
           '1900-01-01'::timestamptz);
      if v_failures_since_ok >= c_strikes_known_dev then
        update public.players set locked_until = now() + c_lockout where id = v_attached_player;
      end if;
    end if;
    return query select null::uuid, false, false, 'wrong_pin'::text; return;
  end if;
  if exists (select 1 from public.players p where p.id = v_player_id and p.locked_until is not null and p.locked_until > now()) then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_player_id, input_device_id, input_user_agent, 'player', false);
    return query select null::uuid, false, false, 'locked'::text; return;
  end if;
  v_is_known_device := exists (
    select 1 from public.player_devices pd where pd.player_id = v_player_id and pd.device_id = input_device_id);
  insert into public.player_devices(player_id, device_id, user_agent)
  values (v_player_id, input_device_id, input_user_agent)
  on conflict (player_id, device_id) do update set last_seen = now(), user_agent = excluded.user_agent;
  select count(*) into v_existing_trusted_count from public.player_devices pd
   where pd.player_id = v_player_id and pd.trusted_at is not null;
  if v_existing_trusted_count = 0 then
    select s.auto_trust_until into v_auto_trust_until from public.settings s where s.id = 1 limit 1;
    if v_auto_trust_until is not null and v_auto_trust_until > now() then
      update public.player_devices pd set trusted_at = now()
       where pd.player_id = v_player_id and pd.device_id = input_device_id;
    end if;
  end if;
  select pd.trusted_at is not null into v_is_trusted from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_device_id;
  update public.players set locked_until = null where id = v_player_id;
  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded, was_new_device)
  values (v_player_id, input_device_id, input_user_agent, 'player', true, not v_is_known_device);
  return query select v_player_id, not v_is_known_device, coalesce(v_is_trusted, false), 'ok'::text;
end
$function$;

create or replace function public.is_my_device_trusted(input_player_id uuid, input_device_id text)
returns boolean language sql stable security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select exists (select 1 from public.player_devices
                  where player_id = input_player_id and device_id = input_device_id and trusted_at is not null);
$function$;

create or replace function public.tournament_start_ts(input_tournament_id uuid)
returns timestamptz language sql stable security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
  select (t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp
         at time zone 'Europe/Amsterdam'
    from public.tournaments t where t.id = input_tournament_id
$function$;

-- admin_add_player
create or replace function public.admin_add_player(input_admin_pin text, input_payload jsonb, input_device_id text default null, input_user_agent text default null)
returns setof players language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare v_new_pin text; v_inserted public.players%rowtype;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return; end if;
  if input_payload is null then return; end if;
  for i in 1..10 loop
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.players p where p.pin = v_new_pin and coalesce(p.status,'active') = 'active'
    );
  end loop;
  insert into public.players(name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
    preferred_position, tagline_label, pin)
  values (
    coalesce(input_payload->>'name', ''),
    coalesce(input_payload->>'email', ''),
    coalesce(input_payload->>'phone', ''),
    coalesce(input_payload->>'notes', ''),
    coalesce((input_payload->>'playtomic_level')::numeric, 0),
    coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce((input_payload->>'playtomic_level')::numeric, 0) + coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce(input_payload->>'playtomic_username', ''),
    coalesce(input_payload->>'gender', ''),
    coalesce(input_payload->>'status', 'active'),
    coalesce((input_payload->>'is_left_handed')::boolean, false),
    coalesce(input_payload->>'country', ''),
    coalesce(input_payload->>'avatar_url', ''),
    nullif(input_payload->>'birthday', '')::date,
    coalesce(input_payload->>'preferred_position', ''),
    coalesce(input_payload->>'tagline_label', ''),
    v_new_pin
  ) returning * into v_inserted;
  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_inserted.id, input_device_id, input_user_agent, 'admin_action', true);
  if v_inserted.email is not null and length(trim(v_inserted.email)) > 3 then
    perform private.send_pin_email(v_inserted.id, v_new_pin, 'new_signup');
  end if;
  return next v_inserted;
end $function$;

-- admin_approve_device
create or replace function public.admin_approve_device(input_admin_pin text, input_target_player uuid, input_target_device text)
returns text language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_did_update boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return 'denied'; end if;
  if input_target_player is null or input_target_device is null then return 'denied'; end if;
  with upd as (
    update public.player_devices set trusted_at = now()
     where player_id = input_target_player and device_id = input_target_device and trusted_at is null returning 1
  ) select exists(select 1 from upd) into v_did_update;
  if not v_did_update then return 'no_such_device'; end if;
  insert into public.pin_attempts(player_id, device_id, attempt_kind, succeeded)
  values (input_target_player, input_target_device, 'admin_action', true);
  return 'ok';
end $function$;

-- admin_cancel_transfer
create or replace function public.admin_cancel_transfer(input_admin_pin text, input_device_id text, input_transfer_id uuid, input_user_agent text default null)
returns table(status text) language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_admin_ok boolean; v_xfer public.registration_transfers%rowtype;
begin
  set local statement_timeout = '30s';
  select va.is_admin into v_admin_ok
    from public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) va limit 1;
  if not coalesce(v_admin_ok, false) then return query select 'wrong_admin_pin'::text; return; end if;
  select * into v_xfer from public.registration_transfers where id = input_transfer_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_xfer.status <> 'pending' then return query select 'not_pending'::text; return; end if;
  update public.registration_transfers
     set status = 'cancelled', closed_reason = 'admin_cancel', closed_at = now()
   where id = v_xfer.id;
  return query select 'cancelled'::text;
end $function$;

-- admin_change_pin
create or replace function public.admin_change_pin(input_current_pin text, input_new_pin text, input_device_id text default null, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
begin
  set local statement_timeout = '30s';
  if input_new_pin is null or length(input_new_pin) < 4 then return 'invalid_new'; end if;
  if input_new_pin !~ '^[0-9]+$' then return 'invalid_new'; end if;
  if not public.verify_admin_pin(input_current_pin) then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'admin', false);
    return 'wrong_current';
  end if;
  update private.admin_secrets
     set admin_pin_hash = extensions.crypt(input_new_pin, extensions.gen_salt('bf', 10))
   where id = 1;
  insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
  values (input_device_id, input_user_agent, 'admin_action', true);
  return 'ok';
end
$function$;

-- admin_delete_player
create or replace function public.admin_delete_player(input_admin_pin text, input_target_id uuid, input_device_id text default null, input_user_agent text default null)
returns boolean language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare v_did_delete boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return false; end if;
  if input_target_id is null then return false; end if;
  with del as (
    delete from public.players p where p.id = input_target_id returning 1
  ) select exists(select 1 from del) into v_did_delete;
  if v_did_delete then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (input_target_id, input_device_id, input_user_agent, 'admin_action', true);
  end if;
  return v_did_delete;
end $function$;

-- admin_deny_device
create or replace function public.admin_deny_device(input_admin_pin text, input_target_player uuid, input_target_device text)
returns text language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_did_delete boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return 'denied'; end if;
  if input_target_player is null or input_target_device is null then return 'denied'; end if;
  with del as (
    delete from public.player_devices
     where player_id = input_target_player and device_id = input_target_device and trusted_at is null returning 1
  ) select exists(select 1 from del) into v_did_delete;
  if not v_did_delete then return 'no_such_device'; end if;
  insert into public.pin_attempts(player_id, device_id, attempt_kind, succeeded)
  values (input_target_player, input_target_device, 'admin_action', false);
  return 'ok';
end $function$;

-- admin_force_accept_transfer
create or replace function public.admin_force_accept_transfer(input_admin_pin text, input_device_id text, input_transfer_id uuid, input_user_agent text default null)
returns table(status text) language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_admin_ok boolean; v_xfer public.registration_transfers%rowtype; v_started boolean;
begin
  set local statement_timeout = '30s';
  select va.is_admin into v_admin_ok
    from public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) va limit 1;
  if not coalesce(v_admin_ok, false) then return query select 'wrong_admin_pin'::text; return; end if;
  select * into v_xfer from public.registration_transfers where id = input_transfer_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_xfer.status <> 'pending' then return query select 'not_pending'::text; return; end if;
  v_started := public.tournament_start_ts(v_xfer.tournament_id) <= now();
  if coalesce(v_started, true) then
    update public.registration_transfers
       set status = 'auto_closed', closed_reason = 'tournament_started', closed_at = now()
     where id = v_xfer.id;
    return query select 'tournament_started'::text; return;
  end if;
  update public.registrations
     set status = 'cancelled', payment_method = 'transferred_to:' || v_xfer.to_player_id::text
   where tournament_id = v_xfer.tournament_id and player_id = v_xfer.from_player_id and status = 'registered';
  insert into public.registrations (tournament_id, player_id, status, payment_status, payment_method)
  values (v_xfer.tournament_id, v_xfer.to_player_id, 'registered', 'transferred',
    'transferred_from:' || v_xfer.from_player_id::text);
  update public.registration_transfers
     set status = 'accepted', responded_at = now(), closed_reason = 'admin_force_accept', closed_at = now()
   where id = v_xfer.id;
  return query select 'accepted'::text;
end $function$;

-- admin_list_pending_devices
create or replace function public.admin_list_pending_devices(input_admin_pin text)
returns table(player_id uuid, player_name text, device_id text, user_agent text, first_seen timestamptz, last_seen timestamptz)
language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return; end if;
  return query select p.id, p.name, pd.device_id, pd.user_agent, pd.first_seen, pd.last_seen
    from public.player_devices pd join public.players p on p.id = pd.player_id
    where pd.trusted_at is null order by pd.first_seen desc;
end $function$;

-- admin_list_security_events
create or replace function public.admin_list_security_events(input_admin_pin text, input_limit integer default 100)
returns table(id bigint, player_id uuid, player_name text, device_id text, user_agent text, attempt_kind text, succeeded boolean, was_new_device boolean, attempted_at timestamptz)
language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return; end if;
  return query select pa.id, pa.player_id, p.name, pa.device_id, pa.user_agent, pa.attempt_kind, pa.succeeded, pa.was_new_device, pa.attempted_at
    from public.pin_attempts pa left join public.players p on p.id = pa.player_id
    order by pa.attempted_at desc limit greatest(1, least(input_limit, 500));
end $function$;

-- admin_regenerate_pin
create or replace function public.admin_regenerate_pin(input_admin_pin text, input_target_id uuid, input_device_id text default null, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare v_new_pin text; v_updated boolean := false; v_email text;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return null; end if;
  if input_target_id is null then return null; end if;
  for i in 1..10 loop
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.players p where p.pin = v_new_pin and p.id <> input_target_id and coalesce(p.status,'active') = 'active'
    );
  end loop;
  with upd as (
    update public.players p set pin = v_new_pin where p.id = input_target_id returning p.email
  ) select email into v_email from upd;
  v_updated := v_email is distinct from null or v_email is null and exists (
    select 1 from public.players where id = input_target_id
  );
  if not v_updated then return null; end if;
  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (input_target_id, input_device_id, input_user_agent, 'admin_action', true);
  if v_email is not null and length(trim(v_email)) > 3 then
    perform private.send_pin_email(input_target_id, v_new_pin, 'regenerated');
  end if;
  return v_new_pin;
end $function$;

-- admin_unlock_player
create or replace function public.admin_unlock_player(input_admin_pin text, input_target_player uuid, input_target_device text default null, input_admin_device_id text default null)
returns text language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return 'denied'; end if;
  if input_target_player is null then return 'denied'; end if;
  update public.players set locked_until = null where id = input_target_player;
  if input_target_device is not null then
    insert into public.player_devices(player_id, device_id, trusted_at)
    values (input_target_player, input_target_device, now())
    on conflict (player_id, device_id) do update
      set trusted_at = coalesce(public.player_devices.trusted_at, now());
  end if;
  insert into public.pin_attempts(player_id, device_id, attempt_kind, succeeded)
  values (input_target_player, input_admin_device_id, 'admin_unlock', true);
  return 'ok';
end $function$;

-- admin_update_player
create or replace function public.admin_update_player(input_admin_pin text, input_target_id uuid, input_payload jsonb, input_device_id text default null, input_user_agent text default null)
returns boolean language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare v_updated boolean := false;
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return false; end if;
  if input_target_id is null or input_payload is null then return false; end if;
  with upd as (
    update public.players p set
      name = coalesce(input_payload->>'name', p.name),
      email = coalesce(input_payload->>'email', p.email),
      phone = coalesce(input_payload->>'phone', p.phone),
      notes = coalesce(input_payload->>'notes', p.notes),
      playtomic_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level),
      adjustment = coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      adjusted_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level)
                      + coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      playtomic_username = coalesce(input_payload->>'playtomic_username', p.playtomic_username),
      gender = coalesce(input_payload->>'gender', p.gender),
      status = coalesce(input_payload->>'status', p.status),
      is_left_handed = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      country = coalesce(input_payload->>'country', p.country),
      avatar_url = coalesce(input_payload->>'avatar_url', p.avatar_url),
      birthday = coalesce(nullif(input_payload->>'birthday', '')::date, p.birthday),
      preferred_position = coalesce(input_payload->>'preferred_position', p.preferred_position),
      tagline = coalesce(input_payload->>'tagline', p.tagline),
      tagline_label = coalesce(input_payload->>'tagline_label', p.tagline_label),
      playtomic_updated_at = case when (input_payload ? 'playtomic_level') then now() else p.playtomic_updated_at end
    where p.id = input_target_id returning 1
  ) select exists(select 1 from upd) into v_updated;
  if v_updated then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (input_target_id, input_device_id, input_user_agent, 'admin_action', true);
  end if;
  return v_updated;
end $function$;

-- approve_device
create or replace function public.approve_device(input_pin text, input_requesting_device_id text, input_target_device_id text)
returns text language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_player_id uuid; v_caller_trusted boolean; v_target_exists boolean;
begin
  set local statement_timeout = '30s';
  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null or input_requesting_device_id is null or input_target_device_id is null then return 'denied'; end if;
  select pd.trusted_at is not null into v_caller_trusted from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_requesting_device_id;
  if not coalesce(v_caller_trusted, false) then return 'denied'; end if;
  select exists (select 1 from public.player_devices where player_id = v_player_id and device_id = input_target_device_id) into v_target_exists;
  if not v_target_exists then return 'no_such_device'; end if;
  update public.player_devices set trusted_at = now()
   where player_id = v_player_id and device_id = input_target_device_id and trusted_at is null;
  insert into public.pin_attempts(player_id, device_id, attempt_kind, succeeded, was_new_device)
  values (v_player_id, input_target_device_id, 'approve_device', true, false);
  return 'ok';
end $function$;

-- reject_device
create or replace function public.reject_device(input_pin text, input_requesting_device_id text, input_target_device_id text)
returns text language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare v_player_id uuid; v_caller_trusted boolean; v_target_exists boolean;
begin
  set local statement_timeout = '30s';
  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null or input_requesting_device_id is null or input_target_device_id is null then return 'denied'; end if;
  select pd.trusted_at is not null into v_caller_trusted from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_requesting_device_id;
  if not coalesce(v_caller_trusted, false) then return 'denied'; end if;
  select exists (
    select 1 from public.player_devices pd2
     where pd2.player_id = v_player_id and pd2.device_id = input_target_device_id and pd2.trusted_at is null
  ) into v_target_exists;
  if not v_target_exists then return 'no_such_device'; end if;
  delete from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_target_device_id and pd.trusted_at is null;
  insert into public.pin_attempts(player_id, device_id, attempt_kind, succeeded, was_new_device)
  values (v_player_id, input_target_device_id, 'approve_device', false, false);
  return 'ok';
end $function$;

-- list_pending_devices
create or replace function public.list_pending_devices(input_pin text, input_requesting_device_id text)
returns table(device_id text, user_agent text, first_seen timestamptz, last_seen timestamptz)
language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_player_id uuid; v_caller_trusted boolean;
begin
  set local statement_timeout = '30s';
  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null or input_requesting_device_id is null then return; end if;
  select pd.trusted_at is not null into v_caller_trusted from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_requesting_device_id;
  if not coalesce(v_caller_trusted, false) then return; end if;
  return query select pd.device_id, pd.user_agent, pd.first_seen, pd.last_seen
                 from public.player_devices pd
                where pd.player_id = v_player_id and pd.trusted_at is null
                order by pd.first_seen desc;
end $function$;

-- get_my_profile_v2
create or replace function public.get_my_profile_v2(input_pin text, input_device_id text)
returns setof players language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_player_id uuid; v_is_trusted boolean;
begin
  set local statement_timeout = '30s';
  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null or input_device_id is null then return; end if;
  select pd.trusted_at is not null into v_is_trusted from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_device_id;
  if not coalesce(v_is_trusted, false) then return; end if;
  return query select * from public.players where id = v_player_id;
end $function$;

-- get_all_players_with_pii_v2
create or replace function public.get_all_players_with_pii_v2(input_admin_pin text, input_device_id text, input_user_agent text default null)
returns setof players language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_failures_24h int; v_dumps_today int;
        c_max_fail_24h constant int := 5; c_max_dumps_24h constant int := 3;
begin
  set local statement_timeout = '30s';
  if input_admin_pin is null or length(input_admin_pin) < 4 or input_device_id is null then return; end if;
  select count(*) into v_failures_24h from public.pin_attempts
   where device_id = input_device_id and succeeded = false and attempt_kind = 'admin'
     and attempted_at > now() - interval '24 hours';
  if v_failures_24h >= c_max_fail_24h then return; end if;
  if not public.verify_admin_pin(input_admin_pin) then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'admin', false);
    return;
  end if;
  select count(*) into v_dumps_today from public.pin_attempts
   where attempt_kind = 'pii_dump' and succeeded = true
     and attempted_at > now() - interval '24 hours';
  if v_dumps_today >= c_max_dumps_24h then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'pii_dump', false);
    return;
  end if;
  insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
  values (input_device_id, input_user_agent, 'pii_dump', true);
  return query select * from public.players order by name;
end $function$;

-- update_my_profile
create or replace function public.update_my_profile(input_pin text, input_device_id text, input_payload jsonb)
returns boolean language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare v_player_id uuid; v_is_trusted boolean; v_updated boolean := false;
begin
  set local statement_timeout = '30s';
  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null or input_device_id is null or input_payload is null then return false; end if;
  select pd.trusted_at is not null into v_is_trusted from public.player_devices pd
   where pd.player_id = v_player_id and pd.device_id = input_device_id;
  if not coalesce(v_is_trusted, false) then return false; end if;
  with upd as (
    update public.players p set
      name = coalesce(input_payload->>'name', p.name),
      email = coalesce(input_payload->>'email', p.email),
      phone = coalesce(input_payload->>'phone', p.phone),
      birthday = coalesce(nullif(input_payload->>'birthday', '')::date, p.birthday),
      country = coalesce(input_payload->>'country', p.country),
      gender = coalesce(input_payload->>'gender', p.gender),
      is_left_handed = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      preferred_position = coalesce(input_payload->>'preferred_position', p.preferred_position),
      playtomic_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level),
      adjusted_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level) + p.adjustment,
      playtomic_username = coalesce(input_payload->>'playtomic_username', p.playtomic_username),
      tagline = coalesce(input_payload->>'tagline', p.tagline),
      tagline_label = coalesce(input_payload->>'tagline_label', p.tagline_label),
      avatar_url = coalesce(input_payload->>'avatar_url', p.avatar_url),
      playtomic_updated_at = case when (input_payload ? 'playtomic_level') then now() else p.playtomic_updated_at end
    where p.id = v_player_id returning 1
  ) select exists(select 1 from upd) into v_updated;
  return v_updated;
end $function$;

-- forgot_my_pin
create or replace function public.forgot_my_pin(input_email text, input_device_id text, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_player_id uuid; v_new_pin text; v_recent_resets int;
  c_max_per_player_24h constant int := 3;
begin
  set local statement_timeout = '30s';
  if input_email is null or trim(input_email) = ''
     or input_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'invalid'; end if;
  if input_device_id is null or trim(input_device_id) = '' then return 'invalid'; end if;
  select p.id into v_player_id from public.players p
   where lower(trim(p.email)) = lower(trim(input_email))
     and coalesce(p.status, 'active') = 'active' limit 1;
  if v_player_id is null then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'pin_reset', false);
    return 'contact_admin';
  end if;
  select count(*) into v_recent_resets from public.pin_attempts pa
   where pa.player_id = v_player_id and pa.attempt_kind = 'pin_reset'
     and pa.succeeded = true and pa.attempted_at > now() - interval '24 hours';
  if v_recent_resets >= c_max_per_player_24h then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_player_id, input_device_id, input_user_agent, 'pin_reset', false);
    return 'rate_limited';
  end if;
  v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
  update public.players
     set pin_hash = extensions.crypt(v_new_pin, extensions.gen_salt('bf', 6)),
         pin = null, locked_until = null,
         pin_changes = coalesce(pin_changes, 0) + 1
   where id = v_player_id;
  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_player_id, input_device_id, input_user_agent, 'pin_reset', true);
  perform private.send_pin_email(v_player_id, v_new_pin, 'forgot_reset');
  return 'sent';
end
$function$;

-- self_signup_player
create or replace function public.self_signup_player(input_payload jsonb, input_device_id text default null, input_user_agent text default null)
returns table(player_id uuid, pin text, was_existing boolean)
language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_name text; v_email text; v_phone text; v_existing_id uuid;
  v_recent_signups int; v_new_pin text; v_inserted public.players%rowtype;
  c_max_per_device_24h constant int := 5;
begin
  set local statement_timeout = '30s';
  if input_payload is null then raise exception 'missing payload' using errcode = '22023'; end if;
  v_name  := nullif(btrim(coalesce(input_payload->>'name', '')), '');
  v_email := nullif(btrim(lower(coalesce(input_payload->>'email', ''))), '');
  v_phone := nullif(btrim(coalesce(input_payload->>'phone', '')), '');
  if v_name is null or v_email is null then raise exception 'name and email are required' using errcode = '22023'; end if;
  if length(v_name) > 100 or length(v_email) > 200 then raise exception 'name or email too long' using errcode = '22023'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email' using errcode = '22023'; end if;
  if input_device_id is not null then
    select count(*) into v_recent_signups from public.pin_attempts pa
     where pa.device_id = input_device_id and pa.attempt_kind = 'signup'
       and pa.attempted_at > now() - interval '24 hours';
    if v_recent_signups >= c_max_per_device_24h then raise exception 'rate limited' using errcode = 'P0001'; end if;
  end if;
  select p.id into v_existing_id from public.players p
   where lower(coalesce(p.email,'')) = v_email and coalesce(p.status,'active') = 'active' limit 1;
  if v_existing_id is not null then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_existing_id, input_device_id, input_user_agent, 'signup', false);
    return query select null::uuid, null::text, true; return;
  end if;
  for i in 1..10 loop
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.players p where p.pin = v_new_pin and coalesce(p.status,'active') = 'active'
    );
  end loop;
  insert into public.players(
    name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed, country, avatar_url,
    birthday, preferred_position, tagline_label, pin
  ) values (
    v_name, v_email, coalesce(v_phone, ''),
    coalesce(input_payload->>'notes', ''),
    coalesce((input_payload->>'playtomic_level')::numeric, 0),
    coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce((input_payload->>'playtomic_level')::numeric, 0) + coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce(input_payload->>'playtomic_username', ''),
    coalesce(input_payload->>'gender', ''),
    'active',
    coalesce((input_payload->>'is_left_handed')::boolean, false),
    coalesce(input_payload->>'country', ''),
    coalesce(input_payload->>'avatar_url', ''),
    nullif(input_payload->>'birthday', '')::date,
    coalesce(input_payload->>'preferred_position', ''),
    coalesce(input_payload->>'tagline_label', ''),
    v_new_pin
  ) returning * into v_inserted;
  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_inserted.id, input_device_id, input_user_agent, 'signup', true);
  return query select v_inserted.id, v_inserted.pin, false;
end;
$function$;

-- create_transfer
create or replace function public.create_transfer(input_pin text, input_device_id text, input_to_player_id uuid, input_tournament_id uuid, input_user_agent text default null)
returns table(transfer_id uuid, status text) language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_from_player_id uuid; v_target_status text; v_existing_pending uuid;
  v_started boolean; v_new_id uuid;
begin
  set local statement_timeout = '30s';
  select v.player_id into v_from_player_id
    from public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) v
   where v.status = 'ok' limit 1;
  if v_from_player_id is null then return query select null::uuid, 'wrong_pin'::text; return; end if;
  if input_to_player_id is null or input_to_player_id = v_from_player_id then
    return query select null::uuid, 'invalid_target'::text; return;
  end if;
  if not exists (select 1 from public.players p where p.id = input_to_player_id and coalesce(p.status,'active') = 'active') then
    return query select null::uuid, 'invalid_target'::text; return;
  end if;
  if not exists (select 1 from public.registrations r
    where r.tournament_id = input_tournament_id and r.player_id = v_from_player_id and r.status = 'registered') then
    return query select null::uuid, 'not_registered'::text; return;
  end if;
  select r.status into v_target_status from public.registrations r
   where r.tournament_id = input_tournament_id and r.player_id = input_to_player_id and r.status = 'registered' limit 1;
  if v_target_status = 'registered' then
    return query select null::uuid, 'target_already_registered'::text; return;
  end if;
  v_started := public.tournament_start_ts(input_tournament_id) <= now();
  if coalesce(v_started, true) then return query select null::uuid, 'tournament_started'::text; return; end if;
  select rt.id into v_existing_pending from public.registration_transfers rt
   where rt.tournament_id = input_tournament_id and rt.from_player_id = v_from_player_id and rt.status = 'pending' limit 1;
  if v_existing_pending is not null then
    return query select v_existing_pending, 'already_pending'::text; return;
  end if;
  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (input_tournament_id, v_from_player_id, input_to_player_id) returning id into v_new_id;
  return query select v_new_id, 'ok'::text;
end $function$;

-- cancel_transfer
create or replace function public.cancel_transfer(input_pin text, input_device_id text, input_transfer_id uuid, input_user_agent text default null)
returns table(status text) language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_player_id uuid; v_xfer public.registration_transfers%rowtype;
begin
  set local statement_timeout = '30s';
  select v.player_id into v_player_id
    from public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) v
   where v.status = 'ok' limit 1;
  if v_player_id is null then return query select 'wrong_pin'::text; return; end if;
  select * into v_xfer from public.registration_transfers where id = input_transfer_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_xfer.from_player_id <> v_player_id then return query select 'forbidden'::text; return; end if;
  if v_xfer.status <> 'pending' then return query select 'not_pending'::text; return; end if;
  update public.registration_transfers
     set status = 'cancelled', closed_reason = 'from_player_cancel', closed_at = now()
   where id = v_xfer.id;
  return query select 'cancelled'::text;
end $function$;

-- respond_to_transfer
create or replace function public.respond_to_transfer(input_pin text, input_device_id text, input_transfer_id uuid, input_accept boolean, input_user_agent text default null)
returns table(status text) language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_to_player_id uuid; v_xfer public.registration_transfers%rowtype; v_started boolean;
begin
  set local statement_timeout = '30s';
  select v.player_id into v_to_player_id
    from public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) v
   where v.status = 'ok' limit 1;
  if v_to_player_id is null then return query select 'wrong_pin'::text; return; end if;
  select * into v_xfer from public.registration_transfers where id = input_transfer_id for update;
  if not found then return query select 'not_found'::text; return; end if;
  if v_xfer.to_player_id <> v_to_player_id then return query select 'forbidden'::text; return; end if;
  if v_xfer.status <> 'pending' then return query select 'not_pending'::text; return; end if;
  if input_accept is not true then
    update public.registration_transfers set status = 'declined', responded_at = now() where id = v_xfer.id;
    return query select 'declined'::text; return;
  end if;
  v_started := public.tournament_start_ts(v_xfer.tournament_id) <= now();
  if coalesce(v_started, true) then
    update public.registration_transfers
       set status = 'auto_closed', closed_reason = 'tournament_started', closed_at = now()
     where id = v_xfer.id;
    return query select 'tournament_started'::text; return;
  end if;
  update public.registrations
     set status = 'cancelled', payment_method = 'transferred_to:' || v_xfer.to_player_id::text
   where tournament_id = v_xfer.tournament_id and player_id = v_xfer.from_player_id and status = 'registered';
  insert into public.registrations (tournament_id, player_id, status, payment_status, payment_method)
  values (v_xfer.tournament_id, v_xfer.to_player_id, 'registered', 'transferred',
    'transferred_from:' || v_xfer.from_player_id::text);
  update public.registration_transfers set status = 'accepted', responded_at = now() where id = v_xfer.id;
  return query select 'accepted'::text;
end $function$;

-- get_transfer_recipient_phone
create or replace function public.get_transfer_recipient_phone(input_pin text, input_device_id text, input_transfer_id uuid, input_user_agent text default null)
returns table(name text, phone text, status text) language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_from_player_id uuid; v_xfer public.registration_transfers%rowtype;
  v_target_name text; v_target_phone text;
begin
  set local statement_timeout = '30s';
  select v.player_id into v_from_player_id
    from public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) v
   where v.status = 'ok' limit 1;
  if v_from_player_id is null then return query select null::text, null::text, 'wrong_pin'::text; return; end if;
  select * into v_xfer from public.registration_transfers where id = input_transfer_id;
  if not found then return query select null::text, null::text, 'not_found'::text; return; end if;
  if v_xfer.from_player_id <> v_from_player_id then return query select null::text, null::text, 'forbidden'::text; return; end if;
  if v_xfer.status <> 'pending' then return query select null::text, null::text, 'not_pending'::text; return; end if;
  select p.name, p.phone into v_target_name, v_target_phone from public.players p where p.id = v_xfer.to_player_id;
  return query select v_target_name, v_target_phone, 'ok'::text;
end $function$;

-- lobster_oscars_admin_upsert_categories
create or replace function public.lobster_oscars_admin_upsert_categories(input_admin_pin text, input_tournament_id uuid, input_categories jsonb, input_device_id text default null, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_is_admin BOOLEAN; v_session_id UUID; v_started_at TIMESTAMPTZ;
BEGIN
  SELECT a.is_admin INTO v_is_admin FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RETURN 'invalid_admin'; END IF;
  IF input_categories IS NULL OR jsonb_typeof(input_categories) <> 'array' OR jsonb_array_length(input_categories) < 1 THEN
    RETURN 'empty_categories';
  END IF;
  SELECT s.id, s.started_at INTO v_session_id, v_started_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN
    INSERT INTO public.lobster_oscars_sessions (tournament_id) VALUES (input_tournament_id) RETURNING id INTO v_session_id;
  ELSIF v_started_at IS NOT NULL THEN RETURN 'already_started'; END IF;
  DELETE FROM public.lobster_oscars_categories WHERE session_id = v_session_id;
  INSERT INTO public.lobster_oscars_categories (session_id, name, icon, display_order)
    SELECT v_session_id,
           COALESCE(NULLIF(btrim(elem->>'name'), ''), 'Untitled'),
           COALESCE(NULLIF(btrim(elem->>'icon'), ''), '🦞'),
           COALESCE((elem->>'display_order')::INTEGER, (ord - 1)::INTEGER)
      FROM jsonb_array_elements(input_categories) WITH ORDINALITY AS arr(elem, ord);
  RETURN 'ok';
END; $function$;

-- lobster_oscars_admin_start
create or replace function public.lobster_oscars_admin_start(input_admin_pin text, input_tournament_id uuid, input_device_id text default null, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_is_admin BOOLEAN; v_session_id UUID; v_started_at TIMESTAMPTZ; v_cat_count INTEGER;
BEGIN
  SELECT a.is_admin INTO v_is_admin FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RETURN 'invalid_admin'; END IF;
  SELECT s.id, s.started_at INTO v_session_id, v_started_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN RETURN 'no_session'; END IF;
  IF v_started_at IS NOT NULL THEN RETURN 'already_started'; END IF;
  SELECT count(*) INTO v_cat_count FROM public.lobster_oscars_categories WHERE session_id = v_session_id;
  IF v_cat_count = 0 THEN RETURN 'no_categories'; END IF;
  UPDATE public.lobster_oscars_sessions SET started_at = now() WHERE id = v_session_id;
  RETURN 'started';
END; $function$;

-- lobster_oscars_admin_end
create or replace function public.lobster_oscars_admin_end(input_admin_pin text, input_tournament_id uuid, input_device_id text default null, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_is_admin BOOLEAN; v_started_at TIMESTAMPTZ; v_closed_at TIMESTAMPTZ;
BEGIN
  SELECT a.is_admin INTO v_is_admin FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RETURN 'invalid_admin'; END IF;
  SELECT s.started_at, s.closed_at INTO v_started_at, v_closed_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'already_ended'; END IF;
  UPDATE public.lobster_oscars_sessions SET closed_at = now() WHERE tournament_id = input_tournament_id;
  RETURN 'ended';
END; $function$;

-- lobster_oscars_admin_share
create or replace function public.lobster_oscars_admin_share(input_admin_pin text, input_tournament_id uuid, input_device_id text default null, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_is_admin BOOLEAN; v_closed_at TIMESTAMPTZ; v_shared_at TIMESTAMPTZ;
BEGIN
  SELECT a.is_admin INTO v_is_admin FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RETURN 'invalid_admin'; END IF;
  SELECT s.closed_at, s.shared_at INTO v_closed_at, v_shared_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_closed_at IS NULL THEN RETURN 'not_ended'; END IF;
  IF v_shared_at IS NOT NULL THEN RETURN 'already_shared'; END IF;
  UPDATE public.lobster_oscars_sessions SET shared_at = now() WHERE tournament_id = input_tournament_id;
  RETURN 'shared';
END; $function$;

-- lobster_oscars_admin_get_session
create or replace function public.lobster_oscars_admin_get_session(input_admin_pin text, input_tournament_id uuid, input_device_id text default null, input_user_agent text default null)
returns table(session_id uuid, tournament_id uuid, started_at timestamptz, closed_at timestamptz, shared_at timestamptz, created_at timestamptz)
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_is_admin BOOLEAN;
BEGIN
  SELECT a.is_admin INTO v_is_admin FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001'; END IF;
  RETURN QUERY SELECT s.id, s.tournament_id, s.started_at, s.closed_at, s.shared_at, s.created_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
END; $function$;

-- lobster_oscars_admin_get_stats
create or replace function public.lobster_oscars_admin_get_stats(input_admin_pin text, input_tournament_id uuid, input_device_id text default null, input_user_agent text default null)
returns table(category_id uuid, category_name text, category_icon text, display_order integer, votes_count bigint, total_participants bigint)
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_is_admin BOOLEAN; v_session_id UUID; v_total_participants BIGINT;
BEGIN
  SELECT a.is_admin INTO v_is_admin FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001'; END IF;
  SELECT s.id INTO v_session_id FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_total_participants FROM public.registrations r
   WHERE r.tournament_id = input_tournament_id AND r.status = 'registered';
  RETURN QUERY
    SELECT c.id, c.name, c.icon, c.display_order, COALESCE(vc.cnt, 0::BIGINT), v_total_participants
      FROM public.lobster_oscars_categories c
      LEFT JOIN (SELECT v.category_id, count(*) AS cnt FROM public.lobster_oscars_votes v GROUP BY v.category_id) vc
        ON vc.category_id = c.id
     WHERE c.session_id = v_session_id ORDER BY c.display_order;
END; $function$;

-- lobster_oscars_admin_get_results
create or replace function public.lobster_oscars_admin_get_results(input_admin_pin text, input_tournament_id uuid, input_device_id text default null, input_user_agent text default null)
returns table(category_id uuid, category_name text, category_icon text, display_order integer, target_id uuid, target_name text, votes_count bigint, rank_in_category bigint)
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_is_admin BOOLEAN; v_session_id UUID; v_started_at TIMESTAMPTZ;
BEGIN
  SELECT a.is_admin INTO v_is_admin FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001'; END IF;
  SELECT s.id, s.started_at INTO v_session_id, v_started_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL OR v_started_at IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH counts AS (
    SELECT c.id AS cat_id, c.name AS cat_name, c.icon AS cat_icon, c.display_order AS cat_order,
           v.target_id AS tgt_id, p.name AS tgt_name, count(*)::BIGINT AS vc
      FROM public.lobster_oscars_categories c
      JOIN public.lobster_oscars_votes v ON v.category_id = c.id
      JOIN public.players p ON p.id = v.target_id
     WHERE c.session_id = v_session_id
     GROUP BY c.id, c.name, c.icon, c.display_order, v.target_id, p.name
  ), ranked AS (
    SELECT counts.*, rank() OVER (PARTITION BY cat_id ORDER BY vc DESC) AS rk FROM counts
  )
  SELECT cat_id, cat_name, cat_icon, cat_order, tgt_id, tgt_name, vc, rk
    FROM ranked ORDER BY cat_order, rk, tgt_name;
END; $function$;

-- lobster_oscars_admin_get_category_voters
create or replace function public.lobster_oscars_admin_get_category_voters(input_admin_pin text, input_category_id uuid, input_device_id text default null, input_user_agent text default null)
returns table(player_id uuid, player_name text, voted boolean)
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_is_admin BOOLEAN; v_tournament_id UUID;
BEGIN
  SELECT a.is_admin INTO v_is_admin
    FROM public.verify_admin_pin_v2(input_admin_pin, input_device_id, input_user_agent) a;
  IF NOT COALESCE(v_is_admin, false) THEN RAISE EXCEPTION 'invalid_admin' USING errcode = 'P0001'; END IF;
  SELECT s.tournament_id INTO v_tournament_id
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id
   WHERE c.id = input_category_id;
  IF v_tournament_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.name,
           EXISTS(SELECT 1 FROM public.lobster_oscars_votes v WHERE v.category_id = input_category_id AND v.voter_id = p.id) AS voted
      FROM public.players p
      JOIN public.registrations r ON r.player_id = p.id
     WHERE r.tournament_id = v_tournament_id AND r.status = 'registered'
     ORDER BY EXISTS(SELECT 1 FROM public.lobster_oscars_votes v
                      WHERE v.category_id = input_category_id AND v.voter_id = p.id) DESC, p.name ASC;
END; $function$;

-- lobster_oscars_cast_vote
create or replace function public.lobster_oscars_cast_vote(input_pin text, input_device_id text, input_category_id uuid, input_target_id uuid, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE
  v_voter_id UUID; v_pin_status TEXT; v_session_id UUID; v_tournament_id UUID;
  v_started_at TIMESTAMPTZ; v_closed_at TIMESTAMPTZ;
  v_voter_registered BOOLEAN; v_target_registered BOOLEAN; v_existed BOOLEAN;
BEGIN
  SELECT pp.player_id, pp.status INTO v_voter_id, v_pin_status
    FROM public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) pp;
  IF v_pin_status <> 'ok' OR v_voter_id IS NULL THEN RETURN 'invalid_pin'; END IF;
  IF v_voter_id = input_target_id THEN RETURN 'self_vote'; END IF;
  SELECT c.session_id, s.tournament_id, s.started_at, s.closed_at
    INTO v_session_id, v_tournament_id, v_started_at, v_closed_at
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id WHERE c.id = input_category_id;
  IF v_session_id IS NULL THEN RETURN 'invalid_category'; END IF;
  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.registrations r
    WHERE r.tournament_id = v_tournament_id AND r.player_id = v_voter_id AND r.status = 'registered') INTO v_voter_registered;
  IF NOT v_voter_registered THEN RETURN 'voter_not_registered'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.registrations r
    WHERE r.tournament_id = v_tournament_id AND r.player_id = input_target_id AND r.status = 'registered') INTO v_target_registered;
  IF NOT v_target_registered THEN RETURN 'invalid_target'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.lobster_oscars_votes WHERE category_id = input_category_id AND voter_id = v_voter_id) INTO v_existed;
  INSERT INTO public.lobster_oscars_votes (category_id, voter_id, target_id)
    VALUES (input_category_id, v_voter_id, input_target_id)
    ON CONFLICT (category_id, voter_id) DO UPDATE SET target_id = EXCLUDED.target_id, updated_at = now();
  RETURN CASE WHEN v_existed THEN 'updated' ELSE 'voted' END;
END; $function$;

-- lobster_oscars_clear_vote
create or replace function public.lobster_oscars_clear_vote(input_pin text, input_device_id text, input_category_id uuid, input_user_agent text default null)
returns text language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE
  v_voter_id UUID; v_pin_status TEXT;
  v_session_id UUID; v_started_at TIMESTAMPTZ; v_closed_at TIMESTAMPTZ;
  v_deleted INTEGER;
BEGIN
  SELECT pp.player_id, pp.status INTO v_voter_id, v_pin_status
    FROM public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) pp;
  IF v_pin_status <> 'ok' OR v_voter_id IS NULL THEN RETURN 'invalid_pin'; END IF;
  SELECT c.session_id, s.started_at, s.closed_at INTO v_session_id, v_started_at, v_closed_at
    FROM public.lobster_oscars_categories c
    JOIN public.lobster_oscars_sessions s ON s.id = c.session_id WHERE c.id = input_category_id;
  IF v_session_id IS NULL THEN RETURN 'invalid_category'; END IF;
  IF v_started_at IS NULL THEN RETURN 'not_started'; END IF;
  IF v_closed_at IS NOT NULL THEN RETURN 'closed'; END IF;
  WITH d AS (
    DELETE FROM public.lobster_oscars_votes WHERE category_id = input_category_id AND voter_id = v_voter_id RETURNING 1
  ) SELECT count(*) INTO v_deleted FROM d;
  IF v_deleted = 0 THEN RETURN 'no_vote'; END IF;
  RETURN 'cleared';
END; $function$;

-- lobster_oscars_get_my_votes
create or replace function public.lobster_oscars_get_my_votes(input_pin text, input_device_id text, input_tournament_id uuid, input_user_agent text default null)
returns table(category_id uuid, target_id uuid, target_name text, updated_at timestamptz)
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_voter_id UUID; v_pin_status TEXT; v_session_id UUID;
BEGIN
  SELECT pp.player_id, pp.status INTO v_voter_id, v_pin_status
    FROM public.verify_player_pin_v2(input_pin, input_device_id, input_user_agent) pp;
  IF v_pin_status <> 'ok' OR v_voter_id IS NULL THEN
    RAISE EXCEPTION 'invalid_pin' USING errcode = 'P0001';
  END IF;
  SELECT s.id INTO v_session_id FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT v.category_id, v.target_id, p.name, v.updated_at
      FROM public.lobster_oscars_votes v
      JOIN public.lobster_oscars_categories c ON c.id = v.category_id
      JOIN public.players p ON p.id = v.target_id
     WHERE c.session_id = v_session_id AND v.voter_id = v_voter_id
     ORDER BY c.display_order;
END; $function$;

-- lobster_oscars_get_results (public, no admin pin needed)
create or replace function public.lobster_oscars_get_results(input_tournament_id uuid)
returns table(category_id uuid, category_name text, category_icon text, display_order integer, target_id uuid, target_name text, votes_count bigint, rank_in_category bigint, total_voters bigint)
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE v_session_id UUID; v_shared_at TIMESTAMPTZ; v_total_voters BIGINT;
BEGIN
  SELECT s.id, s.shared_at INTO v_session_id, v_shared_at
    FROM public.lobster_oscars_sessions s WHERE s.tournament_id = input_tournament_id;
  IF v_session_id IS NULL OR v_shared_at IS NULL THEN RETURN; END IF;
  SELECT count(DISTINCT v.voter_id) INTO v_total_voters
    FROM public.lobster_oscars_votes v
    JOIN public.lobster_oscars_categories c ON c.id = v.category_id WHERE c.session_id = v_session_id;
  RETURN QUERY
  WITH counts AS (
    SELECT c.id AS cat_id, c.name AS cat_name, c.icon AS cat_icon, c.display_order AS cat_order,
           v.target_id AS tgt_id, p.name AS tgt_name, count(*)::BIGINT AS vc
      FROM public.lobster_oscars_categories c
      JOIN public.lobster_oscars_votes v ON v.category_id = c.id
      JOIN public.players p ON p.id = v.target_id WHERE c.session_id = v_session_id
     GROUP BY c.id, c.name, c.icon, c.display_order, v.target_id, p.name
  ), ranked AS (
    SELECT counts.*, rank() OVER (PARTITION BY cat_id ORDER BY vc DESC) AS rk FROM counts
  )
  SELECT cat_id, cat_name, cat_icon, cat_order, tgt_id, tgt_name, vc, rk, v_total_voters
    FROM ranked ORDER BY cat_order, rk, tgt_name;
END; $function$;

-- ============================================================
-- 8. Private functions
-- ============================================================

create or replace function private.first_name(input_name text)
returns text language sql immutable
set search_path to 'pg_catalog'
as $function$
  select coalesce(nullif(split_part(coalesce(input_name, ''), ' ', 1), ''), 'Lobster');
$function$;

create or replace function private.get_edge_service_role_key()
returns text language sql security definer
set search_path to 'pg_catalog', 'vault', 'extensions'
as $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'edge_send_pin_service_role' limit 1;
$function$;

create or replace function private.send_pin_email(input_player_id uuid, input_pin text, input_kind text)
returns bigint language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'net'
as $function$
declare
  v_email text; v_name text; v_key text;
  v_url text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-pin-email';
  v_request_id bigint;
begin
  if input_kind not in ('new_signup', 'regenerated', 'forgot_reset') then
    raise exception 'send_pin_email: invalid kind: %', input_kind;
  end if;
  if input_pin is null or input_pin !~ '^\d{4,8}$' then
    raise exception 'send_pin_email: invalid pin format';
  end if;
  select email, name into v_email, v_name from public.players where id = input_player_id limit 1;
  if v_email is null or length(trim(v_email)) < 3 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return null; end if;
  v_key := private.get_edge_service_role_key();
  if v_key is null then raise exception 'send_pin_email: vault secret edge_send_pin_service_role is missing'; end if;
  select net.http_post(
    url := v_url,
    body := jsonb_build_object('player_id', input_player_id::text, 'email', v_email, 'name', v_name, 'pin', input_pin, 'kind', input_kind),
    headers := jsonb_build_object('authorization', 'Bearer ' || v_key, 'content-type', 'application/json'),
    timeout_milliseconds := 5000
  ) into v_request_id;
  return v_request_id;
end;
$function$;

create or replace function private.auto_close_started_transfers()
returns integer language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare v_count int;
begin
  set local statement_timeout = '60s';
  with closed as (
    update public.registration_transfers rt
       set status = 'auto_closed', closed_reason = 'tournament_started', closed_at = now()
      from public.tournaments t
     where t.id = rt.tournament_id and rt.status = 'pending'
       and (t.date::text || ' ' || coalesce(t.time,'00:00'))::timestamp at time zone 'Europe/Amsterdam' <= now()
     returning rt.id
  ) select count(*) into v_count from closed;
  return v_count;
end $function$;

create or replace function private.send_tournament_reminders()
returns table(out_tournament_id uuid, out_tournament_name text, recipients_attempted integer, recipients_sent integer, recipients_failed integer, recipients_skipped integer)
language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'net'
as $function$
declare
  v_url_batch  text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-tournament-reminders-batch';
  v_url_report text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-tournament-reminder-report';
  v_chunk_size constant int := 4;
  v_chunk_pause constant numeric := 10.0;
  v_settle constant numeric := 15.0;
  v_key text; v_t record; v_recipients jsonb;
  v_chunk_total int; v_chunk_idx int; v_chunk_recipients jsonb;
  v_chunk_pids text[]; v_chunk_req bigint; v_results jsonb; v_item jsonb;
  v_total int; v_sent int; v_failed int; v_skipped int;
  v_failed_list jsonb; v_run_at timestamptz := now();
begin
  set local statement_timeout = '300s';
  v_key := private.get_edge_service_role_key();
  if v_key is null then raise exception 'send_tournament_reminders: vault secret missing'; end if;
  for v_t in
    select t.id, t.name, t.location,
      to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDay') as day_full,
      to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDy FMDD FMMonth, HH24:MI') as subject_date,
      to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDD FMMonth') as date_long,
      to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'HH24:MI') as time_hm
    from public.tournaments t
    where t.status = 'upcoming'
      and ((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam')
          between now() + interval '47 hours' and now() + interval '49 hours'
  loop
    insert into public.tournament_reminders_sent(tournament_id, player_id, status, sent_at, error)
    select v_t.id, p.id, 'skipped_no_email', now(), null
      from public.registrations r join public.players p on p.id = r.player_id
     where r.tournament_id = v_t.id and r.status = 'registered'
       and (p.email is null or length(trim(p.email)) < 3 or p.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
       and not exists (select 1 from public.tournament_reminders_sent s
         where s.tournament_id = v_t.id and s.player_id = p.id and s.status in ('sent', 'skipped_no_email'))
    on conflict (tournament_id, player_id) do update set status = 'skipped_no_email', sent_at = now(), error = null;
    select coalesce(jsonb_agg(jsonb_build_object(
             'player_id', p.id::text, 'first_name', private.first_name(p.name), 'email', p.email
           )), '[]'::jsonb) into v_recipients
      from public.registrations r join public.players p on p.id = r.player_id
     where r.tournament_id = v_t.id and r.status = 'registered'
       and p.email is not null and length(trim(p.email)) >= 3
       and p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       and not exists (select 1 from public.tournament_reminders_sent s
         where s.tournament_id = v_t.id and s.player_id = p.id and s.status in ('sent', 'skipped_no_email'));
    if jsonb_array_length(v_recipients) = 0 then continue; end if;
    v_chunk_total := ceil(jsonb_array_length(v_recipients)::numeric / v_chunk_size)::int;
    for v_chunk_idx in 0 .. v_chunk_total - 1 loop
      select coalesce(jsonb_agg(rec ORDER BY ord), '[]'::jsonb) into v_chunk_recipients
        from jsonb_array_elements(v_recipients) WITH ORDINALITY AS t(rec, ord)
       where ord > v_chunk_idx * v_chunk_size and ord <= (v_chunk_idx + 1) * v_chunk_size;
      select array_agg(rec ->> 'player_id') into v_chunk_pids from jsonb_array_elements(v_chunk_recipients) AS rec;
      insert into public.tournament_reminders_sent(tournament_id, player_id, status, sent_at, error)
      select v_t.id, pid::uuid, 'queued', now(), null from unnest(v_chunk_pids) AS pid
      on conflict (tournament_id, player_id) do update set status = 'queued', sent_at = now(), error = null;
      select net.http_post(
        url := v_url_batch,
        body := jsonb_build_object(
          'tournament_id', v_t.id::text, 'tournament_name', v_t.name, 'location', v_t.location,
          'day_full', trim(v_t.day_full), 'date_long', trim(v_t.date_long), 'time_hm', trim(v_t.time_hm),
          'subject_date', trim(v_t.subject_date), 'recipients', v_chunk_recipients),
        headers := jsonb_build_object('authorization', 'Bearer ' || v_key, 'content-type', 'application/json'),
        timeout_milliseconds := 30000
      ) into v_chunk_req;
      update public.tournament_reminders_sent set net_request_id = v_chunk_req
       where tournament_id = v_t.id and player_id = ANY(SELECT pid::uuid FROM unnest(v_chunk_pids) AS pid) and status = 'queued';
      if v_chunk_idx < v_chunk_total - 1 then perform pg_sleep(v_chunk_pause); end if;
    end loop;
    perform pg_sleep(v_settle);
    for v_chunk_req in select distinct net_request_id from public.tournament_reminders_sent where tournament_id = v_t.id and status = 'queued'
    loop
      select content::jsonb -> 'results' into v_results from net._http_response where id = v_chunk_req;
      if v_results is null then continue; end if;
      for v_item in select * from jsonb_array_elements(v_results)
      loop
        if (v_item ->> 'ok')::boolean is true then
          update public.tournament_reminders_sent set status = 'sent', error = null, sent_at = now()
           where tournament_id = v_t.id and player_id = (v_item ->> 'player_id')::uuid;
        else
          update public.tournament_reminders_sent
             set status = 'failed', error = coalesce(v_item ->> 'error', 'unknown'), sent_at = now()
           where tournament_id = v_t.id and player_id = (v_item ->> 'player_id')::uuid;
        end if;
      end loop;
    end loop;
    select count(*) filter (where status='sent'), count(*) filter (where status='failed'),
           count(*) filter (where status='skipped_no_email')
      into v_sent, v_failed, v_skipped from public.tournament_reminders_sent where tournament_id = v_t.id;
    select count(*) into v_total from public.registrations where tournament_id = v_t.id and status = 'registered';
    select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'email', p.email, 'error', s.error) order by p.name), '[]'::jsonb)
      into v_failed_list from public.tournament_reminders_sent s join public.players p on p.id = s.player_id
     where s.tournament_id = v_t.id and s.status = 'failed';
    perform net.http_post(
      url := v_url_report,
      body := jsonb_build_object(
        'tournament_id', v_t.id::text, 'tournament_name', v_t.name, 'subject_date', trim(v_t.subject_date),
        'run_at_amsterdam', to_char(v_run_at at time zone 'Europe/Amsterdam', 'FMDy FMDD FMMonth, HH24:MI'),
        'total_registered', v_total, 'sent_count', v_sent, 'failed_count', v_failed,
        'skipped_count', v_skipped, 'failed_list', v_failed_list),
      headers := jsonb_build_object('authorization', 'Bearer ' || v_key, 'content-type', 'application/json'),
      timeout_milliseconds := 10000);
    out_tournament_id := v_t.id; out_tournament_name := v_t.name;
    recipients_attempted := jsonb_array_length(v_recipients);
    recipients_sent := v_sent; recipients_failed := v_failed; recipients_skipped := v_skipped;
    return next;
  end loop;
  return;
end;
$function$;

create or replace function private.send_lobs6_24h_recovery_one_shot()
returns integer language plpgsql security definer
set search_path to 'pg_catalog', 'public', 'extensions', 'net', 'cron'
as $function$
declare
  v_tournament_id uuid := '45382520-87ad-489b-8e8e-8bd12aa865b7';
  v_url_send   text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-tournament-reminders';
  v_url_report text := 'https://enjhugmqjtfakwivpmvf.supabase.co/functions/v1/send-tournament-reminder-report';
  v_key text; v_t record; v_p record; v_req bigint; v_count int := 0;
  v_total int; v_sent int; v_failed int; v_skipped int;
  v_failed_list jsonb; v_run_at timestamptz := now(); v_jobid bigint;
begin
  set local statement_timeout = '600s';
  v_key := private.get_edge_service_role_key();
  if v_key is null then raise exception 'one_shot: vault secret missing'; end if;
  select t.id, t.name, t.location,
    to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDay') as day_full,
    to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDy FMDD FMMonth, HH24:MI') as subject_date,
    to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'FMDD FMMonth') as date_long,
    to_char(((t.date::text || ' ' || coalesce(t.time, '00:00'))::timestamp at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam', 'HH24:MI') as time_hm
    into v_t from public.tournaments t where t.id = v_tournament_id;
  if v_t.id is null then raise exception 'one_shot: tournament % not found', v_tournament_id; end if;
  for v_p in
    select p.id, p.name, p.email from public.tournament_reminders_sent s
      join public.players p on p.id = s.player_id
     where s.tournament_id = v_tournament_id and s.status = 'failed'
       and p.email is not null and length(trim(p.email)) >= 3
       and p.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  loop
    select net.http_post(
      url := v_url_send,
      body := jsonb_build_object(
        'tournament_id', v_t.id::text, 'tournament_name', v_t.name,
        'location', v_t.location, 'day_full', trim(v_t.day_full),
        'date_long', trim(v_t.date_long), 'time_hm', trim(v_t.time_hm),
        'subject_date', trim(v_t.subject_date), 'player_id', v_p.id::text,
        'player_name', v_p.name, 'first_name', private.first_name(v_p.name),
        'email', v_p.email, 'hours_until', 24),
      headers := jsonb_build_object('authorization', 'Bearer ' || v_key, 'content-type', 'application/json'),
      timeout_milliseconds := 10000
    ) into v_req;
    update public.tournament_reminders_sent
       set net_request_id = v_req, status = 'queued', sent_at = now(), error = null
     where tournament_id = v_t.id and player_id = v_p.id;
    v_count := v_count + 1;
    perform pg_sleep(0.6);
  end loop;
  perform pg_sleep(3);
  update public.tournament_reminders_sent s
     set status = case when r.status_code = 200 then 'sent' else 'failed' end,
         error  = case when r.status_code = 200 then null
                       else 'http ' || coalesce(r.status_code::text, 'timeout')
                            || coalesce(': ' || nullif(r.error_msg, ''), '')
                            || coalesce(' body=' || nullif(left(r.content::text, 300), ''), '')
                  end
    from net._http_response r
   where s.tournament_id = v_tournament_id and s.status = 'queued' and s.net_request_id = r.id;
  select count(*) filter (where status='sent'), count(*) filter (where status='failed'),
         count(*) filter (where status='skipped_no_email')
    into v_sent, v_failed, v_skipped
    from public.tournament_reminders_sent where tournament_id = v_tournament_id;
  select count(*) into v_total from public.registrations
   where tournament_id = v_tournament_id and status = 'registered';
  select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'email', p.email, 'error', s.error) order by p.name), '[]'::jsonb)
    into v_failed_list from public.tournament_reminders_sent s join public.players p on p.id = s.player_id
   where s.tournament_id = v_tournament_id and s.status = 'failed';
  perform net.http_post(
    url := v_url_report,
    body := jsonb_build_object(
      'tournament_id', v_t.id::text, 'tournament_name', v_t.name || ' (24h recovery batch)',
      'subject_date', trim(v_t.subject_date),
      'run_at_amsterdam', to_char(v_run_at at time zone 'Europe/Amsterdam', 'FMDy FMDD FMMonth, HH24:MI'),
      'total_registered', v_total, 'sent_count', v_sent, 'failed_count', v_failed,
      'skipped_count', v_skipped, 'failed_list', v_failed_list),
    headers := jsonb_build_object('authorization', 'Bearer ' || v_key, 'content-type', 'application/json'),
    timeout_milliseconds := 10000);
  select jobid into v_jobid from cron.job where jobname = 'lobs6-24h-recovery';
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  return v_count;
end;
$function$;

-- ============================================================
-- 9. Row Level Security + Policies
-- ============================================================

alter table public.players enable row level security;
alter table public.tournaments enable row level security;
alter table public.registrations enable row level security;
alter table public.matches enable row level security;
alter table public.settings enable row level security;
alter table public.merch_items enable row level security;
alter table public.merch_interests enable row level security;
alter table public.leagues enable row level security;
alter table public.league_interests enable row level security;
alter table public.league_teams enable row level security;
alter table public.player_aliases enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.player_devices enable row level security;
alter table public.lobster_oscars_sessions enable row level security;
alter table public.lobster_oscars_categories enable row level security;
alter table public.lobster_oscars_votes enable row level security;
alter table public.registration_transfers enable row level security;
-- tournament_reminders_sent: RLS NOT enabled (service_role only)

-- Core tables: permissive "allow all" to public
create policy "allow all" on public.players for all to public using (true) with check (true);
create policy "allow all" on public.tournaments for all to public using (true) with check (true);
create policy "allow all" on public.registrations for all to public using (true) with check (true);
create policy "allow all" on public.matches for all to public using (true) with check (true);
create policy "allow all" on public.settings for all to public using (true) with check (true);

-- Merch
create policy "merch_items anon read" on public.merch_items for select to anon, authenticated using (true);
create policy "merch_items anon insert" on public.merch_items for insert to anon, authenticated with check (true);
create policy "merch_items anon update" on public.merch_items for update to anon, authenticated using (true) with check (true);
create policy "merch_items anon delete" on public.merch_items for delete to anon, authenticated using (true);

create policy "merch_interests anon read" on public.merch_interests for select to anon, authenticated using (true);
create policy "merch_interests anon insert" on public.merch_interests for insert to anon, authenticated with check (true);
create policy "merch_interests anon update" on public.merch_interests for update to anon, authenticated using (true) with check (true);
create policy "merch_interests anon delete" on public.merch_interests for delete to anon, authenticated using (true);

-- Leagues
create policy "leagues anon read" on public.leagues for select to anon, authenticated using (true);
create policy "leagues anon insert" on public.leagues for insert to anon, authenticated with check (true);
create policy "leagues anon update" on public.leagues for update to anon, authenticated using (true) with check (true);
create policy "leagues anon delete" on public.leagues for delete to anon, authenticated using (true);

create policy "league_interests anon read" on public.league_interests for select to anon, authenticated using (true);
create policy "league_interests anon insert" on public.league_interests for insert to anon, authenticated with check (true);
create policy "league_interests anon update" on public.league_interests for update to anon, authenticated using (true) with check (true);
create policy "league_interests anon delete" on public.league_interests for delete to anon, authenticated using (true);

create policy "league_teams anon read" on public.league_teams for select to anon, authenticated using (true);
create policy "league_teams anon insert" on public.league_teams for insert to anon, authenticated with check (true);
create policy "league_teams anon update" on public.league_teams for update to anon, authenticated using (true) with check (true);
create policy "league_teams anon delete" on public.league_teams for delete to anon, authenticated using (true);

-- Player aliases
create policy "player_aliases anon read" on public.player_aliases for select to anon, authenticated using (true);
create policy "player_aliases anon insert" on public.player_aliases for insert to anon, authenticated with check (true);
create policy "player_aliases anon update" on public.player_aliases for update to anon, authenticated using (true) with check (true);
create policy "player_aliases anon delete" on public.player_aliases for delete to anon, authenticated using (true);

-- Registration transfers (read-only for anon)
create policy "anon can read transfers" on public.registration_transfers for select to anon, authenticated using (true);

-- Lobster Oscars
create policy "lobster_oscars_sessions_all" on public.lobster_oscars_sessions for all to public using (true) with check (true);
create policy "lobster_oscars_categories_all" on public.lobster_oscars_categories for all to public using (true) with check (true);
create policy "lobster_oscars_votes_all" on public.lobster_oscars_votes for all to public using (true) with check (true);

-- ============================================================
-- 10. Grants
-- ============================================================

-- Full access tables
grant all on public.tournaments to anon, authenticated, service_role;
grant all on public.registrations to anon, authenticated, service_role;
grant all on public.matches to anon, authenticated, service_role;
grant all on public.merch_items to anon, authenticated, service_role;
grant all on public.merch_interests to anon, authenticated, service_role;
grant all on public.leagues to anon, authenticated, service_role;
grant all on public.league_interests to anon, authenticated, service_role;
grant all on public.league_teams to anon, authenticated, service_role;
grant all on public.player_aliases to anon, authenticated, service_role;
grant all on public.pin_attempts to anon, authenticated, service_role;
grant all on public.player_devices to anon, authenticated, service_role;
grant all on public.registration_transfers to anon, authenticated, service_role;

-- players: service_role only (PII protected via RPCs)
grant all on public.players to service_role;

-- settings: all except maintain to anon/authenticated
grant select, insert, update, delete, truncate, references, trigger on public.settings to anon, authenticated;
grant all on public.settings to service_role;

-- Oscars: restricted grants
grant select on public.lobster_oscars_sessions to anon, authenticated;
grant all on public.lobster_oscars_sessions to service_role;
grant select on public.lobster_oscars_categories to anon, authenticated;
grant all on public.lobster_oscars_categories to service_role;
grant all on public.lobster_oscars_votes to service_role;

-- tournament_reminders_sent: service_role only
grant all on public.tournament_reminders_sent to service_role;

-- Views
grant all on public.players_public to anon, authenticated, service_role;
grant all on public.public_tournament_registration_counts to anon, authenticated, service_role;

-- Sequences
grant usage, select on sequence public.merch_items_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.merch_interests_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.pin_attempts_id_seq to anon, authenticated, service_role;

-- ============================================================
-- 11. Realtime
-- ============================================================
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.registrations;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.leagues;
alter publication supabase_realtime add table public.league_interests;
alter publication supabase_realtime add table public.league_teams;

-- ============================================================
-- 12. Storage
-- ============================================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('merch', 'merch', true) on conflict do nothing;

create policy "Public upload to avatars" on storage.objects for insert to anon, authenticated with check (bucket_id = 'avatars');
create policy "Public update avatars" on storage.objects for update to anon, authenticated using (bucket_id = 'avatars');
create policy "Public upload to merch" on storage.objects for insert to anon, authenticated with check (bucket_id = 'merch');
create policy "Public update merch" on storage.objects for update to anon, authenticated using (bucket_id = 'merch');
create policy "Public delete merch" on storage.objects for delete to anon, authenticated using (bucket_id = 'merch');

-- ============================================================
-- 13. Initial data (local dev)
-- ============================================================
insert into private.admin_secrets (id, admin_pin_hash)
values (1, extensions.crypt('0000', extensions.gen_salt('bf', 10)))
on conflict do nothing;

-- ============================================================
-- 14. Raffle winners
-- ============================================================
-- Track who has won the prize raffle and enforce a 3-tournament cooldown.
-- Eligibility is computed client-side; cooldown_offset compensates for
-- historical wins whose tournament isn't in the tournaments table.
create table if not exists public.raffle_winners (
  id                uuid        primary key default gen_random_uuid(),
  player_id         uuid        not null references public.players(id) on delete cascade,
  tournament_id     uuid        references public.tournaments(id) on delete set null,
  won_at_date       date        not null,
  tournament_label  text,
  cooldown_offset   int         not null default 0,
  prize             text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_raffle_winners_player_id
  on public.raffle_winners(player_id);
create index if not exists idx_raffle_winners_won_at_date
  on public.raffle_winners(won_at_date desc);

alter table public.raffle_winners enable row level security;

-- Reads are open; writes go through SECURITY DEFINER RPCs only.
drop policy if exists raffle_winners_select_all on public.raffle_winners;
create policy raffle_winners_select_all on public.raffle_winners
  for select to anon, authenticated using (true);

-- ── RPC: record raffle winners after a confirmed draw ───────────────────────
create or replace function public.admin_record_raffle_winners(
  input_admin_pin     text,
  input_tournament_id uuid,
  input_player_ids    uuid[],
  input_prizes        text[] default null
) returns setof public.raffle_winners
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_t_date  date;
  v_t_name  text;
  v_pid     uuid;
  v_prize   text;
  v_idx     int;
  v_row     public.raffle_winners%rowtype;
begin
  set local statement_timeout = '15s';
  if not public.verify_admin_pin(input_admin_pin) then return; end if;
  if input_tournament_id is null or input_player_ids is null then return; end if;

  select date, name into v_t_date, v_t_name
    from public.tournaments where id = input_tournament_id;
  if v_t_date is null then return; end if;

  v_idx := 1;
  foreach v_pid in array input_player_ids loop
    v_prize := null;
    if input_prizes is not null and v_idx <= array_length(input_prizes, 1) then
      v_prize := input_prizes[v_idx];
    end if;
    v_idx := v_idx + 1;

    -- Skip duplicates (same player, same tournament) silently.
    if exists (
      select 1 from public.raffle_winners
       where player_id = v_pid and tournament_id = input_tournament_id
    ) then continue; end if;

    insert into public.raffle_winners
      (player_id, tournament_id, won_at_date, tournament_label, cooldown_offset, prize)
    values
      (v_pid, input_tournament_id, v_t_date, v_t_name, 0, v_prize)
    returning * into v_row;
    return next v_row;
  end loop;
end $function$;

-- ── RPC: delete a raffle winner row (mistakes, re-draws) ────────────────────
create or replace function public.admin_delete_raffle_winner(
  input_admin_pin text,
  input_winner_id uuid
) returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  if not public.verify_admin_pin(input_admin_pin) then return false; end if;
  delete from public.raffle_winners where id = input_winner_id;
  return true;
end $function$;

-- ── RPC: edit a winner's prize after the fact ───────────────────────────────
create or replace function public.admin_update_raffle_winner_prize(
  input_admin_pin text,
  input_winner_id uuid,
  input_prize     text
) returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  if not public.verify_admin_pin(input_admin_pin) then return false; end if;
  update public.raffle_winners
     set prize = nullif(trim(coalesce(input_prize, '')), '')
   where id = input_winner_id;
  return found;
end $function$;

grant execute on function public.admin_record_raffle_winners(text, uuid, uuid[], text[])
  to anon, authenticated;
grant execute on function public.admin_delete_raffle_winner(text, uuid)
  to anon, authenticated;
grant execute on function public.admin_update_raffle_winner_prize(text, uuid, text)
  to anon, authenticated;

-- ============================================================
-- 15. Ratings persistence
-- ============================================================
-- Bulk-write Glicko-2 recompute results from client-side ratingsRecompute.js.
-- anon has no direct UPDATE on players; this SECURITY DEFINER RPC is the gate.
create or replace function public.admin_persist_learned_ratings(
  input_admin_pin              text,
  input_updates                jsonb,    -- [{id, learned_rating, learned_rd, learned_volatility, learned_matches_count, learned_updated_at}]
  input_applied_tournament_ids uuid[]    default '{}'
) returns int                            -- number of player rows updated
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_updated_count int         := 0;
  v_now           timestamptz := now();
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return 0; end if;
  if input_updates is null or jsonb_typeof(input_updates) <> 'array' then return 0; end if;

  with src as (
    select
      (e->>'id')::uuid                                                   as id,
      coalesce((e->>'learned_rating')::numeric, 1500)                    as learned_rating,
      coalesce((e->>'learned_rd')::numeric, 350)                         as learned_rd,
      coalesce((e->>'learned_volatility')::numeric, 0.06)                as learned_volatility,
      coalesce((e->>'learned_matches_count')::int, 0)                    as learned_matches_count,
      coalesce(nullif(e->>'learned_updated_at','')::timestamptz, v_now)  as learned_updated_at
    from jsonb_array_elements(input_updates) as e
  )
  update public.players p
     set learned_rating        = src.learned_rating,
         learned_rd            = src.learned_rd,
         learned_volatility    = src.learned_volatility,
         learned_matches_count = src.learned_matches_count,
         learned_updated_at    = src.learned_updated_at
    from src
   where p.id = src.id;

  get diagnostics v_updated_count = row_count;

  if input_applied_tournament_ids is not null
     and array_length(input_applied_tournament_ids, 1) > 0 then
    update public.tournaments
       set ratings_applied_at = v_now
     where id = any(input_applied_tournament_ids);
  end if;

  return v_updated_count;
end;
$$;

revoke execute on function public.admin_persist_learned_ratings(text, jsonb, uuid[]) from public;
grant  execute on function public.admin_persist_learned_ratings(text, jsonb, uuid[]) to anon, authenticated;
