import React, { type Dispatch, type SetStateAction } from 'react'
import { ShoppingBag, ShoppingCart, Check } from 'lucide-react'
import { SignInBanner } from '../../components/ui/AuthGate'
import { EmptyState } from '../../components/ui/EmptyState'
import { sizeRank } from './sizes'
import type { LightboxState } from './Lightbox'
import type { MerchItem } from './merchSchemas'

type ByItem<T> = Record<number, T>

type ShopProps = {
  items: MerchItem[]
  loading: boolean
  isAdmin: boolean
  claimedId: string | null
  onNavigate?: (path: string) => void
  selectedSize: ByItem<string>
  setSelectedSize: Dispatch<SetStateAction<ByItem<string>>>
  sizeError: ByItem<boolean>
  setSizeError: Dispatch<SetStateAction<ByItem<boolean>>>
  customName: ByItem<string>
  setCustomName: Dispatch<SetStateAction<ByItem<string>>>
  ordered: ByItem<boolean>
  placeOrder: (itemId: number) => void
  orderCount: (itemId: number) => number
  websiteOrderCount: (itemId: number) => number
  setLightbox: (state: LightboxState | null) => void
}

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
}: ShopProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-lob-muted">
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

      {loading && <p className="text-center text-lob-muted-light py-8 text-sm">Loading…</p>}

      {items.map((item) => {
        const allImgs = item.images
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
              <div className="w-full h-32 bg-lob-cream rounded-xl flex items-center justify-center">
                <ShoppingBag size={36} className="text-lob-teal opacity-40" />
              </div>
            )}

            {/* Info */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-lob-dark">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-lob-muted mt-0.5">{item.description}</p>
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
              <span className="text-lg font-bold text-lob-teal flex-shrink-0 ml-2">
                €{item.price.toFixed(0)}
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
            {item.sizes.length > 0 && (
              <div>
                <p
                  className={`text-xs mb-1.5 font-medium ${sizeError[item.id] ? 'text-red-500' : 'text-lob-muted'}`}
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
                            ? 'bg-lob-teal text-white border-lob-teal'
                            : sizeError[item.id]
                              ? 'border-red-300 text-lob-slate'
                              : 'border-gray-200 text-lob-slate'
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
                <label className="text-xs font-medium text-lob-muted block mb-1">
                  Name customization <span className="text-amber-600 font-semibold">(+€5)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  maxLength={30}
                  disabled={ordered[item.id]}
                  value={customName[item.id] || ''}
                  onChange={(e) => setCustomName((n) => ({ ...n, [item.id]: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-lob-dark placeholder-gray-300 focus:outline-none focus:border-lob-teal focus:ring-1 focus:ring-lob-teal transition-all disabled:opacity-40 disabled:bg-gray-50"
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
                    : 'bg-lob-teal text-white active:scale-95'
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
                  const ext = item.externalOrders
                  return (
                    <span
                      className="text-xs text-lob-muted-light flex-shrink-0"
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
        <EmptyState icon={<ShoppingBag size={36} />} title="No merch items yet" />
      )}
    </div>
  )
}
