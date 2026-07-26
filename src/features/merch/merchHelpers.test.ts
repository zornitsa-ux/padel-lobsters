import { describe, expect, it } from 'vitest'
import { errorMessage, formatOrderTime, getPlayerName, orderTimestamp } from './formatters'
import { sizeRank, SIZE_ORDER } from './sizes'
import { STATUS_CONFIG } from './statusConfig'
import { emptyItem, itemFormFrom, toItemPayload } from './itemForm'
import { ORDER_STATUSES, type MerchInterest, type MerchItem } from './merchSchemas'
import type { Player } from '../../lib/normalise'

const player = (id: string, name: string) => ({ id, name }) as Player
const order = (over: Partial<MerchInterest>): MerchInterest =>
  ({ id: 1, playerId: '', status: 'ordered', customName: '', ...over }) as MerchInterest

describe('formatOrderTime', () => {
  it('returns an empty string for a missing timestamp', () => {
    expect(formatOrderTime(null)).toBe('')
    expect(formatOrderTime(undefined)).toBe('')
  })

  it('renders day, month and time', () => {
    expect(formatOrderTime('2026-07-01T10:30:00Z')).toMatch(/1 Jul/)
  })
})

describe('orderTimestamp', () => {
  it('sorts a missing or unparseable timestamp last', () => {
    expect(orderTimestamp(null)).toBe(0)
    expect(orderTimestamp('not a date')).toBe(0)
  })

  it('parses a real timestamp', () => {
    expect(orderTimestamp('2026-07-01T10:30:00Z')).toBe(Date.parse('2026-07-01T10:30:00Z'))
  })
})

describe('getPlayerName', () => {
  const players = [player('7', 'Alex Smith')]

  it('matches ids across the text/uuid divide', () => {
    expect(getPlayerName({ order: order({ playerId: '7' }), players })).toBe('Alex Smith')
  })

  it('returns null for an order with no player', () => {
    expect(getPlayerName({ order: order({ playerId: '' }), players })).toBeNull()
    expect(getPlayerName({ order: null, players })).toBeNull()
  })

  it('returns null when the player is no longer on the roster', () => {
    expect(getPlayerName({ order: order({ playerId: '99' }), players })).toBeNull()
  })
})

describe('errorMessage', () => {
  it('reads Error instances', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('reads the message off a PostgrestError-shaped object', () => {
    expect(errorMessage({ message: 'permission denied' })).toBe('permission denied')
  })

  it('falls back for anything else', () => {
    expect(errorMessage('nope')).toBe('Unknown error')
    expect(errorMessage(null)).toBe('Unknown error')
  })
})

describe('sizeRank', () => {
  it('orders sock sizes between the apparel sizes they sit next to', () => {
    expect(sizeRank('S')).toBeLessThan(sizeRank('S (35-38)'))
    expect(sizeRank('S (35-38)')).toBeLessThan(sizeRank('M'))
  })

  it('sends unknown sizes to the end', () => {
    expect(sizeRank('mystery')).toBe(999)
    expect(sizeRank('XXL')).toBe(SIZE_ORDER.length - 1)
  })
})

describe('STATUS_CONFIG', () => {
  it('covers every order status', () => {
    ORDER_STATUSES.forEach((s) => expect(STATUS_CONFIG[s]).toBeDefined())
  })
})

describe('toItemPayload', () => {
  it('coerces the string price and offline-order count', () => {
    const payload = toItemPayload({ ...emptyItem, price: '25.5', external_orders: '3' })
    expect(payload.price).toBe(25.5)
    expect(payload.external_orders).toBe(3)
  })

  it('falls back to zero for unparseable numbers and clamps negatives', () => {
    expect(toItemPayload({ ...emptyItem, price: '' }).price).toBe(0)
    expect(toItemPayload({ ...emptyItem, external_orders: '-2' }).external_orders).toBe(0)
  })

  it('uses the first uploaded image as the main image', () => {
    const payload = toItemPayload({ ...emptyItem, image_urls: ['a.png', 'b.png'] })
    expect(payload.image_url).toBe('a.png')
    expect(payload.image_urls).toEqual(['a.png', 'b.png'])
  })

  it('keeps an existing image_url when no uploads are present', () => {
    expect(toItemPayload({ ...emptyItem, image_url: 'old.png' }).image_url).toBe('old.png')
  })

  it('always saves as active, so saving restores a removed item', () => {
    expect(toItemPayload({ ...emptyItem, active: false }).active).toBe(true)
  })

  it('defaults the category', () => {
    expect(toItemPayload({ ...emptyItem, category: '' }).category).toBe('apparel')
  })
})

describe('itemFormFrom', () => {
  const item = {
    id: 1,
    name: 'Shirt',
    description: null,
    price: 25,
    sizes: ['M'],
    images: ['a.png'],
    image_url: 'a.png',
    category: null,
    active: true,
    displayOrder: 2,
    externalOrders: 4,
  } as unknown as MerchItem

  it('round-trips an item through the form back to the same payload', () => {
    const payload = toItemPayload(itemFormFrom(item))
    expect(payload).toMatchObject({
      name: 'Shirt',
      price: 25,
      sizes: ['M'],
      image_url: 'a.png',
      image_urls: ['a.png'],
      category: 'apparel',
      external_orders: 4,
    })
  })

  it('binds the price as a string for the number input', () => {
    expect(itemFormFrom(item).price).toBe('25')
  })
})
