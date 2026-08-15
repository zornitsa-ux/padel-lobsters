# Device-trust removal — decision record

The probationary-device system was removed in its entirety, with **no
replacement**. The loosening of the security model was accepted, deliberately, by
the project owner.

This records **why**. The what is in [CHANGES.md](./CHANGES.md).

## Decisions

**D-1 — Remove, don't soften.** The alternative was keeping the machinery and
disabling enforcement (widen `auto_trust_until`, or make `require_trusted_device()`
a no-op). Rejected: that leaves a table, nine RPCs, a JWT claim, two panels and a
banner in the codebase, all lying about what the system does. If the guard is not
enforcing, it should not exist.

**D-2 — Keep `device_id`; it was doing a second job.** The browser id keys two
things unrelated to trust: `verify_player_pin_v2`'s cap of 10 failed PINs per
device per 24h, and `self_signup_player`'s cap of 5 signups per device per 24h —
both off `pin_attempts.device_id`, not `player_devices`. `pin_attempts.ip_address`
exists but has never been populated, so `device_id` is the _only_ key those limits
have. Removing it would have quietly deleted the PIN brute-force protection under
cover of removing device trust.

**D-3 — Drop `player_devices`, and the account lockout with it.**
`verify_player_pin_v2` locked a player for 24h after 5 failed PINs on a device
already known to be theirs, and "known to be theirs" was a `player_devices`
lookup. Re-deriving the device→player mapping from `pin_attempts` reintroduces
exactly the mapping this change removes; keeping `player_devices` as a plain
device log leaves a table alive for one lookup. Both rejected. The per-device 24h
failure cap is the surviving protection.

**D-4 — Rip the lockout out completely rather than leave it inert.** Follows from
D-3: with nothing writing `players.locked_until`, the column, the `'locked'`
branch, `admin_unlock_player` (already UI-orphaned) and the "Unlocks" filter are
dead weight. Dropping the column also unlocks anyone serving a 24h lock from a
rule that no longer exists.

**D-5 — Remove the new-device signal.** `is_new_device` / `pin_attempts.was_new_device`
are computed from `player_devices` and drive one chip in the admin feed.
Re-deriving it from `pin_attempts` on every sign-in, or keeping a column that
always writes `false`, are both worse than deleting a signal nobody acts on.

**D-6 — `bootstrap_device_session` becomes `sync_my_role()`; it does not just
disappear.** The non-obvious find. Besides registering the device, that RPC writes
`role` into `auth.users.raw_app_meta_data`, and _that write_ — not
`custom_access_token_hook` — is what makes a magic-link session render as
non-guest client-side: `session.user.app_metadata` comes from GoTrue's user
object, while the hook only shapes the JWT claims that RLS reads. Dropping the RPC
outright would leave a magic-link-only admin looking like a guest in the UI while
their token said `admin`.

**D-7 — Keep the security-events panel and the audit history untouched.** The
`pin_attempts` feed covers PIN failures, PII reads and payment reminders — none of
which are device trust. Historical `approve_device` rows stay and the
`pin_attempts_attempt_kind_check` constraint is unmodified: removing the value
would either fail against existing rows or require deleting audit history, and
audit history that gets tidied up on feature removal is not audit history.

**D-8 — Drop `settings.auto_trust_until`.** Its only readers were
`verify_player_pin_v2` and `bootstrap_device_session`, both of which lose the
auto-trust branch. It had no admin UI — set once by the init migration's
`now() + interval '21 days'` default.

**D-9 — The migration shipped before the frontend.** Vercel auto-deploys on merge
to `main` while `db push` is manual, so the default order is the wrong one.
Frontend-first would give a window where the new bundle has no banner but the old
database still runs `require_trusted_device()` — writes failing with
`pending_device_approval` and nothing in the UI explaining it. Migration-first
inverts that into a cosmetic failure: old bundles show a meaningless banner while
their writes succeed.

## Found while tracing

1. **`update_my_profile` had drifted twice** since the device-trust migration
   (`FOR UPDATE`, a `record_mm_reset` call, the guard-email-clear `CASE WHEN
payload ? 'x'` shape). Rebuilding the guarded RPCs from the old migration text
   would have silently reverted those — hence the `pg_get_functiondef` approach.
2. **`respond_to_transfer` had already lost the guard.** `20260518000013` added
   `require_trusted_device()` to six RPCs; `20260815050555` recreated
   `respond_to_transfer` without it. Five carried the guard, not six — accepting a
   transfer had been ungated for weeks.
3. **`get_my_profile_v2` was never trust-gated**, despite comments in
   `playerQueries.ts`, `playerSelectors.ts`, `api/auth.ts` and two test names
   asserting it returns no row on a probationary device. Those described a design
   that was never implemented.
4. **No RLS policy anywhere referenced device or trust** — enforcement lived
   entirely in the five SECURITY DEFINER RPCs.

## Accepted consequences

1. **Any signed-in session can write.** A stolen or guessed PIN is now sufficient
   to mutate data from any browser. This is the loosening, stated plainly.
2. **A rotating `device_id` defeats the surviving rate limit.** It is a
   client-supplied localStorage UUID, so an attacker sending a fresh one per
   request is never throttled, and `verify_player_pin_v2` matches the PIN against
   the whole roster. The `locked_until` lockout was the only cross-device brake
   (D-3). Populating `pin_attempts.ip_address` for an IP-keyed fallback is the
   obvious fix if this ever needs one.
3. **Wrong-PIN rows lose player attribution** — logged with `player_id = NULL` and
   the `device_id` only, because attribution came from `player_devices`.
4. **Historical `admin_unlock` rows** render with the raw kind string, since D-4
   removed that label arm.
5. **Sessions minted before the migration** keep stale `device_trusted` /
   `device_id` claims until their next refresh. Nothing reads them; the migration
   strips both keys from `auth.users.raw_app_meta_data` and
   `custom_access_token_hook` strips them from claims on every future issuance.
6. **`pl_device_trust_banner_dismissed`** stays in users' localStorage forever.
   Not worth cleanup code.
7. **The migration is not reversible by SQL** — it drops a table and three columns
   holding data. A rollback means a PITR restore.
