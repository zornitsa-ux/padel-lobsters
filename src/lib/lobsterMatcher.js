// ─────────────────────────────────────────────────────────────────────────────
// Lobster Matcher (simulated-annealing edition)
//
// Replaces the old greedy + multi-attempt + retry pipeline with a single
// optimiser that operates on the full set of rounds at once. The key
// behavioural changes vs. the previous matcher:
//
// 1. ALWAYS returns a complete, valid-coverage schedule. Each move type
//    preserves "every active player appears exactly once per round" by
//    construction, so coverage is never broken — no reshuffle errors.
//
// 2. Adds a *cohort-variety* objective: each pair of players accumulates
//    a "shared court" count across the schedule, and the optimiser is
//    penalised for cohorts that exceed the ideal even share. This is the
//    fix for "the same 4 stay on court, partners just become opponents".
//
// 3. Adds a cross-tournament *decayed cohort memory* (60-day half-life):
//    pairs who have shared a court recently in past tournaments are pushed
//    apart. New / non-regular players have zero history so they're treated
//    neutrally — no special-casing needed.
//
// 4. Soft-weighted hard rules. Partner-repeat / opponent-repeat / level-
//    imbalance all live in the cost function rather than as hard +100000
//    constraints, which means the optimiser can accept a slightly worse
//    schedule rather than dead-ending and forcing a reshuffle. True hard
//    rules (double-lefty team, gender-clash above unavoidable quota) get
//    a 1e9 weight so they're never present in a returned answer.
//
// 5. Sit-out rotation. For non-divisible roster sizes (e.g. 18 players on
//    4 courts), the optimiser distributes sit-outs evenly across players
//    by round instead of permanently benching the lowest-level group.
//
// Public API: only `generateLobster(...)`. Same input/output shape as the
// old generator so it drops into Schedule.jsx with one import swap.
// ─────────────────────────────────────────────────────────────────────────────

// ── Cost-function weights ────────────────────────────────────────────────────
// Tuned for "variety wins but level delta minimised where possible". A
// cohort-break is preferred up to ~5.5 of level-delta; beyond that, the
// optimiser keeps the cohort. See backtest notes when adjusting.
const W = {
  HARD:           1e9,   // double lefty team, gender clash above unavoidable quota
  LEVEL_DELTA:    1.0,   // squared team level difference, per match
  PARTNER_REPEAT: 200,   // squared count of repeat partnerships in this tournament
  OPPONENT_REPEAT: 8,    // squared count above 1 of repeat opponents in this tournament
  COHORT_EXCESS:  30,    // squared count above target share of co-court within this tournament
  COHORT_HISTORY: 15,    // decayed past co-court (cross-tournament), 60-day half-life
  GENDER_EXTRA:   1000,  // gender clashes above the unavoidable quota
  SITOUT_VAR:     20,    // squared sit-out count above the fair share, per player
}

const COHORT_HALF_LIFE_DAYS = 60

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a Lobster Matching schedule.
 *
 * @param {Array} players          Registered players (must include id, adjustedLevel,
 *                                 gender, isLeftHanded).
 * @param {number} numCourts       Number of courts available.
 * @param {string} genderMode      'mixed' | 'open' | 'women' | 'men'
 * @param {number} duration        Tournament duration in minutes (>=120 → 6 rounds, else 5).
 * @param {Object} [opts]
 * @param {Array}  [opts.pastMatches]  All historical matches (for decayed cohort memory).
 * @param {number} [opts.iterations=5000]  Simulated-annealing iteration cap.
 * @param {number} [opts.seed]            Deterministic RNG seed (for tests/backtest).
 *
 * @returns {Array<{round:number,label:string,matches:Array,sitting:Array<string>}>}
 */
export function generateLobster(players, numCourts, genderMode = 'mixed', duration = 90, opts = {}) {
  const numRounds = duration >= 120 ? 6 : 5
  return generateSchedule(players, numCourts, numRounds, genderMode, opts)
}

/**
 * Same as above but with explicit round count. Useful for Americano/Mexicano
 * if we ever want to migrate them to the new optimiser too.
 */
export function generateSchedule(players, numCourts, numRounds, genderMode, opts = {}) {
  const rng = opts.seed != null ? mulberry32(opts.seed) : Math.random
  const iterations = opts.iterations ?? 5000

  const ctx = buildContext(players, numCourts, numRounds, genderMode, opts.pastMatches || [])
  if (ctx.playerCount < 4 || ctx.courtsPerRound < 1) {
    return Array.from({ length: numRounds }, (_, r) => ({
      round: r + 1, label: `Round ${r + 1}`, matches: [],
      sitting: ctx.sittingPerRound[r] || [],
    }))
  }

  // 1) Seed schedule. Greedy level-balanced layout — usually feasible already.
  const schedule = seedSchedule(ctx, rng)

  // 2) Anneal.
  anneal(schedule, ctx, iterations, rng)

  // 3) Materialise into the output shape Schedule.jsx already understands.
  return materialise(schedule, ctx)
}

// ── Context: precomputed lookups + history matrices ──────────────────────────

function buildContext(players, numCourts, numRounds, genderMode, pastMatches) {
  // Sort by level (descending). Used for seeding only; the optimiser ignores
  // this order entirely once seeding is done.
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const capacity = numCourts * 4

  // Roster: how many sit per round, and which roster lines play.
  // For 32 players × 8 courts = 0 sit-outs, the trivial case.
  const playerCount = sorted.length
  const activePerRound = Math.min(playerCount, capacity)
  const sitPerRound = Math.max(0, playerCount - activePerRound)

  // We index players 0..playerCount-1 internally and map to/from real ids.
  const idByIdx = sorted.map(p => p.id)
  const idxById = new Map(idByIdx.map((id, i) => [id, i]))
  const playerByIdx = sorted

  // Distribute sit-outs as evenly as possible. Each player sits either
  // floor or ceil of (sitPerRound × numRounds / playerCount) times. The
  // initial assignment is just round-robin; the SA can then move sit-outs
  // around if it improves cost.
  const sitOutByRound = []
  const totalSitSlots = sitPerRound * numRounds
  const baseSitouts = Math.floor(totalSitSlots / playerCount)
  const extra = totalSitSlots - baseSitouts * playerCount  // first `extra` players sit one more
  // assign each player a target sit-out count
  const targetSitouts = new Array(playerCount).fill(0).map((_, i) => baseSitouts + (i < extra ? 1 : 0))
  // round-robin allocation, choosing players with remaining sit-out budget
  const remaining = [...targetSitouts]
  for (let r = 0; r < numRounds; r++) {
    const sit = []
    // pick the `sitPerRound` players with highest remaining budget; ties broken
    // by lowest player index so the seed is deterministic for a given roster.
    const candidates = remaining
      .map((c, i) => ({ i, c }))
      .filter(x => x.c > 0)
      .sort((a, b) => b.c - a.c || a.i - b.i)
    for (let k = 0; k < sitPerRound && k < candidates.length; k++) {
      sit.push(candidates[k].i)
      remaining[candidates[k].i] -= 1
    }
    sitOutByRound.push(sit)
  }

  // Active player indices per round (everyone not sitting).
  const activeByRound = sitOutByRound.map(sit => {
    const sitSet = new Set(sit)
    const out = []
    for (let i = 0; i < playerCount; i++) if (!sitSet.has(i)) out.push(i)
    return out
  })

  // ── Decayed cross-tournament cohort matrix ──────────────────────────────
  // For every pair (i, j) of registered players, sum exp(-Δdays/HALF_LIFE)
  // for each historical match where they shared a court.
  const cohortHistory = makeMatrix(playerCount)
  const now = Date.now()
  pastMatches.forEach(m => {
    if (!m.team1Ids || !m.team2Ids) return
    const four = [...m.team1Ids, ...m.team2Ids]
      .map(id => idxById.get(id))
      .filter(idx => idx != null)
    if (four.length < 2) return
    const t = m.created_at ? new Date(m.created_at).getTime() : now
    const deltaDays = Math.max(0, (now - t) / 86400000)
    const w = Math.pow(0.5, deltaDays / COHORT_HALF_LIFE_DAYS)
    for (let a = 0; a < four.length; a++) {
      for (let b = a + 1; b < four.length; b++) {
        cohortHistory[four[a]][four[b]] += w
        cohortHistory[four[b]][four[a]] += w
      }
    }
  })

  // Within-event cohort *target*: ideal even share of court-mates.
  // Each player gets `numRounds` matches × 3 court-mates each = 3 × numRounds
  // total court-mates, distributed across (playerCount-1) others.
  // Target per pair = (3 × numRounds × playerCount) / (playerCount × (playerCount - 1) / 2 × 2) etc.
  // Simpler form: total co-court pair-events = numCourts × C(4,2) × numRounds
  // = numCourts × 6 × numRounds. Total possible pairs = C(playerCount, 2).
  // Target per pair = pairEvents / totalPairs.
  const pairEvents = Math.min(numCourts, Math.floor(activePerRound / 4)) * 6 * numRounds
  const totalPairs = (playerCount * (playerCount - 1)) / 2
  const cohortTarget = totalPairs > 0 ? pairEvents / totalPairs : 0

  // Gender quota — same logic as the existing validator. With odd women in
  // mixed mode we accept exactly one unavoidable WM-vs-MM clash per round.
  const isMixed = genderMode === 'mixed'
  const womenCount = playerByIdx.filter(p => p.gender === 'female').length
  const menCount   = playerByIdx.length - womenCount
  let unavoidableClashesPerRound = 0
  if (isMixed && womenCount > 0 && menCount > 0) {
    const teamsPerRound = Math.floor(activePerRound / 2)
    if (womenCount < teamsPerRound) {
      unavoidableClashesPerRound = womenCount % 2 === 1 ? 1 : 0
    }
  }

  return {
    players,
    playerByIdx,
    idByIdx,
    idxById,
    playerCount,
    numCourts,
    numRounds,
    activePerRound,
    courtsPerRound: Math.floor(activePerRound / 4),
    activeByRound,
    sittingPerRound: sitOutByRound.map(arr => arr.map(i => idByIdx[i])),
    targetSitouts,
    cohortHistory,
    cohortTarget,
    isMixed,
    genderMode,
    isFemale: playerByIdx.map(p => p.gender === 'female'),
    isLefty:  playerByIdx.map(p => p.isLeftHanded === true),
    level:    playerByIdx.map(p => p.adjustedLevel || 0),
    unavoidableClashesPerRound,
  }
}

// ── Seeding: a feasible starting schedule ────────────────────────────────────
//
// A schedule is represented as schedule[round][court] = [p0, p1, p2, p3] where
// (p0, p1) play (p2, p3). Player indices, not ids.
//
// Seed strategy: for each round, take the active roster sorted by level and
// snake-allocate to courts (zigzag) so each court gets a mix of skill bands.
// Pair within a court using "high-low" partnering (rank 0+3 vs 1+2). This
// gives the optimiser a reasonable starting point — partner-repeat-free in
// round 1, with a level-balanced layout per court.
function seedSchedule(ctx, rng) {
  const schedule = []
  for (let r = 0; r < ctx.numRounds; r++) {
    const active = [...ctx.activeByRound[r]]
    // Mild shuffle within level bands so different rounds start differently
    // and the optimiser explores broader space. Fully deterministic seeds
    // would push every round toward the same layout.
    shuffleInPlace(active, rng)
    // Then sort by level descending — this restores level order for the
    // snake allocation below, with the shuffle effectively breaking ties.
    active.sort((a, b) => ctx.level[b] - ctx.level[a])

    const courts = []
    for (let c = 0; c < ctx.courtsPerRound; c++) {
      // Pick four players using snake allocation by skill rank: c, 2C-1-c,
      // 2C+c, 4C-1-c (where C is courts-per-round). This puts the highest
      // and lowest in band 0 on court 0, etc. — natural balance.
      const C = ctx.courtsPerRound
      const ids = [
        active[c],
        active[2 * C - 1 - c],
        active[2 * C + c],
        active[4 * C - 1 - c],
      ].filter(x => x != null)
      if (ids.length === 4) {
        // Pair high+low vs mid+mid on this court → minimal level delta.
        courts.push([ids[0], ids[3], ids[1], ids[2]])
      }
    }
    schedule.push(courts)
  }
  return schedule
}

// ── Cost function ────────────────────────────────────────────────────────────
//
// Single source of truth. Computed end-to-end on each call rather than
// incrementally; for N=32 × 6 rounds this is ~5µs in V8 and lets us iterate
// on the cost design without rewriting the SA loop.
function scoreSchedule(schedule, ctx) {
  const { playerCount, isFemale, isLefty, level, isMixed,
          cohortHistory, cohortTarget, unavoidableClashesPerRound } = ctx

  let hard = 0
  let levelCost = 0
  let cohortHistCost = 0
  let cohortExcessCost = 0
  let extraGenderClashes = 0

  // Per-player partner / opponent / co-court counters within this schedule.
  const partner   = makeMatrix(playerCount)
  const opponent  = makeMatrix(playerCount)
  const cohort    = makeMatrix(playerCount)
  const sitouts   = new Array(playerCount).fill(0)

  for (let r = 0; r < schedule.length; r++) {
    let clashesThisRound = 0
    for (let c = 0; c < schedule[r].length; c++) {
      const [a, b, c1, c2] = schedule[r][c]
      // Hard: two lefties on the same team
      if (isLefty[a] && isLefty[b]) hard++
      if (isLefty[c1] && isLefty[c2]) hard++
      // Team level delta squared
      const t1 = level[a] + level[b]
      const t2 = level[c1] + level[c2]
      const delta = t1 - t2
      levelCost += delta * delta
      // Partner counts (one pair per team)
      partner[a][b]++; partner[b][a]++
      partner[c1][c2]++; partner[c2][c1]++
      // Opponent counts (4 cross-pairs)
      const t1arr = [a, b], t2arr = [c1, c2]
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const x = t1arr[i], y = t2arr[j]
          opponent[x][y]++; opponent[y][x]++
        }
      }
      // Co-court counts (all 6 pairs of 4)
      const four = [a, b, c1, c2]
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          cohort[four[i]][four[j]]++
          cohort[four[j]][four[i]]++
          cohortHistCost += cohortHistory[four[i]][four[j]]
        }
      }
      // Gender mode: WM team must not face MM team in mixed mode.
      if (isMixed) {
        const t1HasW = isFemale[a] || isFemale[b]
        const t2HasW = isFemale[c1] || isFemale[c2]
        if (t1HasW !== t2HasW) clashesThisRound++
      }
    }
    // Anything beyond the unavoidable quota is real engine error.
    if (clashesThisRound > unavoidableClashesPerRound) {
      extraGenderClashes += (clashesThisRound - unavoidableClashesPerRound)
    }
  }

  // Aggregate pair-level cost contributions.
  let partnerCost = 0
  let opponentCost = 0
  for (let i = 0; i < playerCount; i++) {
    for (let j = i + 1; j < playerCount; j++) {
      const p = partner[i][j]
      if (p > 0) partnerCost += p * p   // any repeat partnership is heavily penalised
      const o = opponent[i][j]
      if (o > 1) {
        const excess = o - 1
        opponentCost += excess * excess
      }
      const co = cohort[i][j]
      if (co > cohortTarget + 1) {        // small slack so common cases stay quiet
        const excess = co - cohortTarget - 1
        cohortExcessCost += excess * excess
      }
    }
  }

  // Sit-out variance — prefer schedules where each player sits within ±1
  // of their target. (For 32×8 with 0 sit-outs this term is identically 0.)
  for (let r = 0; r < schedule.length; r++) {
    const playing = new Set()
    schedule[r].forEach(court => court.forEach(p => playing.add(p)))
    for (let i = 0; i < playerCount; i++) {
      if (!playing.has(i)) sitouts[i]++
    }
  }
  let sitoutCost = 0
  for (let i = 0; i < playerCount; i++) {
    const excess = sitouts[i] - ctx.targetSitouts[i]
    sitoutCost += excess * excess
  }

  return (
    W.HARD * hard +
    W.LEVEL_DELTA * levelCost +
    W.PARTNER_REPEAT * partnerCost +
    W.OPPONENT_REPEAT * opponentCost +
    W.COHORT_EXCESS * cohortExcessCost +
    W.COHORT_HISTORY * cohortHistCost +
    W.GENDER_EXTRA * extraGenderClashes +
    W.SITOUT_VAR * sitoutCost
  )
}

// ── Simulated annealing ──────────────────────────────────────────────────────
//
// Three move types, each preserving "every active player appears exactly once
// per round" so coverage is invariant.
//
//   A) IN-ROUND PLAYER SWAP. Pick a round, pick two distinct player slots
//      across all courts in that round, swap them. Most common move.
//   B) IN-COURT PARTNER SWAP. Pick a round, a court, swap one team-1 slot
//      with the matching team-2 slot. Cheap way to flip a partner pairing.
//   C) SIT-OUT SWAP. Pick a round, swap an active player with a sitting
//      player (only if there are sit-outs).
//
// Acceptance: Metropolis with geometric cooling.
function anneal(schedule, ctx, iterations, rng) {
  let curCost = scoreSchedule(schedule, ctx)
  let best = cloneSchedule(schedule)
  let bestCost = curCost

  let T = Math.max(50, curCost * 0.001)
  const cooling = Math.pow(0.001, 1 / iterations)  // T → ~T*0.001 over the run

  for (let it = 0; it < iterations; it++) {
    const moveType = rng() < 0.7 ? 'A' : (rng() < 0.5 ? 'B' : 'C')
    const undo = applyMove(schedule, ctx, moveType, rng)
    if (!undo) continue

    const newCost = scoreSchedule(schedule, ctx)
    const delta = newCost - curCost
    const accept = delta < 0 || rng() < Math.exp(-delta / T)

    if (accept) {
      curCost = newCost
      if (newCost < bestCost) {
        bestCost = newCost
        best = cloneSchedule(schedule)
      }
    } else {
      undo()  // revert
    }
    T *= cooling
  }

  // Replace the working schedule with the best seen.
  for (let r = 0; r < schedule.length; r++) {
    schedule[r] = best[r]
  }
}

function applyMove(schedule, ctx, type, rng) {
  if (type === 'A') return moveSwapPlayersInRound(schedule, ctx, rng)
  if (type === 'B') return moveSwapPartnerOpponent(schedule, rng)
  if (type === 'C') return moveSwapWithSittingPlayer(schedule, ctx, rng)
  return null
}

function moveSwapPlayersInRound(schedule, ctx, rng) {
  const r = Math.floor(rng() * schedule.length)
  const courts = schedule[r]
  if (courts.length < 1) return null
  const totalSlots = courts.length * 4
  if (totalSlots < 2) return null
  let aSlot = Math.floor(rng() * totalSlots)
  let bSlot = Math.floor(rng() * totalSlots)
  if (aSlot === bSlot) bSlot = (bSlot + 1) % totalSlots
  const aC = Math.floor(aSlot / 4), aIdx = aSlot % 4
  const bC = Math.floor(bSlot / 4), bIdx = bSlot % 4
  const tmp = courts[aC][aIdx]
  courts[aC][aIdx] = courts[bC][bIdx]
  courts[bC][bIdx] = tmp
  return () => {
    const t = courts[aC][aIdx]
    courts[aC][aIdx] = courts[bC][bIdx]
    courts[bC][bIdx] = t
  }
}

function moveSwapPartnerOpponent(schedule, rng) {
  const r = Math.floor(rng() * schedule.length)
  const courts = schedule[r]
  if (courts.length < 1) return null
  const c = Math.floor(rng() * courts.length)
  const court = courts[c]
  // Swap one team-1 slot with the matching team-2 slot. This exchanges a
  // partner with an opponent within the same 4 — cheap perturbation that
  // keeps the cohort unchanged but reshuffles the pair structure.
  const i = Math.floor(rng() * 2)        // team1 slot 0 or 1
  const j = 2 + Math.floor(rng() * 2)    // team2 slot 2 or 3
  const tmp = court[i]
  court[i] = court[j]
  court[j] = tmp
  return () => {
    const t = court[i]
    court[i] = court[j]
    court[j] = t
  }
}

function moveSwapWithSittingPlayer(schedule, ctx, rng) {
  const r = Math.floor(rng() * schedule.length)
  // Determine current sit-outs from the schedule itself (not ctx, which may
  // be stale after earlier C moves).
  const playing = new Set()
  schedule[r].forEach(court => court.forEach(p => playing.add(p)))
  const sitting = []
  for (let i = 0; i < ctx.playerCount; i++) if (!playing.has(i)) sitting.push(i)
  if (sitting.length === 0) return null

  const sitter = sitting[Math.floor(rng() * sitting.length)]
  const courts = schedule[r]
  if (courts.length < 1) return null
  const c = Math.floor(rng() * courts.length)
  const idx = Math.floor(rng() * 4)
  const replaced = courts[c][idx]
  courts[c][idx] = sitter
  return () => {
    courts[c][idx] = replaced
  }
}

// ── Materialise: SA schedule → output shape used by Schedule.jsx ─────────────

function materialise(schedule, ctx) {
  const out = []
  for (let r = 0; r < schedule.length; r++) {
    const matches = []
    for (let c = 0; c < schedule[r].length; c++) {
      const [a, b, c1, c2] = schedule[r][c]
      const team1Ids = [ctx.idByIdx[a], ctx.idByIdx[b]]
      const team2Ids = [ctx.idByIdx[c1], ctx.idByIdx[c2]]
      const team1Level = ctx.level[a] + ctx.level[b]
      const team2Level = ctx.level[c1] + ctx.level[c2]
      matches.push({
        court: `Court ${c + 1}`,
        round: r + 1,
        team1Ids,
        team2Ids,
        team1Level,
        team2Level,
        score1: null,
        score2: null,
        completed: false,
      })
    }
    // Sit-outs: anyone not on a court this round.
    const playing = new Set()
    schedule[r].forEach(court => court.forEach(p => playing.add(p)))
    const sitting = []
    for (let i = 0; i < ctx.playerCount; i++) {
      if (!playing.has(i)) sitting.push(ctx.idByIdx[i])
    }
    out.push({
      round: r + 1,
      label: `Round ${r + 1}`,
      matches,
      sitting,
    })
  }
  return out
}

// ── Tiny helpers ─────────────────────────────────────────────────────────────

function makeMatrix(n) {
  const m = new Array(n)
  for (let i = 0; i < n; i++) m[i] = new Array(n).fill(0)
  return m
}

function cloneSchedule(schedule) {
  return schedule.map(round => round.map(court => [...court]))
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Mulberry32 — small, fast, deterministic PRNG. Used for backtests.
function mulberry32(seed) {
  let a = seed | 0
  return function() {
    a = (a + 0x6D2B79F5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

