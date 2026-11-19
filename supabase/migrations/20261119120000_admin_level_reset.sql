-- ============================================================================
-- Signup revamp S6b: an admin's level edit resets the rating again (#182)
-- (docs/signup-revamp/, owner 16 Nov: a level set by an admin counts the same
-- as one the player enters).
--
-- admin_update_player re-created from 20260815160000_guard_email_clear.sql,
-- which had dropped the MMv2 reset (20260713000001 §10). Changes:
-- - a level change calls record_mm_reset(..., 'admin_edit') with the C-7
--   guards update_my_profile uses: no reset to 0, and a levelled player's
--   start stands until their first played night;
-- - adjustment is no longer written; adjusted_level mirrors the level (D-002).
-- The email-clear guard is kept as it was.
-- ============================================================================

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
  v_old_level numeric;
  v_old_mm numeric;
  v_old_sigma numeric;
  v_new_level numeric;
  v_level_changed boolean;
begin
  set local statement_timeout = '30s';
  perform public.require_admin();
  if input_target_id is null or input_payload is null then return false; end if;

  select email, playtomic_level, mm_rating, mm_sigma
    into v_old_email, v_old_level, v_old_mm, v_old_sigma
    from public.players where id = input_target_id for update;

  v_new_level := coalesce((input_payload->>'playtomic_level')::numeric, v_old_level);
  v_level_changed := (input_payload ? 'playtomic_level')
                     and v_new_level is distinct from v_old_level;

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
      playtomic_level = v_new_level,
      adjusted_level = v_new_level,
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

    -- coalesce to 0: rating_events.prior_mu is NOT NULL and playtomic_level is nullable.
    if v_level_changed
       and v_new_level > 0
       and not private.levelling_start_stands(input_target_id) then
      perform public.record_mm_reset(
        input_target_id, v_new_level,
        coalesce(v_old_mm, v_old_level, 0), coalesce(v_old_sigma, 0.7), 'admin_edit'
      );
    end if;
  end if;

  return v_updated;
end $function$;
