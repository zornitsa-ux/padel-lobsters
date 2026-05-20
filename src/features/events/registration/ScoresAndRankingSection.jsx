import React, { useMemo, useState } from 'react'
import {
  groupMatchesByRound,
  getSortedRoundNumbers,
  getPlayerFirstName,
  computeRankings,
  isMatchVisibleForPlayer,
} from './utils'

function ScoreSelect({ value, matchId, field, otherField, otherValue, onUpdate }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value === '' ? null : parseInt(e.target.value)
        onUpdate(matchId, {
          [field]: v,
          [otherField]: otherValue ?? 0,
          completed: v != null,
        })
      }}
      className="w-11 h-9 text-center text-base font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal bg-white"
    >
      <option value="">—</option>
      {Array.from({ length: 16 }, (_, i) => (
        <option key={i} value={i}>
          {i}
        </option>
      ))}
    </select>
  )
}

export default function ScoresAndRankingSection({
  tournament,
  players,
  isAdmin,
  claimedId,
  getTournamentMatches,
  getTournamentRegistrations,
  updateMatch,
  updateTournament,
}) {
  const [completedTab, setCompletedTab] = useState('ranking')
  const [marking, setMarking] = useState(false)
  const [tournamentError, setTournamentError] = useState('')

  const savedMatches = useMemo(
    () => getTournamentMatches(tournament.id),
    [getTournamentMatches, tournament.id],
  )

  const regs = useMemo(
    () => getTournamentRegistrations(tournament.id),
    [getTournamentRegistrations, tournament.id],
  )
  const byRound = useMemo(() => groupMatchesByRound(savedMatches), [savedMatches])
  const roundNums = useMemo(() => getSortedRoundNumbers(byRound), [byRound])
  const rankings = useMemo(
    () =>
      computeRankings({
        matches: savedMatches,
        regs,
        players,
      }),
    [savedMatches, regs, players],
  )

  const allScored = useMemo(
    () => savedMatches.length > 0 && savedMatches.every((m) => m.completed),
    [savedMatches],
  )
  const isCompleted = tournament.status === 'completed'
  const isPlayerView = !isAdmin && !isCompleted
  const claimedStr = claimedId ? String(claimedId) : null
  const visibleMatchesByRound = useMemo(() => {
    if (!isPlayerView) return byRound
    const visibleByRound = {}
    for (const round of roundNums) {
      const roundMatches = byRound[round] || []
      visibleByRound[round] = roundMatches.filter((m) => isMatchVisibleForPlayer(m, claimedStr))
    }
    return visibleByRound
  }, [isPlayerView, byRound, roundNums, claimedStr])

  if (savedMatches.length === 0 && tournament.status !== 'completed') return null

  const handleMarkComplete = async () => {
    setMarking(true)
    setTournamentError('')
    try {
      await updateTournament(tournament.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
    } catch (err) {
      setTournamentError(err?.message || 'Could not mark tournament as complete.')
    } finally {
      setMarking(false)
    }
  }

  return (
    <section className="space-y-4">
      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <div>
            <p className="font-bold text-green-800 text-sm">Tournament Completed</p>
            {tournament.completedAt && (
              <p className="text-xs text-green-600">
                {new Date(tournament.completedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setCompletedTab('ranking')}
            className={`flex-1 py-2 text-sm rounded-lg font-semibold transition-all ${
              completedTab === 'ranking' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
            }`}
          >
            🥇 Final Ranking
          </button>
          <button
            onClick={() => setCompletedTab('matches')}
            className={`flex-1 py-2 text-sm rounded-lg font-semibold transition-all ${
              completedTab === 'matches' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
            }`}
          >
            📋 Matches
          </button>
        </div>
      )}

      {(allScored || isCompleted) &&
        rankings.length > 0 &&
        (!isCompleted || completedTab === 'ranking') && (
          <div className="card space-y-3">
            <p className="font-bold text-gray-700">🥇 Final Rankings</p>

            {rankings.length >= 2 && (
              <div className="flex items-end justify-center gap-2 py-2">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xl">🥈</span>
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                    {rankings[1]?.player.name[0]}
                  </div>
                  <p className="text-xs font-semibold text-center truncate w-full">
                    {rankings[1]?.player.name.split(' ')[0]}
                  </p>
                  <div className="bg-gray-200 w-full h-10 rounded-t-xl flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-600">{rankings[1]?.pts}pts</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-2xl">🥇</span>
                  <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-lg">
                    {rankings[0]?.player.name[0]}
                  </div>
                  <p className="text-xs font-bold text-center truncate w-full">
                    {rankings[0]?.player.name.split(' ')[0]}
                  </p>
                  <div className="bg-yellow-400 w-full h-16 rounded-t-xl flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{rankings[0]?.pts}pts</span>
                  </div>
                </div>

                {rankings[2] && (
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <span className="text-xl">🥉</span>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                      style={{ background: '#CD7F32' }}
                    >
                      {rankings[2]?.player.name[0]}
                    </div>
                    <p className="text-xs font-semibold text-center truncate w-full">
                      {rankings[2]?.player.name.split(' ')[0]}
                    </p>
                    <div
                      className="w-full h-7 rounded-t-xl flex items-center justify-center"
                      style={{ background: '#CD7F32' }}
                    >
                      <span className="text-xs font-bold text-white">{rankings[2]?.pts}pts</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 uppercase border-b border-gray-100">
                    <th className="text-left pb-1.5 pl-1">#</th>
                    <th className="text-left pb-1.5">Player</th>
                    <th className="text-center pb-1.5">W</th>
                    <th className="text-center pb-1.5">L</th>
                    <th className="text-center pb-1.5">+/-</th>
                    <th className="text-center pb-1.5 font-bold text-gray-600">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((s, i) => (
                    <tr key={s.player.id} className="border-b border-gray-50">
                      <td className="py-1.5 pl-1 text-gray-400 font-bold">{i + 1}</td>
                      <td className="py-1.5 font-medium truncate max-w-[110px]">{s.player.name}</td>
                      <td className="text-center py-1.5 text-green-600 font-semibold">{s.won}</td>
                      <td className="text-center py-1.5 text-red-400">{s.lost}</td>
                      <td className="text-center py-1.5 text-gray-400">
                        {s.pf}-{s.pa}
                      </td>
                      <td className="text-center py-1.5 font-bold text-lobster-teal">{s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400">
              Total game points · Tiebreak: matches won → head-to-head
            </p>
          </div>
        )}

      {isAdmin && allScored && !isCompleted && (
        <button
          onClick={handleMarkComplete}
          disabled={marking}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-2xl active:scale-95 transition-all disabled:opacity-50"
        >
          {marking ? 'Saving…' : '✓ Mark Tournament as Complete'}
        </button>
      )}
      {isAdmin && tournamentError && (
        <p className="text-xs text-red-600 text-center" role="alert">
          {tournamentError}
        </p>
      )}

      {(!isCompleted || completedTab === 'matches') && (
        <div>
          <h3 className="font-bold text-gray-700 mb-3">
            {isPlayerView ? '🎾 Your Matches' : '📋 Match Scores'}
          </h3>
          {isPlayerView && !claimedStr && (
            <p className="text-sm text-gray-400 mb-3">Sign in to see your own schedule.</p>
          )}
          {roundNums.map((r) => {
            const visibleMatches = visibleMatchesByRound[r] || []
            return (
              <div key={r} className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Round {r}
                </p>
                <div className="space-y-2">
                  {visibleMatches.length === 0 && isPlayerView && (
                    <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-3 py-3">
                      You&apos;re sitting out this round — grab a drink, cheer the others on.
                    </p>
                  )}
                  {visibleMatches.map((match) => {
                    const t1 = (match.team1Ids || [])
                      .map((id) => getPlayerFirstName(players, id))
                      .join(' & ')
                    const t2 = (match.team2Ids || [])
                      .map((id) => getPlayerFirstName(players, id))
                      .join(' & ')
                    return (
                      <div
                        key={match.id}
                        className={`card ${match.completed ? 'border-l-4 border-green-300' : ''}`}
                      >
                        {match.court && (
                          <p className="text-[10px] font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full inline-block mb-2">
                            {match.court}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{t1}</p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1">
                            {isAdmin && !isCompleted ? (
                              <>
                                <ScoreSelect
                                  matchId={match.id}
                                  field="score1"
                                  otherField="score2"
                                  value={match.score1}
                                  otherValue={match.score2}
                                  onUpdate={updateMatch}
                                />
                                <span className="text-gray-400 font-bold text-sm">-</span>
                                <ScoreSelect
                                  matchId={match.id}
                                  field="score2"
                                  otherField="score1"
                                  value={match.score2}
                                  otherValue={match.score1}
                                  onUpdate={updateMatch}
                                />
                              </>
                            ) : (
                              <span className="text-base font-bold text-gray-700 px-1">
                                {match.score1 != null
                                  ? `${match.score1} - ${match.score2}`
                                  : '— - —'}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-semibold text-gray-800 truncate">{t2}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {savedMatches.length === 0 && isCompleted && (
            <p className="text-sm text-gray-400 text-center py-4">No match data available</p>
          )}
        </div>
      )}
    </section>
  )
}
