import { EyeOff } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { LinkCard } from '../../components/ui/LinkCard'
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

function championsLine(champions: LeagueTeam[]) {
  if (champions.length === 0) return null
  const names = champions
    .map((t) => `${DIVISION_LABELS[t.division]}: ${resolveTeamShortName(t)}`)
    .join(' · ')
  return `🏆 ${names}`
}

function SeasonRow({ league, champions }: { league: League; champions: LeagueTeam[] }) {
  return (
    <LinkCard
      to={`/league/${league.id}`}
      title={league.name}
      subtitle={championsLine(champions.filter((t) => t.league_id === league.id))}
      trailing={
        <>
          {!isPublished(league) && (
            <Badge variant="silver" label="Hidden" icon={<EyeOff size={11} aria-hidden="true" />} />
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
    <section>
      <h2 className="text-[10px] font-bold text-lob-muted uppercase tracking-widest px-1 mb-2">
        {title}
      </h2>
      <div className="space-y-2">
        {leagues.map((l) => (
          <SeasonRow key={l.id} league={l} champions={champions} />
        ))}
      </div>
    </section>
  )
}

export function SeasonsList() {
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
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
          <p className="text-sm text-lob-muted text-center py-8">No seasons yet.</p>
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
