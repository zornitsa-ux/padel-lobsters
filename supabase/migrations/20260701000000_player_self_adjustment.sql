-- Allow players to update their own adjustment via update_my_profile.
--
-- Previously adjustment was admin-only. The RPC accepted playtomic_level
-- but not adjustment, so adjusted_level was always recomputed with the
-- stored (admin-set) adjustment. Players editing their Playtomic popup
-- saw a silent no-op for the adjustment field.
--
-- Change: add adjustment to the UPDATE and recompute adjusted_level the
-- same way admin_update_player does — using whichever of playtomic_level
-- and adjustment is freshest.

create or replace function public.update_my_profile(input_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'extensions'
as $function$
#variable_conflict use_column
declare
  v_player_id uuid;
  v_updated boolean := false;
begin
  set local statement_timeout = '30s';
  v_player_id := auth.uid();
  if v_player_id is null or input_payload is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform public.require_trusted_device();
  with upd as (
    update public.players p set
      name               = case when input_payload ? 'name'               then nullif(btrim(input_payload->>'name'), '')               else p.name end,
      -- email is INTENTIONALLY OMITTED — self-service change routes through supabase.auth.updateUser.
      phone              = case when input_payload ? 'phone'              then nullif(btrim(input_payload->>'phone'), '')              else p.phone end,
      birthday           = case when input_payload ? 'birthday'           then nullif(input_payload->>'birthday', '')::date            else p.birthday end,
      country            = case when input_payload ? 'country'            then nullif(btrim(input_payload->>'country'), '')            else p.country end,
      gender             = case when input_payload ? 'gender'             then nullif(btrim(input_payload->>'gender'), '')             else p.gender end,
      is_left_handed     = coalesce((input_payload->>'is_left_handed')::boolean,          p.is_left_handed),
      preferred_position = case when input_payload ? 'preferred_position' then nullif(btrim(input_payload->>'preferred_position'), '') else p.preferred_position end,
      playtomic_level    = coalesce((input_payload->>'playtomic_level')::numeric,         p.playtomic_level),
      adjustment         = coalesce((input_payload->>'adjustment')::numeric,              p.adjustment),
      adjusted_level     = coalesce((input_payload->>'playtomic_level')::numeric,         p.playtomic_level)
                         + coalesce((input_payload->>'adjustment')::numeric,              p.adjustment),
      playtomic_username = case when input_payload ? 'playtomic_username' then nullif(btrim(input_payload->>'playtomic_username'), '') else p.playtomic_username end,
      tagline            = case when input_payload ? 'tagline'            then nullif(btrim(input_payload->>'tagline'), '')            else p.tagline end,
      tagline_label      = case when input_payload ? 'tagline_label'      then nullif(btrim(input_payload->>'tagline_label'), '')      else p.tagline_label end,
      avatar_url         = case when input_payload ? 'avatar_url'         then nullif(btrim(input_payload->>'avatar_url'), '')         else p.avatar_url end,
      playtomic_updated_at = case when (input_payload ? 'playtomic_level' or input_payload ? 'adjustment')
                                  then now()
                                  else p.playtomic_updated_at end
    where p.id = v_player_id
    returning 1
  ) select exists (select 1 from upd) into v_updated;
  return v_updated;
end
$function$;
