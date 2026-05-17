// ── Smart pairing engine ─────────────────────────────────────────────────────

/** Score how good it is to pair A with B as partners. Lower = better. */
export function pairScore(a, b, partnerHistory, avoidWWPairs) {
  let score = 0
  if (a.isLeftHanded && b.isLeftHanded) score += 100000 // Absolute: no two lefties
  if (partnerHistory[a.id]?.has(b.id)) score += 100000 // Absolute: never repeat a partner
  if (avoidWWPairs && a.gender === 'female' && b.gender === 'female') score += 50
  // PREFER complementary levels: pair strong with weak so teams are balanced.
  // This is a nice-to-have — it yields to the hard constraints above.
  score -= Math.abs((a.adjustedLevel || 0) - (b.adjustedLevel || 0)) * 0.8
  score += Math.random() * 0.3 // jitter: break ties randomly so each reshuffle differs
  return score
}

/** Score how good it is to put pair t1 against pair t2 on same court. */
export function courtScore(t1, t2, opponentHistory, isMixed) {
  const lvl = (pair) => pair.reduce((s, p) => s + (p.adjustedLevel || 0), 0)
  const levelDiff = Math.abs(lvl(t1) - lvl(t2))
  let oppPenalty = 0
  t1.forEach((p) =>
    t2.forEach((q) => {
      if (opponentHistory[p.id]?.has(q.id)) oppPenalty += 200 // heavy penalty — want fresh faces on every court
    }),
  )
  // In mixed mode: women must never face an all-male team. Every court is
  // either WM vs WM or MM vs MM — never WM vs MM. This is absolute; level
  // balance yields entirely.
  if (isMixed) {
    const t1HasW = t1.some((p) => p.gender === 'female')
    const t2HasW = t2.some((p) => p.gender === 'female')
    if (t1HasW !== t2HasW) oppPenalty += 100000
  }
  return levelDiff + oppPenalty + Math.random() * 0.5
}

/** Shuffle an array in place (Fisher-Yates). */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Build N/2 pairs respecting: no two lefties, minimize repeat partners,
 * spread women across courts in mixed mode.
 *
 * Uses a **multi-attempt** approach: run the greedy pairing with different
 * random traversal orders and keep the attempt with the lowest total cost.
 * This prevents the old bug where a fixed traversal order forced the last
 * few players into repeat partnerships every time.
 *
 * Men and women are shuffled TOGETHER (not women-first) so the greedy
 * pass can start from any player — bottom-up, top-down, interleaved.
 * The W-W avoidance penalty (+50) plus multi-attempt ensures we almost
 * always find a solution without same-gender pairs in mixed mode, while
 * giving much more variety in partner assignments.
 */
export function buildSmartPairs(pool, partnerHistory, genderMode) {
  const isMixed = genderMode === 'mixed'
  const womenCount = isMixed ? pool.filter((p) => p.gender === 'female').length : 0
  const avoidWWPairs = isMixed && womenCount <= Math.floor(pool.length / 2)

  // Only left-handers need priority (hard no-LL constraint). Everyone else
  // — men AND women — goes into one pool and gets fully shuffled per attempt.
  const leftyIdx = [],
    otherIdx = []
  pool.forEach((p, i) => {
    if (p.isLeftHanded) leftyIdx.push(i)
    else otherIdx.push(i)
  })

  // One greedy pass with a given traversal order.
  const greedyPass = (indices) => {
    const available = new Array(pool.length).fill(true)
    const pairs = []
    for (const i of indices) {
      if (!available[i]) continue
      available[i] = false
      let bestJ = -1,
        bestScore = Infinity
      for (let j = 0; j < pool.length; j++) {
        if (!available[j]) continue
        const s = pairScore(pool[i], pool[j], partnerHistory, avoidWWPairs)
        if (s < bestScore) {
          bestScore = s
          bestJ = j
        }
      }
      if (bestJ !== -1) {
        available[bestJ] = false
        pairs.push([pool[i], pool[bestJ]])
      }
    }
    return pairs
  }

  // Count how many pairs repeat a previous partnership (the thing we MUST avoid).
  const countRepeats = (pairs) => pairs.filter(([a, b]) => partnerHistory[a.id]?.has(b.id)).length

  // Total cost (lower = better). Used to break ties when repeat count is equal.
  const totalCost = (pairs) =>
    pairs.reduce((sum, [a, b]) => sum + pairScore(a, b, partnerHistory, avoidWWPairs), 0)

  // Run up to 80 attempts. We ONLY bail early when we find a solution
  // with zero repeat partners. Otherwise keep searching — more variety
  // is always worth the (negligible) compute.
  let bestPairs = null,
    bestRepeats = Infinity,
    bestCost = Infinity
  const ATTEMPTS = 80
  for (let t = 0; t < ATTEMPTS; t++) {
    const indices = [...shuffle([...leftyIdx]), ...shuffle([...otherIdx])]
    const pairs = greedyPass(indices)
    const repeats = countRepeats(pairs)
    const cost = totalCost(pairs)
    // Prefer fewer repeats; break ties by lower total cost.
    if (repeats < bestRepeats || (repeats === bestRepeats && cost < bestCost)) {
      bestRepeats = repeats
      bestCost = cost
      bestPairs = pairs
    }
    if (bestRepeats === 0) break // perfect — no need to keep looking
  }
  return bestPairs
}

/**
 * Assign pairs to courts: prefer WM+WM (gender balanced), minimise
 * level difference AND repeat opponents.
 *
 * Uses multi-attempt with shuffled pair order so the same opponents
 * don't keep meeting each other across rounds.
 */
export function pairsToCourtMatches(
  pairs,
  numCourts,
  roundNum,
  opponentHistory = {},
  genderMode = 'mixed',
) {
  const isMixed = genderMode === 'mixed'
  const lvl = (pair) => pair.reduce((s, p) => s + (p.adjustedLevel || 0), 0)
  const hasW = (pair) => pair.some((p) => p.gender === 'female')

  const pickBest = (target, pool) => {
    let bestIdx = 0,
      bestScore = Infinity
    pool.forEach((p, i) => {
      const s = courtScore(target, p, opponentHistory, isMixed)
      if (s < bestScore) {
        bestScore = s
        bestIdx = i
      }
    })
    return bestIdx
  }

  const buildMatch = (t1, t2, courtNum) => ({
    court: `Court ${courtNum}`,
    round: roundNum,
    team1Ids: t1.map((p) => p.id),
    team2Ids: t2.map((p) => p.id),
    team1Level: lvl(t1),
    team2Level: lvl(t2),
    score1: null,
    score2: null,
    completed: false,
  })

  // Score a full court assignment: total of all courtScores.
  const flat = pairs.flat()
  const totalCourtCost = (courts) =>
    courts.reduce((sum, m) => {
      const t1 = m.team1Ids.map((id) => flat.find((p) => p.id === id)).filter(Boolean)
      const t2 = m.team2Ids.map((id) => flat.find((p) => p.id === id)).filter(Boolean)
      return sum + courtScore(t1, t2, opponentHistory, isMixed)
    }, 0)

  // Count gender-mismatched courts (WM vs MM) — the thing we must avoid in
  // mixed mode. Used to rank attempts: fewer mismatches always wins.
  const countGenderClashes = (courts) => {
    if (!isMixed) return 0
    return courts.filter((m) => {
      const t1w = m.team1Ids.some((id) => flat.find((p) => p.id === id)?.gender === 'female')
      const t2w = m.team2Ids.some((id) => flat.find((p) => p.id === id)?.gender === 'female')
      return t1w !== t2w
    }).length
  }

  // One greedy pass: split pairs into WM/MM pools (shuffled), then greedily
  // assign courts. In mixed mode we try WM+WM and MM+MM first (balanced),
  // then Phase 3 is a SAFETY NET that seats any leftover pairs even if it
  // means a gender clash on one court — it's always better to seat every
  // pair than to silently drop one (which previously caused 2 players to
  // "vanish" from later rounds once the gender distribution got lopsided).
  const greedyCourtPass = () => {
    const wp = shuffle([...pairs.filter(hasW)])
    const mp = shuffle([...pairs.filter((p) => !hasW(p))])
    const courts = []
    let courtNum = 1

    // Phase 1: WM + WM (gender-balanced mixed courts)
    while (wp.length >= 2 && courts.length < numCourts) {
      const t1 = wp.shift()
      const t2 = wp.splice(pickBest(t1, wp), 1)[0]
      courts.push(buildMatch(t1, t2, courtNum++))
    }
    // Phase 2: MM + MM (balanced all-male courts)
    while (mp.length >= 2 && courts.length < numCourts) {
      const t1 = mp.shift()
      const t2 = mp.splice(pickBest(t1, mp), 1)[0]
      courts.push(buildMatch(t1, t2, courtNum++))
    }
    // Phase 3: SAFETY NET — pair whatever's left (could be 1 WM + 1 MM
    // after Phases 1/2 in mixed mode, which would create a gender-clash
    // court that the +100000 courtScore penalty lets multi-attempt ranking
    // still avoid picking as the final result, but at least every player
    // gets on a court). Non-mixed mode uses the same logic.
    const leftover = [...wp, ...mp]
    while (leftover.length >= 2 && courts.length < numCourts) {
      const t1 = leftover.shift()
      const t2 = leftover.splice(pickBest(t1, leftover), 1)[0]
      courts.push(buildMatch(t1, t2, courtNum++))
    }
    return courts
  }

  // Run multiple attempts. Rank by: fewest gender clashes → lowest opponent cost.
  let bestCourts = null,
    bestClashes = Infinity,
    bestCost = Infinity
  const ATTEMPTS = 40
  for (let t = 0; t < ATTEMPTS; t++) {
    const courts = greedyCourtPass()
    const clashes = countGenderClashes(courts)
    const cost = totalCourtCost(courts)
    if (clashes < bestClashes || (clashes === bestClashes && cost < bestCost)) {
      bestClashes = clashes
      bestCost = cost
      bestCourts = courts
    }
    if (bestClashes === 0 && bestCost < 200) break
  }
  return bestCourts
}

/**
 * After each round, assert that the match set covers exactly the active
 * player roster — no duplicates, no foreign IDs, no one silently skipped.
 * If the round is incomplete, log a console warning and return false so the
 * generator can retry. Returning true means the round is valid.
 */
export function assertRoundCoverage(matches, activePlayers, roundNum) {
  const activeIds = new Set(activePlayers.map((p) => String(p.id)))
  const seen = new Set()
  let hasDuplicate = false
  let foreign = false
  matches.forEach((m) => {
    ;[...(m.team1Ids || []), ...(m.team2Ids || [])].forEach((id) => {
      const sid = String(id)
      if (!activeIds.has(sid)) foreign = true
      if (seen.has(sid)) hasDuplicate = true
      seen.add(sid)
    })
  })
  const missingIds = [...activeIds].filter((id) => !seen.has(id))
  const ok = !hasDuplicate && !foreign && missingIds.length === 0
  if (!ok) {
    console.warn(`[Schedule] Round ${roundNum} coverage check failed:`, {
      duplicate: hasDuplicate,
      foreign,
      missingCount: missingIds.length,
      missing: missingIds,
    })
  }
  return ok
}

/** Update both partner and opponent history after a set of matches. */
export function updateHistories(pairs, matches, partnerHistory, opponentHistory) {
  pairs.forEach(([a, b]) => {
    partnerHistory[a.id].add(b.id)
    partnerHistory[b.id].add(a.id)
  })
  matches.forEach((m) => {
    m.team1Ids.forEach((id1) =>
      m.team2Ids.forEach((id2) => {
        if (!opponentHistory[id1]) opponentHistory[id1] = new Set()
        if (!opponentHistory[id2]) opponentHistory[id2] = new Set()
        opponentHistory[id1].add(id2)
        opponentHistory[id2].add(id1)
      }),
    )
  })
}
