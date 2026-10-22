import { useMemo, useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import type { NormalisedRegistration } from '../../registrationQueries'
import { buildTeamEntries } from '../../teams/teamEntries'
import { useEventTeams } from '../../teams/useTeams'
import type { NormalisedTournament } from '../../tournamentQueries'
import type { DisplayName, GetPlayer } from '../utils'
import TeamCard from './TeamCard'
import TeamJoinCard from './TeamJoinCard'
import TeamNotices from './TeamNotices'
import { eligiblePlayers, findMyEntry } from './teamHelpers'
import type { TeamSignupResult } from './useTeamSignup'

interface TeamSignupProps {
  tournament: NormalisedTournament
  viewerId: string
  players: Player[]
  regs: NormalisedRegistration[]
  getPlayer: GetPlayer
  displayName: DisplayName
  onSignedUp: (result: TeamSignupResult) => void
}

/** The signed-in player's own team surface: join, or their team card. */
export default function TeamSignup({
  tournament,
  viewerId,
  players,
  regs,
  getPlayer,
  displayName,
  onSignedUp,
}: TeamSignupProps) {
  const { data: teams = [] } = useEventTeams({ tournamentId: tournament.id })
  const [notices, setNotices] = useState<string[]>([])
  const entry = useMemo(
    () =>
      findMyEntry({
        entries: buildTeamEntries({ teams, registrations: regs }),
        playerId: viewerId,
      }),
    [teams, regs, viewerId],
  )
  const candidates = useMemo(
    () => eligiblePlayers({ players, regs, excludeIds: [viewerId] }),
    [players, regs, viewerId],
  )
  const isEventFull =
    regs.filter((r) => r.status === 'registered').length + 2 > tournament.maxPlayers

  return (
    <>
      <TeamNotices notices={notices} />
      {entry ? (
        <TeamCard
          entry={entry}
          viewerId={viewerId}
          tournamentId={tournament.id}
          candidates={candidates}
          getPlayer={getPlayer}
          displayName={displayName}
        />
      ) : (
        <TeamJoinCard
          tournament={tournament}
          viewerId={viewerId}
          candidates={candidates}
          isEventFull={isEventFull}
          getPlayer={getPlayer}
          displayName={displayName}
          onSignedUp={(result) => {
            setNotices(result.notices)
            onSignedUp(result)
          }}
        />
      )}
    </>
  )
}
