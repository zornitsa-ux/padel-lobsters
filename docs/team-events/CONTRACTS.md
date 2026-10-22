# Team events: contracts (T1 freeze)

The exact database and client contracts for Phase 1. Workers code against this
file. Any change goes through the coordinator and is recorded in
[`DECISIONS.md`](./DECISIONS.md). Design rationale lives in
[`DESIGN.md`](./DESIGN.md) §3.1–3.2.

Conventions, matching `20260806211259_registration_capacity_rpcs.sql`:

- Every RPC is `security definer`, `search_path = pg_catalog, public, extensions`,
  sets `statement_timeout = '30s'` and `app.audit_source = '<function name>'`.
- **Expected outcomes come back as a `status` value. They never raise.** Only
  `not_authenticated` and `require_admin()` failures raise, so the client
  treats an `error` as unexpected and a `status` as something to show the user.
- Lock order: the `tournaments` row `for update` first, then registrations.
- Grants: `revoke … from public, anon`, `grant … to authenticated` for the
  public RPCs, and nothing for `private.*`.

---

## 1. Schema

```text
tournaments
  format                        text  check in ('lobster_matching','king_of_court')       (new check; prod has only lobster_matching)
  entry_mode                    text  not null default 'individual'
                                      check in ('individual','team')                      (new)
  starting_courts_published_at  timestamptz null                                          (new; Phase 2)
  check tournaments_kotc_is_team:   format <> 'king_of_court' or entry_mode = 'team'
  check tournaments_team_capacity_even: entry_mode <> 'team' or max_players % 2 = 0

event_teams                                                                   (new)
  id             uuid pk default gen_random_uuid()
  tournament_id  uuid not null → tournaments on delete restrict
  captain_id     uuid not null → players
  seed           int null  check (seed > 0)
  final_rank     int null  check (final_rank > 0)
  created_at     timestamptz not null default clock_timestamp()   (waitlist order)
  created_by     uuid null → players on delete set null   (auth.uid() of whoever made it)
  cancelled_at   timestamptz null
  cancelled_reason text null  'partner_declined' | 'captain_cancelled' | 'admin_cancelled'  (D-015)
  index (tournament_id)

registrations
  team_id        uuid null → event_teams on delete restrict, index (team_id)  (new)
  accepted_at    timestamptz default now(); null only for a pending team partner  (D-015)
  payment_status check gains 'covered'                                         (D-005)

partner_invites                                                               (new)
  id                    uuid pk default gen_random_uuid()
  player_id             uuid not null unique → players on delete cascade (the new partner)
  tournament_id         uuid not null → tournaments on delete cascade
  requested_by          uuid not null → players   (the person who ticked consent, D-013)
  consent_confirmed_at  timestamptz not null
  created_at            timestamptz not null default now()
  invited_at            timestamptz null           (T2)
  invited_by            uuid null → players        (T2)
  index (requested_by, created_at)                 (daily cap)
```

### Access

| Object            | anon | authenticated                                                                             |
| ----------------- | ---- | ----------------------------------------------------------------------------------------- |
| `event_teams`     | none | `select` (RLS: everyone, like `registrations`); `update (seed, final_rank)` (RLS: admins) |
| `partner_invites` | none | `select` (RLS: admins only). No writes for anyone                                         |

Phase 2 writes seeds and final ranks straight to `event_teams` as an admin,
and the publish timestamp straight to `tournaments` (existing admin policy).
No Phase 2 migration is needed.

### Invariants (enforced in the database, not only tested)

1. **Nobody writes `registrations` directly (D-016).** Insert, update and
   delete are revoked from `anon` and `authenticated`, and the write policies
   are dropped. Every change goes through a `security definer` RPC below.
2. **An active row on a team event has a team, and an individual event has no
   team rows.** The same trigger checks it for every role (`team_required` /
   `team_not_allowed`).
3. **A team is either fully active or fully cancelled.** Deferred constraint
   trigger `registrations_team_consistent` (checked at commit): for each team
   touched, the active (`registered`/`waitlist`) rows number 0 or 2, both share
   one status, and one of them belongs to `captain_id`. The pair can't
   diverge, even inside an RPC with a bug (`team_inconsistent`).
4. **Entry mode is fixed once anyone is entered.** Trigger
   `tournaments_guard_entry_mode` rejects changing `entry_mode` while the event
   has any registered or waitlisted rows (`entry_mode_locked`).

---

## 2. Shared private function (D-012)

```sql
private.create_partner_player(
  input_requested_by   uuid,      -- the person attesting consent (auth.uid())
  input_tournament_id  uuid,
  input_new_partner    jsonb,     -- {name, email, playtomic_level?}
  input_consent        boolean,
  input_skip_daily_cap boolean    -- true for admins
) returns table(status text, player_id uuid)
```

The checks run in this order. Each failure returns `(code, null)` and writes
nothing:

| Code                  | When                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `consent_required`    | `input_consent is not true` (D-011)                                                      |
| `invalid_name`        | the name is empty after collapsing whitespace, or longer than 100 characters             |
| `invalid_email`       | fails `private.is_valid_email`, or ends with `@padelobsters.internal`                    |
| `invalid_level`       | `playtomic_level` is present but not a number in 0–7                                     |
| `email_in_use`        | `lower(email)` matches any `players.email` (any status) or any `auth.users.email`        |
| `partner_cap_reached` | ≥ 3 `partner_invites` rows with this `requested_by` in the last 24h (skipped for admins) |

On success it inserts an `active` player (`name`, `lower(email)`,
`playtomic_level` = `adjusted_level` = the level or 0, every other field
default). The `ensure_auth_user` trigger creates the confirmed auth user and
its email identity. **No `mm_rating` is written:** signup doesn't write one
either, and the matcher and `teamStrength` fall back to `playtomic_level`. It
then inserts `partner_invites (player_id, tournament_id, requested_by,
consent_confirmed_at = now())` and returns `('ok', new_player_id)`. Nothing is
mailed: no `net.http_post`.

A transaction-scoped advisory lock on `requested_by` serialises the cap check.
Leagues will call the same function later, after a migration that relaxes
`tournament_id` to "tournament or league".

---

## 3. RPCs

### 3.1 `register_team_for_tournament`

```sql
public.register_team_for_tournament(
  input_tournament_id   uuid,
  input_captain_id      uuid,
  input_partner_id      uuid    default null,   -- existing member, or
  input_new_partner     jsonb   default null,   -- {name, email, playtomic_level?}
  input_partner_consent boolean default false
) returns table(status text, team_id uuid, partner_id uuid)
```

Raises `not_authenticated`. A captain other than `auth.uid()` requires an
admin (`require_admin()` raises).

| `status`                                  | Meaning                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `registered`                              | Team entered; both rows `registered`                                     |
| `waitlist`                                | Team entered; both rows `waitlist` (fewer than 2 spots free)             |
| `already_registered` / `already_waitlist` | The captain already has an active row (a double tap). Returns their team |
| `not_found`                               | No such tournament                                                       |
| `not_team_event`                          | `entry_mode <> 'team'`                                                   |
| `tournament_completed`                    | `status = 'completed'`                                                   |
| `invalid_partner`                         | Neither or both of partner id / new partner given, or partner = captain  |
| `captain_not_active`                      | The captain isn't an `active` player                                     |
| `partner_not_active`                      | The partner doesn't exist or isn't `active` (placeholders land here)     |
| `partner_already_entered`                 | The partner has a registered or waitlisted row in this event             |
| any §2 code                               | New partner rejected                                                     |

Order: authenticate → lock the tournament → event checks → captain → partner
→ (new partner via §2) → capacity → insert. The capacity rule is `registered
count + 2 <= max_players` → `registered`, otherwise `waitlist`. It inserts
`event_teams (created_by = auth.uid())`, the captain's row
(`payment_status 'unpaid'`) and the partner's row (`payment_status 'covered'`),
both with `team_id`. `partner_id` is returned for both kinds of partner.

### 3.2 `change_team_partner`

```sql
public.change_team_partner(
  input_team_id         uuid,
  input_partner_id      uuid    default null,
  input_new_partner     jsonb   default null,
  input_partner_consent boolean default false
) returns table(status text, partner_id uuid)
```

The caller is the team's captain, or an admin (otherwise `require_admin()`
raises).

| `status`                                                                     | Meaning                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `changed`                                                                    | The old partner's row is cancelled; the new one inherits the team status |
| `not_found`                                                                  | No such team                                                             |
| `team_cancelled`                                                             | The team has no active rows                                              |
| `tournament_completed`                                                       |                                                                          |
| `change_closed`                                                              | Non-admin at or after `tournament_transfers_closed` (12h before start)   |
| `same_partner`                                                               | The new partner is the current partner                                   |
| `invalid_partner`, `partner_not_active`, `partner_already_entered`, §2 codes | As in 3.1                                                                |

The new partner's row gets `payment_status 'covered'`. The old partner's
`partner_invites` row (if any) is left alone: it's how ghost accounts are
found later.

### 3.2a Acceptance (D-015)

The partner's row is inserted with `accepted_at = null` (pending). The
captain's row is accepted on insert. A team is **confirmed** when no active row
is pending.

`change_team_partner` adds a check: a non-admin caller gets `partner_accepted`
once the partner has accepted. The new partner's row is always pending, admin
swap included.

```sql
public.cancel_my_team(input_team_id uuid)
returns table(status text, promoted_team_id uuid)
```

Captain only (anyone else gets `not_found`). Statuses: `cancelled` |
`not_found` | `team_cancelled` | `tournament_completed` | `partner_accepted`
(the team is confirmed: transfer instead) | `cancel_closed` (12h cutoff). Sets
`cancelled_reason = 'captain_cancelled'` and promotes the oldest waitlisted
team into the opening.

```sql
public.respond_to_team_invite(input_team_id uuid, input_accept boolean)
returns table(status text)
```

The pending partner only (anyone else gets `not_found`). Statuses: `accepted` |
`declined` | `not_found` | `not_pending` | `tournament_started`. A decline
cancels both rows (`cancelled_reason = 'partner_declined'`) and promotes the
waitlist.

```sql
public.get_my_team_invites()
returns table(team_id uuid, tournament_id uuid, tournament_name text,
  tournament_date date, tournament_time text, captain_id uuid, captain_name text,
  team_status text, account_created_by_captain boolean)
```

The caller's pending invites on events that aren't completed.
`account_created_by_captain` is true when the caller has a `partner_invites`
row, which is when the profile step is offered (D-019).

### 3.2b `set_registration_payment` (D-016)

```sql
public.set_registration_payment(input_registration_id uuid,
  input_payment_status text, input_payment_method text default '')
returns table(status text)
```

Statuses: `ok` | `not_found` | `covered` (the partner's row; only a transfer
changes it) | `invalid_status` | `forbidden`.

- **Players:** only their own active row, and only forward: `unpaid` →
  `tikkied`, or `unpaid`/`tikkied` → `pending_confirmation`. The method is
  forced to `tikkie`.
- **Admins:** any of `unpaid`, `tikkied`, `pending_confirmation`, `paid` or
  `transferred`, with any method (up to 40 characters).

### 3.3 `admin_cancel_team`

```sql
public.admin_cancel_team(input_team_id uuid)
returns table(status text, promoted_team_id uuid)
```

Admin. Cancels both rows. When they were `registered` and the event now has
2 free spots, it promotes the **oldest waitlisted team** (`event_teams.created_at,
id`), both rows together. Status: `cancelled` | `already_cancelled` |
`not_found`.

### 3.4 `admin_promote_team`

```sql
public.admin_promote_team(input_team_id uuid) returns table(status text)
```

Admin. Status: `promoted` | `already_registered` | `not_waitlisted` (cancelled)
| `tournament_full` (fewer than 2 free) | `not_found`.

### 3.5 `admin_list_partner_invites`

```sql
public.admin_list_partner_invites(input_tournament_id uuid default null)
returns table(
  player_id uuid, tournament_id uuid, player_name text, email text,
  requested_by uuid, consent_confirmed_at timestamptz, created_at timestamptz,
  invited_at timestamptz, invited_by uuid,
  last_sign_in_at timestamptz,          -- auth.users; null = never signed in
  has_active_registration boolean       -- in input_tournament_id, or any event when null
)
```

Admin. It feeds the "hasn't signed in yet" hint (T5) and the Partner invites
list (T2).

### 3.6 Guards on existing RPCs

| RPC                             | New outcome                                                                                                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register_for_tournament`       | `('team_event', null)` when `entry_mode = 'team'`                                                                                                                                                                                                                               |
| `cancel_registration`           | `('use_cancel_team', null, null)` when the row has a `team_id`                                                                                                                                                                                                                  |
| `promote_waitlist_registration` | `('use_promote_team')` when the row has a `team_id`                                                                                                                                                                                                                             |
| `create_transfer`               | On a team event: `team_not_confirmed` unless the sender's team is confirmed; `target_already_registered` if the target has any active row in the event                                                                                                                          |
| `apply_registration_transfer`   | On a team event the recipient takes the sender's place on the team (accepted). A captain hands over `captain_id` and the payment status (`paid` stays `paid`, anything else becomes `unpaid`); a partner's place is `covered`. It re-checks `team_not_confirmed` and the target |

---

## 4. Client contract

Generated types come from `npm run db:types`. The hand-written types below live
in `src/features/events/teams/teamTypes.ts` (T1 ships them), and the queries in
`src/features/events/teams/teamQueries.ts`.

```ts
export type EntryMode = 'individual' | 'team'
export type EventFormat = 'lobster_matching' | 'king_of_court'

// normaliseTournaments gains:
//   entryMode: EntryMode                       (entry_mode ?? 'individual')
//   startingCourtsPublishedAt: string | null
// normaliseRegistrations gains:
//   teamId: string | null                      (team_id ?? null)

export interface EventTeam {
  id: string
  tournamentId: string
  captainId: string
  seed: number | null
  finalRank: number | null
  createdAt: string
}

// Derived client-side: event_teams + the event's registrations, active only.
export interface TeamEntry {
  team: EventTeam // gains cancelledAt, cancelledReason
  status: 'registered' | 'waitlist'
  captain: NormalisedRegistration
  partner: NormalisedRegistration
  confirmed: boolean // the partner has accepted (D-015)
}
// normaliseRegistrations also gains acceptedAt: string | null.
// New: CancelMyTeamStatus, RespondInviteStatus, TeamInvite (teamTypes.ts).

export interface NewPartnerInput {
  name: string
  email: string
  playtomicLevel: number | null
}

export type PartnerChoice =
  | { kind: 'member'; playerId: string }
  | { kind: 'new'; partner: NewPartnerInput; consent: boolean }

export type NewPartnerError =
  | 'consent_required'
  | 'invalid_name'
  | 'invalid_email'
  | 'invalid_level'
  | 'email_in_use'
  | 'partner_cap_reached'

export type PartnerError =
  | 'invalid_partner'
  | 'partner_not_active'
  | 'partner_already_entered'
  | NewPartnerError

export type RegisterTeamStatus =
  | 'registered'
  | 'waitlist'
  | 'already_registered'
  | 'already_waitlist'
  | 'not_found'
  | 'not_team_event'
  | 'tournament_completed'
  | 'captain_not_active'
  | PartnerError

export type ChangePartnerStatus =
  | 'changed'
  | 'not_found'
  | 'team_cancelled'
  | 'tournament_completed'
  | 'change_closed'
  | 'same_partner'
  | PartnerError

export type CancelTeamStatus = 'cancelled' | 'already_cancelled' | 'not_found'
export type PromoteTeamStatus =
  | 'promoted'
  | 'already_registered'
  | 'not_waitlisted'
  | 'tournament_full'
  | 'not_found'

export interface PartnerInvite {
  playerId: string
  tournamentId: string
  playerName: string
  email: string | null
  requestedBy: string
  consentConfirmedAt: string
  createdAt: string
  invitedAt: string | null
  invitedBy: string | null
  lastSignInAt: string | null
  hasActiveRegistration: boolean
}
```

`teamQueries.ts` exports these (all take named arguments):

```ts
fetchEventTeams({ tournamentId }): Promise<EventTeam[]>
registerTeam({ tournamentId, captainId, choice }): Promise<{ status: RegisterTeamStatus; teamId: string | null; partnerId: string | null }>
changeTeamPartner({ teamId, choice }): Promise<{ status: ChangePartnerStatus; partnerId: string | null }>
adminCancelTeam({ teamId }): Promise<{ status: CancelTeamStatus; promotedTeamId: string | null }>
adminPromoteTeam({ teamId }): Promise<PromoteTeamStatus>
fetchPartnerInvites({ tournamentId }): Promise<PartnerInvite[]>
```

The pure helper `buildTeamEntries({ teams, registrations }): TeamEntry[]` lives
in `src/features/events/teams/teamEntries.ts`. It sorts by `team.createdAt`,
the same order the waitlist promotes in.

**Partner search** (T4/T6) lists `players` with `status = 'active'` who have no
registered or waitlisted row in this event, excluding the captain. It uses the
existing players list; there's no new endpoint.

### Hooks and copy (shared by T4–T6)

`src/features/events/teams/useTeams.ts`:

- `useEventTeams({ tournamentId, enabled? })`: the TanStack query for
  `fetchEventTeams`, keyed `teamKeys.list(tournamentId)`.
- `usePartnerInvites({ tournamentId, enabled })`: admins only.
- `useMyTeamInvites({ enabled })`: the caller's pending invites (D-019 screen).
- `useTeamActions()` also has `cancelMyTeam` and `respondToTeamInvite`, which
  toast on failure.
- `useTeamActions()` → `registerTeam`, `changeTeamPartner` (each returns its
  status for the form to show inline), plus `adminCancelTeam` and
  `adminPromoteTeam` (which toast on failure). Every action invalidates the
  event's registrations, its teams and the partner invites.

`src/features/events/teams/teamStatusMessages.ts` has the copy for every status
(`PARTNER_ERROR_MESSAGES`, `REGISTER_TEAM_MESSAGES`, `CHANGE_PARTNER_MESSAGES`,
`CANCEL_TEAM_MESSAGES`, `PROMOTE_TEAM_MESSAGES`). Read them through
`registrationMessage({ map, status })`. It also has `CANCEL_MY_TEAM_MESSAGES`,
`RESPOND_INVITE_MESSAGES`, `COMPLETE_TEAMS_NOTE` and `PARTNER_DECLINED_NOTICE(name)`. `registrationStatusMessages.ts` gains
`team_event`, `use_cancel_team` and `use_promote_team`.
