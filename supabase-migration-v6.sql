-- Migration v6: merch items, player interests, tournament prizes

-- Merch catalogue
create table if not exists merch_items (
  id          serial primary key,
  name        text    not null,
  description text    default '',
  price       numeric default 0,
  sizes       text[]  default '{}',
  image_url   text    default '',
  category    text    default 'apparel',
  active      boolean default true,
  created_at  timestamptz default now()
);

-- Player interest in specific items
create table if not exists merch_interests (
  id             serial primary key,
  player_id      integer references players(id) on delete cascade,
  merch_item_id  integer references merch_items(id) on delete cascade,
  size           text default '',
  created_at     timestamptz default now(),
  unique(player_id, merch_item_id)
);

-- Prize items per tournament (array of merch_item ids)
alter table tournaments
  add column if not exists prize_item_ids integer[] default '{}';

-- Supabase Storage bucket for merch images (public)
insert into storage.buckets (id, name, public)
  values ('merch', 'merch', true)
  on conflict do nothing;

-- Allow anyone to read merch images
create policy if not exists "Public merch read"
  on storage.objects for select
  using (bucket_id = 'merch');

-- Allow uploads (authenticated or anon — adjust to taste)
create policy if not exists "Merch upload"
  on storage.objects for insert
  with check (bucket_id = 'merch');

-- Seed default merch items
insert into merch_items (name, description, price, sizes, category) values
  ('Technical T-Shirt',  'Moisture-wicking padel performance tee',  40, array['XS','S','M','L','XL','XXL'], 'apparel'),
  ('Cotton T-Shirt',     'Classic Padel Lobsters cotton tee',        35, array['XS','S','M','L','XL','XXL'], 'apparel'),
  ('Cap',                'Padel Lobsters snapback cap',              20, array[]::text[], 'accessories'),
  ('Canvas Bag',         'Padel Lobsters canvas tote bag',           18, array[]::text[], 'accessories'),
  ('Socks',              'Padel grip socks',                         10, array['S (35-38)','M (39-42)','L (43-46)'], 'accessories'),
  ('Stickers Pack',      'Set of 5 Padel Lobsters stickers',          5, array[]::text[], 'accessories')
on conflict do nothing;
