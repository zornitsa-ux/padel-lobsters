#!/usr/bin/env bash
# Dumps the privileges a browser can present (anon, authenticated, PUBLIC) on
# schema `public`, one grant per line, sorted, into two files:
#   supabase/expected_function_grants.txt  EXECUTE on functions
#   supabase/expected_table_grants.txt     tables, views and sequences, plus
#                                          column grants ("rel.col")
#
#   npm run db:grants        — rewrites both files from the local stack
#   npm run db:grants:check  — fails if the local stack differs (also CI)
#   npm run db:grants:prod   — compares production, read-only (--linked)
#
# Production runs older Supabase default privileges than the local image (#102),
# so a migration that forgets a grant or revoke behaves differently there. The
# check against the files catches that locally; db:grants:prod catches drift
# already in production.
#
# service_role/postgres/supabase_auth_admin are excluded: trusted server roles
# granted in bulk, which would bury the two roles a browser can present.
#
# pg_get_function_identity_arguments (not pg_get_function_arguments) so the
# rendering omits DEFAULT clauses and stays stable when a default changes.
#
# LC_ALL=C on the sort is load-bearing: macOS collation orders `_` before `(`
# and Linux's C collation does the reverse, so a file generated on a Mac could
# never match what CI produced.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
functions_file="$repo_root/supabase/expected_function_grants.txt"
tables_file="$repo_root/supabase/expected_table_grants.txt"

source "$repo_root/scripts/lib/supabase-cli.sh"

mode=print
target=--local
for arg in "$@"; do
  case "$arg" in
    --write) mode=write ;;
    --check) mode=check ;;
    --linked) target=--linked ;;
    *) echo "usage: $0 [--write|--check] [--linked]" >&2; exit 2 ;;
  esac
done
if [[ "$mode" == write && "$target" == --linked ]]; then
  echo "error: the expected files are written from the local stack only." >&2
  exit 2
fi

query() {
  "$supabase_cli" db query "$target" --output-format json "$1" | json_rows line | jq -r .line | LC_ALL=C sort
}

grantee_sql="case a.grantee when 0 then 'PUBLIC' else a.grantee::regrole::text end"
browser_roles="a.grantee in (0, 'anon'::regrole, 'authenticated'::regrole)"

functions_sql="
  select 'public.' || p.proname
         || '(' || pg_get_function_identity_arguments(p.oid) || ') '
         || $grantee_sql as line
    from pg_proc p
    join aclexplode(p.proacl) a on true
   where p.pronamespace = 'public'::regnamespace
     and a.privilege_type = 'EXECUTE'
     and $browser_roles"

tables_sql="
  select 'public.' || c.relname || ' ' || $grantee_sql || ' '
         || string_agg(a.privilege_type, ',' order by a.privilege_type) as line
    from pg_class c
    join aclexplode(c.relacl) a on true
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
     and $browser_roles
   group by c.relname, a.grantee
  union all
  select 'public.' || c.relname || '.' || att.attname || ' ' || $grantee_sql || ' '
         || string_agg(a.privilege_type, ',' order by a.privilege_type)
    from pg_class c
    join pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
    join aclexplode(att.attacl) a on true
   where c.relnamespace = 'public'::regnamespace
     and $browser_roles
   group by c.relname, att.attname, a.grantee"

functions="$(query "$functions_sql")"
tables="$(query "$tables_sql")"

# Empty output means the query or the extraction broke, never a real state:
# self_signup_player is permanently anon-granted and members read tournaments.
# Failing here keeps a broken run from being written down as the new baseline.
if [[ -z "$functions" || -z "$tables" ]]; then
  echo "error: no grants extracted — is the local stack running (\`npm run db:start\`), or the project linked?" >&2
  exit 1
fi

case "$mode" in
  write)
    printf '%s\n' "$functions" > "$functions_file"
    printf '%s\n' "$tables" > "$tables_file"
    echo "Wrote ${functions_file#"$repo_root"/} and ${tables_file#"$repo_root"/}" >&2
    ;;
  check)
    status=0
    diff -u --label expected_function_grants.txt "$functions_file" --label "functions ($target)" <(printf '%s\n' "$functions") || status=1
    diff -u --label expected_table_grants.txt "$tables_file" --label "tables ($target)" <(printf '%s\n' "$tables") || status=1
    if (( status )); then
      echo "Grants for anon/authenticated drifted from supabase/expected_*_grants.txt — review the diff above. If the change is intentional, run \`npm run db:grants\` and commit the result." >&2
    fi
    exit "$status"
    ;;
  print)
    printf '%s\n' "$functions"
    printf '%s\n' "$tables"
    ;;
esac
