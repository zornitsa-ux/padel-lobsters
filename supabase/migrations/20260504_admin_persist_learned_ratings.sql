-- ---------------------------------------------------------------------
-- admin_persist_learned_ratings — bulk-write Glicko-2 recompute results.
--
-- Why: anon (correctly) has no UPDATE on public.players. The client-side
-- recomputeAllRatings() in src/lib/ratingsRecompute.js needs to persist
-- learned_rating / learned_rd / learned_volatility / learned_matches_count
-- / learned_updated_at for every player, plus stamp ratings_applied_at on
-- the DB tournaments that were folded in. This RPC is the SECURITY DEFINER
-- door for that, gated by verify_admin_pin like every other admin_* RPC.
--
-- Updates only — never inserts. IDs always come from existing players.
-- ---------------------------------------------------------------------

create or replace function public.admin_persist_learned_ratings(
  input_admin_pin              text,
  input_updates                jsonb,           -- array of {id, learned_rating, learned_rd, learned_volatility, learned_matches_count, learned_updated_at}
  input_applied_tournament_ids uuid[] default '{}'
)
returns int                                     -- number of player rows updated
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_updated_count int := 0;
  v_now           timestamptz := now();
begin
  set local statement_timeout = '30s';
  if not public.verify_admin_pin(input_admin_pin) then return 0; end if;
  if input_updates is null or jsonb_typeof(input_updates) <> 'array' then return 0; end if;

  with src as (
    select
      (e->>'id')::uuid                                                   as id,
      coalesce((e->>'learned_rating')::numeric, 1500)                    as learned_rating,
      coalesce((e->>'learned_rd')::numeric, 350)                         as learned_rd,
      coalesce((e->>'learned_volatility')::numeric, 0.06)                as learned_volatility,
      coalesce((e->>'learned_matches_count')::int, 0)                    as learned_matches_count,
      coalesce(nullif(e->>'learned_updated_at','')::timestamptz, v_now)  as learned_updated_at
    from jsonb_array_elements(input_updates) as e
  )
  update public.players p
     set learned_rating        = src.learned_rating,
         learned_rd            = src.learned_rd,
         learned_volatility    = src.learned_volatility,
         learned_matches_count = src.learned_matches_count,
         learned_updated_at    = src.learned_updated_at
    from src
   where p.id = src.id;

  get diagnostics v_updated_count = row_count;

  if input_applied_tournament_ids is not null
     and array_length(input_applied_tournament_ids, 1) > 0 then
    update public.tournaments
       set ratings_applied_at = v_now
     where id = any(input_applied_tournament_ids);
  end if;

  return v_updated_count;
end;
$$;

revoke execute on function public.admin_persist_learned_ratings(text, jsonb, uuid[]) from public;
grant  execute on function public.admin_persist_learned_ratings(text, jsonb, uuid[]) to anon, authenticated;
