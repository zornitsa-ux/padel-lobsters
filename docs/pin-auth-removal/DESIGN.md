# Retire PIN sign-in → email code / magic link + optional password

Status: **approved 2026-10-15**. Researched 2026-10-12. Builds on PR #38 (all
three of its migrations were applied in production as of 2026-10-12).

This is the design and evidence record. **The schedule, tasks, verification and
release steps are in [`PLAN.md`](./PLAN.md)**, which supersedes §3's timings.
In short, Phase 1 and Phase 2 merge into a ~2-week announced window (D-8).

## TL;DR

The PIN is already only a front door: `verify-pin` checks the PIN, then mints an
ordinary Supabase **magic-link** session for the player (`generate_link` →
`/verify`). Magic-link sign-in is already live, `players.id = auth.users.id`, and
role sync (`custom_access_token_hook` + `sync_my_role`) doesn't care how the
session was created. So this plan swaps the front door; it does not rebuild auth.

- **Primary sign-in: a 6-digit email code**, entered inside the app. The same email
  also carries a magic link for desktop. The code is the default because iOS
  home-screen installs open links in Safari, not in the installed app (F-3).
- **Optional password**, set from Account, with Supabase's built-in password
  security settings, recovery flow and re-authentication.
- **Signed-in players are never logged out by this change.** Sessions outlive the
  PIN (F-2). Most players only meet the new flow the next time they sign in.
- **Four-phase rollout:** groundwork → email-first with PIN demoted → announced
  sunset → cutover and cleanup. There's an in-app message for each group of
  affected players.
- **Two problems found in production should be fixed now, before anything else**
  (F-4, F-5). 44 auth users carry password hashes the app never set. These hashes
  are live credentials today on `/auth/v1/token?grant_type=password`.

---

## 1. What exists today

### Inventory to remove or rework

| Layer                       | PIN-specific pieces                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edge functions              | `verify-pin`, `send-pin-email` (Resend), `[functions.*] verify_jwt=false` in `config.toml`                                                                                                                                                                                                                                                         |
| DB functions                | `verify_player_pin_v2` (anon-granted), `admin_regenerate_pin`, `private.generate_unique_pin`, `private.send_pin_email`, `private.get_edge_service_role_key` (only used by `send_pin_email`), trigger fn `sync_player_pin_hash`                                                                                                                     |
| DB functions returning PINs | `self_signup_player` (returns `pin`, anon-granted), `admin_add_player`, `admin_invite_league_player` (returns PIN text)                                                                                                                                                                                                                            |
| Columns / tables            | `players.pin`, `players.pin_hash`, `players.pin_changes` (also in `players_public`), `private.admin_secrets.admin_pin_hash` (dead since the RBAC work), `pin_attempts` (see F-6: it's the general audit log, so **keep and rename it**)                                                                                                            |
| Vault                       | `edge_send_pin_service_role` secret                                                                                                                                                                                                                                                                                                                |
| Client: auth                | `api/auth.ts` (`loginWithPin`, `selfSignup` PIN shape), `hooks/useAuth.ts`, `context/useApp.ts` type, `lib/deviceId.ts` (only feeds PIN/signup rate limits)                                                                                                                                                                                        |
| Client: sign-in surfaces    | `VerificationGate` (PIN is the default mode), `ui/AuthGate.tsx` (`PinPrompt`, `usePinGate`: used by Merch, Shop, AdminTools, LobsterWayAdmin), `settings/AccountSection.tsx` + `Settings.tsx` (PIN field)                                                                                                                                          |
| Client: PIN display         | `SignupRequest` (PIN reveal screen), `community/PinRevealModal`, `PlayerDetailPage`/`PlayerProfile` (regenerate PIN, `pin_changes` chip), `league/ui/InvitePlayerModal` (shows PIN), `PlayerForm`, `LinkPlayerModal`, `Players.tsx`                                                                                                                |
| Copy only                   | `Dashboard.tsx` guest greeting, `TransferAccept.tsx`, `lobsterWayContent.ts` (FAQ "forgot my PIN"; transfer walkthrough "behind her PIN"), `wrong_pin` status strings in transfer RPCs + `Registration`/`Dashboard`/`TransferSpotModal`                                                                                                            |
| Docs / tests                | `SETUP.md` ("admin PIN 0000", stale), `ARCHITECTURE.md` §access control, `CONTRIBUTING.md`, `e2e/tournament-flow.spec.ts` (`signInAt` fills PIN), `scripts/test-public-access.sh`, `supabase/seed.sql` test PINs, `supabase/expected_function_grants.txt`, `dump-function-grants.sh` comment, `supabase/tests/self_signup.sql`, `admin_invite.sql` |

### Production snapshot (read-only queries, 2026-10-12)

|                                                                     | Count                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Active players                                                      | 120                                                                 |
| …signed in within the last 90 days                                  | 61                                                                  |
| …with a successful **PIN** login in the last 60 days                | 32 (39 PIN logins total)                                            |
| …with no real email (synthetic `@padelobsters.internal` auth email) | **3**                                                               |
| …never signed in                                                    | 12                                                                  |
| Placeholders (league shadow players)                                | 4                                                                   |
| Admins                                                              | 3                                                                   |
| Auth users with **no `auth.identities` row**                        | 31 (27 active, 10 signed in within 60 days)                         |
| Auth users with a **password hash set**                             | **44** (all created May 2026; none match the player's current PIN)  |
| Sessions created in the last 30 days                                | 43 (all `amr = otp`; PIN and magic link are indistinguishable here) |

### Findings that shape the plan

- **F-1. The session model doesn't change.** PIN, magic link, email code and
  password all end in the same GoTrue session for the same `auth.users` row.
  `custom_access_token_hook` (JWT claims) and `sync_my_role` (client-side
  `app_metadata`) already handle non-PIN sessions; `useAuth` already calls
  `syncMyRole()` on `SIGNED_IN` when the role is missing.
- **F-2. Existing sessions survive the cutover.** Refresh-token rotation is on and
  sessions aren't time-boxed. Removing `verify-pin` logs nobody out.
- **F-3. Magic links break the iOS home-screen app.** `index.html` sets
  `apple-mobile-web-app-capable`, so players who installed the app run it with
  storage separate from Safari. A tapped link signs them in _in Safari_, not in the
  app. They also lose context: the magic-link template hard-codes `next=/home`, so
  a WhatsApp transfer deep link (`/transfer?...`) is lost. A 6-digit code typed into
  the app avoids both problems, and iOS/Android autofill it from Mail via
  `autocomplete="one-time-code"`.
- **F-4. 44 unexplained password hashes (security; fix now).** These users were
  created in May 2026 by some since-replaced path. No app UI sets or uses
  passwords, yet password grant is always available on the email provider. These
  hashes are live credentials whose plaintext nobody on the team controls. They
  don't match current PINs but may match earlier ones. **Clear them in Phase 0**,
  before any password UI exists. Nothing in `src/` calls `signInWithPassword`, so
  clearing them breaks nothing.
- **F-5. 31 auth users were created by raw SQL.**
  `ensure_auth_user_for_player` does `insert into auth.users …` with no identity
  row. Verified locally on 2026-10-12: such a user _can_ request an email OTP,
  verify it, set a password and sign in with it. However, `app_metadata.providers`
  stays `[]`. Supabase discourages writing to the `auth` schema directly. Backfill
  the identities, and move user creation to the Admin API (Phase 0, Phase 4).
- **F-6. `pin_attempts` is the audit log, not just PIN attempts.** It also holds
  `signup`, `admin_action`, `player_pii_read` and `payment_reminder` rows, which
  feed `SecurityEventsPanel`. Rename it rather than drop it, following the
  device-trust D-7 precedent: audit history isn't tidied away when a feature is
  removed.
- **F-7. Rate limits will bite on tournament day.** Supabase limits auth email
  project-wide per hour: 30/h by default once custom SMTP is on. It also limits
  sign-ins and token verifications **per IP** per 5 minutes, and 24–32 players can
  share the venue Wi-Fi. A cutover that lands just before an event could lock
  people out. Raise the limits in Phase 0, and never cut over within 3 days of a
  tournament.
- **F-8. Hosted auth config isn't deployed from the repo.** Templates, rate limits,
  SMTP and password policy live in the dashboard; `config.toml` covers local only.
  The local stack is currently serving GoTrue's _default_ magic-link template
  ("Your sign-in link"), so it needs a `supabase stop && supabase start` to pick up
  `supabase/templates/`. Every auth setting below needs a dashboard checklist item
  and a matching `config.toml` change.
- **F-9. Account existence is already revealed.** `signInWithOtp` with
  `shouldCreateUser:false` returns `422 otp_disabled` for unknown emails at the API
  level, so a generic UI message gains little. The app keeps its helpful
  "we couldn't find that email" message (D-6).
- **F-10. Anonymous sign-ins are enabled locally but unused.** Nothing calls
  `signInAnonymously`. Disable them, in line with the Supabase security checklist:
  anonymous users carry the `authenticated` role.

---

## 2. Target design

### Sign-in (guest hits a protected page, or taps a gated action)

```
┌──────────────────────────────────┐
│              🦞                  │
│        Padel Lobsters            │
│  Sign in with your email         │
│                                  │
│  Email  [ you@example.com      ] │
│  [   Email me a sign-in code   ] │
│                                  │
│  ── or ──                        │
│  [   Sign in with password     ] │  ← expands a password field
│                                  │
│  New here?  Sign up              │
│  Used a PIN before?  ⓘ           │  ← explainer (Phase 1–3 + 2 months)
└──────────────────────────────────┘
        ↓ code sent
┌──────────────────────────────────┐
│  Check your inbox                │
│  We sent a 6-digit code to       │
│  ana@example.com                 │
│  Code  [ _ _ _ _ _ _ ]           │  ← autocomplete="one-time-code"
│  [ Sign in ]                     │
│  Or tap the link in the email.   │
│  Resend code (in 0:42) · Change email │
└──────────────────────────────────┘
```

- **Code:** `signInWithOtp({ email, options: { shouldCreateUser: false } })`, then
  `verifyOtp({ email, token, type: 'email' })`. The user stays on the page they
  were on, so deep links and in-progress actions (merch order, transfer accept)
  survive.
- **Link** (same email, desktop-friendly): keep the existing `token_hash` →
  `/auth/confirm` → `verifyOtp({ token_hash, type })` pattern. This is Supabase's
  recommended shape and avoids `{{ .ConfirmationURL }}`. Before sending, store the
  current path in `localStorage` so `AuthConfirm` can return there instead of
  `/home`. This only works on the same browser, which is acceptable because the
  code covers the cross-container case. `/auth/confirm` should show a **"Tap to
  finish signing in"** button rather than auto-verifying on load. Some mail
  scanners (Outlook Safe Links, Defender) execute JS, and an auto-verify burns the
  single-use token before the human clicks.
- **Password:** `signInWithPassword({ email, password })`. "Forgot password?" calls
  `resetPasswordForEmail(email, { redirectTo })`. That uses the **recovery**
  template → `/auth/confirm?type=recovery` → a "Set a new password" screen
  (`updateUser({ password })`). The screen also offers "Email me a code instead",
  which is often faster.
- **One sign-in component** replaces three PIN surfaces: `VerificationGate` (full
  screen), `AuthGate`'s `PinPrompt` (modal) and `AccountSection` (inline). Build it
  once as `features/auth/SignInForm` and mount it in all three places. This pays
  down the duplication that exists today.

### Sign-up (self-serve): use the native Supabase flow (D-2)

1. The form collects profile + email (unchanged UI, no PIN screen).
2. `signInWithOtp({ email, options: { shouldCreateUser: true, data: profile } })`.
   Profile fields ride in `user_metadata`. They're used **only** to seed the
   `players` row, never for authorization; `role` is never read from metadata.
3. A **`before_user_created` auth hook** (Postgres function) rejects:
   - names matching a placeholder → `"You've already been added to a Lobster team —
ask an admin to invite you."` (preserves PR #38's rule; see memory
     `project_signup_claim_fix`)
   - missing or oversized name, invalid level (moved from `self_signup_player`).
4. The player enters the code (same screen as sign-in).
5. A trigger on `auth.users` creates the `players` row from metadata **when the
   email becomes confirmed**: on insert if already confirmed, otherwise on update
   of `email_confirmed_at` from null. So only verified emails produce roster rows,
   which removes today's "anyone can register any address" gap.
6. The avatar upload stays post-sign-in, as today (the `File` is still in memory
   because the code is entered in-app).

If the email already has an account, GoTrue simply sends a sign-in code and
ignores `data`, so an existing member who mistakenly signs up just gets signed in.
`self_signup_player` and the per-device signup limit are replaced by Supabase's
rate limits, plus CAPTCHA if abuse appears.

> Fallback if the hook route hits a snag in testing: keep `self_signup_player`
> minus the PIN (return `player_id` only), then immediately call `signInWithOtp`.
> It's less clean (unverified rows exist) but a much smaller diff.

### Admin flows

- **Placeholder invite** (`admin_invite_league_player`): keep the identity check,
  email uniqueness and `active` flip. Drop PIN generation. Send an **invite email
  with no token in it**: "You've been added to <team> on Padel Lobsters. Sign in
  with `ana@example.com` at padelobsters.nl." The link goes to
  `/home?signin=1&email=ana%40example.com`, which opens the sign-in form
  pre-filled. Nothing in it expires, nothing in it is a credential, and the player
  requests their own code. `send-pin-email` becomes `send-invite-email` (same
  Resend wiring and Vault-secret pattern).
- **Admin add player:** same invite email, sent only if an email is present.
- **Regenerate PIN** disappears. Its replacement is **"Resend invite email"** plus,
  for the rare lost-inbox case, the existing admin email edit
  (`admin_update_player` → `players_email_sync` trigger → `auth.users.email`) after
  the admin verifies identity in person or on WhatsApp.
- **InvitePlayerModal** shows "Invite sent to …" instead of a PIN.

### Account → "Sign-in & security" (new section)

- **Email:** shows the current email; "Change" uses the existing
  `requestMyEmailChange` flow (double confirm stays on).
- **Password:** "Set a password" / "Change password" via `updateUser({ password })`.
  With **secure password change** on, a session older than 24h triggers
  `reauthenticate()`: a code is emailed through the _reauthentication_ template and
  passed as `nonce`. With **require current password** on (D-17), a session that
  signed in with a password must also send `current_password`. The form shows
  that field only for such sessions (the session's `amr` includes `password`)
  and maps `current_password_required` / `current_password_invalid`. Sessions
  from a code, a link or a recovery link don't need it, so setting a first
  password and resetting a forgotten one both work without it.
- **Password rules shown up front:** at least 10 characters, with a lowercase
  letter, an uppercase letter and a digit, and not found in a known breach.
  `weak_password` errors carry `reasons` (`length`, `characters`, `pwned`), and
  each one maps to a specific message.
- **Sign out of all devices:** `signOut({ scope: 'global' })`.
- **Admins:** suggest TOTP MFA as a follow-up (out of scope; noted in §7).

### Supabase settings (hosted dashboard **and** `config.toml`)

| Setting                                                     | Value                                                                        | Why                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email OTP length                                            | 6                                                                            | Supabase recommends ≥6                                                                                                                                                                                                                                                                                                                                                                                |
| Email OTP expiry                                            | 3600s (1 hour) (owner, D-17)                                                 | Supabase's default. The one setting also governs recovery and email-change links, and every template says "1 hour"                                                                                                                                                                                                                                                                                    |
| OTP resend interval (`max_frequency`)                       | 60s (default)                                                                | UI shows a countdown                                                                                                                                                                                                                                                                                                                                                                                  |
| `rate_limit.email_sent`                                     | 150/h                                                                        | F-7: announcement week + tournament day                                                                                                                                                                                                                                                                                                                                                               |
| `rate_limit.sign_in_sign_ups`                               | 150 per 5 min per IP                                                         | F-7: shared venue Wi-Fi                                                                                                                                                                                                                                                                                                                                                                               |
| `rate_limit.token_verifications`                            | 150 per 5 min per IP                                                         | F-7                                                                                                                                                                                                                                                                                                                                                                                                   |
| `minimum_password_length`                                   | 10                                                                           | Supabase: never < 8                                                                                                                                                                                                                                                                                                                                                                                   |
| `password_requirements`                                     | `lower_upper_letters_digits` (owner, D-17)                                   | Lowercase, uppercase and a digit, on top of the length and leaked-password checks                                                                                                                                                                                                                                                                                                                     |
| Leaked password protection ("check for password exposures") | On (owner confirmed, 2026-10-19)                                             | Pro plan                                                                                                                                                                                                                                                                                                                                                                                              |
| `[auth.email] secure_password_change`                       | `true`                                                                       | Re-auth for password change on sessions older than 24h                                                                                                                                                                                                                                                                                                                                                |
| Require current password when updating                      | On (owner, D-17)                                                             | Applies **only to sessions that signed in with a password** (verified locally on GoTrue v2.197.0, 2026-10-19). There's no `config.toml` key for it                                                                                                                                                                                                                                                    |
| `[auth.email] double_confirm_changes` (secure email change) | `true` (unchanged)                                                           | Both the old and new addresses confirm                                                                                                                                                                                                                                                                                                                                                                |
| Templates                                                   | `magic_link`, `confirmation`, `recovery`, `reauthentication`, `email_change` | All show the **code** (`{{ .Token }}`) prominently plus the `token_hash` link, and **no** `{{ .ConfirmationURL }}`. `magic_link` gains its code only with `SignInForm` (D-14), and `email_change` stays link-only (#44). `confirmation` matters because hosted projects have confirmations **on**, so a brand-new signup's OTP email may use it; verify in Mailpit with confirmations enabled locally |
| Redirect URLs                                               | prod origin `/**` only (no preview pattern; D-15)                            | `resetPasswordForEmail` `redirectTo` must be allowlisted                                                                                                                                                                                                                                                                                                                                              |
| `enable_anonymous_sign_ins`                                 | `false`                                                                      | F-10                                                                                                                                                                                                                                                                                                                                                                                                  |
| `enable_signup`                                             | `true` (unchanged)                                                           | Required for the native signup flow                                                                                                                                                                                                                                                                                                                                                                   |
| Before User Created hook                                    | `pg-functions://postgres/public/before_user_created_hook`                    | Grant to `supabase_auth_admin`; revoke from `anon`, `authenticated`, `public`, and add to `expected_function_grants.txt`                                                                                                                                                                                                                                                                              |
| Custom SMTP                                                 | Resend, **free plan: 100 sends/day** (confirmed 2026-10-19)                  | Shared with the reminder functions. Peak observed demand is ~13 sign-ins/day; PLAN §5 has the watch and the upgrade trigger                                                                                                                                                                                                                                                                           |
| CAPTCHA (Turnstile)                                         | Off; switch on if signup spam appears                                        | Supabase's documented control for open signup                                                                                                                                                                                                                                                                                                                                                         |

---

## 3. Rollout phases

T₀ = Phase 1 ship date. Pick dates from the tournament calendar: no phase boundary
within 3 days of an event (F-7).

### Phase 0: Groundwork (invisible to players)

Ship as one PR. Migrations go through review → merge → `db push` from `main`, per
CLAUDE.md.

1. **Migration:** clear the 44 orphan password hashes (F-4). Set them to whatever
   value passwordless rows hold today (`''` vs `NULL`: check first), scoped to
   users with no app-set password. That's all of them today, because there's no
   password UI yet.
2. **Migration:** backfill `auth.identities` for the 31 identity-less users (F-5):
   `provider = 'email'`, `provider_id = user_id::text`,
   `identity_data = {sub, email, email_verified: true}`. Copy the shape from an
   existing GoTrue-created row. Also patch `ensure_auth_user_for_player` to insert
   the identity alongside the user until Phase 4 replaces it.
3. Supabase settings from §2 (dashboard + `config.toml`), except the hook, which
   ships with Phase 1.
4. Email templates: code + link versions of `confirmation`, `recovery` and
   `reauthentication`. Nothing players can do yet sends them. `magic_link` stays
   link-only (D-14). Restart the local stack and check each one in Mailpit.

### Phase 1: Email first, PIN demoted (T₀)

Players now see email as the way in. PIN still works but is visibly secondary, and
no new PINs are created.

- New `SignInForm` everywhere (§2). The PIN lives behind a small "Sign in with PIN
  (retiring soon)" link on the sign-in screen only.
- Restore `{{ .Token }}` in `magic_link.html`, pasted into the dashboard right
  after the client deploys (D-14). Its removal note ("users typed it into the
  PIN field") stops applying once the code has its own input.
- Native signup + `before_user_created` hook + confirmed-user trigger. The PIN
  reveal screen is deleted.
- Invite, add-player and regenerate changes (§2); `send-invite-email` deployed.
- Account → Sign-in & security.
- **"Upgrade your sign-in" card** for signed-in players: once per player, on Home,
  dismissible, and re-shown in Phase 2 to anyone who dismissed it.

  > **Signing in is getting easier 🦞**
  > PINs are retiring. Next time you sign in, just use your email: we'll send you
  > a code.
  > Your email: **ana@example.com** [Not right? Change it]
  > [Set a password (optional)] [Got it]

  If the auth email is synthetic (`@padelobsters.internal`, 3 players), the card
  becomes **"Add your email so you can keep signing in"** with an email field
  (uses the existing confirmed email-change flow).

- **Admin readiness panel** (Admin tools), aggregates only:
  - players with no real email (named, since admins must contact them);
  - players who signed in with a PIN in the last 14 days (from `pin_attempts`
    `player` rows). These are the people to nudge;
  - count with a password set.
- FAQ rewrite in `lobsterWayContent.ts` (and the DB `lobster_way_content` copy):
  replace "forgot my PIN" with "How do I sign in?" / "I don't get the email" / "Do
  I need a password?". Fix "behind her PIN" in the transfer walkthrough.
- Copy updates: Dashboard guest greeting, `SignInBanner` default text,
  `TransferAccept` ("sign in with Kim's email").

### Phase 2: Announced sunset (T₀ → T₀ + ~4 weeks, covering at least one tournament)

- **Announcement email** to all active players with a real email (Resend, from the
  club address, not an auth email). Draft:
  > **Subject: Your PIN is retiring — sign in with your email instead**
  > Hi Ana,
  > From **<cutover date>**, PINs won't work in the Padel Lobsters app any more.
  > Instead, enter your email and we'll send you a 6-digit code. Prefer a
  > password? You can set one under Account → Sign-in & security.
  > Already signed in? You won't be logged out; nothing to do right now.
  > Your sign-in email is **ana@example.com**. If that's wrong, reply to this
  > email and we'll fix it.
- **WhatsApp group message**, the same content in 3 lines, posted at T₀ and again
  one week before cutover.
- **Interstitial after a successful PIN sign-in** (`verify-pin` still works):
  > **PINs stop working on <date>**
  > Next time, sign in with **ana@example.com**; we'll email you a code.
  > [Set a password now] [Got it]
- The PIN link on the sign-in screen gains the date: "Sign in with PIN (until
  <date>)".
- Admins work the readiness panel: contact the 3 no-email players and the 4
  placeholders, and nudge recent PIN users at the next tournament check-in.

### Phase 3: Cutover (a quiet weekday, not within 3 days of an event)

Order matters: client first, then the server.

1. Deploy the client with the PIN path removed. The sign-in screen keeps a **"Used
   a PIN before?"** explainer for ~2 months:
   > PINs have retired. Enter the email you use for Padel Lobsters and we'll send
   > you a code. Don't know which email that is, or lost access to it? Message an
   > admin on WhatsApp and we'll sort it out.
2. Replace `verify-pin` with a stub returning `410 { error: 'pin_retired' }`, which
   any stale client maps to the explainer. Deploy it from `main`.
3. Migration: `revoke execute on verify_player_pin_v2 from anon`. Keep the function
   body until Phase 4 so the 410 stub stays the only behavior.
4. Watch for 48h: auth logs (`otp_disabled` spikes mean people are typing unknown
   emails), `pin_retired` hits on the stub, and the WhatsApp help thread.

### Phase 4: Cleanup (≥2 weeks after cutover, once stub hits are ~0)

One PR, one migration, with the PR description stating the deploy order
(functions first, per CONTRIBUTING.md):

- Drop: `verify_player_pin_v2`, `admin_regenerate_pin`, `private.generate_unique_pin`,
  `private.send_pin_email`, `sync_player_pin_hash` + `trg_sync_player_pin_hash`,
  `self_signup_player` (if D-2 shipped), `private.admin_secrets` (or just
  `admin_pin_hash`), and the `players.pin`, `pin_hash`, `pin_changes` columns. Rebuild
  `players_public` without `pin_changes`.
- Delete the `verify-pin` and `send-pin-email` edge functions and their
  `config.toml` blocks. Remove the `edge_send_pin_service_role` Vault secret
  (dashboard).
- Rename `pin_attempts` → `security_events`, and `attempt_kind` values stay as they
  are (historical rows untouched, per F-6 / device-trust D-7). Update
  `api/securityEvents.ts` and `SecurityEventsPanel` copy ("Every sign-in attempt
  and contact-details read is logged").
- Rename `wrong_pin` statuses in the transfer RPCs to `not_signed_in` (client maps
  updated in the same PR).
- Delete `lib/deviceId.ts` if nothing else reads it.
- Docs: `ARCHITECTURE.md` (auth section, the `VerificationGate` description),
  `SETUP.md` (local sign-in = email code via Mailpit at `:54324`, or a seeded
  password), `CONTRIBUTING.md` (drop the verify-pin anecdote or keep it as history),
  `seed.sql` (seed test passwords instead of PINs), `test-public-access.sh` (drop the
  `players.pin` case), `expected_function_grants.txt`.
- Remove the "Used a PIN before?" explainer ~2 months after cutover.

### Phase 5: Native auth cleanup (after Phase 4; D-16)

After Phase 4 no PIN code is left, but four pieces of custom code still write
straight into Supabase's `auth` schema. That's what caused F-5 and the stale
identity emails #44 had to repair:

| Custom piece today                                                                                     | Why it exists                                              | Supabase's intended way                                                                                                              |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ensure_auth_user_for_player`: raw `insert into auth.users` for **every** player                       | `verify-pin` needed an auth account to mint a session      | Create the account only when a real email exists, via `auth.admin.createUser` from an edge function                                  |
| `players_email_sync` + `private.sync_email_identity`: raw writes to `auth.users` and `auth.identities` | Admin email edits are made on `players.email`              | `auth.users.email` is the only source of truth. Admin edits go through `auth.admin.updateUserById`, which keeps the identity in step |
| `sync_my_role`: raw write to `auth.users.raw_app_meta_data`                                            | The client reads the role from `session.user.app_metadata` | The client reads the role from the token's claims (`supabase.auth.getClaims()`), which `custom_access_token_hook` already sets       |
| 13 synthetic `@padelobsters.internal` accounts (3 active players, 10 placeholders)                     | Every player needed an account for the PIN                 | No account without a reachable email. A player row without an account is just a profile                                              |

The changes ship as three PRs (PLAN §3.8):

- **5a, client only.** The role is read from the token claims, through one
  helper that replaces 8 inline copies.
- **5b.** The `admin-set-player-email` edge function creates or updates the
  player's account through the Admin API. It's used by admin email edits,
  add player and placeholder invites. Drop `ensure_auth_user_for_player`, the
  `players_email_sync` trigger and `private.sync_email_identity`. Keep the
  auth → players email trigger: a trigger on `auth.users` that maintains a
  profile table is Supabase's documented pattern.
- **5c.** Drop `sync_my_role` and the retired device-claim stripping in the
  token hook. A migration deletes the synthetic accounts that have no recent
  session.

**Data access doesn't change.** RLS uses `auth.uid()` (the player id, which
never changes) and `auth.jwt()`'s `app_metadata.role` (set by the token hook
from `players.role`). Nothing reads `amr`/`aal`, so the sign-in method doesn't
matter. A player row without an auth account can't sign in, and no policy
depends on one existing.

**What remains custom after Phase 5** is only Supabase's own extension points:
`custom_access_token_hook` (role claims), the `before_user_created` hook, the
auth → players triggers (profile creation and the email mirror), and
`send-invite-email`. A tokenless invite (D-3) isn't something GoTrue sends:
`inviteUserByEmail` carries a token that expires.

---

## 4. Who needs what

| Group (approx. size)                                               | What happens to them                                                  | What they do                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Signed in on their main device, real email (most of the 61 active) | Nothing breaks; they see the upgrade card                             | Optionally set a password; otherwise nothing until their next sign-in                                   |
| Recent PIN users (32)                                              | Phase 2 interstitial after each PIN sign-in                           | Use email next time; admins nudge stragglers via the readiness panel                                    |
| No real email (3)                                                  | Upgrade card asks for an email; listed by name on the readiness panel | Add an email in-app, or an admin adds it after a WhatsApp check                                         |
| Placeholders (4)                                                   | Invite email with no token                                            | Sign in with the invited email                                                                          |
| Never signed in (12)                                               | First sign-in is the email code                                       | Nothing special                                                                                         |
| Lost access to their email                                         | Can't receive a code                                                  | Message an admin; the admin verifies identity and edits the email (existing trigger syncs `auth.users`) |
| Admins (3)                                                         | Same as players                                                       | Set a password; TOTP MFA as a follow-up                                                                 |
| iOS home-screen users                                              | Code entry works inside the installed app                             | Use the code, not the link                                                                              |

---

## 5. Testing

- **Local setup:** restart the stack so templates load. Turn
  `enable_confirmations = true` on temporarily to mirror hosted behavior for
  signup emails.
- **SQL tests** (`supabase/tests/`):
  - the hook rejects placeholder names and bad payloads, and accepts valid ones;
  - the confirmed-user trigger creates exactly one `players` row (insert-confirmed
    and update-to-confirmed paths) and is idempotent with
    `ensure_auth_user_for_player`;
  - the invite RPC no longer returns or stores a PIN;
  - identity backfill shape;
  - orphan-password cleanup leaves no non-empty hashes;
  - grants (`npm run db:grants:check`).
- **Unit/component tests:** `SignInForm` states (email → code → success; unknown
  email; rate-limited; wrong/expired code; password; forgot password), the upgrade
  card variants, and the `AuthConfirm` tap-to-confirm + return-path behavior.
- **e2e:** `signInAt` signs in with a seeded password; one spec covers the code
  flow by reading the OTP from Mailpit's API.
- **Prod-data rehearsal** (PLAN §4.5): production's `public` and `auth` data
  are loaded into the local stack, then the pending migrations are applied.
  Every account with a real email signs in with a code, and its RLS-protected
  reads are compared with a baseline taken before the migrations. An integrity
  query checks that accounts, identities and emails line up. This gates every
  PR with a migration or an auth-flow change.
- **Manual before Phase 1, on the local stack** (PLAN §4.3; no Vercel previews,
  D-15):
  - iPhone home-screen install: code entry and autofill;
  - Gmail on Android;
  - password reset end to end;
  - email change with double confirm;
  - transfer deep link signed out → sign in by code → lands back on the transfer.
- **Production, right after T₀:** an Outlook/Hotmail inbox, to check that the link
  survives Safe Links. A Microsoft scanner can't reach a local link, so this
  can't be tested locally.

## 6. Risks

| Risk                                                                 | Mitigation                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth emails delayed or in spam on tournament day                     | Raised rate limits; cutover never near events; passwords as a no-email path; SPF/DKIM/DMARC checked on the sending domain; Resend usage watched on T₀ and tournament days, with an upgrade if it passes ~70/day |
| Venue Wi-Fi hits per-IP limits                                       | Per-IP limits raised to 150/5 min (F-7)                                                                                                                                                                         |
| Players don't know which email they registered with                  | Upgrade card and announcement email show it; admin readiness panel; WhatsApp help thread                                                                                                                        |
| Hook or trigger bug blocks all signups                               | SQL tests; Phase 1 can roll back to the fallback RPC flow without touching sign-in                                                                                                                              |
| Hosted config drifts from `config.toml`                              | Dashboard checklist in the PR description; screenshot or Management API read of `/config/auth` after applying                                                                                                   |
| Someone burns a single-use link via mail-scanner prefetch            | Tap-to-confirm on `/auth/confirm`, and the code as primary                                                                                                                                                      |
| Production data on a dev machine (rehearsal)                         | Snapshot outside the repo, deleted after merge; Vault never copied, so DB functions that call production edge functions fail closed; real SMTP refused while a snapshot is loaded; PRs carry counts only        |
| Local stack differs from hosted (GoTrue version, dashboard settings) | Auth schema versions compared before each rehearsal; dashboard settings covered by the checklist and the post-release checks                                                                                    |

## 7. Decisions

D-1 to D-7 were proposed on 2026-10-12. On 2026-10-15 the owner explicitly
confirmed D-2 and Pro-plan availability (D-7). The others were accepted without
change. D-8 to D-13 come from the 2026-10-15 interview.

- **D-1. The code is primary, the link is secondary.** The installed iOS app (F-3)
  and deep-link preservation decide it.
- **D-2. Native Supabase signup with a `before_user_created` hook** replaces the
  anon-callable `self_signup_player` RPC. Only verified emails create players, and
  it uses the documented Supabase pattern. Fallback described in §2.
- **D-3. Invite emails contain no credentials or tokens.** They don't expire, and a
  forwarded invite grants nothing.
- **D-4. Clear the orphan password hashes now (Phase 0), independent of the rest.**
- **D-5. Rename `pin_attempts`; don't drop it.** It's the audit log (F-6).
- **D-6. Keep the "we couldn't find that email" message.** The API already reveals
  existence (F-9), and typos are the more common real problem for a 120-player club.
- **D-7. The password is optional, minimum 10 characters, with leaked-password
  protection and secure password change.** ~~No composition rules.~~
  Superseded in part by D-17.
- **Out of scope / follow-ups:** TOTP MFA for admins; passkeys (Supabase supports
  them now and they'd suit phone-first players, but they're a separate project);
  Google sign-in.

- **D-8. A short sunset, announced on day one.** Phases 1 and 2 merge. From T₀
  the PIN link shows the cutover date, the post-PIN interstitial is live, and
  the announcement goes out. Cutover is at T₀ + ~14 days, before tournament #13.
  No tournament falls inside the window, so there's no in-person check-in nudge.
- **D-9. Clear the orphan hashes in a standalone PR now** (Phase 0a), ahead of
  the rest of Phase 0. Passwordless users hold `encrypted_password = NULL`
  (96 users on 2026-10-15; no `''`), so the 44 are set to `NULL`.
- **D-10. Admins send the announcement by hand:** a BCC email from the club
  address plus WhatsApp. The email isn't personalized, so the in-app upgrade
  card is the only place a player sees their sign-in email. The card must ship
  at T₀.
- **D-11. Cutover go/no-go uses hard gates only** (PLAN.md §5). Players still
  using their PIN don't block it: they can sign in with their email.
- **D-12. The `verify_player_pin_v2` revoke ships separately, after the 48h
  watch.** The cutover PR has no migration, so rolling back is just a function
  redeploy, with no review cycle.
- **D-13. The Phase 1 backend ships dark before T₀.** It's additive: the hook
  only affects GoTrue-created users, `self_signup_player` stays, and the
  invite/add RPCs keep their return shape with `pin: null`. That keeps T₀ a
  client-only release. The hook and the invite emails also run in production
  for at least 2 days before players see the new UI.
- **D-14. The sign-in code ships with `SignInForm`, not in Phase 0.** A code in
  the magic-link email with no field to type it into gets typed into the PIN
  field (why #9 removed it). `magic_link` stays link-only until T₀; at T₀ the
  client deploys first and the code-first template is pasted after, so the
  link keeps working in between. Code checks before T₀ run on the local stack
  (D-15). The production sign-in code is checked right after T₀
  (2026-10-16).
- **D-15. All testing is local, and nothing is tested on a Vercel preview**
  (owner, 2026-10-16). Production data is synced into the local stack (PLAN
  §4.5), so migrations and sign-in are rehearsed on real accounts. Real-device
  checks use the local stack over the LAN (PLAN §4.3). Production only gets
  the release steps and the checks right after them. As a result, the
  dashboard's redirect allow-list needs only the production origin.
- **D-16. Phase 5 removes every direct write to the `auth` schema**
  (owner, 2026-10-16: "remove as much of the custom logic as we can").
  `auth.users` owns the sign-in email, and account changes go through the
  Admin API. The client reads the role from token claims. No auth account
  exists without a reachable email. This preserves data access because RLS
  keys only on `auth.uid()` and the hook-set role claim.

- **D-17. Auth settings as applied at R1** (owner, 2026-10-19). These
  supersede D-7's "no composition rules" and the 30-minute OTP expiry:
  - secure email change and secure password change: on;
  - require current password when updating: on (password sessions only);
  - check for password exposures (leaked-password protection): on;
  - minimum password length 10, and it must contain lowercase, uppercase and
    digits;
  - email OTP: 6 digits, expiring after **3600 s (1 hour)**. That also covers
    recovery and email-change links, so every template says "1 hour".

  `config.toml` and the templates follow in a PR after #44, because #44
  shipped 1800 s, no composition rules and "30 minutes".

## Owner answers (2026-10-15)

1. Phase 2 length: **~2 weeks**, cutting over before #13. #13 isn't scheduled
   yet, so dates are relative until it is (PLAN.md §2).
2. **Native signup (D-2) approved.**
3. **Pro plan, and hosted auth mail already goes through Resend SMTP.**
   Leaked-password protection stays in. Resend's daily cap is still to be
   checked (task T0c).
4. **Admins send the email and the WhatsApp messages by hand** (D-10).
5. The build follows the matchmaking-v2 workflow: a coordinator plus workers in
   worktrees, with Phase 1 as 3 stacked PRs. The owner reviews, merges and does
   every production step.
6. Owner test devices: Android + Gmail, and a desktop browser. **iPhone
   home-screen and Outlook testing need a recruited tester** (PLAN.md §4.3).
