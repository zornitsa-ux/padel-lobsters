import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { Plus, X, Pencil, ShoppingBag, Gift, Shuffle, Upload, Check, Star } from 'lucide-react'
import AdminLogin from './AdminLogin'

const SIZES_APPAREL  = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const SIZES_SOCKS    = ['S (35-38)', 'M (39-42)', 'L (43-46)']

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

// ── Main Merch component ──────────────────────────────────────────────────────
export default function Merch({ tournament, tournaments: allTournaments = [] }) {
  const { players, registrations, isAdmin, players: allPlayers, tournaments: contextTournaments = [] } = useApp()
  const tournaments = allTournaments.length > 0 ? allTournaments : contextTournaments
  const [tab, setTab]             = useState('shop')     // 'shop' | 'prizes' | 'manage'
  const [items, setItems]         = useState([])
  const [interests, setInterests] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showLogin, setShowLogin] = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [form, setForm]           = useState(emptyItem)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedInterest, setSelectedInterest] = useState({}) // itemId -> size
  const [expressed, setExpressed] = useState({}) // itemId -> true (this session)
  const [selectedTournament, setSelectedTournament] = useState(tournament?.id != null ? String(tournament.id) : null) // prize tab: selected tournament

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadItems = async () => {
    const { data } = await supabase.from('merch_items').select('*').eq('active', true).order('id')
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
        const { error: uploadError } = await supabase.storage.from('merch').upload(filename, file)
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
      alert('Image upload failed: ' + err.message)
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
      await supabase.from('merch_items').insert(payload)
    }
    await loadItems()
    setShowForm(false); setSaving(false)
  }

  const handleDeleteItem = async (id) => {
    if (!confirm('Remove this item?')) return
    await supabase.from('merch_items').update({ active: false }).eq('id', id)
    await loadItems()
  }

  const toggleSize = (size) => {
    setForm(f => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter(s => s !== size) : [...f.sizes, size]
    }))
  }

  // ── Player interest ──────────────────────────────────────────────────────────
  const interestCount = (itemId) => interests.filter(i => i.merch_item_id === itemId).length

  const expressInterest = async (itemId) => {
    const size = selectedInterest[itemId] || ''
    // Use a temp player ID approach — for demo we just insert without player_id
    // In production link to the logged-in player
    try {
      await supabase.from('merch_interests').upsert({
        merch_item_id: itemId,
        size,
        player_id: null, // would be set from auth in production
      }, { onConflict: 'player_id,merch_item_id', ignoreDuplicates: true })
      setExpressed(e => ({ ...e, [itemId]: true }))
      await loadInterests()
    } catch { /* silent */ }
    setExpressed(e => ({ ...e, [itemId]: true }))
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'shop', label: '🛍️ Shop' },
    { id: 'prizes', label: '🎁 Prizes' },
    ...(isAdmin ? [{ id: 'manage', label: '⚙️ Manage' }] : []),
  ]

  return (
    <div className="space-y-4">
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}

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
          <p className="text-xs text-gray-500">Tap "I want this!" on anything you're interested in — we'll know what's popular for future orders.</p>

          {loading && <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>}

          {items.map(item => (
            <div key={item.id} className="card space-y-3">
              {/* Image */}
              {item.image_url ? (
                <img src={item.image_url} alt={item.name}
                  className="w-full h-40 object-cover rounded-xl" />
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
                  <p className="text-xs text-gray-500 mb-1.5">Select size:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.sizes.map(s => (
                      <button key={s} onClick={() => setSelectedInterest(si => ({ ...si, [item.id]: s }))}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${
                          selectedInterest[item.id] === s
                            ? 'bg-lobster-teal text-white border-lobster-teal'
                            : 'border-gray-200 text-gray-600'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Interest button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => expressInterest(item.id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                    expressed[item.id]
                      ? 'bg-green-100 text-green-700'
                      : 'bg-lobster-teal text-white'
                  }`}
                >
                  {expressed[item.id] ? <><Check size={15} /> Registered interest!</> : <><Star size={15} /> I want this!</>}
                </button>
                {interestCount(item.id) > 0 && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {interestCount(item.id)} interested
                  </span>
                )}
              </div>
            </div>
          ))}

          {!loading && items.length === 0 && (
            <div className="card py-10 text-center text-gray-400">
              <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
              <p>No merch items yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── PRIZES TAB ── */}
      {tab === 'prizes' && (
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

      {/* ── MANAGE TAB (admin only) ── */}
      {tab === 'manage' && isAdmin && (
        <div className="space-y-4">
          <button onClick={openAdd} className="btn-primary w-full flex items-center justify-center gap-2">
            <Plus size={16} /> Add Merch Item
          </button>

          {/* Interest summary */}
          {interests.length > 0 && (
            <div className="card">
              <p className="font-semibold text-gray-700 text-sm mb-2">Interest Summary</p>
              {items.map(item => {
                const itemInterests = interests.filter(i => i.merch_item_id === item.id)
                if (itemInterests.length === 0) return null
                const bySizeRaw = {}
                itemInterests.forEach(i => {
                  const k = i.size || 'No size'
                  bySizeRaw[k] = (bySizeRaw[k] || 0) + 1
                })
                return (
                  <div key={item.id} className="mb-3">
                    <p className="text-sm font-medium text-gray-700">{item.name} <span className="text-lobster-teal">({itemInterests.length})</span></p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(bySizeRaw).map(([size, count]) => (
                        <span key={size} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {size}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Item list */}
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="card flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                  {item.image_url
                    ? <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                    : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={18} className="text-gray-400" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">€{parseFloat(item.price).toFixed(0)} · {interestCount(item.id)} interested</p>
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
