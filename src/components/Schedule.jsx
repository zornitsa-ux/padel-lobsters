import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronLeft, Shuffle, AlertCircle, Trophy, Users, Download } from 'lucide-react'
import { generateLobster as generateLobsterAnnealed } from '../lib/lobsterMatcher'
import { recomputeAllRatings } from '../lib/ratingsRecompute'
import { supabase } from '../supabase'

// ── Smart pairing engine ─────────────────────────────────────────────────────

/** Score how good it is to pair A with B as partners. Lower = better. */
function pairScore(a, b, partnerHistory, avoidWWPairs) {
  let score = 0
  if (a.isLeftHanded && b.isLeftHanded) score += 100000       // Absolute: no two lefties
  if (partnerHistory[a.id]?.has(b.id))  score += 100000       // Absolute: never repeat a partner
  if (avoidWWPairs && a.gender === 'female' && b.gender === 'female') score += 50
  // PREFER complementary levels: pair strong with weak so teams are balanced.
  // This is a nice-to-have — it yields to the hard constraints above.
  score -= Math.abs((a.adjustedLevel || 0) - (b.adjustedLevel || 0)) * 0.8
  score += Math.random() * 0.3  // jitter: break ties randomly so each reshuffle differs
  return score
}

/** Score how good it is to put pair t1 against pair t2 on same court. */
function courtScore(t1, t2, opponentHistory, isMixed) {
  const lvl = (pair) => pair.reduce((s, p) => s + (p.adjustedLevel || 0), 0)
  const levelDiff = Math.abs(lvl(t1) - lvl(t2))
  let oppPenalty = 0
  t1.forEach(p => t2.forEach(q => {
    if (opponentHistory[p.id]?.has(q.id)) oppPenalty += 200  // heavy penalty — want fresh faces on every court
  }))
  // In mixed mode: women must never face an all-male team. Every court is
  // either WM vs WM or MM vs MM — never WM vs MM. This is absolute; level
  // balance yields entirely.
  if (isMixed) {
    const t1HasW = t1.some(p => p.gender === 'female')
    const t2HasW = t2.some(p => p.gender === 'female')
    if (t1HasW !== t2HasW) oppPenalty += 100000
  }
  return levelDiff + oppPenalty + Math.random() * 0.5
}

/** Shuffle an array in place (Fisher-Yates). */
function shuffle(arr) {
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
function buildSmartPairs(pool, partnerHistory, genderMode) {
  const isMixed = genderMode === 'mixed'
  const womenCount = isMixed ? pool.filter(p => p.gender === 'female').length : 0
  const avoidWWPairs = isMixed && womenCount <= Math.floor(pool.length / 2)

  // Only left-handers need priority (hard no-LL constraint). Everyone else
  // — men AND women — goes into one pool and gets fully shuffled per attempt.
  const leftyIdx = [], otherIdx = []
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
      let bestJ = -1, bestScore = Infinity
      for (let j = 0; j < pool.length; j++) {
        if (!available[j]) continue
        const s = pairScore(pool[i], pool[j], partnerHistory, avoidWWPairs)
        if (s < bestScore) { bestScore = s; bestJ = j }
      }
      if (bestJ !== -1) { available[bestJ] = false; pairs.push([pool[i], pool[bestJ]]) }
    }
    return pairs
  }

  // Count how many pairs repeat a previous partnership (the thing we MUST avoid).
  const countRepeats = (pairs) =>
    pairs.filter(([a, b]) => partnerHistory[a.id]?.has(b.id)).length

  // Total cost (lower = better). Used to break ties when repeat count is equal.
  const totalCost = (pairs) =>
    pairs.reduce((sum, [a, b]) => sum + pairScore(a, b, partnerHistory, avoidWWPairs), 0)

  // Run up to 80 attempts. We ONLY bail early when we find a solution
  // with zero repeat partners. Otherwise keep searching — more variety
  // is always worth the (negligible) compute.
  let bestPairs = null, bestRepeats = Infinity, bestCost = Infinity
  const ATTEMPTS = 80
  for (let t = 0; t < ATTEMPTS; t++) {
    const indices = [
      ...shuffle([...leftyIdx]),
      ...shuffle([...otherIdx]),
    ]
    const pairs   = greedyPass(indices)
    const repeats = countRepeats(pairs)
    const cost    = totalCost(pairs)
    // Prefer fewer repeats; break ties by lower total cost.
    if (repeats < bestRepeats || (repeats === bestRepeats && cost < bestCost)) {
      bestRepeats = repeats; bestCost = cost; bestPairs = pairs
    }
    if (bestRepeats === 0) break   // perfect — no need to keep looking
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
function pairsToCourtMatches(pairs, numCourts, roundNum, opponentHistory = {}, genderMode = 'mixed') {
  const isMixed = genderMode === 'mixed'
  const lvl   = (pair) => pair.reduce((s, p) => s + (p.adjustedLevel || 0), 0)
  const hasW  = (pair) => pair.some(p => p.gender === 'female')

  const pickBest = (target, pool) => {
    let bestIdx = 0, bestScore = Infinity
    pool.forEach((p, i) => {
      const s = courtScore(target, p, opponentHistory, isMixed)
      if (s < bestScore) { bestScore = s; bestIdx = i }
    })
    return bestIdx
  }

  const buildMatch = (t1, t2, courtNum) => ({
    court: `Court ${courtNum}`, round: roundNum,
    team1Ids: t1.map(p => p.id), team2Ids: t2.map(p => p.id),
    team1Level: lvl(t1), team2Level: lvl(t2),
    score1: null, score2: null, completed: false,
  })

  // Score a full court assignment: total of all courtScores.
  const flat = pairs.flat()
  const totalCourtCost = (courts) =>
    courts.reduce((sum, m) => {
      const t1 = m.team1Ids.map(id => flat.find(p => p.id === id)).filter(Boolean)
      const t2 = m.team2Ids.map(id => flat.find(p => p.id === id)).filter(Boolean)
      return sum + courtScore(t1, t2, opponentHistory, isMixed)
    }, 0)

  // Count gender-mismatched courts (WM vs MM) — the thing we must avoid in
  // mixed mode. Used to rank attempts: fewer mismatches always wins.
  const countGenderClashes = (courts) => {
    if (!isMixed) return 0
    return courts.filter(m => {
      const t1w = m.team1Ids.some(id => flat.find(p => p.id === id)?.gender === 'female')
      const t2w = m.team2Ids.some(id => flat.find(p => p.id === id)?.gender === 'female')
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
    const mp = shuffle([...pairs.filter(p => !hasW(p))])
    const courts = []
    let courtNum = 1

    // Phase 1: WM + WM (gender-balanced mixed courts)
    while (wp.length >= 2 && courts.length < numCourts) {
      const t1 = wp.shift(); const t2 = wp.splice(pickBest(t1, wp), 1)[0]
      courts.push(buildMatch(t1, t2, courtNum++))
    }
    // Phase 2: MM + MM (balanced all-male courts)
    while (mp.length >= 2 && courts.length < numCourts) {
      const t1 = mp.shift(); const t2 = mp.splice(pickBest(t1, mp), 1)[0]
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
  let bestCourts = null, bestClashes = Infinity, bestCost = Infinity
  const ATTEMPTS = 40
  for (let t = 0; t < ATTEMPTS; t++) {
    const courts  = greedyCourtPass()
    const clashes = countGenderClashes(courts)
    const cost    = totalCourtCost(courts)
    if (clashes < bestClashes || (clashes === bestClashes && cost < bestCost)) {
      bestClashes = clashes; bestCost = cost; bestCourts = courts
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
function assertRoundCoverage(matches, activePlayers, roundNum) {
  const activeIds = new Set(activePlayers.map(p => String(p.id)))
  const seen = new Set()
  let hasDuplicate = false
  let foreign = false
  matches.forEach(m => {
    ;[...(m.team1Ids || []), ...(m.team2Ids || [])].forEach(id => {
      const sid = String(id)
      if (!activeIds.has(sid)) foreign = true
      if (seen.has(sid)) hasDuplicate = true
      seen.add(sid)
    })
  })
  const missingIds = [...activeIds].filter(id => !seen.has(id))
  const ok = !hasDuplicate && !foreign && missingIds.length === 0
  if (!ok) {
    console.warn(
      `[Schedule] Round ${roundNum} coverage check failed:`,
      { duplicate: hasDuplicate, foreign, missingCount: missingIds.length, missing: missingIds }
    )
  }
  return ok
}

/** Update both partner and opponent history after a set of matches. */
function updateHistories(pairs, matches, partnerHistory, opponentHistory) {
  pairs.forEach(([a, b]) => {
    partnerHistory[a.id].add(b.id)
    partnerHistory[b.id].add(a.id)
  })
  matches.forEach(m => {
    m.team1Ids.forEach(id1 => m.team2Ids.forEach(id2 => {
      if (!opponentHistory[id1]) opponentHistory[id1] = new Set()
      if (!opponentHistory[id2]) opponentHistory[id2] = new Set()
      opponentHistory[id1].add(id2)
      opponentHistory[id2].add(id1)
    }))
  })
}

// ── Post-generation validation ──────────────────────────────────────────────
// Scans every round and returns a list of human-readable warnings so the
// admin can see at a glance whether the engine had to break any rule.

function validateSchedule(rounds, allPlayers, genderMode) {
  const warnings = []
  const getName = (id) => {
    const p = allPlayers.find(x => x.id === id)
    return p ? (p.name || '').split(' ')[0] : id
  }
  const isLefty = (id) => allPlayers.find(x => x.id === id)?.isLeftHanded
  const isFemale = (id) => allPlayers.find(x => x.id === id)?.gender === 'female'
  const isMixed = genderMode === 'mixed'

  // ── Unavoidable gender-clash analysis ─────────────────────────────────────
  // With an odd number of women (e.g. 7W + 9M = 16), you physically cannot
  // avoid at least one court per round being "mixed vs all-male" — a woman
  // has to partner a man and play against a male-male team. Flagging this
  // as a hard error is misleading because the admin can't "fix" it. We
  // compute the minimum unavoidable clash count per round up-front, then
  // mark the first N gender-clashes per round as informational instead of
  // an error. Any EXTRA clashes above N are still real errors (the engine
  // should have done better).
  const womenCount = allPlayers.filter(p => p.gender === 'female').length
  const menCount   = allPlayers.length - womenCount
  const teams      = Math.floor(allPlayers.length / 2)
  // unavoidableMismatchPerRound = sum of |w1 - w2| per round physically
  // forced by the W/M split. Odd women + women <= teams ⇒ one court must
  // be 1W1M vs 0W2M (mismatch = 1).
  let unavoidableMismatchPerRound = 0
  if (isMixed && womenCount > 0 && menCount > 0) {
    if (womenCount <= teams) {
      unavoidableMismatchPerRound = womenCount % 2 === 1 ? 1 : 0
    } else {
      const excess = womenCount - teams
      unavoidableMismatchPerRound = excess % 2 === 1 ? 1 : 0
    }
  }
  if (isMixed && womenCount > 0 && womenCount % 2 === 1) {
    warnings.push({
      type: 'gender-odd-women',
      severity: 'info',
      round: 0,
      message: `Odd number of women (${womenCount}). With ${womenCount}W + ${menCount}M, one court per round will have 1 woman vs an all-male team — that's unavoidable. Other courts should still be balanced.`,
    })
  }
  // Per-round running sum of mismatch already counted toward the unavoidable quota.
  const mismatchUsedByRound = {}

  // Track partnerships and opponents across rounds
  const partnersSeen = {} // "idA:idB" → [round numbers]
  const opponentsSeen = {} // "idA:idB" → [round numbers]

  // Roster we expect every round to cover — respect "sitting" for formats that
  // rotate a subset per round. If no sitting array was set, every player
  // should play every round.
  const allPlayerIds = new Set(allPlayers.map(p => String(p.id)))

  rounds.forEach(r => {
    // Rule 0: per-round coverage — every active player appears exactly once,
    // no player appears twice, no foreign player sneaks in. If the generator
    // produced a valid round this is always true; if it didn't, the admin
    // needs to know instead of finding out mid-tournament.
    const sittingIds = new Set((r.sitting || []).map(String))
    const expected = new Set([...allPlayerIds].filter(id => !sittingIds.has(id)))
    const seen = new Map()  // id → count
    const foreign = []
    ;(r.matches || []).forEach(m => {
      ;[...(m.team1Ids || []), ...(m.team2Ids || [])].forEach(id => {
        const sid = String(id)
        seen.set(sid, (seen.get(sid) || 0) + 1)
        if (!allPlayerIds.has(sid)) foreign.push(sid)
      })
    })
    const missing = [...expected].filter(id => !seen.has(id))
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    if (missing.length > 0) {
      warnings.push({
        type: 'round-missing-players',
        severity: 'error',
        round: r.round,
        message: `❌ ${missing.length} registered player${missing.length === 1 ? '' : 's'} not scheduled this round: ${missing.map(getName).join(', ')}`,
      })
    }
    if (duplicates.length > 0) {
      warnings.push({
        type: 'round-duplicate-players',
        severity: 'error',
        round: r.round,
        message: `⚠️ ${duplicates.map(getName).join(', ')} appear${duplicates.length === 1 ? 's' : ''} on more than one court this round`,
      })
    }
    if (foreign.length > 0) {
      warnings.push({
        type: 'round-foreign-players',
        severity: 'error',
        round: r.round,
        message: `❌ Non-registered player${foreign.length === 1 ? '' : 's'} in this round`,
      })
    }

    (r.matches || []).forEach(m => {
      const t1 = m.team1Ids || []
      const t2 = m.team2Ids || []

      // Rule 1: repeat partners
      const checkPair = (ids) => {
        if (ids.length !== 2) return
        const key = [...ids].sort().join(':')
        if (!partnersSeen[key]) partnersSeen[key] = []
        partnersSeen[key].push(r.round)
        if (partnersSeen[key].length === 2) {
          warnings.push({
            type: 'repeat-partner',
            severity: 'error',
            round: r.round,
            message: `🔁 ${getName(ids[0])} & ${getName(ids[1])} are partners again (also round ${partnersSeen[key][0]})`,
          })
        }
      }
      checkPair(t1)
      checkPair(t2)

      // Rule 2: two lefties on same team
      const checkLefties = (ids, teamLabel) => {
        const lefties = ids.filter(isLefty)
        if (lefties.length >= 2) {
          warnings.push({
            type: 'double-lefty',
            severity: 'error',
            round: r.round,
            message: `🫲 Two left-handers on ${teamLabel}: ${lefties.map(getName).join(' & ')}`,
          })
        }
      }
      checkLefties(t1, `Court ${m.court}`)
      checkLefties(t2, `Court ${m.court}`)

      // Rule 3: gender mismatch on court. Each team should have the same
      // number of women. Mismatch = |w1 - w2|: 0 = balanced, 1 = one extra
      // woman on one side (e.g. 1W1M vs 0W2M, or 2W0M vs 1W1M = 3W on court),
      // 2 = totally lopsided (2W0M vs 0W2M = 3W on court).
      if (isMixed) {
        const w1 = t1.filter(isFemale).length
        const w2 = t2.filter(isFemale).length
        const diff = Math.abs(w1 - w2)
        if (diff > 0) {
          const used        = mismatchUsedByRound[r.round] || 0
          const withinQuota = used + diff <= unavoidableMismatchPerRound
          mismatchUsedByRound[r.round] = used + diff
          const t1Lbl = `${w1}W${2 - w1}M`
          const t2Lbl = `${w2}W${2 - w2}M`
          warnings.push({
            type: 'gender-mismatch',
            severity: withinQuota ? 'info' : 'error',
            round: r.round,
            message: withinQuota
              ? `${m.court}: ${t1.map(getName).join('+')} (${t1Lbl}) vs ${t2.map(getName).join('+')} (${t2Lbl}) — unavoidable with ${womenCount} women`
              : `⚥ Gender imbalance on ${m.court}: ${t1.map(getName).join('+')} (${t1Lbl}) vs ${t2.map(getName).join('+')} (${t2Lbl})`,
          })
        }
        // Info: all-male court (in mixed mode) — admin can decide if OK.
        if (w1 === 0 && w2 === 0) {
          warnings.push({
            type: 'gender-all-male-court',
            severity: 'info',
            round: r.round,
            message: `♂ All-male on ${m.court}: ${t1.map(getName).join('+')} vs ${t2.map(getName).join('+')}`,
          })
        }
        // Info: all-female court (in mixed mode).
        if (w1 === 2 && w2 === 2) {
          warnings.push({
            type: 'gender-all-female-court',
            severity: 'info',
            round: r.round,
            message: `♀ All-female on ${m.court}: ${t1.map(getName).join('+')} vs ${t2.map(getName).join('+')}`,
          })
        }
      }

      // Rule 4: repeat opponents
      t1.forEach(a => t2.forEach(b => {
        const key = [a, b].sort().join(':')
        if (!opponentsSeen[key]) opponentsSeen[key] = []
        opponentsSeen[key].push(r.round)
      }))
    })
  })

  // Collect repeat opponents (only warn when 3+ meetings — 2 is expected
  // in small pools and doesn't feel like an issue to players).
  Object.entries(opponentsSeen).forEach(([key, rnds]) => {
    if (rnds.length >= 3) {
      const [a, b] = key.split(':')
      warnings.push({
        type: 'repeat-opponent',
        severity: 'warning',
        round: rnds[rnds.length - 1],
        message: `👥 ${getName(a)} & ${getName(b)} face each other ${rnds.length} times (rounds ${rnds.join(', ')})`,
      })
    }
  })

  return warnings
}

/**
 * Smart short name: returns first name if unique, otherwise first + last-initial.
 * Avoids "Gonzalo" being ambiguous when we have "Gonzalo U" and "Gonzalo E".
 */
function shortName(player, allPlayers) {
  const parts = (player.name || '').split(' ')
  const first = parts[0] || player.name
  const hasDupe = allPlayers.some(
    other => other.id !== player.id && (other.name || '').split(' ')[0] === first
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
function buildOneRound(active, numCourts, roundNum, partnerHistory, opponentHistory, genderMode) {
  const MAX_RETRIES = 8
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const pairs   = buildSmartPairs(active, partnerHistory, genderMode)
    const matches = pairsToCourtMatches(pairs, numCourts, roundNum, opponentHistory, genderMode)
    if (assertRoundCoverage(matches, active, roundNum)) {
      return { pairs, matches }
    }
    // else retry with a fresh shuffle
  }
  // Best-effort: return whatever the last attempt produced. The warnings panel
  // will still flag any issues via validateSchedule.
  const pairs   = buildSmartPairs(active, partnerHistory, genderMode)
  const matches = pairsToCourtMatches(pairs, numCourts, roundNum, opponentHistory, genderMode)
  return { pairs, matches }
}

// Legacy greedy generator. Kept for reference / quick revert; the live path
// now uses generateLobsterAnnealed from src/lib/lobsterMatcher.js.
// eslint-disable-next-line no-unused-vars
function generateLobsterLegacy(players, numCourts, genderMode = 'mixed', duration = 90) {
  const numRounds = duration >= 120 ? 6 : 5  // 2h → 6 rounds, 90min → 5 rounds (18min each)
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active = sorted.slice(0, numCourts * 4), sitting = sorted.slice(numCourts * 4)
  const partnerHistory = {}, opponentHistory = {}
  active.forEach(p => { partnerHistory[p.id] = new Set(); opponentHistory[p.id] = new Set() })
  const allRounds = []
  for (let r = 0; r < numRounds; r++) {
    const { pairs, matches } = buildOneRound(active, numCourts, r + 1, partnerHistory, opponentHistory, genderMode)
    updateHistories(pairs, matches, partnerHistory, opponentHistory)
    allRounds.push({ round: r + 1, label: `Round ${r + 1}`, matches, sitting: sitting.map(p => p.id) })
  }
  return allRounds
}

function generateAmericano(players, numCourts, rounds = 4, genderMode = 'mixed') {
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active = sorted.slice(0, numCourts * 4), sitting = sorted.slice(numCourts * 4)
  const partnerHistory = {}, opponentHistory = {}
  active.forEach(p => { partnerHistory[p.id] = new Set(); opponentHistory[p.id] = new Set() })
  const allRounds = []
  for (let r = 0; r < rounds; r++) {
    const { pairs, matches } = buildOneRound(active, numCourts, r + 1, partnerHistory, opponentHistory, genderMode)
    updateHistories(pairs, matches, partnerHistory, opponentHistory)
    allRounds.push({ round: r + 1, label: `Round ${r + 1}`, matches, sitting: sitting.map(p => p.id) })
  }
  return allRounds
}

function generateMexicano(players, numCourts, rounds = 4, genderMode = 'mixed') {
  const round1 = generateAmericano(players, numCourts, 1, genderMode)
  const placeholders = Array.from({ length: rounds - 1 }, (_, i) => ({
    round: i + 2, label: `Round ${i + 2}`, matches: [], sitting: [],
    note: 'Generated after Round 1 scores are entered',
  }))
  return [...round1, ...placeholders]
}

function generateRoundRobin(players, numCourts, genderMode = 'mixed') {
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active = sorted.slice(0, numCourts * 4), sitting = sorted.slice(numCourts * 4)
  const partnerHistory = {}, opponentHistory = {}
  active.forEach(p => { partnerHistory[p.id] = new Set(); opponentHistory[p.id] = new Set() })
  const rounds = []
  for (let r = 0; r < Math.min(active.length - 1, 6); r++) {
    const { pairs, matches } = buildOneRound(active, numCourts, r + 1, partnerHistory, opponentHistory, genderMode)
    if (!matches.length) break
    updateHistories(pairs, matches, partnerHistory, opponentHistory)
    rounds.push({ round: r + 1, label: `Round ${r + 1}`, matches, sitting: sitting.map(p => p.id) })
  }
  return rounds
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Schedule({ tournament, onNavigate }) {
  const {
    players, matches: allMatches, getTournamentRegistrations, getTournamentMatches,
    saveMatches, updateMatch, updateTournament, isAdmin
  } = useApp()

  const [rounds, setRounds]         = useState(4)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated]   = useState(null)
  const [saved, setSaved]           = useState(false)
  const [activeRound, setActiveRound] = useState(0)
  const [swapMode, setSwapMode]     = useState(false)
  const [swapFirst, setSwapFirst]   = useState(null) // { roundIdx, matchIdx, team, playerIdx, playerId }
  const [swapWarnings, setSwapWarnings] = useState([]) // warnings after a swap
  const [scheduleWarnings, setScheduleWarnings] = useState([]) // full validation after generate

  // Load saved schedule into edit preview
  const handleEditSchedule = () => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    setGenerated(savedRounds.map(r => ({
      ...r,
      matches: r.matches.map(m => ({
        ...m,
        team1Ids: [...(m.team1Ids || [])],
        team2Ids: [...(m.team2Ids || [])],
      }))
    })))
    setSaved(false)
    setSwapMode(true)
  }

  // Check for duplicate partnerships across all rounds
  const findPartnerConflicts = (allRounds) => {
    const warnings = []
    // Build a map: for each round, which player is partnered with whom
    const partnersByRound = allRounds.map((r, ri) => {
      const partners = {} // playerId → partnerId
      r.matches.forEach(m => {
        if (m.team1Ids?.length === 2) {
          partners[m.team1Ids[0]] = m.team1Ids[1]
          partners[m.team1Ids[1]] = m.team1Ids[0]
        }
        if (m.team2Ids?.length === 2) {
          partners[m.team2Ids[0]] = m.team2Ids[1]
          partners[m.team2Ids[1]] = m.team2Ids[0]
        }
      })
      return { round: ri + 1, partners }
    })

    // Compare every pair of rounds for duplicate partnerships
    for (let i = 0; i < partnersByRound.length; i++) {
      for (let j = i + 1; j < partnersByRound.length; j++) {
        const a = partnersByRound[i], b = partnersByRound[j]
        const seen = new Set()
        for (const [pid, partnerId] of Object.entries(a.partners)) {
          const key = [pid, partnerId].sort().join('-')
          if (seen.has(key)) continue
          seen.add(key)
          if (b.partners[pid] === partnerId) {
            const p1 = players.find(p => p.id === pid)
            const p2 = players.find(p => p.id === partnerId)
            if (p1 && p2) {
              warnings.push(`${(p1.name || '').split(' ')[0]} & ${(p2.name || '').split(' ')[0]} are partners in both Round ${a.round} and Round ${b.round}`)
            }
          }
        }
      }
    }
    return warnings
  }

  const handlePlayerTap = (roundIdx, matchIdx, team, playerIdx, playerId) => {
    if (!swapMode || !generated) return
    if (!swapFirst) {
      setSwapFirst({ roundIdx, matchIdx, team, playerIdx, playerId })
      return
    }
    if (swapFirst.playerId === playerId) { setSwapFirst(null); return }
    // Perform swap
    setGenerated(prev => {
      const next = prev.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m, team1Ids: [...m.team1Ids], team2Ids: [...m.team2Ids] })) }))
      const srcMatch = next[swapFirst.roundIdx].matches[swapFirst.matchIdx]
      const dstMatch = next[roundIdx].matches[matchIdx]
      const srcArr = swapFirst.team === 1 ? srcMatch.team1Ids : srcMatch.team2Ids
      const dstArr = team === 1 ? dstMatch.team1Ids : dstMatch.team2Ids
      const tmp = srcArr[swapFirst.playerIdx]
      srcArr[swapFirst.playerIdx] = dstArr[playerIdx]
      dstArr[playerIdx] = tmp
      // Recalculate levels
      const lvl = (ids) => ids.reduce((s, id) => s + (players.find(p => p.id === id)?.adjustedLevel || 0), 0)
      srcMatch.team1Level = lvl(srcMatch.team1Ids)
      srcMatch.team2Level = lvl(srcMatch.team2Ids)
      dstMatch.team1Level = lvl(dstMatch.team1Ids)
      dstMatch.team2Level = lvl(dstMatch.team2Ids)
      // Re-validate entire schedule after swap
      const allWarnings = validateSchedule(next, registeredPlayers, genderMode)
      setScheduleWarnings(allWarnings)
      setSwapWarnings(allWarnings.filter(w => w.severity === 'error').map(w => w.message))
      return next
    })
    setSwapFirst(null)
  }

  if (!tournament) {
    return (
      <div className="card py-10 text-center text-gray-400">
        <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
        <p>No event selected</p>
        <button onClick={() => onNavigate('tournament')} className="btn-primary mt-4 py-2 px-5 text-sm">
          Go to Events
        </button>
      </div>
    )
  }

  const regs = getTournamentRegistrations(tournament.id)
    .filter(r => r.status === 'registered')
  const registeredPlayers = players.filter(p => regs.some(r => r.playerId === p.id))
  const savedMatches = getTournamentMatches(tournament.id)
  const numCourts = (tournament.courts || []).length || 1
  const format = tournament.format || 'americano'
  const genderMode = tournament.genderMode || 'mixed'
  const isLobster = format === 'lobster_matching'

  // Group saved matches by round, and keep matches within a round sorted
  // by court number ascending (Court 1 first, etc.) so the admin always
  // sees courts in the same natural order.
  const savedRounds = useMemo(() => {
    const courtOrder = (label) => {
      const m = String(label ?? '').match(/(\d+)/)
      return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
    }
    const byRound = {}
    savedMatches.forEach(m => {
      const r = m.round || 1
      if (!byRound[r]) byRound[r] = { round: r, label: `Round ${r}`, matches: [] }
      byRound[r].matches.push(m)
    })
    Object.values(byRound).forEach(r => {
      r.matches.sort((a, b) => courtOrder(a.court) - courtOrder(b.court))
    })
    return Object.values(byRound).sort((a, b) => a.round - b.round)
  }, [savedMatches])

  const display = generated || savedRounds

  // Check if all matches have scores filled in
  const allMatchesScored = useMemo(() => {
    if (savedRounds.length === 0) return false
    const allMatches = savedRounds.flatMap(r => r.matches)
    if (allMatches.length === 0) return false
    return allMatches.every(m => m.completed && m.score1 != null && m.score2 != null)
  }, [savedRounds])

  const isTournamentCompleted = tournament.status === 'completed'
  const [finishing, setFinishing] = useState(false)

  const handleFinishTournament = async () => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    setFinishing(true)
    try {
      await updateTournament(tournament.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      // Fire-and-forget Glicko recompute — folds this tournament's matches
      // into shadow ratings. Errors are non-fatal; admin can also re-trigger
      // manually from Settings.
      recomputeAllRatings(supabase).catch(e => console.warn('recompute on finish failed:', e))
      onNavigate('scores', tournament)
    } finally { setFinishing(false) }
  }

  const handleGenerate = async () => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    if (registeredPlayers.length < 4) {
      alert('Need at least 4 registered players to generate a schedule.')
      return
    }
    setGenerating(true)
    await new Promise(r => setTimeout(r, 300)) // small delay for UX

    let newRounds
    if (format === 'lobster_matching') {
      // Decayed cohort memory pulls from EVERY past completed match outside
      // this tournament. Excluding this tournament's own matches prevents
      // re-generation from biasing against itself if the admin reshuffles.
      const pastMatches = (allMatches || []).filter(
        m => m.tournamentId !== tournament.id && m.completed
      )
      newRounds = generateLobsterAnnealed(
        registeredPlayers, numCourts, genderMode, tournament.duration || 90,
        { pastMatches }
      )
    }
    else if (format === 'mexicano')    newRounds = generateMexicano(registeredPlayers, numCourts, rounds, genderMode)
    else if (format === 'roundrobin')  newRounds = generateRoundRobin(registeredPlayers, numCourts, genderMode)
    else                               newRounds = generateAmericano(registeredPlayers, numCourts, rounds, genderMode)

    setGenerated(newRounds)
    setScheduleWarnings(validateSchedule(newRounds, registeredPlayers, genderMode))
    setSaved(false)
    setGenerating(false)
    setActiveRound(0)
  }

  const handleSave = async () => {
    if (!generated) return
    setGenerating(true)
    try {
      await saveMatches(tournament.id, generated.map(r => r.matches))
      setSaved(true)
      setGenerated(null)
    } finally { setGenerating(false) }
  }

  /**
   * Export the current preview (or saved) schedule as a CSV the admin can
   * open in Excel / Google Sheets / Numbers to sanity-check pairings
   * before committing. Each row is one court-match, plus a summary of
   * players-sitting-out per round at the top of the file.
   */
  const handleDownloadCsv = () => {
    const rounds = generated || savedRounds
    if (!rounds?.length) return
    const nameOf = (id) => {
      const p = players.find(x => x.id === id)
      return p ? (p.name || '').trim() : String(id)
    }
    // CSV needs proper quoting for commas and embedded quotes.
    const csvCell = (v) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = []
    lines.push(['Round', 'Court', 'Team 1', 'Team 2', 'T1 Level', 'T2 Level'].join(','))
    rounds.forEach(r => {
      ;(r.matches || []).forEach(m => {
        const t1 = (m.team1Ids || []).map(nameOf).join(' + ')
        const t2 = (m.team2Ids || []).map(nameOf).join(' + ')
        lines.push([
          csvCell(r.round),
          csvCell(m.court),
          csvCell(t1),
          csvCell(t2),
          csvCell(m.team1Level?.toFixed?.(2) ?? m.team1Level ?? ''),
          csvCell(m.team2Level?.toFixed?.(2) ?? m.team2Level ?? ''),
        ].join(','))
      })
      const sittingIds = r.sitting || []
      if (sittingIds.length) {
        lines.push([csvCell(r.round), 'Sitting', csvCell(sittingIds.map(nameOf).join('; ')), '', '', ''].join(','))
      }
    })
    // Header row with tournament context + roster summary
    const header = [
      `# ${tournament.name || 'Padel Lobsters'} — schedule ${generated ? 'preview' : 'saved'}`,
      `# Format: ${tournament.format || 'americano'} · Courts: ${numCourts} · Registered: ${registeredPlayers.length}`,
      `# Generated at ${new Date().toLocaleString()}`,
      '',
    ].join('\r\n')
    const csv = header + '\r\n' + lines.join('\r\n') + '\r\n'

    const slug = (tournament.name || 'tournament')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `padel-lobsters-${slug || 'schedule'}-${generated ? 'preview' : 'saved'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleScoreUpdate = async (matchId, field, value) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    await updateMatch(matchId, {
      [field]: parseInt(value) || 0,
      completed: true,
    })
  }

  const getPlayer = (id) => players.find(p => p.id === id)
  const sn = (p) => shortName(p, registeredPlayers) // smart short name

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <button onClick={() => onNavigate('tournament')} className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2">
          <ChevronLeft size={16} /> Events
        </button>
        <h2 className="text-lg font-bold text-gray-800">{tournament.name}</h2>
        <p className="text-sm text-gray-500">Schedule · {formatDate(tournament.date)}</p>
      </div>

      {/* Info */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users size={15} className="text-lobster-teal" />
          {registeredPlayers.length} players · {numCourts} court{numCourts > 1 ? 's' : ''}
        </div>
        <span className="text-xs font-semibold bg-lobster-cream text-lobster-teal px-2.5 py-1 rounded-full capitalize">
          {format}
        </span>
      </div>

      {/* Generator controls — admin-only. Players never see this box;
          they only see the saved schedule once an admin has generated it. */}
      {!generated && isAdmin && (
        <div className="card space-y-3">
          <p className="font-semibold text-gray-700 text-sm">Generate Schedule</p>

          <div className="flex flex-wrap gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${genderMode === 'mixed' ? 'bg-pink-50 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
              {genderMode === 'mixed' ? '🚺🚹 Mixed · gender balanced' : '👥 Same gender'}
            </span>
            {registeredPlayers.some(p => p.isLeftHanded) && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                🤚 {registeredPlayers.filter(p => p.isLeftHanded).length} lefty — kept separate
              </span>
            )}
            {isLobster && (
              <span className="text-xs bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full font-medium">
                🦞 {(tournament.duration || 90) >= 120 ? 6 : 5} rounds · partners rotate
              </span>
            )}
          </div>

          {!isLobster && (format === 'americano' || format === 'mexicano') && (
            <div>
              <label className="label">Number of rounds</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => setRounds(n)}
                    className={`flex-1 py-2 text-sm rounded-xl font-semibold transition-all ${rounds === n ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || registeredPlayers.length < 4}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Shuffle size={16} />
            {generating ? 'Generating...' : 'Generate Pairings'}
          </button>
          {registeredPlayers.length < 4 && (
            <p className="text-xs text-orange-600">Register at least 4 players first</p>
          )}
          {savedRounds.length > 0 && (
            <>
              <button onClick={handleEditSchedule}
                className="w-full py-2 text-sm text-lobster-teal font-semibold border border-lobster-teal rounded-xl">
                ✏️ Edit existing schedule
              </button>
              <button onClick={handleDownloadCsv}
                className="w-full py-2 text-sm text-gray-600 font-semibold border border-gray-200 rounded-xl flex items-center justify-center gap-2"
                title="Download the saved schedule as a CSV">
                <Download size={14} /> Download schedule (CSV)
              </button>
            </>
          )}
        </div>
      )}

      {/* Preview banner + swap + save */}
      {generated && (
        <div className="space-y-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2 flex-wrap">
            <AlertCircle size={16} className="text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700 flex-1 min-w-0">Preview — not saved yet</p>
            <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
              <button onClick={() => { setGenerated(null); setSwapMode(false); setSwapFirst(null); setSwapWarnings([]); setScheduleWarnings([]) }}
                className="text-xs text-gray-500 font-semibold px-2 py-1">Cancel</button>
              <button onClick={handleDownloadCsv}
                className="text-xs text-yellow-700 font-semibold px-2 py-1 flex items-center gap-1 border border-yellow-300 rounded-lg bg-white active:scale-95"
                title="Download the preview as a CSV you can review offline before saving">
                <Download size={12} /> Download
              </button>
              <button onClick={handleGenerate} className="text-xs text-yellow-700 font-semibold px-2 py-1">Reshuffle</button>
              <button onClick={handleSave} disabled={generating}
                className="text-xs bg-lobster-teal text-white px-3 py-1 rounded-lg font-semibold">
                Save
              </button>
            </div>
          </div>
          {/* Swap mode toggle */}
          {isAdmin && (
            <button
              onClick={() => { setSwapMode(s => !s); setSwapFirst(null); setSwapWarnings([]) }}
              className={`w-full py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                swapMode ? 'bg-orange-100 text-orange-700 border-2 border-orange-300' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {swapMode
                ? swapFirst ? '👆 Tap another player to swap…' : '↔️ Swap Mode ON — tap a player'
                : '↔️ Manually swap players'}
            </button>
          )}
          {/* Swap conflict warnings */}
          {swapWarnings.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                <AlertCircle size={14} /> Partnership conflicts detected
              </p>
              {swapWarnings.map((w, i) => (
                <p key={i} className="text-xs text-red-600">• {w}</p>
              ))}
            </div>
          )}
          {/* Schedule validation summary */}
          {scheduleWarnings.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              {/* Errors */}
              {scheduleWarnings.some(w => w.severity === 'error') && (
                <div className="bg-red-50 border-b border-red-200 p-3 space-y-1">
                  <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Rule violations
                  </p>
                  {scheduleWarnings.filter(w => w.severity === 'error').map((w, i) => (
                    <p key={`e${i}`} className="text-xs text-red-600">• R{w.round}: {w.message}</p>
                  ))}
                </div>
              )}
              {/* Warnings */}
              {scheduleWarnings.some(w => w.severity === 'warning') && (
                <div className="bg-amber-50 border-b border-amber-200 p-3 space-y-1">
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Heads up
                  </p>
                  {scheduleWarnings.filter(w => w.severity === 'warning').map((w, i) => (
                    <p key={`w${i}`} className="text-xs text-amber-600">• {w.message}</p>
                  ))}
                </div>
              )}
              {/* Info — unavoidable, no action needed */}
              {scheduleWarnings.some(w => w.severity === 'info') && (
                <div className="bg-blue-50 p-3 space-y-1">
                  <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Unavoidable — no action needed
                  </p>
                  {scheduleWarnings.filter(w => w.severity === 'info').map((w, i) => (
                    <p key={`i${i}`} className="text-xs text-blue-600">
                      • {w.round > 0 ? `R${w.round}: ` : ''}{w.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          {scheduleWarnings.length === 0 && generated && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">✅</span>
              <p className="text-xs text-green-700 font-medium">All rules pass — no conflicts detected</p>
            </div>
          )}
          {scheduleWarnings.length > 0 &&
           !scheduleWarnings.some(w => w.severity === 'error') &&
           !scheduleWarnings.some(w => w.severity === 'warning') &&
           generated && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">✅</span>
              <p className="text-xs text-green-700 font-medium">No rule violations — only unavoidable notes above</p>
            </div>
          )}
        </div>
      )}

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <Trophy size={16} className="text-green-600" />
          <p className="text-sm text-green-700 font-medium">Schedule saved!</p>
        </div>
      )}

      {/* Round tabs */}
      {display.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {display.map((r, i) => (
              <button
                key={i}
                onClick={() => setActiveRound(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeRound === i ? 'bg-lobster-teal text-white' : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Active round matches */}
          {display[activeRound] && (
            <div className="space-y-3">
              {display[activeRound].note && (
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-500 text-center">
                  {display[activeRound].note}
                </div>
              )}

              {display[activeRound].matches.length === 0 && !display[activeRound].note && (
                <p className="text-sm text-gray-400 text-center py-4">No matches for this round</p>
              )}

              {display[activeRound].matches.map((match, i) => {
                const t1 = match.team1Ids?.map(getPlayer).filter(Boolean) || []
                const t2 = match.team2Ids?.map(getPlayer).filter(Boolean) || []
                const isSwapping = swapMode && generated

                return (
                  <div key={match.id || i} className={`card transition-all ${isSwapping ? 'ring-2 ring-orange-200' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full">
                        {match.court}
                      </span>
                      {match.completed && (
                        <span className="text-xs text-green-600 font-semibold">✓ Done</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Team 1 */}
                      <div className="flex-1">
                        {t1.map((p, pi) => {
                          const isSelected = swapFirst?.playerId === p.id
                          return (
                          <div key={p.id}
                            onClick={() => handlePlayerTap(activeRound, i, 1, pi, p.id)}
                            className={`flex items-center gap-1.5 mb-1 rounded-lg px-1 transition-all ${isSwapping ? 'cursor-pointer active:scale-95' : ''} ${isSelected ? 'bg-orange-100 ring-2 ring-orange-400' : isSwapping ? 'hover:bg-gray-100' : ''}`}
                          >
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${isSelected ? 'bg-orange-500' : 'bg-lobster-teal'}`}>
                                {p.name[0]}
                              </div>
                              {p.isLeftHanded && <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">L</span>}
                            </div>
                            <span className="text-sm font-medium truncate">{sn(p)}</span>
                          </div>
                        )})}

                        {match.team1Level && (
                          <p className="text-xs text-gray-400 mt-1">Avg {(match.team1Level / 2).toFixed(1)}</p>
                        )}
                        {isAdmin && (() => {
                          const rated = t1.filter(p => p.learnedLevel != null)
                          if (rated.length === 0) return null
                          const avg = rated.reduce((s, p) => s + p.learnedLevel, 0) / rated.length
                          return (
                            <p className="text-[10px] text-lobster-teal/70 font-semibold mt-0.5" title="Lobster Score team average (Glicko-2 shadow rating)">
                              Lobster {avg.toFixed(2)}{rated.length < t1.length ? '*' : ''}
                            </p>
                          )
                        })()}
                      </div>

                      {/* Score */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        <span className="text-xs text-gray-400 font-medium">vs</span>
                        {match.id && isAdmin ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" min="0" max="15"
                              className="w-10 h-9 text-center text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal"
                              defaultValue={match.score1 ?? ''}
                              onBlur={e => handleScoreUpdate(match.id, 'score1', e.target.value)}
                            />
                            <span className="text-gray-400">-</span>
                            <input
                              type="number" min="0" max="15"
                              className="w-10 h-9 text-center text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal"
                              defaultValue={match.score2 ?? ''}
                              onBlur={e => handleScoreUpdate(match.id, 'score2', e.target.value)}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-lg font-bold text-gray-600">
                            <span>{match.score1 ?? '—'}</span>
                            <span className="text-gray-300">-</span>
                            <span>{match.score2 ?? '—'}</span>
                          </div>
                        )}
                      </div>

                      {/* Team 2 */}
                      <div className="flex-1 text-right">
                        {t2.map((p, pi) => {
                          const isSelected = swapFirst?.playerId === p.id
                          return (
                          <div key={p.id}
                            onClick={() => handlePlayerTap(activeRound, i, 2, pi, p.id)}
                            className={`flex items-center justify-end gap-1.5 mb-1 rounded-lg px-1 transition-all ${isSwapping ? 'cursor-pointer active:scale-95' : ''} ${isSelected ? 'bg-orange-100 ring-2 ring-orange-400' : isSwapping ? 'hover:bg-gray-100' : ''}`}
                          >
                            <span className="text-sm font-medium truncate">{sn(p)}</span>
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${isSelected ? 'bg-orange-500' : 'bg-lobster-orange'}`}>
                                {p.name[0]}
                              </div>
                              {p.isLeftHanded && <span className="absolute -top-1 -left-1 text-[9px] bg-amber-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">L</span>}
                            </div>
                          </div>
                        )})}

                        {match.team2Level && (
                          <p className="text-xs text-gray-400 mt-1">Avg {(match.team2Level / 2).toFixed(1)}</p>
                        )}
                        {isAdmin && (() => {
                          const rated = t2.filter(p => p.learnedLevel != null)
                          if (rated.length === 0) return null
                          const avg = rated.reduce((s, p) => s + p.learnedLevel, 0) / rated.length
                          return (
                            <p className="text-[10px] text-lobster-teal/70 font-semibold mt-0.5" title="Lobster Score team average (Glicko-2 shadow rating)">
                              Lobster {avg.toFixed(2)}{rated.length < t2.length ? '*' : ''}
                            </p>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Sitting out */}
              {display[activeRound].sitting?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Sitting out this round</p>
                  <div className="flex flex-wrap gap-2">
                    {display[activeRound].sitting.map(id => {
                      const p = getPlayer(id)
                      return p ? (
                        <span key={id} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-full">
                          {p.name}
                        </span>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {display.length === 0 && !isAdmin && (
        <div className="card py-10 text-center text-gray-400">
          <Shuffle size={36} className="mx-auto mb-2 opacity-30" />
          <p>No schedule generated yet</p>
        </div>
      )}

      {/* ── Tournament completed → View Results ──────────────── */}
      {isTournamentCompleted && (
        <button
          onClick={() => onNavigate('scores', tournament)}
          className="w-full bg-gradient-to-r from-yellow-400 to-lobster-orange text-white font-bold py-3 rounded-2xl text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Trophy size={18} /> View Results
        </button>
      )}

      {/* ── All scores filled → Finish Tournament ────────────── */}
      {allMatchesScored && !isTournamentCompleted && !generated && isAdmin && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <Trophy size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-green-800 text-sm">All scores are in!</p>
              <p className="text-xs text-green-600">Finish the tournament to generate the final standings.</p>
            </div>
          </div>
          <button
            onClick={handleFinishTournament}
            disabled={finishing}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Trophy size={16} />
            {finishing ? 'Finishing...' : 'Finish Tournament & See Results'}
          </button>
        </div>
      )}

      {/* ── Non-admin: all scored but not finished → hint ──── */}
      {allMatchesScored && !isTournamentCompleted && !isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
          <p className="text-sm text-yellow-700 font-medium">All matches scored — waiting for admin to finish the tournament.</p>
        </div>
      )}
    </div>
  )
}
