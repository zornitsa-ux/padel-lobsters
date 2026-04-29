// ─────────────────────────────────────────────────────────────────────────────
// Glicko-2 (Glickman 2013) — adapted for padel doubles.
//
// Scale convention used in this app:
//   Padel level 3.0 ↔ Glicko rating 1500
//   100 Glicko points ↔ 1.0 Padel level
// So Padel 2.0 = 1400, Padel 4.0 = 1600, Padel 5.0 = 1700, etc.
//
// Doubles handling: each player's "match" within a rating period treats the
// opposing TEAM as a single virtual opponent — opponent rating = avg of the
// two opposing players' ratings, opponent RD = √(avg(RDᵢ²)). The result
// score is the player's team score share (game / (game + opp_game)) so close
// matches contribute partial credit. The partner's rating influences the
// expected outcome via the player's own update only indirectly (through the
// team-vs-opponent E formulation), which is the simplest doubles extension
// that preserves all the standard Glicko-2 derivations.
// ─────────────────────────────────────────────────────────────────────────────

// Constants ──────────────────────────────────────────────────────────────────
const TAU = 0.5         // system constant (0.3..1.2). 0.5 = mild volatility movement.
const SCALE = 173.7178  // standard Glicko-2 conversion constant
const EPS = 1e-6        // convergence threshold for σ' iteration

const PADEL_TO_RATING = (level) => 1200 + (Number(level) || 3) * 100
const RATING_TO_PADEL = (rating) => (rating - 1200) / 100

// ── Public API ───────────────────────────────────────────────────────────────

export const padelToRating = PADEL_TO_RATING
export const ratingToPadel = RATING_TO_PADEL

/**
 * Default Glicko state for a player who has never been rated. RD=350 means
 * "we have no idea where this player ranks", which is exactly what we want
 * before they've played anything.
 */
export function defaultRating(playtomicLevel) {
  return {
    rating: PADEL_TO_RATING(playtomicLevel),
    rd: 350,
    volatility: 0.06,
  }
}

/**
 * Apply one rating period of matches to a single player.
 *
 * @param {{rating:number, rd:number, volatility:number}} state    Current Glicko state.
 * @param {Array<{oppRating:number, oppRd:number, score:number}>} matches
 *        Each match = a virtual 1v1 against the opposing team's avg rating.
 *        score is in [0, 1] (1 = full win, 0.5 = draw, 0 = loss).
 * @returns {{rating:number, rd:number, volatility:number}} New state.
 */
export function updateRating(state, matches) {
  // No matches this period → RD grows (uncertainty increases), but only if
  // we already had a meaningful rating. For shadow mode we just leave the
  // state unchanged when there are no matches.
  if (!matches || matches.length === 0) return { ...state }

  // Step 2: convert to Glicko-2 scale
  const mu = (state.rating - 1500) / SCALE
  const phi = state.rd / SCALE
  const sigma = state.volatility

  // Per-match Glicko-2 quantities
  const items = matches.map(m => {
    const muJ = (m.oppRating - 1500) / SCALE
    const phiJ = m.oppRd / SCALE
    const g = 1 / Math.sqrt(1 + 3 * phiJ * phiJ / (Math.PI * Math.PI))
    const E = 1 / (1 + Math.exp(-g * (mu - muJ)))
    return { muJ, phiJ, g, E, score: m.score }
  })

  // Step 3: estimated variance v
  let invV = 0
  items.forEach(({ g, E }) => { invV += g * g * E * (1 - E) })
  const v = 1 / invV

  // Step 4: estimated improvement Δ
  let sumGSminusE = 0
  items.forEach(({ g, E, score }) => { sumGSminusE += g * (score - E) })
  const delta = v * sumGSminusE

  // Step 5: new volatility σ' (iterative — Glickman's algorithm 1)
  const a = Math.log(sigma * sigma)
  const f = (x) => {
    const ex = Math.exp(x)
    const term1Num = ex * (delta * delta - phi * phi - v - ex)
    const term1Den = 2 * (phi * phi + v + ex) * (phi * phi + v + ex)
    const term2 = (x - a) / (TAU * TAU)
    return term1Num / term1Den - term2
  }
  // Bracket A=a; B start
  let A = a
  let B
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v)
  } else {
    let k = 1
    while (f(a - k * TAU) < 0) k++
    B = a - k * TAU
  }
  let fA = f(A), fB = f(B)
  let it = 0
  while (Math.abs(B - A) > EPS && it < 100) {
    const C = A + (A - B) * fA / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) { A = B; fA = fB } else { fA = fA / 2 }
    B = C; fB = fC
    it++
  }
  const newSigma = Math.exp(A / 2)

  // Step 6: pre-period RD inflation
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma)
  // Step 7: new RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  // Step 8: new μ
  const newMu = mu + newPhi * newPhi * sumGSminusE

  // Step 9: convert back, clamp RD to a sensible floor
  return {
    rating: 1500 + SCALE * newMu,
    rd: Math.max(20, SCALE * newPhi),
    volatility: newSigma,
  }
}

// ── Tournament-level batch update ────────────────────────────────────────────

/**
 * Compute one rating period from a set of completed padel doubles matches.
 *
 * @param {Object} priorByPlayerId  Map of playerId → {rating, rd, volatility}
 *                                  Players not in the map are seeded from
 *                                  `playtomicByPlayerId` if provided, else
 *                                  defaulted to (1500, 350, 0.06).
 * @param {Array}  matches          Array of {team1Ids, team2Ids, score1, score2}.
 *                                  Only matches with both scores set count.
 * @param {Object} [playtomicByPlayerId] Optional: playerId → playtomicLevel,
 *                                  used to seed unseen players.
 * @returns {Object}  Map of playerId → new {rating, rd, volatility, matches}.
 *                    Only players who participated in at least one match are
 *                    included. `matches` is the count this period.
 */
export function applyTournamentRatings(priorByPlayerId, matches, playtomicByPlayerId = {}) {
  // 1) Resolve prior state for every player who appears in any match.
  const seen = new Set()
  matches.forEach(m => {
    if (m.score1 == null || m.score2 == null) return
    ;[...m.team1Ids, ...m.team2Ids].forEach(id => seen.add(id))
  })

  const prior = {}
  seen.forEach(id => {
    if (priorByPlayerId[id]) {
      prior[id] = priorByPlayerId[id]
    } else if (playtomicByPlayerId[id] != null) {
      prior[id] = defaultRating(playtomicByPlayerId[id])
    } else {
      prior[id] = { rating: 1500, rd: 350, volatility: 0.06 }
    }
  })

  // 2) For each player, build their list of virtual 1v1 matches in this period.
  const perPlayerMatches = {}
  seen.forEach(id => { perPlayerMatches[id] = [] })

  for (const m of matches) {
    if (m.score1 == null || m.score2 == null) continue
    const total = m.score1 + m.score2
    if (total <= 0) continue
    const score1 = m.score1 / total
    const score2 = m.score2 / total

    const team1 = m.team1Ids.map(id => prior[id]).filter(Boolean)
    const team2 = m.team2Ids.map(id => prior[id]).filter(Boolean)
    if (team1.length === 0 || team2.length === 0) continue

    const team1Avg = avgRating(team1)
    const team2Avg = avgRating(team2)

    m.team1Ids.forEach(id => {
      if (prior[id]) {
        perPlayerMatches[id].push({
          oppRating: team2Avg.rating,
          oppRd: team2Avg.rd,
          score: score1,
        })
      }
    })
    m.team2Ids.forEach(id => {
      if (prior[id]) {
        perPlayerMatches[id].push({
          oppRating: team1Avg.rating,
          oppRd: team1Avg.rd,
          score: score2,
        })
      }
    })
  }

  // 3) Compute new state per player.
  const next = {}
  Object.keys(perPlayerMatches).forEach(id => {
    const matches = perPlayerMatches[id]
    if (matches.length === 0) return
    const updated = updateRating(prior[id], matches)
    next[id] = { ...updated, matches: matches.length }
  })
  return next
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function avgRating(team) {
  // Average rating; combined RD = √(mean(RDᵢ²)). This is conservative —
  // a team's effective uncertainty matches the noisier of its members.
  let sumR = 0, sumRdSq = 0
  team.forEach(p => { sumR += p.rating; sumRdSq += p.rd * p.rd })
  return {
    rating: sumR / team.length,
    rd: Math.sqrt(sumRdSq / team.length),
  }
}
