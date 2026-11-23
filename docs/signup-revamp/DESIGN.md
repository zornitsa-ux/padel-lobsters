# Signup revamp: design

Two changes, built separately:

1. **Faster signup.** The Playtomic level becomes optional everywhere, and
   signup gains an optional one-tap "how did you find us".
2. **Levelling.** A separate step sets a newcomer's starting rating. A player
   must finish it before registering themselves for an event.

Only the starting rating changes. The rating system (Matchmaking V2) is
untouched from the first finished night on.

The question and toast wording is written into the code when it's built, not
into these docs. Answers are stored as codes (CONTRACTS C-1).

---

## 1. How it works today

- **Signup** (`SignupRequest.tsx`) uses `ProfileFields`. `profileProblem`
  (`profileForm.ts`) requires a Playtomic level, and `levelProblem` checks it.
  The form sends the profile as `user_metadata`; `before_user_created_hook`
  validates it, and `private.create_player_for_confirmed_user` inserts the
  `players` row when the email is confirmed. An empty level is stored as `0`.
- **The same `ProfileFields`** back the invite "finish your account" page
  (`FinishAccountPage.tsx`), the admin player form (`PlayerForm.tsx`) and
  Settings (`ProfileSection.tsx`).
- **The starting rating** isn't stored. `toPlayerInput`
  (`generateSchedule.service.ts`) uses `mm_rating`/`mm_sigma` when set, else
  `initialRating`: the Playtomic level with σ 0.7 (`SIGMA_PRIOR`).
- **A Playtomic edit** through `update_my_profile` calls `record_mm_reset`:
  `mm_rating` := new level, `mm_sigma` := 0.7, plus a `rating_events` row of
  kind `self_reset`. `admin_update_player` does the same with kind
  `admin_edit` (lost in August, restored in S6b, #182).
- **Registration writes are RPC-only.** `authenticated` has SELECT only on
  `registrations`. Rows are written by `register_for_tournament`,
  `register_team_for_tournament`, `respond_to_team_invite`, the transfer RPCs
  and admin RPCs. `registrations_enforce_capacity` is a BEFORE INSERT OR
  UPDATE trigger.
- **Other readers of the Playtomic level:** King of the Court seeding
  (`kotcInputs.ts`), team helpers, `RegisteredSection` ("Level x.x"), the
  community lists and the admin drawer.

## 2. Levelling

### 2.1 Who must level

A player **needs levelling** when no level is recorded (D-16): both hold:

- no Playtomic level on file (`players.playtomic_level` is 0 or null), and
- no `player_levelling` row with a start (`start_source` `playtomic` or
  `walls`; an answers-only row from §2.6 doesn't count).

A player who already has a level is never gated, whether they set it, an admin
did, or the captain who added them. `private.needs_levelling(input_player_id)`
is the single definition, and the client reads it through `get_my_levelling`
(C-3). Players who have a level are asked the five questions through a
separate Home prompt that never blocks registering (S3c).

A **played night** (`private.has_played_night`) still matters to the reset
guard (§2.4, C-7): a `rating_events` row of kind `tournament` or `seed`, or a
`registered` row (a spot, not the waitlist) in a `completed` tournament.

### 2.2 The flow

- **Entry points.** On an event page, `JoinEventCard` shows the levelling card
  in place of the register action when the viewer needs levelling (also /me's
  registration card and the team-event join card). On Home, a card above the
  next event. A transfer offer or team invite keeps Decline and swaps Accept
  for "Set your level to accept". All open the route `/levelling?from=<path>`
  with the current page; `from` goes through `safeAppPath`, and survives a
  reload. A share link → signup (G3's return path) → event page → levelling →
  back on the event works.
- **Steps.** One question per screen, six steps: the five placement questions,
  each a single tap that moves on, then the Playtomic level (yes with a number,
  or no). The Playtomic step is the only one with a submit button. Back keeps
  answers; closing asks to confirm and keeps answers in memory for the session
  only (nothing is saved until the end).
- **No prefill.** Step 6 always starts empty. Since D-16 only players with no
  level take the six-step flow, so there is never a level to prefill; the
  prefill path and the `prefilled` column were removed (24 Nov).
- **Finish.** `complete_levelling` (C-3) in one call. On success: invalidate
  the player and levelling queries, return to the return path, show the toast.
  The register action is then available. **Finishing never registers.**
- **UI parts.** `OptionRow` for answers, `StepHeader` (Back, "N of 6", close,
  `ProgressBar`) for the step count, `Toast`, `Button`; the flow is a route
  (`src/features/levelling/`).

### 2.3 Writing the start

`complete_levelling` stores the answers and sets the start in one transaction:

| Playtomic step | `mm_rating`           | `mm_sigma` | `players.playtomic_level` |
| -------------- | --------------------- | ---------- | ------------------------- |
| Yes, level x   | x, as entered         | 0.7        | x (and `adjusted_level`)  |
| No             | from the walls answer | 1.0        | unchanged                 |

- **Walls → start** (answer codes, C-1): `lets_go` 1.0, `slow_back_wall` 1.5,
  `back_wall_not_corners` 2.0, `corners` 2.5. Every value from answers is
  capped at 3.0 (`LEVELLING_CAP`); the walls map stays under it, and the cap
  guards any later answer-based formula.
- **Playtomic as entered:** no cap and no special case for 1.0 or below. It
  must be > 0 and ≤ 7, since `0` means "not given" throughout the app.
- **Audit:** one `rating_events` row of kind `levelling`, `prior_mu`/
  `prior_sigma` from the current `mm_*` (or the Playtomic prior, as
  `update_my_profile` does), `breakdown` = `{ "source": "playtomic" | "walls" }`.
- **Overwrites** an `mm_rating` left by an earlier `self_reset` (a player with
  no played night who edited their level). The audit row keeps the prior.
- Levelling runs once. A second call returns `already_levelled`. Only a
  player the gate holds (`needs_levelling`, D-16) sets a start; anyone else
  answers only (§2.6), so a player with a level can't re-seed their rating.
- **A gated player with a played night** (their level was cleared, or a
  captain-added partner played without one) levels too: the answers and any
  Playtomic level are stored, but their learned `mm_rating` is kept and no
  `levelling` rating event is written.

### 2.4 The Playtomic-edit reset after levelling

`update_my_profile` and `admin_update_player` keep their D-002 reset, with
two guards (the admin's reset was lost in August and restored in S6b, #182):

- **No reset before the first played night of a levelled player.** The
  levelling start stands; the Playtomic level on the profile still updates.
  Only a real start counts: answers alone (§2.6) don't stop the reset.
- **No reset to 0.** Clearing the level (now allowed) never sets
  `mm_rating` := 0.

Players with a played night keep today's behaviour.

### 2.5 The registration gate

- **`register_for_tournament`** returns status `needs_level` (no row) when the
  caller registers themselves and `needs_levelling` is true. The client shows
  the levelling card. A stale page that still shows Register lands here.
- **Team events are gated too** (owner). The captain is gated when
  registering the team (`register_team_for_tournament` inserts their own row).
  The partner's row is inserted active by the captain, so the partner is gated
  when accepting: `respond_to_team_invite` returns `needs_level` before
  setting `accepted_at`. A captain-created partner is given a level by the
  captain (S6a, D-18), so the gate doesn't hold them; a partner created before
  S6a without one finishes their account, levels, then accepts.
- **Backstop trigger** `registrations_require_levelling`, BEFORE INSERT OR
  UPDATE on `registrations` (C-6): raises `needs_level` when a row becomes
  active, or a team row is accepted, and its player's `needs_levelling`
  holds, whoever writes it (S6c). This covers the transfer RPCs without editing them,
  which matters because PIN removal PR 6 (T11) rewrites them.
- **Every spot, whoever writes it (S6c, D-18).** A captain can't pick an
  existing member with no level as partner, and an admin can't register a
  player, captain or partner with no level: the RPCs return
  `partner_needs_level`, `captain_needs_level` or `player_needs_level`, and an
  admin transfer to a recipient with no level returns `recipient_needs_level`. The
  admin forms ask for the level first (S6b), so admins rarely see these.
- **Not gated:**
  - service-role and migration writes (`auth.uid()` is null);
  - rows already active at release, and waitlist → registered promotion
    (already active). That includes a transfer recipient already on the
    waitlist: the transfer promotes their row rather than inserting one.

### 2.6 The five questions for players with a level (S3c)

- **Who.** A player the gate doesn't hold (they have a level) and who has no
  `player_levelling` row. `get_my_levelling` returns this as `questions_open`
  (C-3). Never a gate: registering doesn't read it.
- **Prompt.** A Home card above the next event, in the same place as the
  levelling card (the two never show together). "Not now" hides it on that
  device for good (D-17, `localStorage`, keyed by player).
- **Flow.** The same route (`/levelling?from=`), in `questions` mode: five
  steps, no Playtomic step (players change their level from their profile).
  On the last question, tapping records the answer and Finish sends it.
  The mode comes from `get_my_levelling` (`needs_levelling` → six steps,
  else `questions_open` → five); a session draft from the other mode is
  dropped.
- **Writing.** `complete_levelling` stores the answers with `start_source`
  `none`, no start, and the level on file as `playtomic_level` (the value to
  judge the questions against). `mm_*`, the profile level and `rating_events`
  are untouched; a Playtomic value in the call is ignored.
- **Clearing the level afterwards.** An answers-only row isn't a level, so
  the gate holds the player again. Levelling then replaces the row with a
  start (new answers, the start, `completed_at`).

## 3. Signup

### 3.1 Playtomic level optional

- `profileProblem` no longer lists the level as missing. `levelProblem` runs
  only when a value is given. Signup and the invite "finish your account" page
  use `profileProblem`, and the shared field's hint there says it's optional.
  Settings and the admin player form already accepted an empty level.
- The hook already accepts an empty level; the trigger stores `0`.
- **Readers of `playtomic_level = 0`** show no level instead of "Level 0.0":
  `LevelBadge` renders nothing, and the "Lv x.x" texts in pickers and lists
  are left out (`levelText`, `src/lib/level.ts`). The levelling start stays admin-only
  (owner).
- **One fallback for "no level", the same on every screen.** King of the Court
  seeds on every viewer's device from `playtomic_level`
  (`useKingOfCourtTeams`), and members can't read `mm_rating`. So a level of 0
  counts as `NO_LEVEL_START` = 1.0 (the lowest walls start) in KotC seeding,
  for admins and members alike.
- **The matcher** uses the same constant: `initialRating` returns
  (1.0, σ 1.0) for a level of 0. This only matters for a player with neither
  a level nor a levelling start, which the gate leaves to admin-registered
  players (D-8) and players already registered at release (D-9). Today such a
  player enters at μ 0.

### 3.2 How did you find us

- One optional choice on the signup form, below the profile fields: four
  options (codes in C-5). One tap to pick; `lobster` (the member's name) and
  `other` add a free-text box.
- Sent as `user_metadata` keys (C-5). `before_user_created_hook` validates
  them (unknown code → rejection; text trimmed, ≤ 100 characters).
- `create_player_for_confirmed_user` inserts a `player_signup_source` row
  after the `players` row, in its own nested block with
  `exception when others then null`. The existing block only catches
  `unique_violation`; a value that fails a CHECK must never abort the email
  confirmation. Losing the answer is acceptable; losing the account isn't.
- Not asked on the invite "finish your account" page: an admin brought those
  players in.
- The typed name is not matched to a member. Matching happens when needed
  (the friend check in Match balance, later).

## 4. Data and privacy

- `player_levelling` and `player_signup_source` are admin-read, RPC-write
  (RLS with an admin SELECT policy only), like `rating_events`. Neither is in
  `players_public`. No admin view yet; analysis reads them read-only.
- The referrer's name and the "Other" text are free text about people: never
  in logs, previews, analytics or committed fixtures with real names.
- Deleting a player cascades to both tables.

## 5. Overlaps

- **Matchmaking V2 M4.3** (drop legacy columns): `complete_levelling` writes
  `adjusted_level` alongside `playtomic_level` while the column exists. Whichever
  lands second removes or keeps that line.
- **PIN removal PR 6 (T11)** rewrites transfer RPCs: the gate is a trigger so
  neither PR edits the other's functions.
- **PIN removal PR 9 (T16)** drops `ensure_auth_user_for_player`, which the
  confirmed-user trigger's header comment mentions. Signup source touches the
  hook and that trigger, which PR 9 doesn't change. Either order works; the
  second PR fixes the comment.
- **Growth G5** (paused): "how did you find us" is the self-reported take on
  attribution. `?src=`/`?ref=` stay unbuilt.

## 6. One definition of a level (S7–S9)

Levels were checked in about fifteen places with five different rules, and the
database had none on `players.playtomic_level` (#190). One definition, one
policy per input, three layers of enforcement.

### 6.1 The definition

- **A level** is a number above 0, up to 7, with at most 2 decimals
  (owner, 23 Nov: refuse more, don't round). A decimal comma is accepted.
- **No level** is a state, not a level, stored as null (S9; 0 from S7 until
  then). Code asks `hasLevel`, never compares with 0.
- **Shown as written** (owner, 23 Nov): 2.45 shows as 2.45, never rounded;
  3 and 2.5 show as 3.0 and 2.5 (`formatLevel`, used by `LevelBadge` and
  `levelText`).

### 6.2 Policies

Each input declares one:

| Policy     | Blank            | Used by                                                                            |
| ---------- | ---------------- | ---------------------------------------------------------------------------------- |
| `required` | refused          | new partner (S6a), admin register forms (S6b), levelling's Playtomic step if typed |
| `optional` | allowed          | signup, admin add or invite; Settings and the admin editor with no level recorded  |
| `keep`     | refused, as is 0 | Settings and the admin editor once a level is recorded                             |

Nobody can clear a recorded level, admins included (owner, 23 Nov): it can be
changed, never returned to no level.

### 6.3 Enforcement

1. **Database:** a CHECK on `players.playtomic_level`, so no path can store a
   bad value.
2. **Server:** `private.parse_level` (C-8) in every RPC and the signup hook;
   `update_my_profile` enforces `keep`.
3. **Client:** one `levelProblem({ value, policy })` (`src/lib/level.ts`) and
   one level input (`LevelInput` in `src/components/ui`). Writes send the
   text as typed, so the server's refusal (`invalid_level`, `level_required`)
   is the one shown when the client check is skipped.

`supabase/tests/level_cases.json` holds the cases both the unit test and the
database test check, so the two can't disagree.
