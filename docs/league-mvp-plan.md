# Lobster League — Project Plan

## Overview

Two divisions (men's and women's) running in parallel with identical structure. 8 teams per division (16 teams, 32 players total). Teams are fixed pairs registered by admins. Players self-schedule matches, report scores via WhatsApp, and admins enter results into the app.

---

## Competition Rules

```
Division (Men's / Women's)
├── Group Stage (5 weeks)
│   ├── Group A — 4 teams, round-robin (6 matches total, 3 per team)
│   └── Group B — 4 teams, round-robin (6 matches total, 3 per team)
└── Knockout Stage
    ├── Gold Bracket — 1st & 2nd from each group, single elimination
    │   ├── Semi-finals (A1 vs B2, B1 vs A2)
    │   └── Final
    └── Silver Bracket — 3rd & 4th from each group, single elimination
        ├── Semi-finals (A3 vs B4, B3 vs A4)
        └── Final
```

**Match format:** Best of 3 sets. If 1–1 after two sets, a super tiebreak to 10 decides the match.

**Group standings:** 1 point per win, 0 per loss. No draws. Tiebreakers in order:

1. Head-to-head result between tied teams
2. Set difference (sets won − sets lost across all group matches)
3. Game difference (games won − games lost across all group matches)
4. Coin toss

---

## Design System Pre-work

These five shared components should be built before or alongside the league feature. Each eliminates existing ad-hoc duplication (~20 bottom-sheet modals, ~3 identical tab switchers, ~5 inline banners) and gives the league clean primitives to compose from. None are league-specific — they benefit the whole codebase.

| Component           | Location             | What it replaces                                                    |
| ------------------- | -------------------- | ------------------------------------------------------------------- |
| `Modal.jsx`         | `src/components/ui/` | ~20 ad-hoc `fixed inset-0 bg-black/60` bottom-sheet implementations |
| `TabSwitcher.jsx`   | `src/components/ui/` | 3+ identical `flex gap-1 bg-gray-100 p-1 rounded-xl` tab patterns   |
| `Badge.jsx`         | `src/components/ui/` | Scattered inline badge spans; wraps existing `.badge-*` CSS classes |
| `AlertBox.jsx`      | `src/components/ui/` | 5+ inline `bg-*-50 border border-*-200 rounded-xl p-3` banners      |
| `SectionHeader.jsx` | `src/components/ui/` | 4+ inline `<Icon> <h3 font-bold text-gray-700>` section headers     |

**`Modal`** — Props: `open`, `onClose`, `title`, `children`, optional `footer` slot. Bottom-sheet panel (`rounded-t-3xl bg-white`), drag handle bar, overlay dismiss.

**`TabSwitcher`** — Props: `tabs: [{id, label}]`, `value`, `onChange`. Gray-100 pill container, white/teal active state.

**`Badge`** — Props: `variant`, `label`, optional `icon`. Variants: `paid` (green), `unpaid` (coral), `pending` (yellow), `waitlist` (amber), `info` (teal), `gold` (yellow-50/yellow-700), `silver` (gray-100/gray-600). The last two are new for the league.

**`AlertBox`** — Props: `variant: info|warning|success|error`, `icon`, `children`. Standardises the coloured-background banner pattern.

**`SectionHeader`** — Props: `icon`, `title`, optional `action` node. Lucide icon (size 15) + bold gray-700 heading in a flex row.

**Also: token cleanup (non-blocking).** New league components use `lob-*` exclusively. Existing `lobster-*` references can be migrated incrementally. Fix the `lob-cream` colour discrepancy (CSS: `#FAF3E4`, Tailwind config: `#F5F0E8`). Mark `.btn-orange` deprecated.

---

## Navigation & Entry Point

**No new nav tab.** The current bottom nav has 5 items (Home, Events, Players, Merch, Settings). Adding a sixth crowds the mobile layout.

Instead, surface the league as a **`LeagueDashboardCard`** in the Dashboard home feed — placed between the next-event card and the stats card. The card links to `/league` and disappears automatically when league status is `completed`.

**Card design** — glassmorphic, matches `NextEventCard` pattern:

```
rounded-2xl p-4 bg-white/80 border border-white/90 shadow-sm
backdrop-filter: blur(12px)
```

- Header row: "🦞 Lobster League" in `font-display` + `<Badge variant="info" label="Group Stage · Week 2 of 5" />`
- If logged-in player has a team: their current position (`#2 in Group A`) and next opponent (`vs Flamingo FC`)
- If no team: passive summary ("16 teams competing")

**Route:** `/league` — protected (auth required).

If usage patterns show players navigating back to the league frequently mid-session, revisit promoting it to the nav in a future iteration.

---

## Phase 1 — Launch-ready

_Everything needed before the group stage begins._

---

### Feature: League & Season Setup

**Product requirements**

- Admin creates a league: name, divisions, group stage dates, season end date
- Status lifecycle (manual admin step-through, not a dropdown): `draft → group_stage → knockout → completed`
- One active league per division at a time

**Design**

- Form lives inside `/admin` → League section, gated with `<AuthGate role="admin">`
- Each status transition is an explicit button with a confirmation step — forward-only, no rollback in the UI
- Status badge visible at the top of the admin league view so the current state is always clear

---

### Feature: Team Management

**Product requirements**

- Add team: select two players from the existing players list
- Team fields: player 1, player 2, team name (optional), team song (optional), spirit animal (optional), experience level (Beginner / Intermediate / Advanced), preferred play times (optional free text — admin reference only)
- Edit and remove teams

**Design**

- List view divided by division via `<TabSwitcher>` Men's / Women's
- Each team row: spirit animal emoji + team name + player 1 avatar + player 2 avatar + experience `<Badge>` + edit icon
- "Add Team" → `<Modal>` with `TeamForm`

**`TeamForm` layout:**

- Player 1 / Player 2: searchable player select (Avatar + name, drawn from existing players)
- Team name, team song, spirit animal: text inputs with `.input` + `.label` classes
- Experience level: `<TabSwitcher>` Beginner / Intermediate / Advanced
- Preferred play times: textarea (optional, admin-only context note below field)

---

### Feature: Group Formation

**Product requirements**

- View all teams in a division with their experience levels
- App suggests two balanced groups (A/B) distributing levels evenly
- Admin can override team assignments
- Confirm → automatically generates all group-stage match fixtures (12 per division)

**Design**

- Two side-by-side columns: Group A | Group B (stacked on narrow screens)
- "Unassigned" pool above columns until all teams are placed
- Each team card: spirit animal emoji + team name + experience `<Badge>` (colour-coded: `bg-lob-teal text-white` Advanced, `bg-lob-amber text-white` Intermediate, `bg-gray-200 text-gray-600` Beginner)
- "Suggest balanced groups" button: runs client-side balancing algorithm, shows a diff preview, admin confirms
- "Confirm Groups" `.btn-primary`: disabled until all teams are assigned; triggers fixture generation on confirm

---

### Feature: Score Entry

**Product requirements**

- List of pending (unplayed) matches, filterable by division
- Per match: enter set scores (Set 1, Set 2, optional super tiebreak), date played (defaults to today), optional location
- Save → standings recalculate instantly

**Design**

- Pending match list: each row shows Team A vs Team B + round label + "Enter Score" button
- Tapping "Enter Score" opens `<Modal>` with `ScoreEntryForm`

**`ScoreEntryForm` layout:**

```
Set 1:   [  ] vs [  ]     ← large number inputs, full touch targets
Set 2:   [  ] vs [  ]
         [ ] Super tiebreak
Set 3:   [  ] vs [  ]     ← revealed only when super tiebreak checked

Date played:  [date input, defaults today]
Location:     [text input, optional]

[Save Result]  .btn-primary
```

- Live winner preview below inputs as scores are typed: "Team A wins 2–0"
- Validation: sets 1–2 must have a clear winner (no equal scores); set 3 requires ≥10 with 2-point lead

---

### Feature: Live Standings (player-facing)

**Product requirements**

- Group standings table per division, updates in real time as scores are entered
- Full results list — completed matches with scores and date
- My pending matches card for logged-in players with a team

**Design — League Home (`/league`):**

```
[header-gradient bar]  "🦞 Lobster League"  [season dates]

[<TabSwitcher>]  Men's  |  Women's   ← sticky below header

[Phase indicator]  "Group Stage — Week 3 of 5"  text-xs text-lob-muted

[PendingMatchCard]  ← shown only to logged-in players with a team

[Group A card]
  <SectionHeader icon={Users} title="Group A" />
  <GroupStandingsTable />

[Group B card]
  <SectionHeader icon={Users} title="Group B" />
  <GroupStandingsTable />

[Results]
  <SectionHeader icon={CheckCircle} title="Results" />
  Matches most-recent-first, grouped by week
  Each match: <LeagueMatchCard />
```

**`GroupStandingsTable` columns:** # | Team | W | L | Pts | Set +/-

- Table header: `text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100`
- Team cell: spirit animal emoji + team name (`font-semibold`) with `gap-2`
- Current user's team row: `bg-lob-teal-light/40` background + `border-l-2 border-lob-teal` left accent
- Dashed divider after row 2 (`border-dashed border-lob-amber/40`) — marks gold/silver cutoff
- Pts column: `font-bold text-lob-teal`

**`PendingMatchCard`:**

```
rounded-2xl p-4 bg-lob-coral/8 border border-lob-coral/20
  "YOUR NEXT MATCH"  text-[10px] uppercase font-bold text-lob-coral tracking-wider
  [emoji text-2xl]  [Team name font-display text-lg font-bold]
  Group A · Round 2   text-xs text-lob-muted
  <Badge variant="pending" label="Not yet played" />
```

When all group matches are played and waiting for bracket: muted variant — "Waiting for knockout bracket".

**`LeagueMatchCard`:**

- Team A name + score | Team B name + score, inline
- Date and location in `text-xs text-lob-muted`
- Winner team name `font-bold`, loser `text-gray-400`

---

## Phase 2 — Knockout

_Built once group stage is underway; needed before group stage ends._

---

### Feature: Bracket Generation

**Product requirements**

- Admin triggers bracket generation after all group-stage matches are scored (or overrides early)
- App computes final standings, creates 4 semi-final fixtures per division (2 gold, 2 silver)
- After semi-finals scored, creates finals fixtures
- Admin can correct a result if a score was entered wrong

**Design**

- `<AlertBox variant="success">` on admin league view when all group matches are done: "All group matches reported. Ready to generate knockout bracket." + "Generate Bracket" `.btn-primary`
- If matches still pending: `<AlertBox variant="warning">` "X matches still pending. Generate anyway or wait."
- Score correction: same `ScoreEntryForm` modal, opened from a completed match row

---

### Feature: Knockout Bracket View (player-facing)

**Product requirements**

- Visual bracket showing gold and silver brackets
- Team names fill in progressively as matches are played
- Completed match scores shown inline

**Design — added to League Home when `status = knockout`:**

```
[PendingMatchCard]  ← now shows bracket matchup

[<TabSwitcher>]  Gold 🥇  |  Silver 🥈

[KnockoutBracket]
```

**`KnockoutBracket` layout:**

```
Semi-finals          Final
─────────────────────────
[Team A1] ─┐
            ├─ [Winner] ─┐
[Team B2] ─┘              ├─ [Champion]
                          │
[Team B1] ─┐              │
            ├─ [Winner] ─┘
[Team A2] ─┘
```

**`BracketMatchSlot`:**

```
rounded-xl border border-gray-200 bg-white p-2 w-36
  Team row 1: emoji + name (truncated) + score if played
  ── divider ──
  Team row 2: emoji + name + score if played
```

- Pending slot: `border-dashed border-gray-200`, names in `text-gray-400`
- Winner row: `font-bold text-lob-dark`, loser: `text-gray-400`
- Connector lines: CSS `border-r-2 border-gray-200` — no SVG library needed for a 4-team bracket

---

### Feature: Team Pages

**Product requirements**

- Team name, spirit animal, both players (linked to player profiles)
- Experience level
- Group stage record (W/L/Pts/Set diff)
- Full match history with scores

**Design** — bottom-sheet drawer via `<Modal>`, triggered by tapping any team name:

```
[spirit animal emoji — text-6xl centered]
[Team name — font-display text-2xl font-bold centered]
[<Badge experience>]  [<Badge division>]

Players:
  Avatar + name → player profile   (× 2)

Group stage record:
  4-column stat grid (W / L / Pts / Set diff) — matches YourStatsCard pattern

Match history:
  <LeagueMatchCard compact /> per match
```

---

## Phase 3 — Future Seasons

- Player self-registration and partner matching (existing `league_interests` table is ready)
- In-app schedule coordination (preferred play times already collected)
- Multi-season archive and prior season browsing
- Nav promotion if usage warrants it

---

## Component Inventory

### New shared UI primitives

| Component           | Location             | Eliminates                     |
| ------------------- | -------------------- | ------------------------------ |
| `Modal.tsx`         | `src/components/ui/` | ~20 ad-hoc bottom-sheet modals |
| `TabSwitcher.tsx`   | `src/components/ui/` | 3 identical tab patterns       |
| `SectionHeader.tsx` | `src/components/ui/` | 4+ inline section headers      |
| `Badge.tsx`         | `src/components/ui/` | Scattered inline badge spans   |
| `AlertBox.tsx`      | `src/components/ui/` | 5+ inline info/warning banners |

### New league components

| Component             | Location                  | Phase | Used in                |
| --------------------- | ------------------------- | ----- | ---------------------- |
| `LeagueDashboardCard` | `src/features/league/ui/` | 1     | Dashboard              |
| `GroupStandingsTable` | `src/features/league/ui/` | 1     | League home            |
| `LeagueMatchCard`     | `src/features/league/ui/` | 1     | League home, team page |
| `PendingMatchCard`    | `src/features/league/ui/` | 1     | League home            |
| `GroupFormationTool`  | `src/features/league/ui/` | 1     | Admin panel            |
| `TeamForm`            | `src/features/league/ui/` | 1     | Admin modal            |
| `ScoreEntryForm`      | `src/features/league/ui/` | 1     | Admin modal            |
| `KnockoutBracket`     | `src/features/league/ui/` | 2     | League home            |
| `BracketMatchSlot`    | `src/features/league/ui/` | 2     | KnockoutBracket        |
| `TeamPage`            | `src/features/league/ui/` | 2     | Modal (any team tap)   |

---

## Out of Scope for MVP

- Player self-registration
- In-app match scheduling or time coordination
- Push/in-app notifications for new results
- Multi-season archive

---

## Existing Code Inventory

**Keep as-is:**

- `leagues` table schema — extend `status` default from `'signups_open'` to `'draft'`
- `league_interests` table — unused in MVP but intact for Phase 3 self-registration
- `src/data/leagueContent.ts` — all 9 informational content sections already written; used as static copy, no DB storage needed for MVP
- `src/lib/authPaths.ts` — `/league` already listed in `PROTECTED_PATHS`

**Drop and rebuild:**

- `league_teams` — existing schema was built for partner-matching self-registration (`proposer_id`, `invitee_id`, `status: pending|confirmed`); does not fit the admin-created fixed-pair model. No live data. Drop and recreate.

**Build fresh:**

- `league_matches` table (new)
- All RPCs (see Technical section)
- All UI components and hooks

---

## Placeholder Players

When an admin creates a league team, one or both players may not yet have an account in the app. The app must support creating a **placeholder player** — a minimal player record that holds their name and league data but cannot log in until they are formally invited.

### How it works

The existing `players.status` column (default `'active'`) already provides the foundation. The PIN login flow (`verify_player_pin_v2`) checks `coalesce(status, 'active') = 'active'` — any other status value blocks login automatically. No new table or linking mechanism is needed.

**The lifecycle:**

```
Admin creates placeholder          Admin sends invite          Player logs in
──────────────────────────         ─────────────────────       ───────────────
players.status = 'placeholder'  →  status → 'active'       →  Full app access
players.email  = null              email set                   Profile complete
(no PIN email sent)                PIN generated + emailed
                                   (existing send-pin-email
                                    Edge Function)
```

Because the player UUID is stable from creation, all league data (`league_teams.player1_id`, match records, standings) remains valid throughout. Nothing needs re-linking when they activate — the UUID is the same record before and after.

### What needs building

**Migration** — `players.status` is an unconstrained `text` column; no schema change required. `admin_add_player` already passes `coalesce(input_payload->>'status', 'active')`, so passing `status: 'placeholder'` works today.

**New RPC: `admin_invite_league_player(input_player_id uuid, input_email text)`**

- `require_admin()`
- Validates the player exists and is currently `'placeholder'`
- Sets `email = input_email`, `status = 'active'`
- Generates a new PIN (reuses the existing PIN generation loop)
- Writes `pin` + `pin_hash`
- Calls `private.send_pin_email(player_id, pin, 'new_signup')`

This is intentionally a single atomic action — the player goes from invisible to invitable in one step, not two.

**UI additions (admin Team Management view):**

- Placeholder players show a "Not invited" `<Badge variant="pending" />` in the team row
- An "Invite" button opens a small `<Modal>` collecting their email address
- On submit, calls `useInviteLeaguePlayer` mutation → shows success / error via `<AlertBox>`
- Once invited, the badge updates to "Invited" and the button is removed

**`TeamForm` change** — when selecting players, the player picker must also allow typing a name to create a placeholder inline (rather than requiring the admin to pre-create players separately). Flow: admin types a name not in the list → "Create placeholder: [Name]" option appears → on team save, placeholder is created first, then team is created with the new UUID.

### Out of scope for MVP

If a placeholder player attempts to self-register with a matching email via `self_signup_player`, the system will currently create a duplicate record. Detecting and merging duplicates is deferred — for the summer league, the admin-initiated invite flow is the only path. Document this for admins.

---

## Technical Implementation

### Architecture Decisions

**No AppContext extension.** The league is the first full feature slice using TanStack Query directly. `QueryClientProvider` is already in the tree (`src/main.tsx`); `queryClient` is exported from `src/lib/queryClient.ts`. Zero `useQuery`/`useMutation` calls exist anywhere yet — the league establishes the pattern.

**Auth outside AppContext.** `useAuth()` in `src/hooks/useAuth.js` is a standalone hook that manages its own session state via `supabase.auth.onAuthStateChange`. Any league component can call it directly — no AppContext required.

**Realtime is feature-local.** Instead of registering subscriptions in `useDataSync`, the league feature manages its own Supabase Realtime channel, scoped to the active league. Invalidates TanStack Query cache on change.

**All new files are TypeScript.** `.ts`/`.tsx` exclusively.

**Writes go through SECURITY DEFINER RPCs.** Reads are direct `supabase.from().select()` with RLS. Same pattern as the rest of the app.

---

### Feature Slice Structure

```
src/features/league/
├── domain/
│   ├── types.ts              # All TS interfaces and union types
│   ├── standings.ts          # Pure: computeGroupStandings(), applyTiebreakers()
│   ├── bracket.ts            # Pure: buildBracketPairings(), isBracketComplete()
│   ├── groupBalancer.ts      # Pure: suggestGroups() — experience-level balancing
│   └── leagueSchemas.ts      # Zod: TeamFormSchema, ScoreEntrySchema
├── api/
│   ├── queryKeys.ts          # leagueKeys factory
│   └── leagueQueries.ts      # Supabase query functions (no React)
├── hooks/
│   ├── useLeagueQueries.ts   # useQuery wrappers
│   ├── useLeagueMutations.ts # useMutation wrappers
│   └── useLeagueRealtime.ts  # Supabase channel → cache invalidation
└── ui/
    └── (all components from Component Inventory)
```

Containers (`LeaguePage.tsx`, `LeagueAdminSection.tsx`) live at `src/features/league/` root, not inside `ui/` — they are the wiring layer.

---

### Domain Layer (`domain/`)

**`types.ts`** — single source of truth for all league types:

```typescript
export type LeagueStatus = 'draft' | 'group_stage' | 'knockout' | 'completed'
export type Division = 'mens' | 'womens'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type GroupLabel = 'A' | 'B'
export type MatchStage = 'group' | 'gold_semi' | 'silver_semi' | 'gold_final' | 'silver_final'

export interface League {
  id: string
  name: string
  status: LeagueStatus
  divisions: Division[]
  group_stage_start: string | null
  group_stage_end: string | null
  created_at: string
}

export interface LeagueTeam {
  id: string
  league_id: string
  division: Division
  player1_id: string
  player2_id: string
  team_name: string | null
  team_song: string | null
  spirit_animal: string | null
  experience_level: ExperienceLevel
  preferred_play_times: string | null
  group_label: GroupLabel | null
  created_at: string
  player1?: Pick<Player, 'id' | 'name' | 'avatar_url'>
  player2?: Pick<Player, 'id' | 'name' | 'avatar_url'>
}

export interface SetScore {
  t1: number
  t2: number
}

export interface LeagueMatch {
  id: string
  league_id: string
  division: Division
  stage: MatchStage
  team1_id: string | null
  team2_id: string | null
  set_scores: SetScore[] | null
  winner_id: string | null
  played_on: string | null
  location: string | null
  created_at: string
}

export interface GroupStanding {
  team: LeagueTeam
  wins: number
  losses: number
  points: number
  setDiff: number
  gameDiff: number
  rank: number
}
```

**`standings.ts`** — pure standings computation, no React or Supabase:

- `computeGroupStandings(teams: LeagueTeam[], matches: LeagueMatch[]): GroupStanding[]`
  Filters to played group matches, tallies W/L/set diff/game diff per team, applies tiebreakers in order (H2H → set diff → game diff), assigns `rank`.
- `getTeamRecord(teamId: string, matches: LeagueMatch[]): { wins, losses, setDiff, gameDiff }`

**`bracket.ts`** — pure bracket logic:

- `buildBracketPairings(standings: Record<GroupLabel, GroupStanding[]>): BracketPairing[]`
  Returns the 4 semi-final pairings: gold (A1vB2, B1vA2), silver (A3vB4, B3vA4). Client passes these to the RPC rather than computing them server-side.
- `isBracketComplete(matches: LeagueMatch[], stage: 'semi' | 'final'): boolean`

**`groupBalancer.ts`** — pure group suggestion:

- `suggestGroups(teams: LeagueTeam[]): { A: LeagueTeam[], B: LeagueTeam[] }`
  Sorts teams by experience level (advanced → beginner), then alternates assignment to distribute levels. Returns a suggestion; admin can override.

**`leagueSchemas.ts`** — Zod validation:

```typescript
export const teamFormSchema = z
  .object({
    player1_id: z.string().uuid('Select player 1'),
    player2_id: z.string().uuid('Select player 2'),
    division: z.enum(['mens', 'womens']),
    experience_level: z.enum(['beginner', 'intermediate', 'advanced']),
    team_name: z.string().trim().optional(),
    team_song: z.string().trim().optional(),
    spirit_animal: z.string().trim().optional(),
    preferred_play_times: z.string().trim().optional(),
  })
  .refine((d) => d.player1_id !== d.player2_id, { message: 'Players must be different' })

export const scoreEntrySchema = z.object({
  match_id: z.string().uuid(),
  sets: z
    .array(z.object({ t1: z.number().int().min(0), t2: z.number().int().min(0) }))
    .min(2)
    .max(3),
  played_on: z.string().date(),
  location: z.string().trim().optional(),
})

export type TeamFormValues = z.infer<typeof teamFormSchema>
export type ScoreEntryValues = z.infer<typeof scoreEntrySchema>
```

---

### Database Layer

#### Migration 1 — Schema rebuild

File: `supabase/migrations/20260523000001_league_schema_rebuild.sql`

```sql
-- Drop old partner-matching league_teams (no live data)
DROP TABLE IF EXISTS public.league_teams CASCADE;

CREATE TABLE public.league_teams (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id            uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  division             text NOT NULL CHECK (division IN ('mens', 'womens')),
  player1_id           uuid NOT NULL REFERENCES public.players(id),
  player2_id           uuid NOT NULL REFERENCES public.players(id),
  team_name            text,
  team_song            text,
  spirit_animal        text,
  experience_level     text NOT NULL CHECK (experience_level IN ('beginner','intermediate','advanced')),
  preferred_play_times text,
  group_label          text CHECK (group_label IN ('A','B')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_different_players CHECK (player1_id <> player2_id)
);

CREATE TABLE public.league_matches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  division    text NOT NULL CHECK (division IN ('mens','womens')),
  stage       text NOT NULL CHECK (stage IN ('group','gold_semi','silver_semi','gold_final','silver_final')),
  team1_id    uuid REFERENCES public.league_teams(id),
  team2_id    uuid REFERENCES public.league_teams(id),
  set_scores  jsonb,   -- [{t1:int, t2:int}, ...]
  winner_id   uuid REFERENCES public.league_teams(id),
  played_on   date,
  location    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Patch leagues default status
ALTER TABLE public.leagues ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX league_teams_by_league     ON public.league_teams(league_id, division);
CREATE INDEX league_matches_by_league   ON public.league_matches(league_id, division);
CREATE INDEX league_matches_unplayed    ON public.league_matches(league_id, division) WHERE winner_id IS NULL;
```

#### Migration 2 — RLS

File: `supabase/migrations/20260523000002_league_rls.sql`

```sql
ALTER TABLE public.league_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_matches ENABLE ROW LEVEL SECURITY;

-- Reads: public (anon and authenticated)
CREATE POLICY "league_teams_read"   ON public.league_teams   FOR SELECT USING (true);
CREATE POLICY "league_matches_read" ON public.league_matches FOR SELECT USING (true);

-- Writes: admin only via JWT claim (defense-in-depth; actual mutations use RPCs)
CREATE POLICY "league_teams_admin_write" ON public.league_teams
  FOR ALL USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');
CREATE POLICY "league_matches_admin_write" ON public.league_matches
  FOR ALL USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');
```

#### Migration 3 — RPCs

File: `supabase/migrations/20260523000003_league_rpcs.sql`

All RPCs follow the established pattern: `SECURITY DEFINER`, `SET search_path TO 'pg_catalog','public','extensions'`, `PERFORM public.require_admin()` first, `SET LOCAL statement_timeout = '30s'`, `jsonb` input payload, `v_` prefix for locals.

| RPC                                         | Auth              | Purpose                                                                                                                         |
| ------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `admin_create_league(jsonb)`                | `require_admin()` | Create a new league row                                                                                                         |
| `admin_update_league_status(uuid, text)`    | `require_admin()` | Advance status; validates forward-only transition                                                                               |
| `admin_create_league_team(jsonb)`           | `require_admin()` | Insert a team; validates player uniqueness within division; creates placeholder players inline if a name-only entry is provided |
| `admin_update_league_team(uuid, jsonb)`     | `require_admin()` | Update team fields                                                                                                              |
| `admin_delete_league_team(uuid)`            | `require_admin()` | Delete team; blocks if matches exist for team                                                                                   |
| `admin_confirm_league_groups(uuid, jsonb)`  | `require_admin()` | Batch-update `group_label` on all teams + generate all group-stage fixtures in one transaction                                  |
| `admin_record_league_match_result(jsonb)`   | `require_admin()` | Write `set_scores`, derive and write `winner_id`, write `played_on`/`location`                                                  |
| `admin_create_bracket_matches(uuid, jsonb)` | `require_admin()` | Insert the semi-final (and later final) fixtures from client-computed pairings                                                  |
| `admin_invite_league_player(uuid, text)`    | `require_admin()` | Set placeholder player status to `'active'`, write email, generate PIN, send invite email                                       |

`admin_confirm_league_groups` is the most complex — it must atomically update all `group_label` values and `INSERT` all round-robin fixtures (6 matches × 2 groups × 2 divisions = 24 rows) within a single transaction. If any insert fails, the whole operation rolls back.

`admin_record_league_match_result` derives `winner_id` server-side from `set_scores` (counts sets won by each team) rather than trusting the client to pass it. The bracket-generation is intentionally kept client-side: `bracket.ts` computes the pairings from standings, then `admin_create_bracket_matches` simply inserts what the client computed. This keeps the standings tiebreaker logic in TypeScript where it's testable.

---

### Data Layer (`api/`)

**`queryKeys.ts`** — stable, typed key factory:

```typescript
export const leagueKeys = {
  all: () => ['league'] as const,
  active: () => ['league', 'active'] as const,
  teams: (leagueId: string) => ['league', leagueId, 'teams'] as const,
  matches: (leagueId: string) => ['league', leagueId, 'matches'] as const,
}
```

**`leagueQueries.ts`** — pure async functions, no React hooks:

```typescript
export async function fetchActiveLeague(): Promise<League | null>
// supabase.from('leagues').select('*').in('status',['group_stage','knockout']).maybeSingle()

export async function fetchLeagueTeams(leagueId: string): Promise<LeagueTeam[]>
// supabase.from('league_teams')
//   .select('*, player1:players!player1_id(id,name,avatar_url),
//                player2:players!player2_id(id,name,avatar_url)')
//   .eq('league_id', leagueId)

export async function fetchLeagueMatches(leagueId: string): Promise<LeagueMatch[]>
// supabase.from('league_matches').select('*').eq('league_id', leagueId)
```

---

### Hooks Layer (`hooks/`)

**`useLeagueQueries.ts`:**

```typescript
export function useActiveLeague() {
  return useQuery({ queryKey: leagueKeys.active(), queryFn: fetchActiveLeague })
}
export function useLeagueTeams(leagueId: string | undefined) {
  return useQuery({
    queryKey: leagueKeys.teams(leagueId!),
    queryFn: () => fetchLeagueTeams(leagueId!),
    enabled: !!leagueId,
  })
}
export function useLeagueMatches(leagueId: string | undefined) {
  return useQuery({
    queryKey: leagueKeys.matches(leagueId!),
    queryFn: () => fetchLeagueMatches(leagueId!),
    enabled: !!leagueId,
  })
}
```

**`useLeagueMutations.ts`** — each mutation invalidates only the affected query keys:

```typescript
export function useCreateTeam() // invalidates leagueKeys.teams(leagueId)
export function useUpdateTeam() // invalidates leagueKeys.teams(leagueId)
export function useDeleteTeam() // invalidates leagueKeys.teams(leagueId)
export function useInviteLeaguePlayer() // invalidates leagueKeys.teams(leagueId) — placeholder → active
export function useConfirmGroups() // invalidates teams + matches (fixtures generated)
export function useRecordResult() // invalidates leagueKeys.matches(leagueId)
export function useCreateBracket() // invalidates leagueKeys.matches(leagueId)
export function useUpdateLeagueStatus() // invalidates leagueKeys.active()
```

All call `supabase.rpc('<rpc_name>', { input_payload: ... }).throwOnError()`.

**`useLeagueRealtime.ts`** — feature-local subscription, no AppContext:

```typescript
export function useLeagueRealtime(leagueId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!leagueId) return
    const channel = supabase
      .channel(`league:${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_matches',
          filter: `league_id=eq.${leagueId}`,
        },
        () => qc.invalidateQueries({ queryKey: leagueKeys.matches(leagueId) }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_teams', filter: `league_id=eq.${leagueId}` },
        () => qc.invalidateQueries({ queryKey: leagueKeys.teams(leagueId) }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [leagueId, qc])
}
```

---

### Container Layer

**`LeaguePage.tsx`** — player-facing container, wires hooks to UI:

```typescript
export default function LeaguePage() {
  const { session } = useAuth()
  const { data: league, isLoading } = useActiveLeague()
  const { data: teams = [] } = useLeagueTeams(league?.id)
  const { data: matches = [] } = useLeagueMatches(league?.id)
  useLeagueRealtime(league?.id)

  const myTeam = useMemo(() =>
    teams.find(t => t.player1_id === session?.user?.id ||
                    t.player2_id === session?.user?.id) ?? null,
    [teams, session])

  if (isLoading) return <LoadingSpinner />
  if (!league) return <NoActiveLeague />

  return <LeagueHome league={league} teams={teams} matches={matches} myTeam={myTeam} />
}
```

**`LeagueAdminSection.tsx`** — admin container, lives inside `/admin`:

```typescript
export default function LeagueAdminSection() {
  const { session } = useAuth()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  if (!isAdmin) return <SignInBanner role="admin" ... />
  // hooks + admin UI
}
```

Admin section is imported into the existing `src/features/admin/AdminTools.tsx` alongside the other admin tools — no new route needed.

---

### Route Registration

`/league` route already exists in `PROTECTED_PATHS` in `src/lib/authPaths.ts`. Add the route to `App.jsx`:

```tsx
<Route path="/league" element={<LeagueRoute />} />
```

```tsx
function LeagueRoute() {
  return <LeaguePage /> // no onNavigate needed — LeaguePage uses useNavigate directly
}
```

---

### Build Order

The sequence below respects hard dependencies (nothing can be built until its dependencies exist).

**Step 1 — Database** _(unblocks everything)_

1. [x] Migration 1: drop/rebuild `league_teams`, create `league_matches`, patch `leagues.status`
2. [x] Migration 2: RLS policies
3. [x] Migration 3: all 9 RPCs (including `admin_invite_league_player`)
4. [x] Run `npm run db:reset` locally to verify clean replay

**Step 2 — Domain layer** _(pure TypeScript, no dependencies, write tests first)_

5. [x] `domain/types.ts`
6. [x] `domain/leagueSchemas.ts` (Zod)
7. [x] `domain/standings.ts` + unit tests
8. [x] `domain/groupBalancer.ts` + unit tests
9. [x] `domain/bracket.ts` + unit tests

**Step 3 — Shared UI primitives** _(unblocks all league UI)_

10. [x] `Modal.tsx`
11. [x] `TabSwitcher.tsx`
12. [x] `Badge.tsx`
13. [x] `AlertBox.tsx`
14. [x] `SectionHeader.tsx`

**Step 4 — Data layer**

15. [x] `api/queryKeys.ts`
16. [x] `api/leagueQueries.ts`
17. [x] `hooks/useLeagueQueries.ts`
18. [x] `hooks/useLeagueMutations.ts`
19. [x] `hooks/useLeagueRealtime.ts`

**Step 5 — Phase 1 UI** _(admin tools first, then player views)_

20. [x] `ui/TeamForm.tsx` — includes inline placeholder creation and player search
21. [x] `ui/InvitePlayerModal.tsx` — email input + invite action for placeholder players
22. [x] `ui/ScoreEntryForm.tsx`
23. [x] `ui/GroupFormationTool.tsx`
24. [x] `LeagueAdminSection.tsx` — wired into `/admin` via `AdminTools.tsx`
25. [x] `ui/GroupStandingsTable.tsx`
26. [x] `ui/LeagueMatchCard.tsx`
27. [x] `ui/PendingMatchCard.tsx`
28. [x] `LeaguePage.tsx` + route `/league` registered in `App.jsx`
29. [x] `ui/LeagueDashboardCard.tsx` — wired into `Dashboard.jsx`

**Step 6 — Phase 2 UI**

30. [x] `ui/BracketMatchSlot.tsx`
31. [x] `ui/KnockoutBracket.tsx` — wire into `LeaguePage`
32. [x] `ui/TeamPage.tsx` (drawer) — wire tap handler to all team name occurrences

---

## Open Questions & Decision Points

_Items requiring a product/design decision before implementation._

### 1. ~~Player list in TeamForm~~ ✓ Fixed

Added `useAllPlayers()` hook (`fetchAllPlayers` query, `leagueKeys.players()` cache key). `LeagueAdminSection` passes `allPlayers` to `TeamForm`. React Query handles caching.

### 2. ~~Week number display~~ ✓ Resolved

Decision: show "Group Stage" only, no week numbers. Already implemented.

### 3. League home sticky header scroll behavior

`TabSwitcher` in `LeaguePage` has `sticky top-0 z-10`. **Still needs testing on device** to confirm the correct `top-*` offset against the Layout nav bar height. Check `src/components/Layout.jsx` for the header height and adjust if the tab switcher slides under it.

### 4. ~~InvitePlayerModal — placeholder detection~~ ✓ Fixed

`fetchLeagueTeams` now selects `status` in the player join. `LeagueTeam.player1/player2` type updated to include `status?: string`. `LeagueAdminSection` shows the invite button only when `player?.status === 'placeholder'`.

### 5. ~~Score correction~~ ✓ Fixed

`ScoreEntryForm` now pre-populates from `match.set_scores`, `match.played_on`, and `match.location` when an existing result is passed. `LeagueAdminSection` shows a "Results" section with "Edit" buttons on completed matches, and the modal title changes to "Edit Score" vs "Enter Score".

### 6. ~~Draft leagues invisible to admin~~ ✓ Fixed

`fetchActiveLeague` now includes `'draft'` in the status filter. Admins can see and manage leagues in draft state.

### 7. ~~`authPaths.ts` — `/league` already listed?~~ ✓ Confirmed

`/league` is already in `PROTECTED_PATHS` in `src/lib/authPaths.ts`. No action needed.
