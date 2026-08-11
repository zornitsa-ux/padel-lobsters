-- Remove player_responsible court-booking mode — unused in production (all 6
-- tournaments to date are admin_all) and it doubled the branching in every
-- payment/pricing code path for a feature nobody ever picked. `courts` stays
-- (it's also used by admin_all as a plain booking checklist: name + booked),
-- but the payment-only fields that only ever applied to player_responsible
-- (cost_per_person, responsible, tikkie_link per court) are stripped out.
--
-- DEPLOY ORDER: frontend FIRST, then this migration. The previous bundle
-- writes court_booking_mode in every addTournament insert and updateTournament
-- save, so pushing this ahead of the deploy breaks admin event create/save
-- with PGRST204 until the new frontend is live.

-- Court position is load-bearing (the UI labels them "Court N" by index and
-- books by index), so the rewrite preserves array order via `with ordinality`.
-- Rows whose `courts` is not a JSON array are left untouched rather than
-- aborting the migration.
update public.tournaments
set courts = (
  select coalesce(
    jsonb_agg(jsonb_build_object('name', e.elem->'name', 'booked', e.elem->'booked') order by e.ord),
    '[]'::jsonb
  )
  from jsonb_array_elements(courts) with ordinality as e(elem, ord)
)
where jsonb_typeof(courts) = 'array' and courts <> '[]'::jsonb;

alter table public.tournaments drop column if exists court_booking_mode;
