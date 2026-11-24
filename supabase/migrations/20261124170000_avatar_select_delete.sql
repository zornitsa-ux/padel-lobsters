-- ============================================================================
-- Avatars a player or admin can see and remove (docs/account-deletion AD4,
-- CONTRACTS C-5).
--
-- storage.objects had no SELECT policy for the browser roles. Storage writes
-- with RETURNING and deletes only rows the caller can select, so every upload
-- was refused and every remove matched nothing, without an error. This adds
-- one, scoped like the delete policy.
--
-- Admins upload a player's photo under a random name, so "own" also covers the
-- file the player's own avatar_url names. Members can write any avatar_url, so
-- that counts only for a random-named file no other player's avatar_url names:
-- nobody can claim another player's photo. A file nobody uses can be claimed,
-- which costs no one anything. Uploads keep the stable-name rule.
-- ============================================================================

-- Public: storage policies run as the browser role, which has no usage on
-- `private`. Tells a player only about their own photo.
create function public.is_own_avatar(input_name text)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select auth.uid() is not null
     and (
       input_name = 'player-' || auth.uid()::text || '.webp'
       or (
         input_name !~* '^player-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
         and exists (
           select 1
             from public.players p
            where p.id = auth.uid()
              and substring(p.avatar_url from '/storage/v1/object/public/avatars/([^?#]+)') = input_name
         )
         and not exists (
           select 1
             from public.players p
            where p.id <> auth.uid()
              and substring(p.avatar_url from '/storage/v1/object/public/avatars/([^?#]+)') = input_name
         )
       )
     )
$function$;
revoke all on function public.is_own_avatar(text) from public, anon, authenticated;
grant execute on function public.is_own_avatar(text) to authenticated;

drop policy if exists "Player or admin delete avatar" on storage.objects;

create policy "Player or admin read avatar" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.is_own_avatar(name)
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

create policy "Player or admin delete avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and not public.is_deleted_player(auth.uid())
    and (
      public.is_own_avatar(name)
      or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );
