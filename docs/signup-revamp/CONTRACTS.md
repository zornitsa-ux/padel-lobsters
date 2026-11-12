# Signup revamp: contracts

Interfaces between the database and the client. Wording shown to players is
not here; it lives in the code once built.

## C-1. Answer codes

Stored as `text` with a CHECK constraint per column. The client maps codes to
wording; the order below is the display order.

| Column          | Codes                                                             |
| --------------- | ----------------------------------------------------------------- |
| `years_playing` | `few_times`, `under_1y`, `1_to_3y`, `over_3y`                     |
| `frequency`     | `monthly_or_less`, `few_per_month`, `weekly_1_2`, `weekly_3_plus` |
| `lessons`       | `none`, `1_to_10`, `over_10`                                      |
| `racket_sports` | `none`, `casual`, `regular`, `competitive`                        |
| `walls`         | `lets_go`, `slow_back_wall`, `back_wall_not_corners`, `corners`   |

Walls → start (DESIGN §2.3): 1.0, 1.5, 2.0, 2.5, in the order above.

## C-2. Table `public.player_levelling`

| Column            | Type          | Notes                              |
| ----------------- | ------------- | ---------------------------------- |
| `player_id`       | `uuid` PK     | FK `players(id)` ON DELETE CASCADE |
| `years_playing`   | `text`        | NOT NULL, C-1                      |
| `frequency`       | `text`        | NOT NULL, C-1                      |
| `lessons`         | `text`        | NOT NULL, C-1                      |
| `racket_sports`   | `text`        | NOT NULL, C-1                      |
| `walls`           | `text`        | NOT NULL, C-1                      |
| `playtomic_level` | `numeric`     | NULL when "no"; else > 0 and ≤ 7   |
| `start_source`    | `text`        | `playtomic` or `walls`             |
| `start_mu`        | `numeric`     | NOT NULL                           |
| `start_sigma`     | `numeric`     | NOT NULL                           |
| `prefilled`       | `boolean`     | step 6 opened with a level on file |
| `completed_at`    | `timestamptz` | NOT NULL DEFAULT `now()`           |

RLS on; SELECT policy for admins only; no write policy. Grants: `authenticated`
SELECT (filtered by RLS), nothing for `anon`. Added to
`expected_table_grants.txt`.

## C-3. RPCs

### `public.complete_levelling(input_answers jsonb) returns table(status text)`

- `SECURITY DEFINER`, caller = `auth.uid()`; `authenticated` only.
- `input_answers`: the five C-1 keys, plus `playtomic_level` (number or null)
  and `prefilled` (boolean).
- Statuses: `ok`, `already_levelled`, `not_needed` (the caller has a played
  night, so their learned rating is never replaced), `invalid_answers`
  (unknown code, missing key, or a level outside (0, 7]),
  `not_authenticated` (raised, P0001).
- Locks the caller's `players` row `FOR UPDATE` first (as
  `update_my_profile` does), then checks `already_levelled` and
  `not_needed`. A double tap gets `ok` then `already_levelled`, never a
  unique violation or two audit rows.
- Effects on `ok` (one transaction): insert `player_levelling`; set
  `mm_rating`, `mm_sigma`, `mm_rating_updated_at`; when a level is given, set
  `playtomic_level`, `adjusted_level`, `playtomic_updated_at`; insert one
  `rating_events` row (C-4).
- `prefilled` is stored as sent; it doesn't change the result.

### `public.get_my_levelling() returns table(needs_levelling boolean, playtomic_level numeric)`

- `SECURITY DEFINER`, `STABLE`, caller = `auth.uid()`; `authenticated` only.
- `playtomic_level` is the level on file (> 0) for the step 6 prefill, else
  null. One row; signed-in callers without a player row get
  `needs_levelling = false`.

### `private.needs_levelling(input_player_id uuid) returns boolean`

- No `player_levelling` row, no `rating_events` row of kind `tournament` or
  `seed`, and no `registered` row in a `completed` tournament for the player.
  Revoked from all client roles.

### `public.register_for_tournament` (changed)

- New status `needs_level`, returned with a null id when
  `input_player_id = auth.uid()` and `needs_levelling` holds. Checked after
  `not_found` / `team_event` and the `already_*` check, before the insert.
  The status is an untyped string on the client: `useSelfRegister.ts`
  (which today reads only `regId`) and `Registration.tsx` add the case.

### `public.register_team_for_tournament` and `public.respond_to_team_invite` (changed)

- New status `needs_level` when the caller is the player being written (the
  captain registering, the partner accepting) and `needs_levelling` holds.
  Checked before any write. Admins registering a team for others aren't
  gated.

## C-4. `rating_events` kind `levelling`

`tournament_id` null, `prior_mu`/`prior_sigma` = current `mm_*` or the
Playtomic prior (level, 0.7), `proposed_delta` 0, `applied_delta` =
`start_mu − prior_mu`, `flagged` false, `breakdown` =
`{"source": "playtomic" | "walls"}`. The `kind` column has no CHECK; the
column comment in the migration lists the new value.

## C-5. Signup source

`user_metadata` keys (optional, both absent when skipped):

| Key                    | Values                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| `signup_source`        | `lobster`, `instagram`, `plaza_whatsapp`, `other`                 |
| `signup_source_detail` | free text, trimmed, ≤ 100 characters; only for `lobster`, `other` |

Hook rejections (new, exact strings chosen in the PR): unknown
`signup_source`; detail over 100 characters. A detail sent with
`instagram`/`plaza_whatsapp` is dropped, not rejected.

Table `public.player_signup_source`:

| Column       | Type          | Notes                              |
| ------------ | ------------- | ---------------------------------- |
| `player_id`  | `uuid` PK     | FK `players(id)` ON DELETE CASCADE |
| `source`     | `text`        | NOT NULL, codes above              |
| `detail`     | `text`        | NULL unless `lobster` or `other`   |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()`           |

Same RLS and grants as C-2. Written only by
`private.create_player_for_confirmed_user`.

## C-6. Trigger `registrations_require_levelling`

BEFORE INSERT OR UPDATE on `public.registrations`, function
`private.registrations_require_levelling()`. Raises
`needs_level` (P0001) when all hold:

- `new.player_id = auth.uid()`;
- `private.needs_levelling(new.player_id)`;
- and either:
  - the row becomes active: `new.status in ('registered', 'waitlist')` and
    (`TG_OP = 'INSERT'` or `old.status not in ('registered', 'waitlist')`); or
  - a team row is accepted: `TG_OP = 'UPDATE'`, `old.accepted_at is null` and
    `new.accepted_at is not null`.

Client: the RPC wrappers pass the raised `needs_level` through instead of
collapsing it to `error` (`registerPlayer` in `registrationQueries.ts` drops
the error today; the transfer and team wrappers likewise). The transfer
accept screen and the team invite screen show the levelling card on it, with
the current page as the return path; a pending transfer stays pending.

## C-7. Reset guards

In `update_my_profile` and `admin_update_player`, `record_mm_reset` is skipped
when:

- the new level is 0 (both RPCs `coalesce` a null level to the old one, so
  clearing the field sends 0), or
- the player has a `player_levelling` row and no played night (as in
  `needs_levelling`).
