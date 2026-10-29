-- #99: 20260518000008 revoked every sequence from authenticated, but players
-- still insert into merch_interests (shop orders) and admins into merch_items
-- directly, so both inserts have failed since. RLS still gates the rows.

grant usage on sequence public.merch_interests_id_seq to authenticated;
grant usage on sequence public.merch_items_id_seq to authenticated;
