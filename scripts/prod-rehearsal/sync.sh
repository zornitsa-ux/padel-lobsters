#!/usr/bin/env bash
# Replace the local database with a copy of production's public + auth data
# (docs/pin-auth-removal/PLAN.md §4.5, steps 1–2).
#
#   scripts/prod-rehearsal/sync.sh [--yes]
#
# Run it from a checkout whose migrations match production (normally main).
# Afterwards, check out the PR branch and run `npx supabase migration up --local`
# to rehearse exactly what `db push` will do. `npm run db:reset` puts the seed
# data back.
#
# Refuses to run unless every safety check holds:
#   - local auth mail goes to Mailpit, so no player can be emailed;
#   - the local GoTrue version is production's;
#   - local migrations are exactly production's;
#   - Vault is empty locally. Database functions post to production edge
#     function URLs using a Vault secret, so without one they fail closed.
# Only auth.users, auth.identities and auth.instances are copied from auth
# (no sessions, refresh tokens, one-time tokens or MFA secrets). Every other
# auth table production has is excluded, and after the load each one must be
# empty locally. The remaining credential columns are wiped in the load
# transaction (scrub_credentials.sql). The dump lives in a private temp
# directory that is removed on exit.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../.." && pwd)"
source "$repo_root/scripts/lib/supabase-cli.sh"
db_container=supabase_db_padel-lobsters
auth_container=supabase_auth_padel-lobsters
auth_tables_copied="users identities instances"

die() { echo "sync: $*" >&2 && exit 1; }
local_sql() { docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At "$@"; }
gotrue_version() { curl -fsS "$1/auth/v1/health" -H "apikey: $2" | jq -er .version; }

assume_yes=false
[[ "${1:-}" == "--yes" ]] && assume_yes=true

cd "$repo_root"

echo "Checking the local stack..."
[[ "$(docker inspect -f '{{.State.Running}}' "$auth_container" 2>/dev/null)" == "true" ]] ||
  die "the local stack isn't running (npx supabase start)"

smtp_host="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$auth_container" |
  sed -n 's/^GOTRUE_SMTP_HOST=//p')"
[[ "$smtp_host" == supabase_inbucket_* ]] ||
  die "local auth mail goes to '$smtp_host', not Mailpit. Disable [auth.email.smtp] and restart the stack"

local_env="$("$supabase_cli" status -o env)" || die "couldn't read the local stack's keys (supabase status)"
local_var() { sed -n "s/^$1=\"\(.*\)\"$/\1/p" <<<"$local_env" | grep . || die "supabase status has no $1"; }
local_api="$(local_var API_URL)"
local_anon_key="$(local_var ANON_KEY)"
service_key="$(local_var SERVICE_ROLE_KEY)"

[[ -f supabase/.temp/project-ref ]] || die "no linked project. Run npx supabase link"
project_ref="$(cat supabase/.temp/project-ref)"
prod_anon_key="$("$supabase_cli" projects api-keys --project-ref "$project_ref" -o json |
  jq -er '.[] | select(.name == "anon") | .api_key')" || die "couldn't fetch production's anon key"
prod_gotrue="$(gotrue_version "https://$project_ref.supabase.co" "$prod_anon_key")" ||
  die "couldn't read production's GoTrue version"
local_gotrue="$(gotrue_version "$local_api" "$local_anon_key")" || die "couldn't read the local GoTrue version"
[[ "$prod_gotrue" == "$local_gotrue" ]] ||
  die "GoTrue is $local_gotrue locally but $prod_gotrue in production. Run npx supabase link, then npx supabase stop && npx supabase start"

echo "Comparing local migrations with production..."
mismatched="$("$supabase_cli" migration list --linked --output-format json |
  jq -r '.migrations[] | select(.local != .remote) | "\(.local // "-") / \(.remote // "-")"')" ||
  die "couldn't compare migrations with production (supabase migration list --linked)"
[[ -z "$mismatched" ]] ||
  die "local and production migrations differ (local / remote):
$mismatched
Check out main, or the commit production is on."

if ! $assume_yes; then
  read -r -p "This wipes the local database and loads production data. Continue? [y/N] " answer
  [[ "$answer" == [yY] ]] || exit 1
fi

# Excludes are built from production's catalog, the side being dumped, so an
# auth table that exists only there is still left out.
prod_auth_tables="$("$supabase_cli" db query --linked --output-format json "
    select c.relname as auth_table
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'auth' and c.relkind in ('r', 'p')" |
  json_rows auth_table | jq -r .auth_table)" || die "couldn't list production's auth tables"
# An empty or partial list would exclude too little, never too much.
for table in $auth_tables_copied sessions refresh_tokens one_time_tokens; do
  grep -qx "$table" <<<"$prod_auth_tables" || die "production's auth table list has no '$table'; refusing to dump"
done
exclude=()
for table in $prod_auth_tables; do
  [[ " $auth_tables_copied " == *" $table "* ]] || exclude+=(-x "auth.$table")
done

"$supabase_cli" db reset --local --no-seed
[[ "$(local_sql -c 'select count(*) from vault.secrets')" == "0" ]] || die "Vault isn't empty locally"

umask 077
dump_dir="$(mktemp -d)"
trap 'rm -rf "$dump_dir"' EXIT

echo "Dumping production data..."
"$supabase_cli" db dump --linked --data-only --schema public,auth "${exclude[@]}" -f "$dump_dir/prod.sql"

echo "Loading it locally (one transaction)..."
cat "$dump_dir/prod.sql" "$here/scrub_credentials.sql" | local_sql -q --single-transaction -f - >/dev/null

# Proves the excludes held: apart from the copied tables and GoTrue's own
# migration bookkeeping, every local auth table is still empty.
copied_list="'${auth_tables_copied// /', '}', 'schema_migrations'"
nonempty="$(local_sql -c "
  select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'auth' and c.relkind in ('r', 'p') and c.relname not in ($copied_list)
     and (xpath('/row/n/text()',
                query_to_xml(format('select count(*) as n from auth.%I', c.relname), false, true, '')
         ))[1]::text::int > 0")"
[[ -z "$nonempty" ]] || die "auth tables that should be empty have rows after the load: $nonempty. Run npm run db:reset"

# GoTrue must be able to read every loaded user, not just Postgres.
auth_users="$(local_sql -c 'select count(*) from auth.users')"
gotrue_users="$(curl -fsS -D - -o /dev/null "$local_api/auth/v1/admin/users?per_page=1" \
  -H "apikey: $service_key" -H "authorization: Bearer $service_key" |
  tr -d '\r' | sed -n 's/^[xX]-[tT]otal-[cC]ount: //p')" || die "GoTrue's admin API didn't answer"
[[ "$gotrue_users" == "$auth_users" ]] ||
  die "GoTrue lists $gotrue_users users but auth.users has $auth_users"

echo
echo "Loaded $(local_sql -c 'select count(*) from public.players') players and $auth_users auth users."
echo
"$here/integrity.sh" --local
echo
echo "Next: check out the PR branch, run npx supabase migration up --local, then"
echo "scripts/prod-rehearsal/integrity.sh --local. Run npm run db:reset when done."
