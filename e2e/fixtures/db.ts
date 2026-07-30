import { createClient } from '@supabase/supabase-js'

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

// Mirrors src/lib/tournamentDate.ts's localDateString — kept local rather
// than importing from src/ so e2e/ has no dependency on app source, only the
// running app + database.
function localDateString(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function playerIdByName(name: string): Promise<string> {
  const { data, error } = await admin.from('players').select('id').eq('name', name).maybeSingle()
  if (error || !data) {
    throw new Error(
      `e2e fixture: player "${name}" not found in players — is the local DB seeded ` +
        `from supabase/seed.sql (run npm run db:reset)?`,
    )
  }
  return data.id as string
}

export interface TournamentFixture {
  tournamentId: string
  players: { admin: string; player: string; p3: string; p4: string }
}

/**
 * A 2-round, single-court tournament: round 1 pre-scored via SQL, round 2
 * left open. The smoke test enters round 2's score through the UI — that's
 * genuinely "the last score" (it flips the tournament from `live` to
 * `sealed`), not just "the only score".
 *
 * Registers all four players — required for both `admin_apply_tournament_ratings`
 * (Finish throws client-side if a match participant isn't in `registrations`)
 * and Oscars voting (`lobster_oscars_cast_vote` gates on registration).
 */
export async function seedTournament(): Promise<TournamentFixture> {
  // Distinct first names, deliberately — Oscars voting selects a player by
  // their rendered short name (see gameHelpers.shortLabelMap), and two
  // "Alejandro"s in the roster would make that selector ambiguous.
  const [jon, trunal, p3, p4] = await Promise.all([
    playerIdByName('Jon Grim'),
    playerIdByName('Trunal'),
    playerIdByName('Baturay Ucer'),
    playerIdByName('Gagan Shetty'),
  ])

  // Device trust auto-grants only a player's FIRST-ever device (see
  // require_trusted_device() / verify_player_pin — D-013). Re-running this
  // spec against the same un-reset local DB (e.g. iterating locally without
  // `db:reset` each time) leaves each player with a trusted device from the
  // previous run, so a fresh Playwright browser context — a genuinely new
  // device — no longer auto-trusts, and the player's vote in step 6 gets
  // rejected as pending_device_approval. Clearing prior devices for exactly
  // the players this fixture uses keeps every run behaving like the first.
  await admin.from('player_devices').delete().in('player_id', [jon, trunal, p3, p4])

  const { data: tournament, error: tErr } = await admin
    .from('tournaments')
    .insert({
      name: `E2E Smoke ${Date.now()}`,
      date: localDateString(),
      time: '18:00',
      location: 'E2E Court',
      max_players: 8,
      format: 'lobster_matching',
      status: 'active',
      duration: 90,
      gender_mode: 'mixed',
    })
    .select('id')
    .single()
  if (tErr || !tournament) {
    throw new Error(`e2e fixture: could not create tournament — ${tErr?.message}`)
  }
  const tournamentId = tournament.id as string

  const { error: regErr } = await admin.from('registrations').insert(
    [jon, trunal, p3, p4].map((playerId) => ({
      tournament_id: tournamentId,
      player_id: playerId,
      status: 'registered',
    })),
  )
  if (regErr) {
    throw new Error(`e2e fixture: could not register players — ${regErr.message}`)
  }

  const { error: matchErr } = await admin.from('matches').insert([
    {
      tournament_id: tournamentId,
      round: 1,
      court: 'Court 1',
      team1_ids: [jon, trunal],
      team2_ids: [p3, p4],
      score1: 6,
      score2: 3,
      completed: true,
    },
    {
      tournament_id: tournamentId,
      round: 2,
      court: 'Court 1',
      team1_ids: [jon, p3],
      team2_ids: [trunal, p4],
      score1: null,
      score2: null,
      completed: false,
    },
  ])
  if (matchErr) {
    throw new Error(`e2e fixture: could not create matches — ${matchErr.message}`)
  }

  return { tournamentId, players: { admin: jon, player: trunal, p3, p4 } }
}

/** FK `ON DELETE CASCADE` (matches, registrations, oscars, ratings) takes the rest. */
export async function deleteTournament(tournamentId: string): Promise<void> {
  await admin.from('tournaments').delete().eq('id', tournamentId)
}
