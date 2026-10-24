# Team events and King of the Court: design

Research findings, the target design and the rules it follows. Status and tasks
live in [`PLAN.md`](./PLAN.md). Decisions are in [`DECISIONS.md`](./DECISIONS.md)
and are referenced here as `D-0NN`.

**Problem.** Every event today is individual signup plus Americano with rotating
partners. We want events where people **sign up as a team**, including with a
partner who has no account yet (we use that to bring them into the app). We also
want a **King of the Court** format with fixed teams. The app seeds the starting
courts and the event runs itself on court. The first use case is a men's team
King of the Court event 2–4 weeks from 2026-10-21, with signups opening this
week.

---

## 1. Findings (codebase and production, 2026-10-21)

### F-1 Registration is per player, end to end

- `register_for_tournament(tournament_id, player_id)` decides `registered` or
  `waitlist` under the tournament row lock, by comparing the count of
  registered _players_ against `max_players`. The capacity trigger
  (`20260806211143`) enforces `registered <= max_players` with no override.
- `cancel_registration` is admin-only. It promotes the oldest waitlister only
  when the cancelled row was `registered`.
- Players leave an event through **spot transfers** (`registration_transfers`).
  These close 12h before start.
- Payment is per registration (`payment_status`: unpaid → tikkied → paid →
  confirmed). There is one `tikkie_link` per event, and
  `get_payment_reminder_link` builds a WhatsApp reminder for each registration.
- Oscars voting, raffle eligibility, the upcoming-event card and MyTournament
  all key off per-player `registrations` rows.

**Implication:** keep `registrations` as the per-player truth and add a team
grouping on top of it. Everything downstream keeps working. That includes an
existing-member partner seeing the event as "registered" in the app with no
email needed.

### F-2 Events have exactly one format

- `tournaments.format` exists (always `lobster_matching`). D-020 of Matchmaking
  V2 removed the format picker: the V2 matcher is the only generator, and it
  builds rotating-partner Americano rounds. It must never run on a team event.
- `tournaments.courts` is an ordered, named JSON list, edited in
  `EventFormModal`. Its order can define the ladder (first court = King court).
- King of the Court records **no matches** (D-006), so nothing in `matches`, the
  score Broadcast or the rating engine is involved.

### F-3 The event phase model is driven by matches

`eventPhase()` returns `open` while there are no matches and `sealed` only when
every match is scored. A King of the Court event has no matches, so it would sit
in `open` forever, and the Finish step in `RunOfShow` would never unlock. The
phase model needs a King of the Court branch (§3.4).

### F-4 Standings are Americano-only

`computeTournamentStandings` ranks players by total game points. It feeds both
the Results tab and the Lobster Review per-event ranks (`Players.tsx`). King of
the Court ranks **teams by the final standings the admin enters**, so both
callers need a format-aware branch.

### F-5 Capturing a partner without an account

- League placeholders (`players.status = 'placeholder'`, 5 in production, none
  with an email) become members only via `admin_invite_league_player`. That RPC
  sets the email, flips the status to `active` and sends `send-invite-email`
  (kind `league_invite`, whose wording is league-specific). The player then
  signs in with an email code.
- Every `players` insert creates a confirmed `auth.users` row plus its email
  identity (`ensure_auth_user_for_player`, as patched in PIN removal 0b). It
  uses the real email when one is set, and a synthetic `@padelobsters.internal`
  address otherwise. So **a partner created as an `active` player with the
  partner's email, as typed by the captain, can sign in by email code
  immediately**, with no invite step
  and no new auth plumbing. (A `placeholder` with a real email could sign in
  too, but the token hook gives a role only to `active` players, so they'd hit
  the "account isn't fully set up" panel. That's why the partner is created as
  `active`, not as a placeholder.)
- Signup sends `signInWithOtp` with `shouldCreateUser: true`. For an email that
  already exists, GoTrue simply signs that account in (`SignupRequest.tsx`
  notes this). So a partner who taps **Sign up** instead of **Sign in** still
  lands in their account. The profile details they type there aren't applied,
  because the confirmation trigger no-ops on an existing player. The name check
  sends a matching active name to "go back and sign in with your email".
- Self-signup **rejects** a name that matches a placeholder. That rule is about
  claiming a profile by name, and it doesn't come into play here.

### F-7 Account health (the PIN removal integrity checks)

`scripts/prod-rehearsal/auth_integrity.sql` reports 14 counts. The PIN removal
roadmap is driving down **12 `players_without_real_email`** and **13
`synthetic_auth_accounts`** (T17 aims to remove synthetic accounts entirely,
DESIGN D-16: "no auth account without a reachable email"). The two ways of
creating a partner score differently:

- **A placeholder** adds +1 to both counts per partner, and stays there until an
  admin invites them.
- **An active player with the partner's own email** (typed by the captain) adds to **none** of the 14
  counts. The auth account, identity and real email are consistent from the
  first insert.

The one new state is **"active, never signed in"**. That isn't an integrity
failure, but it's the number to watch: it's exactly the set of partners who
haven't converted yet.

### F-6 Production scale

The last 8 events had 20–32 players on 5–8 courts (one court per 4 players),
mostly 2h. A men's team event at that scale is **8–16 teams on 4–8 courts**.
There are 131 active players, 83 of them marked male.

---

## 2. Concepts

| Concept             | Meaning                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Entry mode**      | `individual` (today) or `team`. Set per event. A team event fills by teams.                                                                                                    |
| **Format**          | `lobster_matching` (Americano via the matcher, today) or `king_of_court`.                                                                                                      |
| **Team**            | Two players entered together for one event. One is the **captain**, the person who signed up.                                                                                  |
| **New partner**     | A partner without an account. Created as an **active** player with their own email (typed by the captain), so they can sign in straight away. An admin sends the invite email. |
| **Ladder**          | The ordered court list. Court 1 is the **King court**.                                                                                                                         |
| **Seed**            | A team's starting position, from team strength, adjustable by an admin.                                                                                                        |
| **Starting courts** | Seeds placed two per court, top down. Shown to players on the event day (D-024).                                                                                               |
| **Final standings** | Optional. The admin records who finished 1st and 2nd on each court; public once saved (D-026).                                                                                 |

Supported combinations now: `individual + lobster_matching` (unchanged) and
`team + king_of_court` (new). `team + lobster_matching` (fixed-pair Americano)
is possible later on the same model (PLAN §3).

---

## 3. Target design

### 3.1 Data model (one migration, Phase 1)

```text
tournaments
  format                        text  'lobster_matching' | 'king_of_court'  (existing column, new value)
  entry_mode                    text  'individual' | 'team', default 'individual'  (new)
  starting_courts_published_at  timestamptz null                            (new; used in Phase 2)
  max_players                   int   unchanged; a team event stores 2 × max teams  (D-004)

event_teams                                                                 (new; readable like registrations)
  id, tournament_id → tournaments, captain_id → players,
  seed int null, final_rank int null, created_at, created_by → players

registrations
  team_id uuid null → event_teams                                           (new)
  payment_status gains 'covered' for the partner's row                      (D-005)

partner_invites                                                             (new; admins only, no direct writes)
  id, player_id → players (the new partner, unique), tournament_id,
  requested_by → players (captain), consent_confirmed_at timestamptz not null,
  created_at, invited_at null, invited_by null
```

- **Membership comes from `registrations.team_id`.** A team has exactly two
  non-cancelled registrations, and both share the same status. Only the team
  RPCs write team rows. `event_teams` holds no status of its own, so there is
  nothing to drift.
- The existing `registrations_tournament_player_active_uniq` index already
  stops anyone from being on two teams in one event.
- The partner's email lives on `players.email`, under the same scoped PII rules
  as every member's (`20260816120000`). `partner_invites` only records who
  created which account and whether it has been invited. It feeds the admin
  list and the conversion count. RLS allows admin reads only.
- Phase 2 needs **no further migration**. The seed, final rank and publish
  timestamp all ship here.

### 3.2 Team signup (Phase 1)

**Captain flow** (`/events/:id/info` → Join card on a team event):

```text
┌ Sign up as a team ─────────────────────┐
│ Your partner                           │
│ [ Search members…              🔍 ]    │  ← active members not in this event
│   Alex B.   · level 3.5                │
│   Sam K.    · level 4.0                │
│ ─────────────────────────────────────  │
│ My partner isn't on Padel Lobsters →   │
└────────────────────────────────────────┘
        │ (new partner)
        ▼
┌ Add your partner ──────────────────────┐
│ You're creating a Padel Lobsters       │
│ account for your partner. They'll sign │
│ in with this email.                    │
│ Name            [               ]      │
│ Email           [               ]      │  required (D-002)
│ Playtomic level [     ] (optional)     │  seeds the team (D-007)
│ ☐ I have my partner's permission to    │  required (D-011)
│   register them for this event and to  │
│   create a Padel Lobsters account for  │
│   them with this email.                │
└────────────────────────────────────────┘
        ▼
┌ Confirm your team ─────────────────────┐
│ You + Partner · €XX for the team       │  team price = 2 × per-person (D-005)
│ [ Pay via Tikkie ]  [ I'll pay later ] │  existing payment sheet, captain only
└────────────────────────────────────────┘
```

- **Result:** both players are `registered` if two spots are free, otherwise
  the team is on the **waitlist**. A team is never split across the line.
- **No email is sent automatically** (D-002, D-003). A partner who is already a
  member sees the event in the app because they hold a registration.
- **New partner** (D-010): the server creates an **active** player with the
  name, the partner's email as the captain typed it, and `playtomic_level` plus the `mm_rating` prior
  from the captain's entry (seeded the way signup seeds one). It also writes a
  `partner_invites` row. The auth account exists from that moment, so the
  partner can sign in by email code whenever they open the app. The captain
  sees "{partner} can sign in with {email} any time to see the event. Let them
  know!" The captain is the fastest channel we have, and it costs no email.
- **Consent** (D-011): the new-partner form states that the captain is
  creating an account, and it can't be submitted until the captain ticks "I have
  my partner's permission to register them for this event and to create a Padel
  Lobsters account for them with this email." The server also requires
  `input_partner_consent = true` and records `partner_invites.consent_confirmed_at`
  alongside who gave it (`requested_by`). That way the attestation exists even
  if the UI is bypassed. **Change partner** to a new partner asks the same.
- **Email checks:** must be valid. If the email is already in `players` or
  `auth.users`, it's rejected with `email_in_use` ("That email already has an
  account. Search for them by name instead."). No auto-link, so the captain
  learns nothing beyond what member search already shows.
- **Abuse bounds:** this is the first non-admin path that creates a sign-in-able
  account for someone else. So it's one new partner per call, only inside a team
  registration, with at most 3 new partners per captain per day.
- **Placeholders are not offered as partners** (same as the league `TeamForm`).
  Writing a captain-typed email onto an existing placeholder would hand that
  profile to whoever owns the inbox: a claim by someone other than the owner,
  which the signup claim fix forbids. There are 5 placeholders in production,
  so the duplicate risk is small.

**Team card** (the captain's and partner's view once entered):

- Shows "You & {partner}", the status, and the payment status (the captain's
  registration carries the team payment).
- **Change partner** (captain only, D-008): swap in another member or a new
  partner, up to the same 12h cutoff transfers use. The old
  partner's registration is cancelled and the new one inherits the team's
  status.
- **Spot transfers are off on team events,** because a transfer would split a
  team. Withdrawing a team goes through an admin, as cancelling a registration
  does today.

**Registration list:** teams are shown as "A & B" in the registered and
waitlist sections. Admins also see a "hasn't signed in yet" hint on partners
who haven't converted.

**Event form** (admin): a **Format** picker (Americano / King of the Court).
Picking King of the Court sets entry mode to team. "Max players" turns into
**Max teams**, defaulting to 2 × courts. The court list is edited as now, and
its order is the ladder (court 1 = King court). The price stays per person, and
the form shows the team total.

**Admin console** (`/events/:id/manage`):

- Add a team on someone's behalf (the same RPC, with the admin choosing the
  captain).
- Change a partner, bypassing the cutoff.
- Cancel a team: frees 2 spots and promotes the oldest waitlisted team.
- Promote a waitlisted team.
- **Payments** lists one row per team (the captain's registration). The
  WhatsApp reminder goes to the captain.
- **Partner invites** (D-002, D-010): a list of captain-created partners with
  their email, who added them, and one of three states: _not invited_,
  _invited {date}_, or _signed in ✓_ (from `auth.users.last_sign_in_at`). A
  wrong email is fixed through the existing admin player edit, which mirrors to
  `auth.users`. **Send invite** runs `admin_send_event_invite`. That RPC only
  sends mail and stamps `invited_at`, because the account is already active. The
  email is a new `event_invite` kind: "{captain} has entered you as their
  partner for {event}. Sign in with this email to see your starting court."
  It's hidden once the partner has signed in, and becomes Resend after the first
  send.

**Server rules** (`security definer`; take the tournament lock first, in the
house lock order):

| RPC                                        | Rule                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register_team_for_tournament`             | Caller is the captain (or an admin acting for one). Event `entry_mode = 'team'`. Partner is an existing active player, or `{name, email, level}` for a new active player (email unused, 3/day cap, `input_partner_consent` must be true). Inserts the team, 2 registrations with one status, and a `partner_invites` row for a new partner. |
| `change_team_partner`                      | Captain before the 12h cutoff, or an admin at any time. Same partner options as above.                                                                                                                                                                                                                                                      |
| `admin_cancel_team` / `admin_promote_team` | Team-aware capacity and promotion: whole teams only.                                                                                                                                                                                                                                                                                        |
| `admin_send_event_invite`                  | Admin. Player has a `partner_invites` row and a real email. Sends `event_invite` and stamps `invited_at`.                                                                                                                                                                                                                                   |
| `register_for_tournament`                  | Rejects `team_event` on team events.                                                                                                                                                                                                                                                                                                        |
| `cancel_registration`                      | On a team member, rejects `use_cancel_team`.                                                                                                                                                                                                                                                                                                |
| transfer RPCs                              | Reject `team_event`.                                                                                                                                                                                                                                                                                                                        |

### 3.3 King of the Court (Phase 2)

The app does the **seeding before** the event and records the result
**afterwards** if the admin wants. Nothing is recorded during play (D-006).
Built in #63 and #64; revised by D-024 to D-027.

1. **Seeding.** Team strength = the sum of both players' reported
   `playtomic_level` (D-025, never `mm_rating`). A missing level (none or 0)
   counts as the partner's value and flags the team "unrated". Registered
   teams are sorted strongest first; the admin reorders them with up/down
   buttons. The order is saved to `event_teams.seed`.
2. **Starting courts.** Seeds 1 and 2 start on the King court, 3 and 4 on court
   2, and so on. With fewer teams, only the top courts are used. With an odd
   count, the last team is listed as waiting at the bottom court (OQ-4). If
   courts were removed below the registered teams, the extra teams are listed
   as having no court (D-027).
3. **Show starting court assignments to players** (D-024). Usually on the event
   day, a couple of hours before the start. It saves the current order, then
   sets `starting_courts_published_at`. Players then see their starting court
   (T11). Seeds stay editable; after showing, Save order appears whenever the
   order changes, and players see each saved change.
4. **Play** happens on court with no app involvement.
5. **Final standings (optional).** From the event day, the admin's console has
   **Final standings**: courts top to bottom, two slots each (1st and 2nd on
   that court). It starts empty, or with what was saved (D-026: no prefill).
   Partial entry is fine. Each slot is saved as `event_teams.final_rank`
   (court k: 1st = 2k−1, 2nd = 2k), and the ranking is **public as soon as
   it's saved**: there is no reveal step. Teams without a rank are listed
   unranked.
6. **No Finish, no ratings.** The event is over at its scheduled end
   (start + duration). Nothing applies ratings (D-009, D-026).
7. **Courts moved and Biggest climber** (D-028, T13). `courtMoves` (domain)
   takes each ranked team's starting court from `startingCourts` over the
   saved order, the same layout players were shown; a waiting team starts
   from the court it waited at. The final court is ⌈`final_rank` / 2⌉,
   capped at the bottom court in play: the standings form lists every court,
   so with an odd count or spare courts a rank can name a court nobody
   played on. A team with no rank, or no starting court (D-027), has no
   move. Each ranked row on Results and History shows "Court 5 → King court
   ↑4" ("↓1", "=", or "held" on the King court). `biggestClimbers` names the
   most courts gained, then the lower start, all still tied; nobody when no
   team gained. Results and History show it above the ranking, and the
   recently-completed banner under the winners.

### 3.4 Lifecycle changes

- **Over by the clock** (D-026). `isEventOver` (in `eventPhase.ts`):
  Americano when finished, King of the Court at start + duration. Home's next
  event and countdown, the admin unpaid count, attendance streaks, the Events
  list, the event card badge, signup and the admin team controls use it (or
  `isEventUpcoming`) instead of `status = 'completed'`. So do History and the
  recently-completed banner (T11), which show the team ranking and winning
  team for King of the Court.
- **Phase** for King of the Court (Americano unchanged):

  | When                                                | Phase          |
  | --------------------------------------------------- | -------------- |
  | before the event day, assignments not shown / shown | `open` / `set` |
  | event day, before the scheduled end                 | `live`         |
  | after the scheduled end                             | `social`       |
  | any active team has a final rank (event day on)     | `revealed`     |

  `useEventPhase` reads the event's teams for this, and re-derives it every
  minute while a page is open because it turns on the clock.

- **Run of show** on King of the Court: only the Oscars and raffle steps, from
  the event day. No Enter scores, Finish, flagged ratings or Reveal.
- **Live sync** (`hasLiveScores`) is off on King of the Court: no matches.
- **Matcher guard:** the generator UI and `generateSchedule.service.ts` refuse
  team events (D-018).
- The Schedule tab on a King of the Court event: admins get the seeding
  console (#64); players get the starting-courts view, their team
  highlighted, once the assignments are shown (T11). The You tab and Home's
  next-event card show "You start on {court}", then the team's placing once
  standings are saved.
- Results on King of the Court: the team ranking with courts moved and the
  Biggest climber (§3.3 item 7), unranked teams after, no Matches tab, no
  `resultsSharedAt` gate (D-026).
- Lobster Review: a player's per-event rank is their team's `final_rank` out of
  the registered teams. Events without one are left out of rank stats (T11).
- Oscars and the raffle don't change, because they're per player.

### 3.5 Bringing partners into the app

There are three ways in, and none of them sends email automatically:

1. **The captain tells their partner** "sign in with your email". This works
   from the moment the team is entered.
2. **An admin presses Send invite** in Partner invites.
3. **The partner finds the app on their own.** Sign in works, and so does Sign
   up with the same email (F-5).

The Partner invites list doubles as the conversion count: signed in out of
created.

**Profile gap:** the account starts with only a name, an email and a level. A
partner who comes in through Sign up loses the details they type there (F-5).
A first-sign-in "finish your profile" prompt (phone, gender, avatar) is the
natural follow-up. It's Phase 3, or earlier if time allows.

---

## 4. Risks

| Risk                                                             | Mitigation                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate person (a new partner who is already a member)         | Member search comes first. `email_in_use` catches the same email. Admins see every captain-created account in Partner invites. Remaining duplicates are merged by Jon-run SQL (CLAUDE.md).                                                                                                                                                                       |
| An account exists for someone who never agreed to it             | The captain attests to the partner's permission, and it's recorded with a timestamp (D-011). The account holds only a name, an email and a level, under the same PII scoping as members, and no email is sent without an admin. Deleting it has the existing gap (no app path removes an auth account, PIN removal T16/T17). Until then, removal is Jon-run SQL. |
| Wrong email: someone else's inbox can sign in to the new profile | Only the inbox owner can get a code. The profile is new, so there's nothing to take over. The admin sees "never signed in" and corrects the email via player edit (mirrored to auth).                                                                                                                                                                            |
| Ghost accounts (team cancelled, partner never signed in)         | Partner invites shows them (never signed in, no active registration). Clean up in batches with the T16/T17 deletion path.                                                                                                                                                                                                                                        |
| Team pair drifts (one row cancelled, the other not)              | Only the team RPCs write team rows, and a local test asserts both rows always share a status.                                                                                                                                                                                                                                                                    |
| A King of the Court event never unlocks Finish (F-3)             | Resolved by D-026: no Finish; over by the clock. Verified in T12.                                                                                                                                                                                                                                                                                                |
| Releases collide with the PIN cutover (Thu 5 Nov)                | No sign-in-facing release within 3 days of a tournament. The event must be on or after Sun 8 Nov (PLAN §0).                                                                                                                                                                                                                                                      |
