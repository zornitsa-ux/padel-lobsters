import type { FeasibilityEntry, FeasibilityResult, GenderMode, PlayerInput, RelaxationQuotas, ResolvedConfig } from './types'

// Stage 0 (DESIGN.md §3.1): audit every hard rule against the roster before
// any search. Event-level quotas are the *reported* relaxation plan;
// enforcement is per round from actual round composition via the helpers
// below (D-013). Entry rule keys are frozen: 'structure', 'sit-outs',
// 'lefty', 'partner-repeat', 'gender', 'gender-unknown', 'gender-mode'.

/**
 * Contract (M2.2):
 * - courtsUsed = min(courts, floor(P / 4)); sittersPerRound = P − 4·courtsUsed
 * - infeasible (feasible: false + an 'infeasible' entry) when P < 4,
 *   courts < 1, rounds < 1, or sittersPerRound > P / 2 (never-consecutive
 *   sit-outs impossible)
 * - lefty audit (leftyRule 'hard'): doubleLeftyTeamsPerRound =
 *   leftyQuotaForRound over the full roster's lefty count; 'relaxed' entry
 *   when > 0. leftyRule 'off': quota 0, informational 'ok' entry.
 * - gender audit (mixed mode): sameGenderTeamsPerRound =
 *   sameGenderQuotaForRound over the full roster; 'relaxed' entry when > 0;
 *   unknown genders reported in an informational 'gender-unknown' entry
 *   (D-011). men/women modes: informational 'gender-mode' entry when the
 *   roster contains unknown or mismatched genders; never blocks.
 * - partner-repeat quota: 0 for P ≥ 8 (DESIGN §3.2); computed for smaller
 *   fields (P = 4 ⇒ 2·max(0, rounds − 3))
 * - every entry carries a human-readable detail
 */
export function auditFeasibility({
  players,
  courts,
  rounds,
  genderMode,
  config,
}: {
  players: PlayerInput[]
  courts: number
  rounds: number
  genderMode: GenderMode
  config: ResolvedConfig
}): FeasibilityResult {
  const playerCount = players.length
  const entries: FeasibilityEntry[] = []
  const quotas: RelaxationQuotas = {
    doubleLeftyTeamsPerRound: 0,
    partnerRepeatsTotal: 0,
    sameGenderTeamsPerRound: 0,
  }

  if (playerCount < 4 || courts < 1 || rounds < 1) {
    entries.push({
      rule: 'structure',
      status: 'infeasible',
      detail: `${playerCount} players, ${courts} courts, ${rounds} rounds: need at least 4 players, 1 court, and 1 round`,
    })
    return { feasible: false, courtsUsed: 0, sittersPerRound: 0, quotas, entries }
  }

  const courtsUsed = Math.min(courts, Math.floor(playerCount / 4))
  const sittersPerRound = playerCount - 4 * courtsUsed
  entries.push({
    rule: 'structure',
    status: 'ok',
    detail: `${playerCount} players on ${courts} courts: ${courtsUsed} courts of 4 in play per round`,
  })

  if (sittersPerRound > playerCount / 2) {
    entries.push({
      rule: 'sit-outs',
      status: 'infeasible',
      detail: `${sittersPerRound} of ${playerCount} players sit each round — more than half the field, so someone must sit twice in a row`,
    })
    return { feasible: false, courtsUsed, sittersPerRound, quotas, entries }
  }
  entries.push({
    rule: 'sit-outs',
    status: 'ok',
    detail:
      sittersPerRound === 0
        ? 'everyone plays every round'
        : `${sittersPerRound} sitters per round, rotated so nobody sits twice in a row`,
  })

  const leftyCount = players.filter((p) => p.isLeftHanded).length
  if (config.leftyRule === 'hard') {
    const leftyQuota = leftyQuotaForRound({ leftyCount, courtsUsed })
    quotas.doubleLeftyTeamsPerRound = leftyQuota
    entries.push({
      rule: 'lefty',
      status: leftyQuota > 0 ? 'relaxed' : 'ok',
      detail:
        leftyQuota > 0
          ? `${leftyCount} lefties on ${courtsUsed} courts: at least ${leftyQuota} double-lefty team(s) per round is unavoidable`
          : `${leftyCount} lefties fit without any double-lefty team (${2 * courtsUsed} team slots per round)`,
    })
  } else {
    entries.push({
      rule: 'lefty',
      status: 'ok',
      detail: 'lefty rule is off — double-lefty teams are not restricted',
    })
  }

  // Each no-repeat round consumes 2 of the C(P,2) partner pairs, so at most
  // floor(P·(P−1)/4) rounds fit without a repeat; each round beyond that
  // repeats 2 pairs. Fields ≥ 8 are structurally avoidable for 4–6 rounds
  // (DESIGN §3.2), so the quota is pinned at 0 there.
  const noRepeatRounds = Math.floor((playerCount * (playerCount - 1)) / 4)
  const partnerRepeatsTotal = playerCount >= 8 ? 0 : 2 * Math.max(0, rounds - noRepeatRounds)
  quotas.partnerRepeatsTotal = partnerRepeatsTotal
  entries.push({
    rule: 'partner-repeat',
    status: partnerRepeatsTotal > 0 ? 'relaxed' : 'ok',
    detail:
      partnerRepeatsTotal > 0
        ? `${playerCount} players over ${rounds} rounds: only ${noRepeatRounds} rounds fit without repeating a partnership — ${partnerRepeatsTotal} partner repeats are unavoidable`
        : 'every partnership can be unique across the event',
  })

  const maleCount = players.filter((p) => p.gender === 'male').length
  const femaleCount = players.filter((p) => p.gender === 'female').length
  const unknownCount = playerCount - maleCount - femaleCount

  if (genderMode === 'mixed') {
    const genderQuota = sameGenderQuotaForRound({ maleCount, femaleCount, unknownCount, courtsUsed })
    quotas.sameGenderTeamsPerRound = genderQuota
    entries.push({
      rule: 'gender',
      status: genderQuota > 0 ? 'relaxed' : 'ok',
      detail:
        genderQuota > 0
          ? `${maleCount} men / ${femaleCount} women on ${courtsUsed} courts: at least ${genderQuota} same-gender team(s) per round is unavoidable`
          : `${maleCount} men / ${femaleCount} women fill ${2 * courtsUsed} team slots per round without same-gender teams`,
    })
    if (unknownCount > 0) {
      entries.push({
        rule: 'gender-unknown',
        status: 'ok',
        detail: `${unknownCount} player(s) have unknown gender; their teams never count as same-gender (D-011)`,
      })
    }
  } else {
    const mismatchedCount = genderMode === 'men' ? femaleCount : maleCount
    if (mismatchedCount > 0 || unknownCount > 0) {
      entries.push({
        rule: 'gender-mode',
        status: 'ok',
        detail: `${genderMode} event with ${mismatchedCount} mismatched and ${unknownCount} unknown gender(s) on the roster — informational only, never blocking (D-011)`,
      })
    }
  }

  return { feasible: true, courtsUsed, sittersPerRound, quotas, entries }
}

/** Unavoidable double-lefty teams in a round: max(0, leftyCount − 2·courtsUsed). */
export function leftyQuotaForRound({
  leftyCount,
  courtsUsed,
}: {
  leftyCount: number
  courtsUsed: number
}): number {
  return Math.max(0, leftyCount - 2 * courtsUsed)
}

/**
 * Unavoidable same-gender teams in a mixed-mode round:
 * max(0, 2·courtsUsed − min(male, female) − unknown). Teams containing an
 * unknown-gender player never count as same-gender (D-011).
 */
export function sameGenderQuotaForRound({
  maleCount,
  femaleCount,
  unknownCount,
  courtsUsed,
}: {
  maleCount: number
  femaleCount: number
  unknownCount: number
  courtsUsed: number
}): number {
  return Math.max(0, 2 * courtsUsed - Math.min(maleCount, femaleCount) - unknownCount)
}
