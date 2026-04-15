-- ================================================================
--  PADEL LOBSTERS — v14 Security Migration (Phase 1 of 3)
--
--  Status: ADDITIVE. Safe to run against a live production database.
--  Everything existing keeps working exactly as before.
--
--  What this does:
--    1. Adds hashed PIN columns alongside the plaintext ones.
--    2. Backfills hashes from the existing plaintext PINs.
--    3. Keeps the two columns in sync via triggers, so the old app
--       code path continues to work while we roll out the new one.
--    4. Creates a PII-free public view of the players table.
--    5. Creates SECURITY DEFINER RPCs that the new app code will
--       call instead of reading sensitive columns directly.
--
--  What this does NOT do yet (comes in Phases 2 & 3):
--    - Lock down the old `allow all` policies.
--    - Revoke anon SELECT on sensitive columns.
--    - Drop the plaintext pin / admin_pin columns.
--
--  How to run:
--    Open Supabase → SQL Editor → paste this whole file → Run.
--    No downtime. No data loss. Existing users unaffected.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) pgcrypto gives us crypt() + gen_salt() for bcrypt hashing.
-- ----------------------------------------------------------------
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------
-- 2) Add hash columns. Plaintext columns stay put for now so the
--    current app keeps working during the transition.
-- ----------------------------------------------------------------
alter table players  add column if not exists pin_hash       text;
alter table settings add column if not exists admin_pin_hash text;


-- ----------------------------------------------------------------
-- 3) Backfill: hash every existing plaintext PIN exactly once.
--    gen_salt('bf', 10) = bcrypt with work factor 10. Each row gets
--    its own random salt, so two players with PIN "1234" hash to
--    different values.
-- ----------------------------------------------------------------
update players
   set pin_hash = crypt(pin, gen_salt('bf', 10))
 where pin is not null
   and pin <> ''
   and pin_hash is null;

update settings
   set admin_pin_hash = crypt(admin_pin, gen_salt('bf', 10))
 where admin_pin is not null
   and admin_pin <> ''
   and admin_pin_hash is null;


-- ----------------------------------------------------------------
-- 4) Sync triggers. While Phase 2 is being rolled out, admins may
--    still edit plaintext pins via the old code path. These
--    triggers regenerate the hash automatically on INSERT/UPDATE
--    so the two columns never drift apart. Dropped in Phase 3.
-- ----------------------------------------------------------------
create or replace function sync_player_pin_hash()
returns trigger
language plpgsql
as $$
begin
  if NEW.pin is not null
     and NEW.pin <> ''
     and (TG_OP = 'INSERT' or NEW.pin is distinct from OLD.pin) then
    NEW.pin_hash := crypt(NEW.pin, gen_salt('bf', 10));
  end if;
  return NEW;
end
$$;

drop trigger if exists trg_sync_player_pin_hash on players;
create trigger trg_sync_player_pin_hash
  before insert or update of pin on players
  for each row execute function sync_player_pin_hash();


create or replace function sync_admin_pin_hash()
returns trigger
language plpgsql
as $$
begin
  if NEW.admin_pin is not null
     and NEW.admin_pin <> ''
     and (TG_OP = 'INSERT' or NEW.admin_pin is distinct from OLD.admin_pin) then
    NEW.admin_pin_hash := crypt(NEW.admin_pin, gen_salt('bf', 10));
  end if;
  return NEW;
end
$$;

drop trigger if exists trg_sync_admin_pin_hash on settings;
create trigger trg_sync_admin_pin_hash
  before insert or update of admin_pin on settings
  for each row execute function sync_admin_pin_hash();


-- ----------------------------------------------------------------
-- 5) Public view — the same `players` table without the sensitive
--    columns. In Phase 2 the app's plain SELECTs switch to this.
--    Anyone who queries this from the browser gets the non-PII
--    fields only; email/phone/birthday/notes/pin never appear.
-- ----------------------------------------------------------------
create or replace view players_public as
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
  created_at
from players;

-- Anon + signed-in users may read this view.
grant select on players_public to anon, authenticated;


-- ----------------------------------------------------------------
-- 6) RPC: verify a player's PIN. Returns the matching player's
--    uuid (or null). Never reveals the PIN itself. Used by the app
--    to sign a player in from the PIN prompt.
-- ----------------------------------------------------------------
create or replace function verify_player_pin(input_pin text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_id uuid;
begin
  if input_pin is null or length(input_pin) < 4 then
    return null;
  end if;

  select id
    into found_id
    from players
   where pin_hash is not null
     and pin_hash = crypt(input_pin, pin_hash)
     and coalesce(status, 'active') = 'active'
   limit 1;

  return found_id;
end
$$;

grant execute on function verify_player_pin(text) to anon, authenticated;


-- ----------------------------------------------------------------
-- 7) RPC: verify the admin PIN. Returns boolean only.
-- ----------------------------------------------------------------
create or replace function verify_admin_pin(input_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hash text;
begin
  if input_pin is null or length(input_pin) < 4 then
    return false;
  end if;

  select admin_pin_hash into hash from settings where id = 1 limit 1;
  if hash is null then return false; end if;

  return hash = crypt(input_pin, hash);
end
$$;

grant execute on function verify_admin_pin(text) to anon, authenticated;


-- ----------------------------------------------------------------
-- 8) RPC: get MY full record (with PII) by verifying my PIN
--    server-side. Returns nothing if the PIN is wrong, so the
--    caller can't enumerate other players this way.
-- ----------------------------------------------------------------
create or replace function get_my_profile(input_pin text)
returns setof players
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
begin
  me := verify_player_pin(input_pin);
  if me is null then
    return;
  end if;

  return query select * from players where id = me;
end
$$;

grant execute on function get_my_profile(text) to anon, authenticated;


-- ----------------------------------------------------------------
-- 9) RPC: admin-only list of players with full PII. Verifies the
--    admin PIN server-side so the admin pin never leaves the DB.
-- ----------------------------------------------------------------
create or replace function get_all_players_with_pii(admin_pin text)
returns setof players
language plpgsql
security definer
set search_path = public
as $$
begin
  if not verify_admin_pin(admin_pin) then
    return;
  end if;

  return query select * from players order by name;
end
$$;

grant execute on function get_all_players_with_pii(text) to anon, authenticated;


-- ================================================================
--  Phase 1 complete. Nothing is locked down yet — the existing app
--  keeps running unchanged. To verify:
--
--    -- every player should now have a pin_hash
--    select count(*) filter (where pin_hash is null) as missing_hashes
--      from players where coalesce(status, 'active') = 'active';
--
--    -- sanity-check the RPC (replace 1234 with a real player PIN)
--    select verify_player_pin('1234');
--
--    -- the public view should hide PII
--    select * from players_public limit 1;
--
--  Next up: Phase 2 — update the React app to use these RPCs.
-- ================================================================
