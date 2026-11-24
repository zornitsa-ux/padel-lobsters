import { useState, useMemo } from 'react'
import { useApp } from '../../context/useApp'
import { usePlayers } from '../players/usePlayers'
import { AlertBox } from '../../components/ui/AlertBox'
import { Section } from '../../components/ui/Section'
import { Spinner } from '../../components/ui/Spinner'
import { SearchInput } from '../../components/ui/SearchInput'
import PlayersList from './PlayersList'
import {
  buildFirstNameCount,
  getDisplayName,
  orderPlayersForRender,
  sortPlayersChronological,
} from './playersSelectors'
import type { CommunityPlayer } from './playersSelectors'
import { loadFailed } from '../../lib/queryState'

// The roster only needs the public player rows; stats, reviews and admin
// actions load on the player's own page (PlayerDetailPage).
export default function Players() {
  const { session } = useApp()
  const playersQuery = usePlayers()
  const players = playersQuery.data ?? []
  const playersPending = playersQuery.isPending
  const playersFailed = loadFailed(playersQuery)
  const claimedId = session?.user?.id ?? null

  const [search, setSearch] = useState('')

  const activePlayers = players.filter((p) => (p.status || 'active') === 'active')
  const filtered = activePlayers.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
  const sorted = useMemo(() => sortPlayersChronological(filtered), [filtered])
  // Self is pinned to the top when no search is active.
  const orderedForRender = useMemo(
    () => orderPlayersForRender(sorted, search, claimedId),
    [sorted, search, claimedId],
  )
  const firstNameCount = useMemo(() => buildFirstNameCount(activePlayers), [activePlayers])
  const displayName = (p: CommunityPlayer) => getDisplayName(p.name, firstNameCount)

  return (
    <div className="space-y-4">
      <Section title={<>Players ({activePlayers.length})</>}>
        <SearchInput
          label="Search players"
          placeholder="Search players…"
          value={search}
          onChange={setSearch}
        />

        {playersPending ? (
          <Spinner />
        ) : playersFailed ? (
          <AlertBox variant="error">Couldn&apos;t load the players. Reload to try again.</AlertBox>
        ) : (
          <PlayersList
            orderedForRender={orderedForRender}
            displayName={displayName}
            emptyTitle={search ? 'No players match your search.' : undefined}
          />
        )}
      </Section>
    </div>
  )
}
