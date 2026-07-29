import { describe, expect, it } from 'vitest'
import {
  applyOrder,
  countOrders,
  countWebsiteOrders,
  ordersForPlayer,
  selectActiveItems,
  selectOpenOrders,
} from './merchSelectors'
import type { MerchInterest, MerchItem } from './merchSchemas'

const item = (over: Partial<MerchItem>): MerchItem =>
  ({
    id: 1,
    name: 'Shirt',
    price: 25,
    sizes: [],
    images: [],
    active: true,
    displayOrder: 0,
    externalOrders: 0,
    ...over,
  }) as MerchItem

const order = (over: Partial<MerchInterest>): MerchInterest =>
  ({
    id: 1,
    merch_item_id: 1,
    playerId: 'p-1',
    status: 'ordered',
    customName: '',
    ...over,
  }) as MerchInterest

describe('selectActiveItems', () => {
  it('drops soft-deleted items', () => {
    const items = [item({ id: 1 }), item({ id: 2, active: false })]
    expect(selectActiveItems(items).map((i) => i.id)).toEqual([1])
  })

  it('does not mutate the input', () => {
    const items = [item({ id: 1 }), item({ id: 2, active: false })]
    selectActiveItems(items)
    expect(items).toHaveLength(2)
  })
})

describe('selectOpenOrders', () => {
  it('excludes cancelled orders', () => {
    const orders = [order({ id: 1 }), order({ id: 2, status: 'cancelled' }), order({ id: 3 })]
    expect(selectOpenOrders(orders).map((o) => o.id)).toEqual([1, 3])
  })

  it('keeps paid and delivered orders', () => {
    const orders = [order({ id: 1, status: 'paid' }), order({ id: 2, status: 'delivered' })]
    expect(selectOpenOrders(orders)).toHaveLength(2)
  })
})

describe('ordersForPlayer', () => {
  const orders = [order({ id: 1, playerId: '7' }), order({ id: 2, playerId: '8' })]

  it('matches on the string form of the id', () => {
    expect(ordersForPlayer({ interests: orders, playerId: 7 as unknown as string })).toHaveLength(1)
  })

  it('returns nothing when no player is signed in', () => {
    expect(ordersForPlayer({ interests: orders, playerId: null })).toEqual([])
  })
})

describe('order counts', () => {
  const interests = [
    order({ id: 1, merch_item_id: 1 }),
    order({ id: 2, merch_item_id: 1, status: 'paid' }),
    order({ id: 3, merch_item_id: 1, status: 'cancelled' }),
    order({ id: 4, merch_item_id: 2 }),
  ]

  it('countWebsiteOrders excludes cancelled orders and other items', () => {
    expect(countWebsiteOrders({ interests, itemId: 1 })).toBe(2)
  })

  it('countOrders adds the offline orders recorded on the item', () => {
    const items = [item({ id: 1, externalOrders: 5 })]
    expect(countOrders({ interests, items, itemId: 1 })).toBe(7)
  })

  it('countOrders tolerates an unknown item', () => {
    expect(countOrders({ interests, items: [], itemId: 1 })).toBe(2)
  })
})

describe('applyOrder', () => {
  const items = [
    item({ id: 1, displayOrder: 0 }),
    item({ id: 2, displayOrder: 1, active: false }),
    item({ id: 3, displayOrder: 2 }),
  ]

  it('reassigns display_order from the array position', () => {
    const next = applyOrder({ items, orderedIds: [3, 1] })
    expect(next.map((i) => i.id)).toEqual([3, 1, 2])
    expect(next[0].displayOrder).toBe(0)
    expect(next[0].display_order).toBe(0)
    expect(next[1].displayOrder).toBe(1)
  })

  it('leaves unlisted items untouched', () => {
    const next = applyOrder({ items, orderedIds: [3, 1] })
    expect(next.find((i) => i.id === 2)?.displayOrder).toBe(1)
  })

  it('does not mutate the input', () => {
    applyOrder({ items, orderedIds: [3, 1] })
    expect(items.map((i) => i.id)).toEqual([1, 2, 3])
    expect(items[0].displayOrder).toBe(0)
  })
})
