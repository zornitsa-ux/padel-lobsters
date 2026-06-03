import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { usePlayers } from '../players/usePlayers'
import { supabase } from '../../supabase'
import useRefreshOnFocus from '../../hooks/useRefreshOnFocus'
import { useAuthPrompt } from '../../components/ui/AuthGate'
import { emptyItem } from './itemForm'
import Lightbox from './Lightbox'
import Shop from './Shop'
import MyOrders from './MyOrders'
import OrdersTable from './OrdersTable'
import AdminItemManager from './AdminItemManager'
import ItemEditorForm from './ItemEditorForm'

// ── Main Merch component ──────────────────────────────────────────────────────
export default function Merch({ initialTab, onNavigate }) {
  const { session } = useApp()
  const { data: players = [] } = usePlayers()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null
  const [tab, setTab] = useState(initialTab || 'shop')
  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])
  const [items, setItems] = useState([])
  const [interests, setInterests] = useState([])
  const [loading, setLoading] = useState(true)
  // Identity is managed in Settings → Account, but for friction-free ordering
  // we also pop a PIN prompt right where the player tapped.
  const { requireAuth, AuthPromptModal } = useAuthPrompt({ onNavigate })
  const goToSignIn = () => onNavigate?.('settings')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyItem)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedSize, setSelectedSize] = useState({}) // itemId -> size
  const [sizeError, setSizeError] = useState({}) // itemId -> true (missing size)
  const [customName, setCustomName] = useState({}) // itemId -> name string
  const [ordered, setOrdered] = useState({}) // itemId -> true (this session)
  const [lightbox, setLightbox] = useState(null) // { images, index }

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadItems = async () => {
    // Try ordering by display_order first; fall back to id if column doesn't exist yet
    let { data, error } = await supabase
      .from('merch_items')
      .select('*')
      .eq('active', true)
      .order('display_order')
      .order('id')
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
    if (data) setInterests(data)
  }

  // Flat reads (tournament IO refactor): load on mount, refresh on tab focus.
  // Own writes (order/save) reload locally where they happen.
  useEffect(() => {
    loadItems()
    loadInterests()
  }, [])

  useRefreshOnFocus(() => {
    loadItems()
    loadInterests()
  })

  // ── Image upload (up to 3) ───────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const current = form.image_urls || []
    const slots = 3 - current.length
    if (slots <= 0) return
    const toUpload = files.slice(0, slots)
    setUploading(true)
    try {
      const newUrls = []
      for (const file of toUpload) {
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/\s/g, '_')}`
        const { error: uploadError } = await supabase.storage
          .from('merch')
          .upload(filename, file, { upsert: true })
        if (uploadError) throw uploadError
        const {
          data: { publicUrl },
        } = supabase.storage.from('merch').getPublicUrl(filename)
        newUrls.push(publicUrl)
      }
      setForm((f) => ({
        ...f,
        image_urls: [...(f.image_urls || []), ...newUrls],
        image_url: f.image_url || newUrls[0] || '',
      }))
    } catch (err) {
      alert(
        'Image upload failed: ' +
          err.message +
          '\n\nMake sure a public "merch" storage bucket exists in Supabase with upload policies enabled.',
      )
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = (idx) => {
    setForm((f) => {
      const next = (f.image_urls || []).filter((_, i) => i !== idx)
      return { ...f, image_urls: next, image_url: next[0] || '' }
    })
  }

  // ── Admin CRUD ───────────────────────────────────────────────────────────────
  const openAdd = () => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    setForm(emptyItem)
    setEditItem(null)
    setShowForm(true)
  }

  const openEdit = (item) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    const urls = item.image_urls?.length ? item.image_urls : item.image_url ? [item.image_url] : []
    setForm({
      ...item,
      price: String(item.price),
      sizes: item.sizes || [],
      image_urls: urls,
      external_orders: parseInt(item.external_orders) || 0,
    })
    setEditItem(item)
    setShowForm(true)
  }

  const handleSaveItem = async (e) => {
    e.preventDefault()
    setSaving(true)
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
      external_orders: Math.max(0, parseInt(form.external_orders) || 0),
    }
    if (editItem) {
      // Graceful fallback: if the external_orders column doesn't exist yet
      // (e.g. v15 migration not run), retry without it so admin can still
      // edit the rest of the item.
      let res = await supabase.from('merch_items').update(payload).eq('id', editItem.id)
      if (res.error) {
        const { external_orders: _drop, ...rest } = payload
        await supabase.from('merch_items').update(rest).eq('id', editItem.id)
      }
    } else {
      // New items go to the end of the list
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.display_order || 0)) : 0
      let res = await supabase
        .from('merch_items')
        .insert({ ...payload, display_order: maxOrder + 1 })
      if (res.error) {
        const { external_orders: _drop, ...rest } = payload
        res = await supabase.from('merch_items').insert({ ...rest, display_order: maxOrder + 1 })
      }
      if (res.error) await supabase.from('merch_items').insert(payload)
    }
    await loadItems()
    setShowForm(false)
    setSaving(false)
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
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null)
      setOverIdx(null)
      return
    }
    const reordered = [...items]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    setItems(reordered)
    setDragIdx(null)
    setOverIdx(null)
    // Persist new order to DB
    const updates = reordered.map((item, i) =>
      supabase.from('merch_items').update({ display_order: i }).eq('id', item.id),
    )
    await Promise.all(updates)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setOverIdx(null)
  }

  const toggleSize = (size) => {
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter((s) => s !== size) : [...f.sizes, size],
    }))
  }

  // ── Orders ───────────────────────────────────────────────────────────────────
  // The counter combines live website orders (minus cancelled) with any
  // `external_orders` the admin recorded manually on the item — so players
  // see the real total (including offline/WhatsApp purchases). Cancelled
  // orders are excluded from the FOMO count.
  const websiteOrderCount = (itemId) =>
    interests.filter((i) => i.merch_item_id === itemId && (i.status || 'ordered') !== 'cancelled')
      .length
  const orderCount = (itemId) => {
    const item = items.find((i) => i.id === itemId)
    const external = parseInt(item?.external_orders) || 0
    return websiteOrderCount(itemId) + external
  }

  const placeOrder = async (itemId) => {
    // If the player isn't signed in yet, pop the inline PIN prompt and
    // re-run the order on success — no navigation away from the shop.
    if (!claimedId) {
      requireAuth('player', () => placeOrder(itemId), {
        subtitle: 'Enter your PIN to place this order.',
      })
      return
    }

    // Verify the claimed identity still maps to a real player.
    const claimedPlayer = players.find((p) => String(p.id) === String(claimedId))
    if (!claimedPlayer) {
      alert('Your session looks stale — please sign in again from Settings → Account.')
      goToSignIn()
      return
    }

    const item = items.find((i) => i.id === itemId)
    const size = selectedSize[itemId] || ''
    const name = (customName[itemId] || '').trim()

    // Require size if item has sizes
    if (item?.sizes?.length > 0 && !size) {
      setSizeError((e) => ({ ...e, [itemId]: true }))
      return
    }
    setSizeError((e) => ({ ...e, [itemId]: false }))

    const pid = String(claimedPlayer.id) // Store as text to handle both UUID and integer IDs

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
      res = await supabase
        .from('merch_interests')
        .update({ size, custom_name: name || '' })
        .eq('id', existing[0].id)
      if (res.error) {
        res = await supabase.from('merch_interests').update({ size }).eq('id', existing[0].id)
      }
    } else {
      // Insert new order — try with all fields, then progressively strip optional columns
      const base = { merch_item_id: itemId, size, player_id: pid }
      res = await supabase
        .from('merch_interests')
        .insert({ ...base, status: 'ordered', custom_name: name || '' })
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

    setOrdered((o) => ({ ...o, [itemId]: true }))
    await loadInterests()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  // Match orders to current player — try both string and number comparison
  const myPlayer = claimedId ? players.find((p) => String(p.id) === String(claimedId)) : null
  const myOrders = myPlayer
    ? interests.filter(
        (o) => o.player_id === myPlayer.id || String(o.player_id) === String(myPlayer.id),
      )
    : []
  const activeOrders = interests.filter((o) => (o.status || 'ordered') !== 'cancelled')

  const TABS = [
    { id: 'shop', label: '🛍️ Shop' },
    ...(!isAdmin && myPlayer
      ? [
          {
            id: 'myorders',
            label: `📦 My Orders${myOrders.length > 0 ? ` (${myOrders.length})` : ''}`,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: 'orders',
            label: `📋 Orders${activeOrders.length > 0 ? ` (${activeOrders.length})` : ''}`,
          },
        ]
      : []),
    ...(isAdmin ? [{ id: 'manage', label: '⚙️ Manage' }] : []),
  ]

  return (
    <div className="space-y-4">
      <AuthPromptModal />
      {/* Identity is now handled entirely in Settings → Account. */}

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
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === t.id ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SHOP TAB ── */}
      {tab === 'shop' && (
        <Shop
          items={items}
          loading={loading}
          isAdmin={isAdmin}
          claimedId={claimedId}
          onNavigate={onNavigate}
          selectedSize={selectedSize}
          setSelectedSize={setSelectedSize}
          sizeError={sizeError}
          setSizeError={setSizeError}
          customName={customName}
          setCustomName={setCustomName}
          ordered={ordered}
          placeOrder={placeOrder}
          orderCount={orderCount}
          websiteOrderCount={websiteOrderCount}
          setLightbox={setLightbox}
        />
      )}

      {/* ── MY ORDERS TAB (player) ── */}
      {tab === 'myorders' && !isAdmin && claimedId && (
        <MyOrders myOrders={myOrders} items={items} />
      )}

      {/* ── ORDERS TAB (admin only) ── */}
      {tab === 'orders' && isAdmin && (
        <OrdersTable
          activeOrders={activeOrders}
          interests={interests}
          items={items}
          players={players}
          loadInterests={loadInterests}
        />
      )}

      {/* ── MANAGE TAB (admin only) ── */}
      {tab === 'manage' && isAdmin && (
        <AdminItemManager
          items={items}
          openAdd={openAdd}
          openEdit={openEdit}
          handleDeleteItem={handleDeleteItem}
          orderCount={orderCount}
          dragIdx={dragIdx}
          overIdx={overIdx}
          handleDragStart={handleDragStart}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          handleDragEnd={handleDragEnd}
        />
      )}

      {/* ── ADD / EDIT form modal ── */}
      {isAdmin && (
        <ItemEditorForm
          showForm={showForm}
          setShowForm={setShowForm}
          editItem={editItem}
          form={form}
          setForm={setForm}
          saving={saving}
          uploading={uploading}
          handleSaveItem={handleSaveItem}
          handleImageUpload={handleImageUpload}
          handleRemoveImage={handleRemoveImage}
          toggleSize={toggleSize}
        />
      )}
    </div>
  )
}
