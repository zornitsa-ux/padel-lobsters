# League 2nd Season — Implementation Plan

Living document for the work needed to finish Summer 2026 cleanly and run the
next season from inside the league area. Update the status table as phases land.

---

## 1. Status

| Phase               | Goal                                                | Gate to next                                         | State                                                      |
| ------------------- | --------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| 1 Finals & champion | Score Summer 2026 finals, crown champions           | Summer 2026 completed in production, champions shown | built on `league-2nd-season-phase1`; migration not applied |
| 2 Manage in league  | Admin tools move to `/league/:id/manage`            | `/admin` no longer hosts league management           | built on `league-2nd-season-phase1`, verified locally      |
| 3 Season lifecycle  | Hidden next-season draft, guarded phase transitions | Next season drafted while Summer 2026 still visible  | built on `league-2nd-season-phase1`, verified locally      |

Phase 1 ships first, into the existing `LeagueAdminSection`, so the current
season can finish without waiting on the relocation.

---

## 2. Findings (2026-10-03)

### 2.1 Finals are never created (blocks Summer 2026)

Production state of `Summer 2026` (`8a61c924-…`, status `knockout`): both
divisions have 12/12 group matches and 2/2 gold + 2/2 silver semis decided, and
**zero** `gold_final` / `silver_final` rows.

- `LeagueAdminSection` → `handleGenerateBracket` → `buildBracketPairings` only
  emits `gold_semi` / `silver_semi`. No code path emits a final.
- `KnockoutBracket` fills the Final slot from the semi winners when no final
  match exists, so the bracket _looks_ ready — but there is no row to score, so
  the admin Pending Matches list is empty.
- `admin_create_bracket_matches` already accepts `gold_final` / `silver_final`
  and rejects duplicates per division+stage. **No migration is needed to create
  finals.**
- There is no champion concept anywhere, and `isBracketComplete` is unused.

### 2.2 League admin lives under `/admin`

- All management is `LeagueAdminSection.tsx` (606 lines), mounted at the bottom
  of `AdminTools.tsx`.
- It is bound to `useActiveLeague()` — only the newest non-completed league is
  manageable. A completed season (e.g. a score correction) cannot be edited.
- Events already have the target pattern: `/events/:id/manage` tab, gated by
  `AdminEventRouteGuard`, sections via `?section=` (`EventManage.tsx`).

### 2.3 No real support for starting the next season

- `LeagueCreationForm` renders only when there is no active league, and only
  collects a name; `admin_create_league` already accepts divisions, phase dates
  and description.
- "Active" is `fetchActiveLeague` = newest league with status in
  `draft|group_stage|knockout`. Creating next season's draft now would hijack
  the dashboard card and `/league` from Summer 2026.
- `/league` (`LeagueIndexPage`) redirects to the active league, and the league
  header's "Seasons" back link points at `/league` — past seasons are
  unreachable while any season is active.
- All three league tables are publicly readable (`USING (true)`), so any draft
  is visible to players the moment it is created.
- Status changes are a generic "Advance →" with no preconditions; the RPC only
  enforces forward order. A season can go to `group_stage` with no groups or to
  `completed` with no finals.
- No way to edit season details or delete a mistaken draft. The dashboard card
  simply disappears when a season completes.

### 2.4 Duplication to clean up while in here

- `teamLabel` is re-implemented in `ScoreEntryForm.tsx` and
  `BracketMatchSlot.tsx`; `domain/teamDisplay.ts` already has `resolveTeamName`.
- Status label/badge maps are duplicated in `LeagueAdminSection`, `LeagueHome`,
  `LeagueIndexPage` and `LeagueDashboardCard`.

---

## 3. Decisions

| ID    | Decision                                                                                                 | Reason                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| L-001 | Champion is **derived** from the `gold_final` winner per division (silver champion from `silver_final`). | No schema change, cannot drift from match data.                                                               |
| L-002 | The next season's draft can exist while the current season is in progress, **hidden from players**.      | Admins need to prepare the next season ahead of time without disturbing the live one.                         |
| L-003 | Visibility is a separate `leagues.published_at` (null = hidden), not a new status value.                 | Keeps the existing `draft` → "Registering" player phase usable once published; status stays a pure lifecycle. |
| L-004 | Hiding is enforced by RLS, not just client filtering.                                                    | Public read policies mean a client-side filter alone would still leak drafts via the API.                     |
| L-005 | Copying teams from a previous season is **out of scope** for now.                                        | Not needed for the 2nd season.                                                                                |
| L-006 | Phase preconditions live in one pure domain function and are mirrored by the status RPC.                 | UI explains _why_ a step is blocked; the DB guarantees it.                                                    |

---

## 4. Phase 1 — Finals & champion

Goal: an admin can generate finals, enter their scores, see the champion, and
complete the season.

1. **Domain:** `buildFinalPairings({ divMatches, division })` in
   `domain/bracket.ts` → `gold_final` (gold semi winners) and `silver_final`
   (silver semi winners, including bye-awarded semis). Returns nothing for a
   bracket whose semis are not all decided.
2. **Domain:** `seasonChampions({ matches })` in a new `domain/champions.ts` →
   `{ [division]: { gold: teamId | null, silver: teamId | null } }`.
3. **Admin UI:** in `MatchManagementSection`, when a division's semis are all
   decided and no final exists, show "Generate Finals" (calls the existing
   `useCreateBracket`). Finals then appear in Pending Matches and use the
   existing `ScoreEntryForm`.
4. **Player UI:** champion banner (🏆 gold champion, silver winner) on
   `KnockoutContent` once the final is decided; champions shown per season on
   the seasons list.
5. **Complete season:** replace the generic advance for `knockout → completed`
   with "Complete season", enabled only when every division's finals are
   decided. Migration: `admin_update_league_status` refuses `completed` unless
   every final in every division has a winner.
6. **Dashboard:** decide the completed-season card state (show champions for a
   limited window vs. hide as today). Default: hide, as today.

**Built (2026-10-03):** `buildFinalPairings` / `isSeasonDecided` (`domain/bracket.ts`),
`divisionChampions` (`domain/champions.ts`), `ChampionBanner`, Generate Finals +
Complete Season in `LeagueAdminSection`, champions on the seasons list
(`fetchSeasonChampions`), migration `20261003120000_league_completion_requires_finals.sql`,
`supabase/tests/league_lifecycle.sql`. Also shared `DIVISION_LABELS` and
`src/test/leagueFactories.ts`.

## 5. Phase 2 — Management inside the league

1. Route `/league/:id/manage`, guarded by an `AdminLeagueRouteGuard`
   (non-admins redirect to `/league/:id`), lazy-loaded like `EventManage`.
2. `LeagueHome` header gets admin-only tabs (League | Manage), mirroring
   `EventShell`.
3. Split `LeagueAdminSection` into `features/league/manage/`:
   - **Overview** — phase stepper with the next action and its readiness
     (e.g. "4 group matches pending").
   - **Teams** — add/edit/remove, invite placeholders, group formation.
   - **Matches** — pending, results, generate bracket / finals.
   - **Season** — edit details, publish, complete, delete draft.

   Sections via `?section=` with `replace` navigation, as in `EventManage`.

4. Keyed by `:id`, so any season (including completed) is manageable.
5. Remove `LeagueAdminSection` from `AdminTools`; leave a link to `/league`.
6. Dedupe `teamLabel` → `resolveTeamName`, and the status maps → one
   `domain/leagueStatus.ts`.
7. Optional: admin-only "Enter score" action on match cards in the player view.

**Built (2026-10-03):** `/league/:id/manage` (`manage/LeagueManagePage.tsx`) behind
`AdminLeagueRouteGuard`, sections Overview / Teams / Matches. Entry point is a
**Manage** button in the league header rather than a tab, because `PageHeader`
renders either tabs or the division pills, not both. The Season section moves
to Phase 3 with the RPCs it needs; "Create League" moved to the seasons page
(admins, shown when no season is active, as before). Match cards on the
manage page show their stage (Gold Final, Silver Final, Semi-Final, Group A/B).
Status maps: index + manage share `LEAGUE_STATUS_PILL`; LeagueHome and the
dashboard card keep their deliberately different player-facing copy.
Item 7 not built.

## 6. Phase 3 — Season lifecycle

1. **Visibility (migration):**
   - Add `leagues.published_at timestamptz`; backfill existing rows to
     `created_at`. New leagues default to null (hidden).
   - Replace `leagues_read_all` with: published OR admin JWT.
     `league_teams_read` / `league_matches_read` follow the parent league's
     visibility.
   - `admin_publish_league(input_league_id)` sets `published_at`.
   - Check: placeholder players created for a hidden season's teams are visible
     through `players_public_fields_read`; confirm that is acceptable or filter.
2. **Current-season selection:** one pure `pickCurrentLeague({ leagues })`
   used by the dashboard bundle, `/league` and the manage area. Published only;
   prefers `group_stage`/`knockout` over `draft`. Admin queries see hidden
   drafts but the player-facing views still use the published pick.
3. **Seasons page:** `/league` stops redirecting. Lists current season first,
   then upcoming, then past seasons with champions. Admins also see hidden
   drafts (badge "Hidden") and a "New season" button. Dashboard and nav link
   to the current season directly so the extra hop is avoided.
4. **New season form:** name, divisions, phase dates, description. Creates a
   hidden draft and lands on its manage page. Allowed while another season is
   in progress.
5. **Phase readiness:** `phaseReadiness({ league, teams, matches })` drives the
   stepper; `admin_update_league_status` enforces the same rules:
   - `draft → group_stage`: published, every division has groups and fixtures.
   - `group_stage → knockout`: every division has its semis.
   - `knockout → completed`: every final decided (Phase 1).
6. **Edit / delete:** `admin_update_league` for details;
   `admin_delete_league` only for a draft with no matches.

---

**Built (2026-10-03).** Migration `20261003130000_league_visibility_and_lifecycle.sql`
(`published_at` + RLS on leagues/teams/matches/interests, `admin_set_league_published`,
`admin_update_league`, `admin_delete_league`, one-step + readiness checks in
`admin_update_league_status`); `domain/lifecycle.ts` (`phaseReadiness`,
`pickCurrentLeague`, `groupSeasons`); `/league/seasons` (`SeasonsPage`);
`NewSeasonForm`; Manage → Season section. Deviations from the plan above:

- `/league` still opens the current season (the League tab stays one tap);
  the list moved to `/league/seasons`, which the back links now use. With no
  current season, `/league` shows the list.
- The new-season form takes name + divisions only. No league date field is
  displayed anywhere in the app, so collecting them would have no effect.
- Season details editing covers name and divisions (divisions only in draft,
  never removing a division with teams).
- Placeholder players created for a hidden season's teams still appear in the
  Community list, as all placeholders do today. Names only; left as is.
- `.btn-secondary` gained the disabled styling `.btn-primary` already had, so
  blocked actions read as blocked app-wide.

## 7. Testing & verification

**Unit (vitest, next to existing domain tests)**

- `buildFinalPairings`: normal, silver bye, undecided semis, finals already present.
- `seasonChampions`: decided, undecided, single-division league.
- `phaseReadiness`: each transition, blocked and allowed.
- `pickCurrentLeague`: in-progress vs. draft, hidden excluded, none.

**Component (React Testing Library)**

- `LeagueManage` section switching (model on `EventManage.test.tsx`).
- Admin route guard redirects non-admins; Manage tab only for admins.
- Generate Finals / Complete season disabled until ready.
- Champion banner renders from a decided gold final.
- `AdminTools.test.tsx` updated for the removed section.
- Seasons page: hidden drafts only for admins; no redirect loop.

**Database (`supabase/tests/league_lifecycle.sql`, style of `registration_integrity.sql`)**

- Status RPC refuses each unready transition.
- Duplicate finals rejected.
- Anon/authenticated non-admin cannot read a hidden league, its teams or matches; admin can.
- `admin_delete_league` refuses a league with matches.

**End-to-end (Playwright `e2e/league-flow.spec.ts`)**

- Admin: create hidden season → publish → teams → groups → scores → bracket →
  finals → complete; player sees champion. Second spec: a hidden draft is not
  visible to a player while the current season stays on the dashboard.

**Gates per phase:** `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`; after migrations regenerate types and run `db:types:check`
and `db:grants:check`.

**Production verification**

- Phase 1: generate Summer 2026 finals in both divisions, enter scores, confirm
  champions on the league page and seasons list, complete the season, confirm
  dashboard behaviour.
- Phase 3: create the next season as an admin, confirm with a non-admin account
  that it is invisible (UI and a direct API read), publish, confirm it appears.
