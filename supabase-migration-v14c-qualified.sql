-- ================================================================
--  PADEL LOBSTERS — v14c Security Migration patch (final)
--
--  Drops the previous versions of the six functions and recreates
--  them with fully-qualified extensions.crypt / extensions.gen_salt
--  calls. This bypasses the search_path problem completely — no
--  matter what search_path a caller has, the functions will find
--  pgcrypto.
--
--  Idempotent. Safe to run on top of v14 + v14b.
-- ================================================================

-- 1) Drop the old versions so there's no ambiguity.
drop function if exists verify_player_pin(text)       cascade;
drop function if exists verify_admin_pin(text)        cascade;
drop function if exists get_my_profile(text)          cascade;
drop function if exists get_all_players_with_pii(text) cascade;

drop trigger  if exists trg_sync_player_pin_hash on players;
drop trigger  if exists trg_sync_admin_pin_hash  on settings;
drop function if exists sync_player_pin_hash() cascade;
drop function if exists sync_admin_pin_hash()  cascade;


-- ----------------------------------------------------------------
-- 2) Trigger functions — fully-qualified calls to pgcrypto.
-- ----------------------------------------------------------------
create function sync_player_pin_hash()
returns trigger
language plpgsql
as $$
begin
  if NEW.pin is not null
     and NEW.pin <> ''
     and (TG_OP = 'INSERT' or NEW.pin is distinct from OLD.pin) then
    NEW.pin_hash := extensions.crypt(NEW.pin, extensions.gen_salt('bf', 10));
  end if;
  return NEW;
end
$$;

create trigger trg_sync_player_pin_hash
  before insert or update of pin on players
  for each row execute function sync_player_pin_hash();


create function sync_admin_pin_hash()
returns trigger
language plpgsql
as $$
begin
  if NEW.admin_pin is not null
     and NEW.admin_pin <> ''
     and (TG_OP = 'INSERT' or NEW.admin_pin is distinct from OLD.admin_pin) then
    NEW.admin_pin_hash := extensions.crypt(NEW.admin_pin, extensions.gen_salt('bf', 10));
  end if;
  return NEW;
end
$$;

create trigger trg_sync_admin_pin_hash
  before insert or update of admin_pin on settings
  for each row execute function sync_admin_pin_hash();


-- ----------------------------------------------------------------
-- 3) RPC: verify a player's PIN
-- ----------------------------------------------------------------
create function verify_player_pin(input_pin text)
returns uuid
language plpgsql
security definer
as $$
declare
  found_id uuid;
begin
  if input_pin is null or length(input_pin) < 4 then
    return null;
  end if;

  select id
    into found_id
    from public.players
   where pin_hash is not null
     and pin_hash = extensions.crypt(input_pin, pin_hash)
     and coalesce(status, 'active') = 'active'
   limit 1;

  return found_id;
end
$$;

grant execute on function verify_player_pin(text) to anon, authenticated;


-- ----------------------------------------------------------------
-- 4) RPC: verify the admin PIN
-- ----------------------------------------------------------------
create function verify_admin_pin(input_pin text)
returns boolean
language plpgsql
security definer
as $$
declare
  hash text;
begin
  if input_pin is null or length(input_pin) < 4 then
    return false;
  end if;

  select admin_pin_hash into hash from public.settings where id = 1 limit 1;
  if hash is null then return false; end if;

  return hash = extensions.crypt(input_pin, hash);
end
$$;

grant execute on function verify_admin_pin(text) to anon, authenticated;


-- ----------------------------------------------------------------
-- 5) RPC: get my own profile
-- ----------------------------------------------------------------
create function get_my_profile(input_pin text)
returns setof public.players
language plpgsql
security definer
as $$
declare
  me uuid;
begin
  me := public.verify_player_pin(input_pin);
  if me is null then
    return;
  end if;

  return query select * from public.players where id = me;
end
$$;

grant execute on function get_my_profile(text) to anon, authenticated;


-- ----------------------------------------------------------------
-- 6) RPC: admin-only list of players with full PII
-- ----------------------------------------------------------------
create function get_all_players_with_pii(admin_pin text)
returns setof public.players
language plpgsql
security definer
as $$
begin
  if not public.verify_admin_pin(admin_pin) then
    return;
  end if;

  return query select * from public.players order by name;
end
$$;

grant execute on function get_all_players_with_pii(text) to anon, authenticated;


-- ================================================================
--  Verification — run these after applying the patch:
--
--    -- should return a uuid (replace 1234 with a real player PIN)
--    select verify_player_pin('1234');
--
--    -- should return true (replace 1234 with the admin PIN)
--    select verify_admin_pin('1234');
--
--    -- should return player row(s) with email/phone/birthday filled
--    select id, name, email from get_my_profile('1234');
-- ================================================================
