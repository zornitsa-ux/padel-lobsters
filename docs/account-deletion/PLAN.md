# Account deletion: plan

Status is tracked outside the repo; this plan holds the work breakdown and how
to do it. Design in [`DESIGN.md`](./DESIGN.md), interfaces in
[`CONTRACTS.md`](./CONTRACTS.md), choices in [`DECISIONS.md`](./DECISIONS.md).

**Goal.** A member can delete their own account, and an admin can delete
one for a member. Personal info is wiped, history stays under an anonymised
name, and nothing breaks.

**Constraints**

- **Migrations:** review → merge → `npx supabase db push` from `main`
  (CLAUDE.md). No MCP or dashboard writes to production.
- **Testing is local only** (local stack plus `npm run rehearsal:sync`).
- **No sign-in-facing release within 3 days of a tournament.** AD2 to AD5 are
  sign-in-facing.
- **Copy** (summary, code screen, goodbye, admin confirmation, follow-ups) is
  written into the code from the signed-off wording, not into these docs.
- **No player names, emails or ids** in tests, fixtures or PRs. Use the
  invented players in the seed.
- One task = one branch off `main`.

---

## Tasks

| #   | Task                       | What ships                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AD0 | Plan                       | These docs. No code.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AD1 | One name helper            | Closes [#134](https://github.com/zornitsa-ux/padel-lobsters/issues/134): one `firstName({ name, fallback })` in `src/lib`, every inline split moved onto it. `isAnonymisedName` (C-1) and the shared cases file; `firstName` returns the whole name for an anonymised one, and so do `getDisplayName`, `pastEvents/displayNames.ts` and `scheduleHelpers.ts`. Client only, no behaviour change today.                                                                         |
| AD2 | Deletion in the database   | Migration: C-1 (sequence, name functions, reserved-name trigger), C-2 RPCs and `private.delete_account`, C-3 table and RPCs, C-4 kinds, C-5 policies, C-6 triggers, C-7. Drops `admin_delete_player` and `admin_purge_player`, and removes their client callers with them: the "Remove player" button, the pending-approval flow and `deletePlayer` (D-7). Grants and types regenerated. DB test `supabase/tests/account_deletion.sql` (below). No UI calls the new RPCs yet. |
| AD3 | Readers handle deleted     | `usePlayers` adds `members`; every picker and member list from DESIGN §3.3 reads it. A deleted player's profile page. `AdminAlerts` follow-ups entry and its list, with dismiss (§3.4).                                                                                                                                                                                                                                                                                       |
| AD4 | Member deletes own account | Settings section: summary, admin notice, code, avatar removal, `delete_my_account`, local sign-out, goodbye screen (DESIGN §3.1). Gallery entries for any new ui variant.                                                                                                                                                                                                                                                                                                     |
| AD5 | Admin deletes for a member | "Delete account" on `PlayerDetailPage` in place of "Remove player": summary, `useConfirmOnBehalf`, typed name, admin's code, avatar removal, `admin_delete_account` (DESIGN §3.2).                                                                                                                                                                                                                                                                                            |
| AD6 | E2E and rehearsal          | Playwright (`@seed-write`): a member with a past result, an upcoming paid spot, a team-event spot and a league team deletes their account; then the roster, results, the partner's team and admin follow-ups are checked, and signing up again with the same email gives a new member. Rehearsal on a production copy (below).                                                                                                                                                |

**Order:** AD1 → AD2 → AD3 → AD4 and AD5 (in either order) → AD6. AD6's
e2e grows with AD4 and AD5, and the rehearsal runs before AD4 ships.

- **AD1 first:** anonymised names must display whole before any account can
  be deleted. It's client-only, so it can ship in any window.
- **AD2 ships on its own:** merge, `db push`, then `db:grants:prod`. Its
  client part only removes the old delete paths, and the database types
  are checked in CI, so the drop and its callers go together. Nothing else
  changes for anyone except the reserved names. Admins can't delete anyone
  between AD2 and AD5; nobody has been deleted on production so far.
- **AD3 after AD2's `db push`:** it reads `admin_list_deletion_followups`.
- **Release** AD4 and AD5 outside a tournament freeze.

## How to do each task

### AD1

- Follow #134's fix. Leave `community/playersSelectors.ts` building
  disambiguated names, but on top of `firstName`.
- The cases file lists names that match (one per animal, a big number) and
  names that don't: a real name starting with "Anonymous", a missing `#`,
  a two-word animal, a lowercase animal, extra spaces inside.

### AD2

- One migration. RPC style as in `20261123120000_level_every_spot.sql`:
  `statement_timeout`, `app.audit_source`, and tournament locks in the house
  order before touching registrations.
- `private.delete_account` steps follow DESIGN §2.3 in order. Reuse the
  bodies of `cancel_registration` and `cancel_transfer`. If they check the
  caller, pull the shared part out into a private function rather than
  copying it.
- The animals list lives only in the migration.
- `delete from auth.users` runs as the function owner. Test it in the
  DB test, then once by hand on the local stack with a real sign-in, to
  confirm GoTrue treats the account as gone.
- **DB test** (`account_deletion.sql`, invented players only):
  - Refusals: `code_required` with no `amr`, with a stale `amr` and with a
    `password` one. `admin_must_step_down`, `cannot_delete_self` (an admin targeting themselves), `in_live_event`,
    `already_deleted`.
  - A full deletion: every column in §2.3 step 8 wiped. The rows in step 7
    gone. Completed-event registrations, matches and rating events
    unchanged (counts). Upcoming registration cancelled and the waitlist
    promoted. Team-event captain moved and both rows still active. League
    team kept. Transfers cancelled. Shop requests cancelled and their names
    cleared. Auth user gone. One `account_deleted_self` event.
  - Free-text follow-ups: one row for a league team name holding the first
    name, none for a 2-letter first name.
  - Leftover token, with a JWT set from before: `update_my_profile` raises
    `player_deleted`; registering the deleted player, transferring to them,
    pairing them and voting for them all raise `player_deleted`.
  - Reserved names: signup, `update_my_profile`, `admin_update_player` and a
    league placeholder refuse "Anonymous Octopus #3" and
    "anonymous octopus #3".
  - Ratings: `apply_tournament_ratings` and `admin_review_rating_event`
    still work for an event a deleted player played in.
  - Teams: both members of an upcoming team delete in turn; the second
    deletion cancels the team. A waitlisted team with a deleted member is
    promoted when another team cancels.
  - A stale schedule can't swap a deleted player into a match, but a score
    can still be entered on a match they're already in.
  - Re-joining: a new signup with the old email creates a new active row.

### AD3

- Start with `grep -rn "usePlayers\|players_public" src` and sort every hit
  into the three kinds in DESIGN §3.3. Add any the table missed to the
  table in the same PR.
- `members` is derived once in `usePlayers`. Don't filter in each screen.
- A test per kind: a picker doesn't offer a deleted player, the roster
  doesn't list one, and a past result shows the whole anonymised name.

### AD4 and AD5

- Reuse `requestEmailCode` / `verifyEmailCode` and the existing code input
  from sign-in. Don't add a second code screen.
- Avatar removal is one function in `playerQueries.ts`, used by both.
- An error from the RPC after the avatar is gone shows the error and
  leaves the member signed in, so they can retry.

### AD6

- **Rehearsal** on a production copy (`npm run rehearsal:sync`), never on
  production:
  1. Before: count registrations, matches, rating events, league matches,
     raffle winners and Oscars votes for completed events, plus active
     registrations per upcoming event.
  2. Delete, through the UI, a copy of a player who has past results, an
     upcoming registration and a league team, and one who captains an
     upcoming team event.
  3. After: the completed-event counts are unchanged. Each upcoming event
     has one fewer active registration, or the same for the team event.
     The waitlist moved up where there was one.
  4. Visit the roster, both profiles, the past results they're in, the
     league table, the team event, the admin security panel and follow-ups.
     Check that nothing is blank and that no real name or photo shows.
