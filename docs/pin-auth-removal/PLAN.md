# PIN sign-in retirement: implementation plan

This is the coordinator brief and the **single source of truth for status**.
Read it with [`DESIGN.md`](./DESIGN.md), which holds the evidence (F-1 to F-10),
the target design (§2) and the decisions (D-1 to D-13). The protocol from
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

---

## 1. Status

| ID  | Task                                                      | Owner | Depends on      | PR  | State |
| --- | --------------------------------------------------------- | ----- | --------------- | --- | ----- |
| T0a | Clear 44 orphan password hashes → `NULL`                  | C     | —               | 0a  | [ ]   |
| T0b | Identity backfill + patch `ensure_auth_user_for_player`   | W     | —               | 0b  | [ ]   |
| T0c | Auth settings: `config.toml` + dashboard; five templates  | C → O | —               | 0b  | [ ]   |
| T1  | Contract freeze (§3.1)                                    | C     | —               | —   | [ ]   |
| T2  | Backend: hook, trigger, invite/add RPCs, readiness RPC    | W     | T0b, T1         | 1/3 | [ ]   |
| T3  | `SignInForm`, `AuthConfirm`, gates, native signup         | W     | T1              | 2/3 | [ ]   |
| T4  | Account → Sign-in & security                              | W     | T1              | 2/3 | [ ]   |
| T5  | Comms: upgrade card, interstitial, readiness panel, copy  | W     | T1              | 3/3 | [ ]   |
| T6  | Verification, local and on preview against production     | C + O | T2–T5           | —   | [ ]   |
| T7  | Dark backend release (R2)                                 | O     | T2 merged, T0c  | —   | [ ]   |
| T8  | T₀ release and announcement (R3)                          | O     | T6, T7          | —   | [ ]   |
| T9  | Cutover PR: remove PIN client path, `verify-pin` 410 stub | W     | T8              | 4   | [ ]   |
| T10 | Revoke `verify_player_pin_v2` from anon (D-12)            | C     | T9 + 48h watch  | 5   | [ ]   |
| T11 | Phase 4 cleanup (DESIGN §3 Phase 4)                       | W     | T10 + ≥2 weeks  | 6   | [ ]   |
| T12 | Remove the "Used a PIN before?" explainer                 | W     | cutover + ~2 mo | 7   | [ ]   |

C = coordinator · W = worker (worktree) · O = owner.
States: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked.

**Log**

- 2026-10-15: The owner interview closed DESIGN's open questions (DESIGN.md
  "Owner answers"). D-8 to D-13 were recorded. Production check: passwordless
  users hold `encrypted_password = NULL` (96 of them), and 44 users have a hash
  set.

---

## 2. Schedule

Dates stay relative until tournament **#13** is scheduled. Then pin them here.

| Milestone                        | When                                       | Rule                                                                        |
| -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| R0: Phase 0a merged + pushed     | Week of 15 Oct                             | Invisible; may land before #12 (18 Oct)                                     |
| R1: Phase 0b merged + pushed     | From Wed 21 Oct                            | After #12 + 3 days; must be live **≥ 2 days before R2** so templates bed in |
| R2: dark backend (PR 1/3)        | ≥ 2 days before T₀                         | Lets T6's production signup test run before players see anything            |
| **T₀**: PRs 2/3 + 3/3 + announce | A Tue or Wed                               | T₀ ≤ #13 − 17 days                                                          |
| WhatsApp reminder                | Cutover − 3 days                           |                                                                             |
| **Cutover** (PR 4)               | T₀ + 14, a Tue or Wed                      | ≥ 3 days before #13; go/no-go in §5                                         |
| Revoke (PR 5)                    | Cutover + 2 days                           | After the 48h watch is clean                                                |
| Phase 4 cleanup (PR 6)           | ≥ Cutover + 14 days, once stub hits are ~0 | Not within 3 days of an event                                               |
| Explainer removal (PR 7)         | Cutover + ~2 months                        |                                                                             |

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
  settings table, except the hook, which ships with T2. Five templates:
  `magic_link` (restore `{{ .Token }}`), `confirmation`, `recovery`,
  `reauthentication`, `email_change`. Each shows the code first, then the
  `token_hash` link, and never `{{ .ConfirmationURL }}`. Locally:
  `supabase stop && supabase start`, then check all five in Mailpit with
  `enable_confirmations = true` temporarily on. Also produce a **dashboard
  checklist** in the PR description, one row per setting, for the owner to
  tick after merge. It includes checking Resend's daily cap against ≥150
  sends/day.

### 3.1 T1: contract freeze

The coordinator commits these before dispatching T2–T5, and workers don't
change them (matchmaking-v2 §2 freeze rule):

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
- **Migration timestamps** are reserved for each PR so the stack orders
  correctly.

### 3.2 PR 1/3: backend (T2), released dark

- Migration: the `before_user_created_hook` function and its grants (DESIGN §2
  table). Add it to `expected_function_grants.txt`.
- Migration: the confirmed-user trigger on `auth.users`.
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

---

## 4. Verification

### 4.1 Gates for every PR (the coordinator runs them before asking for review)

`format:check`, `lint`, `typecheck`, `test` and `build` (the same as CI), plus
`db:types:check`, `db:grants:check`, `npm run db:reset`, and every
`supabase/tests/*.sql` run as each file's header shows. For PRs 2–4, also run
`npm run test:e2e` locally. The PR description records the results.

### 4.2 Local manual matrix (Mailpit at `:54324`, before each PR is marked ready)

| Flow                                                                 | PR  |
| -------------------------------------------------------------------- | --- |
| Five templates render a code and a `token_hash` link                 | 0b  |
| Identity-less seeded user: request a code → verify → set a password  | 0b  |
| Native signup → code → `players` row; placeholder name rejected      | 1/3 |
| Admin invite → invite email recorded, no PIN anywhere                | 1/3 |
| Code sign-in on each of the three gate variants, staying on the page | 2/3 |
| Magic link → tap to confirm → back to the original path              | 2/3 |
| Password set, sign in, forgot → recovery → new password              | 2/3 |
| Signed-out transfer deep link → code → lands on the transfer         | 2/3 |
| Upgrade card variants; interstitial after a PIN sign-in              | 3/3 |
| A PIN call gets the 410 → explainer; no PIN UI left                  | 4   |

### 4.3 Real devices and inboxes, against production (after R2, before T₀)

Vercel previews point at the production project. **Confirm that before
relying on this.** After R2 the backend is live, so the PR 3/3 preview is a
full rehearsal.

| Check                                                               | Who                                                                                      | Gate for T₀ |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| Native signup with a `+alias` Gmail → `players` row (then clean up) | Owner                                                                                    | Hard        |
| Code sign-in + autofill, Android Gmail                              | Owner                                                                                    | Hard        |
| Desktop magic link + return path; password reset end to end         | Owner                                                                                    | Hard        |
| **iPhone home-screen install:** code entry + autofill               | **Recruit** an admin or regular with an iPhone                                           | Hard        |
| **Outlook/Hotmail:** the link survives Safe Links (tap to confirm)  | **Recruit** one of the ~19 Microsoft-mailbox players, or a throwaway outlook.com account | Soft        |
| Email change with double confirm                                    | Owner                                                                                    | Soft        |

The iPhone check is hard because it's the whole reason the code is the primary
sign-in (F-3). The Outlook check is soft because the code still works if a
scanner burns the link. Record who tested what in §1's log.

### 4.4 Production checks after each release (coordinator, read-only SQL and logs)

- **R0:** count of non-null `encrypted_password` = 0.
- **R1:** auth users with no identity = 0; the owner screenshots the auth
  settings page against the T0c checklist.
- **R2:** the hook is enabled (owner screenshot). The production test signup
  produced exactly one `players` row.
- **T₀ → cutover, daily:** new signups have player rows; PIN `pin_attempts`
  rows are trending down; auth logs show no 429s and no `otp_disabled` spikes.
- **Cutover + 48h:** `pin_retired` stub hits, auth error rates, and the
  WhatsApp help thread.

---

## 5. Release runbook

Each step is done by the owner from `main` after merge. The coordinator posts
the checklist in the PR and verifies afterwards (§4.4).

**R0: Phase 0a.** Merge → `db push` → C verifies.

**R1: Phase 0b.** Merge → `db push` → apply the dashboard checklist (settings
and the five templates) → C verifies → the owner sends themself a code from
production and checks the email.

**R2: dark backend.** Tell the 3 admins that invites now send an email instead
of showing a PIN. Merge 1/3 → `db push` → `functions deploy send-invite-email`
→ enable the Before User Created hook → run §4.3.

**T₀**

1. Go/no-go for T₀: every hard gate in §4.3 is green, and the #13 timing rule
   holds.
2. Set `PIN_SUNSET_DATE` (a commit on 3/3) → merge 2/3 then 3/3 → Vercel
   deploys.
3. An admin pastes the new FAQ into LobsterWayAdmin.
4. An admin sends the announcement email (BCC, club address) and the WhatsApp
   message (Appendix).
5. Watch the readiness panel and the auth logs daily (§4.4).

**Cutover go/no-go** (D-11, hard gates only):

- All 3 no-email players have a real email, or an admin has accepted the risk
  for each one by name.
- Code sign-in and signup worked in production during the window, and no
  auth-email delivery issue is open.
- The date is ≥ 3 days before #13.

**Cutover.** Merge PR 4 → Vercel deploys the client → `functions deploy
verify-pin` (the stub) → WhatsApp "PINs retired" → 48h watch.

**Revoke (PR 5)** goes out after a clean watch: merge → `db push`.

### Rollback

| Stage   | Symptom                                     | Rollback                                                                                                                            |
| ------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R0/R1   | Migration error                             | No edits to applied files; write a forward-fix migration (CONTRIBUTING.md)                                                          |
| R1      | Template or setting wrong                   | Fix it in the dashboard, then match `config.toml` in a follow-up PR                                                                 |
| R2      | Hook or trigger blocks or misfires          | Disable the hook in the dashboard. The old `self_signup_player` signup still serves the live client. Forward-fix the trigger        |
| T₀      | Sign-in UI broken                           | Vercel instant rollback to the pre-T₀ deployment. PIN sign-in is untouched, so players get the old flow back. The backend can stay  |
| Cutover | Players locked out at scale                 | Vercel rollback, plus redeploy the previous `verify-pin` from its last commit. No migration is involved (D-12), so it takes minutes |
| PR 5/6  | Problem found after the revoke or the drops | Forward-fix only, through review. That's why each one waits for a clean watch                                                       |

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
