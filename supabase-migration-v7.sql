-- Migration v7: player avatar photos

-- Add avatar_url column to players
alter table players
  add column if not exists avatar_url text default '';

-- Storage bucket for avatar images (public)
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict do nothing;

-- Allow anyone to view avatars
create policy if not exists "Public avatar read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Allow uploads (authenticated or anon)
create policy if not exists "Avatar upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars');

-- Allow overwriting (upsert)
create policy if not exists "Avatar update"
  on storage.objects for update
  using (bucket_id = 'avatars');
