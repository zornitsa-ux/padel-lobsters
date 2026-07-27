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
set -euo pipefail

supabase db query --local --output-format json "
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
" | jq -r '.rows[].line' | sort
