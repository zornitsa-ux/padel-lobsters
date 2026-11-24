# Account deletion: design

A member can delete their own account, and an admin can delete one for a
member. Personal info is wiped. Past results, registrations and votes stay,
under a clearly fake numbered name. Upcoming registrations are cancelled.
Deleting an account must not break any screen, list or calculation.

The UI wording is written into the code when it's built, not into these docs.
Interfaces are in [`CONTRACTS.md`](./CONTRACTS.md), choices in
[`DECISIONS.md`](./DECISIONS.md), tasks in [`PLAN.md`](./PLAN.md).

---

## 1. How it works today

- **`players.id` is `auth.users.id`**, with no foreign key between them.
  `ensure_auth_user` creates the auth user when a player is inserted;
  `players_email_sync` / `auth_users_email_sync` mirror the email both ways.
  Clearing `players.email` writes the synthetic
  `player-<uuid>@padelobsters.internal` into `auth.users`.
- **A soft delete already exists:** `admin_delete_player` sets
  `status = 'deleted'` and clears the email, and nothing else. Name, phone,
  avatar and profile details stay, and the auth user and its sessions stay.
  `admin_purge_player` (service role only) hard-deletes the row and cascades.
  Production has no deleted players (checked 24 Nov), so `deleted` can take a
  new meaning without a backfill.
- **Deleting the `players` row is not an option.** It would cascade away
  registrations, rating events, raffle wins, Oscars votes and more, or fail
  on the no-action foreign keys (`registration_transfers`, `league_teams`,
  `event_teams.captain_id`, `partner_invites.invited_by` / `requested_by`).
  Match results hold players as id arrays (`matches.team1_ids`,
  `team2_ids`), so they survive only while the row does.
- **The client** reads the whole roster from `players_public`, deleted rows
  included, so that past results can still look up names.
  `isSelectablePlayer` (`playerSelectors.ts`) hides deleted players, but only
  the league `TeamForm` calls it.
- **Avatars** are public objects `avatars/player-<id>.webp`. There's no
  DELETE policy on the bucket, and `storage.protect_objects_delete` blocks
  deleting from SQL, so an avatar can only be removed through the Storage API.
- **Email codes.** `requestEmailCode` (`signInWithOtp`) and `verifyEmailCode`
  (`verifyOtp`) sign a member in with a 6-digit code. The new access token
  carries `amr: [{ method: 'otp', timestamp }]`, and the custom access token
  hook keeps it (checked locally 24 Nov). Access tokens live 1 hour.
- **Paid spots aren't refunded** on a normal cancellation: the Lobster Way
  says so, and members transfer their spot instead.
- **Team events** need every team to have exactly two active rows or none
  (`registrations_team_consistent`). Only the captain (before the 12h cutoff)
  or an admin can change the partner (`change_team_partner`).

## 2. What deletion does

One database function, `private.delete_account`, does the whole deletion
in one transaction. It's called through `delete_my_account` (the member) or
`admin_delete_account` (an admin) (CONTRACTS C-2). The avatar is removed by
the client first (§2.4).

### 2.1 Checks before anything changes

- The target exists and isn't already deleted.
- **Admin path:** the caller is an admin, and the target isn't the caller
  (`cannot_delete_self`, checked before the admin-target check). It works
  for any non-admin player, placeholders included.
- **The target isn't an admin** (`admin_must_step_down`). Admins ask Jon to
  remove the role by hand first; the app has no role management (D-6).
- **Recent email code:** the caller's token has an `otp` entry in `amr` from
  the last 10 minutes (`code_required`). For an admin deletion, that's the
  admin's token: the code goes to the admin.
- **Not in a live event** (`in_live_event`): the target holds no active
  registration in an event dated today or earlier that isn't completed.
  Its schedule, results and ratings are still being written, so the
  member is asked to try again once it's completed. The summary says so
  up front.

### 2.2 The anonymised name

`Anonymous <Animal> #<N>`. N comes from a sequence
(`private.deleted_player_number`) and is never reused. The animal is
`animals[(N - 1) % 12 + 1]` (Postgres arrays start at 1) from a fixed list of 12 one-word sea animals, kept in
the migration. Lobster isn't one of them, so the name never reads as a
member. With one running number, no two deleted players share a name.

Any name containing "anonymous", in any case, is reserved
(`private.is_reserved_name`, C-1). Every path that names a player refuses
it, including league placeholders, so a name that matches the pattern is
always a deleted account and no lookalike can pass for one. The client
relies on that: it shows the full name wherever it would otherwise shorten
to a first name (§3.3).

### 2.3 Steps, in order

All of these run in the one transaction. Tournament locks are taken in the
house lock order before any registration changes.

1. **Free-text follow-ups.** Before the name is wiped, record where it may
   appear in free text: league team name, song and spirit animal; shop
   admin comments; other players' admin notes; event notes. Matching is on
   the full name, or the first name when it's 3 letters or more, as a whole
   word and ignoring case. Only the table, row id and column are stored, in
   `account_deletion_followups` (C-3), never the name. Admins review and
   dismiss them (§3.4). False positives are expected and cheap.
2. **Upcoming individual registrations** (event dated after today, status
   `registered` or `waitlist`, no team): cancelled through the same step as
   `cancel_registration`, so the waitlist moves up. No refund, as with any
   cancellation (D-4).
3. **Upcoming team-event registrations:** the spot stays with the pair
   (D-3). If the deleted member is the captain and the partner isn't
   deleted, `captain_id` moves to the partner. The team is cancelled with
   `cancel_team_rows` instead, so the waitlist moves up, when both members
   are now deleted, or when the captain goes before the partner accepted:
   the partner never agreed to play. The deleted member's row stays active under the anonymised name
   until the captain or an admin replaces them with `change_team_partner`.
   The team shows on the admin follow-ups (§3.4) until then.
4. **Pending spot transfers** from or to them: `status = 'cancelled'`,
   `closed_reason = 'account_deleted'`.
5. **Partner invites** for them (`partner_invites.player_id`): deleted.
   Rows they sent (`invited_by`, `requested_by`) keep the uuid.
6. **Shop requests:** open ones get `status = 'cancelled'` and
   `cancelled_at`.
   `custom_name` is cleared on all of their rows (D-5).
7. **Rows about them that only matter while they're a member:** deleted from
   `player_aliases`, `player_email_clears` (as `player_id`),
   `player_levelling`, `player_signup_source`, `league_interests`,
   `tournament_reminders_sent`, `raffle_exclusions` and `security_events`
   (D-9).
8. **The `players` row:** `name` becomes the anonymised name and
   `status = 'deleted'`. Wiped: `email` (null), `phone`, `notes`,
   `playtomic_level` (null), `playtomic_username`, `playtomic_updated_at`,
   `gender`, `country`, `birthday`, `tagline`, `tagline_label`, `avatar_url`,
   `preferred_position`, `is_left_handed`. Kept: `id`, `created_at`,
   `role = 'player'`, `mm_rating`, `mm_sigma`, `mm_rating_updated_at` (derived
   from results that are kept, and never shown).
9. **The auth user:** `delete from auth.users`. Sessions, refresh tokens,
   identities, one-time tokens and MFA factors cascade with it, so the
   member can't sign in or refresh again. The email is free to sign up
   again as a new member (D-10).
10. **One record of the deletion:** a `security_events` row with the player
    id and the time, of kind `account_deleted_self` or
    `account_deleted_admin` (C-4). Nothing else.

What stays, unchanged: registrations in completed events, matches,
rating events, league teams and matches, raffle wins, Oscars votes given and
received, registration status events, and every uuid others' rows hold
(`created_by`, `actor_id`, `reviewed_by`, `cleared_by`).

### 2.4 Avatar

The client removes `avatars/player-<id>.webp`, and the file `avatar_url`
names if that's another one (an admin's upload uses a random name), through
the Storage API before calling the RPC. SELECT and DELETE policies let the
owner or an admin do it (C-5).
If removal fails, the client stops and shows an error, and nothing else has
changed. If the RPC fails after removal, the member has lost only the photo
and can try again. Removing a missing object counts as success.

### 2.5 The hour after deletion

The member's last access token stays valid for up to an hour; PostgREST and
Storage only check its signature. The client signs out locally right after
success. Only someone who kept a copy of the token could still use it,
and three checks stop it from writing anything (D-8):

- **The deleted row is frozen:** a `players` trigger refuses any update to a
  row whose status is already `deleted` (`player_deleted`), except one that
  changes only `mm_rating`, `mm_sigma` and `mm_rating_updated_at`. Applying
  and reviewing ratings for an event they played in still works. This stops
  `update_my_profile` from writing a name or phone back.
- **No new reference to a deleted player:** a trigger on the tables that
  attach a player to something refuses inserts, and updates that change the
  player column or reactivate a row, when the player is deleted
  (`player_deleted`, C-6). The same trigger stops an admin's stale list
  from registering, pairing or transferring to a deleted player.
- **No new avatar:** the avatar INSERT and UPDATE policies require the
  owner not to be deleted.

## 3. Screens

### 3.1 Member: delete my account

Settings gets a **Delete account** section at the bottom.

1. **What will happen:** shown before anything is sent. It covers their
   upcoming events (by name) and that paid spots aren't refunded, with a
   suggestion to transfer the spot first. It covers team events where the
   partner keeps the spot, league teams in an unfinished season where an
   admin will replace them, open shop requests that get cancelled, and past
   results that stay under an anonymous name. The client builds this from
   `get_my_deletion_summary` (C-2).
2. **Admins** see only a line telling them to ask Jon to remove their admin
   role first. There's no button.
3. **Send code:** `requestEmailCode` to their own email, without creating a
   user. They enter the 6 digits and `verifyEmailCode` signs them in again,
   which refreshes `amr`. The email is the usual sign-in code; the screen
   explains why it's sent.
4. **Delete:** remove the avatar (§2.4), then `delete_my_account`. On
   success, sign out locally and show a goodbye screen with no navigation
   back into the app.
5. **No email arrives:** the screen offers resending, and asking an admin to
   delete the account for them (§3.2).

### 3.2 Admin: delete a member's account

This replaces the **Remove player** action on the player admin page
(`PlayerDetailPage`).

- Hidden for admins and for players who are already deleted.
- It shows the same summary for that player (`admin_get_deletion_summary`).
- `useConfirmOnBehalf` names the player and restates what happens. The admin
  types the player's name, then gets a code at their own email and enters it.
- Then the avatar is removed and `admin_delete_account` runs, and the page
  shows the player as deleted.

The pending-approval list in `Players.tsx` (Approve, Reject, Link) and its
Admin entries also relied on `admin_delete_player`. Nothing creates `pending`
players any more (signup inserts `active`, and production has none), so the
whole flow is removed along with `admin_delete_player` and
`admin_purge_player` (D-7).

### 3.3 Everywhere else: three kinds of reader

Each screen that reads players falls into one of three kinds. AD3 confirms
the list with a grep before changing anything.

| Kind                        | Rule for a deleted player                                                   | Screens, and how each leaves deleted players out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pickers**: choose someone | Never offered. The server refuses the tables in C-6 anyway (§2.5).          | Active players only (`getAvailablePlayers`, `eligiblePlayers`): admin add player and `PlayerPicker` (`Registration`, `AddPlayerCard`), every team partner picker (`TeamSignup`, `TeamLists`, `AdminAddTeamCard`, `MyTournament`, change partner). Active only: transfer recipient (`TransferSpotModal`). `isSelectablePlayer`: league `TeamForm`. `useMembers`: Oscars nominees (`useOscarsSession`). Raffle eligibility leaves them out, and so does the server's draw (C-6). Manual swaps in `ScheduleRounds` only move players already in the schedule. |
| **Member lists and counts** | Left out.                                                                   | Active players only: community roster (`Players`), the first-name count on `PlayerDetailPage`, admin counts (`AdminTools`). `useMembers`: birthdays in `AdminAlerts` (Home). Greetings read the viewer's own row.                                                                                                                                                                                                                                                                                                                                          |
| **History**: what happened  | Shown under the anonymised name, never as a link to a profile with details. | Results and scores (`Scores*`, `PastEventResults`, `Schedule`, `MyTournament`, `MyRounds`, `RecentlyCompletedBanners`, `AccountStatsSection`); King of the Court results; league tables and matches; raffle winners; Oscars results; payments, transfers (`AdminTransferPanel`, `TransferAccept`) and registered lists of an upcoming team event (the kept row); shop orders; admin security panels                                                                                                                                                        |

- **One roster, two views.** `usePlayers` keeps returning every row (history
  needs names). `useMembers` reads the same cache through `isSelectablePlayer`
  and leaves deleted players out. Lists that already show only `active`
  players (which also drops placeholders) keep that stricter filter.
- **A deleted player's profile page** (`PlayerDetailPage`, `PlayerProfile`)
  shows only the anonymised name and that the account was deleted: no stats,
  no badges, no admin actions.
- **Names:** the one first-name helper from
  [#134](https://github.com/zornitsa-ux/padel-lobsters/issues/134) returns the
  whole name when `isAnonymisedName` is true, so "Anonymous Octopus #6" never
  becomes "Anonymous". The disambiguation helpers (`getDisplayName`,
  `pastEvents/displayNames.ts`, `scheduleHelpers.ts`) go through it.
- **Matchmaking and King of the Court:** a deleted member never has an active
  registration in an individual event. In a team event, the kept row
  counts like a player with no level (`NO_LEVEL_START`, King of the Court's
  "unrated" flag) until they're replaced.

### 3.4 Admin follow-ups

Home shows admins one card, "After account deletions", under the admin
alerts, while any of these is open. Each row links to where it's fixed:

- **Teams with a deleted member:** league teams in an unfinished season, and
  teams in an upcoming team event. Worked out live from `status = 'deleted'`,
  so the entry clears itself once an admin or captain replaces the member.
- **Free text to check:** open rows in `account_deletion_followups` (§2.3 step
  1), each linking to the row's edit screen. The admin dismisses each one.

Both come from `admin_list_deletion_followups` (C-3).

## 4. What could break, and the check for each

| Area                                                           | Why it's safe                                                                                             | Checked by                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Past results, ratings, league tables                           | Row kept; ids unchanged; nothing in completed events is touched                                           | Integrity counts before and after (PLAN AD6)  |
| Upcoming events                                                | Cancelled through the normal step; waitlist moves up; team spots kept                                     | DB test; rehearsal                            |
| Team consistency trigger                                       | Team-event rows stay active; only `captain_id` moves to an active member                                  | DB test                                       |
| League with a deleted member                                   | Team keeps both ids; admin replaces through `admin_update_league_team`                                    | DB test; follow-up shows and clears           |
| Signup "this name already has a profile" (`signup_name_match`) | Anonymised names are reserved, so no real signup can match one                                            | DB test                                       |
| Re-joining with the same email                                 | Email cleared, auth user deleted, old emails deleted; signup creates a new row                            | DB test; e2e                                  |
| Reminder functions                                             | No email: the existing `skipped_no_email` path; only a kept team-event row can reach it                   | DB test                                       |
| Raffle and Oscars                                              | Eligibility and nominees come from active registrations and the member list; past wins and votes are kept | Rehearsal                                     |
| First-name splits                                              | One helper, whole anonymised name (#134)                                                                  | Unit test                                     |
| Stale token                                                    | Frozen row, reference trigger, avatar policy (§2.5)                                                       | DB test with a token from before the deletion |
| Admin security panels                                          | `admin_list_security_events` joins the anonymised name; only the deletion row is left                     | Rehearsal                                     |

## 5. Out of scope

- Restoring a deleted account (D-10).
- Admin role management (D-6).
- Deleting players who have no history differently. Everyone goes through
  the same anonymisation, so there's only one path to get right.
- Logs held by Supabase and Vercel outside the database (auth and request
  logs). They expire on the platform's own schedule.
