# Account deletion: decisions

Product decisions were made by the owner on 24 Nov 2026. This file records
them and how the code carries them out.

- **D-1. Anonymise the row, never delete it.** Deleting `players` either
  cascades away history or fails on no-action foreign keys, and match results
  hold ids in arrays that no foreign key protects. `status = 'deleted'` plus a
  wiped row keeps every result intact.
- **D-2. Name: "Anonymous <Animal> #N"** (owner). N is a running number from a
  sequence; the animal cycles through 12 with it. The pattern is reserved,
  so the client can tell a deleted account from its name alone, including
  in RPCs that return only names (Oscars, security panels).
- **D-3. Team spots stay with the remaining player** (owner). A team must have
  two active rows (`registrations_team_consistent`), so the deleted member's
  row stays active under the anonymised name until it's replaced through
  `change_team_partner`. The captain role moves to the partner so they can
  replace them. Admins see the team in follow-ups.
- **D-4. Cancellation is the normal one, with no refund** (owner: "same as a
  normal cancellation"). Paid spots aren't refunded on any cancellation, so
  the summary tells the member and points them to a spot transfer first.
- **D-5. Open shop requests are cancelled; every custom name of theirs is
  cleared** (owner). Delivered items keep their row for the shop's counts,
  without the name.
- **D-6. Admins step down first, by hand** (owner). The app has no role
  management, and the role lives in `players.role` and the token's
  `app_metadata`. The delete RPCs refuse an admin target, so the
  last-admin problem can't arise.
- **D-7. One path for every removal.** `admin_delete_player` (the old soft
  delete) and `admin_purge_player` (service-role hard delete) are dropped,
  and so is the pending-approval flow (the roster's list with Approve,
  Reject and Link, and its two Admin entries), whose Reject and Link used
  them. Nothing creates `pending` players since self-signup.
- **D-8. Shut out the leftover token with three checks, not a global hook.**
  A `db_pre_request` check on every PostgREST request would also close the
  hour, but it costs a lookup on every request and a bug in it locks
  everyone out. Freezing the row, refusing new links to a deleted player and
  the avatar policy cover every write that could put data back.
- **D-9. Wipe now, keep one line** (owner). Security events and old-email
  history go with the account. One `account_deleted_*` event records when
  and whether the member or an admin did it.
- **D-10. Final immediately; a fresh account on return** (owner). No grace
  period and no restore. The auth user is deleted in the same transaction,
  so the email can sign up again as a new member, with nothing linking it
  to the old row.
- **D-11. The code is a fresh email sign-in, checked from `amr`.**
  `reauthenticate()` sends a code that only `updateUser` can consume, so a
  database function can't verify it. A code sign-in (`signInWithOtp` +
  `verifyOtp`) leaves an `otp` entry with its time in the token, and the
  delete RPCs accept one from the last 10 minutes. The email is the usual
  sign-in code email; the screen says why it's coming.
- **D-12. The avatar is removed by the client, before the RPC.** Storage
  objects can't be deleted from SQL. Removing first means a failure leaves
  no public photo behind a deleted account; the worst case is a member who
  lost their photo and retries.
- **D-13. Admin deletion:** non-admin members only, from the player's admin
  page, with `useConfirmOnBehalf`, the player's name typed, and a code sent
  to the admin (owner).
- **D-14. Reserved names by trigger, not in each writer.** Eight functions
  write `players.name`; one trigger covers them all, and any added later.
  Only the signup hook and `create_partner_player` check first, to answer
  in their own terms.
