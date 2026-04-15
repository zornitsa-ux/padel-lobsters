-- ================================================================
--  PADEL LOBSTERS — v14b Security Migration patch
--
--  Fixes the "function crypt(text, text) does not exist" error in
--  the v14 RPCs. In Supabase, pgcrypto lives in the `extensions`
--  schema, not `public`, so SECURITY DEFINER functions that pin
--  `search_path = public` can't see crypt() / gen_salt().
--
--  This patch rewrites the six affected functions to include
--  `extensions` in their search_path. Safe to run on top of v14.
--  Idempotent — can be re-run without harm.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Trigger functions (keep pin_hash in sync with plaintext pin)
-- ----------------------------------------------------------------
create or replace function sync_player_pin_hash()
returns trigger
language plpgsql
set search_path = public, extensions
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

create or replace function sync_admin_pin_hash()
returns trigger
language plpgsql
set search_path = public, extensions
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


-- ----------------------------------------------------------------
-- 2) RPC: verify a player's PIN
-- ----------------------------------------------------------------
create or replace function verify_player_pin(input_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
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
-- 3) RPC: verify the admin PIN
-- ----------------------------------------------------------------
create or replace function verify_admin_pin(input_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
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
-- 4) RPC: get my own profile
-- ----------------------------------------------------------------
create or replace function get_my_profile(input_pin text)
returns setof players
language plpgsql
security definer
set search_path = public, extensions
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
-- 5) RPC: admin-only list of players with full PII
-- ----------------------------------------------------------------
create or replace function get_all_players_with_pii(admin_pin text)
returns setof players
language plpgsql
security definer
set search_path = public, extensions
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
--  Patch complete. Re-run the verification queries from the v14
--  runbook to confirm:
--
--    -- should return a uuid (replace 1234 with a real player PIN)
--    select verify_player_pin('1234');
--
--    -- should return true (replace 1234 with the admin PIN)
--    select verify_admin_pin('1234');
--
--    -- should hide email / phone / birthday / pin
--    select * from players_public limit 1;
-- ================================================================
