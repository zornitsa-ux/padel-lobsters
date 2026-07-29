import { z } from 'zod'
import { supabase } from '../../supabase'
import {
  merchInterestRowSchema,
  merchItemRowSchema,
  ORDER_STATUSES,
  type MerchInterest,
  type MerchInterestRow,
  type MerchItem,
  type MerchItemRow,
  type OrderStatus,
} from './merchSchemas'

const isOrderStatus = (value: unknown): value is OrderStatus =>
  ORDER_STATUSES.includes(value as OrderStatus)

export function normaliseMerchItem(row: MerchItemRow): MerchItem {
  const images = row.image_urls?.length ? row.image_urls : row.image_url ? [row.image_url] : []
  return {
    ...row,
    price: Number(row.price) || 0,
    sizes: row.sizes ?? [],
    images,
    active: row.active ?? true,
    displayOrder: Math.trunc(Number(row.display_order) || 0),
    externalOrders: Math.max(0, Math.trunc(Number(row.external_orders) || 0)),
  }
}

export function normaliseMerchInterest(row: MerchInterestRow): MerchInterest {
  return {
    ...row,
    status: isOrderStatus(row.status) ? row.status : 'ordered',
    customName: (row.custom_name ?? '').trim(),
    playerId: String(row.player_id ?? ''),
  }
}

// ── Reads ────────────────────────────────────────────────────────────────
// Every item is fetched, active and inactive alike (RLS allows it —
// merch_items_read_all). Consumers that only want the live catalogue filter the
// cached list rather than issuing a second, differently-keyed request.
//
// Note there is no `.order('id')` fallback for a missing display_order column:
// display_order has existed since the first migration (init.sql:136), so the
// old retry branch was dead code that turned any real error — permission
// denied, network failure — into a silently unordered list.
export async function fetchMerchItems(): Promise<MerchItem[]> {
  const { data, error } = await supabase
    .from('merch_items')
    .select('*')
    .order('display_order')
    .order('id')
  if (error) throw error
  return z
    .array(merchItemRowSchema)
    .parse(data ?? [])
    .map(normaliseMerchItem)
}

export async function fetchMerchInterests(): Promise<MerchInterest[]> {
  const { data, error } = await supabase.from('merch_interests').select('*')
  if (error) throw error
  return z
    .array(merchInterestRowSchema)
    .parse(data ?? [])
    .map(normaliseMerchInterest)
}

// ── Item writes (admin) ──────────────────────────────────────────────────
export type MerchItemInput = {
  name: string
  description: string
  price: number
  sizes: string[]
  image_url: string
  image_urls: string[]
  category: string
  active: boolean
  external_orders: number
}

export async function createMerchItem({
  input,
  displayOrder,
}: {
  input: MerchItemInput
  displayOrder: number
}): Promise<void> {
  const { error } = await supabase.from('merch_items').insert({
    ...input,
    display_order: displayOrder,
  })
  if (error) throw error
}

export async function updateMerchItem({
  id,
  input,
}: {
  id: number
  input: MerchItemInput
}): Promise<void> {
  const { error } = await supabase.from('merch_items').update(input).eq('id', id)
  if (error) throw error
}

// Soft delete — the row stays so historic orders keep resolving an item name.
export async function deactivateMerchItem({ id }: { id: number }): Promise<void> {
  const { error } = await supabase.from('merch_items').update({ active: false }).eq('id', id)
  if (error) throw error
}

// display_order is rewritten from the array position, so the caller passes the
// ids in their new order. One failed update leaves the list half-reordered, so
// the error propagates and the query invalidation re-reads the true order.
export async function reorderMerchItems({ orderedIds }: { orderedIds: number[] }): Promise<void> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('merch_items').update({ display_order: index }).eq('id', id),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

// ── Image upload ─────────────────────────────────────────────────────────
export async function uploadMerchImages({ files }: { files: File[] }): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const suffix = file.name.replace(/\s/g, '_')
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${suffix}`
    const { error } = await supabase.storage.from('merch').upload(filename, file, { upsert: true })
    if (error) throw error
    const {
      data: { publicUrl },
    } = supabase.storage.from('merch').getPublicUrl(filename)
    urls.push(publicUrl)
  }
  return urls
}

// ── Order writes ─────────────────────────────────────────────────────────
// merch_interests has a unique (player_id, merch_item_id) constraint, so a
// repeat order is an edit of the existing row. Only size and custom_name are
// touched on that path — re-ordering must not reset a paid order to 'ordered'.
export async function placeMerchOrder({
  playerId,
  itemId,
  size,
  customName,
}: {
  playerId: string
  itemId: number
  size: string
  customName: string
}): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from('merch_interests')
    .select('id')
    .eq('player_id', playerId)
    .eq('merch_item_id', itemId)
    .limit(1)
  if (lookupError) throw lookupError

  const row = existing?.[0]
  if (row) {
    const { error } = await supabase
      .from('merch_interests')
      .update({ size, custom_name: customName })
      .eq('id', row.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('merch_interests').insert({
    merch_item_id: itemId,
    player_id: playerId,
    size,
    status: 'ordered',
    custom_name: customName,
  })
  if (error) throw error
}

// The boolean paid/delivered columns predate `status` and are still written so
// any consumer reading them stays consistent with the status field.
export async function setOrderStatus({
  id,
  status,
}: {
  id: number
  status: 'paid' | 'delivered'
}): Promise<void> {
  const patch = status === 'paid' ? { status, paid: true } : { status, delivered: true }
  const { error } = await supabase.from('merch_interests').update(patch).eq('id', id)
  if (error) throw error
}

export async function cancelMerchOrder({
  id,
  comment,
}: {
  id: number
  comment: string
}): Promise<void> {
  const { error } = await supabase
    .from('merch_interests')
    .update({
      status: 'cancelled',
      admin_comment: comment || null,
      cancelled_at: new Date().toISOString(),
      paid: false,
      delivered: false,
    })
    .eq('id', id)
  if (error) throw error
}
