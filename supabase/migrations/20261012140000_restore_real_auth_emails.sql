-- Restore real addresses on auth.users rows that verify-pin overwrote.
--
-- The deployed verify-pin edge function predated #9 (magic-link sign-in) and
-- reset auth.users.email to player-<id>@padelobsters.internal on every PIN
-- sign-in. Those players then could not use "Email me a sign-in link", since
-- magic link looks the user up by auth.users.email.
--
-- ORDER: deploy the repo's verify-pin first (it leaves the email alone);
-- otherwise the next PIN sign-in undoes this for that player.
--
-- Only synthetic rows whose player has a well-formed email that no other auth
-- user holds are touched. auth_users_email_sync mirrors the (lower-cased)
-- value back to players.email, which is a no-op apart from case.

update auth.users u
   set email              = lower(btrim(p.email)),
       email_confirmed_at = coalesce(u.email_confirmed_at, now())
  from public.players p
 where p.id = u.id
   and u.email like 'player-%@padelobsters.internal'
   -- players_email_lower_unique makes these addresses distinct within this set.
   and coalesce(p.status, 'active') <> 'deleted'
   and lower(btrim(p.email)) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
   and not exists (
     select 1 from auth.users o
      where o.id <> u.id and lower(o.email) = lower(btrim(p.email))
   );
