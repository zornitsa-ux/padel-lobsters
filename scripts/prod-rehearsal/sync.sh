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
# (no sessions, refresh tokens, one-time tokens or MFA secrets). The remaining
# credential columns are wiped in the load transaction (scrub_credentials.sql).
# The dump lives in a private temp directory that is removed on exit.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$here/../.." && pwd)"
supabase_cli="$repo_root/node_modules/.bin/supabase"
db_container=supabase_db_padel-lobsters
auth_container=supabase_auth_padel-lobsters
auth_tables_copied="users identities instances"

die() { echo "sync: $*" >&2 && exit 1; }
local_sql() { docker exec -i "$db_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At "$@"; }

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

project_ref="$(cat supabase/.temp/project-ref)"
anon_key="$("$supabase_cli" projects api-keys --project-ref "$project_ref" -o json |
  jq -r '.[] | select(.name == "anon") | .api_key')"
prod_gotrue="$(curl -fsS "https://$project_ref.supabase.co/auth/v1/health" -H "apikey: $anon_key" | jq -r .version)"
local_gotrue="$(docker inspect -f '{{.Config.Image}}' "$auth_container" | sed 's/.*://')"
[[ "$prod_gotrue" == "$local_gotrue" ]] ||
  die "GoTrue is $local_gotrue locally but $prod_gotrue in production. Run npx supabase link, then npx supabase stop && npx supabase start"

echo "Comparing local migrations with production..."
mismatched="$("$supabase_cli" migration list --linked --output-format json 2>/dev/null |
  jq -r '.migrations[] | select(.local != .remote) | "\(.local // "-") / \(.remote // "-")"')"
[[ -z "$mismatched" ]] ||
  die "local and production migrations differ (local / remote):
$mismatched
Check out main, or the commit production is on."

if ! $assume_yes; then
  read -r -p "This wipes the local database and loads production data. Continue? [y/N] " answer
  [[ "$answer" == [yY] ]] || exit 1
fi

"$supabase_cli" db reset --local --no-seed
[[ "$(local_sql -c 'select count(*) from vault.secrets')" == "0" ]] || die "Vault isn't empty locally"

exclude=()
for table in $(local_sql -c "select table_name from information_schema.tables
                              where table_schema = 'auth' and table_type = 'BASE TABLE'"); do
  [[ " $auth_tables_copied " == *" $table "* ]] || exclude+=(-x "auth.$table")
done

umask 077
dump_dir="$(mktemp -d)"
trap 'rm -rf "$dump_dir"' EXIT

echo "Dumping production data..."
"$supabase_cli" db dump --linked --data-only --schema public,auth "${exclude[@]}" -f "$dump_dir/prod.sql"

echo "Loading it locally (one transaction)..."
cat "$dump_dir/prod.sql" "$here/scrub_credentials.sql" | local_sql -q --single-transaction -f - >/dev/null
rm -rf "$dump_dir"

[[ "$(local_sql -c 'select count(*) from vault.secrets')" == "0" ]] || die "Vault isn't empty after the load"

# GoTrue must be able to read every loaded user, not just Postgres.
service_key="$("$supabase_cli" status -o env 2>/dev/null | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"
auth_users="$(local_sql -c 'select count(*) from auth.users')"
gotrue_users="$(curl -fsS -D - -o /dev/null "http://127.0.0.1:54321/auth/v1/admin/users?per_page=1" \
  -H "apikey: $service_key" -H "authorization: Bearer $service_key" |
  tr -d '\r' | sed -n 's/^[xX]-[tT]otal-[cC]ount: //p')"
[[ "$gotrue_users" == "$auth_users" ]] ||
  die "GoTrue lists $gotrue_users users but auth.users has $auth_users"

echo
echo "Loaded $(local_sql -c 'select count(*) from public.players') players and $auth_users auth users."
echo
"$here/integrity.sh" --local
echo
echo "Next: check out the PR branch, run npx supabase migration up --local, then"
echo "scripts/prod-rehearsal/integrity.sh --local. Run npm run db:reset when done."
