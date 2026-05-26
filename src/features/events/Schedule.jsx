import React, { useCallback, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { usePlayers } from '../players/usePlayers'
import { Shuffle, AlertCircle, Trophy, Users, Download } from 'lucide-react'
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
import ScheduleHeader from './schedule/ScheduleHeader'
import ScheduleGeneratorControls from './schedule/ScheduleGeneratorControls'
import ScheduleValidationSummary from './schedule/ScheduleValidationSummary'
import usePersistentBoolean from './schedule/usePersistentBoolean'
import {
  buildPlayerById,
  buildSavedRounds,
  buildScheduleCsv,
  cloneRounds,
  downloadCsvFile,
  formatScheduleDate,
  hasAllMatchesScored,
} from './schedule/utils'

// ── Component ────────────────────────────────────────────────────────────────

export default function Schedule({ tournament, onNavigate }) {
  const {
    matches: allMatches,
    getTournamentRegistrations,
    getTournamentMatches,
    saveMatches,
    updateMatch,
    updateTournament,
    session,
  } = useApp()
  const { data: players = [] } = usePlayers()
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
  // matcher instead of adjusted Playtomic levels. Persisted across sessions.
  const [useLobsterScore, setUseLobsterScore] = usePersistentBoolean(
    'lobster_use_score_for_matcher',
    false,
  )

  // Load saved schedule into edit preview
  const handleEditSchedule = () => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    setGenerated(cloneRounds(savedRounds))
    setSaved(false)
    setSwapMode(true)
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
        ids.reduce((s, id) => s + (playerById.get(String(id))?.adjustedLevel || 0), 0)
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
  const regs = useMemo(() => {
    if (!tournament) return []
    return getTournamentRegistrations(tournament.id).filter((r) => r.status === 'registered')
  }, [getTournamentRegistrations, tournament])
  const registeredPlayers = useMemo(() => {
    if (!tournament) return []
    const registeredIds = new Set(regs.map((reg) => String(reg.playerId)))
    return players.filter((player) => registeredIds.has(String(player.id)))
  }, [players, regs, tournament])
  const savedMatches = useMemo(() => {
    if (!tournament) return []
    return getTournamentMatches(tournament.id)
  }, [getTournamentMatches, tournament])
  const numCourts = tournament ? (tournament.courts || []).length || 1 : 1
  const format = tournament ? tournament.format || 'americano' : 'americano'
  const genderMode = tournament ? tournament.genderMode || 'mixed' : 'mixed'
  const isLobster = format === 'lobster_matching'

  // Group saved matches by round, and keep matches within a round sorted
  // by court number ascending (Court 1 first, etc.) so the admin always
  // sees courts in the same natural order.
  const savedRounds = useMemo(() => buildSavedRounds(savedMatches), [savedMatches])

  // Check if all matches have scores filled in
  const allMatchesScored = useMemo(() => hasAllMatchesScored(savedRounds), [savedRounds])

  const playerById = useMemo(() => buildPlayerById(players), [players])
  const getPlayer = useCallback((id) => playerById.get(String(id)), [playerById])
  const sn = (p) => shortName(p, registeredPlayers) // smart short name
  const formattedDate = useMemo(() => formatScheduleDate(tournament?.date), [tournament?.date])

  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')

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
    setFinishError('')
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
    } catch (err) {
      setFinishError(err?.message || 'Could not finish tournament.')
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
    const { filename, content } = buildScheduleCsv({
      rounds,
      players,
      tournament,
      numCourts,
      registeredCount: registeredPlayers.length,
      isPreview: Boolean(generated),
    })
    downloadCsvFile(filename, content)
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <ScheduleHeader
        tournamentName={tournament.name}
        tournamentDate={tournament.date}
        formattedDate={formattedDate}
        onBack={() => onNavigate('tournament')}
      />

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
      <ScheduleGeneratorControls
        generated={generated}
        isAdmin={isAdmin}
        format={format}
        genderMode={genderMode}
        isLobster={isLobster}
        registeredPlayers={registeredPlayers}
        numCourts={numCourts}
        rounds={rounds}
        setRounds={setRounds}
        useLobsterScore={useLobsterScore}
        setUseLobsterScore={setUseLobsterScore}
        onGenerate={handleGenerate}
        generating={generating}
        savedRounds={savedRounds}
        onEditSchedule={handleEditSchedule}
        onDownloadCsv={handleDownloadCsv}
        tournamentDuration={tournament.duration}
      />

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
          <ScheduleValidationSummary warnings={scheduleWarnings} showSuccess={Boolean(generated)} />
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
          {finishError && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {finishError}
            </p>
          )}
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
