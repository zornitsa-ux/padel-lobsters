# Event system: plan

Status is tracked outside the repo; this plan holds the work breakdown and how
to do it. Design in [`DESIGN.md`](./DESIGN.md), interfaces in
[`CONTRACTS.md`](./CONTRACTS.md), choices in [`DECISIONS.md`](./DECISIONS.md).

**Goal.** Every event moves from signup to wrapped up the same way. This
plan lays the foundation: one "finished" rule from the clock, today's two
formats as presets, and the to-dos left after an event.

**Constraints**

- **Migrations:** review → merge → `npm run release` from `main`
  (CLAUDE.md). No MCP or dashboard writes to production.
- **Testing is local only** (local stack, `npm run db:test`, plus
  `npm run rehearsal:sync` for EV1).
- **Behaviour stays as today** except where DESIGN §3 and §6 say otherwise.
- **Copy:** only "Finish tournament" becomes "Apply ratings" (and its detail
  line). Any other new wording goes to the owner in review.
- **No player names, emails or ids** in tests, fixtures or PRs.
- One task = one branch off `main`.

---

## Tasks

| #   | Task                            | What ships                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EV0 | Plan                            | These docs. No code.                                                                                                                                                                                                                                                                                             |
| EV1 | Finished in the database        | Migration: C-1 helpers; every reader in DESIGN §3 "Database" moved onto them; `tournament_start_ts` 19:00 default (EV-D4). Shared cases file (C-4) and `supabase/tests/event_finished.sh`. DB test for the readers (below). Grants and types regenerated. No client change.                                      |
| EV2 | Presets                         | `presets.ts` (C-3). `eventFormat.ts` reads it. Lifecycle code (`eventPhase`, `runOfShowSteps`, `useEventLifecycle`, `resultsPhase`, `hasLiveScores`, the Scores tabs) asks preset parts, not `isKingOfTheCourt`. No behaviour change: existing tests pass unchanged.                                             |
| EV3 | Finished in the client          | `eventEndMs`, `isEventFinished` (C-2), renamed at every caller. `eventPhase`, `eventTimeGroup`, `resultsPhase`, `resultsWithheld` per DESIGN §3 "Client" and §6 (C-6). Run-of-show "Finish tournament" → "Apply ratings". Vitest suite over the shared cases.                                                    |
| EV4 | To-dos and wrapped up           | `eventTodos.ts` (C-5); `runOfShowSteps` reads it for the steps they share. No new screen.                                                                                                                                                                                                                        |
| EV5 | Past cards link to the event    | A past event's results card links to `/events/:id` (Info tab), as upcoming and awaiting cards do.                                                                                                                                                                                                                |
| EV6 | Record when a spot is cancelled | Migration: `registrations.cancelled_at timestamptz`, stamped by a trigger (`registrations_stamp_cancelled`) whenever a row becomes `cancelled`, so no cancel path can forget it. Once set it doesn't move; a check allows it only on cancelled rows. No backfill. DB test through every path that cancels today. |

**Order:** EV0 first (EV1 and EV6 cite it). EV1 and EV2 in parallel → EV3
(after EV2, and after EV1's release) → EV4. EV5 and EV6 any time.

- **EV1 ships on its own:** merge, `npm run release`, then
  `npm run db:grants:prod`. It changes only database behaviour (played
  nights, deletion, signups refused once finished). Not sign-in-facing.
- **EV3 after EV1's release**, so the app and the database agree on when an
  event is finished. Its standings rule (EV-D5) and the finished rule ship in
  the same PR: either alone would show unrevealed rankings or keep finished
  Americanos under Upcoming.
- **EV4 after EV3:** to-dos need "finished".

## How to do each task

### EV1

- One migration. Function style as in `20261124150000_account_deletion.sql`:
  `set search_path`, `security definer` where the reader already is, grants
  restated after `create or replace`.
- Recreate each reader from its **latest** definition (the migration file
  named in `grep -l "function <name>" supabase/migrations/*`, last one wins),
  changing only the status test. Diff each new body against the old one in
  the PR description's checklist.
- `register_for_tournament`, `register_team_for_tournament`: the finished
  check sits after the admin check, so an admin acting for someone keeps
  today's behaviour (EV-D3). New result code `event_finished`; the client
  shows its generic error (no copy needed: the UI already hides signup once
  over).
- `in_live_event` keeps "date ≤ today"; only "not completed" becomes "not
  finished".
- **DB test** (`event_finished_readers.sql`, invented players only), one
  transaction, rolled back:
  - A King of the Court dated yesterday, `status = 'upcoming'`: a registered
    player has a played night, isn't in a live event, can't register; an
    admin can still register someone.
  - The same event today, before its end: in a live event, can register
    (when there's room).
  - An Americano past its end, not `completed`: played night counts;
    `admin_transfer_registration` still works.
  - `completed` before the end: finished.
  - Reminders: a finished event is skipped.
- **Rehearsal:** `npm run rehearsal:sync`, apply, then count played nights
  and live-event blocks before and after. Expected: only players in a past King of the
  Court that was never completed change.

### EV2

- Start from `eventFormat.ts`. Keep `isKingOfTheCourt` for code outside the
  lifecycle (draws, forms, cards); DESIGN §4 lists what moves.
- Add a preset test: each preset's parts, and `presetFor` on an unknown
  format.

### EV3

- Rename `isEventOver` → `isEventFinished` everywhere, then change its body.
  Keep `DEFAULT_EVENT_DURATION_MINUTES` the one default.
- `eventPhase` (Americano): `finished` replaces `status === 'completed'` in
  the `social`/`revealed` branch. `sealed` and `live` stay for before the
  end.
- `eventTimeGroup`: `awaitingResults` = finished and `resultsWithheld` for a
  player; `finished` = the rest of the finished events. Keep
  `AwaitingResultsCard`.
- `resultsWithheld` no longer reads `status` (C-6). Check every caller:
  Home banners, past results, Scores, My tournament, `nextMatch`.
- Update the tests that assert "Americano isn't over until Finish"; each
  change cites EV-D1 in the test name or a short comment.
- Run-of-show: step id `finish` → `apply_ratings`; title "Apply ratings";
  detail "Applies learned ratings and locks scores". Still locked until all
  matches are scored.

### EV4

- `eventTodos` per DESIGN §5. `isWrappedUp` exported for later screens; no
  caller yet besides tests.

### EV5

- Find the past results card in `pastEvents/`; wrap or link with the existing
  `LinkCard`. Check the public (signed-out) page too.

### EV6

- A BEFORE INSERT OR UPDATE trigger on `registrations`, not an edit to each
  path. The paths that write `cancelled` today, all covered by the DB test:
  `cancel_registration_row`, `cancel_team_rows`, `apply_registration_transfer`,
  `apply_team_transfer`, `respond_to_transfer` (a decline drops the
  recipient's waitlist spot), `change_team_partner`, and `delete_account`
  through the cancel helpers.
