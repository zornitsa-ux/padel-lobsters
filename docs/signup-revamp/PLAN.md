# Signup revamp: plan

Status is tracked outside the repo; this plan holds the work breakdown and how
to do it. Design in [`DESIGN.md`](./DESIGN.md), interfaces in
[`CONTRACTS.md`](./CONTRACTS.md), choices in [`DECISIONS.md`](./DECISIONS.md).

**Goal.** Signup is fast, and every player has a considered starting rating
before their first played night.

**Constraints**

- **Migrations:** review → merge → `npx supabase db push` from `main`
  (CLAUDE.md). No MCP or dashboard writes to production.
- **Testing is local only** (local stack plus `npm run rehearsal:sync`).
- **No sign-in-facing release within 3 days of a tournament.** Events are on
  15 Nov and 29 Nov 2026. Every task here except S0 is sign-in-facing.
- **Copy** (questions, answers, card, toast, signup option labels) goes into
  the code in S2 and S4, from the signed-off wording, not into these docs.
- One task = one branch off `main`.

---

## Tasks

| #   | Task                       | What ships                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0  | Plan                       | These docs. No code.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S1  | Levelling storage and RPCs | Migration: `player_levelling` (C-2), `complete_levelling` and `get_my_levelling` (C-3), `private.needs_levelling`, kind `levelling` (C-4), the reset guards (C-7). Grants files updated. Nothing calls the RPCs yet, so this changes no behaviour except C-7.                                                                                                                                                                                                                                                                                                   |
| S2  | Levelling flow             | The six-step flow (DESIGN §2.2), the event-page card in `JoinEventCard`, the Home card, return path and toast. Client-side only: shown when `get_my_levelling` says so. Handles `needs_level` already, as a status and as a raised error, in the self-register, transfer-accept and team-invite paths (C-3, C-6), so S3 can follow without a client change. Gallery entries for any new ui variant.                                                                                                                                                             |
| S3  | Registration gate          | Migration: `register_for_tournament` returns `needs_level` (C-3); trigger `registrations_require_levelling` (C-6). Team events: `register_team_for_tournament` and `respond_to_team_invite` return `needs_level` too.                                                                                                                                                                                                                                                                                                                                           |
| S3b | Gate on the level (D-16)   | Migration: `private.needs_levelling` = no level recorded. No client change: every gate point reads `get_my_levelling`. Tests: `levelling.sql` gate cases; e2e gated path uses a player with no level.                                                                                                                                                                                                                                                                                                                                                           |
| S3c | Questions for everyone     | A Home prompt, never a gate, for players who have a level and haven't answered: the five questions, no Playtomic step. `complete_levelling` stores answers without touching the rating (`start_source` `none`); `get_my_levelling` says whether the prompt is open; the reset guard counts only real starts.                                                                                                                                                                                                                                                    |
| S4  | Faster signup              | Playtomic level optional in `profileProblem` and the `ProfileFields` hint (all four callers). Level 0 shown as no level (`RegisteredSection`, community lists); `NO_LEVEL_START` in King of the Court seeding and `initialRating` (DESIGN §3.1). "How did you find us" on the signup form; migration: `player_signup_source` (C-5), hook validation, confirmed-user trigger insert.                                                                                                                                                                             |
| S5  | End-to-end tests           | Playwright: newcomer from a share link → signup without a level → levelling card → six steps → toast → Register; a player with a level answering the five questions from Home (S3c). Tag the writing tests `@seed-write`.                                                                                                                                                                                                                                                                                                                                       |
| S6a | New partner's level        | Migration: `private.create_partner_player` refuses a blank, 0 or > 7 level (`invalid_level`), for captains and admins alike. `NewPartnerForm`: the level is required, with a hint for partners not on Playtomic. A captain-created partner then has a level, so the levelling gate doesn't hold them when accepting.                                                                                                                                                                                                                                            |
| S6b | Admin registers, no level  | The admin register forms (`AddPlayerCard`; `AdminAddTeamCard` for captain and partner; `ChangePartnerPanel` on behalf) ask for the level of a player who has none, and save it before registering, through `admin_update_player`. That RPC regains its rating reset with the C-7 guards (#182).                                                                                                                                                                                                                                                                 |
| S6c | Every spot, whoever writes | No spot in an event without a level, whoever registers the player (D-18). `resolve_team_partner` refuses an existing partner with no level (`partner_needs_level`); `register_for_tournament` and `register_team_for_tournament` refuse an admin registering a player or captain with no level (`player_needs_level`, `captain_needs_level`); the backstop trigger checks every row, not only the caller's own; `admin_force_accept_transfer` and `admin_transfer_registration` return `recipient_needs_level`. The team forms name the partner in the refusal. |
| S7  | One level, database        | Migration: `private.parse_level(text)` and a CHECK on `players.playtomic_level` (DESIGN §6, C-8). Every write path parses through it: the signup hook, `create_player_for_confirmed_user`, `update_my_profile`, `admin_update_player`, `admin_add_player`, `create_partner_player`, `complete_levelling`. `update_my_profile` and `admin_update_player` refuse to clear a recorded level (`level_required`). DB test reads the shared cases file.                                                                                                               |
| S8  | One level, client          | `src/lib/level.ts`: `parseLevel`, `hasLevel`, `levelProblem({ value, policy })` with policies `required`, `optional`, `keep` (DESIGN §6.2), replacing `levelProblem`, `givenLevelProblem` and `ownLevelProblem`. One level input component for the five forms. Unit test reads the shared cases file.                                                                                                                                                                                                                                                           |
| S9  | "No level" stored as null  | Migration: `players.playtomic_level` null for no level instead of 0 (default null, existing 0 → null), `players_public` and every SQL reader; client reads `hasLevel` only. Last task (owner, 23 Nov). Carries Matchmaking V2 M4.3's schema drop.                                                                                                                                                                                                                                                                                                               |

**Order:** S1 → S2 → S3 → S3b → S4; S3c after S3b; S6a, S6b after S4; S6c after S6b; S7 → S8 → S9 last. S5 grows with S2–S4 (each PR adds its own cases)
and is finished last.

- **S4 after S3, not before.** Once the level is optional, a player with no
  level who registers themselves must have a levelling start first. Players
  registered by an admin can still have neither; S4's `NO_LEVEL_START`
  fallback covers them.
- **S2 and S3 ship in the same window.** Deploy order for S3: S2's client is
  live → merge S3 → `db push`. A player between the two sees the card but
  could still register by a stale path; that's harmless for a day.
- **S1** can ship on its own in any window: no UI change.

## How to do each task

### S1

- One migration. Follow `20260713000001_matchmaking_v2.sql` §10 for the
  `record_mm_reset` pattern and `20260806211259_registration_capacity_rpcs.sql`
  for RPC style (`statement_timeout`, `app.audit_source`).
- Re-create `update_my_profile` from its latest definition
  (`20260816140000_remove_device_trust.sql`); change only the reset condition.
  `admin_update_player` has no reset to guard (#182).
- `supabase/tests/levelling.sql`: each status of `complete_levelling`; both
  start sources and σ; cap; `already_levelled`; `not_needed` for a player with history; audit row; `needs_levelling`
  for a player with a `seed` row, a `tournament` row, a `self_reset` row only,
  a completed team-event registration only, and none; C-7 both guards; RLS (a member can't read another's row, or their
  own).
- `supabase/tests/levelling_parallel.sh`: two calls at once give `ok` and
  `already_levelled`, with one row each.
- `npm run db:types` and commit the generated types.

### S2

- A route (`/levelling?from=`) for the flow; state is a pure reducer
  (step, answers, Playtomic value) with unit tests: advance on tap, back keeps
  answers, step 6 validation (> 0, ≤ 7, comma decimal via `parseLevel`).
- Answer codes ↔ wording in one module next to the flow.
- `useMyLevelling()` query over `get_my_levelling`; invalidate on finish, on
  sign-in and in `useRefreshOnFocus`.
  Parse it with a schema: `playtomic_level` can be null, though the generated
  type says `number`.
- `JoinEventCard`: a `needsLevelling` prop decides between the card and the
  register action. Waitlist ("event full") gets the same card.
- Home: card above `NextEventCard`, shown only when `needsLevelling`.
- Check every ui component first (CLAUDE.md, UI). `OptionRow` already acts on
  tap; the progress header with back and close is the new `StepHeader`.

### S3

- One migration. Re-create `register_for_tournament`,
  `register_team_for_tournament` and `respond_to_team_invite` from
  `20261022120000_team_events.sql`; add the check only. The team-invite UI
  (`get_my_team_invites` consumers) shows the levelling card on `needs_level`.
- Trigger function in `private`, revoked from client roles.
- Extend `supabase/tests/registration_integrity.sql` and `team_events.sql`:
  self-register refused, admin-for-other allowed, transfer acceptance refused
  for a recipient who needs levelling, team registration refused for a
  captain and invite acceptance for a partner who needs levelling, waitlist promotion unaffected, rows
  active before the migration untouched.
- Rehearse on a fresh production copy (`rehearsal:sync`): count players who
  would be gated, and how many of them have any past registration (a regular
  wrongly gated would show up there); confirm no existing registration
  changes. Report counts only in the PR.

### S4

- `profileProblem`: drop the level from `missing`; call `levelProblem` only
  for a non-empty value. Update its tests and the four callers' tests.
- `signupMetadata.ts`: add the two C-5 keys when chosen.
- Migration: re-create `before_user_created_hook` and
  `private.create_player_for_confirmed_user` from their
  `202610201*` definitions, plus `player_signup_source`. Extend
  `supabase/tests/native_signup.sql`.
- PIN removal docs list the hook's rejection strings (PLAN, "exact strings"):
  add the new ones there too.

### S3c

- One migration: `player_levelling` takes `start_source` `none` with no
  start (C-2); `needs_levelling` and `levelling_start_stands` count only real
  starts; `complete_levelling` answers-only branch; `get_my_levelling` adds
  `questions_open` (return type changes: drop and re-create, re-grant).
- Client: the flow's `questions` mode (five steps, Finish on the last
  question); `QuestionsCard` on Home with "Not now" (`useQuestionsPrompt`).
  The client deploys before `db push`, so it reads a missing
  `questions_open` as false.
- Tests: `levelling.sql` (answers only, prompt state, cleared level after
  answering, reset guard); `levelling_parallel.sh` for the answers-only path.

### S7

- **Shared cases first.** `supabase/tests/level_cases.json`: input text,
  then the expected result for each policy (a value, `invalid`, or `blank`).
  Cover at least `""`, `"  "`, `"0"`, `"0.3"`, `"2,5"`, `"2.45"`, `"2.455"`,
  `"7"`, `"7.01"`, `"abc"`, `"-1"`, `"1e2"`. S8's unit test reads the same
  file, so the client and the database can't drift.
- **`private.parse_level`** (C-8) returns a level, or null for "no level"
  (blank, or `0`, which today's client sends for blank), or raises
  `invalid_level`. Until S9, 0 stays the stored "no level", so S7 works with
  the current client and ships before S8. `parse_metadata_level`'s silent 0 for
  garbage goes: the signup hook rejects it instead.
- **Each path applies its policy to null** (C-8 table): `optional` stores 0,
  `required` returns `invalid_level`, `keep` returns `level_required` when a
  level is recorded. An absent key leaves the level unchanged everywhere.
  Nobody clears a recorded level, admins included (D-21): `update_my_profile`
  and `admin_update_player` both apply `keep`, so their `coalesce(…,
v_old_level)` becomes "absent key: unchanged; null: `level_required` if a
  level is recorded, else 0".
- **Column:** `players.playtomic_level` becomes NOT NULL with the CHECK
  `players_playtomic_level_range` (C-8), so "no level" has one representation
  until S9. Rehearse on a production copy.
- Map `invalid_level` and `level_required` to the client's level messages on
  every caller that doesn't already.

### S8

- `src/lib/level.ts` replaces `src/lib/parseLevel.ts`. Policies:
  - `required`: a level must be given (new partner, admin register forms,
    levelling's Playtomic step when typed).
  - `optional`: blank allowed (signup, admin add or invite, and Settings or
    the admin editor for a player with no level).
  - `keep`: blank and 0 refused (Settings and the admin editor once a level is
    recorded).
- One message set: "Playtomic level must be a number above 0 and up to 7, with
  at most 2 decimals, e.g. 2.45." plus each policy's blank message.
- `hasLevel(level)` replaces the inline `> 0` checks (about 30 files), so S9
  changes one function.
- One level input component (label, hint, error, `inputMode="decimal"`) for
  `ProfileFields`, `LevelField`, `PlaytomicStep`, `NewPartnerForm` and the admin
  `PlayerForm`; their visual differences become props. Check the gallery.

### S9

- Migration: default null, `update players set playtomic_level = null where
playtomic_level = 0`, the CHECK without the `= 0` branch, and "no level" as
  null in `private.level_to_store` and `private.has_level` (C-8). The S7 write
  paths go through those two already; the readers left are `needs_levelling`
  and `get_my_levelling` (to `has_level`) and `rating_events.prior_mu`'s
  coalesce.
- With Matchmaking V2 M4.3's schema drop in the same migration (its PLAN,
  appendix): `adjustment`, `adjusted_level`, the `learned_*` columns,
  `tournaments.ratings_applied_at` and `admin_persist_learned_ratings`. Both
  rewrite the same write paths and rebuild `players_public`, so one migration
  and one rehearsal instead of two.
- Client: `hasLevel` and `normalise.ts` read null; `NO_LEVEL_START` (King of the
  Court seeding, the matcher) applies to null.
- Rehearse on a production copy: parity diff limited to the 0 → null change.

## Release

| Task | Window                      | Steps                                |
| ---- | --------------------------- | ------------------------------------ |
| S1   | Any day outside the freeze  | merge → `db push` → `db:grants:prod` |
| S2   | 16–26 Nov or after 29 Nov   | merge (Vercel deploys)               |
| S3   | Same window as S2, after it | merge → `db push` → `db:grants:prod` |
| S3c  | 16–26 Nov or after 29 Nov   | merge → `db push` → `db:grants:prod` |
| S4   | After S3 is live            | merge → `db push` → `db:grants:prod` |
| S6a  | 16–26 Nov or after 29 Nov   | merge → `db push` → `db:grants:prod` |
| S6b  | Any day (admin-only)        | merge → `db push` → `db:grants:prod` |
| S6c  | 16–26 Nov or after 29 Nov   | merge → `db push` → `db:grants:prod` |
| S7   | By 26 Nov or after 29 Nov   | merge → `db push` → `db:grants:prod` |
| S8   | After S7 is live            | merge (Vercel deploys)               |
| S9   | After S8, outside a freeze  | merge → `db push` → `db:grants:prod` |
