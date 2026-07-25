import { z } from 'zod'
import { supabase } from '../../supabase'
import { saveMatches, type GeneratedMatch } from '../events/matchQueries'
import { generateSchedule } from './domain/generate'
import { initialRating } from './domain/rating/model'
import type { GenerateInput, PlayerInput, PlayerGender, ScheduleRun } from './domain/types'

// Application service: bridges the pure matcher domain to persistence.
// Preview generation is pure (no writes); commit persists the playable
// `matches` rows via the existing RLS-gated saveMatches AND records the run
// through the admin_record_schedule_run RPC (D-016). schedule_runs is a
// commit-time audit blob, intentionally not atomic with the matches write.

export type MmRating = { mu: number; sigma: number }

const mmRatingRowsSchema = z.array(
  z.object({ player_id: z.string(), mm_rating: z.number(), mm_sigma: z.number() }),
)

// Raw admin roster row → domain PlayerInput. Prior rating is mm_* when the
// engine has seen the player, else the self-reported-level prior (D-002).
// Gender normalizes '' / null / anything unexpected to 'unknown' (D-011).
export function toPlayerInput(row: {
  playerId: string
  name: string
  playtomicLevel: number
  mmRating: number | null
  mmSigma: number | null
  isLeftHanded: boolean
  gender: string | null
}): PlayerInput {
  const rating =
    row.mmRating != null && row.mmSigma != null
      ? { mu: row.mmRating, sigma: row.mmSigma }
      : initialRating({ playtomicLevel: row.playtomicLevel })
  return {
    playerId: row.playerId,
    name: row.name,
    mu: rating.mu,
    sigma: rating.sigma,
    isLeftHanded: row.isLeftHanded,
    gender: normalizeGender(row.gender),
  }
}

function normalizeGender(g: string | null): PlayerGender {
  return g === 'male' || g === 'female' ? g : 'unknown'
}

// The learned prior, keyed by player id. mm_* is admin-only (DESIGN §5) and so
// is absent from players_public, which backs the client roster — without this
// admin-gated read the roster's mmRating/mmSigma are structurally always null
// and the engine re-seeds every event from playtomic_level, never compounding
// what it learned. Players the engine has not yet seen are simply absent.
export async function fetchMmRatings(): Promise<Record<string, MmRating>> {
  const { data, error } = await supabase.rpc('admin_get_mm_ratings')
  if (error) {
    console.error('admin_get_mm_ratings error:', error)
    throw error
  }
  const rows = mmRatingRowsSchema.parse(data ?? [])
  return Object.fromEntries(
    rows.map((row) => [row.player_id, { mu: row.mm_rating, sigma: row.mm_sigma }]),
  )
}

// Pure preview: run the domain matcher. No writes — throwaway generations must
// not touch the DB (D-016).
export function previewSchedule(input: GenerateInput): ScheduleRun {
  return generateSchedule(input)
}

// ScheduleRun report → persisted `matches` rows (1-based round/court, mu-sum
// team levels). saveMatches flattens the rounds.
export function scheduleRunToMatchRows(run: ScheduleRun): GeneratedMatch[][] {
  return run.rounds.map((round, roundIdx) =>
    round.courts.map((court, courtIdx) => ({
      round: roundIdx + 1,
      court: String(courtIdx + 1),
      team1Ids: [...court.teams[0]],
      team2Ids: [...court.teams[1]],
      team1Level: court.teamSums[0],
      team2Level: court.teamSums[1],
      completed: false,
    })),
  )
}

// Logs one committed generation run. Returns the run id.
export async function recordScheduleRun(run: ScheduleRun): Promise<string> {
  const { data, error } = await supabase.rpc('admin_record_schedule_run', {
    input_payload: {
      tournament_id: run.tournamentId,
      config: run.config,
      seed: run.seed,
      report: run,
    },
  })
  if (error) {
    console.error('admin_record_schedule_run error:', error)
    throw error
  }
  return z.string().parse(data)
}

// Commit a previewed run: persist the playable matches first (load-bearing for
// realtime schedule sync — D-016), then record the audit run. The audit write
// is best-effort relative to the matches write; they use different mechanisms
// and are deliberately not one transaction.
export async function commitSchedule({ run }: { run: ScheduleRun }): Promise<{ runId: string }> {
  await saveMatches(run.tournamentId, scheduleRunToMatchRows(run))
  const runId = await recordScheduleRun(run)
  return { runId }
}
