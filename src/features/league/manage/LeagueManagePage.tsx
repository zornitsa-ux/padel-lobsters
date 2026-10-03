import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { EyeOff } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { PageHeader } from '../../../components/ui/PageHeader'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { Spinner } from '../../../components/ui/Spinner'
import { DivisionPills } from '../ui/DivisionPills'
import { LeagueNotFound } from '../ui/LeagueNotFound'
import { LEAGUE_STATUS_PILL, statusPill } from '../ui/statusPill'
import {
  useAllPlayers,
  useLeagueById,
  useLeagueMatches,
  useLeagueTeams,
} from '../hooks/useLeagueQueries'
import { isPublished } from '../domain/lifecycle'
import { leagueDivisions } from '../domain/types'
import type { Division, League } from '../domain/types'
import { ManageOverview } from './ManageOverview'
import { ManageTeams } from './ManageTeams'
import { ManageMatches } from './ManageMatches'
import { ManageSeason } from './ManageSeason'

type Section = 'overview' | 'teams' | 'matches' | 'season'

const SECTIONS: readonly Section[] = ['overview', 'teams', 'matches', 'season']

const SECTION_LABELS: Record<Section, string> = {
  overview: 'Overview',
  teams: 'Teams',
  matches: 'Matches',
  season: 'Season',
}

const isSection = (value: string | null): value is Section => SECTIONS.includes(value as Section)

function useSection(): [Section, (next: Section) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('section')
  const section: Section = isSection(raw) ? raw : 'overview'

  // replace, not push: switching sections shouldn't stack history entries.
  const setSection = (next: Section) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('section')
    else params.set('section', next)
    setSearchParams(params, { replace: true })
  }
  return [section, setSection]
}

function LeagueManage({ league }: { league: League }) {
  const divisions = leagueDivisions(league)
  const [selectedDivision, setDivision] = useState<Division>(() => divisions[0])
  // A division removed in the Season section must not stay selected.
  const division = divisions.includes(selectedDivision) ? selectedDivision : divisions[0]
  const [section, setSection] = useSection()
  const { data: teams = [] } = useLeagueTeams(league.id)
  const { data: matches = [] } = useLeagueMatches(league.id)
  const { data: allPlayers = [] } = useAllPlayers()

  const pill = statusPill(LEAGUE_STATUS_PILL, league.status)
  const showDivisions = (section === 'teams' || section === 'matches') && divisions.length > 1

  return (
    <div className="-mx-4" data-testid="league-manage">
      <PageHeader
        title={league.name}
        eyebrow="Manage league"
        backLink={{ to: `/league/${league.id}`, label: 'League' }}
        badge={
          <>
            {!isPublished(league) && (
              <Badge
                variant="silver"
                label="Hidden"
                icon={<EyeOff size={11} aria-hidden="true" />}
              />
            )}
            <Badge variant={pill.variant} label={pill.label} />
          </>
        }
        tabStrip={
          showDivisions ? (
            <DivisionPills divisions={divisions} value={division} onChange={setDivision} />
          ) : undefined
        }
      />

      <div className="px-4 pt-4 space-y-4">
        <SegmentedControl
          options={SECTIONS.map((value) => ({ value, label: SECTION_LABELS[value] }))}
          value={section}
          onChange={setSection}
          layout="fill"
          ariaLabel="Manage section"
        />

        {section === 'overview' && (
          <ManageOverview league={league} teams={teams} matches={matches} />
        )}
        {section === 'teams' && (
          <ManageTeams league={league} teams={teams} division={division} allPlayers={allPlayers} />
        )}
        {section === 'matches' && (
          <ManageMatches league={league} teams={teams} matches={matches} division={division} />
        )}
        {section === 'season' && (
          <ManageSeason key={league.id} league={league} teams={teams} matches={matches} />
        )}
      </div>
    </div>
  )
}

export default function LeagueManagePage() {
  const { id } = useParams<{ id: string }>()
  const { data: league, isLoading } = useLeagueById(id)

  if (isLoading) return <Spinner />
  if (!league) return <LeagueNotFound />
  return <LeagueManage league={league} />
}
