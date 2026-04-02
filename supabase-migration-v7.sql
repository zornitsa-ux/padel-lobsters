-- Migration v7: player avatar photos

-- Add avatar_url column to players
alter table players
  add column if not exists avatar_url text default '';

-- Storage bucket for avatar images (public)
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict do nothing;

-- Storage policies (drop first to avoid conflicts on re-run)
do $$ begin
  drop policy if exists "Public avatar read"   on storage.objects;
  drop policy if exists "Avatar upload"        on storage.objects;
  drop policy if exists "Avatar update"        on storage.objects;
end $$;

create policy "Public avatar read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Avatar upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

create policy "Avatar update"
  on storage.objects for update
  using (bucket_id = 'avatars');
