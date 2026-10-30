import { EyeOff } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { LinkRow, ListCard } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { useApp } from '../../context/useApp'
import { NewSeasonForm } from './ui/NewSeasonForm'
import { LEAGUE_STATUS_PILL, statusPill } from './ui/statusPill'
import { useAllLeagues, useSeasonChampions } from './hooks/useLeagueQueries'
import { groupSeasons, isPublished } from './domain/lifecycle'
import { resolveTeamShortName } from './domain/teamDisplay'
import { DIVISION_LABELS } from './domain/types'
import type { League, LeagueTeam } from './domain/types'
import { EmptyState } from '../../components/ui/EmptyState'

function championsLine(champions: LeagueTeam[]) {
  if (champions.length === 0) return null
  const names = champions
    .map((t) => `${DIVISION_LABELS[t.division]}: ${resolveTeamShortName(t)}`)
    .join(' · ')
  return `🏆 ${names}`
}

function SeasonRow({ league, champions }: { league: League; champions: LeagueTeam[] }) {
  return (
    <LinkRow
      to={`/league/${league.id}`}
      title={league.name}
      subtitle={championsLine(champions.filter((t) => t.league_id === league.id))}
      trailing={
        <>
          {!isPublished(league) && (
            <Badge tone="neutral" label="Hidden" icon={<EyeOff aria-hidden="true" />} />
          )}
          <Badge {...statusPill(LEAGUE_STATUS_PILL, league.status)} />
        </>
      }
    />
  )
}

function SeasonGroup({
  title,
  leagues,
  champions,
}: {
  title: string
  leagues: League[]
  champions: LeagueTeam[]
}) {
  if (leagues.length === 0) return null
  return (
    <Section title={title}>
      <ListCard>
        {leagues.map((l) => (
          <SeasonRow key={l.id} league={l} champions={champions} />
        ))}
      </ListCard>
    </Section>
  )
}

export function SeasonsList() {
  const { isAdmin } = useApp()
  const { data: leagues = [], isLoading } = useAllLeagues()
  const { data: champions = [] } = useSeasonChampions()
  const { current, upcoming, past } = groupSeasons({ leagues })

  return (
    <div className="-mx-4">
      <PageHeader title="Seasons" eyebrow="🦞 Lobster League" />
      <div className="px-4 pt-4 space-y-5">
        {isAdmin && <NewSeasonForm />}
        {isLoading ? (
          <Spinner />
        ) : leagues.length === 0 ? (
          <EmptyState title="No seasons yet." />
        ) : (
          <>
            <SeasonGroup title="Current" leagues={current ? [current] : []} champions={champions} />
            <SeasonGroup title="Upcoming" leagues={upcoming} champions={champions} />
            <SeasonGroup title="Past" leagues={past} champions={champions} />
          </>
        )}
      </div>
    </div>
  )
}

export default SeasonsList
