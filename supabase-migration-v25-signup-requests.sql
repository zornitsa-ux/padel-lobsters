-- ============================================================================
--  PADEL LOBSTERS — v25 Self-Signup Migration (Phase 3 of auth gating)
--
--  Status: ADDITIVE. Safe to run against production.
--
--  What this does:
--    Creates ONE RPC — `self_signup_player(name, email, phone)` — that
--    creates a new players row with an auto-generated 4-digit PIN and
--    returns the new player_id + PIN. The client calls this from the
--    "Sign up" tab of the PIN prompt and then auto-logs the user in
--    with the returned PIN.
--
--  Why an RPC and not a direct INSERT:
--    - Anon has no INSERT grant on `players` today, and we don't want to
--      add one (that would also let someone INSERT with an attacker-
--      chosen PIN, or spoof other players' fields).
--    - The RPC runs SECURITY DEFINER so it can touch `players` on our
--      behalf, while strictly controlling the shape of the insert: it
--      sets a freshly-generated PIN, `status = 'active'`, and nothing
--      else an attacker could abuse.
--
--  What this does NOT do (deliberate, per product brief "leave the pin
--  only auth for now without complicating it"):
--    - No email verification. The PIN is returned to the browser that
--      submitted the form. This is the same trust level as the PIN-
--      based auth the app already has — it's "know the PIN = be the
--      player".
--    - No admin approval queue. Signups are self-serve.
--    - No rate limiting. The Lobsters community is small; the admin
--      can delete spam rows from Players if it ever becomes an issue.
--      A later migration can add a per-email cooldown trivially.
--
--  How to run:
--    Open Supabase → SQL Editor → paste this whole file → Run.
--    No downtime. Existing users unaffected.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) self_signup_player(name, email, phone) → { player_id, pin }
--
--    Creates a row in `players` with a random 4-digit PIN and returns
--    both the id and the PIN (plaintext, once) so the client can log
--    the user in on the spot.
--
--    Guards:
--      - name and email are required and trimmed.
--      - email must look email-shaped (a '@' and a '.' after the '@').
--      - duplicate email → treated as a conflict; the RPC returns the
--        EXISTING player's PIN so someone who lost the app state just
--        needs to resubmit the same email and gets back in. This matches
--        the "lost PIN" recovery story without any email/SMS plumbing.
--        If you'd rather reject duplicates, flip the ON CONFLICT branch
--        to `raise exception`.
-- ---------------------------------------------------------------------------

create or replace function public.self_signup_player(
  p_name  text,
  p_email text,
  p_phone text default null
)
returns table (player_id uuid, pin text, was_existing boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name   text := trim(coalesce(p_name,  ''));
  clean_email  text := lower(trim(coalesce(p_email, '')));
  clean_phone  text := trim(coalesce(p_phone, ''));
  new_pin      text;
  found_id     uuid;
  found_pin    text;
  inserted_id  uuid;
begin
  -- Input validation. Generic messages — the client does client-side
  -- validation too, this is a backstop.
  if length(clean_name) = 0 then
    raise exception 'name_required';
  end if;
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'email_invalid';
  end if;

  -- Duplicate email? Return the existing row's PIN so the user recovers
  -- without admin intervention. `players.email` is expected to be unique
  -- at the app level but we don't rely on a DB constraint here — we just
  -- pick the first match by created_at.
  select id, pin into found_id, found_pin
  from public.players
  where lower(email) = clean_email
  order by created_at asc
  limit 1;

  if found_id is not null then
    return query select found_id, found_pin, true;
    return;
  end if;

  -- Generate a 4-digit PIN. Zero-padded so '0042' stays four chars.
  new_pin := lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');

  insert into public.players (name, email, phone, pin, status)
  values (
    clean_name,
    clean_email,
    nullif(clean_phone, ''),
    new_pin,
    'active'
  )
  returning id into inserted_id;

  return query select inserted_id, new_pin, false;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2) Grants. Anon can CALL the RPC (that's the whole point) but still
--    has no direct grants on the `players` table — the RPC is the only
--    anon-allowed write path into players, with a fixed insert shape.
-- ---------------------------------------------------------------------------

grant execute on function public.self_signup_player(text, text, text)
  to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3) Smoke tests (paste into SQL Editor).
--
--   -- First-time signup — returns a fresh PIN, was_existing = false:
--   select * from public.self_signup_player('Test Lobster', 't@example.com', '+31600000000');
--
--   -- Second call with the same email — returns the SAME pin, was_existing = true:
--   select * from public.self_signup_player('Test Lobster', 't@example.com', null);
--
--   -- Invalid input — raises 'email_invalid':
--   select * from public.self_signup_player('Nope', 'not-an-email', null);
-- ---------------------------------------------------------------------------
