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

| Milestone                         | Target                           | Notes                                                  |
| --------------------------------- | -------------------------------- | ------------------------------------------------------ |
| Docs agreed                       | Wed 21 Oct                       | This PR                                                |
| **R1: team signup live**          | Tue 27 Oct                       | T1, T3–T7. Slipped from Fri 23 for D-015/D-016         |
| Partner invites live              | Within the first week of signups | T2 (edge function + RPC), so invites go out well ahead |
| PIN cutover                       | Thu 5 Nov                        | Other initiative; no event 2–8 Nov                     |
| **R2: seeding + final standings** | ≥ 3 days before the event        | Phase 2, client-only                                   |
| Event                             | Sun 15 Nov                       | 5 courts, 10 teams (OQ-1, D-017)                       |

---

## 1. Status

| ID  | Task                                                                                                                                                                                                                     | Phase | Depends on | PR       | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------- | -------- | ----- |
| T0  | Research, owner interview, docs                                                                                                                                                                                          | 0     | —          |          | [x]   |
| T1  | Migration: `entry_mode`, `starting_courts_published_at`, `event_teams` (seed, final_rank), `registrations.team_id`, `covered`, `partner_invites`; team RPCs; guards on individual/transfer RPCs; `supabase/tests` script | 1     | T0         | #56      | [x]   |
| T2  | Partner invites: `admin_send_event_invite`, `event_invite` email kind + template, admin Partner invites list (not invited / invited / signed in)                                                                         | 1     | T1         |          | [ ]   |
| T3  | Event form: Format picker, Max teams, team price                                                                                                                                                                         | 1     | T1         | #58      | [x]   |
| T4  | Join flow: partner search (active members), new-partner form, confirm + pay (captain)                                                                                                                                    | 1     | T1         | #60      | [x]   |
| T5  | Team card + registration list (teams, waitlist, change partner, transfers hidden)                                                                                                                                        | 1     | T1         | #60      | [x]   |
| T6  | Admin: add/cancel/promote team, change partner, team Payments view + reminder                                                                                                                                            | 1     | T1         | #59, #60 | [x]   |
| T7  | Verify Phase 1 locally (rehearsal data) → **R1**                                                                                                                                                                         | 1     | T1, T3–T6  | —        | [~]   |
| T8  | King of the Court domain (pure, tests first): `teamStrength`, `seedTeams`, `startingCourts`, `rankFromFinalCourts`                                                                                                       | 2     | T0         |          | [ ]   |
| T9  | Lifecycle: `eventPhase` King of the Court branch, Finish with zero matches + no ratings, matcher guard                                                                                                                   | 2     | T1         |          | [ ]   |
| T10 | Admin: seed reorder + Publish starting courts; Final standings entry                                                                                                                                                     | 2     | T8         |          | [ ]   |
| T11 | Player views: starting court on Schedule / MyTournament / upcoming card; Results ranking; Lobster Review rank                                                                                                            | 2     | T8, T9     |          | [ ]   |
| T12 | Verify Phase 2 locally (16-team event end to end) → **R2**                                                                                                                                                               | 2     | T9–T11     |          | [ ]   |

States: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked.

**Release order.**

- **R1:** merge T1 (with T3–T6, or before them) → `db push` → Vercel deploys.
  Nothing that writes team rows ships before the migration is pushed.
- **T2** ships after R1. Deploy `send-invite-email` (the new kind) first, then
  merge and push the RPC migration.
- **R2** is client-only.

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

**T12 gate.** Local event with 16 teams (some with new partners who have never
signed in):

- reorder seeds, publish, and check the starting courts from a player's view
- a late partner swap after publishing
- a team withdrawal, leaving an odd count
- partial final standings
- Finish with ratings untouched
- reveal, then check Results and Lobster Review ranks

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
- First-sign-in "finish your profile" prompt for captain-created partners
  (DESIGN §3.5). Pull it forward if time allows.
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
