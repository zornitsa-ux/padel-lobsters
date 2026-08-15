-- ============================================================================
-- Registration integrity checks.
--
-- Covers the capacity guard (20260806211143), the capacity-aware RPCs
-- (20260806211259), the audit trail (20260806210842), the no-hard-delete
-- changes (20260806211102), the max_players constraints (20260806213000)
-- and the transfer row-scoping fix (20260815050555).
--
-- There is no pgTAP harness in this repo, so this is a plain script: every
-- check raises on failure and the whole thing runs inside a transaction that
-- rolls back, so it leaves no fixtures behind. `supabase/seed.sql` creates no
-- registrations, so it builds its own.
--
-- Run against a local stack:
--
--   docker exec -i supabase_db_padel-lobsters \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/registration_integrity.sql
--
-- Prints one line per check. Any failure aborts with an exception.
-- ============================================================================

begin;

set local client_min_messages = notice;

do $$
declare
  v_t uuid;
  v_t2 uuid;
  v_players uuid[];
  v_reg uuid;
  v_id uuid;
  v_status text;
  v_promoted uuid;
  v_count integer;
  v_rows integer;
  v_err text;
  v_ok boolean;
  v_t3 uuid;
  v_tp uuid[];
  v_xfer_id uuid;
  v_from_reg uuid;
  v_reg_a uuid;
  v_reg_b uuid;
  v_pm_a text;
  v_pm_b text;
  v_reason text;
begin
  -- ── Fixtures: a 2-player event and 6 players ──────────────────────────────
  insert into public.tournaments (name, date, time, max_players, status)
  values ('CAPACITY TEST', current_date + 30, '18:00', 2, 'upcoming')
  returning id into v_t;

  with ins as (
    insert into public.players (name, status)
    select 'Capacity Test P' || g, 'active' from generate_series(1, 6) g
    returning id, name
  )
  select array_agg(id order by name) into v_players from ins;

  -- The RPCs are admin-gated via require_admin(), which reads the JWT claim.
  -- psql has no JWT, so forge one: auth.uid() and auth.jwt() both read this
  -- GUC. CHECK 7b clears it again to prove the gate actually bites.
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_players[6],
      'app_metadata', json_build_object('role', 'admin')
    )::text,
    true
  );

  -- ── 1. Inserting past the cap lands on the waitlist ───────────────────────
  perform set_config('app.audit_source', 'test_fixture', true);
  insert into public.registrations (tournament_id, player_id, status)
  values (v_t, v_players[1], 'registered'), (v_t, v_players[2], 'registered');

  insert into public.registrations (tournament_id, player_id, status)
  values (v_t, v_players[3], 'waitlist'), (v_t, v_players[4], 'waitlist');

  select count(*) into v_count from public.registrations
   where tournament_id = v_t and status = 'registered';
  if v_count <> 2 then
    raise exception 'CHECK 1 FAILED: expected 2 registered, got %', v_count;
  end if;
  raise notice 'CHECK 1 ok  — event is full at 2/2 with 2 waitlisted';

  -- ── 2. Promoting into a full event is refused by the trigger ──────────────
  begin
    update public.registrations set status = 'registered'
     where tournament_id = v_t and player_id = v_players[3];
    raise exception 'CHECK 2 FAILED: raw promotion into a full event succeeded';
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_err = message_text;
    if v_err <> 'tournament_full' then raise; end if;
  end;
  raise notice 'CHECK 2 ok  — raw waitlist->registered at cap raises tournament_full';

  -- ── 3. Cancelling a WAITLISTED player promotes nobody  (the LOBS #10 bug) ─
  select r.id into v_reg from public.registrations r
   where r.tournament_id = v_t and r.player_id = v_players[4];
  select c.status, c.promoted_registration_id into v_status, v_promoted
    from public.cancel_registration(v_reg) c;

  if v_status <> 'cancelled' then
    raise exception 'CHECK 3 FAILED: expected cancelled, got %', v_status;
  end if;
  if v_promoted is not null then
    raise exception 'CHECK 3 FAILED: a waitlist cancellation promoted someone (%)', v_promoted;
  end if;
  select count(*) into v_count from public.registrations
   where tournament_id = v_t and status = 'registered';
  if v_count <> 2 then
    raise exception 'CHECK 3 FAILED: registered count moved to % after a waitlist cancel', v_count;
  end if;
  raise notice 'CHECK 3 ok  — cancelling a waitlisted player promotes nobody';

  -- ── 4. Cancelling a REGISTERED player promotes exactly one ────────────────
  select r.id into v_reg from public.registrations r
   where r.tournament_id = v_t and r.player_id = v_players[1];
  select c.status, c.promoted_player_id into v_status, v_promoted
    from public.cancel_registration(v_reg) c;

  if v_promoted is distinct from v_players[3] then
    raise exception 'CHECK 4 FAILED: expected P3 promoted, got %', v_promoted;
  end if;
  select count(*) into v_count from public.registrations
   where tournament_id = v_t and status = 'registered';
  if v_count <> 2 then
    raise exception 'CHECK 4 FAILED: expected 2 registered after swap, got %', v_count;
  end if;
  raise notice 'CHECK 4 ok  — cancelling a registered player promotes the oldest waitlister';

  -- ── 5. payment_status edits still work at cap ─────────────────────────────
  update public.registrations set payment_status = 'paid'
   where tournament_id = v_t and status = 'registered';
  raise notice 'CHECK 5 ok  — payment edits on a full event are unaffected';

  -- ── 6. register_for_tournament — the primary sign-up path ─────────────────
  -- The client no longer decides registered-vs-waitlist, so this RPC *is* the
  -- capacity decision. Run as a player signing themselves up, which is how
  -- every self-registration arrives: a plain JWT, no admin claim.
  insert into public.tournaments (name, date, time, max_players, status)
  values ('CAPACITY TEST 2', current_date + 31, '18:00', 1, 'upcoming')
  returning id into v_t2;

  perform set_config(
    'request.jwt.claims', json_build_object('sub', v_players[5])::text, true
  );

  -- 6a. A spot is free: registered.
  select r.status, r.registration_id into v_status, v_reg
    from public.register_for_tournament(v_t2, v_players[5]) r;
  if v_status <> 'registered' then
    raise exception 'CHECK 6a FAILED: expected registered, got %', v_status;
  end if;
  raise notice 'CHECK 6a ok — a player can sign themselves up without an admin claim';

  -- 6b. A double-tap reports the row that already exists rather than tripping
  -- registrations_tournament_player_active_uniq.
  select r.status, r.registration_id into v_status, v_id
    from public.register_for_tournament(v_t2, v_players[5]) r;
  if v_status <> 'already_registered' or v_id is distinct from v_reg then
    raise exception 'CHECK 6b FAILED: expected already_registered on %, got % on %',
      v_reg, v_status, v_id;
  end if;
  raise notice 'CHECK 6b ok — a double-tap returns already_registered, not a constraint error';

  -- 6c. Unknown event: a value, not an exception.
  select r.status into v_status
    from public.register_for_tournament(gen_random_uuid(), v_players[5]) r;
  if v_status <> 'not_found' then
    raise exception 'CHECK 6c FAILED: expected not_found, got %', v_status;
  end if;
  raise notice 'CHECK 6c ok — an unknown event returns not_found';

  -- 6d. Registering *someone else* is an admin action.
  begin
    perform public.register_for_tournament(v_t2, v_players[1]);
    raise exception 'CHECK 6d FAILED: a non-admin registered another player';
  exception when sqlstate 'P0001' then
    null;
  end;
  raise notice 'CHECK 6d ok — registering another player requires admin';

  -- 6e. Past the cap: waitlist, not an error. This is the branch the client
  -- used to get wrong — it counted a stale cache and inserted 'registered'.
  select count(*) into v_count from public.registrations
   where tournament_id = v_t and status = 'registered';
  if v_count < 2 then
    raise exception 'CHECK 6e PRECONDITION FAILED: event not full (%)', v_count;
  end if;
  select r.status, r.registration_id into v_status, v_reg
    from public.register_for_tournament(v_t, v_players[5]) r;
  if v_status <> 'waitlist' then
    raise exception 'CHECK 6e FAILED: expected waitlist, got %', v_status;
  end if;
  select r.status into v_status from public.registrations r where r.id = v_reg;
  if v_status <> 'waitlist' then
    raise exception 'CHECK 6e FAILED: row written as %, not waitlist', v_status;
  end if;
  raise notice 'CHECK 6e ok — sign-ups past the cap become waitlist, not an error';

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_players[6],
      'app_metadata', json_build_object('role', 'admin')
    )::text,
    true
  );

  -- ── 7a. promote_waitlist_registration refuses softly when full ────────────
  -- A value, not an exception, so the Confirm button can show a toast.
  select p.status into v_status from public.promote_waitlist_registration(v_reg) p;
  if v_status <> 'tournament_full' then
    raise exception 'CHECK 7a FAILED: expected tournament_full, got %', v_status;
  end if;
  select r.status into v_status from public.registrations r where r.id = v_reg;
  if v_status <> 'waitlist' then
    raise exception 'CHECK 7a FAILED: player was promoted anyway (now %)', v_status;
  end if;
  raise notice 'CHECK 7a ok — Confirm on a full event returns tournament_full, promotes nobody';

  -- ── 7b. ...and the admin gate is real ─────────────────────────────────────
  perform set_config('request.jwt.claims', '', true);
  begin
    perform public.promote_waitlist_registration(v_reg);
    raise exception 'CHECK 7b FAILED: promote succeeded without an admin JWT';
  exception when sqlstate 'P0001' then
    null;
  end;
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_players[6],
      'app_metadata', json_build_object('role', 'admin')
    )::text,
    true
  );
  raise notice 'CHECK 7b ok — the RPCs are admin-gated';

  -- ── 8. The audit trail recorded all of it ─────────────────────────────────
  select count(*) into v_count from public.registration_status_events
   where tournament_id = v_t;
  if v_count < 7 then
    raise exception 'CHECK 8 FAILED: expected >= 7 audit rows, got %', v_count;
  end if;

  select count(*) into v_count from public.registration_status_events
   where tournament_id = v_t
     and source = 'cancel_registration'
     and old_status = 'waitlist' and new_status = 'registered';
  if v_count <> 1 then
    raise exception 'CHECK 8 FAILED: expected 1 auto-promotion tagged cancel_registration, got %', v_count;
  end if;
  raise notice 'CHECK 8 ok  — audit trail records the promotion and attributes it to the cancel';

  -- ── 9. Events with registrations cannot be deleted ────────────────────────
  begin
    delete from public.tournaments where id = v_t;
    raise exception 'CHECK 9 FAILED: deleted an event that still has registrations';
  exception when foreign_key_violation then
    null;
  end;
  raise notice 'CHECK 9 ok  — deleting an event with registrations raises 23503';

  -- ── 10. admin_delete_player is a soft delete ──────────────────────────────
  if not public.admin_delete_player(v_players[2]) then
    raise exception 'CHECK 10 FAILED: admin_delete_player reported no change';
  end if;
  select status into v_status from public.players where id = v_players[2];
  if v_status <> 'deleted' then
    raise exception 'CHECK 10 FAILED: expected status deleted, got %', v_status;
  end if;
  select count(*) into v_count from public.registrations
   where tournament_id = v_t and player_id = v_players[2];
  if v_count = 0 then
    raise exception 'CHECK 10 FAILED: soft-deleting a player removed their registrations';
  end if;
  raise notice 'CHECK 10 ok — a deleted player keeps their registration history';

  -- ── 11. A soft-deleted player frees their email for re-signup ─────────────
  -- Both layers matter: players_email_lower_unique *and* auth.users' own
  -- unique constraint, which the email sync trigger writes through to.
  update public.players set email = 'capacity-test@example.com' where id = v_players[5];
  perform public.admin_delete_player(v_players[5]);

  select email into v_err from public.players where id = v_players[5];
  if v_err is not null then
    raise exception 'CHECK 11 FAILED: deleted player kept their email (%)', v_err;
  end if;
  select email into v_err from auth.users where id = v_players[5];
  if v_err = 'capacity-test@example.com' then
    raise exception 'CHECK 11 FAILED: auth.users still holds the address, login not revoked';
  end if;

  update public.players set email = 'capacity-test@example.com' where id = v_players[6];
  raise notice 'CHECK 11 ok — a deleted player releases their address at both layers';

  -- ── 12. The self-delete policy is gone ────────────────────────────────────
  select exists(
    select 1 from pg_policy
     where polrelid = 'public.registrations'::regclass
       and polname = 'registrations_self_delete'
  ) into v_ok;
  if v_ok then
    raise exception 'CHECK 12 FAILED: registrations_self_delete policy still exists';
  end if;
  raise notice 'CHECK 12 ok — players can no longer delete their own registrations';

  -- ── 13. max_players has exactly one meaning ───────────────────────────────
  -- Neither "uncapped" nor "zero spots" is reachable, which is what lets the
  -- client render the cap it is enforcing instead of a fallback.
  begin
    update public.tournaments set max_players = 0 where id = v_t;
    raise exception 'CHECK 13 FAILED: max_players = 0 was accepted';
  exception when check_violation then
    null;
  end;
  begin
    update public.tournaments set max_players = null where id = v_t;
    raise exception 'CHECK 13 FAILED: max_players = null was accepted';
  exception when not_null_violation then
    null;
  end;
  raise notice 'CHECK 13 ok — max_players rejects null and non-positive values';

  -- ── 14. apply_registration_transfer row scoping (20260815050555) ──────────
  -- A dedicated event and 12 fresh players so nothing here interacts with the
  -- capacity fixtures above.
  insert into public.tournaments (name, date, time, max_players, status)
  values ('TRANSFER TEST', current_date + 32, '18:00', 16, 'upcoming')
  returning id into v_t3;

  with ins as (
    insert into public.players (name, status)
    select 'Transfer Test P' || lpad(g::text, 2, '0'), 'active' from generate_series(1, 12) g
    returning id, name
  )
  select array_agg(id order by name) into v_tp from ins;

  -- 14a. Recipient has TWO stale cancelled rows and no active row. The old
  -- code matched both with `status in ('waitlist','cancelled')` and flipped
  -- both to 'registered' in one UPDATE, tripping the unique index — this is
  -- the exact production crash (23505 on registrations_tournament_player_
  -- active_uniq).
  insert into public.registrations (tournament_id, player_id, status, payment_method)
  values (v_t3, v_tp[1], 'registered', '')
  returning id into v_from_reg;
  insert into public.registrations (tournament_id, player_id, status, payment_method)
  values (v_t3, v_tp[2], 'cancelled', 'old_pm_1')
  returning id into v_reg_a;
  insert into public.registrations (tournament_id, player_id, status, payment_method)
  values (v_t3, v_tp[2], 'cancelled', 'old_pm_2')
  returning id into v_reg_b;

  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (v_t3, v_tp[1], v_tp[2])
  returning id into v_xfer_id;

  select public.apply_registration_transfer(v_xfer_id) into v_status;
  if v_status <> 'accepted' then
    raise exception 'CHECK 14a FAILED: expected accepted, got %', v_status;
  end if;
  select count(*) into v_count from public.registrations
   where tournament_id = v_t3 and player_id = v_tp[2] and status = 'registered';
  if v_count <> 1 then
    raise exception 'CHECK 14a FAILED: expected exactly 1 registered row for recipient, got %', v_count;
  end if;
  select payment_method, status into v_pm_a, v_status from public.registrations where id = v_reg_a;
  if v_pm_a <> 'old_pm_1' or v_status <> 'cancelled' then
    raise exception 'CHECK 14a FAILED: stale cancelled row % was mutated (status=%, payment_method=%)',
      v_reg_a, v_status, v_pm_a;
  end if;
  select payment_method, status into v_pm_b, v_status from public.registrations where id = v_reg_b;
  if v_pm_b <> 'old_pm_2' or v_status <> 'cancelled' then
    raise exception 'CHECK 14a FAILED: stale cancelled row % was mutated (status=%, payment_method=%)',
      v_reg_b, v_status, v_pm_b;
  end if;
  raise notice 'CHECK 14a ok — a recipient with 2 stale cancelled rows accepts without reviving either';

  -- 14b. Recipient has one cancelled row and one waitlist row. Only the
  -- waitlist row may become 'registered' — a cancelled row is never revived.
  insert into public.registrations (tournament_id, player_id, status)
  values (v_t3, v_tp[3], 'registered')
  returning id into v_from_reg;
  insert into public.registrations (tournament_id, player_id, status, payment_method)
  values (v_t3, v_tp[4], 'cancelled', 'old_pm_3')
  returning id into v_reg_a;
  insert into public.registrations (tournament_id, player_id, status)
  values (v_t3, v_tp[4], 'waitlist')
  returning id into v_reg_b;

  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (v_t3, v_tp[3], v_tp[4])
  returning id into v_xfer_id;

  select public.apply_registration_transfer(v_xfer_id) into v_status;
  if v_status <> 'accepted' then
    raise exception 'CHECK 14b FAILED: expected accepted, got %', v_status;
  end if;
  select status into v_status from public.registrations where id = v_reg_b;
  if v_status <> 'registered' then
    raise exception 'CHECK 14b FAILED: the waitlist row was not promoted (now %)', v_status;
  end if;
  select payment_method, status into v_pm_a, v_status from public.registrations where id = v_reg_a;
  if v_pm_a <> 'old_pm_3' or v_status <> 'cancelled' then
    raise exception 'CHECK 14b FAILED: the cancelled row % was mutated (status=%, payment_method=%)',
      v_reg_a, v_status, v_pm_a;
  end if;
  select count(*) into v_count from public.registrations
   where tournament_id = v_t3 and player_id = v_tp[4];
  if v_count <> 2 then
    raise exception 'CHECK 14b FAILED: expected still 2 rows for recipient (no insert), got %', v_count;
  end if;
  raise notice 'CHECK 14b ok — a waitlist row is promoted in place, a sibling cancelled row is untouched';

  -- 14c. Recipient already holds a registered row plus a stale cancelled row
  -- (a transfer offer that went stale after the recipient separately
  -- registered — the TOCTOU case). Must refuse before touching the from-side.
  insert into public.registrations (tournament_id, player_id, status)
  values (v_t3, v_tp[5], 'registered')
  returning id into v_from_reg;
  insert into public.registrations (tournament_id, player_id, status)
  values (v_t3, v_tp[6], 'registered')
  returning id into v_reg_a;
  insert into public.registrations (tournament_id, player_id, status, payment_method)
  values (v_t3, v_tp[6], 'cancelled', 'old_pm_4')
  returning id into v_reg_b;

  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (v_t3, v_tp[5], v_tp[6])
  returning id into v_xfer_id;

  select public.apply_registration_transfer(v_xfer_id) into v_status;
  if v_status <> 'to_already_registered' then
    raise exception 'CHECK 14c FAILED: expected to_already_registered, got %', v_status;
  end if;
  select status into v_status from public.registrations where id = v_from_reg;
  if v_status <> 'registered' then
    raise exception 'CHECK 14c FAILED: from-side was written despite the refusal (now %)', v_status;
  end if;
  select count(*) into v_count from public.registrations
   where tournament_id = v_t3 and player_id = v_tp[6];
  if v_count <> 2 then
    raise exception 'CHECK 14c FAILED: recipient row count changed (expected 2, got %)', v_count;
  end if;
  raise notice 'CHECK 14c ok — a recipient already registered refuses cleanly with no partial write';

  -- 14d. From-side has no registered row at all.
  insert into public.registrations (tournament_id, player_id, status, payment_method)
  values (v_t3, v_tp[8], 'cancelled', 'old_pm_5')
  returning id into v_reg_a;

  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (v_t3, v_tp[7], v_tp[8])
  returning id into v_xfer_id;

  select public.apply_registration_transfer(v_xfer_id) into v_status;
  if v_status <> 'from_not_registered' then
    raise exception 'CHECK 14d FAILED: expected from_not_registered, got %', v_status;
  end if;
  select payment_method, status into v_pm_a, v_status from public.registrations where id = v_reg_a;
  if v_pm_a <> 'old_pm_5' or v_status <> 'cancelled' then
    raise exception 'CHECK 14d FAILED: recipient row was mutated (status=%, payment_method=%)', v_status, v_pm_a;
  end if;
  raise notice 'CHECK 14d ok — a from-player who is not registered refuses without touching the recipient';

  -- 14e. The single-active-row invariant is enforced by an index, not by this
  -- file: sweeping for duplicate active rows could never fail, because the
  -- offending UPDATE aborts the transaction with 23505 before any SELECT could
  -- observe one. So assert the index itself is still there and still partial —
  -- apply_registration_transfer's un-LIMITed `select ... into` relies on it to
  -- bound the recipient lookup to one row. 14a–14d are the behavioural cover.
  select exists(
    select 1 from pg_index i
      join pg_class c on c.oid = i.indexrelid
     where c.relname = 'registrations_tournament_player_active_uniq'
       and i.indisunique
       and pg_get_expr(i.indpred, i.indrelid) is not null
  ) into v_ok;
  if not v_ok then
    raise exception 'CHECK 14e FAILED: registrations_tournament_player_active_uniq is missing or no longer a partial unique index';
  end if;
  raise notice 'CHECK 14e ok — the partial unique index that bounds the recipient lookup is intact';

  -- 14f. The audit trail still attributes both halves of the swap to the RPC
  -- that ran it, through the extracted apply_registration_transfer. v_tp[2]
  -- is 'registered' from 14a — reuse it as the from-player, sending to a
  -- recipient (v_tp[7]) that holds no rows at all.
  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (v_t3, v_tp[2], v_tp[7])
  returning id into v_xfer_id;

  select r.status into v_status from public.admin_force_accept_transfer(v_xfer_id) r;
  if v_status <> 'accepted' then
    raise exception 'CHECK 14f FAILED: expected accepted, got %', v_status;
  end if;
  select count(*) into v_count from public.registration_status_events
   where tournament_id = v_t3
     and source = 'admin_force_accept_transfer'
     and ((old_status = 'registered' and new_status = 'cancelled')
       or (new_status = 'registered' and player_id = v_tp[7]));
  if v_count <> 2 then
    raise exception 'CHECK 14f FAILED: expected 2 audit rows tagged admin_force_accept_transfer, got %', v_count;
  end if;
  raise notice 'CHECK 14f ok — both halves of an admin-forced transfer are attributed in the audit trail';

  -- 14g. A terminal refusal closes the offer instead of leaving it 'pending'.
  -- A pending row keeps the accept banner on the recipient's dashboard, where
  -- every tap re-fails, so the entry points must retire it.
  insert into public.registrations (tournament_id, player_id, status)
  values (v_t3, v_tp[9], 'registered');
  insert into public.registrations (tournament_id, player_id, status)
  values (v_t3, v_tp[10], 'registered');

  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (v_t3, v_tp[9], v_tp[10])
  returning id into v_xfer_id;

  select r.status into v_status from public.admin_force_accept_transfer(v_xfer_id) r;
  if v_status <> 'to_already_registered' then
    raise exception 'CHECK 14g FAILED: expected to_already_registered, got %', v_status;
  end if;
  select status, closed_reason into v_status, v_reason
    from public.registration_transfers where id = v_xfer_id;
  if v_status <> 'auto_closed' or v_reason <> 'to_already_registered' then
    raise exception 'CHECK 14g FAILED: offer left as status=%, closed_reason=%', v_status, v_reason;
  end if;
  raise notice 'CHECK 14g ok — an offer to an already-registered recipient is auto-closed, not left pending';

  -- 14h. Same for the other terminal refusal: the sender no longer holds a
  -- registered row (they cancelled, or already transferred it away).
  insert into public.registration_transfers (tournament_id, from_player_id, to_player_id)
  values (v_t3, v_tp[11], v_tp[12])
  returning id into v_xfer_id;

  select r.status into v_status from public.admin_force_accept_transfer(v_xfer_id) r;
  if v_status <> 'from_not_registered' then
    raise exception 'CHECK 14h FAILED: expected from_not_registered, got %', v_status;
  end if;
  select status, closed_reason into v_status, v_reason
    from public.registration_transfers where id = v_xfer_id;
  if v_status <> 'auto_closed' or v_reason <> 'from_not_registered' then
    raise exception 'CHECK 14h FAILED: offer left as status=%, closed_reason=%', v_status, v_reason;
  end if;
  raise notice 'CHECK 14h ok — an offer from a player who is no longer registered is auto-closed';

  raise notice '';
  raise notice 'All registration integrity checks passed.';
end $$;

rollback;
