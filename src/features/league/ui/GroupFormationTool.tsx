import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import { suggestGroups, recommendGroupConfig } from '../domain/groupBalancer'
import type { Division, LeagueTeam, GroupLabel } from '../domain/types'
import { Badge } from '../../../components/ui/Badge'
import { AlertBox } from '../../../components/ui/AlertBox'
import { SectionHeader } from '../../../components/ui/SectionHeader'
import { useConfirmGroups } from '../hooks/useLeagueMutations'

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
      {rec.warning && <p className="text-xs text-lob-amber">{rec.warning}</p>}
    </div>
  )
}

function teamLabel(t: LeagueTeam) {
  if (t.team_name) return t.team_name
  const p1 = t.player1?.name?.split(' ')[0] ?? '?'
  const p2 = t.player2?.name?.split(' ')[0] ?? '?'
  return `${p1} & ${p2}`
}

function experienceBadgeVariant(level: string): 'info' | 'gold' | 'silver' {
  if (level === 'advanced') return 'info'
  if (level === 'intermediate') return 'gold'
  return 'silver'
}

interface TeamCardProps {
  team: LeagueTeam
  actions: React.ReactNode
}

function TeamCard({ team, actions }: TeamCardProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
      <span className="text-base">{team.spirit_animal ?? '🎾'}</span>
      <span className="text-sm font-semibold text-lob-dark flex-1 min-w-0 truncate">
        {teamLabel(team)}
      </span>
      <Badge
        variant={experienceBadgeVariant(team.experience_level)}
        label={team.experience_level}
      />
      {actions}
    </div>
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
    } as Record<string, unknown>)
    onSuccess()
  }

  const canConfirm = groupA.length >= 2 && groupB.length >= 2 && unassigned.length === 0

  return (
    <div className="space-y-4">
      <RecommendationPanel teams={teams} groupA={groupA} groupB={groupB} />

      <div className="flex gap-2">
        <button type="button" className="btn-secondary text-sm" onClick={handleSuggest}>
          Suggest balanced groups
        </button>
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
        <div>
          <SectionHeader icon={<Users size={15} />} title={`Group A (${groupA.length})`} />
          <div className="space-y-2">
            {groupA.map(
              (id) =>
                teamById[id] && (
                  <TeamCard
                    key={id}
                    team={teamById[id]}
                    actions={
                      <button
                        type="button"
                        onClick={() => removeFromGroup(id)}
                        className="text-gray-400 hover:text-lob-coral text-xs ml-1"
                        aria-label="Remove from group"
                      >
                        ✕
                      </button>
                    }
                  />
                ),
            )}
            {groupA.length === 0 && <p className="text-xs text-gray-400 px-2">No teams assigned</p>}
          </div>
        </div>

        <div>
          <SectionHeader icon={<Users size={15} />} title={`Group B (${groupB.length})`} />
          <div className="space-y-2">
            {groupB.map(
              (id) =>
                teamById[id] && (
                  <TeamCard
                    key={id}
                    team={teamById[id]}
                    actions={
                      <button
                        type="button"
                        onClick={() => removeFromGroup(id)}
                        className="text-gray-400 hover:text-lob-coral text-xs ml-1"
                        aria-label="Remove from group"
                      >
                        ✕
                      </button>
                    }
                  />
                ),
            )}
            {groupB.length === 0 && <p className="text-xs text-gray-400 px-2">No teams assigned</p>}
          </div>
        </div>
      </div>

      {unassigned.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Unassigned</p>
          <div className="space-y-2">
            {unassigned.map((t) => (
              <TeamCard
                key={t.id}
                team={t}
                actions={
                  <div className="flex gap-1 ml-1">
                    <button
                      type="button"
                      onClick={() => moveToA(t.id)}
                      className="text-xs font-semibold text-lob-teal border border-lob-teal/30 rounded px-1.5 py-0.5 hover:bg-lob-teal/5"
                    >
                      → A
                    </button>
                    <button
                      type="button"
                      onClick={() => moveToB(t.id)}
                      className="text-xs font-semibold text-lob-teal border border-lob-teal/30 rounded px-1.5 py-0.5 hover:bg-lob-teal/5"
                    >
                      → B
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      )}

      {confirmGroups.error && (
        <AlertBox variant="error">
          {(confirmGroups.error as Error).message ?? 'Failed to confirm groups.'}
        </AlertBox>
      )}

      <button
        type="button"
        className="btn-primary w-full"
        disabled={!canConfirm || confirmGroups.isPending}
        onClick={handleConfirm}
        title={!canConfirm ? 'Assign all teams (≥2 per group) before confirming' : undefined}
      >
        {confirmGroups.isPending ? 'Generating fixtures…' : 'Confirm Groups & Generate Fixtures'}
      </button>
    </div>
  )
}
