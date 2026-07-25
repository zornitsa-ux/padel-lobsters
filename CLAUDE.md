# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev:local       # Vite dev server pointing at local Supabase (http://localhost:5173)
npm run dev             # Vite dev server pointing at production Supabase
npm test                # Run Vitest unit tests (one-shot)
npm run test:watch      # Run Vitest in watch mode
npm run typecheck       # TypeScript type-check (no emit)
npm run lint            # ESLint
npm run lint:fix        # ESLint with auto-fix
npm run format          # Prettier (write)
npm run format:check    # Prettier (check only)
npm run build           # Production build

# Database (requires Docker running)
npm run db:start        # Start local Supabase stack
npm run db:stop         # Stop local Supabase stack
npm run db:reset        # Wipe + replay all migrations + seed
npm run db:migration -- <name>   # Create a new migration file
npm run functions:serve # Serve Edge Functions locally

# Production migrations (manual — must be on main branch)
npx supabase db push
```

Run a single test file: `npx vitest run src/lib/format.test.ts`

Local dev requires `.env.localdev` (copy from `.env.localdev.example`) and Docker Desktop running.

## Architecture

See `ARCHITECTURE.md` for the full reference: stack, frontend structure, data model, algorithms, and open work.

## Matchmaking V2

The engine is built and live (`src/features/matchmaking/`); Phase 4 cutover is
the remaining work. Before touching matchmaking, ratings, or schedule
generation, read `docs/matchmaking-v2/DECISIONS.md` — it records why each design
call was made, and several are easy to undo by accident. `DESIGN.md` is the
model; `PLAN.md` is current status and remaining tasks.

While Phase 4 is open, update `PLAN.md` §1 at the end of every working session.

## Code Style

- Reserve comments for complex or critical code only. When writing one, be succinct and factual — no narration of what the code does.
- Keep functions short and single-purpose.
- Prefer named arguments (destructured objects) over positional parameters.
- Prefer pure functions and immutability.
- Refactor as you work. If you spot repeated code, create a task to de-duplicate it with a clean extraction rather than leaving it.

## Known Open Work

- **Remove the PII-dump quota from `get_all_players_with_pii_v2`** — the RPC caps
  admins at 3 successful full-roster reads per rolling 24h
  (`c_max_dumps_24h`, counted from `pin_attempts` rows with
  `attempt_kind = 'pii_dump'`). Judged unnecessary: it constrains normal admin
  work without a threat model that justifies it. Its failure mode is also wrong —
  on exhaustion it inserts a `succeeded = false` row and does a bare `RETURN`,
  yielding an **empty set rather than an error**, so `Players.jsx` silently shows
  an empty roster with no explanation. **Remove the cap; keep the
  `require_admin()` gate and keep the `succeeded = true` audit insert** — the
  admin security panel (`AdminSecurityPanels.jsx`, the `'pii'` filter and its
  `pii_dump` labels) reads those rows, so dropping the audit would break it.
  Blast radius is small: one real caller (`Players.jsx:62` via
  `fetchAllPlayersWithPii`). Note `init.sql:986-994` holds an older device-keyed
  v1 of the same block — check whether it still exists before editing.
- **Drop `players.pin` plaintext column** — `pin_hash` is live; `pin` is a data exposure risk. The column is still read by collision checks inside `verify_player_pin`, `regenerate_pin`, `admin_regenerate_pin`, `self_signup_player`, and the league signup RPC, plus rendered to admins in `Players.jsx`. Dropping it is its own PR-sized piece of work (rewrite collision checks against `pin_hash`, drop the `sync_player_pin_hash` trigger, strip plaintext from admin views).
