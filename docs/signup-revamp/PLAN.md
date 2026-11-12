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

| #   | Task                       | What ships                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0  | Plan                       | These docs. No code.                                                                                                                                                                                                                                                                                                                                                                                |
| S1  | Levelling storage and RPCs | Migration: `player_levelling` (C-2), `complete_levelling` and `get_my_levelling` (C-3), `private.needs_levelling`, kind `levelling` (C-4), the reset guards (C-7). Grants files updated. Nothing calls the RPCs yet, so this changes no behaviour except C-7.                                                                                                                                       |
| S2  | Levelling flow             | The six-step flow (DESIGN §2.2), the event-page card in `JoinEventCard`, the Home card, return path and toast. Client-side only: shown when `get_my_levelling` says so. Handles `needs_level` already, as a status and as a raised error, in the self-register, transfer-accept and team-invite paths (C-3, C-6), so S3 can follow without a client change. Gallery entries for any new ui variant. |
| S3  | Registration gate          | Migration: `register_for_tournament` returns `needs_level` (C-3); trigger `registrations_require_levelling` (C-6). Team events: `register_team_for_tournament` and `respond_to_team_invite` return `needs_level` too.                                                                                                                                                                               |
| S4  | Faster signup              | Playtomic level optional in `profileProblem` and the `ProfileFields` hint (all four callers). Level 0 shown as no level (`RegisteredSection`, community lists); `NO_LEVEL_START` in King of the Court seeding and `initialRating` (DESIGN §3.1). "How did you find us" on the signup form; migration: `player_signup_source` (C-5), hook validation, confirmed-user trigger insert.                 |
| S5  | End-to-end tests           | Playwright: newcomer from a share link → signup without a level → levelling card → six steps → toast → Register; existing player without a played night from Home with the prefill; gate refusal on a stale page. Tag the writing tests `@seed-write`.                                                                                                                                              |

**Order:** S1 → S2 → S3 → S4. S5 grows with S2–S4 (each PR adds its own cases)
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

- Route or `FullScreenDialog` for the flow; state is a pure reducer
  (step, answers, Playtomic value) with unit tests: advance on tap, back keeps
  answers, step 6 validation (> 0, ≤ 7, comma decimal via `parseLevel`).
- Answer codes ↔ wording in one module next to the flow.
- `useMyLevelling()` query over `get_my_levelling`; invalidate on finish, on
  sign-in and in `useRefreshOnFocus`.
- `JoinEventCard`: a `needsLevelling` prop decides between the card and the
  register action. Waitlist ("event full") gets the same card.
- Home: card above `NextEventCard`, shown only when `needsLevelling`.
- Check every ui component first (CLAUDE.md, UI). Likely new variants: an
  `OptionRow` that submits on tap, a progress header with back and close.

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

## Release

| Task | Window                      | Steps                                |
| ---- | --------------------------- | ------------------------------------ |
| S1   | Any day outside the freeze  | merge → `db push` → `db:grants:prod` |
| S2   | 16–26 Nov or after 29 Nov   | merge (Vercel deploys)               |
| S3   | Same window as S2, after it | merge → `db push` → `db:grants:prod` |
| S4   | After S3 is live            | merge → `db push` → `db:grants:prod` |
