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

`src/App.tsx` uses `react-router-dom` (`BrowserRouter` / `Routes` / `Route`). The tree is: `AppProvider` → `BrowserRouter` → `Layout` → `VerificationGate` → `Suspense` → `Routes`. Every route except the landing page is `lazy()`-loaded into its own Rollup chunk; the app shell plus `Dashboard` stay in the entry chunk.

| Path                      | Renders                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `/`                       | redirect → `/home`                                                 |
| `/home`                   | `features/home/Dashboard`                                          |
| `/auth/confirm`           | `components/AuthConfirm` (magic-link landing)                      |
| `/events`                 | `features/events/Tournament`                                       |
| `/events/:id`             | `features/events/EventShell` (layout route; index → phase default) |
| `/events/:id/info`        | `features/events/Registration` (the event, and only the event)     |
| `/events/:id/me`          | `features/events/MyTournament` (the player's own tournament)       |
| `/events/:id/schedule`    | `features/events/Schedule`                                         |
| `/events/:id/results`     | `features/events/Scores` (`/scores` redirects here)                |
| `/events/:id/oscars`      | `features/oscars/Game`                                             |
| `/events/:id/manage`      | `features/events/EventManage` (admin console; else → `info`)       |
| `/community`              | `features/community/CommunityShell` → `Players`                    |
| `/community/:id`          | `Players` with `focusPlayerId`                                     |
| `/community/shop`         | `features/merch/Merch`                                             |
| `/merch`                  | redirect → `/community/shop`                                       |
| `/admin`                  | `features/admin/AdminTools`                                        |
| `/account`                | `features/settings/Settings` (`/settings` redirects here)          |
| `/history`                | redirect → `/events` (history renders inside `Tournament`)         |
| `/transfer/:id`           | `components/TransferAccept`                                        |
| `/league`                 | `features/league/LeagueIndexPage`                                  |
| `/league/:id`             | `features/league/LeaguePage`                                       |
| `/league/:id/group-stage` | `features/league/GroupStageHistoryPage`                            |
| `*`                       | redirect → `/home`                                                 |

`/events/:id/payments`, `/raffle` and `/eligibility` were retired outright when they became sections of `/manage` — old links to them now fall through to `*` → `/home`. `useLegacyNavigate` points the in-app callers straight at `/manage?section=…`.

Every event route resolves its `:id` through `EventRouteGuard` (`features/events/EventRouteGuard.tsx`), which consumes `useTournamentFromUrl()`'s `isPending` flag. Keeping "loading" distinct from "not found" is load-bearing: `useTournaments()` yields `data === undefined` while in flight, so collapsing the two made every cold deep link redirect to `/events` in its first render pass — and `replace` destroyed the URL so Back could not recover it. Pending renders `RouteFallback`; the redirect fires only once the list has settled without the id. `AdminEventRouteGuard` wraps it for `/manage` and sends non-admins to the event's Info tab rather than out of the event.

#### Event phase model (`features/events/eventPhase.ts`)

One pure module owns "where is this event in its life?", so no surface re-derives it from whichever single flag is nearest to hand — the failure mode behind four shipped IA defects. Sits alongside `resultsPhase.ts` and `oscarsPhase.ts`, and is unit-tested in the node environment like both.

`eventPhase({ tournament, matches, now })` → `open` → `set` → `live` → `sealed` → `social` → `revealed`, derived from `status`, `date`, whether matches are saved, and whether all are scored. Every tab, button and guard reads it.

Two deliberate boundaries:

- **The cascade reads only the tournament and its matches.** Oscars and raffle state feed the visibility helpers (`visibleEventTabs`, `isOscarsTabVisible`, `raffleWinnersWithheld`), never the phase. `eventPhase()` has nowhere to pass a session, so the coupling that locked players out of Oscars voting after Finish cannot return, and D-029's reveal independence holds by construction rather than by convention.
- **`status` is the sole authority on completion, not `completedAt`** — a Finish can apply ratings and then fail the status write, and the retry path keys off `status`.

`runOfShowSteps.ts` is the companion pure module for the eight-step closing sequence rendered by `RunOfShow.tsx` inside `/manage`. Ordering there is presentational; a step locks only where the data genuinely requires it (you cannot close voting you never opened).

**Three independent reveals, one door.** Standings (`results_shared_at` → phase `revealed`), Oscars winners (the session's `shared_at`) and raffle winners (`raffle_published_at`) are revealed separately, in any order, and all three live on the Results tab. So `anyResultsRevealed()` opens that tab when **any** of them has landed, and each sub-tab inside `Scores.tsx` keeps its own gate: Ranking shows the D-029 teaser until standings are shared, Lobster Games appears only when `lobster_oscars_get_results` returns rows (a server-side `shared_at` gate that applies to admins too), and Prize Raffle appears when winners exist and `raffleWinnersWithheld()` passes. Gating the door on the standings reveal alone stranded published raffle winners behind a tab nobody could open; gating it on `isAdmin` put a Results tab on events with no scores. Both are covered by defect-guard tests. `useEventLifecycle.ts` holds the lifecycle writes — finish (applies learned ratings first), reveal, publish raffle winners — and is the app's **only** completion control.

Two compatibility shims live in `App.tsx`:

- `DeepLinkMigrator` — rewrites legacy `/?transfer=<id>` and `/?event=<id>` query deep links (still circulating in old WhatsApp/calendar shares) to `/transfer/:id` and `/events/:id`.
- `useLegacyNavigate` — adapts the pre-router `onNavigate(page, tournament?)` signature to `useNavigate` so components written against the string-state machine keep working. Components are being migrated to `useNavigate` directly; the adapter goes when the last one is.

Access control is in `src/lib/authPaths.ts`:

- `PUBLIC_PATHS = ['/', '/home', '/auth/confirm']` — path prefixes a guest can browse (boundary-aware prefix match: `/home/foo` matches, `/homer` does not)
- `PROTECTED_PATHS` is documentation only — `isPublicPath()` is default-deny, so anything not allowlisted is protected
- `VerificationGate` shows the PIN prompt for guests on a non-public path

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
- Add unit tests first for `domain` and reducer logic; treat UI tests as secondary.
