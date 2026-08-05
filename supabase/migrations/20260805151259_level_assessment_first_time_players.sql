-- Level Assessment: player_level_assessments table (admin-only) + signup RPC extension.
--
-- Purely additive: no changes to public.players (columns, rows, or RLS on that
-- table). Playtomic level, adjustment, adjusted_level, and learned_rating for
-- every existing player are untouched. This table is only ever written to for
-- brand-new signups going forward (see self_signup_player below) — players who
-- have already joined at least one tournament already exist, so the "new
-- player" insert branch never runs for them and no row is ever created here
-- for them.
--
-- NOTE: applied to production out-of-band on 2026-08-05 and reverted 6 minutes
-- later by 20260805151846. Backfilled here so repo history matches prod.

create table public.player_level_assessments (
  id                     uuid primary key default gen_random_uuid(),
  player_id              uuid not null references public.players(id) on delete cascade,
  initial_lobster_score  numeric not null,
  level_assessment       jsonb not null,
  created_at             timestamptz not null default now()
);

comment on table public.player_level_assessments is
  'Cold-start Lobster score derived from the signup questionnaire. Admin-only, never shown to players. Set once at signup and never updated. Superseded in practice by learned_rating once a player has real match results.';

create index player_level_assessments_player_id_idx
  on public.player_level_assessments (player_id);

alter table public.player_level_assessments enable row level security;

-- 1. Revoke everything first.
revoke all on public.player_level_assessments from anon, authenticated, public;

-- 2. Grant base SELECT to authenticated. Postgres checks the table grant
--    before RLS is evaluated, so without this, non-admins would get a
--    permission ERROR instead of an empty result set.
grant select on public.player_level_assessments to authenticated;

-- 3. Admin-only RLS read policy, matching the current JWT app_metadata role
--    convention already used elsewhere (e.g. rating_events_admin_read).
--    anon has no grant at all, so unauthenticated requests can't reach this
--    table under any policy.
create policy player_level_assessments_admin_read
  on public.player_level_assessments
  for select
  to public
  using (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin');

-- No write policy for anon/authenticated: the only writer is the
-- SECURITY DEFINER self_signup_player RPC, which bypasses RLS and grants.

-- Extend self_signup_player: after inserting a genuinely new player row,
-- also insert the assessment row, but only when the payload actually
-- carries a score (guarded on the field being present and non-empty).
-- The existing-player / merge branch above returns early and never reaches
-- this insert, so returning players are never scored by this feature.
create or replace function public.self_signup_player(input_payload jsonb, input_device_id text DEFAULT NULL::text, input_user_agent text DEFAULT NULL::text)
 RETURNS TABLE(player_id uuid, pin text, was_existing boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
#variable_conflict use_column
declare
  v_name        text;
  v_email       text;
  v_phone       text;
  v_existing_id uuid;
  v_recent_signups int;
  v_new_pin     text;
  v_inserted    public.players%rowtype;
  v_initial_lobster_score numeric;
  c_max_per_device_24h constant int := 5;
begin
  set local statement_timeout = '30s';

  if input_payload is null then
    raise exception 'missing payload' using errcode = '22023';
  end if;

  v_name  := nullif(btrim(coalesce(input_payload->>'name', '')), '');
  v_email := nullif(btrim(lower(coalesce(input_payload->>'email', ''))), '');
  v_phone := nullif(btrim(coalesce(input_payload->>'phone', '')), '');

  if v_name is null or v_email is null then
    raise exception 'name and email are required' using errcode = '22023';
  end if;
  if length(v_name) > 100 or length(v_email) > 200 then
    raise exception 'name or email too long' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  if input_device_id is not null then
    select count(*) into v_recent_signups
      from public.pin_attempts pa
     where pa.device_id    = input_device_id
       and pa.attempt_kind = 'signup'
       and pa.attempted_at > now() - interval '24 hours';
    if v_recent_signups >= c_max_per_device_24h then
      raise exception 'rate limited' using errcode = 'P0001';
    end if;
  end if;

  select p.id into v_existing_id
    from public.players p
   where lower(coalesce(p.email,'')) = v_email
     and coalesce(p.status,'active') = 'active'
   limit 1;

  if v_existing_id is not null then
    insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
    values (v_existing_id, input_device_id, input_user_agent, 'signup', false);
    return query select null::uuid, null::text, true;
    return;
  end if;

  for i in 1..10 loop
    v_new_pin := lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (
      select 1 from public.players p
       where p.pin = v_new_pin and coalesce(p.status,'active') = 'active'
    );
  end loop;

  insert into public.players(
    name, email, phone, notes,
    playtomic_level, adjustment, adjusted_level,
    playtomic_username, gender, status, is_left_handed,
    country, avatar_url, birthday, preferred_position,
    tagline_label, pin
  ) values (
    v_name,
    v_email,
    coalesce(v_phone, ''),
    coalesce(input_payload->>'notes', ''),
    coalesce((input_payload->>'playtomic_level')::numeric, 0),
    coalesce((input_payload->>'adjustment')::numeric, 0),
    coalesce((input_payload->>'playtomic_level')::numeric, 0)
      + coalesce((input_payload->>'adjustment')::numeric, 0),
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
  )
  returning * into v_inserted;

  insert into public.pin_attempts(player_id, device_id, user_agent, attempt_kind, succeeded)
  values (v_inserted.id, input_device_id, input_user_agent, 'signup', true);

  -- Level Assessment: only for brand-new players, only when a score is
  -- actually present in the payload.
  v_initial_lobster_score := nullif(input_payload->>'initial_lobster_score', '')::numeric;
  if v_initial_lobster_score is not null then
    insert into public.player_level_assessments(player_id, initial_lobster_score, level_assessment)
    values (
      v_inserted.id,
      v_initial_lobster_score,
      coalesce(input_payload->'level_assessment', '{}'::jsonb)
    );
  end if;

  return query select v_inserted.id, v_inserted.pin, false;
end;
$function$;
