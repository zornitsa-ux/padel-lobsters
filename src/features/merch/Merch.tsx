import React, { useState, useEffect, type ChangeEvent, type DragEvent, type FormEvent } from 'react'
import { useApp } from '../../context/useApp'
import { usePlayers } from '../players/usePlayers'
import { useAuthPrompt } from '../../components/ui/AuthGate'
import { useConfirm } from '../../lib/confirmBus'
import { TabSwitcher } from '../../components/ui/TabSwitcher'
import { emptyItem, itemFormFrom, toItemPayload, type ItemFormState } from './itemForm'
import { errorMessage } from './formatters'
import { useMerchActions, useMerchInterests, useMerchItems } from './useMerch'
import {
  countOrders,
  countWebsiteOrders,
  ordersForPlayer,
  selectOpenOrders,
} from './merchSelectors'
import type { MerchItem } from './merchSchemas'
import Lightbox, { type LightboxState } from './Lightbox'
import Shop from './Shop'
import MyOrders from './MyOrders'
import OrdersTable from './OrdersTable'
import AdminItemManager from './AdminItemManager'
import ItemEditorForm from './ItemEditorForm'
import type { EventNavigate } from '../events/eventHelpers'

type TabId = 'shop' | 'myorders' | 'orders' | 'manage'
type ByItem<T> = Record<number, T>

type MerchProps = {
  initialTab?: string | null
  onNavigate?: EventNavigate
}

// ── Main Merch component ──────────────────────────────────────────────────────
export default function Merch({ initialTab, onNavigate }: MerchProps) {
  const confirm = useConfirm()
  const { session } = useApp()
  const { data: players = [] } = usePlayers()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null
  const [tab, setTab] = useState<TabId>((initialTab as TabId) || 'shop')
  useEffect(() => {
    if (initialTab) setTab(initialTab as TabId)
  }, [initialTab])

  // Flat reads: mount load plus the query client's global refetchOnWindowFocus.
  // The manual useRefreshOnFocus call this component used to make is redundant
  // now that both reads go through the query cache.
  const itemsQuery = useMerchItems()
  const interestsQuery = useMerchInterests()
  const items = itemsQuery.data ?? []
  const interests = interestsQuery.data ?? []
  const loadError = itemsQuery.error ?? interestsQuery.error

  const { createItem, updateItem, deactivateItem, reorderItems, uploadImages, placeOrder } =
    useMerchActions()

  // Identity is managed in Settings → Account, but for friction-free ordering
  // we also pop a PIN prompt right where the player tapped.
  const { requireAuth, AuthPromptModal } = useAuthPrompt({ onNavigate })
  const goToSignIn = () => onNavigate?.('settings')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<MerchItem | null>(null)
  const [form, setForm] = useState<ItemFormState>(emptyItem)
  const [selectedSize, setSelectedSize] = useState<ByItem<string>>({})
  const [sizeError, setSizeError] = useState<ByItem<boolean>>({})
  const [customName, setCustomName] = useState<ByItem<string>>({})
  const [ordered, setOrdered] = useState<ByItem<boolean>>({})
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  // ── Image upload (up to 3) ───────────────────────────────────────────────────
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    const slots = 3 - (form.image_urls?.length ?? 0)
    if (slots <= 0) return
    try {
      const newUrls = await uploadImages.mutateAsync({ files: files.slice(0, slots) })
      setForm((f) => ({
        ...f,
        image_urls: [...(f.image_urls ?? []), ...newUrls],
        image_url: f.image_url || newUrls[0] || '',
      }))
    } catch (err) {
      alert(
        'Image upload failed: ' +
          errorMessage(err) +
          '\n\nMake sure a public "merch" storage bucket exists in Supabase with upload policies enabled.',
      )
    } finally {
      input.value = ''
    }
  }

  const handleRemoveImage = (idx: number) => {
    setForm((f) => {
      const next = (f.image_urls ?? []).filter((_, i) => i !== idx)
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

  const openEdit = (item: MerchItem) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    setForm(itemFormFrom(item))
    setEditItem(item)
    setShowForm(true)
  }

  const handleSaveItem = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const input = toItemPayload(form)
    try {
      if (editItem) {
        await updateItem.mutateAsync({ id: editItem.id, input })
      } else {
        // New items go to the end of the list
        const maxOrder = items.reduce((max, i) => Math.max(max, i.displayOrder), 0)
        await createItem.mutateAsync({ input, displayOrder: maxOrder + 1 })
      }
      setShowForm(false)
    } catch (err) {
      alert('Could not save the item: ' + errorMessage(err))
    }
  }

  const handleDeleteItem = async (id: number) => {
    if (!(await confirm({ message: 'Remove this item?', destructive: true }))) return
    try {
      await deactivateItem.mutateAsync({ id })
    } catch (err) {
      alert('Could not remove the item: ' + errorMessage(err))
    }
  }

  // ── Drag-and-drop reorder (admin) ───────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const handleDragStart = (idx: number) => (e: DragEvent<HTMLDivElement>) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (idx: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== overIdx) setOverIdx(idx)
  }

  const handleDrop = (idx: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const from = dragIdx
    setDragIdx(null)
    setOverIdx(null)
    if (from === null || from === idx) return
    const reordered = [...items]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(idx, 0, moved)
    // The cache is updated optimistically inside the mutation, so no local copy
    // of the list is needed to keep the drag from snapping back.
    reorderItems.mutate(
      { orderedIds: reordered.map((item) => item.id) },
      { onError: (err) => alert('Could not save the new order: ' + errorMessage(err)) },
    )
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setOverIdx(null)
  }

  const toggleSize = (size: string) => {
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter((s) => s !== size) : [...f.sizes, size],
    }))
  }

  // ── Orders ───────────────────────────────────────────────────────────────────
  const websiteOrderCount = (itemId: number) => countWebsiteOrders({ interests, itemId })
  const orderCount = (itemId: number) => countOrders({ interests, items, itemId })

  const submitOrder = async (itemId: number) => {
    // If the player isn't signed in yet, pop the inline PIN prompt and
    // re-run the order on success — no navigation away from the shop.
    if (!claimedId) {
      requireAuth('player', () => submitOrder(itemId), {
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
    if (item && item.sizes.length > 0 && !size) {
      setSizeError((e) => ({ ...e, [itemId]: true }))
      return
    }
    setSizeError((e) => ({ ...e, [itemId]: false }))

    try {
      await placeOrder.mutateAsync({
        // Stored as text to handle both UUID and integer ids
        playerId: String(claimedPlayer.id),
        itemId,
        size,
        customName: name,
      })
    } catch (err) {
      alert('Order failed: ' + errorMessage(err))
      return
    }
    setOrdered((o) => ({ ...o, [itemId]: true }))
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const myPlayer = claimedId ? players.find((p) => String(p.id) === String(claimedId)) : null
  const myOrders = ordersForPlayer({ interests, playerId: myPlayer?.id })
  const activeOrders = selectOpenOrders(interests)

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

      <h2 className="text-lg font-bold text-lob-dark">Padel Lobsters Merch</h2>

      {/* A failed read is surfaced rather than rendered as an empty shop. */}
      {loadError && (
        <p className="text-sm text-red-500">
          Could not load the shop: {errorMessage(loadError)}. Try again shortly.
        </p>
      )}

      {/* Tab bar */}
      <TabSwitcher tabs={TABS} value={tab} onChange={(id) => setTab(id as TabId)} />

      {/* ── SHOP TAB ── */}
      {tab === 'shop' && (
        <Shop
          items={items}
          loading={itemsQuery.isPending}
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
          placeOrder={submitOrder}
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
          saving={createItem.isPending || updateItem.isPending}
          uploading={uploadImages.isPending}
          handleSaveItem={handleSaveItem}
          handleImageUpload={handleImageUpload}
          handleRemoveImage={handleRemoveImage}
          toggleSize={toggleSize}
        />
      )}
    </div>
  )
}
