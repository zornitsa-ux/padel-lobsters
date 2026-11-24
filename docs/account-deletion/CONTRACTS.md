# Account deletion: contracts

Interfaces for [`DESIGN.md`](./DESIGN.md). RPCs follow the house style:
`security definer`, `search_path` pinned, `statement_timeout`, a status
string in the result for expected refusals, and `raise` only for misuse.
Grants go in the grants files in the same PR.

## C-1. Anonymised names

- `private.is_anonymised_name(input_name text) returns boolean`: true for
  `^Anonymous [A-Z][a-z]+ #[0-9]+$` after trimming. Strict: it tells a
  deleted account apart.
- `private.is_reserved_name(input_name text) returns boolean`: true for
  any name containing "anonymous", ignoring case. Used to refuse names.
- `private.deleted_player_number`: a sequence starting at 1.
- `private.anonymised_name(input_number bigint) returns text`:
  `'Anonymous ' || animals[(input_number - 1) % 12 + 1] || ' #' || input_number`.
  The 12 animals are one word each, and Lobster isn't one of them.
- **Reserved:** the trigger `players_reserved_name` (BEFORE INSERT OR
  UPDATE OF name on `players`) raises `reserved_name` (P0001) for a reserved
  name, unless `app.deleting_player` holds the row's id, which only the
  deletion sets. It covers every writer: `update_my_profile`,
  `admin_update_player`, `admin_add_player`, the league placeholders in
  `admin_create_league_team` and `admin_update_league_team`, and signup.
  Two say it in their own terms first: `before_user_created_hook` rejects
  the signup with a message, and `create_partner_player` returns
  `invalid_name`. An unchanged name passes, so an existing row is never
  stuck.
- Client: `isAnonymisedName(name)` in `src/lib`, tested against the same
  cases file as the SQL function (`supabase/tests/anonymised_name_cases.json`).

## C-2. RPCs

| RPC                                                                    | Who           | Result                                                                                                                                                                |
| ---------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `delete_my_account()`                                                  | authenticated | `table(status text)`: `deleted`, `code_required`, `admin_must_step_down`, `already_deleted`, `in_live_event`, `not_found`                                             |
| `admin_delete_account(input_target_id uuid)`                           | admin         | `table(status text, anonymised_name text)`: `deleted`, `code_required`, `admin_must_step_down`, `already_deleted`, `not_found`, `cannot_delete_self`, `in_live_event` |
| `get_my_deletion_summary()`                                            | authenticated | `jsonb` (below)                                                                                                                                                       |
| `admin_get_deletion_summary(input_target_id uuid)`                     | admin         | `jsonb` (below)                                                                                                                                                       |
| `private.delete_account(input_target_id uuid, input_by_admin boolean)` | no grant      | Does §2.3 of the design. Called only by the two RPCs above, after their checks.                                                                                       |

- **Recent code:** `private.has_recent_email_code()` is true when
  `auth.jwt() -> 'amr'` has an element with `method = 'otp'` and a
  `timestamp` no more than 600 seconds old. Both delete RPCs check it on the
  caller.
- **Summary** (`jsonb`), built from the same queries the deletion uses:

  ```json
  {
    "is_admin": false,
    "in_live_event": false,
    "upcoming": [{ "tournament_id": "…", "name": "…", "date": "…", "paid": true, "team": false }],
    "team_events": [{ "tournament_id": "…", "name": "…", "is_captain": true }],
    "league_teams": [{ "league_id": "…", "league_name": "…" }],
    "open_shop_requests": 2,
    "pending_transfers": 1
  }
  ```

  `paid` is true when `payment_status` is `paid`, `tikkied` or
  `pending_confirmation`.

## C-3. Follow-ups

```sql
create table public.account_deletion_followups (
  id bigint generated always as identity primary key,
  player_id uuid not null,            -- the deleted player; no foreign key needed, the row is never deleted
  ref_table text not null,            -- 'league_teams' | 'merch_interests' | 'players' | 'tournaments'
  ref_id text not null,               -- the row's id as text
  ref_column text not null,           -- 'team_name' | 'team_song' | 'spirit_animal' | 'admin_comment' | 'notes'
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  dismissed_by uuid
);
```

- RLS on, no grants to `authenticated`. Read and dismiss through RPCs only.
- `admin_list_deletion_followups()` returns
  `table(kind text, ref_table text, ref_id text, ref_column text, player_name text, followup_id bigint, context_id text)`.
  `kind` is `league_team`, `event_team` (both worked out live) or
  `free_text` (open table rows). `player_name` is the anonymised name.
  `context_id` is where the row is edited: the league, the event, the shop
  item or the player.
- `admin_dismiss_deletion_followup(input_followup_id bigint)` returns
  `table(status text)`: `dismissed` or `not_found`.

## C-4. Security event kinds

`security_events.attempt_kind` gains `account_deleted_self` and
`account_deleted_admin`. `device_id`, `ip_address` and `user_agent` stay
null on these rows.

## C-5. Avatar storage policies

- Changed: the INSERT and UPDATE avatar policies also require
  `not public.is_deleted_player(auth.uid())`. Uploads stay limited to
  `player-<uid>.webp`, or any name for an admin.
- New (AD4): `Player or admin read avatar` on SELECT. Storage writes with
  `RETURNING` and deletes only rows the caller can select, so without it
  every upload was refused and every remove matched nothing.
- New: `Player or admin delete avatar` on DELETE: not a deleted player, and
  `public.is_own_avatar(name)` or admin. The SELECT policy uses the same
  condition without the deleted check.
- `public.is_own_avatar(input_name text) returns boolean` (AD4): true for
  `player-<uid>.webp` and for the file the caller's own `avatar_url` names.
  Admins upload a player's photo under a random name, so the stable name
  alone would miss it.
- `public.is_deleted_player(input_id uuid) returns boolean`: stable,
  security definer, executable by `authenticated`. In `public` because
  storage policies run as the browser role, which has no usage on
  `private`. It tells no more than `players_public.status`. The same goes
  for `is_own_avatar`, which tells a player only about their own photo.

## C-6. Triggers

- `players_frozen_when_deleted`: BEFORE UPDATE on `players`. When
  `OLD.status = 'deleted'`, it raises `player_deleted` (P0001), unless the
  only columns that differ are `mm_rating`, `mm_sigma` and
  `mm_rating_updated_at` (`apply_tournament_ratings`,
  `admin_review_rating_event`). The
  deletion's own update starts from a row that isn't deleted yet, so the
  trigger doesn't block it.
- `no_new_reference_to_deleted_player`: a BEFORE INSERT OR UPDATE trigger
  function, parameterised by column names (`TG_ARGV`), on:

  | Table                    | Columns                          | On update, fires when                                                                                                                                                      |
  | ------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `registrations`          | `player_id`                      | `player_id` changes, or status moves from `cancelled` to `registered` or `waitlist` (not `waitlist` → `registered`, so a team with a deleted member can still be promoted) |
  | `registration_transfers` | `from_player_id`, `to_player_id` | a column changes, or status becomes `pending`                                                                                                                              |
  | `partner_invites`        | `player_id`                      | `player_id` changes                                                                                                                                                        |
  | `event_teams`            | `captain_id`                     | `captain_id` changes                                                                                                                                                       |
  | `league_teams`           | `player1_id`, `player2_id`       | a column changes                                                                                                                                                           |
  | `raffle_winners`         | `player_id`                      | `player_id` changes                                                                                                                                                        |
  | `lobster_oscars_votes`   | `voter_id`, `target_id`          | a column changes                                                                                                                                                           |
  | `league_interests`       | `player_id`                      | `player_id` changes                                                                                                                                                        |
  | `player_aliases`         | `player_id`                      | `player_id` changes                                                                                                                                                        |
  | `merch_interests`        | `player_id` (text)               | `player_id` changes                                                                                                                                                        |

  It raises `player_deleted` (P0001). Rows already pointing at a deleted
  player are untouched: the trigger only stops new links.

- `matches_no_deleted_player`: BEFORE INSERT OR UPDATE OF `team1_ids`,
  `team2_ids` on `matches`. It raises `player_deleted` when an id that wasn't
  in the old arrays belongs to a deleted player, so a stale schedule can't
  swap one in. Ids already there pass, so scores on existing matches can
  still be entered.
- `raffle_exclusions` is added to the table above (`player_id`).
- A deleted account keeps its registration in a past event, so the two
  writers that pick from those registrations skip it first (AD3,
  `20261124160000`): `admin_draw_raffle_winners` leaves deleted players out
  of the pool, and `lobster_oscars_cast_vote` returns `invalid_target` for
  one. Without this, a draw that picked one failed as a whole, and a vote
  raised `player_deleted`.

## C-7. Team cancel reason

`event_teams.cancelled_reason` gains `account_deleted`: both members of a
team deleted their accounts. The client's `TeamCancelReason` has it too; no
ended-team notice is shown for it, since there's nobody left to see one.
