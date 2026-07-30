import React, { useCallback, useMemo, useState } from 'react'
import { useApp } from '../../context/useApp'
import { usePlayers } from '../players/usePlayers'
import { useMatches, useMatchActions } from './useMatches'
import { useRegistrations } from './useRegistrations'
import { Shuffle, AlertCircle, Trophy, Users, Download } from 'lucide-react'
import { letterColor } from '../../lib/letterColors'
import validateSchedule from './validateSchedule'
import { formatLabel } from './eventHelpers'
import { shortName } from './scheduleHelpers'
import ScoreEntry from './ScoreEntry'
import { EmptyState } from '../../components/ui/EmptyState'
import { useTournamentSync } from './useTournamentSync'
import ScheduleGeneratorControls from './schedule/ScheduleGeneratorControls'
import ScheduleValidationSummary from './schedule/ScheduleValidationSummary'
import MatchmakingContainer from '../matchmaking/MatchmakingContainer'
import { useMmRatings } from '../matchmaking/useMatchmaking'
import {
  buildPlayerById,
  buildSavedRounds,
  buildScheduleCsv,
  cloneRounds,
  downloadCsvFile,
  roundsForDuration,
} from './schedule/utils'
import type { EntityId, ScheduleRound, ScheduleWarning } from './schedule/types'
import type { EventNavigate } from './eventHelpers'
import type { NormalisedTournament, Player } from '../../lib/normalise'
import type { GenderMode } from '../matchmaking/domain/types'

// A player slot the admin has tapped first in swap mode.
interface SwapAnchor {
  roundIdx: number
  matchIdx: number
  team: 1 | 2
  playerIdx: number
  playerId: EntityId
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Schedule({
  tournament,
  onNavigate,
}: {
  tournament: NormalisedTournament | null
  onNavigate: EventNavigate
}) {
  const { session } = useApp()
  const { saveMatches, updateMatch } = useMatchActions()
  const { data: players = [] } = usePlayers()
  const { data: savedMatches = [] } = useMatches(tournament?.id)
  const { data: regsData = [] } = useRegistrations(tournament?.id)
  const isAdmin = session?.user?.app_metadata?.role === 'admin'

  const [rounds, setRounds] = useState(4)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<ScheduleRound[] | null>(null)
  const [saved, setSaved] = useState(false)
  const [activeRound, setActiveRound] = useState(0)
  const [swapMode, setSwapMode] = useState(false)
  const [swapFirst, setSwapFirst] = useState<SwapAnchor | null>(null)
  const [swapWarnings, setSwapWarnings] = useState<string[]>([]) // warnings after a swap
  const [scheduleWarnings, setScheduleWarnings] = useState<ScheduleWarning[]>([]) // full validation after generate

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

  const handlePlayerTap = (
    roundIdx: number,
    matchIdx: number,
    team: 1 | 2,
    playerIdx: number,
    playerId: EntityId,
  ) => {
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
      if (!prev) return prev
      const anchor = swapFirst
      const next = prev.map((r) => ({
        ...r,
        matches: r.matches.map((m) => ({
          ...m,
          team1Ids: [...(m.team1Ids || [])],
          team2Ids: [...(m.team2Ids || [])],
        })),
      }))
      const srcMatch = next[anchor.roundIdx].matches[anchor.matchIdx]
      const dstMatch = next[roundIdx].matches[matchIdx]
      const srcArr = anchor.team === 1 ? srcMatch.team1Ids : srcMatch.team2Ids
      const dstArr = team === 1 ? dstMatch.team1Ids : dstMatch.team2Ids
      if (!srcArr || !dstArr) return prev
      const tmp = srcArr[anchor.playerIdx]
      srcArr[anchor.playerIdx] = dstArr[playerIdx]
      dstArr[playerIdx] = tmp
      // Recalculate levels
      const lvl = (ids: EntityId[]) =>
        ids.reduce<number>((s, id) => s + (playerById.get(String(id))?.playtomicLevel || 0), 0)
      srcMatch.team1Level = lvl(srcMatch.team1Ids || [])
      srcMatch.team2Level = lvl(srcMatch.team2Ids || [])
      dstMatch.team1Level = lvl(dstMatch.team1Ids || [])
      dstMatch.team2Level = lvl(dstMatch.team2Ids || [])
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
  const regs = useMemo(() => regsData.filter((r) => r.status === 'registered'), [regsData])
  const registeredPlayers = useMemo(() => {
    const registeredIds = new Set(regs.map((reg) => String(reg.playerId)))
    return players.filter((player) => registeredIds.has(String(player.id)))
  }, [players, regs])
  const numCourts = tournament ? (tournament.courts || []).length || 1 : 1
  const format = tournament ? tournament.format || 'lobster_matching' : 'lobster_matching'
  const genderMode = tournament ? tournament.genderMode || 'mixed' : 'mixed'
  const isLobster = format === 'lobster_matching'

  // Matchmaking V2 is the only generator, for every event regardless of
  // `format`. Gating this on `isLobster` was the bug: init.sql defaulted
  // `format` to 'americano', so any event created without an explicit format
  // (seed rows, anything predating D-020) silently fell through to the legacy
  // annealed path — since deleted along with the other V1 generators.
  const useV2Matcher = isAdmin
  const v2GenderMode: GenderMode = (['men', 'women', 'mixed'] as const).includes(
    genderMode as GenderMode,
  )
    ? (genderMode as GenderMode)
    : 'mixed'
  const v2Rounds = roundsForDuration(tournament?.duration)
  const scoresEntered = useMemo(
    () => (savedMatches || []).some((m) => m.score1 != null || m.score2 != null),
    [savedMatches],
  )
  // The learned prior comes from the admin-only RPC, not the roster: mm_* is
  // excluded from players_public (DESIGN §5), so reading it off `players` would
  // always be null and every event would re-seed from playtomic_level.
  const { data: mmRatings } = useMmRatings({ enabled: useV2Matcher })
  const v2Roster = useMemo(
    () =>
      registeredPlayers.map((p) => {
        const learned = mmRatings?.[String(p.id)]
        return {
          playerId: String(p.id),
          name: p.name,
          playtomicLevel: p.playtomicLevel ?? 0,
          mmRating: learned?.mu ?? null,
          mmSigma: learned?.sigma ?? null,
          isLeftHanded: Boolean(p.isLeftHanded),
          gender: p.gender ?? null,
        }
      }),
    [registeredPlayers, mmRatings],
  )

  // Group saved matches by round, and keep matches within a round sorted
  // by court number ascending (Court 1 first, etc.) so the admin always
  // sees courts in the same natural order.
  const savedRounds = useMemo(() => buildSavedRounds(savedMatches), [savedMatches])

  const playerById = useMemo(() => buildPlayerById(players), [players])
  const getPlayer = useCallback((id: EntityId) => playerById.get(String(id)), [playerById])
  const sn = (p: Player) => shortName(p, registeredPlayers) // smart short name

  // Sync peer score updates in real-time while the tournament is active.
  // Disabled for completed events — scores are frozen.
  useTournamentSync({
    tournamentId: tournament?.id,
    enabled: tournament != null && tournament.status !== 'completed',
  })

  if (!tournament) {
    return (
      <EmptyState
        icon={<AlertCircle size={36} />}
        title="No event selected"
        action={
          <button
            onClick={() => onNavigate('tournament')}
            className="btn-primary mt-2 py-2 px-5 text-sm"
          >
            Go to Events
          </button>
        }
      />
    )
  }

  const display = generated || savedRounds
  const isTournamentCompleted = tournament.status === 'completed'

  // MatchmakingContainer is the only generator (`useV2Matcher = isAdmin`), so
  // this handler is only ever reached by a non-admin, who gets bounced.
  const handleGenerate = () => {
    onNavigate?.('settings')
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

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-lob-slate">
          <Users size={15} className="text-lob-teal" />
          {registeredPlayers.length} players · {numCourts} court{numCourts > 1 ? 's' : ''}
        </div>
        <span className="text-xs font-semibold bg-lob-cream text-lob-teal px-2.5 py-1 rounded-full">
          {formatLabel(format)}
        </span>
      </div>

      {/* Generator controls — admin-only. Players never see this box;
          they only see the saved schedule once an admin has generated it.
          Lobster events are served by MatchmakingContainer; the legacy controls
          below only appear for older non-Lobster events. The saved-schedule
          display underneath is shared by both. */}
      {useV2Matcher ? (
        <MatchmakingContainer
          tournamentId={String(tournament.id)}
          roster={v2Roster}
          courts={numCourts}
          rounds={v2Rounds}
          genderMode={v2GenderMode}
          scoresEntered={scoresEntered}
        />
      ) : (
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
          onGenerate={handleGenerate}
          generating={generating}
          savedRounds={savedRounds}
          onEditSchedule={handleEditSchedule}
          onDownloadCsv={handleDownloadCsv}
          tournamentDuration={tournament.duration}
        />
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
                className="text-xs text-lob-muted font-semibold px-2 py-1"
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
                className="text-xs bg-lob-teal text-white px-3 py-1 rounded-lg font-semibold"
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
                  : 'bg-gray-100 text-lob-slate'
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
                    ? 'bg-lob-teal text-white'
                    : 'bg-white text-lob-slate border border-gray-200'
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
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-lob-muted text-center">
                  {display[activeRound].note}
                </div>
              )}

              {display[activeRound].matches.length === 0 && !display[activeRound].note && (
                <p className="text-sm text-lob-muted-light text-center py-4">
                  No matches for this round
                </p>
              )}

              {display[activeRound].matches.map((match, i) => {
                const isPlayer = (p: Player | undefined): p is Player => Boolean(p)
                const t1 = match.team1Ids?.map(getPlayer).filter(isPlayer) || []
                const t2 = match.team2Ids?.map(getPlayer).filter(isPlayer) || []
                const isSwapping = swapMode && generated

                return (
                  <div
                    key={match.id || i}
                    className={`card transition-all ${isSwapping ? 'ring-2 ring-orange-200' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-lob-teal bg-lob-cream px-2 py-0.5 rounded-full">
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
                          <p className="text-xs text-lob-muted-light mt-1">
                            Avg {(match.team1Level / 2).toFixed(1)}
                          </p>
                        )}
                      </div>

                      {/* Score */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        <span className="text-xs text-lob-muted-light font-medium">vs</span>
                        {match.id && isAdmin ? (
                          <ScoreEntry
                            match={{
                              id: String(match.id),
                              score1: match.score1 ?? null,
                              score2: match.score2 ?? null,
                              completed: Boolean(match.completed),
                            }}
                            onUpdate={updateMatch}
                            variant="input"
                          />
                        ) : (
                          <div className="flex items-center gap-1 text-lg font-bold text-lob-slate">
                            <span>{match.score1 ?? '—'}</span>
                            <span className="text-lob-muted-light/60">-</span>
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
                          <p className="text-xs text-lob-muted-light mt-1">
                            Avg {(match.team2Level / 2).toFixed(1)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Sitting out */}
              {(display[activeRound].sitting || []).length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-lob-muted mb-2">
                    Sitting out this round
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(display[activeRound].sitting || []).map((id) => {
                      const p = getPlayer(id)
                      return p ? (
                        <span
                          key={id}
                          className="text-xs bg-white border border-gray-200 text-lob-slate px-2 py-1 rounded-full"
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
        <EmptyState icon={<Shuffle size={36} />} title="No schedule generated yet" />
      )}

      {/* ── Tournament completed → View Results ──────────────── */}
      {isTournamentCompleted && (
        <button
          onClick={() => onNavigate('scores', tournament)}
          className="w-full bg-gradient-to-r from-yellow-400 to-lob-coral text-white font-bold py-3 rounded-2xl text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Trophy size={18} /> View Results
        </button>
      )}
    </div>
  )
}
