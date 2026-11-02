import { useMemo, useState } from 'react'

import type { Player } from '../../../lib/normalise'
import { filterByName } from './team/teamHelpers'
import type { DisplayName } from './utils'
import Avatar from '../../../components/ui/Avatar'
import { OptionRow } from '../../../components/ui/OptionRow'
import { EmptyState } from '../../../components/ui/EmptyState'
import { SearchInput } from '../../../components/ui/SearchInput'

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
      <SearchInput
        label="Search players"
        placeholder="Search players…"
        value={search}
        onChange={setSearch}
      />
      <div className="max-h-56 overflow-y-auto space-y-1">
        {visible.length === 0 && (
          <EmptyState
            variant="inline"
            title={players.length === 0 ? emptyLabel : 'No players found'}
          />
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
