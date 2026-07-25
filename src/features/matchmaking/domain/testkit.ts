import { leftyQuotaForRound } from './feasibility'
import type { LeftyRule, PlayerInput, ResolvedConfig, Schedule, Team, Weights } from './types'
import { DEFAULT_WEIGHTS } from './types'

// Deterministic fixture builders + invariant assertions shared by the
// matcher acceptance suites (M2.2–M2.10). Test-only; not part of the engine.

export const mkPlayer = (
  overrides: Partial<PlayerInput> & Pick<PlayerInput, 'playerId'>,
): PlayerInput => ({
  name: overrides.playerId,
  mu: 3,
  sigma: 0.3,
  isLeftHanded: false,
  gender: 'unknown',
  ...overrides,
})

export const mkIds = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `p${String(i + 1).padStart(2, '0')}`)

/**
 * Roster with descending mu; the first `lefties` players are left-handed;
 * genders fill male → female → unknown in id order.
 */
export const mkRoster = ({
  count,
  lefties = 0,
  males = 0,
  females = 0,
  muTop = 4.5,
  muStep = 0.1,
}: {
  count: number
  lefties?: number
  males?: number
  females?: number
  muTop?: number
  muStep?: number
}): PlayerInput[] =>
  mkIds(count).map((playerId, i) =>
    mkPlayer({
      playerId,
      mu: muTop - i * muStep,
      isLeftHanded: i < lefties,
      gender: i < males ? 'male' : i < males + females ? 'female' : 'unknown',
    }),
  )

/** Balanced-preset ResolvedConfig; weight overrides merge over DEFAULT_WEIGHTS. */
export const mkConfig = ({
  weights,
  ...rest
}: Partial<Omit<ResolvedConfig, 'weights'>> & {
  weights?: Partial<Weights>
} = {}): ResolvedConfig => ({
  preset: 'balanced',
  socialDial: 0.35,
  maxCourtSpread: 1.25,
  maxPartnerGap: 1,
  balanceTolerance: 0.5,
  leftyRule: 'hard',
  seed: 42,
  ...rest,
  weights: { ...DEFAULT_WEIGHTS, ...weights },
})

export const mkSchedule = (
  rounds: Array<{ matches: Array<[Team, Team]>; sitters?: string[] }>,
): Schedule =>
  rounds.map(({ matches, sitters = [] }) => ({
    matches: matches.map(([team1, team2]) => ({ team1, team2 })),
    sitters,
  }))

/**
 * Asserts the hard-rule invariants every emitted schedule must satisfy
 * (DESIGN.md §3.2): roster partition per round, no consecutive sit-outs, sit
 * counts within 1, per-round lefty quota, event partner-repeat quota.
 */
export function assertHardLegal({
  schedule,
  players,
  quotas,
  leftyRule = 'hard',
}: {
  schedule: Schedule
  players: PlayerInput[]
  quotas: { partnerRepeatsTotal: number }
  leftyRule?: LeftyRule
}): void {
  const leftyIds = new Set(players.filter((p) => p.isLeftHanded).map((p) => p.playerId))
  const sitCounts = new Map(players.map((p) => [p.playerId, 0]))
  const partnerCounts = new Map<string, number>()

  schedule.forEach((round, r) => {
    const playing = round.matches.flatMap((m) => [...m.team1, ...m.team2])
    const seen = [...round.sitters, ...playing]
    if (seen.length !== players.length || new Set(seen).size !== seen.length) {
      throw new Error(`round ${r + 1}: not a partition of the roster`)
    }
    for (const id of seen) {
      if (!sitCounts.has(id)) throw new Error(`round ${r + 1}: unknown player ${id}`)
    }

    if (r > 0) {
      const prev = new Set(schedule[r - 1].sitters)
      for (const id of round.sitters) {
        if (prev.has(id)) throw new Error(`round ${r + 1}: ${id} sits consecutively`)
      }
    }
    for (const id of round.sitters) sitCounts.set(id, sitCounts.get(id)! + 1)

    if (leftyRule === 'hard') {
      const doubleLeftyTeams = round.matches
        .flatMap((m) => [m.team1, m.team2])
        .filter((t) => t.every((id) => leftyIds.has(id))).length
      const quota = leftyQuotaForRound({
        leftyCount: playing.filter((id) => leftyIds.has(id)).length,
        courtsUsed: round.matches.length,
      })
      if (doubleLeftyTeams > quota) {
        throw new Error(
          `round ${r + 1}: ${doubleLeftyTeams} double-lefty teams exceed quota ${quota}`,
        )
      }
    }

    for (const m of round.matches) {
      for (const t of [m.team1, m.team2]) {
        const key = [...t].sort().join('|')
        partnerCounts.set(key, (partnerCounts.get(key) ?? 0) + 1)
      }
    }
  })

  const counts = [...sitCounts.values()]
  if (Math.max(...counts) - Math.min(...counts) > 1) {
    throw new Error('sit counts differ by more than 1')
  }

  const repeats = [...partnerCounts.values()].reduce((s, n) => s + Math.max(0, n - 1), 0)
  if (repeats > quotas.partnerRepeatsTotal) {
    throw new Error(`${repeats} partner repeats exceed quota ${quotas.partnerRepeatsTotal}`)
  }
}
