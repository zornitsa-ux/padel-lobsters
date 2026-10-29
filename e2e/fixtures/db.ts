import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { ADMIN, PLAYER, SEED_PLAYERS } from './seed'

/* ════════════════════════════════════════════════════════════════════════════
   Fixture data access — arranges tournament state directly against the local
   Postgres via the service_role key, bypassing RLS. This is deliberate: the
   thing worth testing end-to-end is the phase-gated UI (schedule → finish →
   Oscars → reveal), not the matchmaking generator's ability to fill a
   16-player schedule, which has its own unit coverage. Reimplementing that
   generation flow through the browser would make the smoke test slower and
   flakier without covering anything the generator's own tests don't already.
   ════════════════════════════════════════════════════════════════════════════ */

// Local Supabase CLI demo service_role key. Identical for every `supabase
// start` because the CLI's default local JWT_SECRET is fixed — same pattern
// as the anon key hardcoded in .env.localdev.example. Not a production
// secret; the local API only listens on 127.0.0.1.
const DEFAULT_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? DEFAULT_SERVICE_ROLE_KEY

export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// The local superuser (fixed by the Supabase CLI, like the key above). For what
// the service role can't touch: event_teams has no grants for it, and the
// registration status log is append-only.
const DB_URL = process.env.E2E_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export const sql = postgres(DB_URL, { max: 2, idle_timeout: 1, onnotice: () => {} })

// Mirrors src/lib/tournamentDate.ts's localDateString — kept local rather
// than importing from src/ so e2e/ has no dependency on app source, only the
// running app + database.
function localDateString(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export interface TournamentFixture {
  tournamentId: string
  players: { admin: string; player: string; p3: string; p4: string }
  /** Finish writes each player's matchmaking rating; this puts the seed's back. */
  restoreRatings: () => Promise<void>
}

/**
 * A 2-round, single-court tournament today: round 1 pre-scored, round 2 left
 * open. The smoke test enters round 2's score through the UI — that's
 * genuinely "the last score" (it flips the tournament from `live` to
 * `sealed`), not just "the only score".
 *
 * Registers all four players — required for both `admin_apply_tournament_ratings`
 * (Finish throws client-side if a match participant isn't in `registrations`)
 * and Oscars voting (`lobster_oscars_cast_vote` gates on registration).
 */
export async function seedTournament(): Promise<TournamentFixture> {
  // Distinct first names, deliberately: Oscars voting selects a player by
  // their rendered short name (see gameHelpers.shortLabelMap).
  const [adminId, playerId, p3, p4] = [
    ADMIN.id,
    PLAYER.id,
    SEED_PLAYERS.noor.id,
    SEED_PLAYERS.kofi.id,
  ]
  const restoreRatings = await saveRatings({ playerIds: [adminId, playerId, p3, p4] })
  const { id: tournamentId } = await createEvent({
    name: `E2E Smoke ${Date.now()}`,
    status: 'active',
    daysAhead: 0,
    maxPlayers: 8,
  })
  await registerPlayers({ eventId: tournamentId, playerIds: [adminId, playerId, p3, p4] })

  const { error: matchErr } = await admin.from('matches').insert([
    {
      tournament_id: tournamentId,
      round: 1,
      court: 'Court 1',
      team1_ids: [adminId, playerId],
      team2_ids: [p3, p4],
      score1: 6,
      score2: 3,
      completed: true,
    },
    {
      tournament_id: tournamentId,
      round: 2,
      court: 'Court 1',
      team1_ids: [adminId, p3],
      team2_ids: [playerId, p4],
      score1: null,
      score2: null,
      completed: false,
    },
  ])
  if (matchErr) {
    throw new Error(`e2e fixture: could not create matches — ${matchErr.message}`)
  }

  return { tournamentId, players: { admin: adminId, player: playerId, p3, p4 }, restoreRatings }
}

async function saveRatings({ playerIds }: { playerIds: string[] }): Promise<() => Promise<void>> {
  const saved = await sql`
    select id, mm_rating, mm_sigma, mm_rating_updated_at from players where id in ${sql(playerIds)}`
  return async () => {
    for (const row of saved) {
      await sql`
        update players
           set mm_rating = ${row.mm_rating}, mm_sigma = ${row.mm_sigma},
               mm_rating_updated_at = ${row.mm_rating_updated_at}
         where id = ${row.id}`
    }
  }
}

/**
 * Removes an event a spec created, with the rows that block a tournament
 * delete (registrations and teams are RESTRICT). Cascades take the rest.
 * The status log goes after the registrations: deleting one logs it.
 */
export async function deleteEvent({ id }: { id: string }): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from registrations where tournament_id = ${id}`
    await tx`delete from registration_status_events where tournament_id = ${id}`
    await tx`delete from event_teams where tournament_id = ${id}`
    await tx`delete from tournaments where id = ${id}`
  })
}

/** Runs every cleanup step, in order, even when one fails; then reports the failures. */
export async function cleanUp(...steps: (() => Promise<unknown>)[]): Promise<void> {
  const failures: unknown[] = []
  for (const step of steps) {
    try {
      await step()
    } catch (error) {
      failures.push(error)
    }
  }
  if (failures.length) throw new AggregateError(failures, 'e2e cleanup failed')
}

export interface EventOptions {
  name?: string
  entryMode?: 'individual' | 'team'
  format?: 'lobster_matching' | 'king_of_court'
  status?: 'upcoming' | 'active'
  maxPlayers?: number
  daysAhead?: number
}

/** An event no one has registered for, upcoming by default. Delete it with deleteEvent. */
export async function createEvent({
  name = `E2E event ${Date.now()}`,
  entryMode = 'individual',
  format = 'lobster_matching',
  status = 'upcoming',
  maxPlayers = 16,
  daysAhead = 10,
}: EventOptions = {}): Promise<{ id: string; name: string }> {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  const { data, error } = await admin
    .from('tournaments')
    .insert({
      name,
      date: localDateString(date),
      time: '19:00',
      location: 'E2E Court',
      max_players: maxPlayers,
      format,
      entry_mode: entryMode,
      status,
      duration: 90,
      gender_mode: 'mixed',
      total_price: maxPlayers * 10,
      tikkie_link: 'https://tikkie.me/pay/e2e',
      courts: [{ name: 'Court 1', booked: true }],
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`e2e fixture: could not create an event: ${error?.message}`)
  return { id: data.id, name }
}

/** Registers players on an individual event, as if each had signed up. */
export async function registerPlayers({
  eventId,
  playerIds,
}: {
  eventId: string
  playerIds: string[]
}): Promise<void> {
  const { error } = await admin.from('registrations').insert(
    playerIds.map((playerId) => ({
      tournament_id: eventId,
      player_id: playerId,
      status: 'registered',
    })),
  )
  if (error) throw new Error(`e2e fixture: could not register players: ${error.message}`)
}

export const PLAYER_PASSWORD = 'E2E-Password-2026'

export interface CreatedPlayer {
  id: string
  firstName: string
  email: string
}

/**
 * A throwaway player with a password: the auth user, and the players row its
 * signup trigger creates. The first name is unique, so pickers can find it.
 * Delete it with deletePlayer.
 */
export async function createPlayer({ email }: { email?: string } = {}): Promise<CreatedPlayer> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const firstName = `Zed${stamp.slice(-7)}`
  const address = email ?? `e2e-${stamp}@lobsters.test`
  const { data, error } = await admin.auth.admin.createUser({
    email: address,
    password: PLAYER_PASSWORD,
    email_confirm: true,
    user_metadata: { name: `${firstName} Tester` },
  })
  if (error || !data.user)
    throw new Error(`e2e fixture: could not create ${address}: ${error?.message}`)
  return { id: data.user.id, firstName, email: address }
}

/** Removes a player made by a spec, with the rows that would block it. */
export async function deletePlayer({ id }: { id: string }): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from registrations where player_id = ${id}`
    await tx`delete from registration_status_events where player_id = ${id}`
    await tx`delete from event_teams where captain_id = ${id}`
    await tx`delete from registration_transfers where ${id} in (from_player_id, to_player_id)`
    await tx`delete from partner_invites where ${id} in (requested_by, invited_by)`
    await tx`delete from players where id = ${id}`
    await tx`delete from auth.users where id = ${id}`
  })
}

/** For accounts a spec signed up through the app, known only by email. */
export async function deletePlayerByEmail({ email }: { email: string }): Promise<void> {
  const users = await sql`select id from auth.users where email = ${email}`
  for (const { id } of users) await deletePlayer({ id })
}
