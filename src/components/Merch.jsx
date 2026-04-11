import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { Plus, X, Pencil, ShoppingBag, Gift, Shuffle, Upload, Check, ShoppingCart, User, GripVertical } from 'lucide-react'
import AdminLogin from './AdminLogin'

const SIZES_APPAREL  = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const SIZES_SOCKS    = ['S (35-38)', 'M (39-42)', 'L (43-46)']
const SIZE_ORDER     = ['XS', 'S', 'S (35-38)', 'M', 'M (39-42)', 'L', 'L (43-46)', 'XL', 'XXL']
const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(s); return i >= 0 ? i : 999 }

const emptyItem = {
  name: '', description: '', price: '', sizes: [], category: 'apparel', image_url: '', image_urls: [], active: true,
}

// ── Raffle component ──────────────────────────────────────────────────────────
function Raffle({ tournament, players, registrations }) {
  const registered = registrations
    .filter(r => r.tournamentId === tournament?.id && r.status === 'registered')
    .map(r => players.find(p => p.id === r.playerId))
    .filter(Boolean)

  const [winners, setWinners]       = useState([])
  const [spinning, setSpinning]     = useState(false)
  const [numPrizes, setNumPrizes]   = useState(1)

  const runRaffle = async () => {
    if (registered.length === 0) return
    setSpinning(true)
    setWinners([])
    // Brief animation delay
    await new Promise(r => setTimeout(r, 800))
    const shuffled = [...registered].sort(() => Math.random() - 0.5)
    setWinners(shuffled.slice(0, Math.min(numPrizes, registered.length)))
    setSpinning(false)
  }

  if (!tournament) return (
    <div className="card py-8 text-center text-gray-400">
      <Gift size={32} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">Open a tournament first to run a raffle</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={18} className="text-lobster-teal" />
          <p className="font-bold text-gray-800">Prize Raffle</p>
          <span className="text-xs bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full font-medium ml-auto">
            {registered.length} participants
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          {tournament.name} · Randomly picks winners from registered players
        </p>

        <div>
          <label className="label">Number of prizes to draw</label>
          <div className="flex gap-2 mb-3">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setNumPrizes(n)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${numPrizes === n ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={runRaffle}
          disabled={spinning || registered.length === 0}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Shuffle size={16} className={spinning ? 'animate-spin' : ''} />
          {spinning ? 'Drawing winners…' : '🎲 Draw Winners!'}
        </button>

        {registered.length === 0 && (
          <p className="text-xs text-orange-500 text-center mt-2">No registered players yet</p>
        )}
      </div>

      {/* Winners */}
      {winners.length > 0 && (
        <div className="card bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200">
          <p className="font-bold text-amber-800 mb-3 text-center">🎉 Winners!</p>
          <div className="space-y-2">
            {winners.map((w, i) => (
              <div key={w.id} className="flex items-center gap-3 bg-white rounded-xl p-3">
                <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {w.name[0]}
                </div>
                <p className="font-semibold text-gray-800">{w.name}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setWinners([])} className="text-xs text-amber-600 font-medium mt-3 w-full text-center">
            Clear results
          </button>
        </div>
      )}
    </div>
  )
}

// ── Image Lightbox ────────────────────────────────────────────────────────────
function Lightbox({ images, startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex)
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white"
      >
        <X size={20} />
      </button>

      {/* Main image */}
      <img
        src={images[current]}
        alt=""
        className="max-w-full max-h-[80vh] object-contain rounded-xl"
        onClick={e => e.stopPropagation()}
      />

      {/* Thumbnails if multiple */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === current ? 'border-white' : 'border-transparent opacity-50'}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Merch component ──────────────────────────────────────────────────────
export default function Merch({ tournament, tournaments: allTournaments = [], initialTab }) {
  const { players, registrations, isAdmin, tournaments: contextTournaments = [], claimedId } = useApp()
  const tournaments = allTournaments.length > 0 ? allTournaments : contextTournaments
  const [tab, setTab]             = useState(initialTab || 'shop')
  useEffect(() => { if (initialTab) setTab(initialTab) }, [initialTab])
  const [items, setItems]         = useState([])
  const [interests, setInterests] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [form, setForm]           = useState(emptyItem)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedSize, setSelectedSize]   = useState({}) // itemId -> size
  const [sizeError, setSizeError]         = useState({}) // itemId -> true (missing size)
  const [customName, setCustomName]       = useState({}) // itemId -> name string
  const [ordered, setOrdered]             = useState({}) // itemId -> true (this session)
  const [selectedTournament, setSelectedTournament] = useState(tournament?.id != null ? String(tournament.id) : null)
  const [lightbox, setLightbox]           = useState(null) // { images, index }

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadItems = async () => {
    // Try ordering by display_order first; fall back to id if column doesn't exist yet
    let { data, error } = await supabase.from('merch_items').select('*').eq('active', true).order('display_order').order('id')
    if (error) {
      const res = await supabase.from('merch_items').select('*').eq('active', true).order('id')
      data = res.data
    }
    if (data) setItems(data)
    setLoading(false)
  }

  const loadInterests = async () => {
    const { data } = await supabase.from('merch_interests').select('*, players(name)')
    if (data) setInterests(data)
  }

  useEffect(() => {
    loadItems()
    loadInterests()
    const ch1 = supabase.channel('merch-items').on('postgres_changes', { event: '*', schema: 'public', table: 'merch_items' }, loadItems).subscribe()
    const ch2 = supabase.channel('merch-interests').on('postgres_changes', { event: '*', schema: 'public', table: 'merch_interests' }, loadInterests).subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [])

  // ── Image upload (up to 3) ───────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const current = form.image_urls || []
    const slots   = 3 - current.length
    if (slots <= 0) return
    const toUpload = files.slice(0, slots)
    setUploading(true)
    try {
      const newUrls = []
      for (const file of toUpload) {
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/\s/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('merch').upload(filename, file, { upsert: true })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('merch').getPublicUrl(filename)
        newUrls.push(publicUrl)
      }
      setForm(f => ({
        ...f,
        image_urls: [...(f.image_urls || []), ...newUrls],
        image_url:  f.image_url || newUrls[0] || '',
      }))
    } catch (err) {
      alert('Image upload failed: ' + err.message + '\n\nMake sure a public "merch" storage bucket exists in Supabase with upload policies enabled.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = (idx) => {
    setForm(f => {
      const next = (f.image_urls || []).filter((_, i) => i !== idx)
      return { ...f, image_urls: next, image_url: next[0] || '' }
    })
  }

  // ── Admin CRUD ───────────────────────────────────────────────────────────────
  const openAdd = () => {
    if (!isAdmin) { setShowLogin(true); return }
    setForm(emptyItem); setEditItem(null); setShowForm(true)
  }

  const openEdit = (item) => {
    if (!isAdmin) { setShowLogin(true); return }
    const urls = item.image_urls?.length ? item.image_urls : (item.image_url ? [item.image_url] : [])
    setForm({ ...item, price: String(item.price), sizes: item.sizes || [], image_urls: urls })
    setEditItem(item); setShowForm(true)
  }

  const handleSaveItem = async (e) => {
    e.preventDefault(); setSaving(true)
    const urls = form.image_urls || []
    const payload = {
      name: form.name,
      description: form.description || '',
      price: parseFloat(form.price) || 0,
      sizes: form.sizes || [],
      image_url: urls[0] || form.image_url || '',
      image_urls: urls,
      category: form.category || 'apparel',
      active: true,
    }
    if (editItem) {
      await supabase.from('merch_items').update(payload).eq('id', editItem.id)
    } else {
      // New items go to the end of the list
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.display_order || 0)) : 0
      const { error } = await supabase.from('merch_items').insert({ ...payload, display_order: maxOrder + 1 })
      if (error) await supabase.from('merch_items').insert(payload)
    }
    await loadItems()
    setShowForm(false); setSaving(false)
  }

  const handleDeleteItem = async (id) => {
    if (!confirm('Remove this item?')) return
    await supabase.from('merch_items').update({ active: false }).eq('id', id)
    await loadItems()
  }

  // ── Drag-and-drop reorder (admin) ───────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  const handleDragStart = (idx) => (e) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (idx) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== overIdx) setOverIdx(idx)
  }

  const handleDrop = (idx) => async (e) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return }
    const reordered = [...items]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    setItems(reordered)
    setDragIdx(null)
    setOverIdx(null)
    // Persist new order to DB
    const updates = reordered.map((item, i) =>
      supabase.from('merch_items').update({ display_order: i }).eq('id', item.id)
    )
    await Promise.all(updates)
  }

  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null) }

  const toggleSize = (size) => {
    setForm(f => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter(s => s !== size) : [...f.sizes, size]
    }))
  }

  // ── Orders ───────────────────────────────────────────────────────────────────
  const orderCount = (itemId) => interests.filter(i => i.merch_item_id === itemId).length

  const placeOrder = async (itemId) => {
    // Must be logged in to place an order
    if (!claimedId) {
      setShowLogin(true)
      return
    }

    const item = items.find(i => i.id === itemId)
    const size = selectedSize[itemId] || ''
    const name = (customName[itemId] || '').trim()

    // Require size if item has sizes
    if (item?.sizes?.length > 0 && !size) {
      setSizeError(e => ({ ...e, [itemId]: true }))
      return
    }
    setSizeError(e => ({ ...e, [itemId]: false }))

    try {
      await supabase.from('merch_interests').upsert({
        merch_item_id: itemId,
        size,
        player_id: claimedId,
        custom_name: name || null,
      }, { onConflict: 'player_id,merch_item_id' })
      setOrdered(o => ({ ...o, [itemId]: true }))
      await loadInterests()
    } catch (err) {
      console.error('Order error:', err)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'shop', label: '🛍️ Shop' },
    ...(isAdmin ? [{ id: 'orders', label: `📋 Orders${interests.length > 0 ? ` (${interests.length})` : ''}` }] : []),
    ...(isAdmin ? [{ id: 'prizes', label: '🎁 Prizes' }] : []),
    ...(isAdmin ? [{ id: 'manage', label: '⚙️ Manage' }] : []),
  ]

  return (
    <div className="space-y-4">
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      <h2 className="text-lg font-bold text-gray-800">Padel Lobsters Merch</h2>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === t.id ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SHOP TAB ── */}
      {tab === 'shop' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Place an order — the organizers will see what you need and get in touch. Prices include shipping.</p>

          {/* Identity notice */}
          {!claimedId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
              <User size={14} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                You need to <button onClick={() => setShowLogin(true)} className="font-bold underline">verify your identity</button> before you can place orders.
              </p>
            </div>
          )}

          {loading && <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>}

          {items.map(item => {
            const allImgs = item.image_urls?.length > 0
              ? item.image_urls
              : item.image_url ? [item.image_url] : []
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
                  {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                </div>
                <span className="text-lg font-bold text-lobster-teal flex-shrink-0 ml-2">
                  €{parseFloat(item.price).toFixed(0)}
                </span>
              </div>

              {/* Size picker */}
              {item.sizes?.length > 0 && (
                <div>
                  <p className={`text-xs mb-1.5 font-medium ${sizeError[item.id] ? 'text-red-500' : 'text-gray-500'}`}>
                    {sizeError[item.id] ? '⚠ Please select a size:' : 'Select size:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...item.sizes].sort((a, b) => sizeRank(a) - sizeRank(b)).map(s => (
                      <button key={s}
                        onClick={() => {
                          setSelectedSize(si => ({ ...si, [item.id]: s }))
                          setSizeError(e => ({ ...e, [item.id]: false }))
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${
                          selectedSize[item.id] === s
                            ? 'bg-lobster-teal text-white border-lobster-teal'
                            : sizeError[item.id]
                              ? 'border-red-300 text-gray-600'
                              : 'border-gray-200 text-gray-600'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Name on item — only for shirts */}
              {/shirt/i.test(item.name) && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Name for the shirt <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    maxLength={30}
                    disabled={ordered[item.id]}
                    value={customName[item.id] || ''}
                    onChange={e => setCustomName(n => ({ ...n, [item.id]: e.target.value }))}
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
                  {ordered[item.id]
                    ? <><Check size={15} /> Ordered!</>
                    : <><ShoppingCart size={15} /> Order</>}
                </button>
                {isAdmin && orderCount(item.id) > 0 && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {orderCount(item.id)} {orderCount(item.id) === 1 ? 'order' : 'orders'}
                  </span>
                )}
              </div>
            </div>
          )})}

          {!loading && items.length === 0 && (
            <div className="card py-10 text-center text-gray-400">
              <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
              <p>No merch items yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── PRIZES TAB (admin only) ── */}
      {tab === 'prizes' && isAdmin && (
        <div className="space-y-4">
          {/* Tournament selector */}
          {tournaments.length > 0 && (
            <div className="card space-y-2">
              <label className="label">Select tournament for prizes & raffle</label>
              <select
                value={selectedTournament || ''}
                onChange={e => setSelectedTournament(e.target.value || null)}
                className="input text-sm"
              >
                <option value="">-- Choose tournament --</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tournaments.length === 0 && (
            <div className="card text-center text-gray-400 py-4">
              <p className="text-sm">No tournaments available</p>
            </div>
          )}

          {/* Prize items for selected tournament */}
          {selectedTournament && items.length > 0 && isAdmin && (
            <div className="card space-y-3">
              <p className="font-semibold text-gray-700 text-sm">
                Select prizes for {tournaments.find(t => String(t.id) === String(selectedTournament))?.name}
              </p>
              <p className="text-xs text-gray-400">Tap items to add/remove from the prize pool (admin feature)</p>
              <div className="space-y-2">
                {items.map(item => {
                  const selectedTour = tournaments.find(t => String(t.id) === String(selectedTournament))
                  const prizeIds = selectedTour?.prizeItemIds || []
                  const selected = prizeIds.includes(item.id)
                  return (
                    <div key={item.id}
                      onClick={() => {/* prize selection handled in context */}}
                      className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all ${selected ? 'border-lobster-teal bg-teal-50' : 'border-gray-100'}`}>
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        {item.image_url
                          ? <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={16} className="text-gray-400" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">€{parseFloat(item.price).toFixed(0)}</p>
                      </div>
                      {selected && <Check size={16} className="text-lobster-teal flex-shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Raffle — use selected tournament */}
          {selectedTournament && (
            <Raffle
              tournament={tournaments.find(t => String(t.id) === String(selectedTournament))}
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
      )}

      {/* ── ORDERS TAB (admin only) ── */}
      {tab === 'orders' && isAdmin && (
        <div className="space-y-4">
          {interests.length > 0 ? (
            <div className="card space-y-3 overflow-x-auto">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-700 text-sm flex items-center gap-1.5">
                  All Orders
                  <span className="bg-lobster-teal text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{interests.length}</span>
                </p>
                <div className="flex gap-3 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Paid: {interests.filter(o => o.paid).length}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Delivered: {interests.filter(o => o.delivered).length}</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-medium">Player</th>
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium">Size</th>
                    <th className="pb-2 font-medium text-center">Paid</th>
                    <th className="pb-2 font-medium text-center">Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {[...interests]
                    .sort((a, b) => {
                      const itemA = items.find(i => i.id === a.merch_item_id)
                      const itemB = items.find(i => i.id === b.merch_item_id)
                      const nameCmp = (itemA?.name || '').localeCompare(itemB?.name || '')
                      if (nameCmp !== 0) return nameCmp
                      return sizeRank(a.size || '') - sizeRank(b.size || '')
                    })
                    .map(o => {
                      const player = players.find(p => String(p.id) === String(o.player_id))
                      const item = items.find(i => i.id === o.merch_item_id)
                      return (
                        <tr key={o.id} className="border-b border-gray-50 last:border-0">
                          <td className="py-2 pr-2">
                            <span className="font-medium text-gray-800">{player?.name?.split(' ')[0] || 'Unknown'}</span>
                            {o.custom_name && (
                              <span className="block text-[11px] text-lobster-teal">"{o.custom_name}"</span>
                            )}
                          </td>
                          <td className="py-2 pr-2 text-gray-600">{item?.name || '—'}</td>
                          <td className="py-2 pr-2">
                            {o.size
                              ? <span className="text-xs font-bold bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full">{o.size}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="py-2 text-center">
                            <button
                              onClick={async () => {
                                await supabase.from('merch_interests').update({ paid: !o.paid }).eq('id', o.id)
                                await loadInterests()
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                o.paid ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-300'
                              }`}
                            >
                              <Check size={14} />
                            </button>
                          </td>
                          <td className="py-2 text-center">
                            <button
                              onClick={async () => {
                                await supabase.from('merch_interests').update({ delivered: !o.delivered }).eq('id', o.id)
                                await loadInterests()
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                o.delivered ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-300'
                              }`}
                            >
                              <Check size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card py-6 text-center text-gray-400 text-sm">No orders yet — orders will appear here when players place them from the Shop tab</div>
          )}
        </div>
      )}

      {/* ── MANAGE TAB (admin only) ── */}
      {tab === 'manage' && isAdmin && (
        <div className="space-y-4">
          <button onClick={openAdd} className="btn-primary w-full flex items-center justify-center gap-2">
            <Plus size={16} /> Add Merch Item
          </button>

          {/* Item list (draggable) */}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                draggable
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDrop={handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={`card flex items-center gap-3 transition-all ${
                  dragIdx === idx ? 'opacity-40 scale-[0.97]' : ''
                } ${overIdx === idx && dragIdx !== idx ? 'ring-2 ring-lobster-teal ring-offset-1' : ''}`}
              >
                <div className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 text-gray-300 hover:text-gray-500 -ml-1">
                  <GripVertical size={18} />
                </div>
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                  {item.image_url
                    ? <img src={item.image_url} className="w-full h-full object-cover" alt="" draggable={false} />
                    : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={18} className="text-gray-400" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">€{parseFloat(item.price).toFixed(0)} · {orderCount(item.id)} {orderCount(item.id) === 1 ? 'order' : 'orders'}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(item)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Pencil size={13} className="text-gray-500" />
                  </button>
                  <button onClick={() => handleDeleteItem(item.id)} className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                    <X size={13} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ADD / EDIT form modal ── */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editItem ? 'Edit Item' : 'Add Merch Item'}</h2>
              <button onClick={() => setShowForm(false)}><X size={22} className="text-gray-400" /></button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input required className="input" placeholder="e.g. Technical T-Shirt"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="Short description"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <label className="label">Price (€)</label>
                <input type="number" step="0.01" min="0" className="input" placeholder="0.00"
                  value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>

              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="apparel">Apparel</option>
                  <option value="accessories">Accessories</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Sizes */}
              <div>
                <label className="label">Sizes (select applicable)</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES_APPAREL.map(s => (
                      <button type="button" key={s} onClick={() => toggleSize(s)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${form.sizes.includes(s) ? 'bg-lobster-teal text-white border-lobster-teal' : 'border-gray-200 text-gray-600'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES_SOCKS.map(s => (
                      <button type="button" key={s} onClick={() => toggleSize(s)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${form.sizes.includes(s) ? 'bg-lobster-teal text-white border-lobster-teal' : 'border-gray-200 text-gray-600'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  {form.sizes.length === 0 && <p className="text-xs text-gray-400">No sizes = one-size item</p>}
                </div>
              </div>

              {/* Images — up to 3 */}
              <div>
                <label className="label">Product Photos <span className="text-gray-400 font-normal">(up to 3)</span></label>

                {/* Thumbnails row */}
                {(form.image_urls || []).length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {(form.image_urls || []).map((url, idx) => (
                      <div key={idx} className="relative w-24 h-24 flex-shrink-0">
                        <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold leading-none"
                        >×</button>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 rounded">main</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button — only show if under 3 */}
                {(form.image_urls || []).length < 3 && (
                  <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 font-medium cursor-pointer transition-all hover:border-lobster-teal hover:text-lobster-teal ${uploading ? 'opacity-50' : ''}`}>
                    <Upload size={16} />
                    {uploading ? 'Uploading…' : `Add photo${(form.image_urls || []).length > 0 ? ` (${(form.image_urls || []).length}/3)` : ''}`}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>

              <button type="submit" disabled={saving || uploading} className="btn-primary w-full">
                {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
