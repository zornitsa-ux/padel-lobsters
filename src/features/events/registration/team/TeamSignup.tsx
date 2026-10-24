import { useMemo, useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import type { NormalisedRegistration } from '../../registrationQueries'
import type { NormalisedTournament } from '../../tournamentQueries'
import type { EventTeam, TeamEntry } from '../../teams/teamTypes'
import type { DisplayName, GetPlayer } from '../utils'
import TeamCard from './TeamCard'
import TeamJoinCard from './TeamJoinCard'
import TeamNotices from './TeamNotices'
import EndedTeamNotice from './EndedTeamNotice'
import { eligiblePlayers, endedTeamNotice } from './teamHelpers'
import type { TeamSignupResult } from './useTeamSignup'

interface TeamSignupProps {
  tournament: NormalisedTournament
  viewerId: string
  players: Player[]
  regs: NormalisedRegistration[]
  teams: EventTeam[]
  /** The viewer's active team, if any. */
  entry: TeamEntry | null
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
  teams,
  entry,
  getPlayer,
  displayName,
  onSignedUp,
}: TeamSignupProps) {
  const [signup, setSignup] = useState<{ notices: string[]; status: string } | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)
  const notices =
    signup && (!entry || (entry.status === signup.status && !entry.confirmed)) ? signup.notices : []
  const ended = useMemo(
    () => endedTeamNotice({ teams, regs, viewerId, getPlayer, displayName }),
    [teams, regs, viewerId, getPlayer, displayName],
  )
  const candidates = useMemo(
    () => eligiblePlayers({ players, regs, excludeIds: [viewerId] }),
    [players, regs, viewerId],
  )
  const isEventFull =
    regs.filter((r) => r.status === 'registered').length + 2 > tournament.maxPlayers

  return (
    <>
      <TeamNotices notices={notices} onDismiss={() => setSignup(null)} />
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
        <>
          {ended && !joinOpen && (
            <EndedTeamNotice notice={ended} onSignUpAgain={() => setJoinOpen(true)} />
          )}
          <TeamJoinCard
            open={joinOpen}
            onOpenChange={setJoinOpen}
            tournament={tournament}
            viewerId={viewerId}
            candidates={candidates}
            isEventFull={isEventFull}
            getPlayer={getPlayer}
            displayName={displayName}
            onSignedUp={(result) => {
              setJoinOpen(false)
              setSignup({ notices: result.notices, status: result.status })
              onSignedUp(result)
            }}
          />
        </>
      )}
    </>
  )
}
