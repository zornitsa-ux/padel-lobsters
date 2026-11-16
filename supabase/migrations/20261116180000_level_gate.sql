-- ============================================================================
-- Signup revamp S3b: the gate is "is a level recorded" (DECISIONS D-16).
--
-- A player needs levelling only when they have no Playtomic level on file and
-- no levelling start. Playing a night no longer enters into it: players who
-- already have a level are never gated. The registration RPCs, the backstop
-- trigger and get_my_levelling all read this one function.
-- ============================================================================

create or replace function private.needs_levelling(input_player_id uuid)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select not exists (
           select 1 from public.players p
            where p.id = input_player_id and coalesce(p.playtomic_level, 0) > 0)
     and not exists (
           select 1 from public.player_levelling l where l.player_id = input_player_id);
$function$;

revoke all on function private.needs_levelling(uuid) from public, anon, authenticated;
