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
  kind `self_reset` (`admin_edit` from `admin_update_player`).
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

A player **needs levelling** when both hold:

- no `player_levelling` row, and
- no **played night**: no `rating_events` row of kind `tournament` or `seed`,
  and no `registered` row in a tournament with status `completed`. The second
  part covers formats that don't write rating events (team events, King of
  the Court).

Players with a played night are never asked. This covers newcomers, existing
players who haven't played a played night, and admin-added or invited players.
`private.needs_levelling(input_player_id)` is the single definition, and the
client reads it through `get_my_levelling` (C-3).

### 2.2 The flow

- **Entry points.** On an event page, `JoinEventCard` shows the levelling card
  in place of the register action when the viewer needs levelling. On Home, a
  card above the next event. Both open the flow with the current page as the
  return path (`src/features/auth/returnPath.ts`, as G3 does), so a share link → signup →
  levelling → back on the event works.
- **Steps.** One question per screen, six steps: the five placement questions,
  each a single tap that moves on, then the Playtomic level (yes with a number,
  or no). The Playtomic step is the only one with a submit button. Back keeps
  answers; closing asks to confirm and keeps answers in memory for the session
  only (nothing is saved until the end).
- **Prefill.** For a player with `playtomic_level > 0`, step 6 starts on "yes"
  with that level.
- **Finish.** `complete_levelling` (C-3) in one call. On success: invalidate
  the player and levelling queries, return to the return path, show the toast.
  The register action is then available. **Finishing never registers.**
- **UI parts.** `OptionRow` or `OptionTile` for answers, `ProgressBar` for the
  step count, `Toast`, `Button`, `FullScreenDialog` or a route for the flow.
  Add variants to these rather than new markup (CLAUDE.md, UI).

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
- Levelling runs once. A second call returns `already_levelled`. A player
  with a played night gets `not_needed`, so the RPC can't replace a learned
  rating with a self-chosen start.

### 2.4 The Playtomic-edit reset after levelling

`update_my_profile` and `admin_update_player` keep their D-002 reset, with two
guards:

- **No reset before the first played night of a levelled player.** The
  levelling start stands; the Playtomic level on the profile still updates.
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
  setting `accepted_at`. A captain-created partner finishes their account,
  levels, then accepts.
- **Backstop trigger** `registrations_require_levelling`, BEFORE INSERT OR
  UPDATE on `registrations` (C-6): raises `needs_level` when the caller's own
  row becomes active, or when the caller accepts their own team row, and
  `needs_levelling` holds. This covers the transfer RPCs without editing them,
  which matters because PIN removal PR 6 (T11) rewrites them.
- **Not gated:**
  - an admin acting for another player (`auth.uid() <> player_id`); the admin
    forms already name the player and confirm (`useConfirmOnBehalf`);
  - service-role and migration writes (`auth.uid()` is null);
  - rows already active at release, and waitlist → registered promotion
    (already active).

## 3. Signup

### 3.1 Playtomic level optional

- `profileProblem` no longer lists the level as missing. `levelProblem` runs
  only when a value is given. This applies to all four callers of
  `ProfileFields`; the field's hint changes to say it's optional.
- The hook already accepts an empty level; the trigger stores `0`.
- **Readers of `playtomic_level = 0`** show no level instead of "Level 0.0"
  (`RegisteredSection`, community lists). The levelling start stays admin-only
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
