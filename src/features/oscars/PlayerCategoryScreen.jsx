import React from 'react'
import { ChevronLeft, X, Check } from 'lucide-react'
import { letterColor } from '../../lib/letterColors'
import { computeHistory } from './gameHelpers'
import ErrorBanner from './ErrorBanner'

/* ─── Player: category screen with player tiles + match-history ───────── */
export default function PlayerCategoryScreen({
  category,
  tournamentParticipants,
  claimedId,
  matches,
  shortName,
  myVote,
  onBack,
  onVote,
  onClear,
  busy,
  error,
  onDismissError,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-lobster-cream flex flex-col overflow-y-auto">
      <div className="px-4 pt-12 pb-3 sticky top-0 bg-lobster-cream z-10 border-b border-gray-100">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-800 active:scale-95 transition-all"
        >
          <ChevronLeft size={15} /> Games home
        </button>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-2xl">{category.icon}</span>
          <h2 className="text-xl font-bold text-gray-800 flex-1">{category.name}</h2>
          {myVote && (
            <button
              onClick={onClear}
              disabled={busy}
              className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 px-2 py-1 rounded-lg bg-red-50 border border-red-100 active:scale-95 transition-all flex items-center gap-1"
            >
              <X size={12} /> Clear vote
            </button>
          )}
        </div>
      </div>

      <div className="px-3 py-3 pb-12">
        {error && (
          <div className="mb-2">
            <ErrorBanner message={error} onDismiss={onDismissError} />
          </div>
        )}
        {tournamentParticipants.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p className="text-4xl mb-2">🤷</p>
            <p className="text-sm font-semibold text-gray-700">No registered players</p>
            <p className="text-xs text-gray-500 mt-1">
              This tournament doesn&apos;t have any registered players yet, so there&apos;s no one
              to vote for.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {tournamentParticipants.map((p) => {
              const isYou = String(p.id) === String(claimedId)
              const isMyVote = myVote && String(myVote.id) === String(p.id)
              const history = isYou ? [] : computeHistory(claimedId, p.id, matches)
              return (
                <button
                  key={p.id}
                  disabled={isYou || busy}
                  onClick={() => onVote(p.id)}
                  className={`rounded-xl p-2 text-left transition-all border flex flex-col gap-1 ${
                    isMyVote
                      ? 'bg-lobster-teal/10 border-lobster-teal'
                      : isYou
                        ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                        : 'bg-white border-gray-100 active:scale-95'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex-shrink-0 text-[10px] font-bold text-white px-1.5 py-0.5 rounded leading-none"
                      style={{ backgroundColor: letterColor(p.name) }}
                    >
                      {(p.name || '?').trim()[0]?.toUpperCase() || '?'}
                    </span>
                    <span className="font-semibold text-[13px] flex-1 min-w-0 truncate text-gray-800">
                      {shortName(p)}
                    </span>
                    {isYou && (
                      <span className="text-[9px] uppercase tracking-wide font-semibold text-gray-500 bg-gray-200 rounded px-1.5 py-0.5">
                        you
                      </span>
                    )}
                    {isMyVote && <Check size={14} className="text-lobster-teal flex-shrink-0" />}
                  </div>
                  <div className="text-[10.5px] text-gray-500 leading-snug space-y-0.5">
                    {isYou ? (
                      <span className="italic opacity-70">that&apos;s you</span>
                    ) : history.length === 0 ? (
                      <span className="italic opacity-70">no shared rounds yet</span>
                    ) : (
                      history.slice(0, 2).map((h, i) => {
                        if (h.type === 'with') {
                          return (
                            <div key={i} className="truncate">
                              R{h.round}: you &amp;{' '}
                              <strong className="text-gray-800">{shortName(p)}</strong>
                            </div>
                          )
                        }
                        const partner = tournamentParticipants.find(
                          (pp) => String(pp.id) === String(h.partnerId),
                        )
                        return (
                          <div key={i} className="truncate">
                            <strong className="text-gray-800">
                              R{h.round}: vs {shortName(p)}
                            </strong>
                            {partner ? <> &amp; {shortName(partner)}</> : null}
                          </div>
                        )
                      })
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
        <p className="text-center text-[11px] text-gray-400 pt-3">
          Tap a player to vote. You can change your mind until the admin ends the games.
        </p>
      </div>
    </div>
  )
}
