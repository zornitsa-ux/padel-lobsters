import { useMemo } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import type { Player } from '../../../../lib/normalise'
import { useConfirm } from '../../../../lib/confirmBus'
import { useToast } from '../../../../lib/toastBus'
import type { NormalisedRegistration } from '../../registrationQueries'
import { buildTeamEntries } from '../../teams/teamEntries'
import type { TeamEntry } from '../../teams/teamTypes'
import { useEventTeams, usePartnerInvites, useTeamActions } from '../../teams/useTeams'
import type { NormalisedTournament } from '../../tournamentQueries'
import type { DisplayName, GetPlayer } from '../utils'
import TeamRow from './TeamRow'
import { eligiblePlayers, notSignedInHint, partnerNameOf, teamLabel } from './teamHelpers'

interface TeamListsProps {
  tournament: NormalisedTournament
  isAdmin: boolean
  players: Player[]
  regs: NormalisedRegistration[]
  getPlayer: GetPlayer
  displayName: DisplayName
}

export default function TeamLists({
  tournament,
  isAdmin,
  players,
  regs,
  getPlayer,
  displayName,
}: TeamListsProps) {
  const tournamentId = tournament.id
  const confirm = useConfirm()
  const { showToast } = useToast()
  const { adminCancelTeam, adminPromoteTeam } = useTeamActions()
  const { data: teams = [] } = useEventTeams({ tournamentId })
  const { data: invites = [] } = usePartnerInvites({ tournamentId, enabled: isAdmin })

  const entries = useMemo(() => buildTeamEntries({ teams, registrations: regs }), [teams, regs])
  const registered = entries.filter((e) => e.status === 'registered')
  const waitlisted = entries.filter((e) => e.status === 'waitlist')
  const candidates = useMemo(() => eligiblePlayers({ players, regs }), [players, regs])
  const unseen = useMemo(
    () => new Set(invites.filter((i) => i.lastSignInAt === null).map((i) => i.playerId)),
    [invites],
  )

  if (tournament.status === 'completed') return null

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

  return (
    <>
      <section>
        <h3 className="font-bold text-lob-slate mb-2 flex items-center gap-2">
          <CheckCircle size={16} className="text-green-500" />
          Registered ({registered.length * 2}/{tournament.maxPlayers})
        </h3>
        <div className="space-y-2">
          {registered.length === 0 && (
            <p className="text-sm text-lob-muted-light card py-4 text-center">
              No teams registered yet
            </p>
          )}
          {isAdmin
            ? registered.map((e, i) => renderRow(e, `#${i + 1}`))
            : registered.map((e) => <TeamChip key={e.team.id} label={labelOf(e)} />)}
        </div>
      </section>

      {waitlisted.length > 0 && (
        <section>
          <h3 className="font-bold text-lob-slate mb-2 flex items-center gap-2">
            <Clock size={16} className="text-orange-400" />
            Waitlist ({waitlisted.length})
          </h3>
          <div className="space-y-2">
            {isAdmin
              ? waitlisted.map((e, i) => renderRow(e, `W${i + 1}`))
              : waitlisted.map((e) => <TeamChip key={e.team.id} label={labelOf(e)} />)}
          </div>
        </section>
      )}
    </>
  )
}

function TeamChip({ label }: { label: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-lob-dark">
      {label}
    </div>
  )
}
