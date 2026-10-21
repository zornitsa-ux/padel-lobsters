-- Three league placeholders (Emre, Lucie, Yaiza) later signed up with their own
-- accounts. Point their league teams at the real accounts, then delete the
-- placeholders and their synthetic auth users. The second "Yaiza López"
-- placeholder was never on a team.

create temporary table placeholder_merge (placeholder_id uuid primary key, real_id uuid) on commit drop;

insert into placeholder_merge (placeholder_id, real_id) values
  ('4a4a4199-7ecc-4158-b633-0706a410a79b', '39964942-af5e-4730-be6b-2bad74bb0b85'), -- Emre Can Türkkan
  ('0591a63b-e3e7-42b6-b66b-2f98560cb06d', '834e7222-edfa-464b-8043-fed81abc3c01'), -- Lucie
  ('6275b7c4-4d87-4cf2-984d-735ade4345fc', 'abc5b2e7-c663-48b9-944b-c1095c9f1e68'), -- Yaiza López
  ('77a3afe4-6351-4ecb-9077-744648d494fb', 'abc5b2e7-c663-48b9-944b-c1095c9f1e68'); -- Yaiza López (unused duplicate)

update public.league_teams t
   set player1_id = m.real_id
  from placeholder_merge m
 where t.player1_id = m.placeholder_id;

update public.league_teams t
   set player2_id = m.real_id
  from placeholder_merge m
 where t.player2_id = m.placeholder_id;

delete from public.players p
 using placeholder_merge m
 where p.id = m.placeholder_id
   and p.status = 'placeholder';

delete from auth.users u
 using placeholder_merge m
 where u.id = m.placeholder_id
   and not exists (select 1 from public.players p where p.id = u.id);
