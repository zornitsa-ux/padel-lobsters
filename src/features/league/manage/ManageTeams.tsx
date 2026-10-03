import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { Badge } from '../../../components/ui/Badge'
import { SectionHeader } from '../../../components/ui/SectionHeader'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import { useConfirm } from '../../../lib/confirmBus'
import { TeamForm } from '../ui/TeamForm'
import { InvitePlayerModal } from '../ui/InvitePlayerModal'
import { GroupFormationTool } from '../ui/GroupFormationTool'
import { useDeleteTeam } from '../hooks/useLeagueMutations'
import { resolveTeamName } from '../domain/teamDisplay'
import type { PlayerOption } from '../api/leagueQueries'
import type { Division, League, LeagueTeam } from '../domain/types'

type InviteTarget = { id: string; name: string }

const LEVEL_BADGE: Record<string, 'info' | 'gold' | 'silver'> = {
  advanced: 'info',
  intermediate: 'gold',
  beginner: 'silver',
}

function PlayerName({
  player,
  playerId,
  onInvite,
}: {
  player: LeagueTeam['player1']
  playerId: string
  onInvite: (target: InviteTarget) => void
}) {
  return (
    <>
      {player?.name ?? '?'}
      {player?.status === 'placeholder' && (
        <button
          className="ml-1 text-lob-amber underline"
          onClick={() => onInvite({ id: playerId, name: player.name })}
        >
          (invite)
        </button>
      )}
    </>
  )
}

function TeamRow({
  team,
  onEdit,
  onInvite,
}: {
  team: LeagueTeam
  onEdit: (team: LeagueTeam) => void
  onInvite: (target: InviteTarget) => void
}) {
  const confirm = useConfirm()
  const deleteTeam = useDeleteTeam(team.league_id)

  async function handleRemove() {
    const ok = await confirm({ message: `Remove ${resolveTeamName(team)}?`, destructive: true })
    if (ok) deleteTeam.mutate(team.id)
  }

  return (
    <PlayerRow
      className="card"
      name={resolveTeamName(team)}
      subtitle={
        <>
          <PlayerName player={team.player1} playerId={team.player1_id} onInvite={onInvite} /> &amp;{' '}
          <PlayerName player={team.player2} playerId={team.player2_id} onInvite={onInvite} />
        </>
      }
      trailing={
        <>
          <Badge
            variant={LEVEL_BADGE[team.experience_level] ?? 'silver'}
            label={team.experience_level}
          />
          <button
            className="text-xs text-lob-muted hover:text-lob-teal"
            onClick={() => onEdit(team)}
          >
            Edit
          </button>
          <button className="text-xs text-lob-muted hover:text-lob-coral" onClick={handleRemove}>
            Remove
          </button>
        </>
      }
    />
  )
}

interface ManageTeamsProps {
  league: League
  teams: LeagueTeam[]
  division: Division
  allPlayers: PlayerOption[]
}

export function ManageTeams({ league, teams, division, allPlayers }: ManageTeamsProps) {
  // undefined = closed, null = adding, team = editing
  const [formTeam, setFormTeam] = useState<LeagueTeam | null | undefined>(undefined)
  const [invitePlayer, setInvitePlayer] = useState<InviteTarget | null>(null)
  const [showGroupFormation, setShowGroupFormation] = useState(false)

  const divisionTeams = teams.filter((t) => t.division === division)
  const closeForm = () => setFormTeam(undefined)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <SectionHeader icon={<Plus size={15} />} title={`Teams (${divisionTeams.length})`} />
        <button
          className="text-xs font-semibold text-lob-teal flex items-center gap-1"
          onClick={() => setFormTeam(null)}
        >
          <Plus size={13} /> Add Team
        </button>
      </div>

      {divisionTeams.length === 0 ? (
        <p className="text-sm text-lob-muted">No teams in this division yet.</p>
      ) : (
        <div className="space-y-2">
          {divisionTeams.map((t) => (
            <TeamRow key={t.id} team={t} onEdit={setFormTeam} onInvite={setInvitePlayer} />
          ))}
        </div>
      )}

      {league.status === 'draft' && divisionTeams.length >= 4 && (
        <button
          className="btn-secondary text-sm w-full mt-3"
          onClick={() => setShowGroupFormation(true)}
        >
          Assign Groups &amp; Generate Fixtures
        </button>
      )}

      <Modal
        open={formTeam !== undefined}
        onClose={closeForm}
        title={formTeam ? 'Edit Team' : 'Add Team'}
      >
        <TeamForm
          leagueId={league.id}
          division={division}
          players={allPlayers}
          editTeam={formTeam}
          divisionTeams={divisionTeams}
          onSuccess={closeForm}
          onCancel={closeForm}
        />
      </Modal>

      {invitePlayer && (
        <InvitePlayerModal
          open
          onClose={() => setInvitePlayer(null)}
          playerId={invitePlayer.id}
          playerName={invitePlayer.name}
          leagueId={league.id}
        />
      )}

      <Modal
        open={showGroupFormation}
        onClose={() => setShowGroupFormation(false)}
        title="Group Formation"
      >
        <GroupFormationTool
          leagueId={league.id}
          division={division}
          teams={divisionTeams}
          onSuccess={() => setShowGroupFormation(false)}
        />
      </Modal>
    </div>
  )
}
