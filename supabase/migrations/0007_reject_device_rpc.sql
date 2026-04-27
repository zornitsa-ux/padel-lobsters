-- =====================================================================
-- Phase 2b: player-side reject_device RPC
-- =====================================================================
-- Mirror of approve_device, but deletes the pending row instead of
-- marking it trusted. Used by the "Approve new device" widget so a
-- player can reject a sign-in attempt they don't recognize.
--
-- Same auth gates as approve_device: caller must verify PIN AND be
-- on a device that's already trusted for that player.
--
-- Audit-logged using attempt_kind = 'approve_device' with
-- succeeded = false (so the security events feed reads as
-- "Device approved · FAIL" — clear that the user rejected the
-- pending request).
-- =====================================================================

create or replace function public.reject_device(
  input_pin                  text,
  input_requesting_device_id text,
  input_target_device_id     text
)
returns text                                     -- 'ok' | 'denied' | 'no_such_device'
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
#variable_conflict use_column
declare
  v_player_id      uuid;
  v_caller_trusted boolean;
  v_target_exists  boolean;
begin
  set local statement_timeout = '30s';

  v_player_id := public.verify_player_pin(input_pin);
  if v_player_id is null
     or input_requesting_device_id is null
     or input_target_device_id is null
  then
    return 'denied';
  end if;

  -- Caller's device must already be trusted for this player.
  select pd.trusted_at is not null into v_caller_trusted
    from public.player_devices pd
   where pd.player_id = v_player_id
     and pd.device_id = input_requesting_device_id;
  if not coalesce(v_caller_trusted, false) then return 'denied'; end if;

  -- The target must be a PENDING device (not already trusted) for this player.
  select exists (
    select 1 from public.player_devices pd2
     where pd2.player_id = v_player_id
       and pd2.device_id = input_target_device_id
       and pd2.trusted_at is null
  ) into v_target_exists;
  if not v_target_exists then return 'no_such_device'; end if;

  -- Drop the pending row. The rejected device's poll on
  -- is_my_device_trusted will keep returning false; the user can
  -- still cancel from the waiting screen.
  delete from public.player_devices pd
   where pd.player_id = v_player_id
     and pd.device_id = input_target_device_id
     and pd.trusted_at is null;

  -- Audit-log as a failed approve_device action.
  insert into public.pin_attempts(
    player_id, device_id, attempt_kind, succeeded, was_new_device
  ) values (
    v_player_id, input_target_device_id, 'approve_device', false, false
  );

  return 'ok';
end $$;

revoke execute on function public.reject_device(text, text, text) from public;
grant  execute on function public.reject_device(text, text, text) to anon, authenticated;
