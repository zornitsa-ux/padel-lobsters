import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { Plus, X, Pencil, ShoppingBag, Gift, Shuffle, Upload, Check, ShoppingCart, User, GripVertical, Ban, Clock, Package, CreditCard, MessageSquare } from 'lucide-react'

const SIZES_APPAREL  = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const SIZES_SOCKS    = ['S (35-38)', 'M (39-42)', 'L (43-46)']
const SIZE_ORDER     = ['XS', 'S', 'S (35-38)', 'M', 'M (39-42)', 'L', 'L (43-46)', 'XL', 'XXL']
const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(s); return i >= 0 ? i : 999 }

const STATUS_CONFIG = {
  ordered:   { label: 'Ordered',   icon: Clock,      bg: 'bg-amber-100',  text: 'text-amber-700' },
  paid:      { label: 'Paid',      icon: CreditCard,  bg: 'bg-green-100',  text: 'text-green-700' },
  delivered: { label: 'Delivered', icon: Package,     bg: 'bg-blue-100',   text: 'text-blue-700' },
  cancelled: { label: 'Cancelled', icon: Ban,         bg: 'bg-red-100',    text: 'text-red-500' },
}

const formatOrderTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const getPlayerName = (o, players) => {
  // Try joined player name first, then match from players list
  if (o.players?.name) return o.players.name
  if (o.player_id) {
    const p = players.find(pl => pl.id === o.player_id || String(pl.id) === String(o.player_id))
    if (p) return p.name
  }
  return null
}

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
  const { players, registrations, isAdmin, tournaments: contextTournaments = [], claimedId, claimIdentity, clearIdentity } = useApp()
  const tournaments = allTournaments.length > 0 ? allTournaments : contextTournaments
  const [tab, setTab]             = useState(initialTab || 'shop')
  useEffect(() => { if (initialTab) setTab(initialTab) }, [initialTab])
  const [items, setItems]         = useState([])
  const [interests, setInterests] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showIdentity, setShowIdentity] = useState(false)
  const [pinTarget, setPinTarget]       = useState(null)
  const [pinInput, setPinInput]         = useState('')
  const [pinError, setPinError]         = useState('')
  const [playerSearch, setPlayerSearch] = useState('')
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
    // Always use simple select to avoid join issues
    const { data, error } = await supabase.from('merch_interests').select('*')
    if (error) {
      console.error('loadInterests failed:', error.message)
      return
    }
    console.log('loadInterests:', data?.length, 'orders loaded')
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
      setShowIdentity(true)
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

    const pid = parseInt(claimedId)

    // Check if player already ordered this item — update if so, insert if not
    const { data: existing } = await supabase
      .from('merch_interests')
      .select('id')
      .eq('player_id', pid)
      .eq('merch_item_id', itemId)
      .limit(1)

    let res
    if (existing && existing.length > 0) {
      // Update existing order — try with all fields, fall back gracefully
      res = await supabase.from('merch_interests')
        .update({ size, custom_name: name || '' })
        .eq('id', existing[0].id)
      if (res.error) {
        res = await supabase.from('merch_interests')
          .update({ size })
          .eq('id', existing[0].id)
      }
    } else {
      // Insert new order — try with all fields, then progressively strip optional columns
      const base = { merch_item_id: itemId, size, player_id: pid }
      res = await supabase.from('merch_interests').insert({ ...base, status: 'ordered', custom_name: name || '' })
      if (res.error) {
        res = await supabase.from('merch_interests').insert({ ...base, status: 'ordered' })
      }
      if (res.error) {
        res = await supabase.from('merch_interests').insert({ ...base, custom_name: name || '' })
      }
      if (res.error) {
        res = await supabase.from('merch_interests').insert(base)
      }
    }

    if (res.error) {
      console.error('Merch order failed:', res.error.message)
      alert('Order failed: ' + res.error.message)
      return
    }

    setOrdered(o => ({ ...o, [itemId]: true }))
    await loadInterests()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const myOrders = claimedId ? interests.filter(o => String(o.player_id) === String(claimedId)) : []
  const activeOrders = interests.filter(o => (o.status || 'ordered') !== 'cancelled')

  // Cancel order modal state
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelComment, setCancelComment] = useState('')

  const TABS = [
    { id: 'shop', label: '🛍️ Shop' },
    ...(!isAdmin && claimedId ? [{ id: 'myorders', label: `📦 My Orders${myOrders.length > 0 ? ` (${myOrders.length})` : ''}` }] : []),
    ...(isAdmin ? [{ id: 'orders', label: `📋 Orders${activeOrders.length > 0 ? ` (${activeOrders.length})` : ''}` }] : []),
    ...(isAdmin ? [{ id: 'prizes', label: '🎁 Prizes' }] : []),
    ...(isAdmin ? [{ id: 'manage', label: '⚙️ Manage' }] : []),
  ]

  return (
    <div className="space-y-4">
      {/* ── Player identity picker ── */}
      {showIdentity && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-800">
                {pinTarget ? `Enter PIN for ${pinTarget.name.split(' ')[0]}` : 'Who are you?'}
              </h3>
              <button onClick={() => { setShowIdentity(false); setPinTarget(null); setPinError(''); setPlayerSearch('') }}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            {!pinTarget ? (
              <>
                <p className="text-xs text-gray-400">Select your name to place orders — you'll enter your PIN once to confirm.</p>
                <input
                  type="text"
                  placeholder="🔍 Search your name…"
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-lobster-teal focus:ring-1 focus:ring-lobster-teal"
                  autoFocus
                />
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {players.filter(p => (p.status || 'active') === 'active').filter(p => p.name.toLowerCase().includes(playerSearch.toLowerCase())).map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setPinTarget(p); setPinInput(''); setPinError('') }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all active:scale-[0.98] ${
                        String(claimedId) === String(p.id)
                          ? 'bg-lobster-teal/10 border-2 border-lobster-teal'
                          : 'bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="w-9 h-9 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {p.name[0].toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-800 text-sm">{p.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">Enter your 4-digit PIN to verify. Ask the admin if you don't have it.</p>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="• • • •"
                  className="input text-center text-2xl tracking-[0.5em] font-bold"
                  value={pinInput}
                  onChange={e => { setPinInput(e.target.value.slice(0, 4)); setPinError('') }}
                  autoFocus
                />
                {pinError && <p className="text-xs text-red-500 text-center font-medium">{pinError}</p>}
                <button
                  onClick={() => {
                    const result = claimIdentity(pinTarget.id, pinInput, players)
                    if (result.success) {
                      setPinTarget(null); setPinInput(''); setPinError('')
                      setShowIdentity(false)
                    } else {
                      setPinError(result.error); setPinInput('')
                    }
                  }}
                  disabled={pinInput.length !== 4}
                  className="btn-primary w-full disabled:opacity-40"
                >
                  Confirm — I'm {pinTarget.name.split(' ')[0]}
                </button>
                <button onClick={() => { setPinTarget(null); setPinError(''); setPlayerSearch('') }}
                  className="w-full text-xs text-gray-400 py-1">
                  ← Back to player list
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                You need to <button onClick={() => setShowIdentity(true)} className="font-bold underline">verify your identity</button> before you can place orders.
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
                  {(/shirt/i.test(item.name) && !/tank/i.test(item.name)) && (customName[item.id] || '').trim() && (
                    <span className="text-xs font-semibold text-amber-600 block text-right">+€5 name</span>
                  )}
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

              {/* Name on item — only for shirts (+€5), not tank tops */}
              {(/shirt/i.test(item.name) && !/tank/i.test(item.name)) && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Name customization <span className="text-amber-600 font-semibold">(+€5)</span></label>
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

      {/* ── MY ORDERS TAB (player) ── */}
      {tab === 'myorders' && !isAdmin && claimedId && (
        <div className="space-y-3">
          {myOrders.length > 0 ? (
            myOrders
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map(o => {
                const item = items.find(i => i.id === o.merch_item_id)
                const status = o.status || 'ordered'
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ordered
                const StatusIcon = cfg.icon
                return (
                  <div key={o.id} className={`card space-y-2 ${status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                        {item?.image_url
                          ? <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={18} className="text-gray-400" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800">{item?.name || 'Item'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {o.size && <span className="text-xs font-bold bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full">{o.size}</span>}
                          <span className="text-[11px] text-gray-400">{formatOrderTime(o.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Status timeline */}
                    <div className="flex items-center gap-1 pt-1">
                      {['ordered', 'paid', 'delivered'].map((s, i) => {
                        const sCfg = STATUS_CONFIG[s]
                        const SIcon = sCfg.icon
                        const steps = ['ordered', 'paid', 'delivered']
                        const currentIdx = status === 'cancelled' ? -1 : steps.indexOf(status)
                        const active = steps.indexOf(s) <= currentIdx
                        return (
                          <React.Fragment key={s}>
                            {i > 0 && <div className={`flex-1 h-0.5 rounded ${active ? 'bg-lobster-teal' : 'bg-gray-200'}`} />}
                            <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
                              active ? `${sCfg.bg} ${sCfg.text}` : 'bg-gray-100 text-gray-300'
                            }`}>
                              <SIcon size={10} /> {sCfg.label}
                            </div>
                          </React.Fragment>
                        )
                      })}
                    </div>
                    {/* Cancelled notice */}
                    {status === 'cancelled' && (
                      <div className="bg-red-50 rounded-xl p-2.5 space-y-1">
                        <p className="text-xs font-semibold text-red-500 flex items-center gap-1"><Ban size={11} /> Order cancelled by admin</p>
                        {o.admin_comment && <p className="text-xs text-red-400 italic">"{o.admin_comment}"</p>}
                      </div>
                    )}
                  </div>
                )
              })
          ) : (
            <div className="card py-8 text-center text-gray-400">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No orders yet — browse the Shop to get started</p>
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
          {/* Cancel order modal */}
          {cancelTarget && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
              <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Cancel Order</h3>
                  <button onClick={() => { setCancelTarget(null); setCancelComment('') }}><X size={22} className="text-gray-400" /></button>
                </div>
                <p className="text-sm text-gray-500">
                  Cancel order for <strong>{getPlayerName(cancelTarget, players)?.split(' ')[0] || 'player'}</strong> — {items.find(i => i.id === cancelTarget.merch_item_id)?.name}?
                </p>
                <textarea
                  placeholder="Add a comment for the player (optional)…"
                  value={cancelComment}
                  onChange={e => setCancelComment(e.target.value)}
                  className="input text-sm w-full h-20 resize-none"
                />
                <button
                  onClick={async () => {
                    const { error } = await supabase.from('merch_interests').update({
                      status: 'cancelled',
                      admin_comment: cancelComment || null,
                      cancelled_at: new Date().toISOString(),
                      paid: false, delivered: false,
                    }).eq('id', cancelTarget.id)
                    if (error) {
                      // Fallback: try without status fields (pre-v12)
                      await supabase.from('merch_interests').update({
                        paid: false, delivered: false,
                      }).eq('id', cancelTarget.id)
                    }
                    setCancelTarget(null); setCancelComment('')
                    await loadInterests()
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-all"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          )}

          {activeOrders.length > 0 ? (
            <div className="space-y-2">
              {/* Summary stats */}
              <div className="flex gap-2 text-[11px] text-gray-500 px-1">
                <span>{activeOrders.length} orders</span>
                <span>·</span>
                <span className="text-amber-600">{activeOrders.filter(o => (o.status || 'ordered') === 'ordered').length} pending</span>
                <span>·</span>
                <span className="text-green-600">{activeOrders.filter(o => o.status === 'paid').length} paid</span>
                <span>·</span>
                <span className="text-blue-600">{activeOrders.filter(o => o.status === 'delivered').length} delivered</span>
              </div>

              {/* Order cards */}
              {[...activeOrders]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(o => {
                  const playerName = getPlayerName(o, players)
                  const item = items.find(i => i.id === o.merch_item_id)
                  const status = o.status || 'ordered'
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ordered
                  const StatusIcon = cfg.icon
                  const basePrice = item ? parseFloat(item.price) : 0
                  const hasCustomName = (o.custom_name || '').trim().length > 0
                  const isShirt = item && /shirt/i.test(item.name)
                  const orderPrice = basePrice + (isShirt && hasCustomName ? 5 : 0)
                  return (
                    <div key={o.id} className="card space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800">
                            {playerName?.split(' ')[0] || 'Unknown'}
                            <span className="font-normal text-gray-500 ml-1.5 text-xs">{item?.name || '—'}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {o.size && <span className="text-xs font-bold bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full">{o.size}</span>}
                            {hasCustomName && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">"{o.custom_name}"</span>}
                            <span className="text-xs font-bold text-lobster-teal">€{orderPrice}</span>
                            <span className="text-[11px] text-gray-400">{formatOrderTime(o.created_at)}</span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                          <StatusIcon size={10} /> {cfg.label}
                        </span>
                      </div>
                      {/* Status action buttons */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={async () => {
                            await supabase.from('merch_interests').update({ status: 'paid', paid: true }).eq('id', o.id)
                            await loadInterests()
                          }}
                          disabled={status === 'paid' || status === 'delivered'}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            status === 'paid' || status === 'delivered'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-500 active:scale-95'
                          }`}
                        >
                          {status === 'paid' || status === 'delivered' ? '✓ Paid' : 'Mark Paid'}
                        </button>
                        <button
                          onClick={async () => {
                            await supabase.from('merch_interests').update({ status: 'delivered', delivered: true }).eq('id', o.id)
                            await loadInterests()
                          }}
                          disabled={status === 'delivered'}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            status === 'delivered'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-500 active:scale-95'
                          }`}
                        >
                          {status === 'delivered' ? '✓ Delivered' : 'Mark Delivered'}
                        </button>
                        <button
                          onClick={() => setCancelTarget(o)}
                          className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-400 active:scale-95 transition-all"
                        >
                          <Ban size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })
              }

              {/* Cancelled orders (collapsed) */}
              {interests.filter(o => o.status === 'cancelled' && getPlayerName(o, players)).length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-400 cursor-pointer font-medium px-1">
                    {interests.filter(o => o.status === 'cancelled' && getPlayerName(o, players)).length} cancelled order{interests.filter(o => o.status === 'cancelled' && getPlayerName(o, players)).length > 1 ? 's' : ''}
                  </summary>
                  <div className="space-y-2 mt-2">
                    {interests.filter(o => o.status === 'cancelled' && getPlayerName(o, players)).map(o => {
                      const playerName = getPlayerName(o, players)
                      const item = items.find(i => i.id === o.merch_item_id)
                      return (
                        <div key={o.id} className="card opacity-60 space-y-1">
                          <p className="text-sm text-gray-500 line-through">
                            {playerName?.split(' ')[0] || 'Unknown'} — {item?.name} {o.size && `(${o.size})`}
                          </p>
                          {o.admin_comment && <p className="text-xs text-red-400 italic">"{o.admin_comment}"</p>}
                          <p className="text-[10px] text-gray-400">{formatOrderTime(o.cancelled_at || o.created_at)}</p>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )}
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
