import { useMemo } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import type { Player } from '../../../../lib/normalise'
import { isEventOver } from '../../eventPhase'
import { useConfirm } from '../../../../lib/confirmBus'
import { useToast } from '../../../../lib/toastBus'
import type { NormalisedRegistration } from '../../registrationQueries'
import type { TeamEntry } from '../../teams/teamTypes'
import { usePartnerInvites, useTeamActions } from '../../teams/useTeams'
import type { NormalisedTournament } from '../../tournamentQueries'
import type { DisplayName, GetPlayer } from '../utils'
import TeamRow from './TeamRow'
import {
  eligiblePlayers,
  notSignedInHint,
  partnerNameOf,
  teamCount,
  teamLabel,
} from './teamHelpers'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { ListCard } from '../../../../components/ui/ListCard'
import { Section } from '../../../../components/ui/Section'

interface TeamListsProps {
  tournament: NormalisedTournament
  isAdmin: boolean
  players: Player[]
  regs: NormalisedRegistration[]
  entries: TeamEntry[]
  getPlayer: GetPlayer
  displayName: DisplayName
}

export default function TeamLists({
  tournament,
  isAdmin,
  players,
  regs,
  entries,
  getPlayer,
  displayName,
}: TeamListsProps) {
  const tournamentId = tournament.id
  const confirm = useConfirm()
  const { showToast } = useToast()
  const { adminCancelTeam, adminPromoteTeam } = useTeamActions()
  const { data: invites = [] } = usePartnerInvites({ tournamentId, enabled: isAdmin })

  const registered = entries.filter((e) => e.status === 'registered')
  const waitlisted = entries.filter((e) => e.status === 'waitlist')
  const candidates = useMemo(() => eligiblePlayers({ players, regs }), [players, regs])
  const unseen = useMemo(
    () => new Set(invites.filter((i) => i.lastSignInAt === null).map((i) => i.playerId)),
    [invites],
  )

  if (isEventOver({ tournament })) return null

  const labelOf = (entry: TeamEntry) => teamLabel({ entry, getPlayer, displayName })

  const cancel = async (entry: TeamEntry) => {
    const ok = await confirm({ message: `Cancel ${labelOf(entry)}?`, destructive: true })
    if (!ok) return
    const { status, promotedTeamId } = await adminCancelTeam({
      tournamentId,
      teamId: entry.team.id,
    })
    const promoted = entries.find((e) => e.team.id === promotedTeamId)
    if (status === 'cancelled' && promoted) {
      showToast({ variant: 'success', message: `${labelOf(promoted)} moved off the waitlist.` })
    }
  }

  const renderRow = (entry: TeamEntry, position: string) => (
    <TeamRow
      key={entry.team.id}
      entry={entry}
      label={labelOf(entry)}
      partnerName={partnerNameOf({ entry, getPlayer, displayName })}
      position={position}
      tournamentId={tournamentId}
      candidates={candidates}
      displayName={displayName}
      notSignedInHint={notSignedInHint({
        captainUnseen: unseen.has(entry.captain.playerId),
        partnerUnseen: unseen.has(entry.partner.playerId),
      })}
      onCancel={() => void cancel(entry)}
      onConfirm={
        entry.status === 'waitlist'
          ? () => void adminPromoteTeam({ tournamentId, teamId: entry.team.id })
          : undefined
      }
    />
  )

  const renderList = ({ list, prefix }: { list: TeamEntry[]; prefix: string }) =>
    isAdmin ? (
      list.length > 0 && (
        <ListCard>{list.map((e, i) => renderRow(e, `${prefix}${i + 1}`))}</ListCard>
      )
    ) : (
      <div className="space-y-2">
        {list.map((e) => (
          <TeamChip key={e.team.id} label={labelOf(e)} />
        ))}
      </div>
    )

  return (
    <>
      <Section
        icon={<CheckCircle className="text-lob-success-solid" />}
        title={`Registered (${registered.length}/${teamCount({ players: tournament.maxPlayers })} teams)`}
      >
        {registered.length === 0 && <EmptyState variant="inline" title="No teams registered yet" />}
        {renderList({ list: registered, prefix: '#' })}
      </Section>

      {waitlisted.length > 0 && (
        <Section
          icon={<Clock className="text-lob-warning-solid" />}
          title={`Waitlist (${waitlisted.length})`}
        >
          {renderList({ list: waitlisted, prefix: 'W' })}
        </Section>
      )}
    </>
  )
}

function TeamChip({ label }: { label: string }) {
  return (
    <div className="bg-white border border-lob-line-strong rounded-xl px-3 py-1.5 text-xs font-semibold text-lob-dark">
      {label}
    </div>
  )
}
