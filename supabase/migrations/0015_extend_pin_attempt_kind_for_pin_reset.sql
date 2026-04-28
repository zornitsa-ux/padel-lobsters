-- Migration 0015 — allow 'pin_reset' as a valid pin_attempts.attempt_kind
--
-- The forgot_my_pin RPC logs every reset attempt (success and failure)
-- under attempt_kind='pin_reset' for audit trail and rate-limiting. The
-- existing CHECK constraint on pin_attempts.attempt_kind didn't include
-- this kind, so live calls were 400ing in PostgREST with constraint
-- violation. Extending the allow-list.
alter table public.pin_attempts drop constraint pin_attempts_attempt_kind_check;
alter table public.pin_attempts add constraint pin_attempts_attempt_kind_check
  check (attempt_kind = any (array[
    'player'::text,
    'admin'::text,
    'pii_dump'::text,
    'approve_device'::text,
    'admin_unlock'::text,
    'admin_action'::text,
    'signup'::text,
    'pin_reset'::text
  ]));
