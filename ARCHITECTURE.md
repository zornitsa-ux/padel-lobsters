# Architecture Reference

Padel Lobsters is a private-league management SPA for a recurring Americano-format padel group in the Netherlands. It handles event scheduling, standings, player profiles, a merch shop, and an in-tournament award-voting system.

---

## Stack

| Layer      | Choice                                                          |
| ---------- | --------------------------------------------------------------- |
| Frontend   | React 18 + Vite                                                 |
| Styling    | Tailwind CSS v3, custom `lob-*` color namespace                 |
| Backend    | Supabase (Postgres, Realtime, RLS, Edge Functions)              |
| Deployment | Vercel (auto-deploy `main`); migrations are **manually pushed** |
| CI         | GitHub Actions — lint + build only                              |
| Email      | Resend API via Supabase Edge Function                           |
| Ratings    | Client-side Glicko-2                                            |

Vitest unit test suite exists (`npm test`) covering `src/lib/` and `src/data/` modules. No react-router-dom routing (despite it being installed).

---

## Frontend Architecture

### Page Router

`App.jsx` implements a custom string-state page machine. The active page is a string held in React state; `<Layout>` renders a component switch. There is no URL-based routing except for two special entry points:

- `/?transfer=<id>` — renders `TransferAccept.jsx` (spot transfer deep link)
- Any other `?` param is ignored

Pages: `dashboard`, `players`, `tournament`, `registration`, `payments`, `schedule`, `scores`, `merch`, `settings`, `history`, `game`, `league`, `transfer-accept`

Access control is in `src/lib/authPaths.js`:

- `PUBLIC_PAGES = ['dashboard']` — visible to guests
- All other pages are protected (require at least a claimed player identity)
- Default-deny: anything not in the list is treated as protected

### AppContext — Monolithic State Layer

`src/context/AppContext.jsx` (~2012 lines) is the single global context. Every component that needs data or actions consumes it via `useApp()`.

**Data loading** — `loadAll()` fires on mount and loads all tables in parallel:

- players, tournaments, registrations, matches, settings, player_aliases, merch_items, merch_interests, leagues, league_interests, league_teams, raffle_winners

**Realtime subscriptions** — every table has a Supabase Realtime channel. The `players` table additionally has a 60s polling fallback — direct `SELECT` on `players` is restricted by RLS (anon reads go through `players_public`), so a missed Realtime event would go unnoticed without the poll.

**Role derivation** — derived from the JWT session on every render:

```javascript
const role = session?.user?.app_metadata?.role ?? 'guest'
// role ∈ { 'admin', 'player', 'guest' }
```

The `role` claim is baked into `app_metadata` by the `verify-pin` Edge Function on every login. Components derive `isAdmin = role === 'admin'` locally; there are no global boolean state variables for auth roles.

**Key state**:

- `session` — Supabase Auth session (`supabase.auth.getSession()` / `onAuthStateChange`); `session.user.id` is the authenticated player's UUID
- `deviceId` — UUID v4 from `localStorage['lobster_device_id']`; stable across logins, used for device trust

Context exposes ~80 values/functions to consumers. All player writes go through RPCs, never direct table writes.

### Component Sizes (largest first)

| File               | ~Lines | Role                                   |
| ------------------ | ------ | -------------------------------------- |
| `Merch.jsx`        | 1812   | Merch shop + raffle + admin management |
| `League.jsx`       | 1532   | Lobster League competition             |
| `Game.jsx`         | 1286   | Lobster Oscars voting                  |
| `Tournament.jsx`   | 1037   | Event management                       |
| `Dashboard.jsx`    | 1200   | Home page                              |
| `AppContext.jsx`   | 2012   | Global state                           |
| `History.jsx`      | ~900   | Hardcoded historical tournament data   |
| `Players.jsx`      | ~800   | Player profiles + stats                |
| `Settings.jsx`     | ~700   | Profile + admin settings               |
| `Registration.jsx` | ~600   | Event sign-up                          |
| `Scores.jsx`       | ~500   | Live standings                         |
| `Schedule.jsx`     | ~500   | Match schedule                         |
| `Payments.jsx`     | ~400   | Payment tracking                       |

### Design System

Tailwind custom colors defined in `tailwind.config.js`:

| Token       | Hex       | Use                           |
| ----------- | --------- | ----------------------------- |
| `lob-teal`  | `#3D7A8A` | Primary accent, header bar    |
| `lob-coral` | `#D94F2B` | CTA buttons, active nav state |
| `lob-amber` | `#E8A030` | Warnings, in-progress states  |
| `lob-cream` | `#F5F0E8` | Page background               |
| `lob-dark`  | `#1C2B30` | Body text                     |
| `lob-muted` | `#6B8A92` | Secondary text                |

Display font: Georgia serif (CSS class `font-display`). UI font: system sans-serif.

`src/lib/letterColors.js` — deterministic A–Z letter→hex map for avatar fallbacks. **Locked 2026-04-30** (changing it would shift every avatar color site-wide).

### Navigation Shell

`Layout.jsx` renders:

- Sticky header: logo (`/logo-hd.png`), Instagram link, WhatsApp group button
- Bottom nav (mobile-first): Home, Events, Players, Merch, Settings
- `pb-safe` padding for iOS home-indicator safe area

---

## Backend Architecture

### Supabase

All DB access goes through the Supabase JS client (`src/supabase.js`) using the anon key + RLS. Admin operations use `SECURITY DEFINER` RPCs that run as the `postgres` role, bypassing RLS. All public-facing mutations are gated by `require_admin()` or `require_trusted_device()` within the RPC body.

### Data Model

#### Core tables

**`players`**

- `id`, `name`, `email`, `pin_hash` (bcrypt), `pin` (plaintext — **pending drop**, see Open Work), `nationality`, `avatar_url`, `playtomic_level`, `learned_rating` (Glicko-2 in DB units), `learned_rd`, `role` (`player_role` enum: `'player'` | `'admin'`), `created_at`
- **`role`** is the single source of truth for authorization. Baked into JWT `app_metadata.role` by the `verify-pin` Edge Function on every login.
- RLS: admins have full access via JWT claim policy; players can read/update their own row; anon reads go through the `players_public` view. Direct table access for non-owners is denied.

**`tournaments`**

- `id`, `date`, `time`, `location`, `courts`, `max_players`, `price_per_person`, `status`, `description`, `booking_mode` (`admin_all` | `player_responsible`), `court_links` (JSONB array of Tikkie URLs), `gender_mode`, `duration`

**`registrations`**

- `id`, `tournament_id`, `player_id`, `status` (`registered` | `waitlisted` | `cancelled`), `is_paid`, `transfer_pending_to` (player_id), `transfer_id` (UUID for deep link), `created_at`

**`matches`**

- `id`, `tournament_id`, `round`, `team1_ids` (UUID[]), `team2_ids` (UUID[]), `score1`, `score2`, `completed`, `court`

**`settings`**

- Single-row table. `auto_trust_until` (timestamp for device grace period), `whatsapp_group_url`, `feature flags`, `raffle_cooldown_count` (default 2)

**`player_aliases`**

- `historical_name` (text PK), `player_id` (UUID FK → players), `created_at`
- Maps pre-Supabase name strings to current player UUIDs. Used for historical stat stitching.

**`device_approvals`**

- `device_id` (text PK), `player_id`, `approved_at`, `approved_by`
- Tracks which devices have been approved to authenticate as which player.

#### Merch tables

**`merch_items`**

- `id`, `name`, `description`, `price`, `category`, `sizes_available` (text[]), `image_urls` (text[]), `is_active`, `display_order`, `name_customization_available`, `external_orders`

**`merch_interests`**

- `id`, `player_id`, `item_id`, `size`, `status` (`ordered` | `paid` | `delivered` | `cancelled`), `name_customization`, `notes`, `created_at`

#### Raffle

**`raffle_winners`**

- `id`, `player_id`, `tournament_id`, `prize_label`, `won_at`, `cooldown_offset` (int, normally 0; adjust to extend/shorten cooldown for a specific win)

Cooldown rule: a player who won within the last N tournaments (default 2, configurable via `settings.raffle_cooldown_count`) is ineligible. The raw rule is: count distinct tournaments in `raffle_winners` for this player in the last `cooldown_count` completed tournaments before the current one.

#### League tables

**`leagues`**

- `id`, `name`, `description`, `status`, `visibility` (`admin` | `all`), `signup_start/end`, `group_start/end`, `quarterfinals_start/end`, `semifinals_start/end`, `finals_start/end`, `sections` (JSONB — 6 editable content sections), `created_at`

**`league_interests`**

- `id`, `league_id`, `player_id`, `experience_level`, `looking_for_partner` (bool), `created_at`

**`league_teams`**

- `id`, `league_id`, `player1_id`, `player2_id`, `team_name`, `team_song`, `status` (`pending` | `confirmed` | `dissolved`), `invited_by` (player_id), `created_at`

#### Lobster Oscars tables

**`lobster_oscars_sessions`**

- `id`, `tournament_id`, `phase` (`not_created` | `pre_start` | `active` | `ended` | `shared`), `created_at`

**`lobster_oscars_categories`**

- `id`, `session_id`, `name`, `emoji`, `display_order`, `is_active`

**`lobster_oscars_votes`**

- `id`, `session_id`, `category_id`, `voter_id`, `nominee_id`, `created_at`

### Key RPCs (SECURITY DEFINER)

All write operations go through RPCs, never direct INSERT/UPDATE:

Authorization pattern: player RPCs use `auth.uid()` + `require_trusted_device()`; admin RPCs use `require_admin()` (reads JWT `app_metadata.role`).

| RPC                             | Auth                   | Purpose                                          |
| ------------------------------- | ---------------------- | ------------------------------------------------ |
| `admin_add_player`              | `require_admin()`      | Create player                                    |
| `admin_update_player`           | `require_admin()`      | Update any player field                          |
| `admin_delete_player`           | `require_admin()`      | Delete player                                    |
| `admin_regenerate_pin`          | `require_admin()`      | Regenerate a player's PIN                        |
| `admin_approve_device`          | `require_admin()`      | Approve a pending device                         |
| `update_my_profile`             | `auth.uid()` + trusted | Player updates own name/email/avatar/nationality |
| `create_transfer`               | `auth.uid()` + trusted | Player initiates a spot transfer                 |
| `cancel_transfer`               | `auth.uid()` + trusted | Player cancels their pending transfer            |
| `respond_to_transfer`           | `auth.uid()` + trusted | Recipient accepts or declines transfer           |
| `approve_device`                | `auth.uid()`           | Player approves a pending device (no trust gate) |
| `reject_device`                 | `auth.uid()`           | Player rejects a pending device (no trust gate)  |
| `get_my_profile_v2`             | `auth.uid()`           | Fetch own full record (email/phone)              |
| `lobster_oscars_cast_vote`      | `auth.uid()` + trusted | Cast/update a vote                               |
| `lobster_oscars_clear_vote`     | `auth.uid()` + trusted | Remove own vote                                  |
| `lobster_oscars_admin_*`        | `require_admin()`      | Oscars session management                        |
| `admin_persist_learned_ratings` | `require_admin()`      | Persist Glicko-2 ratings to DB                   |
| `admin_record_raffle_winners`   | `require_admin()`      | Draw raffle winners (enforces cooldown)          |
| `verify_player_pin_v2`          | anon                   | PIN check + rate limiting (called by Edge Fn)    |
| `self_signup_player`            | anon                   | Self-service player registration                 |
| `forgot_my_pin`                 | anon                   | Email-based PIN reset                            |

### Edge Functions

**`supabase/functions/verify-pin/index.ts`** (Deno)

- Auth: public endpoint — `verify_jwt = false` in `config.toml`
- Inputs (POST JSON): `pin`, `device_id`, `user_agent` (optional)
- Implements the 6-step session issuance flow (see Authentication section above)
- Uses only `deno.land/std` — no `supabase-js`; all calls are raw `fetch()` to PostgREST + GoTrue admin API
- Returns: `{ access_token, refresh_token, role, is_new_device, is_trusted }`

**`supabase/functions/send-pin-email/index.ts`** (Deno)

- Auth: `Authorization: Bearer <EDGE_SHARED_SECRET>` header
- Inputs: `player_id`, `email`, `name`, `pin`, `kind` (`new_signup` | `regenerated` | `forgot_reset`)
- Sends via Resend API
- Called by AppContext when admin creates a player or resets a PIN

### Storage

- `avatars` bucket — player profile photos (processed to 256×256 WebP before upload)
- `merch` bucket — product images (up to 3 per item)

---

## Authentication & Security

### Authorization Model

Two roles: `'player'` and `'admin'`. Role lives in `players.role` (Postgres enum) and is baked into the JWT `app_metadata.role` claim on every login by the `verify-pin` Edge Function.

**Server-side enforcement** — two DB helper functions (not SECURITY DEFINER, `search_path = ''`):

- `require_admin()` — raises if `(auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin'`
- `require_trusted_device()` — raises `pending_device_approval` if `(auth.jwt() -> 'app_metadata' ->> 'device_trusted')::boolean IS NOT TRUE`

**Client-side role reading** — `useAuth.js`:

```javascript
const role = session?.user?.app_metadata?.role ?? 'guest'
// role ∈ { 'admin', 'player', 'guest' }
```

No shared admin PIN. No `is_admin`/`is_league_admin` state. `auth.uid()` is the identity for all operations.

### PIN Authentication Flow

1. Player selects their name and enters their 4-digit PIN
2. Client calls `verify-pin` Edge Function (POST `{ pin, device_id }`)
3. Edge Function runs `verify_player_pin_v2` (bcrypt check + rate limiting), fetches `players.role`, creates/syncs a GoTrue auth user with `app_metadata: { role, device_trusted }`, and issues a JWT via magic-link token exchange
4. Client calls `supabase.auth.setSession({ access_token, refresh_token })`
5. Session persisted by Supabase JS client

```
Client POST /functions/v1/verify-pin { pin, device_id }
  → RPC verify_player_pin_v2        (bcrypt check + rate limit + device trust lookup)
  → GET /rest/v1/players            (fetch role + email, service role)
  → GET /auth/v1/admin/users/:id    (check if auth user exists)
  → POST|PUT /auth/v1/admin/users   (create/sync; bake app_metadata: { role, device_trusted })
  → POST /auth/v1/admin/generate_link
  → GET /auth/v1/verify?token=...&redirect:manual  (parse Location fragment for tokens)
  → 200 { access_token, refresh_token, role, is_new_device, is_trusted }
```

PINs are bcrypt-hashed in `pin_hash`. **The plaintext `pin` column still exists and must be dropped** (see Open Work).

### Device Trust

Every browser has a stable UUID v4 `deviceId` in `localStorage['lobster_device_id']`.

- `verify_player_pin_v2` returns `trusted: boolean` based on `player_devices.trusted_at`
- `is_trusted` is baked into `app_metadata.device_trusted` in the JWT by the Edge Function
- All 6 player write RPCs (`update_my_profile`, `create_transfer`, `cancel_transfer`, `respond_to_transfer`, `lobster_oscars_cast_vote`, `lobster_oscars_clear_vote`) call `require_trusted_device()` — an untrusted device gets `pending_device_approval` from the server
- `approve_device` / `reject_device` are **not** trust-gated (gating them would deadlock the approval flow)
- `settings.auto_trust_until` grace window: devices that log in during this period are auto-trusted; used when onboarding players in bulk
- **Client UX for untrusted devices is not yet implemented** — the server correctly rejects writes, but there is no ribbon or prompt explaining why to the user (see Open Work)

### RLS Policies

All tables have RLS enabled with real policies (not `USING (true)`):

- **Read**: public tables (`tournaments`, `matches`, `registrations`, etc.) are `SELECT USING (true)` — readable by anon
- **Admin write**: `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` — no SECURITY DEFINER, no DB lookup, JWT-only
- **Own-row access**: `players` has `self_read` and `self_update` policies using `id = auth.uid()`
- **Player-scoped writes**: `league_interests`, `merch_interests`, etc. have `player_id = auth.uid()` policies
- `pin_attempts` and `player_devices` have RLS enabled with no public policies — only accessible through SECURITY DEFINER RPCs

### Function EXECUTE Grants

`anon` can only call: `verify_player_pin_v2`, `self_signup_player`, `forgot_my_pin`, `is_my_device_trusted`

`authenticated` can call all player + admin RPCs. Admin RPCs are still reachable by any authenticated user, but `require_admin()` is the real gate — a non-admin session raises an exception.

### Storage

- `avatars` bucket: `authenticated` can upload/update their own `player-{uid}.webp`; admins can upload any file
- `merch` bucket: admin only (INSERT/UPDATE/DELETE); reads served by CDN (bucket is public)
- All storage policies use JWT claim (`auth.jwt() -> 'app_metadata' ->> 'role'`) — no SECURITY DEFINER

### Rate Limiting

Enforced inside `verify_player_pin_v2` (not middleware):

- 10 failed PIN attempts per device per 24h → per-device lockout
- 5 consecutive failures per player (any device) → per-player lockout
- `pin_attempts` table is fully locked (no public RLS policies)

---

## Core Algorithms

### Americano Standings (`src/lib/standings.js`)

Sort order (single source of truth for Scores tab and Player profiles):

1. Total game points scored (descending)
2. Matches won (descending)
3. Head-to-head: who beat whom more often

`computeTournamentStandings(tournamentId, matches, playerIds?)` — returns sorted array.
`rankOfPlayer(playerId, tournamentId, matches)` — returns `{ rank, total }` or null.

### Lobster Matcher (`src/lib/lobsterMatcher.js`)

Simulated annealing scheduler. Generates rounds for an Americano session.

Cost function weights (`W`):

- `HARD: 1e9` — hard constraints (wrong player count per match)
- `LEVEL_DELTA: 1.0` — balance padel levels across teams
- `PARTNER_REPEAT: 200` — penalise same partner twice
- `OPPONENT_REPEAT: 8` — penalise same opponent twice
- `COHORT_EXCESS: 30` — too many players from same social cohort on same court
- `COHORT_HISTORY: 15` — cohort co-occurrence memory from past sessions
- `GENDER_EXTRA: 1000` — `men_only` / `women_only` mode enforcement
- `SITOUT_VAR: 20` — equalise sit-out frequency
- `SAMEGENDER_REPEAT: 500` — avoid same-gender matches in mixed mode

Cohort memory half-life: 60 days.

`generateLobster(players, numCourts, genderMode, duration, opts)` → `[{ round, label, matches, sitting }]`

### Glicko-2 Ratings (`src/lib/glicko2.js`)

Standard Glicko-2 (TAU=0.5, SCALE=173.7178).

Scale mapping: `padel_level = (rating - 1200) / 100`

- Padel 3.0 ≈ Glicko 1500

`applyTournamentRatings(priorByPlayerId, matches, playtomicByPlayerId)`:

- Team rating = average of individual ratings
- Match score = proportion: `s1/(s1+s2)` and `s2/(s1+s2)`
- Returns updated ratings only for players who played

`learnedLevel` on player objects = `(learned_rating - 1200) / 100`. Persisted to DB via `recomputeAllRatings()`.

### Historical Data Stitching (`src/lib/playerHistory.js`, `src/lib/playerStats.js`)

Pre-Supabase tournaments are hardcoded in `src/components/History.jsx` as a `TOURNAMENTS` constant array. Each tournament has `players` (standings with `total` points and optional `podium` override) and `rounds` (match data with name strings instead of IDs).

The `player_aliases` table maps historical name strings → current player UUIDs. `buildHistoricalAppearances()` and `buildPlayerStats()` both read this map to stitch historical records into a player's lifetime stats.

`rankPlayers()` in `playerHistory.js` respects explicit `podium` field overrides (values 1/2/3) to pin real-world podium results when points-based ranking would be wrong.

---

## Utility Modules (`src/lib/`)

| Module                | Purpose                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `standings.js`        | Americano tournament standings (shared)                             |
| `playerStats.js`      | Per-player lifetime stats (shared between Dashboard + Players)      |
| `playerHistory.js`    | Historical appearances from hardcoded data                          |
| `glicko2.js`          | Glicko-2 rating calculations                                        |
| `lobsterMatcher.js`   | Simulated annealing session scheduler                               |
| `ratingsRecompute.js` | Full Glicko-2 rebuild from scratch (`recomputeAllRatings`)          |
| `letterColors.js`     | Deterministic A–Z → hex color map (LOCKED — do not change)          |
| `processAvatar.js`    | Center-crop to 256×256 WebP (HEIC-safe via `createImageBitmap`)     |
| `calendar.js`         | .ics generator + Google Calendar URL builder (two alarms: 24h + 2h) |
| `whatsapp.js`         | WhatsApp deep link builders; hardcoded group URL                    |
| `format.js`           | `fmtEur`, `fmtEur0`, `fmtNum2` using `Intl.NumberFormat('en-GB')`   |
| `deviceId.js`         | UUID v4 persisted in `localStorage['lobster_device_id']`            |
| `authPaths.js`        | `PUBLIC_PAGES` list and access-control helpers                      |

---

## New Feature Architecture Pattern (Default)

All new feature work should follow a layered structure with explicit ownership of responsibilities.

### Folder Shape

```text
src/features/<domain>/<feature>/
  domain/
    *.types.ts
    *.ts            # pure business logic, transforms, rule checks
  application/
    *.service.ts    # use-cases / orchestration of async flows
  state/
    *Reducer.ts     # local UI state transitions (predictable actions)
    *Actions.ts
    *Selectors.ts
  ui/
    *.tsx           # presentational components only
  <Feature>Container.tsx  # wiring: context/hooks/query + callbacks
```

### Layer Boundaries

- **domain**: deterministic, side-effect free logic only (no React, no Supabase, no Context).
- **application**: coordinates async workflows (fetch/save/update) and delegates business rules to `domain`.
- **state**: feature-local reducer/state machine for explicit transitions and impossible-state prevention.
- **ui**: dumb components that render props and emit events only.
- **container**: the only place that connects framework/runtime concerns (AppContext, routing, query hooks).

Import direction must be one-way: `ui -> state/selectors -> application -> domain`.

### Runtime Validation & Parsing (Zod)

Use **Zod** as the default runtime schema layer for all new implementations:

- Parse external/unsafe data (Supabase rows, edge function responses, localStorage payloads, URL params).
- Keep schemas close to the feature (typically `domain/*.schema.ts` or `domain/*.types.ts`).
- Use `z.infer` for TS types where possible to keep runtime schemas and compile-time types aligned.
- Prefer safe parsing (`safeParse`) in user-facing flows; map failures to actionable UI/application errors.

### Server State (TanStack Query)

Use **TanStack Query** as the default server-state abstraction:

- Fetching: `useQuery` with stable query keys (`['feature', entityId, ...]`).
- Mutations: `useMutation` + targeted cache invalidation / cache updates.
- Avoid duplicating server-state in local component state; reserve reducer state for local UI flow only.
- Keep query key factories and query functions in feature-local modules for consistency and reuse.
- Prefer optimistic updates only when rollback logic is explicit and safe.

### Practical Rules

- New extracted files should be TypeScript (`.ts` / `.tsx`).
- Keep components small and focused; move logic-heavy blocks into `domain`/`application`.
- Model UI flow with explicit actions/events instead of many unrelated `useState` calls.
- Add unit tests first for `domain` and reducer logic; treat UI tests as secondary.

---

## Open Work

Concrete tasks that are scoped but not yet done, ordered by risk.

### High — Security / Data Integrity

- **Drop `players.pin` plaintext column** — the bcrypt `pin_hash` column is the live credential; the plaintext `pin` is a data exposure risk. Migration: `ALTER TABLE players DROP COLUMN pin;`. Gate on confirming no client code reads `players.pin` directly (grep clean).
- **Device trust ribbon (client UX)** — `require_trusted_device()` is live and correctly rejects writes from untrusted sessions with `pending_device_approval`. The UX is missing: add a slim ribbon at the top of the app when `session.user.app_metadata.device_trusted === false`, explaining the device is read-only until approved, with a CTA to open Settings. Write-action buttons should surface this instead of silently failing.
- **Apply all migrations to staging + production** — all migrations through `20260518000014_rbac_jwt_admin.sql` are applied locally. They have not been pushed to other environments.

### Medium — Code Hygiene

- **`src/api/auth.js` `logout()` cleanup** — removes several legacy localStorage keys (`lobster_admin`, `lobster_league_admin`, `lobster_claimed_id`, `lobster_session_admin_pin`, etc.) that no longer exist in the live app. The comment "drops both admin statuses" is stale. Clean up the key list and comment once confident all active user sessions have migrated.
- **`search_path = ''` on SECURITY DEFINER function bodies** — `require_admin()` and `require_trusted_device()` already have `search_path = ''`. The larger SECURITY DEFINER RPCs (`admin_add_player`, `update_my_profile`, etc.) use `search_path = 'pg_catalog, public, extensions'` (safe but not maximally strict). Setting `search_path = ''` on all of them requires qualifying every unqualified table/function reference — deferred until there is a broader function audit.
- **No migration CI gate** — migrations are manually pushed. A bad migration to production is difficult to reverse. Consider adding `supabase db diff` check to CI or at minimum a pre-push hook.
- **`src/firebase.js`** — legacy Firebase config, entirely unused; safe to delete.
- **`PlayerProfile.jsx` and `PlaytomicUpdatePrompt.jsx`** — currently unused components.

### Low — Optional Improvements

- **RLS for admin ops (RBAC Phase 8)** — some SECURITY DEFINER admin RPCs could be replaced with direct table operations guarded by RLS admin policies, reducing the SECURITY DEFINER surface area. Low urgency; replace one at a time.
- **`react-router-dom` installed but unused** — the custom string-state router works but standard routing would enable deep links, browser back/forward, and bookmarking.
- **Hardcoded test player names** — `TEST_PLAYER_FIRST_NAMES = ['zornitsa', 'jon', 'uziel']` in multiple components. Should be a single constant or DB flag.
- **`AddToCalendarButton` opens Google Calendar URL** — `.ics` download was intentionally avoided to prevent iOS popup blocking; Android/desktop users lose native calendar integration.
- **Role staleness** — if a player's `role` is changed in the DB mid-session, `app_metadata.role` in the JWT updates only at the next token refresh (~1 hour). Acceptable for this threat model; if immediate revocation is ever needed, force sign-out via Auth Admin API in `admin_update_player` when role is changed.

---

## Known Technical Debt

### High Priority

- **No tests on core algorithms** — the matcher, standings algorithm, and Glicko-2 are untested.
- **Monolithic AppContext** — ~380 lines with `useAuth` + `useDataSync` extracted, but still a large surface area. Will become a maintenance burden as features grow.

### Medium Priority

- **Hardcoded historical data** — pre-Supabase tournaments are hardcoded in `History.jsx`. No migration path exists for adding new historical data without a code change.

### Low Priority

- **Hardcoded podium fallback** — `['Alex B', 'Uziel', 'Karlijn']` in `Dashboard.jsx`.

---

## Local Development

```bash
npm run dev:local   # Vite dev server pointing at local Supabase
npm run db:migration # Generate a new migration
npm run db:reset    # Reset local DB
npm run db:push     # Push migrations to production (MANUAL — be careful)
```

Requirements: Node.js 20, Docker Desktop (for local Supabase).

See `CONTRIBUTING.md` for full setup.
