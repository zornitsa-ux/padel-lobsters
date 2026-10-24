import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Player } from '../../../../lib/normalise'
import { filterByName } from './teamHelpers'
import type { DisplayName } from '../utils'

interface PlayerPickerProps {
  players: Player[]
  selectedId: string
  onSelect: (id: string) => void
  displayName: DisplayName
  initialSearch?: string
}

export default function PlayerPicker({
  players,
  selectedId,
  onSelect,
  displayName,
  initialSearch = '',
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
      <div className="max-h-48 overflow-y-auto space-y-1">
        {visible.length === 0 && (
          <p className="text-sm text-lob-muted-light text-center py-3">No players found</p>
        )}
        {visible.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={selectedId === p.id}
            onClick={() => onSelect(selectedId === p.id ? '' : p.id)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
              selectedId === p.id
                ? 'bg-lob-teal text-white'
                : 'bg-gray-50 text-lob-slate hover:bg-gray-100'
            }`}
          >
            <span className="flex-1 text-left font-medium text-sm">{displayName(p)}</span>
            <span className="text-xs font-bold">Lv {(p.playtomicLevel || 0).toFixed(1)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
