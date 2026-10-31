import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/useApp'
import { usePlayers } from '../players/usePlayers'
import { useMatches } from './useMatches'
import { useRegistrations } from './useRegistrations'
import { AlertCircle, Trophy } from 'lucide-react'
import { computeTournamentStandings } from '../../lib/standings'
import { TabSwitcher } from '../../components/ui/TabSwitcher'
import { EmptyState } from '../../components/ui/EmptyState'
import { Section } from '../../components/ui/Section'
import { useTournamentSync } from './useTournamentSync'
import { hasLiveScores, isKingOfTheCourt } from './eventFormat'
import { useOscarResults } from '../oscars/useOscarResults'
import { useRaffleWinners } from '../raffle/useRaffle'
import { groupOscarResultsByCategory } from '../oscars/oscarResults'
import { OscarResultsList } from '../oscars/OscarResultsList'
import { buildRounds } from './buildRounds'
import { resultsWithheld } from './resultsPhase'
import { raffleWinnersWithheld } from './eventPhase'
import ScoresRankingTab from './ScoresRankingTab'
import type { TournamentStandingRow } from './ScoresRankingTab'
import ScoresMatchesTab from './ScoresMatchesTab'
import RaffleWinnersBlock from './RaffleWinnersBlock'
import KingOfCourtResults from './kingOfCourt/KingOfCourtResults'
import type { NormalisedTournament } from './tournamentQueries'
import type { EventNavigate } from './eventHelpers'
import { Button } from '../../components/ui/Button'
import { plural } from '../../lib/plural'

type ScoresTabId = 'ranking' | 'matches' | 'games' | 'raffle'

interface ScoresProps {
  tournament: NormalisedTournament | null | undefined
  onNavigate: EventNavigate
}

export default function Scores({ tournament, onNavigate }: ScoresProps) {
  const { isAdmin } = useApp()
  const { data: players = [] } = usePlayers()
  const { data: allMatches = [] } = useMatches(tournament?.id)
  const { data: regsData = [] } = useRegistrations(tournament?.id)

  // Tab switcher: ranking (podium + standings), matches (round-by-round cards,
  // same layout as Past results), lobster-games (per-category winners from a shared
  // Lobster Oscars session), or raffle (published prize winners). Each of the
  // three results tabs appears only once its own reveal has landed, so the strip
  // grows as the admin works through the run-of-show.
  const [tab, setTab] = useState<ScoresTabId>('ranking')
  const [activeRoundIdx, setActiveRoundIdx] = useState(0)

  // Keep displayed scores current while the event is still running.
  useTournamentSync({
    tournamentId: tournament?.id,
    enabled: tournament != null && hasLiveScores(tournament),
  })

  // `lobster_oscars_get_results` returns nothing until the session's `shared_at`
  // is set, for admins too — the Oscars gate is server-side, so a non-empty
  // result set IS the reveal.
  const { data: oscarRows = [] } = useOscarResults(tournament?.id)
  const hasGameResults = oscarRows.length > 0

  const { data: raffleWinners = [] } = useRaffleWinners(tournament?.id)

  // Admins see drawn-but-unpublished winners (the block labels them as such),
  // which mirrors how they see standings before the reveal.
  const hasRaffleResults =
    tournament != null &&
    raffleWinners.length > 0 &&
    !raffleWinnersWithheld({ tournament, isAdmin })

  // A tab the viewer is sitting on can stop existing — the admin publishes,
  // then unpublishes, or the query settles to an empty set. Move them off it
  // rather than render a blank panel. This resets `tab` itself, not just what
  // gets displayed: leaving the dead value in state meant a later refetch that
  // re-populated the tab would snap the viewer back onto it unprompted.
  useEffect(() => {
    if ((tab === 'games' && !hasGameResults) || (tab === 'raffle' && !hasRaffleResults)) {
      setTab('ranking')
    }
  }, [tab, hasGameResults, hasRaffleResults])

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
        icon={<AlertCircle />}
        title="No event selected"
        action={<Button onClick={() => onNavigate('tournament')}>Go to Events</Button>}
      />
    )
  }

  // D-029: players already saw their own match scores live, so only the final
  // ranking/podium is embargoed until the admin reveals it (Schedule.jsx, post-
  // Finish). Admins always see the real ranking.
  const withheld = resultsWithheld({ tournament, isAdmin })
  // King of the Court records no matches (D-006); its ranking is the teams'.
  const kotc = isKingOfTheCourt(tournament)

  // Guards the frame between the tab disappearing and the effect above
  // committing the reset, so the panel is never blank in between.
  const activeTab: ScoresTabId =
    (tab === 'games' && !hasGameResults) || (tab === 'raffle' && !hasRaffleResults)
      ? 'ranking'
      : tab

  return (
    <div className="space-y-4">
      {/* Tab switcher — Ranking | Matches | Lobster Games | Prize Raffle.
          Games and Raffle appear only once their own reveal has landed. */}
      <TabSwitcher
        tabs={[
          { id: 'ranking', label: '🥇 Final Ranking' },
          ...(kotc ? [] : [{ id: 'matches', label: '📋 Matches' }]),
          ...(hasGameResults ? [{ id: 'games', label: '🦞 Lobster Games' }] : []),
          ...(hasRaffleResults ? [{ id: 'raffle', label: '🎁 Prize Raffle' }] : []),
        ]}
        value={activeTab}
        onChange={(id) => setTab(id as ScoresTabId)}
        className="overflow-x-auto"
      />

      {/* ── RANKING tab ─────────────────────────────────────────────────── */}
      {activeTab === 'ranking' &&
        (kotc ? (
          <KingOfCourtResults tournament={tournament} />
        ) : (
          <ScoresRankingTab standings={standings} matches={matches} withheld={withheld} />
        ))}

      {/* ── MATCHES tab ─────────────────────────────────────────────────── */}
      {activeTab === 'matches' && (
        <ScoresMatchesTab
          rounds={rounds}
          activeRoundIdx={activeRoundIdx}
          onSelectRound={setActiveRoundIdx}
          players={players}
        />
      )}

      {/* ── LOBSTER GAMES tab ───────────────────────────────────────────── */}
      {activeTab === 'games' &&
        (() => {
          if (!oscarRows.length) return null
          const cats = groupOscarResultsByCategory(oscarRows)
          const totalVoters = cats[0]?.totalVoters ?? 0

          return (
            <Section
              title="Lobster Oscars"
              icon={<Trophy />}
              action={
                <span className="text-xs text-lob-muted-light">
                  {plural({ count: cats.length, one: 'category', many: 'categories' })}
                  {totalVoters > 0 && ` · ${plural({ count: totalVoters, one: 'voter' })}`}
                </span>
              }
            >
              <OscarResultsList categories={cats} />
            </Section>
          )
        })()}

      {/* ── PRIZE RAFFLE tab ────────────────────────────────────────────── */}
      {activeTab === 'raffle' && <RaffleWinnersBlock tournament={tournament} isAdmin={isAdmin} />}
    </div>
  )
}
