import { useState } from 'react'
import { Trophy, CheckCircle, Archive } from 'lucide-react'
import { Section } from '../../../components/ui/Section'
import { TextButton } from '../../../components/ui/TextButton'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { GroupStandings } from './GroupStandings'
import { ListCard } from '../../../components/ui/ListCard'
import { LeagueMatchRow } from './LeagueMatchRow'
import { KnockoutBracket } from './KnockoutBracket'
import { ChampionBanner } from './ChampionBanner'
import { divisionChampions } from '../domain/champions'
import { sortMatchesDesc } from '../domain/matchDisplay'
import type { LeagueTeam, LeagueMatch } from '../domain/types'

type Bracket = 'gold' | 'silver'

const BRACKETS: { value: Bracket; label: string }[] = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
]

interface KnockoutContentProps {
  leagueId: string
  divTeams: LeagueTeam[]
  divMatches: LeagueMatch[]
  myTeam: LeagueTeam | null
  teamById: Record<string, LeagueTeam>
  onTeamClick: (t: LeagueTeam) => void
}

export function KnockoutContent({
  leagueId,
  divTeams,
  divMatches,
  myTeam,
  teamById,
  onTeamClick,
}: KnockoutContentProps) {
  const [bracketTab, setBracketTab] = useState<Bracket>('gold')

  const goldSemis = divMatches.filter((m) => m.stage === 'gold_semi')
  const goldFinal = divMatches.find((m) => m.stage === 'gold_final')
  const silverSemis = divMatches.filter((m) => m.stage === 'silver_semi')
  const silverFinal = divMatches.find((m) => m.stage === 'silver_final')
  const hasKnockout = goldSemis.length > 0 || silverSemis.length > 0

  const knockoutResults = divMatches
    .filter((m) => m.stage !== 'group' && m.winner_id !== null && m.team2_id !== null)
    .sort(sortMatchesDesc)

  const bracketToggle = (
    <SegmentedControl
      ariaLabel="Bracket"
      layout="wrap"
      options={BRACKETS}
      value={bracketTab}
      onChange={setBracketTab}
    />
  )

  return (
    <>
      <ChampionBanner
        champions={divisionChampions({ divMatches })}
        teamById={teamById}
        onTeamClick={onTeamClick}
      />

      <Section title="Bracket" icon={<Trophy />} action={bracketToggle}>
        <div className="card">
          {hasKnockout ? (
            <KnockoutBracket
              semi1={bracketTab === 'gold' ? goldSemis[0] : silverSemis[0]}
              semi2={bracketTab === 'gold' ? goldSemis[1] : silverSemis[1]}
              final={bracketTab === 'gold' ? goldFinal : silverFinal}
              teamById={teamById}
              onTeamClick={onTeamClick}
            />
          ) : (
            <p className="text-sm text-lob-muted text-center py-6">Bracket not yet generated.</p>
          )}
        </div>
      </Section>

      {knockoutResults.length > 0 && (
        <Section title="Results" icon={<CheckCircle />}>
          <ListCard>
            {knockoutResults.map((m) => (
              <LeagueMatchRow
                key={m.id}
                match={m}
                team1={teamById[m.team1_id ?? '']}
                team2={teamById[m.team2_id ?? '']}
                onTeamClick={onTeamClick}
              />
            ))}
          </ListCard>
        </Section>
      )}

      <GroupStandings
        title="Group Stage"
        icon={<Archive />}
        action={<TextButton to={`/league/${leagueId}/group-stage`}>View →</TextButton>}
        divTeams={divTeams}
        divMatches={divMatches}
        myTeamId={myTeam?.id ?? null}
        onTeamClick={onTeamClick}
      />
    </>
  )
}
