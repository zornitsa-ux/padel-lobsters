-- =====================================================================
-- Padel Lobsters — Security Phase 2d: lock down admin PIN storage
-- =====================================================================
-- Pre-existing pre-Phase-1 issue: settings.admin_pin was stored in
-- plaintext AND the table's RLS was USING(true) for all roles. Anon
-- could simply `select * from settings` and read the admin PIN.
-- The bcrypt hash next to it (admin_pin_hash) provided no real
-- additional protection because a 4-digit PIN is offline-crackable
-- against bcrypt in minutes.
--
-- This migration:
--   1. Drops the plaintext admin_pin column (irrecoverable; hash is the
--      source of truth from now on).
--   2. Drops the trg_sync_admin_pin_hash trigger and sync_admin_pin_hash
--      function — both keyed off the now-gone plaintext column.
--   3. Revokes column-level SELECT/INSERT/UPDATE on admin_pin_hash from
--      anon and authenticated. The hash can now only be read or written
--      by SECURITY DEFINER functions running as the table owner.
--   4. Adds admin_change_pin(current_pin, new_pin, device, ua) RPC for
--      in-app PIN rotation. Verifies the current PIN, validates the new
--      one (≥ 4 digits), updates the hash, audit-logs the change.
--
-- Effect: anon's `select * from settings` now ERRORs because of the
-- missing column grant. App-side fix: change loadSettings from
-- select('*') to an explicit column list that excludes admin_pin_hash.
--
-- "I forgot the admin PIN" recovery: see the comment block at the end
-- of this file for the break-glass SQL.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Drop trigger + function (both reference the soon-to-be-gone column)
-- ---------------------------------------------------------------------
drop trigger if exists trg_sync_admin_pin_hash on public.settings;
drop function if exists public.sync_admin_pin_hash();

-- ---------------------------------------------------------------------
-- 2. Drop the plaintext admin_pin column
-- ---------------------------------------------------------------------
alter table public.settings drop column if exists admin_pin;

-- ---------------------------------------------------------------------
-- 3. Lock down the hash column. Postgres column-level grants only
--    apply when there's no table-level grant for that privilege, so we
--    revoke ALL on the table first, then GRANT back column-level on
--    the safe columns only. admin_pin_hash gets no grant — anon and
--    authenticated cannot read it through any direct query.
--    SECURITY DEFINER functions own the table so they bypass this.
-- ---------------------------------------------------------------------
revoke all on public.settings from anon, authenticated;
grant select (id, whatsapp_link, group_name, padel_tips, auto_trust_until)
  on public.settings to anon, authenticated;
grant update (whatsapp_link, group_name, padel_tips, auto_trust_until)
  on public.settings to anon, authenticated;
-- INSERT not granted — settings is single-row, already populated.
-- DELETE not granted — settings should never be deleted.

-- ---------------------------------------------------------------------
-- 4. admin_change_pin RPC — verifies current PIN, sets new hash
-- ---------------------------------------------------------------------
create or replace function public.admin_change_pin(
  input_current_pin text,
  input_new_pin     text,
  input_device_id   text default null,
  input_user_agent  text default null
)
returns text                                     -- 'ok' | 'wrong_current' | 'invalid_new'
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
#variable_conflict use_column
begin
  set local statement_timeout = '30s';

  if input_new_pin is null or length(input_new_pin) < 4 then
    return 'invalid_new';
  end if;
  if input_new_pin !~ '^[0-9]+$' then
    return 'invalid_new';
  end if;

  if not public.verify_admin_pin(input_current_pin) then
    insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
    values (input_device_id, input_user_agent, 'admin', false);
    return 'wrong_current';
  end if;

  update public.settings
     set admin_pin_hash = extensions.crypt(input_new_pin, extensions.gen_salt('bf', 10))
   where id = 1;

  insert into public.pin_attempts(device_id, user_agent, attempt_kind, succeeded)
  values (input_device_id, input_user_agent, 'admin_action', true);

  return 'ok';
end;
$$;
revoke execute on function public.admin_change_pin(text, text, text, text) from public;
grant  execute on function public.admin_change_pin(text, text, text, text) to anon, authenticated;

commit;

-- =====================================================================
-- BREAK-GLASS RECOVERY (admin forgot their PIN)
-- =====================================================================
-- Run this from the Supabase Studio SQL editor (project owner only):
--
--   update public.settings
--      set admin_pin_hash = extensions.crypt('NEW_PIN_HERE', extensions.gen_salt('bf', 10))
--    where id = 1;
--
-- Pick a new 4+-digit numeric PIN, paste it in place of NEW_PIN_HERE,
-- run the statement once. Next admin login uses the new PIN. The change
-- isn't audit-logged this way (it's outside the RPC), so consider
-- following up with a manual entry into pin_attempts if you want it on
-- the security feed.
-- =====================================================================
