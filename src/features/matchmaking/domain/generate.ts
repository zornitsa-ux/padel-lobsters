import { bandCourts } from './courts'
import { auditFeasibility, leftyQuotaForRound } from './feasibility'
import { resolveConfig } from './presets'
import { refineSchedule } from './refine'
import { buildScheduleRun } from './report'
import { createRng } from './rng'
import { leftyIdSet } from './scheduleOps'
import { coSitOverlap, planSitouts } from './sitouts'
import { splitCourt } from './teams'
import type { GenerateInput, PlayerInput, Schedule, ScheduleRun } from './types'
import { generateInputSchema } from './types'

// Pipeline orchestration (DESIGN.md §3.1): audit → sit-outs → banding →
// splits → refine → report. Added to the §7 module map by D-013.

/**
 * Contract (M2.8):
 * - validates input (generateInputSchema), resolves config (presets.ts),
 *   creates the rng from the resolved seed
 * - throws when the feasibility audit reports infeasible
 * - construction consumes the per-round quota helpers so the initial schedule
 *   is hard-legal; refine keeps it so (and repairs any banding-forced
 *   excess — D-014)
 * - baselineCoSitOverlap for cost/report = coSitOverlap of the stage-1 plan
 * - deterministic: same input (incl. resolved seed) ⇒ deep-equal ScheduleRun
 */
export function generateSchedule(input: GenerateInput): ScheduleRun {
  const { tournamentId, players, courts, rounds, genderMode } = generateInputSchema.parse(input)
  const config = resolveConfig({ config: input.config, tournamentId })

  const feasibility = auditFeasibility({ players, courts, rounds, genderMode, config })
  if (!feasibility.feasible) {
    const reasons = feasibility.entries
      .filter((e) => e.status === 'infeasible')
      .map((e) => e.detail)
      .join('; ')
    throw new Error(`generateSchedule: infeasible input — ${reasons}`)
  }

  const rng = createRng(config.seed)
  const byId = new Map(players.map((p) => [p.playerId, p]))
  const leftyIds = leftyIdSet(players)

  const sitPlan = planSitouts({
    playerIds: players.map((p) => p.playerId),
    rounds,
    sittersPerRound: feasibility.sittersPerRound,
    rng,
  })
  const baselineCoSitOverlap = coSitOverlap({ plan: sitPlan })

  const schedule: Schedule = sitPlan.map((sitters) => {
    const sitSet = new Set(sitters)
    const playing = players.filter((p) => !sitSet.has(p.playerId))
    const bands = bandCourts({
      players: playing,
      courtsUsed: feasibility.courtsUsed,
      socialDial: config.socialDial,
      rng,
    })
    const roundQuota = leftyQuotaForRound({
      leftyCount: playing.filter((p) => leftyIds.has(p.playerId)).length,
      courtsUsed: feasibility.courtsUsed,
    })
    let doublesUsed = 0
    const matches = bands.map((court) => {
      const four = court.map((id) => byId.get(id)!) as [
        PlayerInput,
        PlayerInput,
        PlayerInput,
        PlayerInput,
      ]
      const match = splitCourt({
        players: four,
        config,
        genderMode,
        allowDoubleLefty: config.leftyRule === 'off' || doublesUsed < roundQuota,
      })
      if (config.leftyRule === 'hard') {
        doublesUsed += [match.team1, match.team2].filter((t) =>
          t.every((id) => leftyIds.has(id)),
        ).length
      }
      return match
    })
    return { matches, sitters }
  })

  const refined = refineSchedule({ schedule, players, config, genderMode, feasibility, rng })

  return buildScheduleRun({
    tournamentId,
    schedule: refined.schedule,
    players,
    config,
    genderMode,
    feasibility,
    baselineCoSitOverlap,
  })
}
