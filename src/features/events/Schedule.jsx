import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { ChevronLeft, Shuffle, AlertCircle, Trophy, Users, Download } from 'lucide-react'
import { generateLobster as generateLobsterAnnealed } from '../../lib/lobsterMatcher'
import { recomputeAllRatings } from '../../lib/ratingsRecompute'
import { supabase } from '../../supabase'
import { letterColor } from '../../lib/letterColors'
import validateSchedule from './validateSchedule'
import {
  shortName,
  generateAmericano,
  generateMexicano,
  generateRoundRobin,
} from './scheduleHelpers'

// ── Component ────────────────────────────────────────────────────────────────

export default function Schedule({ tournament, onNavigate }) {
  const {
    players,
    matches: allMatches,
    getTournamentRegistrations,
    getTournamentMatches,
    saveMatches,
    updateMatch,
    updateTournament,
    session,
  } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'

  const [rounds, setRounds] = useState(4)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(null)
  const [saved, setSaved] = useState(false)
  const [activeRound, setActiveRound] = useState(0)
  const [swapMode, setSwapMode] = useState(false)
  const [swapFirst, setSwapFirst] = useState(null) // { roundIdx, matchIdx, team, playerIdx, playerId }
  const [swapWarnings, setSwapWarnings] = useState([]) // warnings after a swap
  const [scheduleWarnings, setScheduleWarnings] = useState([]) // full validation after generate

  // Admin toggle: feed Lobster Scores (Glicko-2 shadow ratings) into the
  // matcher instead of adjusted Playtomic levels. Persisted across sessions
  // via localStorage so a reshuffle keeps the same setting.
  const [useLobsterScore, setUseLobsterScore] = useState(() => {
    try {
      return localStorage.getItem('lobster_use_score_for_matcher') === '1'
    } catch {
      return false
    }
  })
  React.useEffect(() => {
    try {
      localStorage.setItem('lobster_use_score_for_matcher', useLobsterScore ? '1' : '0')
    } catch {
      /* localStorage unavailable — silently degrade */
    }
  }, [useLobsterScore])

  // Load saved schedule into edit preview
  const handleEditSchedule = () => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    setGenerated(
      savedRounds.map((r) => ({
        ...r,
        matches: r.matches.map((m) => ({
          ...m,
          team1Ids: [...(m.team1Ids || [])],
          team2Ids: [...(m.team2Ids || [])],
        })),
      })),
    )
    setSaved(false)
    setSwapMode(true)
  }

  // Check for duplicate partnerships across all rounds
  const findPartnerConflicts = (allRounds) => {
    const warnings = []
    // Build a map: for each round, which player is partnered with whom
    const partnersByRound = allRounds.map((r, ri) => {
      const partners = {} // playerId → partnerId
      r.matches.forEach((m) => {
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
        const a = partnersByRound[i],
          b = partnersByRound[j]
        const seen = new Set()
        for (const [pid, partnerId] of Object.entries(a.partners)) {
          const key = [pid, partnerId].sort().join('-')
          if (seen.has(key)) continue
          seen.add(key)
          if (b.partners[pid] === partnerId) {
            const p1 = players.find((p) => p.id === pid)
            const p2 = players.find((p) => p.id === partnerId)
            if (p1 && p2) {
              warnings.push(
                `${(p1.name || '').split(' ')[0]} & ${(p2.name || '').split(' ')[0]} are partners in both Round ${a.round} and Round ${b.round}`,
              )
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
    if (swapFirst.playerId === playerId) {
      setSwapFirst(null)
      return
    }
    // Perform swap
    setGenerated((prev) => {
      const next = prev.map((r) => ({
        ...r,
        matches: r.matches.map((m) => ({
          ...m,
          team1Ids: [...m.team1Ids],
          team2Ids: [...m.team2Ids],
        })),
      }))
      const srcMatch = next[swapFirst.roundIdx].matches[swapFirst.matchIdx]
      const dstMatch = next[roundIdx].matches[matchIdx]
      const srcArr = swapFirst.team === 1 ? srcMatch.team1Ids : srcMatch.team2Ids
      const dstArr = team === 1 ? dstMatch.team1Ids : dstMatch.team2Ids
      const tmp = srcArr[swapFirst.playerIdx]
      srcArr[swapFirst.playerIdx] = dstArr[playerIdx]
      dstArr[playerIdx] = tmp
      // Recalculate levels
      const lvl = (ids) =>
        ids.reduce((s, id) => s + (players.find((p) => p.id === id)?.adjustedLevel || 0), 0)
      srcMatch.team1Level = lvl(srcMatch.team1Ids)
      srcMatch.team2Level = lvl(srcMatch.team2Ids)
      dstMatch.team1Level = lvl(dstMatch.team1Ids)
      dstMatch.team2Level = lvl(dstMatch.team2Ids)
      // Re-validate entire schedule after swap
      const allWarnings = validateSchedule(next, registeredPlayers, genderMode)
      setScheduleWarnings(allWarnings)
      setSwapWarnings(allWarnings.filter((w) => w.severity === 'error').map((w) => w.message))
      return next
    })
    setSwapFirst(null)
  }

  // Hooks must run on every render — these were moved above the early
  // `if (!tournament) return …` below. The data-deriving expressions are
  // guarded so they degrade to empty arrays when tournament is null.
  const regs = tournament
    ? getTournamentRegistrations(tournament.id).filter((r) => r.status === 'registered')
    : []
  const registeredPlayers = tournament
    ? players.filter((p) => regs.some((r) => r.playerId === p.id))
    : []
  const savedMatches = tournament ? getTournamentMatches(tournament.id) : []
  const numCourts = tournament ? (tournament.courts || []).length || 1 : 1
  const format = tournament ? tournament.format || 'americano' : 'americano'
  const genderMode = tournament ? tournament.genderMode || 'mixed' : 'mixed'
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
    savedMatches.forEach((m) => {
      const r = m.round || 1
      if (!byRound[r]) byRound[r] = { round: r, label: `Round ${r}`, matches: [] }
      byRound[r].matches.push(m)
    })
    Object.values(byRound).forEach((r) => {
      r.matches.sort((a, b) => courtOrder(a.court) - courtOrder(b.court))
    })
    return Object.values(byRound).sort((a, b) => a.round - b.round)
  }, [savedMatches])

  // Check if all matches have scores filled in
  const allMatchesScored = useMemo(() => {
    if (savedRounds.length === 0) return false
    const allMatches = savedRounds.flatMap((r) => r.matches)
    if (allMatches.length === 0) return false
    return allMatches.every((m) => m.completed && m.score1 != null && m.score2 != null)
  }, [savedRounds])

  const [finishing, setFinishing] = useState(false)

  if (!tournament) {
    return (
      <div className="card py-10 text-center text-gray-400">
        <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
        <p>No event selected</p>
        <button
          onClick={() => onNavigate('tournament')}
          className="btn-primary mt-4 py-2 px-5 text-sm"
        >
          Go to Events
        </button>
      </div>
    )
  }

  const display = generated || savedRounds
  const isTournamentCompleted = tournament.status === 'completed'

  const handleFinishTournament = async () => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    setFinishing(true)
    try {
      await updateTournament(tournament.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      // Fire-and-forget Glicko recompute — folds this tournament's matches
      // into shadow ratings. Errors are non-fatal; admin can also re-trigger
      // manually from Settings.
      recomputeAllRatings(supabase).catch((e) => console.warn('recompute on finish failed:', e))
      onNavigate('scores', tournament)
    } finally {
      setFinishing(false)
    }
  }

  const handleGenerate = async () => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (registeredPlayers.length < 4) {
      alert('Need at least 4 registered players to generate a schedule.')
      return
    }
    setGenerating(true)
    await new Promise((r) => setTimeout(r, 300)) // small delay for UX

    // When the Lobster Score toggle is on, swap each player's adjustedLevel
    // with their learnedLevel (Padel-scale Glicko rating). Players without a
    // learned rating fall back to their adjustedLevel so brand-new joiners
    // don't get matched as 0-rated.
    const playersForMatcher = useLobsterScore
      ? registeredPlayers.map((p) => ({
          ...p,
          adjustedLevel: p.learnedLevel != null ? p.learnedLevel : p.adjustedLevel || 0,
        }))
      : registeredPlayers

    let newRounds
    if (format === 'lobster_matching') {
      // Decayed cohort memory pulls from EVERY past completed match outside
      // this tournament. Excluding this tournament's own matches prevents
      // re-generation from biasing against itself if the admin reshuffles.
      const pastMatches = (allMatches || []).filter(
        (m) => m.tournamentId !== tournament.id && m.completed,
      )
      newRounds = generateLobsterAnnealed(
        playersForMatcher,
        numCourts,
        genderMode,
        tournament.duration || 90,
        { pastMatches },
      )
    } else if (format === 'mexicano')
      newRounds = generateMexicano(playersForMatcher, numCourts, rounds, genderMode)
    else if (format === 'roundrobin')
      newRounds = generateRoundRobin(playersForMatcher, numCourts, genderMode)
    else newRounds = generateAmericano(playersForMatcher, numCourts, rounds, genderMode)

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
      await saveMatches(
        tournament.id,
        generated.map((r) => r.matches),
      )
      setSaved(true)
      setGenerated(null)
    } finally {
      setGenerating(false)
    }
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
      const p = players.find((x) => x.id === id)
      return p ? (p.name || '').trim() : String(id)
    }
    // CSV needs proper quoting for commas and embedded quotes.
    const csvCell = (v) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = []
    lines.push(['Round', 'Court', 'Team 1', 'Team 2', 'T1 Level', 'T2 Level'].join(','))
    rounds.forEach((r) => {
      ;(r.matches || []).forEach((m) => {
        const t1 = (m.team1Ids || []).map(nameOf).join(' + ')
        const t2 = (m.team2Ids || []).map(nameOf).join(' + ')
        lines.push(
          [
            csvCell(r.round),
            csvCell(m.court),
            csvCell(t1),
            csvCell(t2),
            csvCell(m.team1Level?.toFixed?.(2) ?? m.team1Level ?? ''),
            csvCell(m.team2Level?.toFixed?.(2) ?? m.team2Level ?? ''),
          ].join(','),
        )
      })
      const sittingIds = r.sitting || []
      if (sittingIds.length) {
        lines.push(
          [
            csvCell(r.round),
            'Sitting',
            csvCell(sittingIds.map(nameOf).join('; ')),
            '',
            '',
            '',
          ].join(','),
        )
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
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `padel-lobsters-${slug || 'schedule'}-${generated ? 'preview' : 'saved'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleScoreUpdate = async (matchId, field, value) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    await updateMatch(matchId, {
      [field]: parseInt(value) || 0,
      completed: true,
    })
  }

  const getPlayer = (id) => players.find((p) => p.id === id)
  const sn = (p) => shortName(p, registeredPlayers) // smart short name

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <button
          onClick={() => onNavigate('tournament')}
          className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2"
        >
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
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${genderMode === 'mixed' ? 'bg-pink-50 text-pink-700' : 'bg-gray-100 text-gray-600'}`}
            >
              {genderMode === 'mixed' ? '🚺🚹 Mixed · gender balanced' : '👥 Same gender'}
            </span>
            {registeredPlayers.some((p) => p.isLeftHanded) && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                🤚 {registeredPlayers.filter((p) => p.isLeftHanded).length} lefty — kept separate
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
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRounds(n)}
                    className={`flex-1 py-2 text-sm rounded-xl font-semibold transition-all ${rounds === n ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <label className="flex items-start gap-2 p-3 rounded-xl bg-lobster-cream/40 border border-lobster-teal/20 cursor-pointer active:scale-[0.99] transition-transform">
              <input
                type="checkbox"
                checked={useLobsterScore}
                onChange={(e) => setUseLobsterScore(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-lobster-teal"
              />
              <span className="text-xs text-gray-700 leading-snug">
                <span className="font-semibold text-lobster-teal">
                  Use Lobster Score for matching
                </span>
                <span className="block text-[11px] text-gray-500 mt-0.5">
                  When on, the matcher uses Glicko-2 shadow ratings instead of Playtomic-adjusted
                  levels. Players without a Lobster Score yet fall back to their adjusted level.
                </span>
              </span>
            </label>
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
              <button
                onClick={handleEditSchedule}
                className="w-full py-2 text-sm text-lobster-teal font-semibold border border-lobster-teal rounded-xl"
              >
                ✏️ Edit existing schedule
              </button>
              <button
                onClick={handleDownloadCsv}
                className="w-full py-2 text-sm text-gray-600 font-semibold border border-gray-200 rounded-xl flex items-center justify-center gap-2"
                title="Download the saved schedule as a CSV"
              >
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
              <button
                onClick={() => {
                  setGenerated(null)
                  setSwapMode(false)
                  setSwapFirst(null)
                  setSwapWarnings([])
                  setScheduleWarnings([])
                }}
                className="text-xs text-gray-500 font-semibold px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadCsv}
                className="text-xs text-yellow-700 font-semibold px-2 py-1 flex items-center gap-1 border border-yellow-300 rounded-lg bg-white active:scale-95"
                title="Download the preview as a CSV you can review offline before saving"
              >
                <Download size={12} /> Download
              </button>
              <button
                onClick={handleGenerate}
                className="text-xs text-yellow-700 font-semibold px-2 py-1"
              >
                Reshuffle
              </button>
              <button
                onClick={handleSave}
                disabled={generating}
                className="text-xs bg-lobster-teal text-white px-3 py-1 rounded-lg font-semibold"
              >
                Save
              </button>
            </div>
          </div>
          {/* Swap mode toggle */}
          {isAdmin && (
            <button
              onClick={() => {
                setSwapMode((s) => !s)
                setSwapFirst(null)
                setSwapWarnings([])
              }}
              className={`w-full py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                swapMode
                  ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {swapMode
                ? swapFirst
                  ? '👆 Tap another player to swap…'
                  : '↔️ Swap Mode ON — tap a player'
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
                <p key={i} className="text-xs text-red-600">
                  • {w}
                </p>
              ))}
            </div>
          )}
          {/* Schedule validation summary */}
          {scheduleWarnings.length > 0 && (
            <div className="rounded-xl border overflow-hidden">
              {/* Errors */}
              {scheduleWarnings.some((w) => w.severity === 'error') && (
                <div className="bg-red-50 border-b border-red-200 p-3 space-y-1">
                  <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Rule violations
                  </p>
                  {scheduleWarnings
                    .filter((w) => w.severity === 'error')
                    .map((w, i) => (
                      <p key={`e${i}`} className="text-xs text-red-600">
                        • R{w.round}: {w.message}
                      </p>
                    ))}
                </div>
              )}
              {/* Warnings */}
              {scheduleWarnings.some((w) => w.severity === 'warning') && (
                <div className="bg-amber-50 border-b border-amber-200 p-3 space-y-1">
                  <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Heads up
                  </p>
                  {scheduleWarnings
                    .filter((w) => w.severity === 'warning')
                    .map((w, i) => (
                      <p key={`w${i}`} className="text-xs text-amber-600">
                        • {w.message}
                      </p>
                    ))}
                </div>
              )}
              {/* Info — unavoidable, no action needed */}
              {scheduleWarnings.some((w) => w.severity === 'info') && (
                <div className="bg-blue-50 p-3 space-y-1">
                  <p className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Unavoidable — no action needed
                  </p>
                  {scheduleWarnings
                    .filter((w) => w.severity === 'info')
                    .map((w, i) => (
                      <p key={`i${i}`} className="text-xs text-blue-600">
                        • {w.round > 0 ? `R${w.round}: ` : ''}
                        {w.message}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}
          {scheduleWarnings.length === 0 && generated && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">✅</span>
              <p className="text-xs text-green-700 font-medium">
                All rules pass — no conflicts detected
              </p>
            </div>
          )}
          {scheduleWarnings.length > 0 &&
            !scheduleWarnings.some((w) => w.severity === 'error') &&
            !scheduleWarnings.some((w) => w.severity === 'warning') &&
            generated && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                <span className="text-sm">✅</span>
                <p className="text-xs text-green-700 font-medium">
                  No rule violations — only unavoidable notes above
                </p>
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
                  activeRound === i
                    ? 'bg-lobster-teal text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
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
                  <div
                    key={match.id || i}
                    className={`card transition-all ${isSwapping ? 'ring-2 ring-orange-200' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full">
                          {match.court}
                        </span>
                        {genderMode === 'mixed' &&
                          (() => {
                            const w = [...t1, ...t2].filter((p) => p?.gender === 'female').length
                            if (w === 0) {
                              return (
                                <span
                                  title="All-male court"
                                  className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-0.5 rounded-full"
                                >
                                  Men
                                </span>
                              )
                            }
                            if (w === 4) {
                              return (
                                <span
                                  title="All-female court"
                                  className="text-xs font-bold bg-pink-100 text-pink-700 px-3 py-0.5 rounded-full"
                                >
                                  Ladies
                                </span>
                              )
                            }
                            return (
                              <span
                                title="Mixed court"
                                className="text-xs font-semibold bg-teal-50 text-teal-700 px-3 py-0.5 rounded-full"
                              >
                                Mixed
                              </span>
                            )
                          })()}
                      </div>
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
                            <div
                              key={p.id}
                              onClick={() => handlePlayerTap(activeRound, i, 1, pi, p.id)}
                              className={`flex items-center gap-1.5 mb-1 rounded-lg px-1 transition-all ${isSwapping ? 'cursor-pointer active:scale-95' : ''} ${isSelected ? 'bg-orange-100 ring-2 ring-orange-400' : isSwapping ? 'hover:bg-gray-100' : ''}`}
                            >
                              <div className="relative w-7 h-7 flex-shrink-0">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${isSelected ? 'bg-orange-500' : ''}`}
                                  style={
                                    isSelected
                                      ? undefined
                                      : { backgroundColor: letterColor(p.name) }
                                  }
                                >
                                  {p.name[0]}
                                </div>
                                {p.isLeftHanded && (
                                  <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                    L
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-medium truncate">{sn(p)}</span>
                            </div>
                          )
                        })}

                        {match.team1Level && (
                          <p className="text-xs text-gray-400 mt-1">
                            Avg {(match.team1Level / 2).toFixed(1)}
                          </p>
                        )}
                        {isAdmin &&
                          (() => {
                            const rated = t1.filter((p) => p.learnedLevel != null)
                            if (rated.length === 0) return null
                            const avg = rated.reduce((s, p) => s + p.learnedLevel, 0) / rated.length
                            return (
                              <p
                                className="text-[10px] text-lobster-teal/70 font-semibold mt-0.5"
                                title="Lobster Score team average (Glicko-2 shadow rating)"
                              >
                                Lobster {avg.toFixed(2)}
                                {rated.length < t1.length ? '*' : ''}
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
                              type="number"
                              min="0"
                              max="15"
                              className="w-10 h-9 text-center text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal"
                              defaultValue={match.score1 ?? ''}
                              onBlur={(e) => handleScoreUpdate(match.id, 'score1', e.target.value)}
                            />
                            <span className="text-gray-400">-</span>
                            <input
                              type="number"
                              min="0"
                              max="15"
                              className="w-10 h-9 text-center text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal"
                              defaultValue={match.score2 ?? ''}
                              onBlur={(e) => handleScoreUpdate(match.id, 'score2', e.target.value)}
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
                            <div
                              key={p.id}
                              onClick={() => handlePlayerTap(activeRound, i, 2, pi, p.id)}
                              className={`flex items-center justify-end gap-1.5 mb-1 rounded-lg px-1 transition-all ${isSwapping ? 'cursor-pointer active:scale-95' : ''} ${isSelected ? 'bg-orange-100 ring-2 ring-orange-400' : isSwapping ? 'hover:bg-gray-100' : ''}`}
                            >
                              <span className="text-sm font-medium truncate">{sn(p)}</span>
                              <div className="relative w-7 h-7 flex-shrink-0">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${isSelected ? 'bg-orange-500' : ''}`}
                                  style={
                                    isSelected
                                      ? undefined
                                      : { backgroundColor: letterColor(p.name) }
                                  }
                                >
                                  {p.name[0]}
                                </div>
                                {p.isLeftHanded && (
                                  <span className="absolute -top-1 -left-1 text-[9px] bg-amber-400 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                                    L
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}

                        {match.team2Level && (
                          <p className="text-xs text-gray-400 mt-1">
                            Avg {(match.team2Level / 2).toFixed(1)}
                          </p>
                        )}
                        {isAdmin &&
                          (() => {
                            const rated = t2.filter((p) => p.learnedLevel != null)
                            if (rated.length === 0) return null
                            const avg = rated.reduce((s, p) => s + p.learnedLevel, 0) / rated.length
                            return (
                              <p
                                className="text-[10px] text-lobster-teal/70 font-semibold mt-0.5"
                                title="Lobster Score team average (Glicko-2 shadow rating)"
                              >
                                Lobster {avg.toFixed(2)}
                                {rated.length < t2.length ? '*' : ''}
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
                    {display[activeRound].sitting.map((id) => {
                      const p = getPlayer(id)
                      return p ? (
                        <span
                          key={id}
                          className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded-full"
                        >
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
              <p className="text-xs text-green-600">
                Finish the tournament to generate the final standings.
              </p>
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
          <p className="text-sm text-yellow-700 font-medium">
            All matches scored — waiting for admin to finish the tournament.
          </p>
        </div>
      )}
    </div>
  )
}
