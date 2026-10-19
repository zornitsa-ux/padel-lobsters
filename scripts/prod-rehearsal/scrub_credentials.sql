-- Runs in the same transaction as the production data load (sync.sh), so no
-- credential that works against production is ever committed locally.
--
-- Auth tables holding sessions, refresh tokens, one-time tokens and MFA secrets
-- are never dumped (sync.sh copies only users, identities and instances). This
-- covers the credential columns inside the tables that are copied. A new
-- credential column in public or auth.users must be added here.
set local session_replication_role = replica;

-- Link and confirmation tokens are usable against production's /verify.
-- GoTrue scans these as non-null strings, so they become '' rather than NULL.
update auth.users
   set encrypted_password         = null,
       confirmation_token         = '',
       recovery_token             = '',
       email_change_token_new     = '',
       email_change_token_current = '',
       reauthentication_token     = '',
       phone_change_token         = '';

-- PINs are live credentials until cutover (players.pin is plaintext).
update public.players
   set pin = null, pin_hash = null
 where pin is not null or pin_hash is not null;

update public.pin_attempts
   set ip_address = null, user_agent = null
 where ip_address is not null or user_agent is not null;
