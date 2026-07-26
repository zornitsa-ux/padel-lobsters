import type { MerchInterest, MerchItem } from './merchSchemas'

export const selectActiveItems = (items: MerchItem[]): MerchItem[] => items.filter((i) => i.active)

// Orders that still count: cancelled ones are excluded from the admin list and
// from the "X lobsters already ordered" badge.
export const selectOpenOrders = (interests: MerchInterest[]): MerchInterest[] =>
  interests.filter((o) => o.status !== 'cancelled')

export const ordersForPlayer = ({
  interests,
  playerId,
}: {
  interests: MerchInterest[]
  playerId: string | null | undefined
}): MerchInterest[] =>
  playerId == null ? [] : interests.filter((o) => o.playerId === String(playerId))

export const countWebsiteOrders = ({
  interests,
  itemId,
}: {
  interests: MerchInterest[]
  itemId: number
}): number => interests.filter((o) => o.merch_item_id === itemId && o.status !== 'cancelled').length

// The player-facing counter combines live website orders with the
// `external_orders` an admin recorded manually (offline / WhatsApp sales).
export const countOrders = ({
  interests,
  items,
  itemId,
}: {
  interests: MerchInterest[]
  items: MerchItem[]
  itemId: number
}): number => {
  const external = items.find((i) => i.id === itemId)?.externalOrders ?? 0
  return countWebsiteOrders({ interests, itemId }) + external
}

// Optimistic reorder applied to the cached list: ids present in `orderedIds`
// take their array position as display_order, everything else keeps the order
// it had. Mirrors what reorderMerchItems writes so the drag doesn't snap back
// while the refetch is in flight.
export const applyOrder = ({
  items,
  orderedIds,
}: {
  items: MerchItem[]
  orderedIds: number[]
}): MerchItem[] => {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  return items
    .map((item) => {
      const next = rank.get(item.id)
      return next === undefined ? item : { ...item, displayOrder: next, display_order: next }
    })
    .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id)
}
