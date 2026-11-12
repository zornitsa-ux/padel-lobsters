# Signup revamp: decisions

Code-facing decisions. Product decisions were made by the owner during design;
this file records how the code carries them out.

- **D-1. Levelling is stored in its own admin-only table** (`player_levelling`),
  not as `players` columns. `players` is read widely through `players_public`;
  answers are for analysis only. "Has levelled" is the row's existence.
- **D-2. "Needs levelling" = no levelling row and no played night**: no
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
