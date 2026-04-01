import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronLeft, Shuffle, AlertCircle, Trophy, Users } from 'lucide-react'
import AdminLogin from './AdminLogin'

// ── Smart pairing engine ─────────────────────────────────────────────────────

/**
 * Score how good it is to pair player A with player B.
 * Lower = better. Hard constraints use large penalties.
 */
function pairScore(a, b, partnerHistory, genderMode, avoidWWPairs) {
  let score = 0
  // Hard: two lefties on same team (they'd both play from the left side)
  if (a.isLeftHanded && b.isLeftHanded) score += 10000
  // Hard: repeat partner
  if (partnerHistory[a.id]?.has(b.id)) score += 1000
  // Mixed: gently spread women across courts (avoid WW pairs when women are scarce)
  if (avoidWWPairs && a.gender === 'female' && b.gender === 'female') score += 50
  // Mild: prefer partners of similar level (makes court matchups balanced)
  score += Math.abs((a.adjustedLevel || 0) - (b.adjustedLevel || 0)) * 0.5
  return score
}

/**
 * Build N/2 pairs from a pool of N players respecting:
 * - No two left-handed on same pair
 * - Minimize repeat partnerships
 * - Gender spreading (mixed mode)
 */
function buildSmartPairs(pool, partnerHistory, genderMode) {
  const isMixed = genderMode === 'mixed'
  const womenCount = isMixed ? pool.filter(p => p.gender === 'female').length : 0
  // If women are ≤ half the pool, spreading WM pairs is better than WW
  const avoidWWPairs = isMixed && womenCount <= Math.floor(pool.length / 2)

  // Process order: lefties first (hardest constraint), women next in mixed, then others
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
      const s = pairScore(pool[i], pool[j], partnerHistory, genderMode, avoidWWPairs)
      if (s < bestScore) { bestScore = s; bestJ = j }
    }
    if (bestJ !== -1) {
      available[bestJ] = false
      pairs.push([pool[i], pool[bestJ]])
    }
  }
  return pairs
}

/**
 * Assign pairs to courts ensuring gender balance:
 * - Prefer WM+WM courts (2 women, 1 per team) — ideal
 * - Accept WW+MM or WW+WM if needed
 * - Avoid WM+MM (lone woman on a court) when possible
 * - Within groupings, match by closest combined level
 */
function pairsToCourtMatches(pairs, numCourts, roundNum) {
  const lvl = (pair) => pair.reduce((s, p) => s + (p.adjustedLevel || 0), 0)
  const hasWoman = (pair) => pair.some(p => p.gender === 'female')

  const wPairs = pairs.filter(hasWoman)
  const mPairs = pairs.filter(p => !hasWoman(p))

  const courts = []

  const pickBestMatch = (target, pool) => {
    let bestIdx = 0, minDiff = Infinity
    for (let i = 0; i < pool.length; i++) {
      const diff = Math.abs(lvl(target) - lvl(pool[i]))
      if (diff < minDiff) { minDiff = diff; bestIdx = i }
    }
    return bestIdx
  }

  const buildMatch = (t1, t2) => ({
    court: `Court ${courts.length + 1}`,
    round: roundNum,
    team1Ids: t1.map(p => p.id),
    team2Ids: t2.map(p => p.id),
    team1Level: lvl(t1),
    team2Level: lvl(t2),
    score1: null, score2: null, completed: false,
  })

  const wp = [...wPairs], mp = [...mPairs]

  // 1. Woman-pairs paired with other woman-pairs (WM+WM ideal)
  while (wp.length >= 2 && courts.length < numCourts) {
    const t1 = wp.shift()
    const idx = pickBestMatch(t1, wp)
    const t2 = wp.splice(idx, 1)[0]
    courts.push(buildMatch(t1, t2))
  }

  // 2. Remaining woman-pair + man-pair (unavoidable if odd count)
  while (wp.length > 0 && mp.length > 0 && courts.length < numCourts) {
    const t1 = wp.shift()
    const idx = pickBestMatch(t1, mp)
    const t2 = mp.splice(idx, 1)[0]
    courts.push(buildMatch(t1, t2))
  }

  // 3. All-male courts
  while (mp.length >= 2 && courts.length < numCourts) {
    const t1 = mp.shift()
    const idx = pickBestMatch(t1, mp)
    const t2 = mp.splice(idx, 1)[0]
    courts.push(buildMatch(t1, t2))
  }

  return courts
}

// ── Format generators ─────────────────────────────────────────────────────────

/**
 * Lobster Matching: 6 rounds, partners rotate every round.
 * Constraints: no repeat partners, no two lefties together,
 * gender-balanced courts in mixed mode.
 */
function generateLobster(players, numCourts, genderMode = 'mixed') {
  const ROUNDS = 6
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active  = sorted.slice(0, numCourts * 4)
  const sitting = sorted.slice(numCourts * 4)

  const partnerHistory = {}
  active.forEach(p => { partnerHistory[p.id] = new Set() })

  const allRounds = []
  for (let r = 0; r < ROUNDS; r++) {
    const pairs = buildSmartPairs(active, partnerHistory, genderMode)
    const matches = pairsToCourtMatches(pairs, numCourts, r + 1)
    pairs.forEach(([a, b]) => {
      partnerHistory[a.id].add(b.id)
      partnerHistory[b.id].add(a.id)
    })
    allRounds.push({ round: r + 1, label: `Round ${r + 1}`, matches, sitting: sitting.map(p => p.id) })
  }
  return allRounds
}

/**
 * Americano: balanced pairings, strongest + weakest as partners.
 * Respects gender balance and left-handed constraints.
 */
function generateAmericano(players, numCourts, rounds = 4, genderMode = 'mixed') {
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active  = sorted.slice(0, numCourts * 4)
  const sitting = sorted.slice(numCourts * 4)

  const partnerHistory = {}
  active.forEach(p => { partnerHistory[p.id] = new Set() })

  const allRounds = []
  for (let r = 0; r < rounds; r++) {
    const pairs = buildSmartPairs(active, partnerHistory, genderMode)
    const matches = pairsToCourtMatches(pairs, numCourts, r + 1)
    pairs.forEach(([a, b]) => {
      partnerHistory[a.id].add(b.id)
      partnerHistory[b.id].add(a.id)
    })
    allRounds.push({ round: r + 1, label: `Round ${r + 1}`, matches, sitting: sitting.map(p => p.id) })
  }
  return allRounds
}

/**
 * Mexicano: round 1 Americano-style; subsequent rounds are placeholders
 * (filled after scores are entered — winners vs winners).
 */
function generateMexicano(players, numCourts, rounds = 4, genderMode = 'mixed') {
  const round1 = generateAmericano(players, numCourts, 1, genderMode)
  const placeholders = Array.from({ length: rounds - 1 }, (_, i) => ({
    round: i + 2, label: `Round ${i + 2}`, matches: [], sitting: [],
    note: 'Generated after Round 1 scores are entered',
  }))
  return [...round1, ...placeholders]
}

/**
 * Round Robin: rotate partners through all combinations.
 * Respects gender and left-handed constraints.
 */
function generateRoundRobin(players, numCourts, genderMode = 'mixed') {
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const active  = sorted.slice(0, numCourts * 4)
  const sitting = sorted.slice(numCourts * 4)

  const partnerHistory = {}
  active.forEach(p => { partnerHistory[p.id] = new Set() })

  const rounds = []
  const maxRounds = Math.min(active.length - 1, 6)
  for (let r = 0; r < maxRounds; r++) {
    const pairs = buildSmartPairs(active, partnerHistory, genderMode)
    const matches = pairsToCourtMatches(pairs, numCourts, r + 1)
    if (matches.length === 0) break
    pairs.forEach(([a, b]) => {
      partnerHistory[a.id].add(b.id)
      partnerHistory[b.id].add(a.id)
    })
    rounds.push({ round: r + 1, label: `Round ${r + 1}`, matches, sitting: sitting.map(p => p.id) })
  }
  return rounds
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Schedule({ tournament, onNavigate }) {
  const {
    players, getTournamentRegistrations, getTournamentMatches,
    saveMatches, updateMatch, isAdmin
  } = useApp()

  const [rounds, setRounds]       = useState(4)
  const [showLogin, setShowLogin] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(null) // local preview before saving
  const [saved, setSaved]         = useState(false)
  const [activeRound, setActiveRound] = useState(0)

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

  const handleGenerate = async () => {
    if (!isAdmin) { setShowLogin(true); return }
    if (registeredPlayers.length < 4) {
      alert('Need at least 4 registered players to generate a schedule.')
      return
    }
    setGenerating(true)
    await new Promise(r => setTimeout(r, 300)) // small delay for UX

    let newRounds
    if (format === 'lobster_matching') newRounds = generateLobster(registeredPlayers, numCourts, genderMode)
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
      {isAdmin && (
        <div className="card space-y-3">
          <p className="font-semibold text-gray-700 text-sm">Generate Schedule</p>

          {/* Gender & handedness notes */}
          <div className="flex flex-wrap gap-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${genderMode === 'mixed' ? 'bg-pink-50 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
              {genderMode === 'mixed' ? '🚺🚹 Mixed · gender balanced' : '👥 Same gender'}
            </span>
            {registeredPlayers.some(p => p.isLeftHanded) && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                🤚 {registeredPlayers.filter(p => p.isLeftHanded).length} lefty — kept on separate teams
              </span>
            )}
            {isLobster && (
              <span className="text-xs bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full font-medium">
                🦞 6 rounds · partners rotate
              </span>
            )}
          </div>

          {/* Rounds selector (hidden for Lobster which is always 6) */}
          {!isLobster && (format === 'americano' || format === 'mexicano') && (
            <div>
              <label className="label">Number of rounds</label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setRounds(n)}
                    className={`flex-1 py-2 text-sm rounded-xl font-semibold transition-all ${
                      rounds === n ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
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
        </div>
      )}

      {/* Preview banner + save */}
      {generated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
          <AlertCircle size={16} className="text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-700 flex-1">Preview only — pairings not saved yet</p>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={handleGenerate} className="text-xs text-yellow-700 font-semibold">Reshuffle</button>
            <button onClick={handleSave} disabled={generating} className="text-xs bg-lobster-teal text-white px-3 py-1 rounded-lg font-semibold">
              Save
            </button>
          </div>
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

                return (
                  <div key={match.id || i} className="card">
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
                        {t1.map(p => (
                          <div key={p.id} className="flex items-center gap-1.5 mb-1">
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <div className="w-7 h-7 rounded-full bg-lobster-teal flex items-center justify-center text-white text-xs font-bold">
                                {p.name[0]}
                              </div>
                              {p.isLeftHanded && <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">L</span>}
                            </div>
                            <span className="text-sm font-medium truncate">{p.name.split(' ')[0]}</span>
                          </div>
                        ))}
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
                              type="number" min="0" max="99"
                              className="w-10 h-9 text-center text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal"
                              defaultValue={match.score1 ?? ''}
                              onBlur={e => handleScoreUpdate(match.id, 'score1', e.target.value)}
                            />
                            <span className="text-gray-400">-</span>
                            <input
                              type="number" min="0" max="99"
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
                        {t2.map(p => (
                          <div key={p.id} className="flex items-center justify-end gap-1.5 mb-1">
                            <span className="text-sm font-medium truncate">{p.name.split(' ')[0]}</span>
                            <div className="relative w-7 h-7 flex-shrink-0">
                              <div className="w-7 h-7 rounded-full bg-lobster-orange flex items-center justify-center text-white text-xs font-bold">
                                {p.name[0]}
                              </div>
                              {p.isLeftHanded && <span className="absolute -top-1 -left-1 text-[9px] bg-amber-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">L</span>}
                            </div>
                          </div>
                        ))}
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
    </div>
  )
}
