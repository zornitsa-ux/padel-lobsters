# Padel Lobsters — Supabase Security Rollout

Plain-language runbook for locking down the Supabase database so PII and
PINs are not readable from the browser. Three phases, staged so live users
are never affected.

---

## Where we are today

The Padel Lobsters React app talks to Supabase directly using the `anon`
public key. Row-Level Security is technically enabled on every table, but
each table has an `allow all` policy, so every row and every column is
readable and writable by anybody who opens the browser console.

Two specific problems:

1. **PII exposure.** Any visitor can run
   `select email, phone, birthday from players` and download the list.
2. **Credential exposure.** Any visitor can run `select pin from players`
   and `select admin_pin from settings`. The PIN-based sign-in we just
   built is cosmetic — someone looking at the network tab could log in
   as anyone, including admin.

The rollout below fixes both without forcing players to re-onboard.

---

## The shape of the fix

Instead of the browser reading sensitive columns directly, the browser
calls small database functions (RPCs) that verify the PIN server-side
and return only what the caller is allowed to see. The PIN and the
sensitive fields never leave the database.

Picture it as a reception desk: today anyone walks into the archive and
pulls files off the shelves. After the rollout, visitors hand a PIN to
the receptionist and receive only the folder they're entitled to.

---

## Phase 1 — Add the new plumbing (SAFE TO RUN NOW)

File: `supabase-migration-v14-security.sql`

This migration is purely additive. It:
- Adds hashed PIN columns alongside the plaintext ones.
- Backfills the hashes from the existing plaintext PINs using bcrypt.
- Keeps the two columns synced via triggers so the old app path still
  works while we migrate.
- Creates a PII-free public view of `players` called `players_public`.
- Adds four SECURITY DEFINER RPCs:
  - `verify_player_pin(text)` → uuid | null
  - `verify_admin_pin(text)` → boolean
  - `get_my_profile(text)` → full record for the matching player
  - `get_all_players_with_pii(admin_pin text)` → all rows, admin-only

Nothing is locked down yet. The live app keeps working exactly as it
does today, because the old `allow all` policies are still in place.

**How to apply:**

1. Open your Supabase project in the browser.
2. Go to **SQL Editor** → **New query**.
3. Paste the entire contents of `supabase-migration-v14-security.sql`.
4. Click **Run**.
5. You should see "Success. No rows returned" at the bottom.

**How to verify Phase 1 worked:**

Run these in the SQL Editor:

```sql
-- Every active player should have a pin_hash (result should be 0).
select count(*) filter (where pin_hash is null) as missing_hashes
  from players
 where coalesce(status, 'active') = 'active';

-- Replace 1234 with a real player PIN — should return that player's uuid.
select verify_player_pin('1234');

-- Replace 1234 with the admin PIN — should return true.
select verify_admin_pin('1234');

-- The public view should NOT contain email, phone, birthday, or pin.
select * from players_public limit 1;
```

If all four of those behave as described, Phase 1 is good. If anything
looks off, stop and let me know before we proceed.

---

## Phase 2 — Flip the React app onto the new RPCs

Not started yet. Once Phase 1 is verified, I'll update these files:

- `src/context/AppContext.jsx` — change `loginWithPin` to call
  `verify_player_pin` / `verify_admin_pin` instead of reading
  `players.pin` and `settings.admin_pin` directly.
- `src/components/Settings.jsx` — use `get_my_profile` when the user
  opens their profile drawer, instead of reading PII off the cached
  `players` list.
- `src/components/Players.jsx` — for the admin's full-PII view, call
  `get_all_players_with_pii` with the admin PIN.
- Plain `.from('players').select('*')` becomes
  `.from('players_public').select('*')` in components that don't need
  PII (Dashboard, scheduling, reactions list, etc.).

After Phase 2 is deployed, the app no longer reads `email`, `phone`,
`birthday`, `pin`, or `admin_pin` from the browser. But the database
still *allows* those reads to anybody with the anon key who calls them
directly. We close that hole in Phase 3.

---

## Phase 3 — Lock the doors

Run once Phase 2 is deployed and you've confirmed the live app is happy.

- `REVOKE SELECT ON players FROM anon, authenticated;`
  (The app reads via `players_public` instead.)
- `REVOKE SELECT ON settings FROM anon, authenticated;`
  (Settings become writable only through admin-gated RPCs.)
- Replace every `allow all` policy with strict role-based policies:
  writes to `tournaments`, `registrations`, `players`, `matches`,
  `settings`, `merch_items` only via RPC (which verify the admin PIN
  first); reactions/orders only via RPC (which verify the player PIN).
- Drop the plaintext `players.pin` column.
- Drop the plaintext `settings.admin_pin` column.
- Drop the sync triggers from Phase 1 (no longer needed).

After Phase 3, opening the browser console and running
`supabase.from('players').select('pin')` returns an empty result set,
not because of a bug but because anon has no read privilege on that
column. The same is true for email, phone, birthday, and the admin PIN.

---

## Phase 4 — Verify

From any ordinary browser:

1. Open the site in an incognito window.
2. Open the dev tools console.
3. Try:
   ```js
   const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
   const s = createClient('<YOUR_SUPABASE_URL>', '<YOUR_ANON_KEY>')
   console.log(await s.from('players').select('email,phone,birthday,pin'))
   ```
   The response should contain either an error ("permission denied for
   column …") or an array of rows where those fields are `null`.

If any of those fields come back populated, something didn't lock down
correctly — stop using the app and let me know.

---

## Rollback

Phase 1 is safe to leave in place even if you decide not to proceed —
it only adds things. If you want to remove it anyway:

```sql
drop trigger if exists trg_sync_player_pin_hash on players;
drop trigger if exists trg_sync_admin_pin_hash on settings;
drop function if exists sync_player_pin_hash();
drop function if exists sync_admin_pin_hash();
drop function if exists verify_player_pin(text);
drop function if exists verify_admin_pin(text);
drop function if exists get_my_profile(text);
drop function if exists get_all_players_with_pii(text);
drop view if exists players_public;
alter table players  drop column if exists pin_hash;
alter table settings drop column if exists admin_pin_hash;
```

Phases 2 and 3 are planned but not yet written. Nothing to roll back.
