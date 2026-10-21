# PIN sign-in retirement: frozen contracts (T1)

Frozen on 2026-10-19 by the coordinator, before T2–T5 and T14 are dispatched.
Workers build to these and don't change them. A worker who hits a problem with
a contract **stops and reports**; only the coordinator changes this file, and
every change gets a dated line in PLAN §1's log (matchmaking-v2 PLAN §2 freeze
rule). DESIGN §2 is the behaviour; this file is the interfaces.

Contents: C-1 migration timestamps · C-2 signup metadata · C-3 the hook ·
C-4 the confirmed-user trigger · C-5 the admin RPCs · C-6 the invite email ·
C-7 readiness · C-8 `SignInForm` · C-9 return path and `AuthConfirm` ·
C-10 the `signin` deep link · C-11 the sunset date · C-12 the role source
and the session check.

---

## C-1. Migration timestamps (PR 1/3, T2)

The only PR in the stack with migrations. Each file holds one concern, in this
order:

| Timestamp        | File                                 | Contents                                                                                |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| `20261020120000` | `_players_email_blank_to_null.sql`   | `players.email` `''`/blank → `NULL`, then `check (email is null or btrim(email) <> '')` |
| `20261020130000` | `_before_user_created_hook.sql`      | C-3                                                                                     |
| `20261020140000` | `_confirmed_user_creates_player.sql` | C-4                                                                                     |
| `20261020150000` | `_invite_email_without_pin.sql`      | C-5 and C-6's `private.send_invite_email`                                               |
| `20261020160000` | `_admin_auth_readiness.sql`          | C-7                                                                                     |

PRs 2/3 and 4 have no migrations. PR 3/3 has one, redefining C-7
(coordinator, 2026-10-21). PR 3/3 and PR 5 onwards take a timestamp at build
time, later than every migration on `main`.

## C-2. Signup metadata (`user_metadata`)

`SignupRequest` calls
`signInWithOtp({ email, options: { shouldCreateUser: true, data, emailRedirectTo } })`.
`data` has exactly these keys. Every value is a string, as
`self_signup_player`'s payload is today, and absent keys mean `''`:

`name`, `phone`, `playtomic_level`, `playtomic_username`, `gender`,
`is_left_handed` (`'true'`/`'false'`), `country`, `birthday` (`YYYY-MM-DD` or
`''`), `preferred_position`, `tagline_label`, `notes`.

- No `email` key: the email is `auth.users.email`.
- No `avatar_url` key: the avatar uploads after sign-in, as today.
- **Nothing in metadata is ever read for authorization.** `role` lives in
  `app_metadata` only.

## C-3. `public.before_user_created_hook(event jsonb) returns jsonb`

- **Grants:** execute to `supabase_auth_admin` only; revoked from `public`,
  `anon` and `authenticated`. `expected_function_grants.txt` only lists `anon`
  and `authenticated` grants, so the hook's absence there is the check; T2's
  SQL test asserts its ACL directly.
- **`config.toml`:**
  `[auth.hook.before_user_created] enabled = true, uri = "pg-functions://postgres/public/before_user_created_hook"`.
- **Input:** it reads `event->'user'->'user_metadata'` (C-2).
- **Normalisation:** it uses the same rules as `self_signup_player`
  (`20261012120000`). The name is trimmed and internal whitespace collapsed.
  The level is trimmed with `,` → `.`; `''` means 0, and anything else must
  match `^[0-9]+(\.[0-9]+)?$` (ASCII digits only, so the trigger's cast can't
  fail on a digit the hook accepted).
- **Accept:** it returns `'{}'::jsonb`.
- **Reject:** it returns
  `jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', <msg>))`.
  It checks in this order and returns the first match:

| Rule                                                                     | `message` (exact, including the typographic apostrophes and dash)           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| The normalised name is empty                                             | `Please enter your name.`                                                   |
| The normalised name is longer than 100 characters                        | `Your name can be at most 100 characters.`                                  |
| The level fails the pattern                                              | `Enter your Playtomic level as a number, like 2.5.`                         |
| The name matches a `placeholder` player (same match as `20261012120000`) | `You’ve already been added to a Lobster team — ask an admin to invite you.` |

- **Client mapping (T3):** `src/features/auth/signupErrors.ts` exports these
  four strings as `SIGNUP_HOOK_MESSAGES`. When `signInWithOtp` fails with
  `status === 400` and a `message` that equals one of them, the form shows it
  next to the field it names (name, name, level, name). Every other error gets
  the generic copy.
- **T2 checks on local GoTrue** that the client receives exactly
  `status: 400` and the message unchanged, and puts the observed `error.code`
  in the PR. If GoTrue rewrites either one, T2 stops and reports. The mapping
  key then changes here, not in the worker's code.
- **Out of scope for the hook:** email format and uniqueness (GoTrue owns
  them), and rate limits (Supabase's own).
- **Note for T16 (PR 9):** `auth.admin.createUser` may run this hook too. T16
  checks this, and either sends metadata that passes or the coordinator adds
  a pass-through rule here first.

## C-4. Confirmed-user trigger on `auth.users`

- **Function:** `private.create_player_for_confirmed_user()`, `security
definer`, `search_path` `pg_catalog, public`.
- **Triggers:** `after insert` (when `new.email_confirmed_at is not null`) and
  `after update of email_confirmed_at` (when `old.email_confirmed_at is null
and new.email_confirmed_at is not null`). Both are `for each row`.
- **Effect:** it inserts one `players` row with `id = new.id`,
  `email = lower(new.email)`, `status = 'active'`, and the C-2 fields parsed
  the way `self_signup_player` parses them (`adjustment` 0,
  `adjusted_level` = level, `pin` and `pin_hash` NULL). It ends with
  `on conflict (id) do nothing`.
- **It skips a user with no usable name or email** (created outside signup),
  or **whose email another player already holds** (a `unique_violation`),
  rather than failing the confirmation. The integrity check reports such a
  user as a confirmed account without a player.
- **Idempotent with the reverse path.** `ensure_auth_user_for_player` (a
  `players` insert → raw `auth.users` insert) already sets
  `email_confirmed_at`, and the player row exists by then. So this trigger
  no-ops on those users, and it never runs for synthetic emails.
- **Its own insert fires `ensure_auth_user_for_player`.** That function
  no-ops on `on conflict (id)`. T2's SQL test covers this loop explicitly.
- **It doesn't write `pin_attempts`.** The rows it creates are counted by
  `auth.users.created_at`.

## C-5. Admin RPCs

| RPC                                                                               | Contract                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin_invite_league_player(input_player_id uuid, input_email text) returns text` | **Signature and checks unchanged.** No PIN is generated or stored, and it **returns `NULL`** (D-13; the current client already hides a null PIN). It calls `private.send_invite_email(input_player_id, 'league_invite')`, and keeps the `pin_attempts` `admin_action` row.                                                                                                              |
| `admin_add_player(input_payload jsonb) returns setof players`                     | **Signature unchanged.** No PIN: the row's `pin` and `pin_hash` are `NULL`. A blank email is stored as `NULL` (the C-1 check). A malformed one raises `22023` `invalid email`. With an email, it calls `send_invite_email(id, 'added')`.                                                                                                                                                |
| `admin_resend_invite(input_player_id uuid) returns text`                          | **New.** `require_admin()`. It returns the address it mailed. It raises `22023` with `player not found`, with `player is a placeholder` (they need the invite flow), with `player has no email` (also raised for a synthetic auth email), and with `invalid email` for a malformed address. It calls `send_invite_email(id, 'resend')` and writes an `admin_action` `pin_attempts` row. |
| `admin_regenerate_pin(uuid)`                                                      | **Unchanged until Phase 4 (PR 6).** The T₀ client stops calling it.                                                                                                                                                                                                                                                                                                                     |
| `self_signup_player(...)`                                                         | **Unchanged until Phase 4.** The pre-T₀ client still uses it, and D-13 needs it to keep working dark.                                                                                                                                                                                                                                                                                   |

## C-6. Invite email

**`private.send_invite_email(input_player_id uuid, input_kind text) returns bigint`**

This is a copy of `private.send_pin_email`: the same Vault secret
(`edge_send_pin_service_role` through `private.get_edge_service_role_key()`),
the same production URL pattern, the same 5 s timeout, and the same silent
`NULL` return for a missing or malformed email. It's revoked from `public`,
`anon` and `authenticated`.

- `input_kind`: `'league_invite' | 'added' | 'resend'`. Any other value raises.
- It also returns `NULL` for a synthetic (`@padelobsters.internal`) address.

**Edge function `send-invite-email`**, in `config.toml` with
`[functions.send-invite-email] verify_jwt = false`.

It's authenticated like `send-pin-email`, using the `EDGE_SHARED_SECRET`
bearer. The POST body is:

```ts
interface InvitePayload {
  player_id: string // uuid, for logging only
  email: string
  name: string // first name extracted, as send-pin-email does
  kind: 'league_invite' | 'added' | 'resend'
  team_name: string | null // league_invite only: the player's team in the most recently created league that has them on a team, else null
}
```

The body is the full message, **so the function never reads the database.**
It's the same shape as `send-pin-email`, minus `pin`, plus `team_name`. This
replaces PLAN §3.1's `{ player_id, kind }` (coordinator, 2026-10-19).

Responses are the same as `send-pin-email`'s: `200 { ok, resend_id }`,
`4xx { ok: false, error }`, `401`, and `502 resend_failed`.

**What the email contains:**

- No token, code, PIN or anything else that works as a credential.
- One button, linking to `${APP_URL}/home?signin=1&email=<encodeURIComponent(email)>`
  (C-10).
- **Copy that works before T₀ too** (R2 runs dark against the old client). It
  says "sign in with your email address `<email>`" and **doesn't mention a
  code**, because the pre-T₀ form only sends a link.

## C-7. Readiness RPC

**`admin_auth_readiness() returns jsonb`**: `security definer`,
`require_admin()`, `stable`. It's granted to `authenticated` only, and added to
the grants file.

**Redefined 2026-10-21 (owner); PR 3/3's migration ships it.** #48's version
returns `password_count`, which is dropped: passwords are optional, and from
T₀ GoTrue's random hash for code signups makes the count meaningless. The
T₀ client never reads it.

```ts
interface AuthReadiness {
  no_email: { id: string; name: string }[] // active players whose auth email is synthetic; ordered by name
  recent_pin_users: { id: string; name: string; last_pin_at: string }[] // active players whose latest sign-in was a PIN, with that PIN in the last 14 days; newest first
  switched_count: number // active players whose latest sign-in was by email
  still_pin_count: number // active players whose latest sign-in was a PIN, at any time
}
```

- "Active" means `coalesce(status, 'active') = 'active'`, so placeholders
  aren't in `no_email`.
- **A player's latest sign-in** is `auth.users.last_sign_in_at`. It **was a
  PIN** when the player's latest succeeded `'player'` `pin_attempts` row is
  no more than 5 minutes before it. `verify-pin` writes that row seconds
  before it mints the session through a magic link, so session `amr` can't
  tell PIN from email. Otherwise it **was by email** (code, link or
  password). A player with no `last_sign_in_at` is in neither count.
- "No more than 5 minutes before" means `pin_at <= last_sign_in_at` and
  `last_sign_in_at - pin_at <= 5 minutes`. A succeeded PIN row **after**
  `last_sign_in_at` (a session that was never minted) doesn't count as a PIN
  sign-in.
- **Checked 2026-10-21** (PLAN §1 log): on local GoTrue v2.197.0 a token
  refresh doesn't move `last_sign_in_at`, and the PIN row comes 0.06–0.07 s
  before the sign-in. In production every gap is between 0 and 7.7 s, and
  none is negative.
- **There are no other keys.** It only adds a field after a change here.

## C-8. `SignInForm` (`src/features/auth/SignInForm.tsx`, T3)

```ts
export interface SignInFormProps {
  variant: 'page' | 'modal' | 'inline'
  initialEmail?: string
  onSignedIn?: (session: Session) => void
  allowPin: boolean // shows "Sign in with PIN (until <PIN_SUNSET_LABEL>)"; T3 mounts it true only on variant 'page'
}
```

- **States:** `email` → `code` → done, plus `password` and `forgot`. The PIN
  sub-state, when `allowPin` is set, reuses `loginWithPin` unchanged.
- **Calls:**
  - Code: `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })`,
    then `verifyOtp({ email, token, type: 'email' })`.
  - Password: `signInWithPassword`.
  - Forgot: `resetPasswordForEmail(email, { redirectTo: <origin>/auth/confirm?type=recovery } )`.
    **Amended 2026-10-21 (coordinator, from T3):** the form then shows
    `OtpCodeStep` with `type: 'recovery'`, because the recovery email leads
    with a code. Once the code verifies, it navigates to
    `/auth/confirm?type=recovery&verified=1` (C-9). The link in the email
    still works as before.
- **The OTP input** has `autocomplete="one-time-code"`, `inputmode="numeric"`
  and a 6-digit length. Resend is disabled for 60 s, with a countdown.
- **`onSignedIn`** fires once, with the new session. Without it, the form does
  nothing more, because `useAuth`'s listener already owns post-sign-in work.
  It doesn't navigate: the user stays where they are.
- **Mount points (T3):** `VerificationGate` (`page`), `ui/AuthGate.tsx`
  (`modal`, which replaces `PinPrompt`) and `settings/AccountSection.tsx`
  (`inline`).
- **The signup screen reuses the form's `code` state** (DESIGN §2 Sign-up step
  4). T3 exports it as `<OtpCodeStep email onVerified onChangeEmail />` from
  the same folder, so signup and sign-in share one code entry.

## C-9. Return path and `AuthConfirm`

- **`localStorage` key `pl_auth_return_path`.** `src/features/auth/returnPath.ts`
  exports `saveReturnPath()`, which stores `location.pathname + search + hash`,
  and `takeReturnPath(): string | null`, which reads, removes and validates
  it. A value is accepted only if it starts with `/` and not `//` or `/\`;
  anything else is discarded.
- **Every** `signInWithOtp` and `resetPasswordForEmail` call saves it first.
- **`AuthConfirm`'s destination:** `takeReturnPath()` → the `next` param
  (validated the same way) → `/home`.
- **No automatic verify.** `AuthConfirm` shows a "Tap to finish signing in"
  button and calls `verifyOtp({ token_hash, type })` only on the tap.
- **Types:**
  - `magiclink`, `signup` and `email` → navigate to the destination.
  - `recovery` → the "Set a new password" screen (`updateUser({ password })`,
    with no current-password field), then the destination.
  - `type=recovery&verified=1` with no `token_hash` (amended 2026-10-21):
    the code was already verified in `SignInForm`, so it shows "Set a new
    password" when a session exists, and an error otherwise.
  - `email_change` → today's confirmation screen.
- **All five templates keep today's link shape:**
  `/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=...`. T3 doesn't
  change the templates' URLs, only `magic_link`'s body (D-14).

## C-10. `signin` deep link

`?signin=1[&email=<addr>]` on any route:

- **Signed out, on a public path:** it opens `SignInForm` as a `modal` with
  `initialEmail = email` (trimmed and lower-cased; ignored unless it contains
  `@`).
- **Signed out, on a protected path** (amended 2026-10-21, coordinator, from
  T3): `VerificationGate` already covers the page, so it shows its `page`
  form with the same `initialEmail` instead of a modal on top.
- **Signed in:** it does nothing.
- **The params are removed** with `replace` navigation: at once on a public
  path or when signed in, and after sign-in on a protected path (the gate
  reads them until then). This lives in one hook, `useSignInDeepLink()`,
  mounted in `Layout` (T3).

## C-11. Sunset date

`src/features/auth/pinSunset.ts` exports `PIN_SUNSET_DATE` (ISO `YYYY-MM-DD`)
and `PIN_SUNSET_LABEL` (e.g. `10 November`).

- **T3 creates it** with a placeholder date, and every PIN-sunset string
  reads from it.
- **The coordinator sets the real date at T₀.**
- **PR 4 deletes it.**

## C-12. Role source and session check (T15, in PR 2/3)

Added 2026-10-21 by the coordinator (owner decision; PLAN §1 log).

**The role comes from the access token only.** `custom_access_token_hook`
(`20260816140000`) sets `app_metadata.role` in every token from
`players.role`, on every sign-in method and every refresh.

- One helper decodes `session.access_token` and returns the `role` claim
  (`'admin' | 'player'`), or `'guest'` without a session. `useAuth` exposes
  it, and every client read of `session.user.app_metadata.role` goes through
  it. Nothing reads `session.user.app_metadata` for the role any more.
- It decodes locally rather than calling `getClaims()`: with this project's
  signing keys `getClaims()` makes a network call, and the role is display
  only. The server enforces with the token's claims and `require_admin()`
  (which reads `players`).
- `useAuth` no longer calls `syncMyRole()`; the client function and its
  tests go. The `sync_my_role` RPC stays until PR 10.

**Session check.** Once the session has settled, a signed-in session is
**complete** when both hold:

1. the token's `role` claim is `'player'` or `'admin'`, and
2. the user's own `players` row exists (read through an existing query;
   no new RPC).

- If (1) fails, the client refreshes the session **once** and checks again.
  That covers a token minted before its `players` row was visible.
- If the session is still incomplete, every route shows a full-screen panel:
  "Your account isn't fully set up. Message an admin on WhatsApp and we'll
  sort it out." with a **Sign out** button. Nothing else renders behind it.
- It logs `console.error('[auth] incomplete session', { reason })` with the
  reason (`no_role` / `no_player`) and no personal data. Recording it
  server-side is deferred (PLAN §1 log, 2026-10-21).
- **While the check is pending, the app renders as usual** (amended
  2026-10-21). It's a safety net, not a gate: blocking would unmount the page
  on every sign-in (losing an in-progress action such as a Merch order) and
  make every reload wait on the `players` read. The panel replaces the page
  only once the session is confirmed incomplete.
