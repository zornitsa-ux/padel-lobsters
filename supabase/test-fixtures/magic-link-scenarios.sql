-- Magic-link test fixtures.
--
-- Run after `npm run db:reset` to set up four players covering every
-- auth scenario. Apply with:
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -f supabase/test-fixtures/magic-link-scenarios.sql
--
-- Or paste into Supabase Studio's SQL editor at http://127.0.0.1:54323

-- Scenario A — Alice: real email + PIN. Both auth methods should work.
UPDATE public.players
SET email = 'alice@lobsters.test',
    pin = '1111',
    pin_hash = extensions.crypt('1111', extensions.gen_salt('bf')),
    role = 'player'
WHERE name = 'Adriana Dinu';

-- Scenario B — Bob: real email + PIN. Used to test the magic-link path
-- as the primary login (treat PIN as "backup").
UPDATE public.players
SET email = 'bob@lobsters.test',
    pin = '2222',
    pin_hash = extensions.crypt('2222', extensions.gen_salt('bf')),
    role = 'player'
WHERE name = 'Aimée van der Pijl';

-- Scenario C — Charlie: NULL email. Legacy "emailless player" case.
-- PIN login must keep working; magic link should report unknown email.
UPDATE public.players
SET email = NULL,
    pin = '3333',
    pin_hash = extensions.crypt('3333', extensions.gen_salt('bf')),
    role = 'player'
WHERE name = 'ALEJANDRO González';

-- Scenario D — Dani: admin with email. Verifies the auth hook gives
-- admin role even when sign-in came via magic link (not just PIN).
UPDATE public.players
SET email = 'admin@lobsters.test',
    pin = '4444',
    pin_hash = extensions.crypt('4444', extensions.gen_salt('bf')),
    role = 'admin'
WHERE name = 'Alejandro Muñoz';

-- Open the auto-trust window so first device on every login is trusted.
-- Reset migration sets this to default; this just guarantees a 7-day
-- window even if the migration ran days ago.
UPDATE public.settings SET auto_trust_until = now() + interval '7 days';


-- ---------------------------------------------------------------------
-- Scenario E — Email change (Alice).
--
-- GoTrue's secure_email_change setting is enabled (config.toml) so it
-- DOES send confirmation to both addresses, but v2.189 collapses the
-- double-confirm requirement when redeeming via verifyOtp(token_hash):
-- the FIRST click applies the change, the second link reports
-- "expired". We treat that as expected — the email to the old address
-- is a security notification, and the user only needs to act on one.
--
-- Walkthrough (no extra fixture data needed beyond Alice from Scenario A):
--   1. Sign in as Alice (PIN 1111 or magic link to alice@lobsters.test).
--   2. Settings → expand "My Lobster Profile" → next to Email click Change.
--   3. Enter alice2@lobsters.test → Send confirmation.
--   4. In Mailpit (http://127.0.0.1:54324) expect TWO emails:
--        - "Confirm your Padel Lobsters email change" to alice@lobsters.test
--        - "Confirm your Padel Lobsters email change" to alice2@lobsters.test
--   5. Click EITHER link → land on /auth/confirm → "Email updated"
--      screen → "Back to settings".
--   6. Settings → email row should now read alice2@lobsters.test.
--   7. (Optional) Click the OTHER link — should show "Link didn't work
--      / no longer valid". This is expected; that email is a
--      security notification, not a second confirmation step.
--
-- Verify via SQL (paste into Studio):
--   select email from public.players where name = 'Adriana Dinu';
--   -- expect: alice2@lobsters.test
--   select email from auth.users where id =
--     (select id from public.players where name = 'Adriana Dinu');
--   -- expect: alice2@lobsters.test  (sync_auth_email_to_player mirrored it)
--
-- Reset just this scenario (so you can re-run without a full db:reset):
--   update public.players set email = 'alice@lobsters.test'
--     where name = 'Adriana Dinu';
--   -- The players_email_sync trigger pushes auth.users.email back too.
-- ---------------------------------------------------------------------
