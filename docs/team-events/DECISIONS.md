# Team events and King of the Court: decision log

Append-only. One entry per decision that changes DESIGN.md or resolves an open
question. Newest at the bottom. Reference entries as `D-0NN` from code comments,
PRs and the other docs.

Format:

```
## D-0NN — Title (YYYY-MM-DD)
**Decision:** what was decided.
**Why:** the reasoning, including rejected alternatives if instructive.
**Impact:** which docs/tasks change.
```

---

## D-001 — King of the Court is the up/down ladder (2026-10-21)

**Decision:** All courts play at the same time. Winners move up a court and
losers move down. Court 1 is the King court. The app's part is limited by D-006.

**Why:** Owner choice. It uses all 4–8 courts at once. Rejected: a single
winner-stays King court, and court-weighted points.

**Impact:** DESIGN §3.3. Court order in the event form defines the ladder.

## D-002 — New partner: captain gives name + email, an admin sends the invite (2026-10-21; account model superseded by D-010)

**Decision:** A captain whose partner has no account enters a name, an email
and an optional level. The server creates a **placeholder** and a pending
`partner_invites` row holding the email. **Nothing is emailed automatically.**
An admin reviews the email and presses Send invite, which activates the player
and sends an `event_invite` email.

**Why:** Owner choice. It revises the first draft of this decision (made the
same day), which created an active player and emailed them straight away. With
admin review:

- the existing rule ("placeholders activate only via admin invite", from the
  signup claim fix) stays intact
- admins catch duplicates and wrong addresses before anyone is emailed
- the Resend budget stays under control

The email is kept off `players.email` because setting it there creates a
sign-in account at once (DESIGN F-5).

**Impact:** DESIGN §3.1 (`partner_invites`), §3.2 (Partner invites console,
`admin_invite_event_partner` sharing a core with the league invite, new
`event_invite` email kind).

## D-003 — Existing-member partners are entered without an accept step or email (2026-10-21)

**Decision:** The team is entered immediately. The partner sees the event in the
app through their registration, and no notice email is sent. Mistakes are fixed
through the captain or an admin.

**Why:** Owner choice: no accept step, and no automated emails (see D-002). An
accept step needs a pending state, expiry and reminders.

**Impact:** No pending team status. Partner acceptance is a Phase 3 candidate.

## D-004 — Capacity stays in players; the form speaks teams (2026-10-21)

**Decision:** `tournaments.max_players` stays the stored capacity, and a team
event stores 2 × max teams. Teams are registered and promoted whole.

**Why:** The capacity trigger, the capacity RPCs and every capacity display
already count players.

**Impact:** DESIGN §3.1. Team RPCs check `count + 2 <= max_players`.

## D-005 — The captain pays for the team (2026-10-21)

**Decision:** One payment per team (2 × the per-person price), carried on the
captain's registration. The partner's registration gets
`payment_status = 'covered'`. Payments and reminders show one row per team,
addressed to the captain.

**Why:** Owner choice. The admin creates the event's Tikkie for the team amount.

**Impact:** DESIGN §3.2. New `covered` payment status. Payments team view.

## D-006 — King of the Court: seed in the app, play off the app, optional final standings (2026-10-21)

**Decision:** The app seeds teams and publishes their starting courts. Rounds
are not tracked: no round count, no scores, no next-round step. After the
event, an admin can optionally record the final standings (1st and 2nd on each
court, partial entry allowed).

**Why:** Owner choice. Nobody will use a phone during play. This replaces the
same-day draft (admin-triggered next round, a rounds field, draw rejection),
which would have built live machinery nobody uses.

**Impact:** DESIGN §3.3 and §3.4. No `rounds` column. The phase model gets a
King of the Court branch with no matches. Phase 2 is client-only.

## D-007 — Seeding by team strength, with level entry for new partners (2026-10-21)

**Decision:** Team strength = the sum of both players' ratings. The captain can
enter a new partner's Playtomic level. The admin can reorder seeds.

**Why:** Owner choice.

**Impact:** DESIGN §3.3.1. `event_teams.seed`.

## D-008 — Scope for the first event (2026-10-21)

**Decision:** In: the captain can swap their partner before the 12h cutoff.
Out for now: a men-only signup check (the event description says it instead),
ratings from King of the Court, and team names.

**Why:** Owner choice, made to hit the date.

**Impact:** PLAN §3 holds the deferred items.

## D-009 — No rating updates from King of the Court (2026-10-21)

**Decision:** Finish applies no learned ratings on King of the Court events.

**Why:** No matches are recorded (D-006), and final positions alone are too
coarse for the Matchmaking V2 model.

**Impact:** The `useEventLifecycle` finish path branches on format.

## D-010 — A new partner is an active member with the partner's own email from the start (2026-10-22)

**Decision:** Supersedes D-002's account model. The partner is created as an
**active** player with the partner's email (as typed by the captain) on `players.email`, so the
auth account and identity exist at once and the partner can sign in by email
code straight away. D-002's core rule stands: **no email is sent unless an
admin presses Send invite.** `partner_invites` keeps only the provenance and
invite state, not the email. Placeholders are not offered as partners.

**Why:** Owner choice: sign-in without friction. It also improves account
health. A placeholder partner would add one to `players_without_real_email`
(12) and `synthetic_auth_accounts` (13), the counts PIN removal is retiring
(D-16, T17). An active partner with a real email adds to none of the 14
integrity counts (DESIGN F-7). Signup for an existing email signs that account
in, so partners can't get stuck on either entry point (F-5).

Cost: a non-admin can now create a sign-in-able account for someone else, so
it's limited to one per call, an unused email, and 3 a day per captain. Ghost
accounts (never signed in, no active registration) depend on the missing auth
deletion path (PIN removal T16/T17). Placeholders stay out of partner search,
because writing a captain-typed email onto one would hand an existing
profile to whoever owns that inbox.

**Impact:**

- DESIGN F-5, F-7, §3.1, §3.2, §3.5 and risks.
- T1: the new partner is active with a real email.
- T2: `admin_send_event_invite` replaces `admin_invite_event_partner`. It only
  sends, so it doesn't need to share a core with the league invite.
- OQ-5 is withdrawn.

## D-011 — The captain confirms permission before creating a partner's account (2026-10-22)

**Decision:** The new-partner form says plainly that the captain is creating a
Padel Lobsters account for their partner. It has a required checkbox: "I have
my partner's permission to register them for this event and to create a Padel
Lobsters account for them with this email." The RPC rejects a new partner
without `input_partner_consent = true`, and stores
`partner_invites.consent_confirmed_at` next to `requested_by`. The same applies
when changing partner to a new person.

**Why:** Owner request. D-010 creates an account for someone who isn't present,
so the captain has to knowingly take responsibility for having permission.
Recording it on the server means the attestation can't be skipped by calling
the RPC directly, and an admin can see who confirmed it and when.

**Impact:** DESIGN §3.1 (`consent_confirmed_at`), §3.2 (form, consent bullet,
RPC rule) and risks. T1 test case. T4 copy is reviewed by the owner.

## D-012 — Direction: leagues move to the same partner model (2026-10-22)

**Decision:** The team-event model will eventually replace league placeholders:

- the partner's real email, typed in with consent, creates an active member who
  can sign in at once
- invite emails stay admin-triggered

It isn't scheduled for this initiative.

**Why:** The owner considers it the better model. It removes the name-only
placeholder state, the "ask an admin to invite you" dead end at signup, and the
synthetic sign-in accounts that PIN removal T17 is trying to retire.

**Impact:** PLAN §3 item. When it's picked up:

- league `TeamForm` gets the new-partner form plus consent
- the 5 existing placeholders are converted by admin invite
- the placeholder status and the placeholder name check in signup can then be
  removed
- `register_team_for_tournament`'s new-partner logic should become a shared
  private function, so that leagues reuse it rather than copy it

## D-013 — Who attests consent, and the daily cap for admins (2026-10-22)

**Decision:** `partner_invites.requested_by` is the person who ticked the
consent box: the captain, or the admin when an admin enters or changes a team
on someone's behalf. Admins are exempt from the 3-a-day new-partner cap.

**Why:** The attestation has to name whoever actually gave it (D-011). An
admin entering teams for people at the bar is the legitimate high-volume case,
and admin actions are already trusted elsewhere.

**Impact:** CONTRACTS §2. The Partner invites list (T2) shows "added by"
from `requested_by`.

## D-014 — Team invariants are enforced by the database (2026-10-22)

**Decision:** Beyond the RPC rules, the database refuses anything that would
split a team:

- A trigger rejects direct (PostgREST) inserts and status, team, player or
  event changes on team-event registrations. Only the `security definer` team
  RPCs can make them. Payment edits stay allowed.
- A deferred constraint trigger checks at commit that every team has 0 or 2
  active rows, with one status and the captain present.
- `entry_mode` can't change while anyone is entered.
- `promote_waitlist_registration` refuses team rows (`use_promote_team`), as
  `cancel_registration` does (`use_cancel_team`).
- `event_teams.seed` and `final_rank` are admin-writable columns, so Phase 2
  stays client-only.

**Why:** Players can write their own `registrations` rows directly (RLS self
insert and update, used by the payment sheet), so an RPC-only rule could be
bypassed. A test alone would only show that today's code is right; the
constraint keeps it right.

**Impact:** CONTRACTS §1 "Invariants", §3.6. T1 tests 14–16 and 18.

## D-015 — The partner accepts; complete teams keep the spots (2026-10-22)

**Decision:** Supersedes D-003 (no accept step) and the captain swap in D-008.
It applies to every partner, whether an existing member or an account the
captain created.

- **On signup:** the captain is accepted, and the partner is _pending_
  (`registrations.accepted_at` is null). The team holds its spots while
  pending, as `registered` or `waitlist`.
- **While pending:**
  - The captain can swap the partner (to a member or a new person, with
    consent) or cancel the team, until the 12h cutoff.
  - The partner can accept, or decline until the event starts. A decline
    cancels the whole team and promotes the waitlist: we keep spots for
    complete teams. The captain is told why (`event_teams.cancelled_reason`).
- **Once both have accepted:** neither player can cancel or swap. Each can
  only **transfer their own spot**, the same as individual events, under the
  same 12h cutoff. The recipient takes their place on the team. A captain
  hands over the captaincy and the team payment. A partner's place stays
  `covered`.
- **Admins** can add, swap, cancel and promote at any time. An admin swap
  makes the new partner pending.
- Players can't cancel individual events (unchanged). Spot transfers stay the
  way out.

**Why:** Owner decision. Registration is the only time a player adds someone
else. An accept step stops anyone being entered without agreeing, and a
complete-teams rule keeps the ladder full.

**Impact:**

- DESIGN §3.2.
- CONTRACTS §1 and §3, with new RPCs `cancel_my_team`,
  `respond_to_team_invite` and `get_my_team_invites`.
- Transfers are re-enabled on team events once the team is confirmed.
- T4/T5 UI: pending and confirmed states, an accept/decline screen after
  sign-in (D-019), and the complete-teams copy at signup and on cancellation.

## D-016 — Registrations are written only through guarded RPCs (2026-10-22)

**Decision:** Direct table writes to `registrations` are revoked for every API
role, and the self insert/update and admin write policies are dropped. Every
change goes through a `security definer` function that allows one specific
transition. Payment changes go through `set_registration_payment`:

- a player can only move their own active row forward, from `unpaid` to
  `tikkied` to `pending_confirmation`, and the method is set to `tikkie`
- an admin can set any status, except on a partner's `covered` row, which only
  a transfer changes

**Why:** Owner request. RLS let a player set their own row to `paid`, or to
`cancelled` without promoting the waitlist. D-014's trigger covered only team
rows.

**Impact:** D-014's direct-write check is gone (nothing can write directly);
its invariants stay. The client's `updateRegistration` keeps its signature and
calls the RPC. Individual events are covered too.

## D-017 — Team capacity is two teams per court (2026-10-22)

**Decision:** On King of the Court, `max_players = 4 × courts`, so 5 courts
gives 10 teams and 20 players. The form shows it read-only and derives it from
the court list.

**Why:** Owner decision. The ladder needs exactly two teams per court.

**Impact:** T3 (no Max teams input). OQ-1 is answered: Sun 15 Nov, 5 courts,
10 teams.

## D-018 — Schedule generator guard ships in R1 (2026-10-22)

**Decision:** The Americano generator UI and `generateSchedule.service.ts`
refuse team events from R1, rather than waiting for T9.

**Why:** Owner decision. Otherwise an admin could generate an Americano
schedule for a King of the Court event.

**Impact:** #58. T9 keeps the `eventPhase` branch and the Finish changes.

## D-019 — An acceptance screen after sign-in (2026-10-22)

**Decision:** When a player has a pending team invite, signing in (or opening
the app) takes them straight to a screen:

> "{captain} has entered you as their partner for {event} on {date}."

It has **Accept** and **I'm not playing** buttons, plus the complete-teams
note. A partner whose account the captain created (`partner_invites`) is
offered **Finish your profile** after accepting. It's optional, with a clear
Skip. Existing members see the same screen.

**Why:** Owner request: the invited account is marked, and the first sign-in
should land on acknowledging the invite. That's also the natural moment to
finish the profile.

**Impact:** T4/T5 UI. It pulls forward part of PLAN §3's "finish your
profile" item.

**Owner approvals, 2026-10-22:** D-013 and D-014 approved. D-014's direct-write
check is superseded by D-016.
