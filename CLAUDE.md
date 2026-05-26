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

### Frontend

**React 18 + Vite SPA** using `react-router-dom` (`BrowserRouter`). Routes are defined in `App.jsx`:

- `/home` — Dashboard
- `/events`, `/events/:id`, `/events/:id/schedule`, `/events/:id/scores`, `/events/:id/payments`, `/events/:id/oscars`
- `/community`, `/community/:id`
- `/merch`, `/admin`, `/settings`, `/history`, `/transfer/:id`

Components were originally written against an `onNavigate(page, tournament?)` helper. `useLegacyNavigate()` in `App.jsx` adapts that signature to `useNavigate` URL navigation — the adapter will be removed as components migrate to call `useNavigate` directly (Phase 2).

`DeepLinkMigrator` handles backward-compat redirects: `?transfer=<id>` → `/transfer/:id` and `?event=<id>` → `/events/:id`.

Access control list: `src/lib/authPaths.ts` — `PUBLIC_PAGES = ['dashboard']`; everything else requires authentication. Default-deny.

**Global state** lives in `src/context/AppContext.jsx` (~2000 lines). Most tables (tournaments, registrations, matches, transfers, settings) are loaded once by `loadAll()` on mount, kept live via Supabase Realtime subscriptions, and consumed via `useApp()`. **Players are the exception** — they have migrated out of context to a TanStack Query module (see below); the rest of the slices are slated to follow the same pattern over time.

Role is derived from the JWT on every render:

```javascript
const role = session?.user?.app_metadata?.role ?? 'guest'
// role ∈ { 'admin', 'player', 'guest' }
```

No `isAdmin` state variable. Components derive it locally: `const isAdmin = role === 'admin'`.

### Player data access

Players are at the heart of nearly every feature. **Do not read players from `useApp()` — that slice no longer exists there.** All player reads go through the TanStack Query module at `src/features/players/`:

| Need                                                                      | Hook                      | Notes                                                                                                                                                              |
| ------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The full roster (lists, pickers, name/avatar lookups)                     | `usePlayers()`            | Returns `{ data, isLoading, ... }`. One shared cache — call it from as many components as you like; requests are deduped.                                          |
| One player by id (when you don't otherwise need the list)                 | `usePlayer(id)`           | Derived from the roster cache via `select` — **no extra network request**, and re-renders only when that player changes.                                           |
| The signed-in user's own profile **with PII** (email/phone/full birthday) | `useMyProfile(claimedId)` | Roster identity (works on untrusted devices) merged with PII from the trust-gated `get_my_profile_v2` RPC. Use this for Settings/account screens, not `usePlayer`. |

Typical usage: `const { data: players = [] } = usePlayers()`.

Module layout:

- `playerQueries.ts` — fetchers (`fetchPlayers` reads `players_public`; `fetchMyProfile` calls the PII RPC). Each validates rows with Zod at the boundary, then runs them through `normalisePlayers` (snake_case → camelCase). Exports the `Player` type.
- `playerSchemas.ts` — Zod schemas for the public row and the PII row.
- `playerKeys.ts` — query-key factory. `playerKeys.all()` (`['players']`) is the invalidation prefix covering both the roster and the "me" row.
- `usePlayers.ts` — the three hooks above.

**Writes** still go through `useApp()` (`addPlayer`, `updatePlayer`, `deletePlayer`, `regeneratePin`, `selfSignup`) — these hold the authorization checks and, on success, call `queryClient.invalidateQueries({ queryKey: playerKeys.all() })` so every reader refetches. After any new player-write path, invalidate `playerKeys.all()` the same way.

There is **no polling and no Realtime subscription** for players (anon reads of the underlying `players` table are revoked, so Realtime is silent). Freshness comes from TanStack Query: refetch-on-mount/focus plus explicit invalidation after writes. If a screen needs tighter liveness, add a `refetchInterval` on that screen's `usePlayers()` call — don't reintroduce a global poll.

### New Feature Pattern

New features go in `src/features/<domain>/` following this layered structure:

```
domain/        # pure TS — no React, no Supabase, no Context
application/   # async orchestration (fetch/save)
state/         # local reducer + selectors
ui/            # dumb presentational components
<Feature>Container.tsx  # wires context/hooks → ui
```

Import direction is strictly one-way: `ui → state → application → domain`.

- New files: TypeScript (`.ts` / `.tsx`)
- Runtime validation: **Zod** for all external/unsafe data (Supabase rows, Edge Function responses, localStorage, URL params)
- Server state: **TanStack Query** (`useQuery` / `useMutation`) — not duplicated in local state

### Backend (Supabase)

All DB access uses the anon key + RLS via `src/supabase.js`. **All mutations go through `SECURITY DEFINER` RPCs — never direct INSERT/UPDATE/DELETE.**

Authorization inside RPCs:

- `require_admin()` — reads `auth.jwt() -> 'app_metadata' ->> 'role'`
- `require_trusted_device()` — reads `auth.jwt() -> 'app_metadata' ->> 'device_trusted'`

Player write RPCs that call `require_trusted_device()`: `update_my_profile`, `create_transfer`, `cancel_transfer`, `respond_to_transfer`, `lobster_oscars_cast_vote`, `lobster_oscars_clear_vote`.

#### Writing a new RPC

Every new `SECURITY DEFINER` function MUST include all four of these **in the same migration that creates it** — there is no CI gate, so an omission ships silently:

1. **Explicit EXECUTE grant.** New functions inherit Postgres's default `PUBLIC` grant unless you grant explicitly. `GRANT EXECUTE ... TO authenticated` for admin/player RPCs; `TO anon` only for pre-auth RPCs (PIN verify, signup, forgot-PIN). Also `REVOKE EXECUTE ... FROM public, anon` on admin RPCs as defense-in-depth. (Phase A's blanket `REVOKE ON ALL FUNCTIONS` only covered functions existing in 2026-05-18 — it does **not** retroactively protect new ones.)
2. **Authorization guard as the first statement.** `PERFORM public.require_admin();` for admin RPCs; `PERFORM public.require_trusted_device();` for player write RPCs. The grant is not the access boundary — this guard is.
3. **Hardened search_path.** `SET search_path TO 'pg_catalog', 'public', 'extensions'` (add `extensions` only if the function uses it).
4. **No direct table writes from the client** — the RPC is the only mutation path; keep the table's `INSERT/UPDATE/DELETE` revoked from `anon, authenticated`.

When adding a function, double-check the grant: `grep "GRANT EXECUTE.*<fn_name>" supabase/migrations/` should return a row.

### Authentication Flow

PIN-based (no passwords/OAuth). Client posts `{ pin, device_id }` to the `verify-pin` Edge Function, which bcrypt-checks against `players.pin_hash`, bakes `{ role, device_trusted }` into `app_metadata`, and returns `{ access_token, refresh_token }`. Client calls `supabase.auth.setSession(...)`.

`deviceId` is a stable UUID v4 from `localStorage['lobster_device_id']`. Devices must be approved by an admin (or fall within the `settings.auto_trust_until` grace window) before player write operations are permitted.

### Key Algorithms

- **`src/lib/standings.js`** — Americano standings: sort by total points → matches won → head-to-head
- **`src/lib/lobsterMatcher.js`** — simulated annealing scheduler for Americano rounds (cost weights for partner/opponent repeats, cohort balance, gender mode)
- **`src/lib/glicko2.js`** — standard Glicko-2 (TAU=0.5, SCALE=173.7178); `padel_level = (rating - 1200) / 100`
- **`src/lib/letterColors.ts`** — deterministic A–Z → hex color map. **LOCKED 2026-04-30** — do not change values; it would shift every avatar color site-wide

### Styling

Tailwind CSS v3 with custom `lob-*` color tokens (defined in `tailwind.config.js`):

- `lob-teal` `#3D7A8A` — primary accent / header
- `lob-coral` `#D94F2B` — CTA buttons / active nav
- `lob-amber` `#E8A030` — warnings / in-progress
- `lob-cream` `#F5F0E8` — page background
- `lob-dark` `#1C2B30` — body text
- `lob-muted` `#6B8A92` — secondary text

Display font: Georgia serif (`font-display`). Mobile-first layout with `pb-safe` for iOS home-indicator.

### Migrations

Migration files live in `supabase/migrations/`. **Never run SQL directly in the production dashboard.** After merging a migration PR, someone with production access must manually run `npx supabase db push` from `main`.

CI (GitHub Actions) runs lint + build only — no migration gate.

## Known Open Work

- **Drop `players.pin` plaintext column** — `pin_hash` is live; `pin` is a data exposure risk
- **`src/firebase.js`** — legacy unused file, safe to delete
