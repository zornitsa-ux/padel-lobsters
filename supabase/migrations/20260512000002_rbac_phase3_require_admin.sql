-- RBAC Phase 3: require_admin() authorization helper
--
-- Drop-in replacement for the pattern:
--   if not public.verify_admin_pin(input_admin_pin) then return; end if;
--
-- Usage inside any admin RPC:
--   perform public.require_admin();
--
-- Raises an exception if auth.uid() does not correspond to a player with
-- role = 'admin'. This relies on Phase 1 (role column) and Phase 2 (Supabase
-- Auth sessions) being in place before admin RPCs are rewritten to use it.
--
-- NOT security definer — intentionally reads players as the calling role so
-- that the auth.uid() context is preserved.

create or replace function public.require_admin()
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.players
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'unauthorized: admin required';
  end if;
end;
$$;
