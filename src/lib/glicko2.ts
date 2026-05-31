// Glicko-2 (Glickman 2013) — for padel doubles. Shadow ratings only;
// not yet used by the matcher. Padel 3.0 ↔ Glicko 1500, 100 pts = 1.0 level.

const TAU = 0.5
const SCALE = 173.7178
const EPS = 1e-6

export interface GlickoState {
  rating: number
  rd: number
  volatility: number
}

export interface GlickoMatchResult {
  oppRating: number
  oppRd: number
  score: number // fractional: 1 = win, 0.5 = draw, 0 = loss
}

export interface GlickoMatch {
  team1Ids: string[]
  team2Ids: string[]
  score1: number | null | undefined
  score2: number | null | undefined
}

export interface UpdatedGlickoState extends GlickoState {
  matches: number
}

export function padelToRating(level: number | null | undefined): number {
  const n = Number(level)
  // Use ?? semantics: fall back to 3 only for null/undefined/NaN, not for 0.
  const effective = Number.isNaN(n) || level == null ? 3 : n
  return 1200 + effective * 100
}

export const ratingToPadel = (rating: number): number => (rating - 1200) / 100

export function defaultRating(playtomicLevel: number | null | undefined): GlickoState {
  return { rating: padelToRating(playtomicLevel), rd: 350, volatility: 0.06 }
}

export function updateRating(
  state: GlickoState,
  matches: GlickoMatchResult[] | null | undefined,
): GlickoState {
  if (!matches || matches.length === 0) return { ...state }
  const mu = (state.rating - 1500) / SCALE
  const phi = state.rd / SCALE
  const sigma = state.volatility
  const items = matches.map((m) => {
    const muJ = (m.oppRating - 1500) / SCALE
    const phiJ = m.oppRd / SCALE
    const g = 1 / Math.sqrt(1 + (3 * phiJ * phiJ) / (Math.PI * Math.PI))
    const E = 1 / (1 + Math.exp(-g * (mu - muJ)))
    return { muJ, phiJ, g, E, score: m.score }
  })
  let invV = 0
  items.forEach(({ g, E }) => {
    invV += g * g * E * (1 - E)
  })
  const v = 1 / invV
  let sumGSE = 0
  items.forEach(({ g, E, score }) => {
    sumGSE += g * (score - E)
  })
  const delta = v * sumGSE
  const a = Math.log(sigma * sigma)
  const f = (x: number): number => {
    const ex = Math.exp(x)
    const num = ex * (delta * delta - phi * phi - v - ex)
    const den = 2 * (phi * phi + v + ex) * (phi * phi + v + ex)
    return num / den - (x - a) / (TAU * TAU)
  }
  let A = a
  let B: number
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v)
  else {
    let k = 1
    while (f(a - k * TAU) < 0) k++
    B = a - k * TAU
  }
  let fA = f(A)
  let fB = f(B)
  let it = 0
  while (Math.abs(B - A) > EPS && it < 100) {
    const C = A + ((A - B) * fA) / (fB - fA)
    const fC = f(C)
    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else {
      fA = fA / 2
    }
    B = C
    fB = fC
    it++
  }
  const newSigma = Math.exp(A / 2)
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma)
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v)
  const newMu = mu + newPhi * newPhi * sumGSE
  return {
    rating: 1500 + SCALE * newMu,
    rd: Math.max(20, SCALE * newPhi),
    volatility: newSigma,
  }
}

export function applyTournamentRatings(
  priorByPlayerId: Record<string, GlickoState>,
  matches: GlickoMatch[],
  playtomicByPlayerId: Record<string, number> = {},
): Record<string, UpdatedGlickoState> {
  const seen = new Set<string>()
  matches.forEach((m) => {
    if (m.score1 == null || m.score2 == null) return
    ;[...m.team1Ids, ...m.team2Ids].forEach((id) => seen.add(id))
  })
  const prior: Record<string, GlickoState> = {}
  seen.forEach((id) => {
    if (priorByPlayerId[id]) prior[id] = priorByPlayerId[id]
    else if (playtomicByPlayerId[id] != null) prior[id] = defaultRating(playtomicByPlayerId[id])
    else prior[id] = { rating: 1500, rd: 350, volatility: 0.06 }
  })
  const perPlayer: Record<string, GlickoMatchResult[]> = {}
  seen.forEach((id) => {
    perPlayer[id] = []
  })
  for (const m of matches) {
    if (m.score1 == null || m.score2 == null) continue
    const total = m.score1 + m.score2
    if (total <= 0) continue
    const s1 = m.score1 / total
    const s2 = m.score2 / total
    const team1 = m.team1Ids.map((id) => prior[id]).filter(Boolean) as GlickoState[]
    const team2 = m.team2Ids.map((id) => prior[id]).filter(Boolean) as GlickoState[]
    if (!team1.length || !team2.length) continue
    const t1 = avgRating(team1)
    const t2 = avgRating(team2)
    m.team1Ids.forEach(
      (id) => prior[id] && perPlayer[id].push({ oppRating: t2.rating, oppRd: t2.rd, score: s1 }),
    )
    m.team2Ids.forEach(
      (id) => prior[id] && perPlayer[id].push({ oppRating: t1.rating, oppRd: t1.rd, score: s2 }),
    )
  }
  const next: Record<string, UpdatedGlickoState> = {}
  Object.keys(perPlayer).forEach((id) => {
    if (perPlayer[id].length === 0) return
    next[id] = { ...updateRating(prior[id], perPlayer[id]), matches: perPlayer[id].length }
  })
  return next
}

function avgRating(team: GlickoState[]): { rating: number; rd: number } {
  let sumR = 0
  let sumRdSq = 0
  team.forEach((p) => {
    sumR += p.rating
    sumRdSq += p.rd * p.rd
  })
  return { rating: sumR / team.length, rd: Math.sqrt(sumRdSq / team.length) }
}
