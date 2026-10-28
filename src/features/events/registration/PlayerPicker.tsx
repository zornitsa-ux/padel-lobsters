import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Player } from '../../../lib/normalise'
import { filterByName } from './team/teamHelpers'
import type { DisplayName } from './utils'
import Avatar from '../../../components/ui/Avatar'
import { OptionRow } from '../../../components/ui/OptionRow'

interface PlayerPickerProps {
  players: Player[]
  selectedId: string
  onSelect: (id: string) => void
  displayName: DisplayName
  initialSearch?: string
  /** Shown when there is nobody to pick at all, before any search. */
  emptyLabel?: string
}

export default function PlayerPicker({
  players,
  selectedId,
  onSelect,
  displayName,
  initialSearch = '',
  emptyLabel = 'No players found',
}: PlayerPickerProps) {
  const [search, setSearch] = useState(initialSearch)
  const visible = useMemo(() => filterByName({ players, search }), [players, search])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-lob-muted-light"
        />
        <input
          className="input pl-9 py-2 text-sm"
          placeholder="Search..."
          aria-label="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="max-h-56 overflow-y-auto space-y-1">
        {visible.length === 0 && (
          <p className="text-sm text-lob-muted-light text-center py-3">
            {players.length === 0 ? emptyLabel : 'No players found'}
          </p>
        )}
        {visible.map((p) => (
          <OptionRow
            key={p.id}
            selected={selectedId === p.id}
            onClick={() => onSelect(selectedId === p.id ? '' : p.id)}
            leading={<Avatar player={p} size="sm" />}
            title={displayName(p)}
            trailing={`Lv ${(p.playtomicLevel || 0).toFixed(1)}`}
          />
        ))}
      </div>
    </div>
  )
}
