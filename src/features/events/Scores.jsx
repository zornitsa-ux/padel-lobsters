import React, { useMemo, useState } from 'react'
import { usePlayers } from '../players/usePlayers'
import { useMatches } from './useMatches'
import { useRegistrations } from './useRegistrations'
import { AlertCircle } from 'lucide-react'
import { computeTournamentStandings } from '../../lib/standings'
import { TabSwitcher } from '../../components/ui/TabSwitcher'
import { useScoreSync } from './useScoreSync'
import { useOscarResults } from '../oscars/useOscarResults'
import { groupOscarResultsByCategory } from '../oscars/oscarResults'
import { buildRounds } from './buildRounds'
import ScoresRankingTab from './ScoresRankingTab'
import ScoresMatchesTab from './ScoresMatchesTab'

export default function Scores({ tournament, onNavigate }) {
  const { data: players = [] } = usePlayers()
  const { data: allMatches = [] } = useMatches(tournament?.id)
  const { data: regsData = [] } = useRegistrations(tournament?.id)

  // Tab switcher: ranking (podium + standings), matches (round-by-round
  // cards, same layout as History), or lobster-games (per-category winners
  // from a shared Lobster Oscars session).
  const [tab, setTab] = useState('ranking')
  const [activeRoundIdx, setActiveRoundIdx] = useState(0)

  // Keep displayed scores current while the event is still running.
  // Disabled for completed events — scores are frozen.
  useScoreSync({
    tournamentId: tournament?.id,
    enabled: tournament != null && tournament.status !== 'completed',
  })

  const { data: oscarRows = [] } = useOscarResults(tournament?.id)
  const hasGameResults = oscarRows.length > 0

  const matches = allMatches.filter((m) => m.completed)
  const regs = regsData.filter((r) => r.status === 'registered')
  const registeredPlayers = players.filter((p) => regs.some((r) => r.playerId === p.id))

  // Standings via the shared helper — same source the Lobster Review reads.
  const standings = useMemo(() => {
    if (!tournament) return []
    const seededIds = registeredPlayers.map((p) => p.id)
    const raw = computeTournamentStandings(tournament.id, matches, seededIds)
    const byId = Object.fromEntries(players.map((p) => [String(p.id), p]))
    return raw.map((s) => ({ ...s, player: byId[String(s.id)] })).filter((s) => s.player)
  }, [matches, registeredPlayers, tournament, players])

  // Group matches by round, then sort within each round by court number
  // (Court 1 first, Court 8 last) to match the order scores were entered.
  const rounds = useMemo(() => buildRounds(allMatches), [allMatches])

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

  return (
    <div className="space-y-4">
      {/* Tab switcher — Ranking | Matches | Lobster Games.
          The Lobster Games tab only shows up if at least one game was
          played + finished for this tournament. */}
      <TabSwitcher
        tabs={[
          { id: 'ranking', label: '🥇 Final Ranking' },
          { id: 'matches', label: '📋 Matches' },
          ...(hasGameResults ? [{ id: 'games', label: '🦞 Lobster Games' }] : []),
        ]}
        value={tab}
        onChange={setTab}
        className="overflow-x-auto"
      />

      {/* ── RANKING tab ─────────────────────────────────────────────────── */}
      {tab === 'ranking' && <ScoresRankingTab standings={standings} matches={matches} />}

      {/* ── MATCHES tab ─────────────────────────────────────────────────── */}
      {tab === 'matches' && (
        <ScoresMatchesTab
          rounds={rounds}
          activeRoundIdx={activeRoundIdx}
          onSelectRound={setActiveRoundIdx}
          players={players}
        />
      )}

      {/* ── LOBSTER GAMES tab ───────────────────────────────────────────── */}
      {tab === 'games' &&
        (() => {
          if (!oscarRows.length) return null
          const cats = groupOscarResultsByCategory(oscarRows)
          const totalVoters = cats[0]?.totalVoters ?? 0

          return (
            <div className="space-y-4">
              <div className="card">
                <p className="font-bold text-gray-700">🏆 Lobster Oscars</p>
                <p className="text-xs text-gray-400">
                  {cats.length} categor{cats.length === 1 ? 'y' : 'ies'}
                  {totalVoters > 0 && (
                    <>
                      {' '}
                      · {totalVoters} voter{totalVoters === 1 ? '' : 's'}
                    </>
                  )}
                </p>
              </div>
              {cats.map((cat) => (
                <div
                  key={cat.id}
                  className="bg-white rounded-2xl p-4 space-y-2 border border-gray-100"
                >
                  <p className="font-bold text-sm text-gray-700">
                    <span className="mr-1">{cat.icon}</span>
                    {cat.name}
                  </p>
                  {cat.winners.length > 0 ? (
                    <p className="text-sm text-gray-600">
                      🏆{' '}
                      <span className="font-bold">
                        {cat.winners.map((w) => w.target_name).join(', ')}
                      </span>{' '}
                      <span className="text-gray-400">
                        ({cat.topVotes} vote{cat.topVotes !== 1 ? 's' : ''}
                        {cat.winners.length > 1 ? ' — tie' : ''})
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">No votes</p>
                  )}
                  <div className="space-y-1">
                    {cat.rows.map((r) => (
                      <div key={r.target_id} className="flex items-center gap-2">
                        <span className="text-xs w-16 truncate text-gray-600">
                          {(r.target_name || '').split(' ')[0]}
                        </span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-lob-teal rounded-full transition-all"
                            style={{ width: `${(Number(r.votes_count) / cat.maxVotes) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-3 text-right">
                          {Number(r.votes_count)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
    </div>
  )
}
