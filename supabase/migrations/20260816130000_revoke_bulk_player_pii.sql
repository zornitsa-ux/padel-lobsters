-- get_all_players_with_pii_v2 has no remaining client callers — the scoped
-- admin_get_player_pii (20260816120000_scoped_player_pii.sql) replaced it —
-- but it was still grant execute ... to authenticated, so any admin token
-- could dump the whole roster's PII in one call. Revoke rather than drop:
-- dropping would require regenerating src/lib/database.types.ts, which is
-- out of scope here.

revoke execute on function public.get_all_players_with_pii_v2() from public, anon, authenticated;
