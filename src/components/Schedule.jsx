import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronLeft, Shuffle, AlertCircle, Trophy, Users } from 'lucide-react'
import AdminLogin from './AdminLogin'

// ── Smart pairing engine ─────────────────────────────────────────────────────

/** Score how good it is to pair A with B as partners. Lower = better. */
function pairScore(a, b, partnerHistory, avoidWWPairs) {
  let score = 0
  if (a.isLeftHanded && b.isLeftHanded) score += 10000        // Hard: no two lefties
  if (partnerHistory[a.id]?.has(b.id))  score += 1000         // Hard: repeat partner
  if (avoidWWPairs && a.gender === 'female' && b.gender === 'female') score += 50
  // PREFER complementary levels: pair strong with weak so teams are balanced
  score -= Math.abs((a.adjustedLevel || 0) - (b.adjustedLevel || 0)) * 0.8
  score += Math.random() * 0.3  // jitter: break ties randomly so each reshuffle differs
  return score
}

/** Score how good it is to put pair t1 against pair t2 on same court. */
function courtScore(t1, t2, opponentHistory) {
  const lvl = (pair) => pair.reduce((s, p) => s + (p.adjustedLevel || 0), 0)
  const levelDiff = Math.abs(lvl(t1) - lvl(t2))
  let oppPenalty = 0
  t1.forEach(p => t2.forEach(q => {
    if (opponentHistory[p.id]?.has(q.id)) oppPenalty += 50  // penalise repeat opponents — was 8, increased so it overrides level-diff
  }))
  return levelDiff + oppPenalty + Math.random() * 0.5  // jitter to break ties differently each reshuffle
}

/**
 * Build N/2 pairs respecting: no two lefties, minimize repeat partners,
 * spread women across courts in mixed mode.
 */
function buildSmartPairs(pool, partnerHistory, genderMode) {
  const isMixed = genderMode === 'mixed'
  const womenCount = isMixed ? pool.filter(p => p.gender === 'female').length : 0
  const avoidWWPairs = isMixed && womenCount <= Math.floor(pool.length / 2)

  const indices = [...Array(pool.length).keys()].sort((i, j) => {
    const a = pool[i], b = pool[j]
    if (a.isLeftHanded && !b.isLeftHanded) return -1
    if (!a.isLeftHanded && b.isLeftHanded) return 1
    if (isMixed) {
      if (a.gender === 'female' && b.gender !== 'female') return -1
      if (a.gender !== 'female' && b.gender === 'female') return 1
    }
    return 0
  })

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

/**
 * Assign pairs to courts: prefer WM+WM (gender balanced), minimise
 * level difference AND repeat opponents.
 */
function pairsToCourtMatches(pairs, numCourts, roundNum, opponentHistory = {}) {
  const lvl   = (pair) => pair.reduce((s, p) => s + (p.adjustedLevel || 0), 0)
  const hasW  = (pair) => pair.some(p => p.gender === 'female')

  const pickBest = (target, pool) => {
    let bestIdx = 0, bestScore = Infinity
    pool.forEach((p, i) => {
      const s = courtScore(target, p, opponentHistory)
      if (s < bestScore) { bestScore = s; bestIdx = i }
    })
    return bestIdx
  }

  const courts = []
  const buildMatch = (t1, t2) => ({
    court: `Court ${courts.length + 1}`, round: roundNum,
    team1Ids: t1.map(p => p.id), team2Ids: t2.map(p => p.id),
    team1Level: lvl(t1), team2Level: lvl(t2),
    score1: null, score2: null, completed: false,
  })

  const wp = [...pairs.filter(hasW)], mp = [...pairs.filter(p => !hasW(p))]

  while (wp.length >= 2 && courts.length < numCourts) {
    const t1 = wp.shift(); const t2 = wp.splice(pickBest(t1, wp), 1)[0]
    courts.push(buildMatch(t1, t2))
  }
  while (wp.length > 0 && mp.length > 0 && courts.length < numCourts) {
    const t1 = wp.shift(); const t2 = mp.splice(pickBest(t1, mp), 1)[0]
    courts.push(buildMatch(t1, t2))
  }
  while (mp.length >= 2 && courts.length < numCourts) {
    const t1 = mp.shift(); const t2 = mp.splice(pickBest(t1, mp), 1)[0]
    courts.push(buildMatch(t1, t2))
  }
  return courts
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

function generateLobster(players, numCourts, genderMode = 'mixed', duration = 90) {
  const numRounds = duration >= 120 ? 6 : 5  // 2h → 6 rounds, 90min → 5 rounds (18min each)
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active = sorted.slice(0, numCourts * 4), sitting = sorted.slice(numCourts * 4)
  const partnerHistory = {}, opponentHistory = {}
  active.forEach(p => { partnerHistory[p.id] = new Set(); opponentHistory[p.id] = new Set() })
  const allRounds = []
  for (let r = 0; r < numRounds; r++) {
    const pairs   = buildSmartPairs(active, partnerHistory, genderMode)
    const matches = pairsToCourtMatches(pairs, numCourts, r + 1, opponentHistory)
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
    const pairs   = buildSmartPairs(active, partnerHistory, genderMode)
    const matches = pairsToCourtMatches(pairs, numCourts, r + 1, opponentHistory)
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
    const pairs   = buildSmartPairs(active, partnerHistory, genderMode)
    const matches = pairsToCourtMatches(pairs, numCourts, r + 1, opponentHistory)
    if (!matches.length) break
    updateHistories(pairs, matches, partnerHistory, opponentHistory)
    rounds.push({ round: r + 1, label: `Round ${r + 1}`, matches, sitting: sitting.map(p => p.id) })
  }
  return rounds
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Schedule({ tournament, onNavigate }) {
  const {
    players, getTournamentRegistrations, getTournamentMatches,
    saveMatches, updateMatch, updateTournament, isAdmin
  } = useApp()

  const [rounds, setRounds]         = useState(4)
  const [showLogin, setShowLogin]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated]   = useState(null)
  const [saved, setSaved]           = useState(false)
  const [activeRound, setActiveRound] = useState(0)
  const [swapMode, setSwapMode]     = useState(false)
  const [swapFirst, setSwapFirst]   = useState(null) // { roundIdx, matchIdx, team, playerIdx, playerId }
  const [swapWarnings, setSwapWarnings] = useState([]) // warnings after a swap

  // Load saved schedule into edit preview
  const handleEditSchedule = () => {
    if (!isAdmin) { setShowLogin(true); return }
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
      // Check for conflicts after swap
      const conflicts = findPartnerConflicts(next)
      setSwapWarnings(conflicts)
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

  // Group saved matches by round
  const savedRounds = useMemo(() => {
    const byRound = {}
    savedMatches.forEach(m => {
      const r = m.round || 1
      if (!byRound[r]) byRound[r] = { round: r, label: `Round ${r}`, matches: [] }
      byRound[r].matches.push(m)
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
    if (!isAdmin) { setShowLogin(true); return }
    setFinishing(true)
    try {
      await updateTournament(tournament.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      onNavigate('scores', tournament)
    } finally { setFinishing(false) }
  }

  const handleGenerate = async () => {
    if (!isAdmin) { setShowLogin(true); return }
    if (registeredPlayers.length < 4) {
      alert('Need at least 4 registered players to generate a schedule.')
      return
    }
    setGenerating(true)
    await new Promise(r => setTimeout(r, 300)) // small delay for UX

    let newRounds
    if (format === 'lobster_matching') newRounds = generateLobster(registeredPlayers, numCourts, genderMode, tournament.duration || 90)
    else if (format === 'mexicano')    newRounds = generateMexicano(registeredPlayers, numCourts, rounds, genderMode)
    else if (format === 'roundrobin')  newRounds = generateRoundRobin(registeredPlayers, numCourts, genderMode)
    else                               newRounds = generateAmericano(registeredPlayers, numCourts, rounds, genderMode)

    setGenerated(newRounds)
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

  const handleScoreUpdate = async (matchId, field, value) => {
    if (!isAdmin) { setShowLogin(true); return }
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
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}

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

      {/* Generator controls (admin only) */}
      {/* Generate controls — visible to all, gated on admin login */}
      {!generated && (
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
            <button onClick={handleEditSchedule}
              className="w-full py-2 text-sm text-lobster-teal font-semibold border border-lobster-teal rounded-xl">
              ✏️ Edit existing schedule
            </button>
          )}
        </div>
      )}

      {/* Preview banner + swap + save */}
      {generated && (
        <div className="space-y-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700 flex-1">Preview — not saved yet</p>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => { setGenerated(null); setSwapMode(false); setSwapFirst(null); setSwapWarnings([]) }}
                className="text-xs text-gray-500 font-semibold px-2 py-1">Cancel</button>
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
