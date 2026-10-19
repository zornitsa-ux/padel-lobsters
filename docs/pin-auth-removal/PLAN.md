# PIN sign-in retirement: implementation plan

This is the coordinator brief and the **single source of truth for status**.
Read it with [`DESIGN.md`](./DESIGN.md), which holds the evidence (F-1 to F-10),
the target design (§2) and the decisions (D-1 to D-17). The protocol from
[`../matchmaking-v2/PLAN.md`](../matchmaking-v2/PLAN.md) applies: §2 covers
roles and the worker brief, §3 the ground rules.

**Goal.** Email code (plus link) becomes the way to sign in, and passwords are
optional. PINs stop working ~2 weeks after players are told, and nobody who is
signed in gets logged out.

**Constraints**

- **Migrations:** review → merge → `npx supabase db push` from `main`
  (CLAUDE.md). There are no MCP or dashboard writes to production. Edge
  functions are deployed from `main` after merge (CONTRIBUTING.md).
- **The owner reviews, merges and does every production step:** db push,
  function deploys, dashboard settings, Vercel rollbacks. The coordinator
  writes the checklists and runs **read-only** verification queries afterwards.
- **No sign-in-facing release within 3 days of a tournament** (F-7).
  Phase 0a is exempt because no sign-in path uses passwords.
- **Testing is local only** (D-15). Nothing is tested on a Vercel preview.
  Realism comes from loading a copy of production data into the local stack
  (§4.5). Production is touched only by the release steps and the read-only
  checks after them.

---

## 1. Status

| ID  | Task                                                      | Owner | Depends on      | PR       | State                        |
| --- | --------------------------------------------------------- | ----- | --------------- | -------- | ---------------------------- |
| T0a | Clear 44 orphan password hashes → `NULL`                  | C     | —               | #43      | [x]                          |
| T0b | Identity backfill + patch `ensure_auth_user_for_player`   | C     | —               | #44      | [x]                          |
| T0c | Auth settings: `config.toml` + dashboard; templates       | C → O | —               | #44, #46 | [~] dashboard done; #46 open |
| T13 | Prod-data rehearsal kit: sync + integrity check (§4.5)    | C     | —               | #45      | [~]                          |
| T1  | Contract freeze (§3.1, CONTRACTS.md)                      | C     | —               | —        | [x]                          |
| T2  | Backend: hook, trigger, invite/add RPCs, readiness RPC    | W     | T0b, T1         | 1/3      | [ ]                          |
| T3  | `SignInForm`, `AuthConfirm`, gates, native signup         | W     | T1              | 2/3      | [ ]                          |
| T4  | Account → Sign-in & security                              | W     | T1              | 2/3      | [ ]                          |
| T5  | Comms: upgrade card, interstitial, readiness panel, copy  | W     | T1              | 3/3      | [ ]                          |
| T14 | Rehearsal sign-in + data-access parity script (§4.5)      | W     | T13, T1         | 0d       | [ ]                          |
| T6  | Verification: local matrix, local devices, rehearsal      | C + O | T2–T5, T14      | —        | [ ]                          |
| T7  | Dark backend release (R2)                                 | O     | T2 merged, T0c  | —        | [ ]                          |
| T8  | T₀ release and announcement (R3)                          | O     | T6, T7          | —        | [ ]                          |
| T9  | Cutover PR: remove PIN client path, `verify-pin` 410 stub | W     | T8              | 4        | [ ]                          |
| T10 | Revoke `verify_player_pin_v2` from anon (D-12)            | C     | T9 + 48h watch  | 5        | [ ]                          |
| T11 | Phase 4 cleanup (DESIGN §3 Phase 4)                       | W     | T10 + ≥2 weeks  | 6        | [ ]                          |
| T12 | Remove the "Used a PIN before?" explainer                 | W     | cutover + ~2 mo | 7        | [ ]                          |
| T15 | Phase 5a: client reads the role from token claims         | W     | cutover         | 8        | [ ]                          |
| T16 | Phase 5b: `auth.users` owns the email; Admin API writes   | W     | T11             | 9        | [ ]                          |
| T17 | Phase 5c: remove synthetic accounts + last auth writers   | W     | T15, T16        | 10       | [ ]                          |

C = coordinator · W = worker (worktree) · O = owner.
States: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked.

**Log**

- 2026-10-15: The owner interview closed DESIGN's open questions (DESIGN.md
  "Owner answers"). D-8 to D-13 were recorded. Production check: passwordless
  users hold `encrypted_password = NULL` (96 of them), and 44 users have a hash
  set.
- 2026-10-15: Phase 0 built; PRs #43 (0a) and #44 (0b) await review. Gates
  green, and the local Mailpit matrix row for 0b passed (all five emails,
  driven through supabase-js). Production reads at build time: 44 hashes, 0
  `''`; **47** identity-less users (up from 31 because of new players), 40 of
  them holding a `role`; and **87 GoTrue identities still holding the
  synthetic email** that `20261012140000` left behind. 0b's
  `private.sync_email_identity` fixes all three and is also called from
  `sync_player_email_to_auth`, so admin email edits stop recreating the drift.
  The coordinator built T0b instead of a worker: the brief would have been the
  implementation, and both would have shared the one local stack. Deviation:
  `email_change` stays link-only, because no screen takes an email-change code
  (#44 explains). For T1: `recovery` now carries a code, so `SignInForm`'s
  forgot-password state can accept it. Open for the owner: check the Resend
  plan's daily cap, since the free plan's 100/day is below the 150 target.
- 2026-10-16: #43 (0a) merged and pushed. Owner review of #44: the sign-in
  code can't ship before there's a field to type it into (D-14). #44 now keeps
  `magic_link` link-only (`main`'s template and subject; only the expiry copy
  says 30 minutes to match `otp_expiry`). The code-first `magic_link` moves to
  PR 2/3 and is pasted at T₀ after the client deploys. Pre-T₀ code checks
  (§4.3) use the `confirmation` email from a native signup.
- 2026-10-16: Owner: no testing on Vercel previews; all testing is local, with
  production data synced into the local stack (D-15). §4.3 is now local
  devices; §4.5 adds the prod-data rehearsal (T13, T14) and the auth integrity
  check, both gates from R1 on. Owner: remove as much custom auth logic as
  possible, so Phase 5 (D-16) adds T15–T17 after Phase 4. Production reads
  (2026-10-16): 140 players, 0 without an auth account and 0 auth accounts
  without a player; 0 duplicate auth emails; 0 unconfirmed, anonymous, SSO or
  phone users; 0 password hashes; 3 active players and 10 placeholders on a
  synthetic email; 47 / 87 identity drift (#44). 2 of the 3 no-email players
  have `players.email = ''` rather than `NULL`; T2 normalizes them.

- 2026-10-19: T13 built (#45). First sync: 141 players and 141 auth users, with
  integrity counts identical to production. The GoTrue version check caught
  production on v2.197.0 against v2.195.0 locally (fixed by `supabase link`
  and a restart). **#44 rehearsed on `main` + #44:** no identity 48 → 0, stale
  identity email 87 → 0, empty `providers` 48 → 0, all 135 roles kept, and the
  other counts unchanged. #44's branch predates #43's migration, so `migration
up` refuses it alone; a PR branch must contain `main`'s migrations. Noted:
  20 GoTrue-created identities have `email_verified: false` on confirmed users
  (GoTrue doesn't update it on magic-link confirmation). Email sign-in ignores
  it. Sessions are never copied, which matters for PR 10 (§3.8).

- 2026-10-19: #44 rebased onto `main` and rehearsed again on a fresh copy. The
  counts were the same, and one account per group (no identity, stale identity
  email, already fine) signed in after the migration by code and by link, with
  its role, `providers: ['email']` and one identity. The owner moved R1 to
  now: the 21 Oct date only kept clear of the 3 days after #12, which is over.
  Every other schedule rule protects the run-up to #13.

- 2026-10-19: `/code-review` of #44 found no bugs in the main path. Its edge
  cases are fixed (3f20e6e): no-email and anonymous users skipped, `'email'`
  added to `providers` alongside another provider, `email_verified` synced, the
  trigger repairing on every email edit, and the test plants asserted. Rehearsed
  again: the same counts, plus all 141 identities' `email_verified` now match.
  Template de-duplication was added to PR 2/3.

- 2026-10-19: **R1 done.** The owner merged #44 and pushed the migration. The
  integrity check against production matches the rehearsal: no identity,
  stale identity email and empty `providers` are all 0; everything else is
  unchanged. Dashboard settings applied by the owner (**D-17**): secure email
  and password change on; require current password on; leaked-password check
  on; minimum length 10 with lowercase, uppercase and digits; OTP 6 digits
  expiring after **3600 s** (not 1800). #46 matches `config.toml` and changes
  the four code templates from "30 minutes" to "1 hour"; the owner pastes those.
  Verified on a temporary local GoTrue v2.197.0: require current password
  applies only to sessions that signed in with a password, so first-password
  and recovery flows aren't blocked.

- 2026-10-19: The owner pasted #46's templates ("1 hour") into the dashboard and
  confirmed the email settings, without screenshots. **Resend is on the free
  plan: 100 sends/day**, below DESIGN's 150 target. That cap is shared by
  Auth email (codes, links, invites) and the three tournament-reminder
  functions. Demand from production: the busiest day in 60 days was #12
  (2026-10-18) with 13 new sessions, and the busiest week had 40. A heavy day
  with codes, resends and a reminder batch comes to roughly 60, so the cap
  holds with some margin. The T₀ announcement goes from the club address, not
  Resend. Upgrade-or-watch is an owner decision at the T₀ go/no-go (§5).

- 2026-10-19: **T1 done:** the contracts are frozen in `CONTRACTS.md` (C-1 to
  C-11). Changes from §3.1:
  - The `send-invite-email` body is the whole message (`player_id`, `email`,
    `name`, `kind`, `team_name`), so the function never reads the database,
    the same as `send-pin-email`.
  - New: `admin_resend_invite` returns the address it mailed.
  - New: the readiness RPC is `admin_auth_readiness() returns jsonb`.
  - New: the hook's four exact messages, with `http_code` 400.
  - New: the PR 1/3 migration timestamps are reserved (`20261020120000`
    to `…160000`).
  - New: the `?signin=1&email=` deep link, the `pl_auth_return_path` key,
    and the `OtpCodeStep` that signup shares with sign-in.

  Invite copy must work before T₀, so it doesn't mention a code (R2 runs
  dark against the link-only client).

---

## 2. Schedule

Dates stay relative until tournament **#13** is scheduled. Then pin them here.

| Milestone                         | When                                       | Rule                                                                       |
| --------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| R0: Phase 0a merged + pushed      | Week of 15 Oct                             | Invisible; may land before #12 (18 Oct)                                    |
| R1: Phase 0b merged + pushed      | **Done 2026-10-19**                        | Verified in production (§4.4); dashboard checklist in progress             |
| R2: dark backend (PR 1/3)         | ≥ 2 days before T₀                         | The hook and invite emails run in production before players see the new UI |
| **T₀**: PRs 2/3 + 3/3 + announce  | A Tue or Wed                               | T₀ ≤ #13 − 17 days                                                         |
| WhatsApp reminder                 | Cutover − 3 days                           |                                                                            |
| **Cutover** (PR 4)                | T₀ + 14, a Tue or Wed                      | ≥ 3 days before #13; go/no-go in §5                                        |
| Revoke (PR 5)                     | Cutover + 2 days                           | After the 48h watch is clean                                               |
| Phase 4 cleanup (PR 6)            | ≥ Cutover + 14 days, once stub hits are ~0 | Not within 3 days of an event                                              |
| Explainer removal (PR 7)          | Cutover + ~2 months                        |                                                                            |
| Phase 5a: role from claims (PR 8) | After cutover                              | Client only; not within 3 days of an event                                 |
| Phase 5b: email ownership (PR 9)  | After PR 6                                 | Not within 3 days of an event                                              |
| Phase 5c: final cleanup (PR 10)   | ≥ 7 days after PRs 8 and 9                 | Stale clients have reloaded; not within 3 days of an event                 |

**Worked example:** if #13 is Sun 15 Nov, then T₀ is Tue 27 Oct, the reminder
goes out Sat 7 Nov, and cutover is Tue 10 Nov. If #13 is scheduled so early
that T₀ ≤ #13 − 17 can't hold, **keep T₀ and move cutover to #13 + 3 days.**
Don't shorten the window.

**One date drives all the copy.** It's set at T₀ as a single constant, e.g.
`PIN_SUNSET_DATE` in `src/features/auth/pinSunset.ts`. The PIN link, the
interstitial and the readiness panel all read it. PR 4 deletes it.

---

## 3. Work breakdown

### 3.0 Phase 0 (DESIGN §3 Phase 0)

- **T0a (PR 0a, migration only).** Set `encrypted_password = NULL` where it's
  non-null. This is safe for every row today because no password UI exists, so
  no hash was set by the app. Add a SQL test asserting zero non-null hashes after
  `db:reset` with a seeded dirty row. The PR description states the
  before/after counts (44 → 0).
- **T0b (PR 0b).** Migration: backfill `auth.identities` for users with no
  identity row, copying the shape of a GoTrue-created row. Patch
  `ensure_auth_user_for_player` to insert the identity too. SQL test: the
  backfill shape, and that the patched function creates both rows.
- **T0c (PR 0b + dashboard).** The `config.toml` `[auth]` changes from DESIGN §2's
  settings table, except the hook, which ships with T2. Templates:
  `confirmation`, `recovery` and `reauthentication` show the code first, then
  the `token_hash` link, and never `{{ .ConfirmationURL }}`. `magic_link` stays
  link-only until PR 2/3 (D-14), and `email_change` stays link-only (#44).
  Locally: `supabase stop && supabase start`, then check all five in Mailpit with
  `enable_confirmations = true` temporarily on. Also produce a **dashboard
  checklist** in the PR description, one row per setting, for the owner to
  tick after merge. It includes checking Resend's daily cap against ≥150
  sends/day.

### 3.1 T1: contract freeze

**Frozen in [`CONTRACTS.md`](./CONTRACTS.md) (2026-10-19), which is the
authority where it is more specific than this list.** The coordinator commits
these before dispatching T2–T5, and workers don't change them (matchmaking-v2
§2 freeze rule):

- **`SignInForm` props:**
  `{ variant: 'page' | 'modal' | 'inline', initialEmail?, onSignedIn?, allowPin: boolean }`.
  It owns the states email → code → done, plus password and forgot-password.
  Before sending a link, it stores the return path under a single
  `localStorage` key.
- **The `before_user_created` hook's rejection messages** (exact strings): the
  placeholder name, a missing or oversized name, and an invalid level. Also the
  HTTP status the client maps them to.
- **Trigger semantics:** create a `players` row on the first confirmed
  `auth.users` state. It's a no-op if a player with that id already exists,
  which keeps it idempotent with `ensure_auth_user_for_player`'s raw inserts.
- **The `admin_invite_league_player` / `admin_add_player` return shape is
  unchanged, with `pin: null`** (D-13). `admin_regenerate_pin` becomes
  `admin_resend_invite(player_id)`. The old RPC stays until Phase 4.
- **`send-invite-email` payload** `{ player_id, kind: 'league_invite' | 'added' | 'resend' }`.
  It uses the same Vault-secret pattern as `send-pin-email`.
- **Readiness RPC** (admin-only): `{ no_email: [{id, name}], recent_pin_users: [{id, name, last_pin_at}], password_count }`.
  `recent_pin_users` is named, because admins nudge these people one by one.
  `no_email` means a synthetic auth email; T2 makes blank `players.email`
  impossible, so the two never disagree.
- **Migration timestamps** are reserved for each PR so the stack orders
  correctly.

### 3.2 PR 1/3: backend (T2), released dark

- Migration: the `before_user_created_hook` function and its grants (DESIGN §2
  table). Add it to `expected_function_grants.txt`.
- Migration: the confirmed-user trigger on `auth.users`.
- Migration: `players.email` blank → `NULL` (2 rows in production on
  2026-10-16), plus `check (email is null or btrim(email) <> '')`.
- Migration: the invite/add RPCs drop PIN generation and call
  `private.send_invite_email`. Add `admin_resend_invite` and the readiness RPC.
- Edge function `send-invite-email` (copied from `send-pin-email`, with no
  credential in the body; DESIGN §2 Admin flows) and its `config.toml` block.
- `config.toml`: `[auth.hook.before_user_created]`.
- SQL tests: `supabase/tests/native_signup.sql` (the hook accepts and rejects
  correctly; the trigger works on the insert-confirmed and update-to-confirmed
  paths and is idempotent), plus updates to `admin_invite.sql` (no PIN is
  stored or returned, and the invite email is recorded).
- `npm run db:types` and `npm run db:grants`.
- **The PR description lists the deploy order:** db push → `functions deploy
send-invite-email` → enable the hook in the dashboard.

### 3.3 PR 2/3: sign-in surfaces (T3 + T4), stacked on 1/3

- **T3:** `features/auth/SignInForm` (DESIGN §2), mounted in
  `VerificationGate`, `ui/AuthGate.tsx` (which replaces `PinPrompt`) and
  `settings/AccountSection.tsx`. The PIN path sits behind
  `allowPin`/"Sign in with PIN (until <date>)" on the full-page variant only.
  `AuthConfirm`: tap-to-confirm, the return path, and the `type=recovery` → set
  new password screen. `SignupRequest`: native signup (DESIGN §2 Sign-up),
  with the PIN reveal screen deleted. `InvitePlayerModal`, `PlayerDetailPage`
  and `PinRevealModal` handle `pin: null` and "Resend invite".
- **T4:** the Account → Sign-in & security section (email, password with
  reauthenticate, sign out everywhere).
- **Password UI (T3 + T4, D-17):** state the rules up front: 10+ characters,
  with a lowercase letter, an uppercase letter and a digit, and not found in a
  known breach. Map `weak_password` `reasons` (`length`, `characters`,
  `pwned`) to specific messages. Show a current-password field only when the
  session signed in with a password (`amr` includes `password`), and map
  `current_password_required` / `current_password_invalid`. First password,
  code or link sessions, and the post-recovery screen don't need it.
- **Template (D-14):** `magic_link.html` gets the code first, in the shared
  layout of `confirmation.html` (#44's first commit has the finished version),
  and its subject becomes "Your Padel Lobsters sign-in code". The PR
  description's release steps put the dashboard paste **after** Vercel
  deploys: the new form with the old email still works through the link, but
  the old client with the new email repeats the PIN-field trap.
- **De-duplicate the templates (code review of #44).** Four (then five) files
  repeat one ~170-line layout, kept in step by a header comment. GoTrue can't
  share partials, so render them from one layout plus per-template copy with
  a small build script, and add a CI check that the committed files match its
  output.
- **Tests:** unit and component tests for every `SignInForm` state (DESIGN §5),
  `AuthConfirm` and signup errors from the hook. e2e: `seed.sql` gets seeded
  passwords, `signInAt` (`e2e/tournament-flow.spec.ts:42`) switches to the
  password, and a new spec reads the code from Mailpit's API.

### 3.4 PR 3/3: comms (T5), stacked on 2/3

- The upgrade card (and its synthetic-email variant), the post-PIN
  interstitial, and the admin readiness panel (in Admin tools).
- The FAQ rewrite in `lobsterWayContent.ts`, plus copy: the Dashboard guest
  greeting, the `SignInBanner` default, `TransferAccept`, and "behind her PIN".
- The production `lobster_way_content` copy is **edited by an admin in
  LobsterWayAdmin at T₀** (an app write, not SQL). The PR includes the exact
  text to paste.

### 3.5 PR 4: cutover (T9), built during the window

The client PIN path is removed, and the "Used a PIN before?" explainer is
added. `verify-pin` is replaced by the 410 `pin_retired` stub, and the client
maps `pin_retired` to the explainer. **No migration** (D-12). The PR
description says: merge (Vercel deploys the client) → `functions deploy
verify-pin`.

### 3.6 PRs 5–7

- **PR 5 (T10):** the migration revoking `verify_player_pin_v2` from anon, plus
  the grants file update.
- **PR 6 (T11):** DESIGN §3 Phase 4 in full. Functions are deployed or deleted
  first, then db push.
- **PR 7 (T12):** removes the explainer.

### 3.7 PRs 0c and 0d: prod-data rehearsal kit (T13, T14)

Neither has a migration or anything to deploy, so each can merge any time.
T13 (0c) must land before R1. T14 (0d) must land before T6.

- **T13 (#45):** `scripts/prod-rehearsal/sync.sh`, `scrub_credentials.sql`,
  `auth_integrity.sql` (+ `_details`) and `integrity.sh`, which together run
  §4.5 steps 1–2. Run them as `npm run rehearsal:sync` and
  `npm run rehearsal:integrity -- --local|--linked`.
- **T14:** `scripts/prod-rehearsal/parity.ts`, run with `tsx` and supabase-js
  against the local stack (§4.5 steps 3 and 5). For every account with a real
  email, it gets a code from `auth.admin.generateLink` (no email is sent), signs
  in with `verifyOtp({ type: 'email' })` as the app does, and runs a fixed set
  of RLS-protected reads through PostgREST with that token. It writes one hash
  per account and read, so baseline and after can be diffed. It also sends real
  codes to five accounts through Mailpit to cover the email path. It paces
  itself under the local rate limits instead of changing them.

### 3.8 PRs 8–10: Phase 5, native auth cleanup (DESIGN §3 Phase 5, D-16)

Each PR passes the prod-data rehearsal (§4.5) before review.

- **PR 8 (T15), client only:** one `useRole()`/`isAdmin` helper reads `role`
  from `supabase.auth.getClaims()`. It replaces the 8 copies of
  `session?.user?.app_metadata?.role === 'admin'` and the `syncMyRole()` call in
  `useAuth`. `sync_my_role` itself is dropped in PR 10, after stale clients
  have reloaded.
- **PR 9 (T16):** `auth.users.email` becomes the only source of truth.
  - **Edge function `admin-set-player-email`** (admin-only, checks the JWT
    role). It sets a player's sign-in email through the Admin API:
    `auth.admin.updateUserById` when the account exists, otherwise
    `auth.admin.createUser({ id: player_id, email, email_confirm: true })`. The
    admin email edit, add-player-with-email and placeholder invite all call it.
  - **Migration:** drop the `players_email_sync` trigger and
    `sync_player_email_to_auth`, `private.sync_email_identity`, and the
    `ensure_auth_user` trigger and `ensure_auth_user_for_player`. Keep
    `auth_users_email_sync` (auth → players), which is Supabase's documented
    profile pattern.
  - **Rehearsal must show** that `updateUserById` keeps the email identity in
    step (integrity check: stale identity emails = 0 after an edit), and that
    `createUser` accepts the player's id.
  - **Deploy order** (in the PR description): `functions deploy
admin-set-player-email` → merge (the client calls the function) → db push.
- **PR 10 (T17):** the last direct writes to the `auth` schema go.
  - **Migration:** drop `sync_my_role`, and remove the retired device-claim
    stripping from `custom_access_token_hook`.
  - **Migration:** delete the synthetic auth accounts (`@padelobsters.internal`)
    with no refresh token used in the last 30 days: the 10 placeholders, plus
    any no-email player who has gone quiet. The players' rows stay, and an
    account is created when an email is added (PR 9). A migration is the only
    write route CLAUDE.md allows. Deleting from `auth.users` cascades to
    identities, sessions and refresh tokens. Before the PR, confirm that
    nothing outside `auth` references these ids. Synthetic accounts with
    recent sessions are left for admins to chase through the readiness panel.
  - **The rehearsal can't predict which accounts go.** Sessions are never
    copied (§4.5), so on the copy every synthetic account looks quiet. The PR
    description states the expected count from a read-only production query
    on `auth.refresh_tokens`, and the post-release check compares against it.

---

## 4. Verification

### 4.1 Gates for every PR (the coordinator runs them before asking for review)

`format:check`, `lint`, `typecheck`, `test` and `build` (the same as CI), plus
`db:types:check`, `db:grants:check`, `npm run db:reset`, and every
`supabase/tests/*.sql` run as each file's header shows. For PRs 2–4, also run
`npm run test:e2e` locally. The PR description records the results.

**Every PR with a migration or an auth-flow change** also passes the
prod-data rehearsal (§4.5): 0b (#44), 1/3, 2/3, 4, 5, 6, 8, 9 and 10. The PR
description records the integrity counts and the parity diff summary (counts
only, never names or emails).

### 4.2 Local manual matrix (Mailpit at `:54324`, before each PR is marked ready)

| Flow                                                                      | PR  |
| ------------------------------------------------------------------------- | --- |
| Templates: three render a code + link; `magic_link` is link-only          | 0b  |
| Identity-less seeded user: request a link → sign in → set a password      | 0b  |
| Native signup → code → `players` row; placeholder name rejected           | 1/3 |
| Admin invite → invite email recorded, no PIN anywhere                     | 1/3 |
| `magic_link` renders the code; it signs in an existing user               | 2/3 |
| Code sign-in on each of the three gate variants, staying on the page      | 2/3 |
| Magic link → tap to confirm → back to the original path                   | 2/3 |
| Password set, sign in, forgot → recovery → new password                   | 2/3 |
| Password rules: length, characters, breached (hosted only) messages       | 2/3 |
| Password session: change needs the current password; code session doesn't | 2/3 |
| Signed-out transfer deep link → code → lands on the transfer              | 2/3 |
| Upgrade card variants; interstitial after a PIN sign-in                   | 3/3 |
| A PIN call gets the 410 → explainer; no PIN UI left                       | 4   |

### 4.3 Real devices and inboxes, on the local stack (before T₀)

No Vercel preview is involved (D-15). The phone and the dev machine share a
Wi-Fi network. The app runs over plain http, and there's no service worker, so
a home-screen install works from the LAN address.

**Setup (local only; nothing here is committed):**

- `vite --mode localdev --host`, with `VITE_SUPABASE_URL` pointing at the dev
  machine's LAN IP (`http://<lan-ip>:54321`).
- Add `http://<lan-ip>:5173` to `site_url` / `additional_redirect_urls`.
- **Real-inbox checks** need the local stack to send real email. Temporarily
  enable `[auth.email.smtp]` with Resend credentials from the environment.
  **Do this only with seed data loaded, never with a production snapshot**
  (§4.5), so no player can be emailed by mistake.

| Check                                                                       | Who                                                    | Gate for T₀ |
| --------------------------------------------------------------------------- | ------------------------------------------------------ | ----------- |
| Native signup with a `+alias` Gmail → `players` row                         | Owner                                                  | Hard        |
| Code sign-in + autofill, Android Gmail                                      | Owner                                                  | Hard        |
| Desktop magic link + return path; password reset end to end                 | Owner                                                  | Hard        |
| **iPhone home-screen install:** code entry + autofill                       | **Recruit** an iPhone user, on the dev machine's Wi-Fi | Hard        |
| Email change with double confirm                                            | Owner                                                  | Soft        |
| Prod-data rehearsal (§4.5): every account signs in with a code, parity diff | Coordinator                                            | Hard        |

**Outlook/Hotmail Safe Links can't be reproduced locally:** Microsoft's scanner
can't reach a LAN link, so it can't burn the token. It moves to the production
checks right after T₀ (§4.4, soft). The code still works if a scanner burns the
link.

The iPhone check is hard because it's the whole reason the code is the primary
sign-in (F-3). Record who tested what in §1's log.

### 4.4 Production checks after each release (coordinator, read-only SQL and logs)

- **R0:** count of non-null `encrypted_password` = 0.
- **R1:** auth users with no identity = 0; identities whose email differs from
  `auth.users.email` = 0; users with empty `providers` = 0. The owner
  confirms the dashboard against the T0c checklist (done 2026-10-19, without
  screenshots).
- **R2:** the hook is enabled (owner screenshot). The integrity check passes.
  `self_signup_player` signups still produce exactly one `players` row.
- **T₀, right after release (owner, production):** sign in with a code from
  your own account; sign up with a `+alias` address and check that it creates
  exactly one `players` row (then an admin removes it); and, if a tester is
  available, tap a link in an Outlook mailbox to check Safe Links (soft).
- **T₀ → cutover, daily:** new signups have player rows; PIN `pin_attempts`
  rows are trending down; auth logs show no 429s and no `otp_disabled` spikes.
- **Cutover + 48h:** `pin_retired` stub hits, auth error rates, and the
  WhatsApp help thread.
- **PRs 9 and 10:** the integrity check passes; synthetic accounts = the number
  the PR description predicted.

### 4.5 Prod-data rehearsal (local; gates every PR in §4.1)

The local stack gets a copy of production's `public` and `auth` data. Then the
PR's migrations run exactly as `db push` will run them. This is how we know,
before production, that every account still signs in and sees the same data.

**Safety (`sync.sh` checks these and refuses to run otherwise):**

- **Auth mail stays in Mailpit.** The script reads `GOTRUE_SMTP_HOST` from the
  running auth container.
- **Local GoTrue is production's version** (production's `/auth/v1/health`).
  If not, run `npx supabase link`, then `npx supabase stop && npx supabase start`.
- **Local migrations match production's exactly**, so run it from `main`.
- **Vault is empty locally**, before and after the load. Several database
  functions post to **production** edge function URLs, authenticated with a
  Vault secret. With no secret they fail closed.

**What is copied (`scrub_credentials.sql` runs in the load transaction):**

- From `auth`, only `users`, `identities` and `instances`. This is an
  allow-list, so sessions, refresh tokens, one-time tokens, MFA, OAuth/SSO,
  WebAuthn and the audit log never leave production, and nor does any table a
  future GoTrue adds.
- In what is copied, live credentials are wiped: link tokens and password
  hashes on `auth.users`, `players.pin`/`pin_hash`, and IPs and user agents in
  `pin_attempts`.
- The dump file lives in a `umask 077` temp directory that's removed on exit.
  Nothing persists outside the local database. Run `npm run db:reset` when you're
  done, and paste counts only into PRs, never names or emails.

**Steps**

1. **Sync (T13).** On `main`: `npm run rehearsal:sync`. After the safety
   checks, it runs `db reset --no-seed`, dumps production, and loads the dump
   with triggers off. Then it checks that GoTrue's admin API lists every
   loaded user and prints the integrity counts.
2. **Integrity check, before (T13).** Step 1 prints it. Save the output.
3. **Baseline (T14).** Run `parity.ts --record baseline`.
4. **Apply the PR.** Check out the PR branch, which must contain every
   migration on `main` (otherwise `migration up` refuses), then
   `npx supabase migration up --local`. If `config.toml` changed, restart the
   stack.
5. **After (T14).** Run `npm run rehearsal:integrity -- --local`, then
   `parity.ts --record after --compare baseline`.

**Pass criteria**

- The migrations apply cleanly.
- The integrity check meets the stage's expected values (below).
- Every account with a real email completes code sign-in.
- The parity diff is empty, except for differences the PR description
  predicts and explains.

**Integrity check: expected values**

| Count                                                        | From R1                           | From T₀ go/no-go           | From PR 10                   |
| ------------------------------------------------------------ | --------------------------------- | -------------------------- | ---------------------------- |
| Players without an auth account                              | 0                                 | 0                          | = synthetic accounts deleted |
| **Confirmed** auth accounts without a player                 | 0                                 | 0                          | 0                            |
| Unconfirmed auth accounts older than the OTP expiry (30 min) | 0                                 | listed (abandoned signups) | listed (abandoned signups)   |
| Duplicate auth emails (case-insensitive)                     | 0                                 | 0                          | 0                            |
| Duplicate real `players.email`                               | 0                                 | 0                          | 0                            |
| Real `players.email` ≠ `auth.users.email`                    | 0                                 | 0                          | 0                            |
| Auth accounts with no identity / stale identity email        | 0 / 0                             | 0 / 0                      | 0 / 0                        |
| Empty `providers`                                            | 0                                 | 0                          | 0                            |
| Anonymous, SSO or banned accounts                            | 0                                 | 0                          | 0                            |
| Active players with no real email (named in the output)      | ≤ 3                               | each one owned by an admin | each one owned by an admin   |
| Synthetic auth accounts (13 on 2026-10-16)                   | = no-email players + placeholders | same                       | 0, plus any kept on purpose  |

"Real" email means not blank and not `@padelobsters.internal`. From T₀,
native signups create unconfirmed accounts that only get a player row once
confirmed (DESIGN §2). The query lists abandoned ones rather than failing on
them.

The same query runs read-only against production after each release (§4.4)
and at the T₀ and cutover go/no-go points (§5).

---

## 5. Release runbook

Each step is done by the owner from `main` after merge. The coordinator posts
the checklist in the PR and verifies afterwards (§4.4).

**R0: Phase 0a.** Merge → `db push` → C verifies.

**R1: Phase 0b.** Clean prod-data rehearsal of #44 (§4.5) → merge → `db push`
→ apply the dashboard checklist (settings and the templates) → C runs the
integrity check against production → the owner sends themself a sign-in link
from production and checks the email (no code, "30 minutes").

**R2: dark backend.** Tell the 3 admins that invites now send an email instead
of showing a PIN. Merge 1/3 → `db push` → `functions deploy send-invite-email`
→ enable the Before User Created hook → run §4.3.

**T₀**

1. Go/no-go for T₀: every hard gate in §4.3 is green, the integrity check
   against production meets the T₀ column (§4.5), and the #13 timing rule
   holds. **Owner decision on Resend:** stay on the free plan (100 sends/day)
   with the watch below, or upgrade for the window. Resend's plans upgrade
   immediately, so a mid-window upgrade is also an option.
2. Set `PIN_SUNSET_DATE` (a commit on 3/3) → merge 2/3 then 3/3 → Vercel
   deploys.
3. Once the deploy is live, paste the code-first `magic_link.html` and its
   subject into the dashboard (D-14). Then run the T₀ production checks in
   §4.4.
4. An admin pastes the new FAQ into LobsterWayAdmin.
5. An admin sends the announcement email (BCC, club address) and the WhatsApp
   message (Appendix).
6. Watch the readiness panel and the auth logs daily (§4.4). Check Resend's
   daily usage on T₀ and on any tournament day. If it passes ~70 or GoTrue logs
   SMTP errors, upgrade Resend.

**Cutover go/no-go** (D-11, hard gates only):

- All 3 no-email players have a real email, or an admin has accepted the risk
  for each one by name.
- Code sign-in and signup worked in production during the window, and no
  auth-email delivery issue is open.
- The integrity check against production still meets the T₀ column.
- The date is ≥ 3 days before #13.

**Cutover.** Merge PR 4 → Vercel deploys the client → `functions deploy
verify-pin` (the stub) → WhatsApp "PINs retired" → 48h watch.

**Revoke (PR 5)** goes out after a clean watch: merge → `db push`.

**Phase 5 (PRs 8–10).** Each one: clean rehearsal → merge → the deploy order
in its PR description → C runs the integrity check against production.

### Rollback

| Stage   | Symptom                                     | Rollback                                                                                                                                                                                          |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R0/R1   | Migration error                             | No edits to applied files; write a forward-fix migration (CONTRIBUTING.md)                                                                                                                        |
| R1      | Template or setting wrong                   | Fix it in the dashboard, then match `config.toml` in a follow-up PR                                                                                                                               |
| R2      | Hook or trigger blocks or misfires          | Disable the hook in the dashboard. The old `self_signup_player` signup still serves the live client. Forward-fix the trigger                                                                      |
| T₀      | Sign-in UI broken                           | Vercel instant rollback to the pre-T₀ deployment, then re-paste `main`'s link-only `magic_link` template (D-14). PIN sign-in is untouched, so players get the old flow back. The backend can stay |
| Cutover | Players locked out at scale                 | Vercel rollback, plus redeploy the previous `verify-pin` from its last commit. No migration is involved (D-12), so it takes minutes                                                               |
| PR 5/6  | Problem found after the revoke or the drops | Forward-fix only, through review. That's why each one waits for a clean watch                                                                                                                     |
| PR 8    | Role missing or wrong in the UI             | Vercel rollback. The server side (RLS, token hook) is unchanged                                                                                                                                   |
| PR 9    | Admin email edit or invite fails            | Vercel rollback to the version that writes `players.email`, plus a forward-fix migration that restores the dropped sync trigger                                                                   |
| PR 10   | A deleted synthetic account is needed       | An admin adds the player's email, and PR 9's function creates a fresh account with the same id                                                                                                    |

---

## Appendix: announcement copy (admins send it by hand, D-10)

**Email** (BCC from the club address). It isn't personalized, so it points
players at the in-app card.

> **Subject: PINs are retiring on <date>: sign in with your email**
>
> Hi Lobsters,
>
> From **<date>**, PINs won't work in the Padel Lobsters app any more. Instead,
> enter your email and we'll send you a 6-digit code. Prefer a password? Set one
> under Account → Sign-in & security.
>
> Already signed in? You won't be logged out. Open the app and you'll see a card
> on Home showing the email your account uses. If it's wrong, tap "Change it",
> or reply here and we'll fix it.

**WhatsApp at T₀:**

> 🦞 PINs retire on <date>. From now on, sign in with your email: we'll send you
> a 6-digit code. Already signed in? Nothing to do. Check the card on Home to
> see which email your account uses.

**WhatsApp reminder (cutover − 3 days):**

> 🦞 Reminder: PINs stop working on <date>. Sign in with your email + code.
> Unsure which email you used? Message an admin.

**WhatsApp at cutover:**

> 🦞 PINs are retired. Sign in with your email and we'll send you a code. Stuck?
> Message an admin here.

**Optional:** mention it at #12 check-in on 18 Oct ("PINs are going away soon;
make sure we have your real email").
