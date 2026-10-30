import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { AlertBox } from '../../../components/ui/AlertBox'
import { Section } from '../../../components/ui/Section'
import { useConfirm } from '../../../lib/confirmBus'
import { ScoreEntryForm } from '../ui/ScoreEntryForm'
import { LeagueMatchRow } from '../ui/LeagueMatchRow'
import { ListCard } from '../../../components/ui/ListCard'
import { useCreateBracket } from '../hooks/useLeagueMutations'
import { buildDivisionBracket, buildFinalPairings } from '../domain/bracket'
import { sortMatchesDesc, stageToLabel } from '../domain/matchDisplay'
import type { Division, League, LeagueMatch, LeagueTeam } from '../domain/types'
import { Button } from '../../../components/ui/Button'
import { TextButton } from '../../../components/ui/TextButton'

function BracketPanel({
  league,
  teams,
  matches,
  division,
}: {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
  division: Division
}) {
  const confirm = useConfirm()
  const createBracket = useCreateBracket(league.id)
  const groupMatches = matches.filter((m) => m.division === division && m.stage === 'group')
  const pendingCount = groupMatches.filter((m) => m.winner_id === null).length
  const allDone = pendingCount === 0

  async function handleGenerate() {
    const message = allDone
      ? 'Generate knockout bracket?'
      : 'Generate bracket with pending matches still outstanding?'
    if (!(await confirm({ message }))) return
    const pairings = buildDivisionBracket({ teams, matches, division })
    if (!pairings) {
      alert('Each group needs at least 2 teams to generate a bracket.')
      return
    }
    createBracket.mutate({ matches: pairings })
  }

  return (
    <div className="space-y-2">
      {allDone ? (
        <AlertBox variant="success">
          All group matches reported. Ready to generate the knockout bracket.
        </AlertBox>
      ) : (
        <AlertBox variant="warning">
          {pendingCount} group match{pendingCount !== 1 ? 'es' : ''} still pending.
        </AlertBox>
      )}
      <Button
        variant={allDone ? 'primary' : 'secondary'}
        disabled={createBracket.isPending}
        onClick={handleGenerate}
      >
        {createBracket.isPending
          ? 'Generating…'
          : allDone
            ? 'Generate Bracket'
            : 'Generate Bracket (Override)'}
      </Button>
      {createBracket.error && (
        <AlertBox variant="error">
          {(createBracket.error as Error).message ?? 'Failed to generate bracket.'}
        </AlertBox>
      )}
    </div>
  )
}

function FinalsPanel({
  leagueId,
  divMatches,
  division,
}: {
  leagueId: string
  divMatches: LeagueMatch[]
  division: Division
}) {
  const confirm = useConfirm()
  const createBracket = useCreateBracket(leagueId)
  const pairings = buildFinalPairings({ divMatches, division })
  if (pairings.length === 0) return null

  const tiers = pairings.map((p) => (p.stage === 'gold_final' ? 'gold' : 'silver')).join(' and ')

  async function handleGenerate() {
    if (!(await confirm({ message: 'Create the finals from the semi-final winners?' }))) return
    createBracket.mutate({ matches: pairings })
  }

  return (
    <div className="space-y-2">
      <AlertBox variant="success">
        Semi-finals decided. Ready to create the {tiers} final{pairings.length > 1 ? 's' : ''}.
      </AlertBox>
      <Button disabled={createBracket.isPending} onClick={handleGenerate}>
        {createBracket.isPending ? 'Generating…' : 'Generate Finals'}
      </Button>
      {createBracket.error && (
        <AlertBox variant="error">
          {(createBracket.error as Error).message ?? 'Failed to generate finals.'}
        </AlertBox>
      )}
    </div>
  )
}

interface MatchAction {
  label: string
  onAction: (match: LeagueMatch) => void
}

function MatchList({
  title,
  matches,
  teamById,
  action,
}: {
  title: string
  matches: LeagueMatch[]
  teamById: Record<string, LeagueTeam>
  action?: MatchAction
}) {
  if (matches.length === 0) return null
  return (
    <Section title={`${title} (${matches.length})`} icon={<Trophy />}>
      <ListCard>
        {matches.map((m) => (
          <LeagueMatchRow
            key={m.id}
            match={m}
            team1={teamById[m.team1_id ?? '']}
            team2={teamById[m.team2_id ?? '']}
            label={stageToLabel(m.stage, teamById[m.team1_id ?? '']?.group_label)}
            action={
              action && <TextButton onClick={() => action.onAction(m)}>{action.label}</TextButton>
            }
          />
        ))}
      </ListCard>
    </Section>
  )
}

function DraftFixtures({
  matches,
  teamById,
}: {
  matches: LeagueMatch[]
  teamById: Record<string, LeagueTeam>
}) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-lob-muted">
        Fixtures are created when you assign groups in the Teams section.
      </p>
    )
  }
  return (
    <div className="space-y-5">
      <AlertBox variant="info">
        Scores can be entered once the season advances to Group Stage.
      </AlertBox>
      <MatchList title="Fixtures" matches={matches} teamById={teamById} />
    </div>
  )
}

interface ManageMatchesProps {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
  division: Division
}

export function ManageMatches({ league, teams, matches, division }: ManageMatchesProps) {
  const [scoreMatch, setScoreMatch] = useState<LeagueMatch | null>(null)

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))
  const divMatches = matches.filter((m) => m.division === division)
  const pending = divMatches.filter((m) => m.winner_id === null)
  const completed = divMatches.filter((m) => m.winner_id !== null).sort(sortMatchesDesc)
  const hasGroupMatches = divMatches.some((m) => m.stage === 'group')
  const hasBracket = divMatches.some((m) => m.stage === 'gold_semi' || m.stage === 'silver_semi')

  if (league.status === 'draft') {
    return <DraftFixtures matches={divMatches} teamById={teamById} />
  }

  return (
    <div className="space-y-5">
      <MatchList
        title="Pending Matches"
        matches={pending}
        teamById={teamById}
        action={{ label: 'Enter Score', onAction: setScoreMatch }}
      />

      {league.status === 'group_stage' && hasGroupMatches && !hasBracket && (
        <BracketPanel league={league} teams={teams} matches={matches} division={division} />
      )}

      {league.status === 'group_stage' && hasBracket && (
        <AlertBox variant="info">Knockout bracket generated.</AlertBox>
      )}

      {league.status === 'knockout' && (
        <FinalsPanel leagueId={league.id} divMatches={divMatches} division={division} />
      )}

      <MatchList
        title="Results"
        matches={completed}
        teamById={teamById}
        action={{ label: 'Edit', onAction: setScoreMatch }}
      />

      <Modal
        open={!!scoreMatch}
        onClose={() => setScoreMatch(null)}
        title={scoreMatch?.winner_id ? 'Edit Score' : 'Enter Score'}
      >
        {scoreMatch && (
          <ScoreEntryForm
            match={scoreMatch}
            team1={teamById[scoreMatch.team1_id ?? '']}
            team2={teamById[scoreMatch.team2_id ?? '']}
            leagueId={league.id}
            onSuccess={() => setScoreMatch(null)}
            onCancel={() => setScoreMatch(null)}
          />
        )}
      </Modal>
    </div>
  )
}
