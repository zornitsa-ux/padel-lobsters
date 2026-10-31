import { useState, useEffect } from 'react'
import { Users, X } from 'lucide-react'
import { suggestGroups, recommendGroupConfig } from '../domain/groupBalancer'
import type { Division, GroupLabel, LeagueTeam } from '../domain/types'
import { resolveTeamShortName } from '../domain/teamDisplay'
import { Badge } from '../../../components/ui/Badge'
import { experienceTone } from './statusPill'
import { AlertBox } from '../../../components/ui/AlertBox'
import { Section } from '../../../components/ui/Section'
import { ListCard, ListRow } from '../../../components/ui/ListCard'
import { EmptyState } from '../../../components/ui/EmptyState'
import { useConfirmGroups } from '../hooks/useLeagueMutations'
import { Button } from '../../../components/ui/Button'
import { IconButton } from '../../../components/ui/IconButton'

interface GroupFormationToolProps {
  leagueId: string
  division: Division
  teams: LeagueTeam[]
  onSuccess: () => void
}

// ── Recommendation panel ──────────────────────────────────────────────────────

const SILVER_LABEL: Record<string, string> = {
  semis: '2 semi-finals',
  semis_with_byes: '2 semi-finals (byes for missing rank-4)',
  none: 'Not applicable',
}

interface RecommendationPanelProps {
  teams: LeagueTeam[]
  groupA: string[]
  groupB: string[]
}

function RecommendationPanel({ teams, groupA, groupB }: RecommendationPanelProps) {
  const rec = recommendGroupConfig(teams.length)
  const currentA = groupA.length
  const currentB = groupB.length
  const matchesRec = currentA === rec.sizeA && currentB === rec.sizeB

  return (
    <div className="rounded-xl bg-lob-teal/5 border border-lob-teal/20 p-3 space-y-2">
      <p className="text-xs font-bold text-lob-teal uppercase tracking-wide">
        Bracket recommendation
      </p>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-sm text-lob-dark">
          With <span className="font-bold">{teams.length}</span> teams: suggested{' '}
          <span className="font-bold">
            {rec.sizeA}+{rec.sizeB}
          </span>{' '}
          groups
        </span>
        {!matchesRec && currentA + currentB > 0 && (
          <span className="text-xs text-lob-muted">
            (current {currentA}+{currentB})
          </span>
        )}
        {matchesRec && currentA + currentB > 0 && (
          <span className="text-xs text-lob-teal font-semibold">✓ matches recommendation</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <span className="text-lob-muted">Gold bracket</span>
          <p className="font-semibold text-lob-dark">2 semi-finals</p>
        </div>
        <div>
          <span className="text-lob-muted">Silver bracket</span>
          <p className="font-semibold text-lob-dark">{SILVER_LABEL[rec.silverBracket]}</p>
        </div>
      </div>
      {rec.warning && <p className="text-xs text-lob-warning">{rec.warning}</p>}
    </div>
  )
}

interface TeamRowProps {
  team: LeagueTeam
  actions: React.ReactNode
}

function TeamRow({ team, actions }: TeamRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold text-lob-dark flex-1 min-w-0 truncate">
        {resolveTeamShortName(team)}
      </span>
      <Badge tone={experienceTone(team.experience_level)} label={team.experience_level} />
      {actions}
    </div>
  )
}

function GroupColumn({
  label,
  ids,
  teamById,
  onRemove,
}: {
  label: GroupLabel
  ids: string[]
  teamById: Record<string, LeagueTeam>
  onRemove: (id: string) => void
}) {
  const teams = ids.flatMap((id) => teamById[id] ?? [])
  return (
    <Section title={`Group ${label} (${ids.length})`} icon={<Users />}>
      <ListCard inset>
        {teams.map((team) => (
          <ListRow key={team.id}>
            <TeamRow
              team={team}
              actions={
                <IconButton
                  onClick={() => onRemove(team.id)}
                  aria-label="Remove from group"
                  variant="ghost-destructive"
                  size="sm"
                >
                  <X />
                </IconButton>
              }
            />
          </ListRow>
        ))}
      </ListCard>
      {ids.length === 0 && <EmptyState variant="inline" title="No teams assigned" />}
    </Section>
  )
}

export function GroupFormationTool({
  leagueId,
  division,
  teams,
  onSuccess,
}: GroupFormationToolProps) {
  const [groupA, setGroupA] = useState<string[]>([])
  const [groupB, setGroupB] = useState<string[]>([])
  const [suggested, setSuggested] = useState(false)
  const confirmGroups = useConfirmGroups(leagueId)

  useEffect(() => {
    const preA = teams.filter((t) => t.group_label === 'A').map((t) => t.id)
    const preB = teams.filter((t) => t.group_label === 'B').map((t) => t.id)
    if (preA.length > 0 || preB.length > 0) {
      setGroupA(preA)
      setGroupB(preB)
    }
  }, [teams])

  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]))
  const unassigned = teams.filter((t) => !groupA.includes(t.id) && !groupB.includes(t.id))

  function moveToA(id: string) {
    setGroupB((b) => b.filter((x) => x !== id))
    setGroupA((a) => (a.includes(id) ? a : [...a, id]))
  }
  function moveToB(id: string) {
    setGroupA((a) => a.filter((x) => x !== id))
    setGroupB((b) => (b.includes(id) ? b : [...b, id]))
  }
  function removeFromGroup(id: string) {
    setGroupA((a) => a.filter((x) => x !== id))
    setGroupB((b) => b.filter((x) => x !== id))
  }

  function handleSuggest() {
    const { A, B } = suggestGroups(teams)
    setGroupA(A.map((t) => t.id))
    setGroupB(B.map((t) => t.id))
    setSuggested(true)
  }

  async function handleConfirm() {
    await confirmGroups.mutateAsync({
      league_id: leagueId,
      group_assignments: { [division]: { A: groupA, B: groupB } },
    })
    onSuccess()
  }

  const canConfirm = groupA.length >= 2 && groupB.length >= 2 && unassigned.length === 0

  return (
    <div className="space-y-4">
      <RecommendationPanel teams={teams} groupA={groupA} groupB={groupB} />

      <div className="flex gap-2">
        <Button variant="secondary" onClick={handleSuggest}>
          Suggest balanced groups
        </Button>
      </div>

      {suggested && (
        <AlertBox variant="info">Groups suggested — review and adjust before confirming.</AlertBox>
      )}

      {unassigned.length > 0 && groupA.length >= 2 && groupB.length >= 2 && (
        <AlertBox variant="warning">
          {unassigned.length} team{unassigned.length !== 1 ? 's' : ''} unassigned — assign all teams
          before confirming.
        </AlertBox>
      )}

      <div className="grid grid-cols-2 gap-3">
        {(['A', 'B'] as const).map((label) => (
          <GroupColumn
            key={label}
            label={label}
            ids={label === 'A' ? groupA : groupB}
            teamById={teamById}
            onRemove={removeFromGroup}
          />
        ))}
      </div>

      {unassigned.length > 0 && (
        <div>
          <p className="text-xs font-bold text-lob-muted uppercase tracking-wide mb-2">
            Unassigned
          </p>
          <ListCard inset>
            {unassigned.map((t) => (
              <ListRow key={t.id}>
                <TeamRow
                  team={t}
                  actions={
                    <div className="flex gap-1 ml-1">
                      <Button variant="neutral" size="sm" onClick={() => moveToA(t.id)}>
                        → A
                      </Button>
                      <Button variant="neutral" size="sm" onClick={() => moveToB(t.id)}>
                        → B
                      </Button>
                    </div>
                  }
                />
              </ListRow>
            ))}
          </ListCard>
        </div>
      )}

      {confirmGroups.error && (
        <AlertBox variant="error">
          {(confirmGroups.error as Error).message ?? 'Failed to confirm groups.'}
        </AlertBox>
      )}

      <Button
        fullWidth
        disabled={!canConfirm || confirmGroups.isPending}
        onClick={handleConfirm}
        title={!canConfirm ? 'Assign all teams (≥2 per group) before confirming' : undefined}
      >
        {confirmGroups.isPending ? 'Generating fixtures…' : 'Confirm Groups & Generate Fixtures'}
      </Button>
    </div>
  )
}
