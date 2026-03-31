import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronLeft, Shuffle, AlertCircle, Trophy, Users } from 'lucide-react'
import AdminLogin from './AdminLogin'

// ── Pairing algorithms ──────────────────────────────────────────────────────

/**
 * Americano: randomised pairings, balanced by level.
 * Each round: pair strongest with weakest, etc., then arrange matches so
 * team totals are as close as possible.
 */
function generateAmericano(players, courts, rounds = 4) {
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const numCourts = Math.min(courts, Math.floor(players.length / 4))
  const playersPerRound = numCourts * 4

  const allRounds = []

  for (let r = 0; r < rounds; r++) {
    // Shuffle slightly each round (keep balance but vary pairings)
    const pool = [...sorted]
    if (r > 0) {
      // Introduce some shuffle to vary partners
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      pool.sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
    }

    const active = pool.slice(0, playersPerRound)
    const sitting = pool.slice(playersPerRound)

    const roundMatches = []

    // Pair: 1st + last, 2nd + second-last, etc. within each group of 4
    for (let i = 0; i < numCourts; i++) {
      const group = active.slice(i * 4, i * 4 + 4)
      if (group.length < 4) break

      // Within 4 players sorted by level, best pairing is [0,3] vs [1,2]
      const team1 = [group[0], group[3]]
      const team2 = [group[1], group[2]]

      roundMatches.push({
        court: courts > 1 ? `Court ${i + 1}` : 'Court',
        team1Ids: team1.map(p => p.id),
        team2Ids: team2.map(p => p.id),
        team1Level: team1.reduce((s, p) => s + (p.adjustedLevel || 0), 0),
        team2Level: team2.reduce((s, p) => s + (p.adjustedLevel || 0), 0),
        score1: null, score2: null,
        completed: false,
      })
    }

    allRounds.push({
      round: r + 1,
      label: `Round ${r + 1}`,
      matches: roundMatches,
      sitting: sitting.map(p => p.id),
    })
  }

  return allRounds
}

/**
 * Mexicano: after round 1, winners play winners, losers play losers.
 * For scheduling purposes we generate round 1 balanced, subsequent rounds
 * are placeholders (filled in after scores are entered).
 */
function generateMexicano(players, courts, rounds = 4) {
  // Round 1 is like Americano
  const round1 = generateAmericano(players, courts, 1)
  const placeholders = Array.from({ length: rounds - 1 }, (_, i) => ({
    round: i + 2,
    label: `Round ${i + 2}`,
    matches: [],
    sitting: [],
    note: 'Generated after Round 1 scores are entered',
  }))
  return [...round1, ...placeholders]
}

/**
 * Round Robin: every pair of players meets once (or twice for doubles).
 * For padel doubles: generate all team combinations.
 */
function generateRoundRobin(players, courts) {
  const sorted = [...players].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))
  const matches = []

  // Simple pairing: rotate positions
  const n = sorted.length
  const rounds = []
  const numCourts = Math.floor(n / 4)

  // We'll generate ceil(n/4) rounds for a simplified round-robin
  for (let r = 0; r < n - 1; r++) {
    const roundMatches = []
    for (let i = 0; i < numCourts; i++) {
      const idx = (i * 2 + r) % sorted.length
      const a = sorted[idx % n]
      const b = sorted[(idx + 1) % n]
      const c = sorted[(idx + 2) % n]
      const d = sorted[(idx + 3) % n]
      if (!a || !b || !c || !d) continue
      roundMatches.push({
        court: `Court ${i + 1}`,
        team1Ids: [a.id, b.id],
        team2Ids: [c.id, d.id],
        team1Level: (a.adjustedLevel || 0) + (b.adjustedLevel || 0),
        team2Level: (c.adjustedLevel || 0) + (d.adjustedLevel || 0),
        score1: null, score2: null,
        completed: false,
      })
    }
    if (roundMatches.length > 0) {
      rounds.push({ round: r + 1, label: `Round ${r + 1}`, matches: roundMatches, sitting: [] })
    }
    if (rounds.length >= 6) break // cap for sanity
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
    if (format === 'mexicano') newRounds = generateMexicano(registeredPlayers, numCourts, rounds)
    else if (format === 'roundrobin') newRounds = generateRoundRobin(registeredPlayers, numCourts)
    else newRounds = generateAmericano(registeredPlayers, numCourts, rounds)

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
          {(format === 'americano' || format === 'mexicano') && (
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
                            <div className="w-7 h-7 rounded-full bg-lobster-teal flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {p.name[0]}
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
                            <div className="w-7 h-7 rounded-full bg-lobster-orange flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {p.name[0]}
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
