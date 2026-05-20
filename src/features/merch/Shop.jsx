import React from 'react'
import { ShoppingBag, ShoppingCart, Check } from 'lucide-react'
import { SignInBanner } from '../../components/ui/AuthGate'
import { sizeRank } from './sizes'

// ── Shop tab — public-facing item grid with order flow ──────────────────────
export default function Shop({
  items,
  loading,
  isAdmin,
  claimedId,
  onNavigate,
  selectedSize,
  setSelectedSize,
  sizeError,
  setSizeError,
  customName,
  setCustomName,
  ordered,
  placeOrder,
  orderCount,
  websiteOrderCount,
  setLightbox,
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Place an order — the organizers will see what you need and get in touch. Prices include
        shipping.
      </p>

      {/* Identity notice — deep-links to Settings → Account */}
      {!claimedId && (
        <SignInBanner
          role="player"
          onNavigate={onNavigate}
          compact
          message="Sign in from Settings → Account before you can place orders."
        />
      )}

      {loading && <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>}

      {items.map((item) => {
        const allImgs =
          item.image_urls?.length > 0 ? item.image_urls : item.image_url ? [item.image_url] : []
        return (
          <div key={item.id} className="card space-y-3">
            {/* Image(s) — tap to zoom */}
            {allImgs.length > 0 ? (
              <div
                className="relative w-full bg-white rounded-xl overflow-hidden cursor-zoom-in"
                onClick={() => setLightbox({ images: allImgs, index: 0 })}
              >
                <img
                  src={allImgs[0]}
                  alt={item.name}
                  className="w-full h-52 object-contain rounded-xl"
                />
                {allImgs.length > 1 && (
                  <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                    +{allImgs.length - 1} more
                  </span>
                )}
                <span className="absolute bottom-2 left-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
                  🔍 tap to zoom
                </span>
              </div>
            ) : (
              <div className="w-full h-32 bg-lobster-cream rounded-xl flex items-center justify-center">
                <ShoppingBag size={36} className="text-lobster-teal opacity-40" />
              </div>
            )}

            {/* Info */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-800">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
                {/* FOMO counter — combines website orders + offline sales.
                  Singular copy below 1, so "1 lobster has this" sounds
                  right when only one person has ordered so far. */}
                {orderCount(item.id) > 0 && (
                  <p className="text-[11px] font-semibold text-amber-600 mt-1 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    {orderCount(item.id) === 1
                      ? '1 lobster already ordered 🦞'
                      : `${orderCount(item.id)} lobsters already ordered 🦞`}
                  </p>
                )}
              </div>
              <span className="text-lg font-bold text-lobster-teal flex-shrink-0 ml-2">
                €{parseFloat(item.price).toFixed(0)}
                {/shirt/i.test(item.name) &&
                  !/tank/i.test(item.name) &&
                  (customName[item.id] || '').trim() && (
                    <span className="text-xs font-semibold text-amber-600 block text-right">
                      +€5 name
                    </span>
                  )}
              </span>
            </div>

            {/* Size picker */}
            {item.sizes?.length > 0 && (
              <div>
                <p
                  className={`text-xs mb-1.5 font-medium ${sizeError[item.id] ? 'text-red-500' : 'text-gray-500'}`}
                >
                  {sizeError[item.id] ? '⚠ Please select a size:' : 'Select size:'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[...item.sizes]
                    .sort((a, b) => sizeRank(a) - sizeRank(b))
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSelectedSize((si) => ({ ...si, [item.id]: s }))
                          setSizeError((e) => ({ ...e, [item.id]: false }))
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${
                          selectedSize[item.id] === s
                            ? 'bg-lobster-teal text-white border-lobster-teal'
                            : sizeError[item.id]
                              ? 'border-red-300 text-gray-600'
                              : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Name on item — only for shirts (+€5), not tank tops */}
            {/shirt/i.test(item.name) && !/tank/i.test(item.name) && (
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Name customization <span className="text-amber-600 font-semibold">(+€5)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  maxLength={30}
                  disabled={ordered[item.id]}
                  value={customName[item.id] || ''}
                  onChange={(e) => setCustomName((n) => ({ ...n, [item.id]: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-lobster-teal focus:ring-1 focus:ring-lobster-teal transition-all disabled:opacity-40 disabled:bg-gray-50"
                />
              </div>
            )}

            {/* Order button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => placeOrder(item.id)}
                disabled={ordered[item.id]}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  ordered[item.id]
                    ? 'bg-green-100 text-green-700'
                    : 'bg-lobster-teal text-white active:scale-95'
                }`}
              >
                {ordered[item.id] ? (
                  <>
                    <Check size={15} /> Ordered!
                  </>
                ) : (
                  <>
                    <ShoppingCart size={15} /> Order
                  </>
                )}
              </button>
              {isAdmin &&
                orderCount(item.id) > 0 &&
                (() => {
                  const web = websiteOrderCount(item.id)
                  const ext = parseInt(item.external_orders) || 0
                  return (
                    <span
                      className="text-xs text-gray-400 flex-shrink-0"
                      title="Website orders + offline orders"
                    >
                      {web}
                      {ext > 0 ? ` + ${ext}` : ''} total
                    </span>
                  )
                })()}
            </div>
          </div>
        )
      })}

      {!loading && items.length === 0 && (
        <div className="card py-10 text-center text-gray-400">
          <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
          <p>No merch items yet</p>
        </div>
      )}
    </div>
  )
}
