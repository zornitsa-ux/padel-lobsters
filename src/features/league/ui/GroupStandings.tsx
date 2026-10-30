import type { ReactNode } from 'react'
import { Section } from '../../../components/ui/Section'
import { GroupStandingsTable } from './GroupStandingsTable'
import { computeGroupStandings } from '../domain/standings'
import type { GroupLabel, LeagueMatch, LeagueTeam } from '../domain/types'

const GROUP_LABELS: GroupLabel[] = ['A', 'B']

interface GroupStandingsProps {
  title: string
  icon: ReactNode
  action?: ReactNode
  divTeams: LeagueTeam[]
  divMatches: LeagueMatch[]
  myTeamId: string | null
  onTeamClick: (team: LeagueTeam) => void
}

/** The division's group tables in one card under a `Section` heading; nothing before groups exist. */
export function GroupStandings({
  title,
  icon,
  action,
  divTeams,
  divMatches,
  myTeamId,
  onTeamClick,
}: GroupStandingsProps) {
  const groups = GROUP_LABELS.map((label) => ({
    label,
    standings: computeGroupStandings(
      divTeams.filter((t) => t.group_label === label),
      divMatches,
    ),
  })).filter((group) => group.standings.length > 0)

  if (groups.length === 0) return null
  return (
    <Section title={title} icon={icon} action={action}>
      <div className="card space-y-4">
        {groups.map(({ label, standings }) => (
          <div key={label} className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-lob-muted">Group {label}</p>
            <GroupStandingsTable
              standings={standings}
              myTeamId={myTeamId}
              onTeamClick={onTeamClick}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}
