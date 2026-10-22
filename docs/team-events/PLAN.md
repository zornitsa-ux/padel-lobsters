# Team events and King of the Court: plan

**Single source of truth for status.** Read it with [`DESIGN.md`](./DESIGN.md)
(findings F-1 to F-7, the target design, rules) and
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
| **R1: team signup live**          | Fri 23 Oct (signups open Sat 24) | T1, T3–T7. The one migration for the whole initiative  |
| Partner invites live              | Within the first week of signups | T2 (edge function + RPC), so invites go out well ahead |
| PIN cutover                       | Thu 5 Nov                        | Other initiative; no event 2–8 Nov                     |
| **R2: seeding + final standings** | ≥ 3 days before the event        | Phase 2, client-only                                   |
| Event                             | OQ-1                             | ≥ Sun 8 Nov                                            |

---

## 1. Status

| ID  | Task                                                                                                                                                                                                                     | Phase | Depends on | PR  | State |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------- | --- | ----- |
| T0  | Research, owner interview, docs                                                                                                                                                                                          | 0     | —          |     | [x]   |
| T1  | Migration: `entry_mode`, `starting_courts_published_at`, `event_teams` (seed, final_rank), `registrations.team_id`, `covered`, `partner_invites`; team RPCs; guards on individual/transfer RPCs; `supabase/tests` script | 1     | T0         |     | [ ]   |
| T2  | Partner invites: `admin_send_event_invite`, `event_invite` email kind + template, admin Partner invites list (not invited / invited / signed in)                                                                         | 1     | T1         |     | [ ]   |
| T3  | Event form: Format picker, Max teams, team price                                                                                                                                                                         | 1     | T1         |     | [ ]   |
| T4  | Join flow: partner search (active members), new-partner form, confirm + pay (captain)                                                                                                                                    | 1     | T1         |     | [ ]   |
| T5  | Team card + registration list (teams, waitlist, change partner, transfers hidden)                                                                                                                                        | 1     | T1         |     | [ ]   |
| T6  | Admin: add/cancel/promote team, change partner, team Payments view + reminder                                                                                                                                            | 1     | T1         |     | [ ]   |
| T7  | Verify Phase 1 locally (rehearsal data) → **R1**                                                                                                                                                                         | 1     | T1, T3–T6  |     | [ ]   |
| T8  | King of the Court domain (pure, tests first): `teamStrength`, `seedTeams`, `startingCourts`, `rankFromFinalCourts`                                                                                                       | 2     | T0         |     | [x]   |
| T9  | Lifecycle: `eventPhase` King of the Court branch, Finish with zero matches + no ratings, matcher guard                                                                                                                   | 2     | T1         |     | [ ]   |
| T10 | Admin: seed reorder + Publish starting courts; Final standings entry                                                                                                                                                     | 2     | T8         |     | [ ]   |
| T11 | Player views: starting court on Schedule / MyTournament / upcoming card; Results ranking; Lobster Review rank                                                                                                            | 2     | T8, T9     |     | [ ]   |
| T12 | Verify Phase 2 locally (16-team event end to end) → **R2**                                                                                                                                                               | 2     | T9–T11     |     | [ ]   |

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

- Partner accept step (D-003).
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
| OQ-1 | Event date, number of courts, max teams?                                 | Needed before R1 so the admin can create the event                      |
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
- 2026-10-22: T8 KotC domain: pure seeding, starting-court and final-rank functions with Zod contracts and tests in `src/features/events/kingOfCourt/domain/`.
