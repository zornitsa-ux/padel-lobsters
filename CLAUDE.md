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

**Global state** lives entirely in `src/context/AppContext.jsx` (~2000 lines). All components consume it via `useApp()`. `loadAll()` fires on mount and fetches all tables in parallel. Every table has a Supabase Realtime subscription; `players` also has a 60s polling fallback because anon direct reads are blocked by RLS.

Role is derived from the JWT on every render:

```javascript
const role = session?.user?.app_metadata?.role ?? 'guest'
// role ∈ { 'admin', 'player', 'guest' }
```

No `isAdmin` state variable. Components derive it locally: `const isAdmin = role === 'admin'`.

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
