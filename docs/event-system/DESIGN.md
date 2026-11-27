# Event system: design

How an event moves from signup to wrapped up, for every format. This plan
covers the foundation: one shared "finished" rule, and today's two formats
(Americano, `lobster_matching`; King of the Court, `king_of_court`) set up as
presets. New formats and settings come in later plans that build on it.

Interfaces in [`CONTRACTS.md`](./CONTRACTS.md), choices in
[`DECISIONS.md`](./DECISIONS.md), tasks in [`PLAN.md`](./PLAN.md).

## 1. Timeline

| Stage          | Starts when                 | In this plan |
| -------------- | --------------------------- | ------------ |
| Signups open   | the event is created        | yes          |
| Running        | start time                  | yes          |
| Finished       | end time (start + duration) | yes          |
| Signups closed | a close time, or the start  | later        |
| Cancelled      | an organizer cancels        | later        |

- **Finished comes from the clock**, for every format. Nobody presses it.
- **Finished does not lock scoring.** Missing scores can still be entered
  after the end. Scores lock when ratings are applied (as today's Finish
  does).
- **Wrapped up** is worked out, not pressed: finished, and no required to-do
  left (§5).

## 2. The finished rule

- **Start:** `date` + `time` in Europe/Amsterdam. `time` missing → 19:00.
- **End:** start + `duration` minutes. `duration` missing → 90.
- **Finished:** now ≥ end, **or** `status = 'completed'`.

The database (`private.event_finished`) and the client (`isEventFinished`)
implement the same rule and are tested against the same cases (C-4).

Production at plan time: every event has a time in `HH:MM` and a duration,
so neither default changes any existing event.

### What `status` means after this

| Value       | Meaning                                                             |
| ----------- | ------------------------------------------------------------------- |
| `upcoming`  | default; says nothing about where the event is                      |
| `active`    | unused: no row has it and nothing writes it. Left in the constraint |
| `completed` | ratings applied (Americano only). Scores locked                     |

`completed_at` is when ratings were applied. King of the Court is never set to
`completed`.

## 3. What Finished changes, reader by reader

### Database

| Function                                                                                     | Today                                             | After                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `private.has_played_night`                                                                   | registered in a `completed` event                 | registered in a finished event                        |
| `private.in_live_event`                                                                      | date ≤ today and not `completed`                  | date ≤ today and not finished                         |
| `private.delete_account`, `private.deletion_summary`, `public.admin_list_deletion_followups` | spots in events not `completed` count as upcoming | spots in events not finished                          |
| `public.get_my_team_invites`                                                                 | hides `completed` events                          | hides finished events                                 |
| `public.register_for_tournament`                                                             | no check                                          | a player is refused once finished; an admin as today  |
| `public.register_team_for_tournament`                                                        | refuses `completed`                               | a captain is refused once finished; an admin as today |
| `private.send_tournament_reminders`                                                          | `status = 'upcoming'`                             | not finished                                          |
| `public.tournament_start_ts`                                                                 | missing time → 00:00                              | missing time → 19:00, as the client                   |

**Admin paths keep today's gate** (`status = 'completed'`, so ratings applied):
`admin_transfer_registration`, the admin side of `change_team_partner`,
`register_*` on behalf, `cancel_registration`. After the end an admin may
still need to fix who played before applying ratings: the rating update
refuses a player who isn't registered.

**Ratings start between the end and applying ratings.** A played night now
counts from the end. A player whose Playtomic level changes after the end but
before ratings are applied gets the reset rule rather than the levelling start
(signup-revamp D-6), as if ratings had been applied. Expected; it follows from
the played night following the finish.

**Known gap, left as is:** `send_tournament_reminders` (its window and the
date in the email) and `private.auto_close_started_transfers` still read a
missing time as 00:00 inline. No event has a missing time.

`private.record_deletion_followups` doesn't read tournament status (it
searches free text), so it needs no change.

**Player paths are already closed** before the start and need no change:
transfers, partner changes and team cancels close 12 hours before
(`tournament_transfers_closed`); `respond_to_team_invite` refuses once
started. `admin_apply_tournament_ratings` already refuses a second apply.

After this, a past King of the Court left `upcoming` counts as a played night,
takes no signups and no longer blocks account deletion. Deleting an account
between the end and applying ratings is fine: the deleted-player trigger
still lets ratings be written (account-deletion DESIGN §2).

### Client

| Code                                                      | Today                                                        | After                                                                                                                                              |
| --------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isEventOver` (`eventPhase.ts`)                           | Americano: `completed`. KotC: clock                          | `isEventFinished`: §2 for every format                                                                                                             |
| `eventTimeGroup`                                          | `awaitingResults`: an Americano past its date, before Finish | `awaitingResults`: finished, ratings still to apply; `finished`: the rest. On the event day an Americano moves to Past at its end, not at midnight |
| `eventPhase` (Americano)                                  | `social`/`revealed` only once `completed`                    | `social`/`revealed` once finished                                                                                                                  |
| `resultsWithheld` (`resultsPhase` had no caller and goes) | withheld only between `completed` and the reveal             | §6: withheld until revealed, for presets that reveal                                                                                               |
| `hasLiveScores`                                           | until `completed`                                            | unchanged meaning: until ratings applied                                                                                                           |
| Run of show "Finish tournament"                           | applies ratings, sets `completed`                            | "Apply ratings", same writes; a to-do (§5)                                                                                                         |

- **An overrunning night stays `live`:** past the end on the event day, with
  matches still unscored and ratings not applied. Players keep landing on
  their matches. From the next day it's `social`, scored or not.
- **Home banners** for a rated event still wait for ratings to be applied
  (`eventTimeGroup` = `finished`): before that, standings are partial.
- **Admin roster controls** (add player or team, cancel, transfer, team
  lists) read one rule, `isRosterLocked` (EV-D3).
- **The client reads the start in the viewer's own timezone**, the database
  in Europe/Amsterdam. Accepted: members are in the Netherlands, and the
  server decides.
- `isTransferWindowClosed` reads a missing time as 19:00, as the server.

Callers of `isEventOver` (Home banners and streak, account stats, event cards,
registration, team lists, public event page) keep their logic and get the
shared rule.

## 4. Presets

A preset is a fixed set of parts (C-3). Today's two formats:

| Part            | Americano (`lobster_matching`)            | King of the Court (`king_of_court`) |
| --------------- | ----------------------------------------- | ----------------------------------- |
| Entry           | solo                                      | team (pair)                         |
| Play            | rounds, rotating partners, drawn up front | not recorded in the app             |
| Scoring         | points per match                          | final placings                      |
| Standings shown | on reveal                                 | on save                             |
| Ratings         | on                                        | off                                 |

Code that today asks `isKingOfTheCourt` to decide a lifecycle question asks
the preset part instead (`ratingsOn`, `standingsShown`, `recordsMatches`).
Other format branches (draws, forms, cards) move when a new preset needs them.

## 5. To-dos after an event

| If the preset has         | To-do                | Required | Done when                  |
| ------------------------- | -------------------- | -------- | -------------------------- |
| recorded matches          | enter missing scores | yes      | every match scored         |
| ratings on                | apply ratings        | yes      | `status = 'completed'`     |
| standings shown on reveal | reveal standings     | yes      | `results_shared_at` set    |
| final placings            | save placings        | no       | some team has a final rank |
| Oscars, raffle            | run and publish      | no       | as the run of show today   |

- **Wrapped up:** finished, and every required to-do done.
- The run of show lists the to-dos. Its order and the Oscars and raffle
  steps stay as they are; only "Finish tournament" becomes "Apply ratings".
- An unscored match blocks "Apply ratings", as it blocks Finish today.

## 6. Who sees standings

- **On reveal** (Americano): players see the final ranking only once
  `results_shared_at` is set. Admins always see it. This holds before the
  end too: today a player who opens `/events/:id/results` during the event
  sees the ranking, because "withheld" only starts at `completed`.
- **On save** (King of the Court): public once saved, as today (D-026 in
  `docs/team-events/`).
- Players' own match scores stay live, as today.

## 7. Later, not in this plan

Signups closed (close time), cancelled events, minimums, walk-ins,
round-by-round draws, live standings, more presets. Each gets its own plan or
plan section when it starts.
