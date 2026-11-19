import { Plus, X } from 'lucide-react'
import type { Player } from '../../../lib/normalise'
import type { DisplayName } from './utils'
import { Button } from '../../../components/ui/Button'
import { IconButton } from '../../../components/ui/IconButton'
import PlayerPicker from './PlayerPicker'
import LevelField from './LevelField'
import { isLevelGiven, noLevelHint } from './levelHelpers'

interface AddPlayerCardProps {
  isCompleted: boolean
  showAdd: boolean
  onOpen: () => void
  onClose: () => void
  availablePlayers: Player[]
  /** Selected player id, or '' when none is picked. */
  selectedPlayer: string
  onSelectPlayer: (id: string) => void
  /** The picked player has no level: ask for it before registering (S6b). */
  levelNeeded: boolean
  level: string
  onLevelChange: (level: string) => void
  onAdd: () => void
  saving: boolean
  registeredCount: number
  maxPlayers: number
  displayName: DisplayName
}

export default function AddPlayerCard({
  isCompleted,
  showAdd,
  onOpen,
  onClose,
  availablePlayers,
  selectedPlayer,
  onSelectPlayer,
  levelNeeded,
  level,
  onLevelChange,
  onAdd,
  saving,
  registeredCount,
  maxPlayers,
  displayName,
}: AddPlayerCardProps) {
  if (isCompleted) return null
  const picked = availablePlayers.find((p) => p.id === selectedPlayer)
  const levelMissing = levelNeeded && !isLevelGiven({ level })

  if (!showAdd) {
    return (
      <Button onClick={onOpen} fullWidth icon={<Plus />}>
        Register a Player
      </Button>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-lob-slate">Select Player</p>
        <IconButton onClick={onClose} aria-label="Close" variant="ghost">
          <X />
        </IconButton>
      </div>

      <PlayerPicker
        players={availablePlayers}
        selectedId={selectedPlayer}
        onSelect={onSelectPlayer}
        displayName={displayName}
        emptyLabel="All players already registered"
      />

      {picked && levelNeeded && (
        <LevelField
          value={level}
          onChange={onLevelChange}
          hint={noLevelHint({ name: displayName(picked) })}
        />
      )}

      <Button onClick={onAdd} disabled={!selectedPlayer || levelMissing || saving} fullWidth>
        {saving
          ? 'Adding...'
          : registeredCount >= maxPlayers
            ? 'Add to Waitlist'
            : 'Register Player'}
      </Button>
    </div>
  )
}
