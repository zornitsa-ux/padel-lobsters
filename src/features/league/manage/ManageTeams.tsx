import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
import { Badge } from '../../../components/ui/Badge'
import { experienceTone } from '../ui/statusPill'
import { Section } from '../../../components/ui/Section'
import { ListCard, ListRow } from '../../../components/ui/ListCard'
import { PlayerRow } from '../../../components/ui/PlayerRow'
import { useConfirm } from '../../../lib/confirmBus'
import { TeamForm } from '../ui/TeamForm'
import { InvitePlayerModal } from '../ui/InvitePlayerModal'
import { GroupFormationTool } from '../ui/GroupFormationTool'
import { useDeleteTeam } from '../hooks/useLeagueMutations'
import { resolveTeamName } from '../domain/teamDisplay'
import type { PlayerOption } from '../api/leagueQueries'
import type { Division, League, LeagueTeam } from '../domain/types'
import { Button } from '../../../components/ui/Button'
import { TextButton } from '../../../components/ui/TextButton'
import { EmptyState } from '../../../components/ui/EmptyState'

type InviteTarget = { id: string; name: string }

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
        <>
          {' '}
          <TextButton
            tone="warning"
            size="inherit"
            onClick={() => onInvite({ id: playerId, name: player.name })}
          >
            (invite)
          </TextButton>
        </>
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
    <ListRow>
      <PlayerRow
        name={resolveTeamName(team)}
        subtitle={
          <>
            <PlayerName player={team.player1} playerId={team.player1_id} onInvite={onInvite} />{' '}
            &amp;{' '}
            <PlayerName player={team.player2} playerId={team.player2_id} onInvite={onInvite} />
          </>
        }
        trailing={
          <>
            {team.group_label && <Badge tone="outline" label={`Group ${team.group_label}`} />}
            <Badge tone={experienceTone(team.experience_level)} label={team.experience_level} />
            <TextButton tone="neutral" onClick={() => onEdit(team)}>
              Edit
            </TextButton>
            <TextButton tone="destructive" onClick={handleRemove}>
              Remove
            </TextButton>
          </>
        }
      />
    </ListRow>
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
    <Section
      title={`Teams (${divisionTeams.length})`}
      icon={<Users />}
      action={
        <TextButton icon={<Plus size={13} />} onClick={() => setFormTeam(null)}>
          Add Team
        </TextButton>
      }
    >
      {divisionTeams.length === 0 ? (
        <EmptyState variant="inline" title="No teams in this division yet." />
      ) : (
        <ListCard>
          {divisionTeams.map((t) => (
            <TeamRow key={t.id} team={t} onEdit={setFormTeam} onInvite={setInvitePlayer} />
          ))}
        </ListCard>
      )}

      {league.status === 'draft' && divisionTeams.length >= 4 && (
        <Button variant="secondary" fullWidth onClick={() => setShowGroupFormation(true)}>
          Assign Groups &amp; Generate Fixtures
        </Button>
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
    </Section>
  )
}
