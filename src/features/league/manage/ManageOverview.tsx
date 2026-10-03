import { Check } from 'lucide-react'
import { useConfirm } from '../../../lib/confirmBus'
import { StatTile } from '../../../components/ui/StatTile'
import { useUpdateLeagueStatus } from '../hooks/useLeagueMutations'
import { LEAGUE_PHASES, phaseReadiness } from '../domain/lifecycle'
import { divisionProgress } from '../domain/progress'
import type { StageProgress } from '../domain/progress'
import { DIVISION_LABELS, leagueDivisions } from '../domain/types'
import type { Division, League, LeagueMatch, LeagueStatus, LeagueTeam } from '../domain/types'
import { LEAGUE_STATUS_PILL } from '../ui/statusPill'

function PhaseStepper({ status }: { status: string }) {
  const current = LEAGUE_PHASES.indexOf(status as LeagueStatus)
  return (
    <ol className="flex items-center gap-1" aria-label="Season phase">
      {LEAGUE_PHASES.map((phase, i) => {
        const done = i < current || status === 'completed'
        const active = i === current && status !== 'completed'
        return (
          <li
            key={phase}
            aria-current={active ? 'step' : undefined}
            className={`flex-1 flex items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
              active
                ? 'bg-lob-coral text-white'
                : done
                  ? 'bg-lob-teal-light text-lob-teal'
                  : 'bg-gray-100 text-lob-muted'
            }`}
          >
            {done && <Check size={11} strokeWidth={3} aria-hidden="true" />}
            {LEAGUE_STATUS_PILL[phase].label}
          </li>
        )
      })}
    </ol>
  )
}

function progressLabel({ played, total }: StageProgress): string {
  return total === 0 ? '—' : `${played}/${total}`
}

function DivisionProgressCard({
  teams,
  matches,
  division,
}: {
  teams: LeagueTeam[]
  matches: LeagueMatch[]
  division: Division
}) {
  const progress = divisionProgress({ teams, matches, division })
  return (
    <div className="card space-y-2">
      <p className="text-sm font-semibold text-lob-dark">{DIVISION_LABELS[division]}</p>
      <div className="grid grid-cols-4 gap-2">
        <StatTile value={progress.teams} label="Teams" />
        <StatTile value={progressLabel(progress.group)} label="Group" />
        <StatTile value={progressLabel(progress.semis)} label="Semis" />
        <StatTile value={progressLabel(progress.finals)} label="Finals" />
      </div>
    </div>
  )
}

function StatusAction({
  league,
  teams,
  matches,
}: {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
}) {
  const confirm = useConfirm()
  const updateStatus = useUpdateLeagueStatus()
  const { next, blocker } = phaseReadiness({ league, teams, matches })
  if (!next) return null

  const target = next
  const isCompletion = target === 'completed'
  const nextLabel = LEAGUE_STATUS_PILL[target].label

  async function handleAdvance() {
    const message = isCompletion
      ? `Complete ${league.name}? Champions are final and the season moves to past seasons.`
      : `Advance league to "${nextLabel}"? This cannot be undone.`
    if (!(await confirm({ message }))) return
    updateStatus.mutate({ input_league_id: league.id, input_status: target })
  }

  return (
    <div className="space-y-1">
      <button
        className={`${isCompletion ? 'btn-primary' : 'btn-secondary'} text-sm w-full`}
        disabled={updateStatus.isPending || blocker !== null}
        onClick={handleAdvance}
      >
        {isCompletion ? 'Complete Season' : `Advance → ${nextLabel}`}
      </button>
      {blocker && <p className="text-xs text-lob-muted text-center">{blocker}</p>}
    </div>
  )
}

interface ManageOverviewProps {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
}

export function ManageOverview({ league, teams, matches }: ManageOverviewProps) {
  return (
    <div className="space-y-4">
      <PhaseStepper status={league.status} />
      {leagueDivisions(league).map((division) => (
        <DivisionProgressCard key={division} teams={teams} matches={matches} division={division} />
      ))}
      <StatusAction league={league} teams={teams} matches={matches} />
    </div>
  )
}
