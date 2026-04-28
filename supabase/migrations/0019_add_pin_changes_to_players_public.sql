-- Migration 0019 — expose pin_changes in players_public
--
-- Lets the admin Players list display "how many PIN resets has this
-- player had" without going through the heavier
-- get_all_players_with_pii_v2 RPC. pin_changes is a behavioural counter
-- (incremented every time a PIN is regenerated or reset), safe to expose
-- alongside the existing pseudo-public fields like tagline, level,
-- country.

-- CREATE OR REPLACE VIEW only allows APPENDING columns to a view (not
-- inserting them in the middle), so pin_changes lives at the end of the
-- column list rather than next to the other counters.

create or replace view public.players_public
with (security_invoker = false) as
select id, name, status, gender, is_left_handed, preferred_position,
       country, tagline, tagline_label, playtomic_level, adjustment,
       adjusted_level, avatar_url, created_at,
       case when birthday is null then null::text
            else to_char(birthday::timestamp with time zone, 'MM-DD'::text)
       end as birthday_md,
       extract(month from birthday)::integer as birthday_month,
       extract(day from birthday)::integer as birthday_day,
       coalesce(pin_changes, 0) as pin_changes
  from public.players;

grant select on public.players_public to anon, authenticated;
