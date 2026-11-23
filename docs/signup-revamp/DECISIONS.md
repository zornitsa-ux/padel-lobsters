# Signup revamp: decisions

Code-facing decisions. Product decisions were made by the owner during design;
this file records how the code carries them out.

- **D-1. Levelling is stored in its own admin-only table** (`player_levelling`),
  not as `players` columns. `players` is read widely through `players_public`;
  answers are for analysis only. "Has levelled" is the row's existence.
- **D-2. Superseded by D-16.** "Needs levelling" = no levelling row and no played night: no
  `rating_events` row of kind `tournament` or `seed`, and no registration in a
  completed tournament. Rating events alone would gate regulars who have only
  played team or King of the Court nights. A `self_reset`-only player counts as
  not yet placed.
- **D-3. The start is written to `mm_rating`/`mm_sigma`**, the columns the
  matcher already prefers over the Playtomic prior. No new matcher input.
- **D-4. Playtomic level given at levelling: σ 0.7; walls answer: σ 1.0.**
  The higher uncertainty and the 3.0 cap apply only to starts set from
  answers (owner, during design).
- **D-5. Playtomic must be > 0.** `0` already means "not given" in
  `players.playtomic_level` and the forms.
- **D-6. A levelled player's Playtomic edit doesn't reset the start before
  their first played night; nothing resets to 0.** Otherwise a Settings save
  could undo levelling.
- **D-7. The gate is an RPC status plus a trigger.** The status gives the
  client a clean answer; the trigger covers every other path into
  `registrations` without editing the transfer and team RPCs (PIN removal PR 6
  rewrites the transfer ones).
- **D-8. Admins acting for another player aren't gated.** Admins keep the power
  to act for any player (CLAUDE.md); their forms already confirm on behalf.
- **D-9. Existing active registrations are left alone** at release.
- **D-10. "How did you find us" travels in `user_metadata`** and is written by
  the confirmed-user trigger: the account exists only after confirmation, and
  the signup form is the one place the answer is a single tap.
- **D-11. S4 (optional level) ships after S3 (gate)**, so no player registers
  themselves with neither a level nor a start.
- **D-12. Player-facing wording stays out of these docs.** It goes into the
  code with S2 and S4.
- **D-13. Team events are gated too** (owner, 12 Nov). The captain at team
  registration, the partner at invite acceptance (their row is already
  active, so acceptance is the point a partner acts for themselves).
- **D-14. Players without a Playtomic level show no level to members**
  (owner, 12 Nov). The levelling start stays admin-only in `mm_rating`; it is
  not written into `playtomic_level`, which would show a number the player
  never gave as their Playtomic level.
- **D-15. A level of 0 counts as 1.0 (`NO_LEVEL_START`, σ 1.0) in King of the
  Court seeding and the matcher's prior.** KotC seeds are computed on every
  viewer's device, and members can't read `mm_rating`, so reading it there
  (first proposed with D-14) would give admins and members different seeds.
  One public constant keeps them the same, errs low as the walls starts do,
  and replaces today's μ 0 for players an admin registers without a level.
- **D-16. "Needs levelling" = no level recorded** (owner, 16 Nov; supersedes
  D-2): no Playtomic level on file (`playtomic_level` > 0) and no levelling
  start (`player_levelling` row). Everyone must have a level, set by the
  player, an admin, or the captain who adds them. The gate checks only that.
  Playing a night no longer enters into it, so players who already have a
  level are never gated. The five questions are data collection, asked of
  players who already have a level through a separate prompt that never blocks
  registering (S3c).
- **D-17. The five questions for players with a level share the levelling
  table and flow** (S3c). An answers-only row (`start_source` `none`) keeps
  every answer in one place for the rerun, and the flow's `questions` mode
  reuses the screens. Only a real start counts for the gate and the reset
  guard. "Not now" on the Home prompt hides it on that device for good
  (owner, 18 Nov): a `localStorage` flag per player, no server state.
- **D-18. Paths that leave a player with no level** (owner, 18 Nov). Self-signup
  is held by the gate. A captain or admin who creates a new partner gives their
  level (S6a): an unaccepted partner still plays, so the accept gate alone
  wouldn't reach them. An admin registering a player with no level is asked
  for it first (S6b). An admin may still add or invite a player without a
  level: they're gated at sign-in. Adding someone to the community isn't
  entering an event. A captain picking an existing member with no level is
  refused (S6c, owner 23 Nov): every spot in an event needs a level, whoever
  writes it. Rows written before S6c stay as they are.
- **D-19. The admin register forms ask for a level only when none is recorded**
  (S6b): one player, a team's captain or member partner, and a member picked
  when an admin changes a team's partner. By D-16's rule: no Playtomic level and no levelling start. Admins read
  the starts from `player_levelling`; until they load, only the Playtomic level
  counts, which at worst asks for a level the player has (C-7 keeps their
  start). The level is saved through `admin_update_player` after the on-behalf
  confirm, which names it, and before the registration; if a save fails,
  nobody is registered (levels saved before it stay). A captain's own signup or
  partner change doesn't ask for a member partner's level (D-18).
- **D-20. One level range, and no end-to-end test for a stale page** (owner,
  23 Nov). Every form takes a Playtomic level from 0 to 7, and levelling and
  new partners take one above 0 (`levelProblem` in `parseLevel.ts`). Settings'
  old 0.5 minimum, from when signup required a level, refused profile saves
  for players with a level levelling had accepted (#190). In Settings a player
  who has a level can change it but not remove it: blank or 0 would gate them
  again (D-16), so `ownLevelProblem` refuses both; a player with none may
  leave it blank. Signup and the admin editor keep 0 to 7. The stale-page case
  (Register shown, then `needs_level` from the server) stays covered by the
  database tests and the client's `needs_level` handling; it gets no
  end-to-end test.
