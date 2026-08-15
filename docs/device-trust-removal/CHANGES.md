# Device-trust removal — what changed

Shipped 2026-08-16 in `supabase/migrations/20260816140000_remove_device_trust.sql`
plus 38 source files. The rationale is in [DECISIONS.md](./DECISIONS.md).

## What the feature was

Added in `20260518000013_rbac_phase7_device_trust.sql` ("RBAC Phase 7"): every
browser generated a random `device_id` in localStorage, `verify_player_pin_v2`
recorded a `(player, device)` row, and only a _trusted_ row could mutate data —
auto-granted to a player's first device inside the `settings.auto_trust_until`
window, or approved afterwards by an admin or an already-trusted device.
`require_trusted_device()` enforced it inside five write RPCs.
`20260525000003` later moved that check from the JWT claim to a live table read.

## Dropped

**Database:** `player_devices` (table + 4 indexes + FK) · `require_trusted_device()` ·
`is_my_device_trusted` · `approve_device` · `reject_device` · `list_pending_devices` ·
`admin_approve_device` · `admin_deny_device` · `admin_list_pending_devices` ·
`bootstrap_device_session` · `admin_unlock_player` · `settings.auto_trust_until` ·
`players.locked_until` · `pin_attempts.was_new_device`.

**Frontend:** `src/components/device-trust/*` · `ApproveDevicesWidget.tsx` ·
`src/api/devices.ts` · `src/hooks/useDevices.ts` · the `Layout.tsx` banner and
indicator · the `AccountSection.tsx` widget mount.

## Rewritten

- The five guarded RPCs (`update_my_profile`, `create_transfer`, `cancel_transfer`,
  `lobster_oscars_cast_vote`, `lobster_oscars_clear_vote`) — recreated from live
  `pg_get_functiondef` output with only the `PERFORM` line removed, so unrelated
  drift since 2026-05 is preserved.
- `verify_player_pin_v2` — loses device registration, auto-trust, the lockout
  branch and `is_new_device`.
- `custom_access_token_hook` — no longer injects `device_trusted`, and strips
  both `device_trusted` and `device_id` from claims on every issuance.
- `admin_list_security_events` — return type loses `was_new_device`.
- `bootstrap_device_session` → `sync_my_role()`, keeping only the
  `auth.users.raw_app_meta_data` role write (see D-6 — this is what makes a
  magic-link session render as non-guest).
- `AdminSecurityPanels.tsx` → `SecurityEventsPanel.tsx`, pending-devices half
  removed; new `src/api/securityEvents.ts` holds the feed call.

## Kept deliberately

- **`device_id`** (`src/lib/deviceId.ts`). It keys `verify_player_pin_v2`'s
  10-failed-PINs/24h cap and `self_signup_player`'s 5-signups/24h cap, both off
  `pin_attempts.device_id`. This is now the only PIN brute-force protection.
- **The `pin_attempts` audit history**, including `approve_device` and
  `admin_unlock` rows and the `attempt_kind` check constraint.
- **`get_my_profile_v2`, `respond_to_transfer`, `register_for_tournament`,
  `cancel_registration`** — never trust-gated. Comments claiming otherwise were
  corrected, not deleted.
