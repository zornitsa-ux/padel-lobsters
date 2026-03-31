-- ================================================================
--  PADEL LOBSTERS – Supabase Database Setup
--  Copy and paste this entire file into the Supabase SQL Editor
--  and click "Run". It creates all the tables the app needs.
-- ================================================================

-- Players table
create table if not exists players (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  email              text,
  phone              text,
  playtomic_level    numeric default 0,
  adjustment         numeric default 0,
  adjusted_level     numeric default 0,
  playtomic_username text,
  notes              text,
  created_at         timestamptz default now()
);

-- Tournaments table
create table if not exists tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date        date,
  time        text,
  max_players integer default 16,
  format      text default 'americano',
  courts      jsonb default '[]',
  notes       text,
  status      text default 'upcoming',
  created_at  timestamptz default now()
);

-- Registrations table
create table if not exists registrations (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid references tournaments(id) on delete cascade,
  player_id      uuid references players(id) on delete cascade,
  status         text default 'registered',
  payment_status text default 'unpaid',
  payment_method text default '',
  created_at     timestamptz default now()
);

-- Matches table
create table if not exists matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  round         integer default 1,
  court         text,
  team1_ids     uuid[] default '{}',
  team2_ids     uuid[] default '{}',
  team1_level   numeric default 0,
  team2_level   numeric default 0,
  score1        integer,
  score2        integer,
  completed     boolean default false,
  created_at    timestamptz default now()
);

-- Settings table (single row)
create table if not exists settings (
  id             integer primary key default 1,
  whatsapp_link  text default '',
  admin_pin      text default '1234',
  group_name     text default 'Padel Lobsters'
);

-- Insert default settings row
insert into settings (id) values (1) on conflict (id) do nothing;

-- Enable Row Level Security but allow all for now (private app)
alter table players      enable row level security;
alter table tournaments  enable row level security;
alter table registrations enable row level security;
alter table matches      enable row level security;
alter table settings     enable row level security;

-- Allow all operations (change later if you want stricter access)
create policy "allow all" on players      for all using (true) with check (true);
create policy "allow all" on tournaments  for all using (true) with check (true);
create policy "allow all" on registrations for all using (true) with check (true);
create policy "allow all" on matches      for all using (true) with check (true);
create policy "allow all" on settings     for all using (true) with check (true);

-- Enable real-time for live updates
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table registrations;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table settings;
