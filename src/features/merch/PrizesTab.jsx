import React from 'react'
import { ShoppingBag, Gift, Check } from 'lucide-react'
import Raffle from './Raffle'

// ── Prizes tab (admin) — tournament selector + prize-pool toggle + raffle ───
export default function PrizesTab({
  upcomingTournaments,
  tournaments,
  selectedTournament,
  setSelectedTournament,
  items,
  isAdmin,
  players,
  registrations,
}) {
  return (
    <div className="space-y-4">
      {/* Tournament selector — past tournaments are hidden so the
          prize/raffle picker only ever lists today's and future events. */}
      {upcomingTournaments.length === 0 ? (
        <div className="card text-center text-gray-400 py-4">
          <p className="text-sm">No upcoming tournaments</p>
        </div>
      ) : (
        <div className="card space-y-2">
          <label className="label">Select tournament for prizes & raffle</label>
          <select
            value={selectedTournament || ''}
            onChange={(e) => setSelectedTournament(e.target.value || null)}
            className="input text-sm"
          >
            <option value="">-- Choose tournament --</option>
            {upcomingTournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Prize items for selected tournament — collapsed by default so the
          Raffle tile takes center stage on a projected screen. Admin can
          expand it when actually editing the prize pool. */}
      {selectedTournament &&
        items.length > 0 &&
        isAdmin &&
        (() => {
          const selectedTour = tournaments.find((t) => String(t.id) === String(selectedTournament))
          const prizeIds = selectedTour?.prizeItemIds || []
          return (
            <details className="bg-white border border-gray-100 rounded-xl text-sm">
              <summary className="cursor-pointer px-3 py-2 flex items-center gap-2 text-gray-600 hover:bg-gray-50 rounded-xl">
                <ShoppingBag size={14} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate">
                  Prize pool: <span className="font-semibold text-gray-800">{prizeIds.length}</span>{' '}
                  selected
                </span>
                <span className="text-[11px] text-gray-400">tap to edit</span>
              </summary>
              <div className="border-t border-gray-100 px-3 py-3 space-y-2">
                <p className="text-[11px] text-gray-400">
                  Tap items to add / remove from the prize pool for{' '}
                  {selectedTour?.name || 'this tournament'}
                </p>
                {items.map((item) => {
                  const selected = prizeIds.includes(item.id)
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        /* prize selection handled in context */
                      }}
                      className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all ${selected ? 'border-lobster-teal bg-teal-50' : 'border-gray-100'}`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        {item.image_url ? (
                          <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag size={16} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          €{parseFloat(item.price).toFixed(0)}
                        </p>
                      </div>
                      {selected && <Check size={16} className="text-lobster-teal flex-shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </details>
          )
        })()}

      {/* Raffle — use selected tournament */}
      {selectedTournament && (
        <Raffle
          tournament={tournaments.find((t) => String(t.id) === String(selectedTournament))}
          players={players}
          registrations={registrations}
        />
      )}

      {!selectedTournament && tournaments.length > 0 && (
        <div className="card py-8 text-center text-gray-400">
          <Gift size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select a tournament above to manage prizes and run raffle</p>
        </div>
      )}
    </div>
  )
}
