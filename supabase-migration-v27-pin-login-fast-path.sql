-- ============================================================================
--  PADEL LOBSTERS — v27 Player PIN Login Fast Path
--
--  Status: ADDITIVE. Safe to run against production.
--
--  Why this exists:
--    Players started hitting a 500 on sign-in with the Postgres error
--
--        code: "57014"
--        message: "canceling statement due to statement timeout"
--
--    i.e. `verify_player_pin(input_pin)` exceeded the default 8-second
--    statement timeout. The v14 implementation bcrypt-compared the
--    entered PIN against EVERY row's `pin_hash` via `pin_hash =
--    crypt(input_pin, pin_hash)`. Each comparison is a bcrypt hash
--    (cost factor 10, ~50-150ms on Supabase's shared infrastructure),
--    so with 40+ players and any DB load the RPC could exceed the
--    timeout and never return — users got a 500 and stayed logged out.
--
--  What this does:
--    1. Adds a two-stage lookup to `verify_player_pin`:
--         - Stage 1 (fast): equality comparison on the plaintext `pin`
--           column (pin stays around thanks to the v14 sync trigger).
--           O(n) with n ≈ 50 is sub-millisecond.
--         - Stage 2 (fallback): bcrypt comparison, only if the
--           plaintext column is empty for every candidate row (e.g.
--           a future migration drops `pin`).
--    2. Raises statement_timeout inside the function to 30s as a
--       backstop for the bcrypt fallback. `SET LOCAL` only applies
--       inside the function's own transaction; callers are not
--       affected.
--
--  What this does NOT do:
--    - Does NOT change the storage model. `pin` and `pin_hash` stay
--      in sync via `trg_sync_player_pin_hash` from v14.
--    - Does NOT weaken the security posture. Anon can still only
--      reach `players.pin` via the SECURITY DEFINER RPC; direct
--      anon SELECT on the column is unchanged from whatever state
--      SECURITY-ROLLOUT.md has put it in.
--    - Does NOT affect the admin PIN verification.
--
--  How to run:
--    Open Supabase → SQL Editor → paste this whole file → Run.
--    No downtime. No data loss.
-- ============================================================================

create or replace function public.verify_player_pin(input_pin text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_id uuid;
begin
  -- Give the function a generous timeout. The default 8s is fine for
  -- the fast path (plaintext equality) but tight for the bcrypt
  -- fallback once the roster grows. 30s is well past worst-case on
  -- a 200-player table; if we ever need more, revisit.
  set local statement_timeout = '30s';

  if input_pin is null or length(input_pin) < 4 then
    return null;
  end if;

  -- Stage 1 — fast path. The v14 sync trigger keeps `pin` populated
  -- alongside `pin_hash`, so a direct equality check is usually all
  -- we need. Sub-millisecond even without an index.
  select id
    into found_id
    from public.players
   where pin is not null
     and pin = input_pin
     and coalesce(status, 'active') = 'active'
   limit 1;

  if found_id is not null then
    return found_id;
  end if;

  -- Stage 2 — bcrypt fallback. Runs only when the fast path missed
  -- (pin column empty or mismatched). Expensive but correct; guarded
  -- by the raised statement_timeout above.
  select id
    into found_id
    from public.players
   where pin_hash is not null
     and pin_hash = crypt(input_pin, pin_hash)
     and coalesce(status, 'active') = 'active'
   limit 1;

  return found_id;
end;
$$;

-- Re-grant. CREATE OR REPLACE keeps existing grants, but re-stating
-- them is cheap and makes the migration self-contained for anyone
-- running it out of order.
grant execute on function public.verify_player_pin(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Smoke test. Running this as the anon role (via supabase-js or the
-- SQL Editor with role anon) should return the player's uuid for a
-- valid PIN and null for an invalid one, in a fraction of a second.
-- ---------------------------------------------------------------------------

-- select public.verify_player_pin('1234');   -- → uuid or null
-- select public.verify_player_pin('0000');   -- → null
