-- ================================================================
--  PADEL LOBSTERS — v14d Security Migration patch
--
--  Birthday privacy: show month + day publicly (so the app can
--  display "🎂 March 15" on dashboards and profile cards), but
--  NEVER expose the birth year through the public view. The full
--  birthday (with year) is only reachable via:
--    - get_my_profile(pin)           -- the player themselves
--    - get_all_players_with_pii(pin) -- admin only
--
--  Phone/email are already protected the same way (they simply
--  aren't in players_public at all). This patch adds a computed
--  `birthday_md` column to players_public so clients can render
--  month/day without ever seeing the year.
--
--  Idempotent. Safe to run on top of v14 + v14b + v14c.
-- ================================================================

-- Recreate the public view. `create or replace view` keeps the
-- existing grants (anon + authenticated SELECT) intact as long as
-- we don't change the column list order of pre-existing columns.
-- To be safe we drop and recreate, then re-grant.

drop view if exists players_public;

create view players_public as
select
  id,
  name,
  status,
  gender,
  is_left_handed,
  preferred_position,
  country,
  tagline,
  tagline_label,
  playtomic_level,
  adjustment,
  adjusted_level,
  avatar_url,
  created_at,
  -- Month + day only. Returns e.g. '03-15' or null.
  -- The birth year is deliberately omitted.
  case
    when birthday is null then null
    else to_char(birthday, 'MM-DD')
  end as birthday_md,
  -- Integer helpers for clients that want to sort / filter without
  -- parsing a string. Both null when birthday is null.
  extract(month from birthday)::int as birthday_month,
  extract(day   from birthday)::int as birthday_day
from players;

grant select on players_public to anon, authenticated;


-- ================================================================
--  Verification
--
--    -- Should list non-PII columns + birthday_md / month / day,
--    -- but NOT email, phone, birthday, pin, notes.
--    select * from players_public limit 3;
--
--    -- Year should still be available to yourself:
--    select id, name, birthday from get_my_profile('your-pin');
--
--    -- And to admin:
--    select id, name, birthday
--      from get_all_players_with_pii('your-admin-pin')
--     limit 3;
-- ================================================================
