#!/usr/bin/env bash
# Print the generated TypeScript types for the local database, prettier-formatted.
#
# Two consumers, so the pipeline lives here rather than inline in package.json
# and can't drift between them:
#   npm run db:types        — rewrites src/lib/database.types.ts
#   npm run db:types:check  — diffs this output against that file (also CI)
#
# --write goes through a temp file and only moves it into place on success.
# The inline `... > src/lib/database.types.ts` this replaced truncated the file
# before the pipeline ran, so any generation failure (stack down, no docker)
# destroyed the checked-out types along with any uncommitted edits to them.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
types_file="$repo_root/src/lib/database.types.ts"

# Always the repo-pinned CLI, never whatever `supabase` is on PATH — a global
# install of a different version generates a different type shape.
supabase_cli="$repo_root/node_modules/.bin/supabase"
if [[ ! -x "$supabase_cli" ]]; then
  echo "error: $supabase_cli not found — run \`npm ci\`." >&2
  exit 1
fi

write_mode=false
if [[ "${1:-}" == "--write" ]]; then
  write_mode=true
fi

# Piped through Prettier because the committed file is formatted (it goes
# through lint-staged like any other source file), while the generator emits
# unformatted output. Diffing raw output against it would fail always.
#
# pipefail alone isn't enough: the CLI reports some failures as a JSON error
# object on stdout with exit 0, which prettier then rejects as a syntax error.
# Both halves have to be checked, hence the pipeline plus the empty guard below.
generate() {
  "$supabase_cli" gen types typescript --local \
    | "$repo_root/node_modules/.bin/prettier" --stdin-filepath database.types.ts
}

if ! output="$(generate)"; then
  echo "error: type generation failed — is the local stack running (\`npm run db:start\`) and is docker on your PATH?" >&2
  exit 1
fi

if [[ -z "$output" ]]; then
  echo "error: type generation produced no output — is the local stack running (\`npm run db:start\`)?" >&2
  exit 1
fi

if [[ "$write_mode" == true ]]; then
  tmp_file="$(mktemp "${TMPDIR:-/tmp}/database.types.XXXXXX.ts")"
  trap 'rm -f "$tmp_file"' EXIT
  printf '%s\n' "$output" > "$tmp_file"
  mv "$tmp_file" "$types_file"
  trap - EXIT
  echo "Wrote ${types_file#"$repo_root"/}" >&2
else
  printf '%s\n' "$output"
fi
