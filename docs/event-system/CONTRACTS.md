# Event system: contracts

Interfaces the tasks in [`PLAN.md`](./PLAN.md) build. Design in
[`DESIGN.md`](./DESIGN.md).

## C-1 Database: end and finished

```sql
-- Start, as today, but a missing time means 19:00 (was 00:00).
public.tournament_start_ts(input_tournament_id uuid) returns timestamptz

-- start + coalesce(duration, 90) minutes. Null when the event has no date.
public.tournament_end_ts(input_tournament_id uuid) returns timestamptz

-- status = 'completed' or input_now >= tournament_end_ts. With no date, only
-- status = 'completed' finishes it. A blank time counts as missing.
private.event_finished(input_tournament_id uuid, input_now timestamptz default now()) returns boolean
```

- `stable`, `security definer` like `tournament_start_ts`, `search_path` set,
  no grants to `anon` or `authenticated` (internal helpers, as
  `tournament_transfers_closed`).
- Readers in DESIGN §3 call `private.event_finished` instead of reading
  `status`. Set-based readers (`has_played_night`, deletion summaries) may
  inline the same expression through `tournament_end_ts` for speed; the DB
  test checks they agree.

## C-2 Client: end and finished

In `src/features/events/eventFinished.ts`, re-exported by `eventPhase.ts`:

```ts
export function eventEndMs(t: {
  date?: string | null
  time?: string | null
  duration?: number | null
}): number | null
export function isEventFinished({
  tournament,
  now,
}: {
  tournament: OverTournament
  now?: Date
}): boolean
```

- `eventEndMs` = `tournamentStartMs(t)` + (`duration ?? DEFAULT_EVENT_DURATION_MINUTES`) minutes.
- `isEventFinished` = `status === 'completed'` or `now >= eventEndMs`.
- `isEventOver` is renamed `isEventFinished` at every caller; no alias left.

## C-3 Presets

`src/features/events/presets.ts`:

```ts
export type EventPreset = {
  id: 'americano' | 'king_of_the_court'
  format: 'lobster_matching' | 'king_of_court'
  entry: 'individual' | 'team' // the stored entry_mode values
  play: 'rounds_drawn_up_front' | 'not_recorded'
  scoring: 'points_per_match' | 'final_placings'
  standingsShown: 'on_reveal' | 'on_save'
  ratings: 'on' | 'off'
}

export const PRESETS: readonly EventPreset[]
export function presetFor({ format }: { format?: string | null }): EventPreset
export const recordsMatches: (p: EventPreset) => boolean // play !== 'not_recorded'
export const ratingsOn: (p: EventPreset) => boolean
export const revealsStandings: (p: EventPreset) => boolean // standingsShown === 'on_reveal'
export const savesPlacings: (p: EventPreset) => boolean // scoring === 'final_placings'
```

- `presetFor` falls back to Americano for an unknown or missing format, as
  `formatOption` does today.
- `AMERICANO`, `KING_OF_THE_COURT` and `formatOption` in `eventFormat.ts` read
  from `PRESETS` (format and entry mode stay where the form expects them).

## C-4 Shared cases

`supabase/tests/event_finished_cases.json`, read by both sides, as
`anonymised_name_cases.json` is: `{ "cases": [ { name, date, time, duration,
status, now, finished } ] }`, with `now` an ISO instant with offset. At least:

- before the end, at the end exactly (finished), one minute after;
- missing time (19:00), missing duration (90), both missing;
- `completed` before the end (finished);
- an end after midnight (start 23:00, 120 minutes);
- the last Sunday of October and of March (clock change);
- no date (never finished).

- **Client:** a vitest suite runs every case through `isEventFinished`, with
  `process.env.TZ = 'Europe/Amsterdam'` set at the top of the file (the
  client parses the start in local time).
- **Database:** `supabase/tests/event_finished.sh` inserts each case as a
  tournament inside one rolled-back transaction and checks
  `private.event_finished(id, now)`.

## C-5 To-dos

`src/features/events/eventTodos.ts`, pure:

```ts
export type EventTodoId = 'enter_scores' | 'apply_ratings' | 'reveal_standings' | 'save_placings'
export type EventTodo = { id: EventTodoId; required: boolean; done: boolean }

export function eventTodos({ tournament, matches, hasFinalStandings }: {...}): EventTodo[]
export function isWrappedUp({ tournament, matches, hasFinalStandings, now }: {...}): boolean
```

- Rows follow DESIGN §5. Oscars and raffle stay in `runOfShowSteps`, which
  reads `eventTodos` for the steps they share.
- `isWrappedUp` = `isEventFinished` and every required to-do done.

## C-6 Standings visibility

```ts
export function resultsWithheld({ tournament, isAdmin }): boolean
```

- Not admin, the preset reveals standings (`revealsStandings`), and
  `resultsSharedAt` not set. Independent of `status` and of the clock.
- `resultsPhase` had no caller outside its tests and is removed.

## C-7 Result code `event_finished`

`register_for_tournament` and `register_team_for_tournament` answer
`event_finished` when a non-admin signs up after the end (`private.caller_is_admin()`
decides who's an admin). The client shows the existing "This event has
already finished."
