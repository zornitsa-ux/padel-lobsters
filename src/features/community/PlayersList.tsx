import React from 'react'
import { ChevronDown, ChevronUp, User, RotateCcw } from 'lucide-react'
import { FlagImg } from '../../components/ui/CountryPicker'
import { PlayerRow } from '../../components/ui/PlayerRow'
import { EmptyState } from '../../components/ui/EmptyState'
import { corpReview, type ReviewRegistration, type ReviewTournament } from './reviewScenarios'
import PlayerProfileDrawer from './PlayerProfileDrawer'
import type { CommunityPlayer, OrderedPlayer } from './playersSelectors'
import type { DbMatchForStats } from '../../lib/playerStats'

interface PlayersListProps {
  orderedForRender: OrderedPlayer<CommunityPlayer>[]
  hasPlayers: boolean
  focusPlayerId?: string | number | null
  focusRef?: React.RefObject<HTMLDivElement> | null
  expandedId: string | number | null
  setExpandedId: (id: string | number | null) => void
  isAdmin: boolean
  levelBadge: (level: number) => string
  displayName: (player: CommunityPlayer) => string
  matches: DbMatchForStats[]
  registrations: ReviewRegistration[]
  tournaments: ReviewTournament[]
  playerAliases: Record<string, string>
  players: CommunityPlayer[]
  onNavigate?: (page: string, payload?: unknown) => void
  onEdit: (player: CommunityPlayer) => void
  onDelete: (id: string | number) => void
  onRegeneratePin: (player: CommunityPlayer) => void
}

export default function PlayersList({
  orderedForRender,
  hasPlayers,
  focusPlayerId,
  focusRef,
  expandedId,
  setExpandedId,
  isAdmin,
  levelBadge,
  displayName,
  matches,
  registrations,
  tournaments,
  playerAliases,
  players,
  onNavigate,
  onEdit,
  onDelete,
  onRegeneratePin,
}: PlayersListProps) {
  return (
    <div className="space-y-2">
      {!hasPlayers && (
        <EmptyState icon={<User size={36} />} title="No players yet. Be the first to join!" />
      )}

      {orderedForRender.map(({ p, idx, isSelf }) => {
        const expanded = expandedId === p.id
        return (
          <div
            key={p.id}
            ref={p.id === focusPlayerId ? focusRef : undefined}
            className={`card transition-all${isSelf ? ' ring-2 ring-lob-teal/40' : ''}`}
          >
            <div className="w-full" onClick={() => setExpandedId(expanded ? null : p.id)}>
              <PlayerRow
                player={p}
                avatarSize="lg"
                prefix={
                  <span className="text-xs font-bold text-lob-muted w-5 text-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                }
                name={
                  <>
                    {p.country && <FlagImg code={p.country} />}
                    {displayName(p)}
                    {p.isLeftHanded && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold ml-0.5">
                        L
                      </span>
                    )}
                    {isSelf && (
                      <span className="text-[10px] bg-lob-teal text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ml-0.5">
                        You
                      </span>
                    )}
                  </>
                }
                nameClassName="font-semibold text-lob-dark truncate flex items-center gap-1.5"
                trailing={
                  <>
                    <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                      <span
                        className={`text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadge(p.playtomicLevel || 0)}`}
                      >
                        {(p.playtomicLevel || 0).toFixed(1)}
                      </span>
                      {isAdmin && (p.pinChanges ?? 0) > 0 && (
                        <span
                          className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md flex items-center gap-1"
                          title={`PIN reset ${p.pinChanges} time${p.pinChanges === 1 ? '' : 's'}`}
                        >
                          <RotateCcw size={10} />
                          {p.pinChanges}
                        </span>
                      )}
                    </div>
                    {expanded ? (
                      <ChevronUp size={16} className="text-lob-muted flex-shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-lob-muted flex-shrink-0" />
                    )}
                  </>
                }
              />

              <div className="mt-2 pl-8">
                <p className="text-[10px] font-bold text-lob-teal uppercase tracking-wider mb-0.5">
                  Lobster Review
                </p>
                {(() => {
                  const r = corpReview(p, matches, registrations, tournaments, playerAliases)
                  return (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {r.hasLabel && (
                        <span className="font-bold text-lob-teal">{r.scenarioLabel}</span>
                      )}
                      {r.hasLabel ? ' — ' : ''}
                      {r.body}
                    </p>
                  )
                })()}
              </div>
            </div>

            {expanded && (
              <PlayerProfileDrawer
                player={p}
                players={players}
                matches={matches}
                tournaments={tournaments}
                registrations={registrations}
                playerAliases={playerAliases}
                isAdmin={isAdmin}
                onNavigate={onNavigate}
                onEdit={onEdit}
                onDelete={onDelete}
                onRegeneratePin={onRegeneratePin}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
