# Sourced by scripts that drive the Supabase CLI.
#
# Always the repo-pinned CLI, never whatever `supabase` is on PATH. The JSON
# shape of `db query --output-format json` changes between releases, so a
# Homebrew/global install shadowing the pin silently breaks the extraction.
supabase_cli="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/node_modules/.bin/supabase"
if [[ ! -x "$supabase_cli" ]]; then
  echo "error: $supabase_cli not found — run \`npm ci\`." >&2
  exit 1
fi

# `db query` for $1 (local|remote), then the CLI's own arguments. Remote adds
# --read-only: v3 refuses a hosted statement without consent unless it is
# read-only, and nothing here may write to production.
db_query() {
  local target="$1"
  shift
  if [[ "$target" == remote ]]; then
    "$supabase_cli" db query --remote --read-only "$@"
  else
    "$supabase_cli" db query "$@"
  fi
}

# Reads `db query --output-format json` on stdin and prints every object
# carrying the key $1 at any depth, one per line. This survives the CLI
# wrapping its rows differently (bare array vs `{rows: [...]}` vs the current
# boundary/warning envelope).
json_rows() {
  jq -c --arg key "$1" '[.. | objects | select(has($key))] | .[]'
}
