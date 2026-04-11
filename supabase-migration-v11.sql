-- v11: Add paid & delivered tracking to merch orders
alter table merch_interests add column if not exists paid boolean default false;
alter table merch_interests add column if not exists delivered boolean default false;
alter table merch_interests add column if not exists custom_name text default '';
