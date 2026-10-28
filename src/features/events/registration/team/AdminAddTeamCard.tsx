import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Player } from '../../../../lib/normalise'
import { isEventOver } from '../../eventPhase'
import type { NormalisedRegistration } from '../../registrationQueries'
import type { NormalisedTournament } from '../../tournamentQueries'
import type { DisplayName, GetPlayer } from '../utils'
import PartnerChoiceForm from './PartnerChoiceForm'
import PlayerPicker from './PlayerPicker'
import TeamNotices from './TeamNotices'
import { addTeamConfirmLines, eligiblePlayers } from './teamHelpers'
import { useTeamSignup, type TeamSignupResult } from './useTeamSignup'
import { useConfirmOnBehalf } from '../../../../lib/confirmOnBehalf'
import type { PartnerChoice } from '../../teams/teamTypes'
import { Button } from '../../../../components/ui/Button'
import { IconButton } from '../../../../components/ui/IconButton'

interface AdminAddTeamCardProps {
  tournament: NormalisedTournament
  players: Player[]
  regs: NormalisedRegistration[]
  getPlayer: GetPlayer
  displayName: DisplayName
  onSignedUp: (result: TeamSignupResult) => void
}

export default function AdminAddTeamCard({
  tournament,
  players,
  regs,
  getPlayer,
  displayName,
  onSignedUp,
}: AdminAddTeamCardProps) {
  const [open, setOpen] = useState(false)
  const [captainId, setCaptainId] = useState('')
  const [captainChosen, setCaptainChosen] = useState(false)
  const [notices, setNotices] = useState<string[]>([])
  const signup = useTeamSignup({
    tournamentId: tournament.id,
    captainId: captainId || null,
    viewerIsCaptain: false,
    getPlayer,
    onSignedUp: (result) => {
      setNotices(result.notices)
      onSignedUp(result)
      reset()
    },
  })
  const confirmOnBehalf = useConfirmOnBehalf()
  const [confirming, setConfirming] = useState(false)
  const confirmAndSubmit = async ({ choice }: { choice: PartnerChoice }) => {
    const captain = getPlayer(captainId)
    if (!captain || confirming) return
    setConfirming(true)
    const ok = await confirmOnBehalf({
      title: 'Add this team?',
      lines: addTeamConfirmLines({ captain, choice, getPlayer, displayName }),
      confirmLabel: 'Add team',
    })
    if (ok) await signup.submit({ choice })
    setConfirming(false)
  }
  const available = useMemo(() => eligiblePlayers({ players, regs }), [players, regs])
  const partners = useMemo(
    () => available.filter((p) => p.id !== captainId),
    [available, captainId],
  )

  const reset = () => {
    setOpen(false)
    setCaptainId('')
    setCaptainChosen(false)
    signup.clearError()
  }

  if (isEventOver({ tournament })) return null

  if (!open) {
    return (
      <div className="space-y-2">
        <TeamNotices notices={notices} onDismiss={() => setNotices([])} />
        <Button
          onClick={() => {
            setNotices([])
            setOpen(true)
          }}
          fullWidth
          icon={<Plus />}
        >
          Add team
        </Button>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-lob-slate">
          {captainChosen ? `Partner for ${getPlayer(captainId)?.name ?? ''}` : 'Select captain'}
        </p>
        <IconButton onClick={reset} aria-label="Close" variant="ghost">
          <X />
        </IconButton>
      </div>
      {captainChosen ? (
        <PartnerChoiceForm
          candidates={partners}
          displayName={displayName}
          submitLabel="Add team"
          newPartnerLabel="Their partner isn't on Padel Lobsters →"
          busy={signup.busy || confirming}
          error={signup.error}
          onSubmit={(args) => void confirmAndSubmit(args)}
          onCancel={() => {
            setCaptainChosen(false)
            signup.clearError()
          }}
        />
      ) : (
        <>
          <PlayerPicker
            players={available}
            selectedId={captainId}
            onSelect={setCaptainId}
            displayName={displayName}
          />
          <Button onClick={() => setCaptainChosen(true)} disabled={!captainId} fullWidth>
            Next
          </Button>
        </>
      )}
    </div>
  )
}
