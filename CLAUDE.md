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

## Active Initiative — Matchmaking V2

Multi-session rebuild of matchmaking + level learning. Before touching matchmaking, ratings, or schedule generation, read `docs/matchmaking-v2/PLAN.md` (status + session protocol), then `DESIGN.md` and `DECISIONS.md` in the same directory. Update PLAN.md status at the end of every working session.

## Code Style

- Reserve comments for complex or critical code only. When writing one, be succinct and factual — no narration of what the code does.
- Keep functions short and single-purpose.
- Prefer named arguments (destructured objects) over positional parameters.
- Prefer pure functions and immutability.
- Refactor as you work. If you spot repeated code, create a task to de-duplicate it with a clean extraction rather than leaving it.

## Known Open Work

- **Drop `players.pin` plaintext column** — `pin_hash` is live; `pin` is a data exposure risk. The column is still read by collision checks inside `verify_player_pin`, `regenerate_pin`, `admin_regenerate_pin`, `self_signup_player`, and the league signup RPC, plus rendered to admins in `Players.jsx`. Dropping it is its own PR-sized piece of work (rewrite collision checks against `pin_hash`, drop the `sync_player_pin_hash` trigger, strip plaintext from admin views).
