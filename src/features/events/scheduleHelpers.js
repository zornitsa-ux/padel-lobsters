import {
  buildSmartPairs,
  pairsToCourtMatches,
  assertRoundCoverage,
  updateHistories,
} from './pairingEngine'

/**
 * Smart short name: returns first name if unique, otherwise first + last-initial.
 * Avoids "Gonzalo" being ambiguous when we have "Gonzalo U" and "Gonzalo E".
 */
export function shortName(player, allPlayers) {
  const parts = (player.name || '').split(' ')
  const first = parts[0] || player.name
  const hasDupe = allPlayers.some(
    (other) => other.id !== player.id && (other.name || '').split(' ')[0] === first,
  )
  if (!hasDupe) return first
  // Use first + abbreviated remainder (e.g. "Gonzalo E.")
  return parts.length > 1 ? `${first} ${parts[1][0]}.` : player.name
}

// ── Format generators ─────────────────────────────────────────────────────────

/**
 * Build a single round's matches. Retries the full pair-then-assign pipeline
 * a few times if the coverage check fails (every active player must appear
 * exactly once, no foreigners). On success returns the matches.
 */
export function buildOneRound(
  active,
  numCourts,
  roundNum,
  partnerHistory,
  opponentHistory,
  genderMode,
) {
  const MAX_RETRIES = 8
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const pairs = buildSmartPairs(active, partnerHistory, genderMode)
    const matches = pairsToCourtMatches(pairs, numCourts, roundNum, opponentHistory, genderMode)
    if (assertRoundCoverage(matches, active, roundNum)) {
      return { pairs, matches }
    }
    // else retry with a fresh shuffle
  }
  // Best-effort: return whatever the last attempt produced. The warnings panel
  // will still flag any issues via validateSchedule.
  const pairs = buildSmartPairs(active, partnerHistory, genderMode)
  const matches = pairsToCourtMatches(pairs, numCourts, roundNum, opponentHistory, genderMode)
  return { pairs, matches }
}

// Legacy greedy generator. Kept for reference / quick revert; the live path
// now uses generateLobsterAnnealed from src/lib/lobsterMatcher.js.

export function generateLobsterLegacy(players, numCourts, genderMode = 'mixed', duration = 90) {
  const numRounds = duration >= 120 ? 6 : 5 // 2h → 6 rounds, 90min → 5 rounds (18min each)
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active = sorted.slice(0, numCourts * 4),
    sitting = sorted.slice(numCourts * 4)
  const partnerHistory = {},
    opponentHistory = {}
  active.forEach((p) => {
    partnerHistory[p.id] = new Set()
    opponentHistory[p.id] = new Set()
  })
  const allRounds = []
  for (let r = 0; r < numRounds; r++) {
    const { pairs, matches } = buildOneRound(
      active,
      numCourts,
      r + 1,
      partnerHistory,
      opponentHistory,
      genderMode,
    )
    updateHistories(pairs, matches, partnerHistory, opponentHistory)
    allRounds.push({
      round: r + 1,
      label: `Round ${r + 1}`,
      matches,
      sitting: sitting.map((p) => p.id),
    })
  }
  return allRounds
}

export function generateAmericano(players, numCourts, rounds = 4, genderMode = 'mixed') {
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active = sorted.slice(0, numCourts * 4),
    sitting = sorted.slice(numCourts * 4)
  const partnerHistory = {},
    opponentHistory = {}
  active.forEach((p) => {
    partnerHistory[p.id] = new Set()
    opponentHistory[p.id] = new Set()
  })
  const allRounds = []
  for (let r = 0; r < rounds; r++) {
    const { pairs, matches } = buildOneRound(
      active,
      numCourts,
      r + 1,
      partnerHistory,
      opponentHistory,
      genderMode,
    )
    updateHistories(pairs, matches, partnerHistory, opponentHistory)
    allRounds.push({
      round: r + 1,
      label: `Round ${r + 1}`,
      matches,
      sitting: sitting.map((p) => p.id),
    })
  }
  return allRounds
}

export function generateMexicano(players, numCourts, rounds = 4, genderMode = 'mixed') {
  const round1 = generateAmericano(players, numCourts, 1, genderMode)
  const placeholders = Array.from({ length: rounds - 1 }, (_, i) => ({
    round: i + 2,
    label: `Round ${i + 2}`,
    matches: [],
    sitting: [],
    note: 'Generated after Round 1 scores are entered',
  }))
  return [...round1, ...placeholders]
}

export function generateRoundRobin(players, numCourts, genderMode = 'mixed') {
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active = sorted.slice(0, numCourts * 4),
    sitting = sorted.slice(numCourts * 4)
  const partnerHistory = {},
    opponentHistory = {}
  active.forEach((p) => {
    partnerHistory[p.id] = new Set()
    opponentHistory[p.id] = new Set()
  })
  const rounds = []
  for (let r = 0; r < Math.min(active.length - 1, 6); r++) {
    const { pairs, matches } = buildOneRound(
      active,
      numCourts,
      r + 1,
      partnerHistory,
      opponentHistory,
      genderMode,
    )
    if (!matches.length) break
    updateHistories(pairs, matches, partnerHistory, opponentHistory)
    rounds.push({
      round: r + 1,
      label: `Round ${r + 1}`,
      matches,
      sitting: sitting.map((p) => p.id),
    })
  }
  return rounds
}
