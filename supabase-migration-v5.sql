-- Migration v5: left-handed flag on players + gender mode on tournaments
alter table players
  add column if not exists is_left_handed boolean default false;

alter table tournaments
  add column if not exists gender_mode text default 'mixed';
