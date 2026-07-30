import { useMemo, useState } from 'react'
import {
  groupMatchesByRound,
  getSortedRoundNumbers,
  getPlayerFirstName,
  computeRankings,
  isMatchVisibleForPlayer,
} from './utils'
import type { MatchesByRound } from './utils'
import ScoreEntry from '../ScoreEntry'
import { TabSwitcher } from '../../../components/ui/TabSwitcher'
import type { Player } from '../../../lib/normalise'
import type { NormalisedTournament } from '../tournamentQueries'
import type { NormalisedRegistration } from '../registrationQueries'
import type { MatchScoreUpdate, NormalisedMatch } from '../matchQueries'

type CompletedTabId = 'ranking' | 'matches'

interface ScoresAndRankingSectionProps {
  tournament: NormalisedTournament
  players: Player[]
  isAdmin: boolean
  claimedId: string | null | undefined
  matches: NormalisedMatch[]
  registrations: NormalisedRegistration[]
  updateMatch: (id: string, data: MatchScoreUpdate) => void | Promise<unknown>
  // No longer called from here — completion now goes through RunOfShow's
  // Finish step, which applies learned ratings before marking the tournament
  // complete. Kept in the prop type so Registration.tsx's call site (owned by
  // a separate workstream) doesn't need touching.
  updateTournament: (id: string, data: Record<string, unknown>) => Promise<unknown>
}

export default function ScoresAndRankingSection({
  tournament,
  players,
  isAdmin,
  claimedId,
  matches: savedMatches,
  registrations: regs,
  updateMatch,
  updateTournament: _updateTournament,
}: ScoresAndRankingSectionProps) {
  const [completedTab, setCompletedTab] = useState<CompletedTabId>('ranking')
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
    const visibleByRound: MatchesByRound = {}
    for (const round of roundNums) {
      const roundMatches = byRound[round] || []
      visibleByRound[round] = roundMatches.filter((m) => isMatchVisibleForPlayer(m, claimedStr))
    }
    return visibleByRound
  }, [isPlayerView, byRound, roundNums, claimedStr])

  if (savedMatches.length === 0 && tournament.status !== 'completed') return null

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
        <TabSwitcher
          tabs={[
            { id: 'ranking', label: '🥇 Final Ranking' },
            { id: 'matches', label: '📋 Matches' },
          ]}
          value={completedTab}
          onChange={(id) => setCompletedTab(id as CompletedTabId)}
        />
      )}

      {(allScored || isCompleted) &&
        rankings.length > 0 &&
        (!isCompleted || completedTab === 'ranking') && (
          <div className="card space-y-3">
            <p className="font-bold text-lob-slate">🥇 Final Rankings</p>

            {rankings.length >= 2 && (
              <div className="flex items-end justify-center gap-2 py-2">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xl">🥈</span>
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-lob-slate">
                    {rankings[1]?.player.name[0]}
                  </div>
                  <p className="text-xs font-semibold text-center truncate w-full">
                    {rankings[1]?.player.name.split(' ')[0]}
                  </p>
                  <div className="bg-gray-200 w-full h-10 rounded-t-xl flex items-center justify-center">
                    <span className="text-xs font-bold text-lob-slate">{rankings[1]?.pts}pts</span>
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
                  <tr className="text-lob-muted-light uppercase border-b border-gray-100">
                    <th className="text-left pb-1.5 pl-1">#</th>
                    <th className="text-left pb-1.5">Player</th>
                    <th className="text-center pb-1.5">W</th>
                    <th className="text-center pb-1.5">L</th>
                    <th className="text-center pb-1.5">+/-</th>
                    <th className="text-center pb-1.5 font-bold text-lob-slate">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((s, i) => (
                    <tr key={s.player.id} className="border-b border-gray-50">
                      <td className="py-1.5 pl-1 text-lob-muted-light font-bold">{i + 1}</td>
                      <td className="py-1.5 font-medium truncate max-w-[110px]">{s.player.name}</td>
                      <td className="text-center py-1.5 text-green-600 font-semibold">{s.won}</td>
                      <td className="text-center py-1.5 text-red-400">{s.lost}</td>
                      <td className="text-center py-1.5 text-lob-muted-light">
                        {s.pf}-{s.pa}
                      </td>
                      <td className="text-center py-1.5 font-bold text-lob-teal">{s.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-lob-muted-light">
              Total game points · Tiebreak: matches won → head-to-head
            </p>
          </div>
        )}

      {(!isCompleted || completedTab === 'matches') && (
        <div>
          <h3 className="font-bold text-lob-slate mb-3">
            {isPlayerView ? '🎾 Your Matches' : '📋 Match Scores'}
          </h3>
          {isPlayerView && !claimedStr && (
            <p className="text-sm text-lob-muted-light mb-3">Sign in to see your own schedule.</p>
          )}
          {roundNums.map((r) => {
            const visibleMatches = visibleMatchesByRound[r] || []
            return (
              <div key={r} className="mb-4">
                <p className="text-xs font-semibold text-lob-muted-light uppercase tracking-wide mb-2">
                  Round {r}
                </p>
                <div className="space-y-2">
                  {visibleMatches.length === 0 && isPlayerView && (
                    <p className="text-sm text-lob-muted-light bg-gray-50 rounded-xl px-3 py-3">
                      You&apos;re sitting out this round — grab a drink, cheer the others on.
                    </p>
                  )}
                  {visibleMatches.map((match) => {
                    const t1 = (match.team1Ids || [])
                      .map((id: string) => getPlayerFirstName(players, id))
                      .join(' & ')
                    const t2 = (match.team2Ids || [])
                      .map((id: string) => getPlayerFirstName(players, id))
                      .join(' & ')
                    return (
                      <div
                        key={match.id}
                        className={`card ${match.completed ? 'border-l-4 border-green-300' : ''}`}
                      >
                        {match.court && (
                          <p className="text-[10px] font-bold text-lob-teal bg-lob-cream px-2 py-0.5 rounded-full inline-block mb-2">
                            {match.court}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-lob-dark truncate">{t1}</p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1">
                            {isAdmin && !isCompleted ? (
                              <ScoreEntry match={match} onUpdate={updateMatch} variant="select" />
                            ) : (
                              <span className="text-base font-bold text-lob-slate px-1">
                                {match.score1 != null
                                  ? `${match.score1} - ${match.score2}`
                                  : '— - —'}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-semibold text-lob-dark truncate">{t2}</p>
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
            <p className="text-sm text-lob-muted-light text-center py-4">No match data available</p>
          )}
        </div>
      )}
    </section>
  )
}
