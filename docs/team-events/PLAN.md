# Team events and King of the Court: plan

**Single source of truth for status.** Read it with [`DESIGN.md`](./DESIGN.md)
(findings F-1 to F-7, the target design, rules),
[`CONTRACTS.md`](./CONTRACTS.md) (exact RPC, schema and client contracts) and
[`DECISIONS.md`](./DECISIONS.md) (D-001 onwards, append-only).

**Goal.** Run a men's **team King of the Court** event:

- Teams sign up together, including with partners who aren't members yet. We
  capture their email, and an admin invites them.
- The admin names the courts, and the app seeds teams by strength and publishes
  their starting courts.
- Play happens off the app. Afterwards the admin can optionally record the final
  standings.

**Constraints**

- **Migrations:** review → merge → `npx supabase db push` from `main`
  (CLAUDE.md). There are no MCP or dashboard writes to production. Edge
  functions are deployed from `main` after merge, **before** the `db push`
  that calls them.
- **Testing is local only.** Use the local stack plus synced production data
  (`npm run rehearsal:sync`). Nothing is tested on Vercel previews.
- **No player names, emails or IDs** in commits, fixtures or PRs. One-off data
  fixes (such as merging a duplicate partner) are Jon-run SQL.
- **No sign-in-facing release within 3 days of a tournament.** The PIN cutover
  is Thu 5 Nov, so the event must be **on or after Sun 8 Nov**.
- One task = one branch off `main` in the main checkout. Each PR updates this
  file's status table and log in its own diff.

---

## 0. Timeline

| Milestone                         | Target           | Notes                                                   |
| --------------------------------- | ---------------- | ------------------------------------------------------- |
| Docs agreed                       | Wed 21 Oct       | #55                                                     |
| **R1: team signup live**          | Tue 27 Oct       | **Shipped Sat 24 Oct** (#56, #58–#61, migration pushed) |
| Partner invites live              | After R2 (D-023) | T2 (edge function + RPC); deprioritised behind Phase 2  |
| PIN cutover                       | Thu 5 Nov        | Other initiative; no event 2–8 Nov                      |
| **R2: seeding + final standings** | By Thu 12 Nov    | Phase 2, client-only                                    |
| Event                             | Sun 15 Nov       | 5 courts, 10 teams (OQ-1, D-017)                        |

---

## 1. Status

| ID  | Task                                                                                                                                                                                                                     | Phase | Depends on  | PR       | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ----------- | -------- | ----- |
| T0  | Research, owner interview, docs                                                                                                                                                                                          | 0     | —           |          | [x]   |
| T1  | Migration: `entry_mode`, `starting_courts_published_at`, `event_teams` (seed, final_rank), `registrations.team_id`, `covered`, `partner_invites`; team RPCs; guards on individual/transfer RPCs; `supabase/tests` script | 1     | T0          | #56      | [x]   |
| T2  | Partner invites: `admin_send_event_invite`, `event_invite` email kind + template, admin Partner invites list (not invited / invited / signed in)                                                                         | 1     | T1          |          | [ ]   |
| T3  | Event form: Format picker, Max teams, team price                                                                                                                                                                         | 1     | T1          | #58      | [x]   |
| T4  | Join flow: partner search (active members), new-partner form, confirm + pay (captain)                                                                                                                                    | 1     | T1          | #60      | [x]   |
| T5  | Team card + registration list (teams, waitlist, change partner, transfers hidden)                                                                                                                                        | 1     | T1          | #60      | [x]   |
| T6  | Admin: add/cancel/promote team, change partner, team Payments view + reminder                                                                                                                                            | 1     | T1          | #59, #60 | [x]   |
| T7  | Verify Phase 1 locally (rehearsal data) → **R1**                                                                                                                                                                         | 1     | T1, T3–T6   | #60      | [x]   |
| T8  | King of the Court domain (pure, tests first): `teamStrength`, `seedTeams`, `startingCourts`, `rankFromFinalCourts`                                                                                                       | 2     | T0          | #57      | [x]   |
| T9  | Lifecycle: King of the Court phase (over by the clock, standings public once saved, D-026), run of show without Finish/Reveal, matcher guard                                                                             | 2     | T1          | #63      | [x]   |
| T10 | Admin: seed reorder + Show starting court assignments (D-024); Final standings entry; court-removal warning (D-027)                                                                                                      | 2     | T8          | #64      | [x]   |
| T11 | Player views: starting court on Schedule / You / upcoming card; Results ranking; History + recently-completed banner; Lobster Review rank                                                                                | 2     | T8, T9, T10 | #66      | [~]   |
| T12 | Verify Phase 2 locally (16-team event end to end) → **R2**                                                                                                                                                               | 2     | T9–T11      |          | [ ]   |
| T13 | Results: courts moved per team and a Biggest climber on Results, the recently-completed banner and History (D-028)                                                                                                       | 2     | T11         |          | [ ]   |

States: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked.

**Release order.**

- **R1:** merge T1 (with T3–T6, or before them) → `db push` → Vercel deploys.
  Nothing that writes team rows ships before the migration is pushed.
- **T2** ships after R1. Deploy `send-invite-email` (the new kind) first, then
  merge and push the RPC migration.
- **R2** is client-only.

### Resume here (2026-10-24: T11 in review)

**Where we are.** R1 is live. **T9 (#63) and T10 (#64) are merged** to
`main`, and **T11 (#66, player views) is in review** (all client-only, no
migration). The owner reshaped King of
the Court during review, recorded as **D-024 to D-027**; DESIGN §3.3–3.4 now
describe what was built. In short:

- **Admin flow** (Schedule tab, admins only): seeds sorted by Playtomic level
  (D-025), up/down reorder, **Show starting court assignments to players** on
  the event day (D-024; it saves the order first), optional **Final standings**
  from the event day, starting empty and **public as soon as saved** (D-026).
- **No Finish or Reveal** on King of the Court (D-026). The event is over at
  start + duration (`isEventOver`); the run of show keeps only Oscars and the
  raffle. Phase: `open` → `set` (shown) → `live` (event day) → `social` (after
  the end) → `revealed` (standings saved).
- **Removing courts** is allowed; the event form warns when registered teams
  no longer fit (D-027).

**Next, in order:**

1. **T11: merge #66** (task notes in §2). It gates R2 (live by Thu 12 Nov).
2. **T13: courts moved + Biggest climber** (D-028; task notes in §2), after
   #66 merges. Timing to confirm with the owner: before R2 if it fits,
   otherwise straight after the event.
3. **T12: local verification** (gate in §2): the first browser walk-through of
   the player views. Then **R2**: merge, Vercel deploys. No migration.
4. **T2: partner invites** (unchanged, D-023). It's sign-in-facing, so not
   from Thu 12 Nov until after the event on Sun 15 Nov.

**Gap on `main` until #66 merges** (players only; R2 isn't released): once the
assignments are shown, or on the event day, players get the Schedule tab but
see the empty Americano view; Results on a King of the Court event shows the
Americano standings component; History and the recently-completed banner skip
King of the Court events.

**Release windows.** No sign-in-facing release within 3 days of a tournament.
The PIN cutover is Thu 5 Nov (other initiative). The event is Sun 15 Nov, so
nothing sign-in-facing ships from Thu 12 Nov.

**Working notes.**

- **No stacked PRs.** Branch each task off `main`; if one task needs another,
  start it after that one merges. When `main` moves under an open PR, merge
  `origin/main` into the branch rather than rebasing, so a normal push is
  enough.
- **Docs go in the same PR.** Each PR updates this file (status, resume
  point, log) and DESIGN as it goes. A standalone checkpoint PR is fine now
  and then, not the default.
- **Formatting.** Run `npm run format:check` before pushing: commits made in a
  worktree can skip the pre-commit formatter, and CI fails on it.
  **Local database.** Production data from 2026-10-24 plus the R1 migration
  (clean apply: 14 integrity counts unchanged, 29 `team_events.sql` checks,
  `db:grants:check` matched). `npm run db:reset` puts the seed data back. For
  a new migration, rehearse the same way: `rehearsal:sync` from `main`, then
  `npx supabase migration up --local` from the branch (CONTRIBUTING.md).
- The local integration branch `kotc-test` and the per-PR worktrees are no
  longer needed.
- **Code map (Phase 2).** Domain: `src/features/events/kingOfCourt/domain/`.
  Boundary parsing: `kingOfCourt/kotcInputs.ts`. Admin model and UI:
  `kotcAdmin.ts`, `useKingOfCourtAdmin.ts`, `KingOfCourtAdmin.tsx`,
  `StartingCourtsList.tsx`. Lifecycle: `eventPhase.ts` (`isEventOver`,
  `isEventUpcoming`, the King of the Court phase) and `useEventPhase.ts`.
  Writes: `updateEventTeams` in `teams/teamQueries.ts`.
  **Player side (T11):** one read path, `useKingOfCourtTeams` (saved seeds →
  `seedTeams` → `startingCourts`; the admin's `useKingOfCourtSeeding` is a
  draft layer on top) and `useMyKingOfCourt` (viewer's team, starting court,
  placing). Pure helpers in `kotcPlayer.ts`. Views: `KingOfCourtPlayerSchedule`,
  `MyStartingCourtCard`, `MyKingOfCourtLine` (Home), `KingOfCourtResults`,
  `TeamRankingList`. Multi-event surfaces (History, Home banner, Lobster
  Review) use `useTeamResultsByEvent`, one `event_teams` query over the King
  of the Court events only.

**Still open (deliberately):**

- Server edge cases: `change_team_partner` and `apply_team_transfer` raise
  `tournament_full` (from the capacity trigger) on an event an admin has pushed
  over capacity, instead of returning a status; `apply_team_transfer` skips the
  matches sync (moot while team events have no matches).
- `check_new_partner_email` has no rate limit (it reveals no more than signup).
- `transferQueries.ts` and `playerQueries.ts` still unwrap RPC rows by hand;
  switch them to `lib/firstRow`.
- Seed and standings saves write one team per request (accepted in the #64
  review): a dropped connection mid-save can leave two teams on one seed until
  the admin saves again. Making it atomic needs a migration.
- A cancelled team keeps its old `seed` and `final_rank`. Everything reads
  through active team entries, so it never shows; keep it that way in T11.
- Signed-out viewers can't read `event_teams` (no anon grant), so they never
  see a King of the Court event as `revealed`; their default tab stays Info.
  History asks them to sign in for those standings, and Lobster Review and
  the Home banner skip team results for them.

---

## 2. Task notes

**T1 (most of the risk).** Take the tournament row lock first, then the
registrations (house order). Tests in `supabase/tests/` must cover these cases
in a rolled-back transaction:

- full event → the team is waitlisted whole
- cancelling a team promotes the oldest waitlisted team
- a member already in the event is rejected
- a new partner creates an `active` player with the email, a confirmed
  `auth.users` row, an email identity and a `partner_invites` row, and **no
  `net.http_post`** (nothing is mailed)
- `email_in_use` against both `players` and `auth.users`
- the 3-a-day new-partner cap per captain
- a new partner without `input_partner_consent = true` is rejected, and
  `partner_invites.consent_confirmed_at` is set when it is given
- a placeholder is rejected as partner
- `change_team_partner` before and after the cutoff (and the admin bypass)
- the individual register, cancel and transfer RPCs reject team events
- the pair's statuses never diverge
- `partner_invites` can't be read by a non-admin

Run `npm run db:grants` for the new RPCs. **T7** also runs
`npm run rehearsal:integrity -- --local` after creating new partners on synced
data. Every one of the 14 counts must be unchanged (DESIGN F-7). It also signs a
new partner in by email code in Mailpit, through both Sign in and Sign up.

**T2.** `admin_send_event_invite` reuses `private.send_invite_email` with a new
`event_invite` kind (it needs the captain and event names in the payload).
Deploy the edge function before `db push`. Check locally in Mailpit.

**T4 copy.** Member search first. "My partner isn't on Padel Lobsters" second.
The new-partner form says up front that the captain is creating an account,
and the consent checkbox (D-011) is required: the submit button stays disabled
until it's ticked, and the wording is reviewed by the owner in the PR.
After signup with a new partner: "{partner} can sign in with {email} any time to
see the event. Let them know!" On a waitlisted result: "You're both on the
waitlist."

**T8.** Pure functions with Zod contracts, golden tests. Suggested home:
`src/features/events/kingOfCourt/domain/`.

**T11 (player views).** Everything reads through active team entries
(`useTeamEntries`), never raw `event_teams`, and derives the order with the
same domain calls as the admin (`seedTeams` over the saved seeds, then
`startingCourts`). Since D-025 the seeding hook (`useKingOfCourtSeeding`) has
nothing admin-only, so reuse or split it rather than repeating it.
`StartingCourtsList` is reusable.

- **Schedule tab** (players): before the assignments are shown, a "Starting
  courts are shown before the start" state (players get the tab from `live`,
  the event day, even before showing); after, the starting courts with the
  viewer's team highlighted. Admins keep the console.
- **You tab and upcoming-event card:** "You start on {court}" (or waiting at
  the bottom court) once shown; the team's final placing once `revealed`
  (`sectionsByPhase.revealed` shows the Americano placing card today).
- **Results tab:** the team ranking (`rankedTeams`; unranked teams after).
  Don't route it through `resultsWithheld` / `resultsSharedAt`: on King of the
  Court, saved standings are public (D-026).
- **History and the recently-completed banner** (Home): switch to
  `isEventOver` and show the team ranking for King of the Court. Both rank by
  match scores today, so they skip these events.
- **Lobster Review** (per-event ranks in `community/reviewScenarios.ts`,
  `corpReview`, called from `PlayerDetailPage` and `AdminTools`): the team's
  `final_rank` out of the registered teams; events without one are left out.

**T13 (courts moved, D-028).** A pure domain function over the saved order,
the courts and the final ranks (starting court from `startingCourts`, final
court ⌈rank / 2⌉, tie-break on the lower start), tested first next to the
other King of the Court domain code. Results shows the journey on each ranked
row in `TeamRankingList`. Results, the recently-completed banner and History
name the Biggest climber. The multi-event surfaces need each event's seeds and
courts, which `teamResultsByEvent` doesn't carry yet. No places-against-seed
figure.

**T12 gate.** Local event with 16 teams (some with new partners who have never
signed in):

- reorder seeds, show the assignments, and check the starting courts from a
  player's view (Schedule, You, upcoming card)
- a late partner swap after showing, then Save order
- a team withdrawal, leaving an odd count (one team waits)
- remove a court below the registered teams: the form warns, the console lists
  the teams with no court
- the event passing its scheduled end: Home's next event moves on, and the run
  of show offers only Oscars and the raffle (no Finish)
- partial final standings: public at once on Results, You and Lobster Review
- courts moved and the Biggest climber match the starting courts players were
  shown (if T13 is in)

---

## 3. Later (Phase 3, not scheduled)

- **Notification system** (owner, 2026-10-22). Today the app only shows state
  when someone opens it (the acceptance screen, and "your partner declined"
  from `event_teams.cancelled_reason`). Captains and partners would benefit
  from being told: partner accepted or declined, team promoted off the
  waitlist, transfer offered. That means an in-app inbox, and possibly email
  through the existing Resend path or push. It needs its own design.
- Men-only / gender signup check.
- Team names.
- Fixed-pair Americano (`team + lobster_matching`).
- Clean up ghost partner accounts (never signed in, no active registration),
  once PIN removal T16/T17 provides an auth deletion path.
- The partner can leave a team themselves.
- **Leagues adopt the same partner model** (D-012): `TeamForm` asks for the
  partner's email plus consent and creates an active member instead of a
  name-only placeholder. The 5 existing placeholders are converted by admin
  invite, then the placeholder machinery can go (it lines up with PIN removal
  T17).

---

## 4. Open questions (owner)

| ID   | Question                                                                 | Default if unanswered                                                   |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| OQ-4 | Starting courts when teams ≠ 2 × courts (an odd count, or under-filled)? | Fill from the top. An odd team is listed as waiting at the bottom court |
| OQ-6 | Is this event separate from regular event #13?                           | Assume separate; both must be ≥ Sun 8 Nov                               |

(OQ-2 tie rule and OQ-3 rounds were withdrawn by D-006. OQ-5, picking
placeholders as partners, was withdrawn by D-010: placeholders aren't offered.)

---

## 5. Log

- 2026-10-21: Research and owner interview. D-001 to D-009 recorded. Production
  read-only check: the last 8 events had 20–32 players, 5–8 courts and 6 rounds;
  there are 5 placeholders and 131 active players.
- 2026-10-21: The owner revised the design the same day:
  - **D-006:** no round tracking. The app seeds starting courts, play runs off
    the app, and final standings are optional. This drops the live round engine,
    the rounds field and draw handling, and makes Phase 2 client-only.
  - **D-002 / D-003:** no automatic emails. A new partner becomes a placeholder
    plus an admin-only pending invite (the email is kept off `players.email`,
    F-5), and an admin sends invites by hand.
- 2026-10-22: **D-010:** the owner chose sign-in without friction. A new partner
  is an active member with their own email (typed by the captain) from the start, and invites stay
  admin-only. Checked against the PIN removal integrity counts: placeholder
  partners would have added to counts 12 and 13, while active partners add to
  none (F-7). Confirmed that signup for an existing email signs that account in
  (F-5). Placeholders are not offered as partners.
- 2026-10-22:
  - **D-011:** the new-partner form tells the captain they're creating an
    account, and needs a ticked permission checkbox. The server requires and
    records the consent (`partner_invites.consent_confirmed_at`).
  - **D-012:** leagues will move to this partner model later (§3).
- 2026-10-22: **T1** schema and RPCs. Contracts frozen in `CONTRACTS.md`.
  D-013 (consent attester, admins exempt from the cap) and D-014 (team
  invariants enforced by the database). `supabase/tests/team_events.sql`
  covers every T1 case (19 checks). The existing DB scripts still pass. A
  production read-only check found only `lobster_matching` events and even
  capacities, so the new check constraints are safe.
- 2026-10-22: Owner review of R1:
  - D-013 and D-014 approved.
  - **D-015:** the partner accepts. Until then the captain can swap or cancel,
    and a decline cancels the team (complete teams keep the spots). Once
    confirmed, players only transfer.
  - **D-016:** all registration writes go through guarded RPCs.
  - **D-017:** two teams per court.
  - **D-018:** the schedule guard ships in R1.
  - **D-019:** an acceptance screen after sign-in, with an optional finish
    profile step.
  - OQ-1 answered: Sun 15 Nov, 5 courts, 10 teams. R1 moves to Tue 27 Oct.
  - A notification system was added to §3.
  - `team_events.sql` now has 24 checks, including acceptance, decline,
    captain cancel, transfers after acceptance and the payment RPC.
- 2026-10-22: T3 event form: Format picker (Americano / King of the Court), team total, ladder hint, format locked once anyone signs up. Capacity derives from courts (D-017) and the schedule generator refuses team events (D-018).
- 2026-10-22: T6 (Payments part): one row per team through the captain's registration, covered partner rows hidden, team price and counts, reminder to the captain.
- 2026-10-22: T4, T5, T6 (list part): team join flow, team card, teams listed as "A & B", admin Add/Cancel/Confirm team, change partner and the "hasn't signed in yet" hint. The Registration-tab edit form shares `formFromTournament`. The D-015 acceptance UI follows.
- 2026-10-22: **T7 rehearsal** (pre-D-015) on a production copy: the 14 integrity counts were unchanged after migrating, after creating 3 new partners, after their sign-ins (both Sign in and Sign up land in the captain-created account) and after the UI walk-through. No email was queued. The walk-through at phone width covered the captain, partner and admin flows. Fixes: Back keeps the draft, the roster refreshes after a new partner, and the King of the Court label. To redo after D-015/D-016.
- 2026-10-22: **D-015/D-019 UI** (#60): pending and confirmed team states, captain swap or cancel while pending, partner accept or decline (with the complete-teams copy at signup and on decline), a declined/cancelled notice with Sign up again, transfers on confirmed teams, the acceptance screen at `/team-invites` (once-per-session redirect, optional finish-profile step for captain-created accounts), admin pending/confirmed badges. Nits fixed: the admin "Their partner…" link, team counts in the roster line, and notices that can be dismissed and clear on status change.
- 2026-10-22: **T7 rehearsal 2** (D-015/D-016) on a fresh production copy, with an event of 5 courts and 20 players on 15 Nov: three teams were created (two with new partners, one with a member partner). The 14 integrity counts were unchanged after creation and after sign-ins, accept and decline, and no email was queued. Checked with real sessions: a direct registration write is refused (42501), a player can move their payment forward but can't set paid, the partner sees and accepts the invite (created-by-captain flag set), and a decline cancels the team with `partner_declined` visible to the captain. Still to do: the browser walk-through of `/team-invites` and the team card states (the Chrome extension was disconnected).
- 2026-10-24: Code review of #56–#60, and fixes:
  - **#56:** declining a transfer while on a waitlisted team failed
    (`team_inconsistent`, reproduced locally). It now only drops an
    individual waitlist row. `lock_team` re-reads the team under the lock.
    `account_created_by_captain` is scoped to the event. A captain's
    WhatsApp reminder names the team and the team amount.
    `team_events.sql` has 27 checks.
  - **#57:** an odd team waits at the bottom court in play (OQ-4), also when
    every court is full. Empty final-standing slots are skipped.
  - **#58:** the format picker stays locked while signups load. A save
    refused with `entry_mode_locked` puts the saved format back.
  - **#59:** accepting a transfer refreshes the team list. Payments waits for
    it instead of showing nothing owed.
  - **#60:** the Registration-tab edit save shows its errors. The invite
    redirect works for a second account on the same tab, and Not now returns
    to the interrupted page. `/team-invites` asks signed-out visitors to sign
    in. The not-signed-in hint names the right player.
  - **D-020:** the captain can pay before the partner accepts.
- 2026-10-24: Owner walk-through feedback:
  - The acceptance screen was redesigned (event heading, the captain's full
    name and avatar, stacked buttons) and its note is from the partner's side.
  - Team signup opens in a modal.
  - **D-021:** a captain-created account finishes its profile and confirms
    the account at first sign-in, before the invite.
  - Signing out and into another account on the same tab showed the previous
    account's profile and invites. This bug is on `main` too; it's fixed in its
    own PR (the query cache resets when the account changes).
  - The local stack was serving GoTrue's default link-only sign-in email
    (DESIGN F-8 of PIN removal). Restarting it fixed this.
- 2026-10-24: **Checkpoint.** Owner walk-through mostly done and OK. The 14
  integrity counts after it match the baseline, and no email was queued. Next:
  a comprehensive review of all branches together (§1 "Resume here").
- 2026-10-24: **Combined review** of everything in `main...kotc-test`, and fixes:
  - **D-022:** a captain-created partner can say "I'm not playing" without
    claiming the account, and `/account` is exempt from the finish-setup
    redirect.
  - /me is team-aware (team card, the team amount for the captain, sign up
    as a team on the event page).
  - `useTeamEntries` refetches teams a registration points at, so a new team
    can't drop out of the lists; the roster line counts the same entries.
  - Duplication removed: one decline dialog, `useEventForm`, `eventFormat`,
    `isActiveRegistration`, `firstRow`, `pricePerEntry`, `playerNameOf`, team
    entries built once per render, the player list refetched only after a new
    partner; `TeamInviteRedirect` renamed `PartnerOnboardingRedirect`.
  - Clean local apply on fresh production data: the 14 integrity counts were
    unchanged by the migration, and `team_events.sql` passed 29 checks.
- 2026-10-24: **R1 shipped.** #61, #56 (then `db push`), #58, #60, #59 and #57
  squash-merged in that order. T2 and Phase 2 are next (§1 "Resume here").
- 2026-10-24: **D-023:** the owner moved Phase 2 (T9–T12) ahead of partner
  invites (T2). Phase 2 tasks branch off `main` without stacking.
- 2026-10-24: **T9 (#63) and T10 (#64) merged** after two `/code-review`
  passes, with fixes in both PRs. Owner decisions on the way:
  - **D-024:** "Show starting court assignments to players", on the event day;
    Save order only after showing.
  - **D-025:** seeding uses reported Playtomic levels only.
  - **D-026:** no Finish or Reveal on King of the Court: over by the clock,
    standings public once saved, no prefill.
  - **D-027:** removing courts is allowed; the form warns when teams no longer
    fit.
  - No-date events can't exist (the form requires a date), so nothing handles
    one.

  Checks: each PR's suite, plus both merged on a scratch branch (2108 tests,
  `typecheck` clean). On the local DB, rolled back: an admin can write `seed`,
  `final_rank` and the show timestamp; a player's write touches 0 rows. No
  browser walk-through yet (T12).

- 2026-10-24: **T11** player views (#66). Players read the same saved order
  as the admin through one hook (`useKingOfCourtTeams`). Schedule shows the
  starting courts with the viewer's team highlighted once they're shown. You
  and Home's next-event card show "You start on {court}", then the team's
  placing once standings are saved. Results shows the team ranking, with no
  Matches tab and no reveal gate. History and the recently-completed banner
  use `isEventOver` and show the team ranking and winning team. In Lobster
  Review, a player's rank is their team's `final_rank`. A `/code-review`
  pass, and fixes:
  - Signed-out viewers get a sign-in prompt on Schedule, Results and History
    instead of empty courts or "no standings recorded".
  - While teams load, nothing claims that no standings exist, and the King of
    the Court banner waits.
  - Team mutations (register, cancel, promote, partner swap, accept) also
    refresh the all-events registrations and teams queries, so History, Home
    and Lobster Review don't keep stale teams.
  - History counts teams from the team results, not registered rows ÷ 2, and
    branches once for King of the Court. Lobster Games moved into its own
    component.
  - `corpReview` takes named arguments; Home memoises the next event's
    registrations.
  - Not changed: on the You tab, team entries are built twice (once for the
    registration card, once for the King of the Court hook) over one cached
    query. It's about 20 rows, and merging the two would tie the general team
    card to King of the Court.

  Checks: `typecheck` clean, 2135 tests passed, `format:check` clean, no new
  lint warnings. Still to do: the browser walk-through (T12).

- 2026-10-24: **D-028:** the owner asked how to report King of the Court
  results fairly, since a low-starting team often can't reach the King court.
  Decision: show courts moved for each team and a Biggest climber, both from
  the saved seeds and final ranks. Places beaten against seed was rejected.
  Logged as T13.
