import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Player } from '../../../../lib/normalise'
import type { NormalisedRegistration } from '../../registrationQueries'
import type { NormalisedTournament } from '../../tournamentQueries'
import type { DisplayName, GetPlayer } from '../utils'
import PartnerChoiceForm from './PartnerChoiceForm'
import PlayerPicker from './PlayerPicker'
import TeamNotices from './TeamNotices'
import { eligiblePlayers } from './teamHelpers'
import { useTeamSignup, type TeamSignupResult } from './useTeamSignup'

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

  if (tournament.status === 'completed') return null

  if (!open) {
    return (
      <div className="space-y-2">
        <TeamNotices notices={notices} />
        <button
          onClick={() => {
            setNotices([])
            setOpen(true)
          }}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Add team
        </button>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-lob-slate">
          {captainChosen ? `Partner for ${getPlayer(captainId)?.name ?? ''}` : 'Select captain'}
        </p>
        <button onClick={reset} aria-label="Close">
          <X size={18} className="text-lob-muted-light" />
        </button>
      </div>
      {captainChosen ? (
        <PartnerChoiceForm
          candidates={partners}
          displayName={displayName}
          submitLabel="Add team"
          busy={signup.busy}
          error={signup.error}
          onSubmit={(args) => void signup.submit(args)}
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
          <button
            onClick={() => setCaptainChosen(true)}
            disabled={!captainId}
            className="btn-primary w-full py-2.5 text-sm"
          >
            Next
          </button>
        </>
      )}
    </div>
  )
}
