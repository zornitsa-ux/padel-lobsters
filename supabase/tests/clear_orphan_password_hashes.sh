#!/usr/bin/env bash
# ============================================================================
# Orphan password hash cleanup (20261015120000).
#
# Plants a bcrypt hash and an empty string on two seeded auth users, replays
# the migration file itself, and checks that no hash is left. Everything runs
# inside one transaction that rolls back.
#
#   supabase/tests/clear_orphan_password_hashes.sh
# ============================================================================
set -euo pipefail

migration="$(dirname "$0")/../migrations/20261015120000_clear_orphan_password_hashes.sql"

{
  cat <<'SQL'
begin;

create temp table planted on commit drop as
select id, email,
       case when row_number() over (order by id) = 1
            then '$2a$10$abcdefghijklmnopqrstuuK1rB4mGQ0u0q0X6dYk5Cq2zjC7mGm5e'
            else '' end as hash
  from auth.users
 order by id
 limit 2;

update auth.users u
   set encrypted_password = p.hash
  from planted p
 where p.id = u.id;

do $$
begin
  if (select count(*) from auth.users where encrypted_password is not null) < 2 then
    raise exception 'setup: expected at least 2 planted hashes';
  end if;
end $$;
SQL
  cat "$migration"
  cat <<'SQL'

do $$
declare
  v_left int;
begin
  select count(*) into v_left from auth.users where encrypted_password is not null;
  if v_left <> 0 then
    raise exception 'expected 0 non-null password hashes, found %', v_left;
  end if;

  if exists (
    select 1 from planted p
      left join auth.users u on u.id = p.id
     where u.id is null or u.email is distinct from p.email
  ) then
    raise exception 'planted users must survive with their email unchanged';
  end if;

  raise notice 'clear_orphan_password_hashes: all checks passed';
end $$;

rollback;
SQL
} | docker exec -i supabase_db_padel-lobsters psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
