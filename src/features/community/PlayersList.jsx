import React from 'react'
import { ChevronDown, ChevronUp, User, RotateCcw } from 'lucide-react'
import { FlagImg } from '../../components/ui/CountryPicker'
import Avatar from '../../components/ui/Avatar'
import { corpReview } from './reviewScenarios'
import PlayerProfileDrawer from './PlayerProfileDrawer'

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
}) {
  return (
    <div className="space-y-2">
      {!hasPlayers && (
        <div className="card py-10 text-center text-gray-400">
          <User size={36} className="mx-auto mb-2 opacity-30" />
          <p>No players yet. Be the first to join!</p>
        </div>
      )}

      {orderedForRender.map(({ p, idx, isSelf }) => {
        const expanded = expandedId === p.id
        return (
          <div
            key={p.id}
            ref={p.id === focusPlayerId ? focusRef : undefined}
            className={`card transition-all${isSelf ? ' ring-2 ring-lobster-teal/40' : ''}`}
          >
            <div className="w-full" onClick={() => setExpandedId(expanded ? null : p.id)}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">
                  #{idx + 1}
                </span>
                <Avatar player={p} />
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
                    {p.country && <FlagImg code={p.country} />}
                    {displayName(p)}
                    {p.isLeftHanded && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold ml-0.5">
                        L
                      </span>
                    )}
                    {isSelf && (
                      <span className="text-[10px] bg-lobster-teal text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ml-0.5">
                        You
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                  <span
                    className={`text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadge(p.adjustedLevel)}`}
                  >
                    {(p.adjustedLevel || 0).toFixed(1)}
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
                  <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                )}
              </div>

              <div className="mt-2 pl-8">
                <p className="text-[10px] font-bold text-lobster-teal uppercase tracking-wider mb-0.5">
                  Lobster Review
                </p>
                {(() => {
                  const r = corpReview(p, matches, registrations, tournaments, playerAliases)
                  return (
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {r.hasLabel && (
                        <span className="font-bold text-lobster-teal">{r.scenarioLabel}</span>
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
