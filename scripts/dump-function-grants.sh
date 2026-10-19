#!/usr/bin/env bash
# Print the anon/authenticated EXECUTE grants on schema `public`, one
# "signature role" per line, sorted.
#
# Two consumers, so the query lives here rather than inline in package.json
# and can't drift between them:
#   npm run db:grants        — rewrites supabase/expected_function_grants.txt
#   npm run db:grants:check  — diffs this output against that file (also CI)
#
# service_role/postgres/supabase_auth_admin are excluded deliberately: they are
# trusted server roles granted in bulk, and listing them would bury the two
# roles a browser can actually present.
#
# pg_get_function_identity_arguments (not pg_get_function_arguments) so the
# rendering omits DEFAULT clauses and stays stable when a default changes.
#
# LC_ALL=C on the sort is load-bearing: macOS collation orders `_` before `(`
# and Linux's C collation does the reverse, so a file generated on a dev's Mac
# could never match what CI produced (`admin_create_league` vs
# `admin_create_league_team`). The ordering must not depend on who ran it.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
expected_file="$repo_root/supabase/expected_function_grants.txt"

source "$repo_root/scripts/lib/supabase-cli.sh"

write_mode=false
if [[ "${1:-}" == "--write" ]]; then
  write_mode=true
fi

dump() {
  "$supabase_cli" db query --local --output-format json "
    select 'public.' || p.proname
           || '(' || pg_get_function_identity_arguments(p.oid) || ') '
           || r.rolname as line
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join aclexplode(p.proacl) a on true
      join pg_roles r on r.oid = a.grantee
     where n.nspname = 'public'
       and a.privilege_type = 'EXECUTE'
       and r.rolname in ('anon', 'authenticated')
     order by line
  " | json_rows line | jq -r .line | LC_ALL=C sort
}

output="$(dump)"

# An empty result means the query or the extraction broke, never a real state:
# self_signup_player and verify_player_pin_v2 are permanently anon-granted.
# Failing here keeps a broken run from being written down as the new baseline,
# which would leave the drift check passing against nothing.
if [[ -z "$output" ]]; then
  echo "error: no grants extracted — is the local stack running (\`npm run db:start\`)?" >&2
  exit 1
fi

if [[ "$write_mode" == true ]]; then
  printf '%s\n' "$output" > "$expected_file"
  echo "Wrote $(printf '%s\n' "$output" | wc -l | tr -d ' ') grants to ${expected_file#"$repo_root"/}" >&2
else
  printf '%s\n' "$output"
fi
