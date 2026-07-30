import { useMemo, useState } from 'react'
import { useApp } from '../../context/useApp'
import { usePlayers } from '../players/usePlayers'
import { useMatches } from './useMatches'
import { useRegistrations } from './useRegistrations'
import { AlertCircle } from 'lucide-react'
import { computeTournamentStandings } from '../../lib/standings'
import { TabSwitcher } from '../../components/ui/TabSwitcher'
import { EmptyState } from '../../components/ui/EmptyState'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { useTournamentSync } from './useTournamentSync'
import { useOscarResults } from '../oscars/useOscarResults'
import { groupOscarResultsByCategory } from '../oscars/oscarResults'
import { buildRounds } from './buildRounds'
import { resultsWithheld } from './resultsPhase'
import ScoresRankingTab from './ScoresRankingTab'
import type { TournamentStandingRow } from './ScoresRankingTab'
import ScoresMatchesTab from './ScoresMatchesTab'
import RaffleWinnersBlock from './RaffleWinnersBlock'
import type { NormalisedTournament } from './tournamentQueries'
import type { EventNavigate } from './eventHelpers'

type ScoresTabId = 'ranking' | 'matches' | 'games'

interface ScoresProps {
  tournament: NormalisedTournament | null | undefined
  onNavigate: EventNavigate
}

export default function Scores({ tournament, onNavigate }: ScoresProps) {
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const { data: players = [] } = usePlayers()
  const { data: allMatches = [] } = useMatches(tournament?.id)
  const { data: regsData = [] } = useRegistrations(tournament?.id)

  // Tab switcher: ranking (podium + standings), matches (round-by-round
  // cards, same layout as History), or lobster-games (per-category winners
  // from a shared Lobster Oscars session).
  const [tab, setTab] = useState<ScoresTabId>('ranking')
  const [activeRoundIdx, setActiveRoundIdx] = useState(0)

  // Keep displayed scores current while the event is still running.
  // Disabled for completed events — scores are frozen.
  useTournamentSync({
    tournamentId: tournament?.id,
    enabled: tournament != null && tournament.status !== 'completed',
  })

  const { data: oscarRows = [] } = useOscarResults(tournament?.id)
  const hasGameResults = oscarRows.length > 0

  const matches = allMatches.filter((m) => m.completed)
  const regs = regsData.filter((r) => r.status === 'registered')
  const registeredPlayers = players.filter((p) => regs.some((r) => r.playerId === p.id))

  // Standings via the shared helper — same source the Lobster Review reads.
  const standings = useMemo((): TournamentStandingRow[] => {
    if (!tournament) return []
    const seededIds = registeredPlayers.map((p) => p.id)
    const raw = computeTournamentStandings(tournament.id, matches, seededIds)
    const byId = new Map(players.map((p) => [String(p.id), p]))
    return raw.flatMap((s) => {
      const player = byId.get(String(s.id))
      return player ? [{ ...s, player }] : []
    })
  }, [matches, registeredPlayers, tournament, players])

  // Group matches by round, then sort within each round by court number
  // (Court 1 first, Court 8 last) to match the order scores were entered.
  const rounds = useMemo(() => buildRounds(allMatches), [allMatches])

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

  // D-029: players already saw their own match scores live, so only the final
  // ranking/podium is embargoed until the admin reveals it (Schedule.jsx, post-
  // Finish). Admins always see the real ranking.
  const withheld = resultsWithheld({ tournament, isAdmin })

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
        onChange={(id) => setTab(id as ScoresTabId)}
        className="overflow-x-auto"
      />

      {/* ── RANKING tab ─────────────────────────────────────────────────── */}
      {tab === 'ranking' && (
        <>
          <ScoresRankingTab standings={standings} matches={matches} withheld={withheld} />
          <RaffleWinnersBlock tournament={tournament} isAdmin={isAdmin} />
        </>
      )}

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
                <p className="font-bold text-lob-slate">🏆 Lobster Oscars</p>
                <p className="text-xs text-lob-muted-light">
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
                  <p className="font-bold text-sm text-lob-slate">
                    <span className="mr-1">{cat.icon}</span>
                    {cat.name}
                  </p>
                  {cat.winners.length > 0 ? (
                    <p className="text-sm text-lob-slate">
                      🏆{' '}
                      <span className="font-bold">
                        {cat.winners.map((w) => w.target_name).join(', ')}
                      </span>{' '}
                      <span className="text-lob-muted-light">
                        ({cat.topVotes} vote{cat.topVotes !== 1 ? 's' : ''}
                        {cat.winners.length > 1 ? ' — tie' : ''})
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-lob-muted-light">No votes</p>
                  )}
                  <div className="space-y-1">
                    {cat.rows.map((r) => (
                      <div key={r.target_id} className="flex items-center gap-2">
                        <span className="text-xs w-16 truncate text-lob-slate">
                          {(r.target_name || '').split(' ')[0]}
                        </span>
                        <ProgressBar
                          value={(Number(r.votes_count) / cat.maxVotes) * 100}
                          size="lg"
                          className="flex-1"
                        />
                        <span className="text-xs text-lob-muted w-3 text-right">
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
