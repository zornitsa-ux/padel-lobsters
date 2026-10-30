import { useState } from 'react'
import type { Player } from '../../../../lib/normalise'
import { fmtEur } from '../../../../lib/format'
import type { PartnerChoice } from '../../teams/teamTypes'
import type { NormalisedTournament } from '../../tournamentQueries'
import type { DisplayName, GetPlayer } from '../utils'
import { COMPLETE_TEAMS_NOTE } from '../../teams/teamStatusMessages'
import { Modal } from '../../../../components/ui/Modal'
import PartnerChoiceForm from './PartnerChoiceForm'
import { choicePartnerName } from './teamHelpers'
import { pricePerEntry } from '../../eventHelpers'
import { useTeamSignup, type TeamSignupResult } from './useTeamSignup'
import { ActionRow } from '../../../../components/ui/ActionRow'
import { Button } from '../../../../components/ui/Button'
import { AlertBox } from '../../../../components/ui/AlertBox'
import { Well } from '../../../../components/ui/Well'

interface TeamJoinCardProps {
  tournament: NormalisedTournament
  viewerId: string
  candidates: Player[]
  isEventFull: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  getPlayer: GetPlayer
  displayName: DisplayName
  onSignedUp: (result: TeamSignupResult) => void
}

export default function TeamJoinCard({
  tournament,
  viewerId,
  candidates,
  isEventFull,
  open,
  onOpenChange,
  getPlayer,
  displayName,
  onSignedUp,
}: TeamJoinCardProps) {
  const [choice, setChoice] = useState<PartnerChoice | null>(null)
  const [lastChoice, setLastChoice] = useState<PartnerChoice | null>(null)
  const signup = useTeamSignup({
    tournamentId: tournament.id,
    captainId: viewerId,
    viewerIsCaptain: true,
    getPlayer,
    onSignedUp,
  })

  const close = () => {
    onOpenChange(false)
    setChoice(null)
    setLastChoice(null)
    signup.clearError()
  }

  const price = pricePerEntry(tournament)
  const submitLabel = signup.busy ? 'Signing up…' : isEventFull ? 'Join the waitlist' : 'Sign up'

  return (
    <>
      <div className="card space-y-3">
        <p className="text-sm text-lob-muted">
          {isEventFull
            ? 'This event is full. Sign up as a team to join the waitlist.'
            : "You haven't signed up yet. Pick a partner to enter as a team."}
        </p>
        <Button onClick={() => onOpenChange(true)} fullWidth>
          Sign up as a team
        </Button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={choice ? 'Confirm your team' : 'Choose your partner'}
        dismissible={!signup.busy}
        footer={
          choice && (
            <ActionRow>
              <Button
                onClick={() => {
                  setLastChoice(choice)
                  setChoice(null)
                  signup.clearError()
                }}
                disabled={signup.busy}
                variant="secondary"
              >
                Back
              </Button>
              <Button onClick={() => void signup.submit({ choice })} disabled={signup.busy}>
                {submitLabel}
              </Button>
            </ActionRow>
          )
        }
      >
        {choice ? (
          <div className="space-y-4">
            <Well>
              <div>
                <p className="font-semibold text-lob-dark">
                  You + {choicePartnerName({ choice, getPlayer })}
                </p>
                <p className="text-sm text-lob-muted">
                  {tournament.name}
                  {price > 0 && ` · ${fmtEur(price)} for the team`}
                </p>
              </div>
            </Well>
            <p className="text-sm text-lob-slate leading-relaxed">{COMPLETE_TEAMS_NOTE}</p>
            {signup.error && (
              <AlertBox variant="error" size="sm">
                {signup.error}
              </AlertBox>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-lob-slate leading-relaxed">{COMPLETE_TEAMS_NOTE}</p>
            <PartnerChoiceForm
              candidates={candidates}
              displayName={displayName}
              submitLabel="Continue"
              initialChoice={lastChoice}
              onSubmit={({ choice: next }) => setChoice(next)}
              onCancel={close}
            />
          </div>
        )}
      </Modal>
    </>
  )
}
