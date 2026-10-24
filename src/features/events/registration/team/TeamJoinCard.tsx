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
        <button onClick={() => onOpenChange(true)} className="btn-primary w-full py-2.5 text-sm">
          Sign up as a team
        </button>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={choice ? 'Confirm your team' : 'Choose your partner'}
        dismissible={!signup.busy}
        footer={
          choice && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLastChoice(choice)
                  setChoice(null)
                  signup.clearError()
                }}
                disabled={signup.busy}
                className="btn-secondary flex-1 py-3 text-sm"
              >
                Back
              </button>
              <button
                onClick={() => void signup.submit({ choice })}
                disabled={signup.busy}
                className="btn-primary flex-1 py-3 text-sm"
              >
                {submitLabel}
              </button>
            </div>
          )
        }
      >
        {choice ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-lob-well px-4 py-3">
              <p className="font-semibold text-lob-dark">
                You + {choicePartnerName({ choice, getPlayer })}
              </p>
              <p className="text-sm text-lob-muted">
                {tournament.name}
                {price > 0 && ` · ${fmtEur(price)} for the team`}
              </p>
            </div>
            <p className="text-sm text-lob-slate leading-relaxed">{COMPLETE_TEAMS_NOTE}</p>
            {signup.error && (
              <p role="alert" className="text-sm font-semibold text-lob-danger">
                {signup.error}
              </p>
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
