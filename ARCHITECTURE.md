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
| Ratings    | Matchmaking V2 level model (`mm_rating`/`mm_sigma`)             |

Vitest unit test suite exists (`npm test`) — ~78 test files across `src/lib/`, `src/features/**` (including the full Matchmaking V2 domain), and component-level tests. Routing is `react-router-dom` v6.

---

## Frontend Architecture

### Page Router

`src/App.tsx` uses `react-router-dom` (`BrowserRouter` / `Routes` / `Route`). The tree is: `AppProvider` → `SetupGuard` → `BrowserRouter` → `Layout` → `VerificationGate` → `Suspense` → `Routes`. Every route except the landing page is `lazy()`-loaded into its own Rollup chunk; the app shell plus `Dashboard` stay in the entry chunk.

| Path                      | Renders                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `/`                       | redirect → `/home`                                          |
| `/home`                   | `features/home/Dashboard`                                   |
| `/auth/confirm`           | `components/AuthConfirm` (magic-link landing)               |
| `/events`                 | `features/events/Tournament`                                |
| `/events/:id`             | `features/events/EventShell` (layout route; index → `info`) |
| `/events/:id/info`        | `features/events/Registration`                              |
| `/events/:id/schedule`    | `features/events/Schedule`                                  |
| `/events/:id/results`     | `features/events/Scores` (`/scores` redirects here)         |
| `/events/:id/payments`    | `features/events/Payments` (admin; else → `info`)           |
| `/events/:id/oscars`      | `features/oscars/Game`                                      |
| `/events/:id/raffle`      | `features/raffle/RaffleContainer` (admin)                   |
| `/events/:id/eligibility` | `features/raffle/RaffleEligibilityContainer` (admin)        |
| `/community`              | `features/community/CommunityShell` → `Players`             |
| `/community/:id`          | `Players` with `focusPlayerId`                              |
| `/community/shop`         | `features/merch/Merch`                                      |
| `/merch`                  | redirect → `/community/shop`                                |
| `/admin`                  | `features/admin/AdminTools`                                 |
| `/account`                | `features/settings/Settings` (`/settings` redirects here)   |
| `/history`                | redirect → `/events` (history renders inside `Tournament`)  |
| `/transfer/:id`           | `components/TransferAccept`                                 |
| `/league`                 | `features/league/LeagueIndexPage`                           |
| `/league/:id`             | `features/league/LeaguePage`                                |
| `/league/:id/group-stage` | `features/league/GroupStageHistoryPage`                     |
| `*`                       | redirect → `/home`                                          |

Two compatibility shims live in `App.tsx`:

- `DeepLinkMigrator` — rewrites legacy `/?transfer=<id>` and `/?event=<id>` query deep links (still circulating in old WhatsApp/calendar shares) to `/transfer/:id` and `/events/:id`.
- `useLegacyNavigate` — adapts the pre-router `onNavigate(page, tournament?)` signature to `useNavigate` so components written against the string-state machine keep working. Components are being migrated to `useNavigate` directly; the adapter goes when the last one is.

Access control is in `src/lib/authPaths.ts`:

- `PUBLIC_PATHS = ['/', '/home', '/auth/confirm']` — path prefixes a guest can browse (boundary-aware prefix match: `/home/foo` matches, `/homer` does not)
- `PROTECTED_PATHS` is documentation only — `isPublicPath()` is default-deny, so anything not allowlisted is protected
- `VerificationGate` shows the PIN prompt for guests on a non-public path

### AppContext — Auth/Session Provider (was the monolith)

`src/context/AppContext.tsx` used to be a ~2012-line global store. It has been **dismantled into per-feature TanStack Query + Zod slices** under `src/features/**` (see "Feature Data Slices" below). What remains (~65 lines) is a thin auth/session provider consumed via `useApp()`: it holds `session`/`role` (from `useAuth`), the app-level `loading` flag, the auth passthrough actions (`loginWithPin`, `logout`, `fetchMyProfile`, `fetchAllPlayersWithPii`, `sendMagicLink`, `requestMyEmailChange`), and `selfSignup` (wraps `useAuth`'s version to also invalidate the roster cache). It is intentionally the single place the Supabase auth session is subscribed.

`src/hooks/useScheduleRealtime.ts` (mounted once by the provider) flips the initial `loading` flag and runs the one remaining Realtime subscription — matches INSERT/DELETE (schedule generation) — invalidating the `matches` query cache. Score UPDATEs are optimistically applied by `useMatchActions().updateMatch` and broadcast peer-to-peer, not over Realtime.

#### Feature Data Slices (default pattern)

Each domain owns its data next to where it's used. Per slice (all TypeScript): `<feat>Keys.ts` (query-key factory) · `<feat>Schemas.ts` (Zod boundary validation, `.passthrough()`) · `<feat>Queries.ts` (fetch + mutation fns, Zod-parse then `normaliseX`) · `use<Feat>.ts` (`useQuery` + `useMutation`/action hooks with `onSuccess` invalidation). Live slices: `features/players` (usePlayers, usePlayerActions), `features/settings` (useSettings), `features/events` (useTournaments, useTransfers, useMatches/useMatchActions, useRegistrations/useRegistrationActions), `features/raffle`, `features/oscars`. Session-dependent guards (admin authorization, `not_authenticated`) are passed `session`/`role` as hook args so slices stay free of context imports. Reads follow the flat-reads model: mount load + `refetchOnWindowFocus`; writes invalidate their key.

**Role derivation** — derived from the JWT session on every render:

```javascript
const role = session?.user?.app_metadata?.role ?? 'guest'
// role ∈ { 'admin', 'player', 'guest' }
```

The `role` claim is baked into `app_metadata` by the `verify-pin` Edge Function on every login. Components derive `isAdmin = role === 'admin'` locally; there are no global boolean state variables for auth roles.

**Key state**:

- `session` — Supabase Auth session (`supabase.auth.getSession()` / `onAuthStateChange`); `session.user.id` is the authenticated player's UUID
- `deviceId` — UUID v4 from `localStorage['lobster_device_id']`; stable across logins, used for device trust

The context now exposes ~10 auth/session values to consumers. All player writes go through RPCs (in the feature slices), never direct table writes.

### Component Sizes (largest first)

Measured 2026-07-26. League is no longer one file — it is `features/league/LeaguePage.tsx` plus `features/league/ui/*`.

| File                                            | Lines | Role                                 |
| ----------------------------------------------- | ----- | ------------------------------------ |
| `features/events/Schedule.jsx`                  | 801   | Match schedule                       |
| `features/history/History.jsx`                  | 784   | Historical tournament rendering      |
| `components/SignupRequest.jsx`                  | 714   | Self-serve signup flow               |
| `features/events/Registration.jsx`              | 623   | Event sign-up + detail               |
| `features/league/LeagueAdminSection.tsx`        | 585   | League admin controls                |
| `features/community/Players.jsx`                | 583   | Roster + player stats                |
| `features/community/PlayerProfileDrawer.jsx`    | 491   | Player profile drawer                |
| `features/merch/Merch.jsx`                      | 473   | Merch shop                           |
| `features/events/Payments.jsx`                  | 470   | Payment tracking                     |
| `features/settings/ProfileSection.jsx`          | 467   | Profile editing (+ Playtomic prompt) |
| `features/matchmaking/ui/RatingReview.tsx`      | 434   | Rating-delta admin review            |
| `components/AdminSecurityPanels.jsx`            | 415   | Security event panels                |
| `features/settings/Settings.jsx`                | 394   | Account page shell                   |
| `components/VerificationGate.jsx`               | 394   | Guest PIN gate                       |
| `features/matchmaking/MatchmakingContainer.tsx` | 373   | Schedule generation container        |
| `features/home/Dashboard.jsx`                   | 313   | Home page                            |
| `features/events/Tournament.jsx`                | 311   | Event list (+ history tab)           |
| `App.tsx`                                       | 307   | Router + route shims                 |
| `context/AppContext.tsx`                        | 65    | Auth/session provider (was 2012)     |

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

`src/lib/letterColors.ts` — deterministic A–Z letter→hex map for avatar fallbacks. **Locked 2026-04-30** (changing it would shift every avatar color site-wide).

### Navigation Shell

`Layout.jsx` renders:

- Sticky header: logo (`/logo-hd.png`), Instagram link, WhatsApp group button
- Bottom nav (mobile-first): Home, Events, League, Community, Account — plus Admin for admin sessions
- `DeviceTrustBanner` / `DeviceTrustIndicator`, driven by the `is_my_device_trusted` RPC
- `pb-safe` padding for iOS home-indicator safe area

---

## Backend Architecture

### Supabase

All DB access goes through the Supabase JS client (`src/supabase.js`) using the anon key + RLS. Admin operations use `SECURITY DEFINER` RPCs that run as the `postgres` role, bypassing RLS. All public-facing mutations are gated by `require_admin()` or `require_trusted_device()` within the RPC body.

### Data Model

#### Core tables

**`players`**

- `id`, `name`, `email`, `pin_hash` (bcrypt), `pin` (plaintext — **pending drop**, see Open Work), `nationality`, `avatar_url`, `playtomic_level`, `learned_rating` / `learned_rd` / `learned_volatility` / `learned_matches_count` / `learned_updated_at` (Glicko-2 V1 — **dead, pending drop**: no reader, and as of M4.3 no writer either), `role` (`player_role` enum: `'player'` | `'admin'`), `created_at`
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

| RPC                             | Auth                   | Purpose                                                                |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| `admin_add_player`              | `require_admin()`      | Create player                                                          |
| `admin_update_player`           | `require_admin()`      | Update any player field                                                |
| `admin_delete_player`           | `require_admin()`      | Delete player                                                          |
| `admin_regenerate_pin`          | `require_admin()`      | Regenerate a player's PIN                                              |
| `admin_approve_device`          | `require_admin()`      | Approve a pending device                                               |
| `update_my_profile`             | `auth.uid()` + trusted | Player updates own name/email/avatar/nationality                       |
| `create_transfer`               | `auth.uid()` + trusted | Player initiates a spot transfer                                       |
| `cancel_transfer`               | `auth.uid()` + trusted | Player cancels their pending transfer                                  |
| `respond_to_transfer`           | `auth.uid()` + trusted | Recipient accepts or declines transfer                                 |
| `approve_device`                | `auth.uid()`           | Player approves a pending device (no trust gate)                       |
| `reject_device`                 | `auth.uid()`           | Player rejects a pending device (no trust gate)                        |
| `get_my_profile_v2`             | `auth.uid()`           | Fetch own full record (email/phone)                                    |
| `lobster_oscars_cast_vote`      | `auth.uid()` + trusted | Cast/update a vote                                                     |
| `lobster_oscars_clear_vote`     | `auth.uid()` + trusted | Remove own vote                                                        |
| `lobster_oscars_admin_*`        | `require_admin()`      | Oscars session management                                              |
| `admin_persist_learned_ratings` | `require_admin()`      | Persist Glicko-2 V1 ratings — **caller-less since M4.3, pending drop** |
| `admin_record_raffle_winners`   | `require_admin()`      | Draw raffle winners (enforces cooldown)                                |
| `verify_player_pin_v2`          | anon                   | PIN check + rate limiting (called by Edge Fn)                          |
| `self_signup_player`            | anon                   | Self-service player registration                                       |
| `forgot_my_pin`                 | anon                   | Email-based PIN reset                                                  |

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

**Client-side role reading** — `src/hooks/useAuth.ts`:

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
- Client UX is live: `Layout.jsx` polls `is_my_device_trusted` and renders `DeviceTrustBanner` (dismissible explainer) and `DeviceTrustIndicator` in the header when the current device is untrusted

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

### Americano Standings (`src/lib/standings.ts`)

Sort order (single source of truth for Scores tab and Player profiles):

1. Total game points scored (descending)
2. Matches won (descending)
3. Head-to-head: who beat whom more often

`computeTournamentStandings(tournamentId, matches, playerIds?)` — returns sorted array.
`rankOfPlayer(playerId, tournamentId, matches)` — returns `{ rank, total }` or null.

### Matchmaking V2 (`src/features/matchmaking/`) — the live engine

Generates every event's schedule and learns player levels from results. Deep
reference: `docs/matchmaking-v2/` (DESIGN = the model, DECISIONS = why each call
was made, PLAN = status). **Read DECISIONS.md before changing the engine.**

**Schedule generation** — deterministic construction, then one bounded search.
`domain/generate.ts` orchestrates: feasibility audit (hard-rule quotas) →
sit-out plan → court banding by level → team split → cross-round refinement →
`ScheduleRun` report. Hard rules (4 per court, ≤1 lefty per team, no consecutive
sit-outs, gender mode) are move filters, never weights. Soft dimensions are each
normalized 0..1 per match so their weights are real exchange rates — balance,
partner gap, court spread, opponent repeat, mixed-team preference, sit-group
overlap. Three presets (competitive / balanced / social) vary banding tightness
and opponent-repeat weight only.

**Level learning** — one representation shared with the matcher: `mm_rating`
(mu, in Playtomic level units) + `mm_sigma` (uncertainty). A tournament's
matches are all evaluated against pre-tournament ratings; each player's delta is
`w · K · (point share − expected share)` with a Kalman-style gain, so uncertain
players move more. Deltas beyond ±0.30/event are capped and the remainder is
queued for admin review with a per-match breakdown. Learned levels are
admin-only.

**Determinism is a contract.** Same inputs + config + seed ⇒ byte-identical
`ScheduleRun`; `domain/` is pure (injected RNG, no `Date.now`) and pinned by
golden snapshots. Ratings are never sourced from `players_public` — that view
excludes `mm_*` by design; use `admin_get_mm_ratings()`.

### Lobster Matcher (`src/lib/lobsterMatcher.js`) — deleted

**Superseded by Matchmaking V2** (`src/features/matchmaking/`, see
`docs/matchmaking-v2/`). Every event is Lobster Matching and is generated by the
V2 engine. The simulated-annealing scheduler, the greedy `pairingEngine.js`, and
the unused Americano/Mexicano/RoundRobin generators in `scheduleHelpers.js` were
dead-but-bundled and have been deleted (D-001). `scheduleHelpers.js` now exports
only `shortName`. `ratingsRecompute.js` — the last writer of the `learned_*`
columns — has also been deleted (M4.3). The V1↔V2 comparison it was kept for is
preserved as `docs/matchmaking-v2/shadow-report.md`.

### Glicko-2 Ratings (`src/lib/glicko2.ts`) — offline only

Standard Glicko-2 (TAU=0.5, SCALE=173.7178). Scale mapping:
`padel_level = (rating - 1200) / 100` (Padel 3.0 ≈ Glicko 1500).

**No longer part of the app.** Its only runtime caller, `ratingsRecompute.js`,
was deleted at M4.3; nothing in the shipped bundle imports it. It survives
solely as the V1 baseline for two offline calibration harnesses
(`domain/rating/calibrate.harness.test.ts` — Brier parity gate vs. the V2
engine — and `seed.harness.test.ts`, via `ratingToPadel`), both of which are
`describe.skip` unless an `MM_*_FIXTURE` env var points at a production
snapshot. It goes when those harnesses do.

`applyTournamentRatings(priorByPlayerId, matches, playtomicByPlayerId)`:

- Team rating = average of individual ratings
- Match score = proportion: `s1/(s1+s2)` and `s2/(s1+s2)`
- Returns updated ratings only for players who played

### Historical Data Stitching (`src/lib/playerHistory.js`, `src/lib/playerStats.ts`)

Pre-Supabase tournaments are hardcoded in `src/data/historicalTournaments.js` (~404 lines), imported by ~10 modules — `src/features/history/History.jsx` is one consumer, alongside `playerHistory.js`, `playerStats.ts`, `historicalStats.js`, `aliasClustering.js`, `PlayerProfileDrawer.jsx`, `AccountStatsSection.jsx`, and the matchmaking `historyFixture.ts`. Each tournament has `players` (standings with `total` points and optional `podium` override) and `rounds` (match data with name strings instead of IDs).

The `player_aliases` table maps historical name strings → current player UUIDs. `buildHistoricalAppearances()` and `buildPlayerStats()` both read this map to stitch historical records into a player's lifetime stats.

`rankPlayers()` in `playerHistory.js` respects explicit `podium` field overrides (values 1/2/3) to pin real-world podium results when points-based ranking would be wrong.

---

## Utility Modules (`src/lib/`)

| Module              | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `standings.ts`      | Americano tournament standings (shared)                             |
| `playerStats.ts`    | Per-player lifetime stats (shared between Dashboard + Players)      |
| `playerHistory.js`  | Historical appearances from hardcoded data                          |
| `glicko2.ts`        | Glicko-2 rating calculations (offline harnesses only — not shipped) |
| `letterColors.ts`   | Deterministic A–Z → hex color map (LOCKED — do not change)          |
| `processAvatar.js`  | Center-crop to 256×256 WebP (HEIC-safe via `createImageBitmap`)     |
| `calendar.ts`       | .ics generator + Google Calendar URL builder (two alarms: 24h + 2h) |
| `whatsapp.ts`       | WhatsApp deep link builders; hardcoded group URL                    |
| `format.ts`         | `fmtEur`, `fmtEur0`, `fmtNum2` using `Intl.NumberFormat('en-GB')`   |
| `deviceId.ts`       | UUID v4 persisted in `localStorage['lobster_device_id']`            |
| `authPaths.ts`      | `PUBLIC_PATHS` / `PROTECTED_PATHS` and `isPublicPath()`             |
| `normalise.ts`      | Supabase row → app shape normalisers                                |
| `tournamentDate.ts` | Tournament date/time parsing + comparison                           |
| `queryClient.ts`    | TanStack Query client configuration                                 |
| `env.ts`            | Typed access to `import.meta.env`                                   |
| `perfMarks.ts`      | `performance.mark` instrumentation for load-time work               |

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
- **Apply all migrations to staging + production** — all migrations through `20260726073250_restore_league_read_grants.sql` are applied locally. Pushing to production is manual (`npx supabase db push` from `main`); the last recorded prod push was `20260725000001_mm_seed_ratings.sql`.

### Medium — Code Hygiene

- **`search_path = ''` on SECURITY DEFINER function bodies** — `require_admin()` and `require_trusted_device()` already have `search_path = ''`. The larger SECURITY DEFINER RPCs (`admin_add_player`, `update_my_profile`, etc.) use `search_path = 'pg_catalog, public, extensions'` (safe but not maximally strict). Setting `search_path = ''` on all of them requires qualifying every unqualified table/function reference — deferred until there is a broader function audit.
- **No migration CI gate** — migrations are manually pushed. A bad migration to production is difficult to reverse. Consider adding `supabase db diff` check to CI or at minimum a pre-push hook.
- **`src/data/leagueContent.ts` has no renderer** — open product question, not dead code. It exports `LEAGUE_SECTIONS`, `EXPERIENCE_LEVELS` and `DIVISION_LABEL`, is covered by `leagueContent.test.ts`, and nothing renders it. It was likely written for a league landing page that was never built, or that `features/league/ui/LeagueHome.tsx` superseded. Decide whether to surface the content or drop the module; kept deliberately in the meantime.
- **Orphaned writers in `src/features/history/aliasStorage.js`** — after `SmartMatchPanel.jsx` was deleted, `loadSkipped`, `saveAliases` and `saveSkipped` have no callers. `History.jsx` still reads aliases via `loadAliases` / `resolveName`, so the alias map is now read-only with no UI to edit it. Either rebuild an alias-matching admin surface or delete the writers along with the localStorage-backed alias feature.

### Low — Optional Improvements

- **RLS for admin ops (RBAC Phase 8)** — some SECURITY DEFINER admin RPCs could be replaced with direct table operations guarded by RLS admin policies, reducing the SECURITY DEFINER surface area. Low urgency; replace one at a time.
- **`AddToCalendarButton` opens Google Calendar URL** — `.ics` download was intentionally avoided to prevent iOS popup blocking; Android/desktop users lose native calendar integration.
- **Role staleness** — if a player's `role` is changed in the DB mid-session, `app_metadata.role` in the JWT updates only at the next token refresh (~1 hour). Acceptable for this threat model; if immediate revocation is ever needed, force sign-out via Auth Admin API in `admin_update_player` when role is changed.

---

## Known Technical Debt

### High Priority

- ~~**No tests on core algorithms**~~ — **Done.** `src/lib/standings.test.ts` and `src/lib/glicko2.test.ts` cover standings and Glicko-2; Matchmaking V2 has ~25 test files (17 under `domain/`, 8 of those under `domain/rating/`) including a golden-snapshot determinism gate; `src/features/events/validateSchedule.test.js` covers schedule validation. The legacy matcher is deleted, so its untested status is moot.
- ~~**Monolithic AppContext**~~ — **Done.** Fully dismantled into per-feature TanStack Query + Zod slices; `AppContext.tsx` is now a 65-line auth/session provider. See "AppContext — Auth/Session Provider".

### Medium Priority

- **Hardcoded historical data** — pre-Supabase tournaments live in `src/data/historicalTournaments.js` (~404 lines), imported by ~10 modules. No DB path exists, so adding a historical tournament requires a code change and a deploy.

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
