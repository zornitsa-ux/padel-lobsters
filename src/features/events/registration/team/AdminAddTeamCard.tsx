import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Player } from '../../../../lib/normalise'
import { isRosterLocked } from '../../eventPhase'
import type { NormalisedRegistration } from '../../registrationQueries'
import type { NormalisedTournament } from '../../tournamentQueries'
import type { DisplayName, GetPlayer } from '../utils'
import PartnerChoiceForm from './PartnerChoiceForm'
import PlayerPicker from '../PlayerPicker'
import { NoLevelField } from '../LevelField'
import { isLevelGiven, levelConfirmLine } from '../levelHelpers'
import { useSaveLevels, type LevelToSave } from '../useSaveLevels'
import { useAdminLevelCheck } from '../../../levelling/useAdminLevelCheck'
import TeamNotices from './TeamNotices'
import { addTeamConfirmLines, eligiblePlayers, playerNameOf } from './teamHelpers'
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
  const [captainLevel, setCaptainLevel] = useState('')
  const needsLevel = useAdminLevelCheck()
  const saveLevels = useSaveLevels()
  const captain = getPlayer(captainId)
  const captainLevelAsked = needsLevel({ player: captain })
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
  const confirmAndSubmit = async ({
    choice,
    memberLevel,
  }: {
    choice: PartnerChoice
    memberLevel?: string
  }) => {
    if (!captain || confirming) return
    const levels: (LevelToSave & { label: string })[] = [
      ...(captainLevelAsked
        ? [
            {
              playerId: captain.id,
              name: displayName(captain),
              level: captainLevel,
              label: "Captain's level",
            },
          ]
        : []),
      ...(memberLevel !== undefined && choice.kind === 'member'
        ? [
            {
              playerId: choice.playerId,
              name: playerNameOf({ playerId: choice.playerId, getPlayer, displayName }),
              level: memberLevel,
              label: "Partner's level",
            },
          ]
        : []),
    ]
    setConfirming(true)
    const ok = await confirmOnBehalf({
      title: 'Add this team?',
      lines: [
        ...addTeamConfirmLines({ captain, choice, getPlayer, displayName }),
        ...levels.map(levelConfirmLine),
      ],
      confirmLabel: 'Add team',
    })
    if (ok && (await saveLevels({ levels }))) await signup.submit({ choice })
    setConfirming(false)
  }
  const available = useMemo(() => eligiblePlayers({ players, regs }), [players, regs])
  const partners = useMemo(
    () => available.filter((p) => p.id !== captainId),
    [available, captainId],
  )

  const reset = () => {
    setOpen(false)
    pickCaptain('')
    setCaptainChosen(false)
    signup.clearError()
  }
  function pickCaptain(id: string) {
    setCaptainId(id)
    setCaptainLevel('')
  }

  if (isRosterLocked({ tournament })) return null

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
          {captainChosen ? `Partner for ${captain?.name ?? ''}` : 'Select captain'}
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
          memberNeedsLevel={needsLevel}
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
            onSelect={pickCaptain}
            displayName={displayName}
          />
          {captain && captainLevelAsked && (
            <NoLevelField
              name={displayName(captain)}
              value={captainLevel}
              onChange={setCaptainLevel}
            />
          )}
          <Button
            onClick={() => setCaptainChosen(true)}
            disabled={!captainId || (captainLevelAsked && !isLevelGiven({ level: captainLevel }))}
            fullWidth
          >
            Next
          </Button>
        </>
      )}
    </div>
  )
}
