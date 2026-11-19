-- ============================================================================
-- Signup revamp S6a: a new partner's Playtomic level is required
-- (docs/signup-revamp/, owner 18 Nov).
--
-- A captain (or an admin adding a team) who creates an account for a new
-- partner gives their level. An unaccepted partner still plays, so without
-- this they could play with no level and never be asked for one.
-- create_partner_player re-created from 20261022120000_team_events.sql; only
-- the level check changes: blank, 0 or above 7 is invalid_level.
-- ============================================================================

create or replace function private.create_partner_player(
  input_requested_by uuid,
  input_tournament_id uuid,
  input_new_partner jsonb,
  input_consent boolean,
  input_skip_daily_cap boolean
)
returns table(status text, player_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_name text := nullif(regexp_replace(btrim(coalesce(input_new_partner ->> 'name', '')), '\s+', ' ', 'g'), '');
  v_email text := lower(nullif(btrim(coalesce(input_new_partner ->> 'email', '')), ''));
  v_level_text text := nullif(btrim(coalesce(input_new_partner ->> 'playtomic_level', '')), '');
  v_level numeric;
  v_email_problem text;
  v_id uuid;
begin
  if input_consent is not true then
    return query select 'consent_required'::text, null::uuid; return;
  end if;
  if v_name is null or length(v_name) > 100 then
    return query select 'invalid_name'::text, null::uuid; return;
  end if;
  v_email_problem := private.new_partner_email_problem(v_email);
  if v_email_problem = 'invalid_email' then
    return query select 'invalid_email'::text, null::uuid; return;
  end if;
  -- The cast only after the format check: OR doesn't promise evaluation order.
  if v_level_text is null or v_level_text !~ '^[0-9]+(\.[0-9]+)?$' then
    return query select 'invalid_level'::text, null::uuid; return;
  end if;
  v_level := v_level_text::numeric;
  if v_level <= 0 or v_level > 7 then
    return query select 'invalid_level'::text, null::uuid; return;
  end if;
  if v_email_problem = 'email_in_use' then
    return query select 'email_in_use'::text, null::uuid; return;
  end if;

  if not input_skip_daily_cap then
    perform pg_advisory_xact_lock(hashtextextended('partner_cap:' || input_requested_by::text, 0));
    if (select count(*) from public.partner_invites pi
         where pi.requested_by = input_requested_by
           and pi.created_at > now() - interval '24 hours') >= 3 then
      return query select 'partner_cap_reached'::text, null::uuid; return;
    end if;
  end if;

  begin
    insert into public.players(name, email, phone, notes, playtomic_level, adjustment, adjusted_level,
      playtomic_username, gender, status, is_left_handed, country, avatar_url, birthday,
      preferred_position, tagline_label, pin, pin_hash)
    values (v_name, v_email, '', '', v_level, 0, v_level,
      '', '', 'active', false, '', '', null,
      '', '', null, null)
    returning id into v_id;
  exception when unique_violation then
    -- A concurrent signup took the email between the check and the insert.
    return query select 'email_in_use'::text, null::uuid; return;
  end;

  insert into public.partner_invites(player_id, tournament_id, requested_by, consent_confirmed_at)
  values (v_id, input_tournament_id, input_requested_by, now());

  return query select 'ok'::text, v_id;
end
$function$;

revoke execute on function private.create_partner_player(uuid, uuid, jsonb, boolean, boolean) from public, anon, authenticated;
