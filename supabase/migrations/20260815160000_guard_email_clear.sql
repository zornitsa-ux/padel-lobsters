-- Guard admin_update_player against silently clearing players.email, and
-- audit every clear that does happen.
--
-- admin_update_player treats "key present, blank value" as "clear this
-- column" (20260526000001_fix_blank_email_overwrite.sql) — the right
-- contract for most columns, driven by the assumption that a blank in the
-- payload reflects the admin's intent. That assumption broke for email: the
-- admin Players screen could seed its edit form from a record whose PII
-- overlay hadn't finished loading yet, submit that blank as a real edit, and
-- silently NULL out a player's login-critical email (players.email backs
-- verify-pin, "Forgot PIN", and ensure_auth_user_for_player). This is what
-- happened to player 1f860c98-061c-4cb2-b627-39439d21f87a on 2026-05-29.
--
-- From here: clearing email requires the payload to also carry
-- `email_cleared: true`. A blank `email` key without that sentinel is a
-- no-op — the column is left exactly as it was — instead of a clear. The
-- client only ever sets the sentinel when the admin actively emptied a
-- field that had a real value (see buildPlayerEditPatch in
-- src/features/community/playerPatch.ts). Every transition from a real
-- email to NULL through this function is also logged to
-- player_email_clears, regardless of how it happened, so a future incident
-- like this one is forensically visible instead of requiring a pin_attempts
-- reconstruction.
--
-- update_my_profile is untouched: it has never had an email column in its
-- SET list (20260528000000_magic_link_auth.sql #6 — self-service email
-- change is confirmation-gated through supabase.auth.updateUser instead),
-- so it carries no equivalent risk.

create table if not exists public.player_email_clears (
  id bigint generated always as identity primary key,
  player_id uuid not null,
  old_email text not null,
  cleared_by uuid,
  cleared_via text not null,
  cleared_at timestamptz not null default now()
);

comment on table public.player_email_clears is
  'Audit trail for players.email transitioning from a real value to NULL. Added 2026-08-15 after an unguarded clear wiped a player''s login email undetected for weeks. Append-only, no FK to players so the record outlives the row it describes — same posture as registration_status_events.';

alter table public.player_email_clears enable row level security;
-- No policies: written only by this SECURITY DEFINER function, read via the
-- service role / dashboard — same posture as pin_attempts.

create or replace function public.admin_update_player(input_target_id uuid, input_payload jsonb)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_updated boolean := false;
  v_old_email text;
  v_new_email text;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_target_id is null or input_payload is null then return false; end if;

  select email into v_old_email from public.players where id = input_target_id;

  with upd as (
    update public.players p set
      name = case when input_payload ? 'name' then nullif(btrim(input_payload->>'name'), '') else p.name end,
      email = case
        when input_payload ? 'email' then
          case
            when nullif(btrim(input_payload->>'email'), '') is not null then btrim(input_payload->>'email')
            when coalesce((input_payload->>'email_cleared')::boolean, false) then null
            else p.email
          end
        else p.email
      end,
      phone = case when input_payload ? 'phone' then nullif(btrim(input_payload->>'phone'), '') else p.phone end,
      notes = case when input_payload ? 'notes' then nullif(btrim(input_payload->>'notes'), '') else p.notes end,
      playtomic_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level),
      adjustment = coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      adjusted_level = coalesce((input_payload->>'playtomic_level')::numeric, p.playtomic_level)
                      + coalesce((input_payload->>'adjustment')::numeric, p.adjustment),
      playtomic_username = case when input_payload ? 'playtomic_username' then nullif(btrim(input_payload->>'playtomic_username'), '') else p.playtomic_username end,
      gender = case when input_payload ? 'gender' then nullif(btrim(input_payload->>'gender'), '') else p.gender end,
      status = case when input_payload ? 'status' then nullif(btrim(input_payload->>'status'), '') else p.status end,
      is_left_handed = coalesce((input_payload->>'is_left_handed')::boolean, p.is_left_handed),
      country = case when input_payload ? 'country' then nullif(btrim(input_payload->>'country'), '') else p.country end,
      avatar_url = case when input_payload ? 'avatar_url' then nullif(btrim(input_payload->>'avatar_url'), '') else p.avatar_url end,
      birthday = case when input_payload ? 'birthday' then nullif(input_payload->>'birthday', '')::date else p.birthday end,
      preferred_position = case when input_payload ? 'preferred_position' then nullif(btrim(input_payload->>'preferred_position'), '') else p.preferred_position end,
      tagline = case when input_payload ? 'tagline' then nullif(btrim(input_payload->>'tagline'), '') else p.tagline end,
      tagline_label = case when input_payload ? 'tagline_label' then nullif(btrim(input_payload->>'tagline_label'), '') else p.tagline_label end,
      playtomic_updated_at = case when (input_payload ? 'playtomic_level') then now() else p.playtomic_updated_at end
    where p.id = input_target_id
    returning p.email
  )
  select email into v_new_email from upd;
  v_updated := found;

  if v_updated then
    insert into public.pin_attempts(player_id, attempt_kind, succeeded)
    values (input_target_id, 'admin_action', true);

    if v_old_email is not null and v_new_email is null then
      insert into public.player_email_clears(player_id, old_email, cleared_by, cleared_via)
      values (input_target_id, v_old_email, auth.uid(), 'admin_update_player');
    end if;
  end if;

  return v_updated;
end $function$;
