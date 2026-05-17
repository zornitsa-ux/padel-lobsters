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
| CI         | GitHub Actions — lint + build only (no tests)                   |
| Email      | Resend API via Supabase Edge Function                           |
| Ratings    | Client-side Glicko-2                                            |

No test suite exists. No react-router-dom routing (despite it being installed).

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

**Realtime subscriptions** — every table has a Supabase Realtime channel. Players table additionally has a 60s polling fallback because Phase 2c revoked direct SELECT — the subscription works but a missed event would go unnoticed without the poll.

**Role derivation** (current — pre-Phase-5):

```
role = isAdmin          → 'admin'
     | isLeagueAdmin    → 'league_admin'
     | claimedId        → 'player'
     | else             → 'guest'
```

After Phase 5 this collapses to a single session read:

```javascript
const role = session?.user?.app_metadata?.role ?? 'guest'
```

**Key state**:

- `claimedId` — the player_id this device has PIN-authenticated as (pre-Phase-5; replaced by `auth.uid()` after Phase 5)
- `deviceId` — UUID v4 from `localStorage['lobster_device_id']`
- `pendingClaim` — set when device is on probation (awaiting admin approval)
- `isAdmin` / `isLeagueAdmin` — derived from player row flags (pre-Phase-5; removed in Phase 5)

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

All DB access goes through the Supabase JS client (`src/supabase.js`) using the anon key + RLS. Admin operations use `SECURITY DEFINER` RPCs that run as the `postgres` role, bypassing RLS checks.

### Data Model

#### Core tables

**`players`**

- `id`, `name`, `email`, `pin_hash` (bcrypt), `pin` (plaintext — Phase 3 will drop this), `nationality`, `avatar_url`, `playtomic_level`, `learned_rating` (Glicko-2 in DB units), `learned_rd`, `created_at`
- **No `is_admin` or `is_league_admin` column exists** — admin identity is a shared bcrypt PIN stored in `private.admin_secrets`, not a per-player flag. The RBAC transition (Phase 1) will add a `role` column (`player_role` enum: `'player'` | `'admin'`).
- RLS: players can read their own row via `update_my_profile` RPC; admin reads all via `admin_update_player`. Direct SELECT was revoked in Phase 2c — all reads go through the `players_public` view or RPCs.

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

| RPC                              | Purpose                                          |
| -------------------------------- | ------------------------------------------------ |
| `admin_add_player`               | Create player (admin only)                       |
| `admin_update_player`            | Update any player field (admin only)             |
| `update_my_profile`              | Player updates own name/email/avatar/nationality |
| `admin_change_pin`               | Rotate admin PIN (validates old PIN)             |
| `register_player_for_tournament` | Register or waitlist                             |
| `admin_transfer_spot`            | Admin executes a spot transfer                   |
| `propose_transfer`               | Player proposes to transfer their spot           |
| `accept_transfer`                | Recipient accepts the transfer                   |
| `admin_complete_payment`         | Mark registration as paid                        |
| `lobster_oscars_cast_vote`       | Cast/update a vote                               |
| `lobster_oscars_clear_vote`      | Remove own vote                                  |
| `lobster_oscars_admin_*`         | Various admin Oscars management RPCs             |
| `dissolveLeagueTeam`             | Admin breaks up a league team                    |
| `recompute_player_ratings`       | Rebuild Glicko-2 for one or all players          |
| `admin_draw_raffle`              | Draw a raffle winner (enforces cooldown)         |
| `admin_update_raffle_winner`     | Edit prize label                                 |

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

### PIN Authentication

Authentication uses a 4-digit PIN system backed by Supabase Auth (GoTrue) sessions:

1. Player selects their name from a list
2. Enters their 4-digit PIN
3. Client calls the `verify-pin` Edge Function → Edge Function verifies PIN via `verify_player_pin_v2` RPC, then creates/syncs a GoTrue auth user and issues a JWT session
4. Client calls `supabase.auth.setSession({ access_token, refresh_token })` to establish the session
5. Session persisted by Supabase JS client (no manual localStorage writes for the session)

PINs are stored bcrypt-hashed in `pin_hash`. **A plaintext `pin` column still exists** (Security Phase 3 incomplete — drop it).

The JWT `app_metadata.role` claim carries `'player'` or `'admin'` — baked in by the Edge Function on every login. Client reads role from `session.user.app_metadata.role`. RPCs use `require_admin()` which reads `auth.uid()` + `players.role`.

**Admin identity is a per-player property**: `players.role = 'admin'`. There is no longer a separate shared admin PIN credential. The `verify_admin_pin_v2` RPC is still present but will be removed in Phase 6 once Phase 4+5 are deployed.

### Session Flow (verify-pin Edge Function)

```
Client POST /functions/v1/verify-pin { pin, device_id }
  → RPC verify_player_pin_v2 (bcrypt check + rate limit)
  → GET /rest/v1/players (fetch role + email, service role)
  → GET /auth/v1/admin/users/:id (check if auth user exists)
  → POST or PUT /auth/v1/admin/users (create/sync, bake app_metadata.role)
  → POST /auth/v1/admin/generate_link (get hashed_token)
  → GET /auth/v1/verify?token=...&redirect:manual (parse Location fragment)
  → 200 { access_token, refresh_token, role, is_new_device, is_trusted }
```

### Device Trust

Every browser gets a UUID v4 `deviceId` stored in `localStorage['lobster_device_id']`.

On first claim, the device enters a **probationary** state:

- `pendingClaim` is set in context
- Device cannot access protected pages
- Admin must approve the device via `device_approvals` table

`settings.auto_trust_until` provides a grace-period bypass: devices that claim during this window are auto-approved, used when onboarding new players in bulk.

### Rate Limiting

Enforced inside RPCs (not middleware):

- Player PIN failures: 10 per device per 24h → lockout
- Admin PIN failures: 5 per device per 24h → lockout
- Per-player lockout after 5 consecutive failures (regardless of device)

### Security Rollout Phases

| Phase | Status      | Description                                                                      |
| ----- | ----------- | -------------------------------------------------------------------------------- |
| 1     | ✅ Complete | All writes moved to SECURITY DEFINER RPCs                                        |
| 2     | ✅ Complete | REVOKE SELECT on sensitive columns; players read via view/RPCs                   |
| 2c    | ✅ Complete | REVOKE SELECT on `players` table for anon; polling fallback added                |
| 3     | ⏳ Pending  | REVOKE SELECT on `players`/`settings` for all roles; drop plaintext `pin` column |
| 4     | ⏳ Pending  | Full audit trail, login attempt logging                                          |

**Phase 3 is the most important remaining work.** The plaintext PIN column is a data exposure risk.

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

## Known Technical Debt

### High Priority

- **Plaintext PIN column** — `players.pin` still exists. Phase 3 must drop it.
- **No tests** — zero unit/integration/e2e coverage. The matcher, standings algorithm, and Glicko-2 are untested.
- **Monolithic AppContext** — 2012 lines, ~80 exports. Works but will become a maintenance burden as features grow.

### Medium Priority

- **`react-router-dom` installed but unused** — the custom string-state router works, but standard routing would enable deep links, browser back/forward, and bookmarking.
- **No migration CI gate** — migrations are pushed manually to production. A bad migration pushed directly could be destructive.
- **`src/firebase.js`** — legacy Firebase config still in the repo. Entirely unused; safe to delete.
- **`PlayerProfile.jsx` and `PlaytomicUpdatePrompt.jsx`** — currently unused components.

### Low Priority

- **Hardcoded test player names** — `TEST_PLAYER_FIRST_NAMES = ['zornitsa', 'jon', 'uziel']` appears in multiple components. Should be a single constant or a DB flag.
- **Hardcoded podium fallback** — `['Alex B', 'Uziel', 'Karlijn']` in Dashboard.jsx.
- **`AddToCalendarButton` opens Google Calendar URL** — `.ics` download was intentionally avoided to prevent iOS popup blocking, but this means Android/desktop users lose native calendar integration.

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
