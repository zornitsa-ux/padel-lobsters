import { describe, expect, it, vi, beforeEach } from 'vitest'

type Result = { data?: unknown; error?: unknown }
type Call = { table: string; method: string; args: unknown[] }

// A chainable Supabase builder stub: every method records its call and returns
// the builder, and awaiting it pops the next queued response. That covers all
// the shapes the merch slice uses (select/order/eq/limit/insert/update) without
// re-mocking per test.
const h = vi.hoisted(() => {
  const calls: Call[] = []
  const queue: Result[] = []
  const uploads: { filename: string; file: unknown }[] = []
  const uploadResult: { current: Result } = { current: {} }
  return { calls, queue, uploads, uploadResult }
})

vi.mock('../../supabase', () => {
  type Builder = {
    select: (...a: unknown[]) => Builder
    order: (...a: unknown[]) => Builder
    eq: (...a: unknown[]) => Builder
    limit: (...a: unknown[]) => Builder
    insert: (...a: unknown[]) => Builder
    update: (...a: unknown[]) => Builder
    then: <T>(onfulfilled: (r: Result) => T) => Promise<T>
  }

  const makeBuilder = (table: string): Builder => {
    const record =
      (method: string) =>
      (...args: unknown[]) => {
        h.calls.push({ table, method, args })
        return builder
      }
    const builder: Builder = {
      select: record('select'),
      order: record('order'),
      eq: record('eq'),
      limit: record('limit'),
      insert: record('insert'),
      update: record('update'),
      then: (onfulfilled) =>
        Promise.resolve(h.queue.shift() ?? { data: null, error: null }).then(onfulfilled),
    }
    return builder
  }

  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      storage: {
        from: () => ({
          upload: (filename: string, file: unknown) => {
            h.uploads.push({ filename, file })
            return Promise.resolve(h.uploadResult.current)
          },
          getPublicUrl: (filename: string) => ({
            data: { publicUrl: `https://cdn.test/merch/${filename}` },
          }),
        }),
      },
    },
  }
})

import { merchInterestRowSchema, merchItemRowSchema } from './merchSchemas'
import {
  cancelMerchOrder,
  createMerchItem,
  deactivateMerchItem,
  fetchMerchInterests,
  fetchMerchItems,
  normaliseMerchInterest,
  normaliseMerchItem,
  placeMerchOrder,
  reorderMerchItems,
  setOrderStatus,
  updateMerchItem,
  uploadMerchImages,
  type MerchItemInput,
} from './merchQueries'

const itemRow = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Tech Shirt',
  price: '25.00',
  sizes: ['M'],
  image_url: '',
  image_urls: [],
  active: true,
  display_order: 0,
  external_orders: 0,
  ...over,
})

const interestRow = (over: Record<string, unknown> = {}) => ({
  id: 10,
  player_id: 'p-1',
  merch_item_id: 1,
  size: 'M',
  custom_name: null,
  status: 'ordered',
  created_at: '2026-07-01T10:00:00Z',
  ...over,
})

const input: MerchItemInput = {
  name: 'Cap',
  description: '',
  price: 15,
  sizes: [],
  image_url: '',
  image_urls: [],
  category: 'apparel',
  active: true,
  external_orders: 0,
}

// Normalisation always runs on a parsed row, so the tests parse first too —
// that is what makes `price: '25.50'` a number by the time it is normalised.
const parseItem = (over: Record<string, unknown> = {}) => merchItemRowSchema.parse(itemRow(over))
const parseInterest = (over: Record<string, unknown> = {}) =>
  merchInterestRowSchema.parse(interestRow(over))

const argsFor = (method: string) => h.calls.find((c) => c.method === method)?.args ?? []

beforeEach(() => {
  h.calls.length = 0
  h.queue.length = 0
  h.uploads.length = 0
  h.uploadResult.current = { error: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// ── normalisation ────────────────────────────────────────────────────────

describe('normaliseMerchItem', () => {
  it('coerces the numeric price the driver returns as a string', () => {
    expect(normaliseMerchItem(parseItem({ price: '25.50' })).price).toBe(25.5)
  })

  it('falls back to 0 for a null price', () => {
    expect(normaliseMerchItem(parseItem({ price: null })).price).toBe(0)
  })

  it('prefers image_urls for the image list', () => {
    const item = normaliseMerchItem(
      parseItem({ image_urls: ['a.png', 'b.png'], image_url: 'c.png' }),
    )
    expect(item.images).toEqual(['a.png', 'b.png'])
  })

  it('falls back to the single image_url when image_urls is empty', () => {
    expect(normaliseMerchItem(parseItem({ image_urls: [], image_url: 'c.png' })).images).toEqual([
      'c.png',
    ])
  })

  it('yields an empty image list when neither column is set', () => {
    expect(normaliseMerchItem(parseItem({ image_urls: null, image_url: '' })).images).toEqual([])
  })

  it('clamps external_orders to a non-negative integer', () => {
    expect(normaliseMerchItem(parseItem({ external_orders: -4 })).externalOrders).toBe(0)
    expect(normaliseMerchItem(parseItem({ external_orders: '7' })).externalOrders).toBe(7)
  })

  it('defaults sizes and active', () => {
    const item = normaliseMerchItem(parseItem({ sizes: null, active: null }))
    expect(item.sizes).toEqual([])
    expect(item.active).toBe(true)
  })
})

describe('normaliseMerchInterest', () => {
  it('defaults a missing status to ordered', () => {
    expect(normaliseMerchInterest(parseInterest({ status: null })).status).toBe('ordered')
  })

  it('rejects an unrecognised status rather than passing it through', () => {
    expect(normaliseMerchInterest(parseInterest({ status: 'weird' })).status).toBe('ordered')
  })

  it('trims custom_name', () => {
    expect(normaliseMerchInterest(parseInterest({ custom_name: '  Alex ' })).customName).toBe(
      'Alex',
    )
  })

  it('gives an order with no player an empty id rather than "null"', () => {
    expect(normaliseMerchInterest(parseInterest({ player_id: null })).playerId).toBe('')
  })
})

// ── reads ────────────────────────────────────────────────────────────────

describe('fetchMerchItems', () => {
  it('orders by display_order then id, with no fallback query', async () => {
    h.queue.push({ data: [itemRow()], error: null })
    await fetchMerchItems()
    const orders = h.calls.filter((c) => c.method === 'order').map((c) => c.args[0])
    expect(orders).toEqual(['display_order', 'id'])
    expect(h.calls.filter((c) => c.method === 'select')).toHaveLength(1)
  })

  it('throws instead of retrying when the query fails', async () => {
    const err = { message: 'permission denied' }
    h.queue.push({ data: null, error: err })
    await expect(fetchMerchItems()).rejects.toBe(err)
    // The old code swallowed this and issued a second, unordered query.
    expect(h.calls.filter((c) => c.method === 'select')).toHaveLength(1)
  })

  it('returns normalised items', async () => {
    h.queue.push({ data: [itemRow({ price: '30' })], error: null })
    const [item] = await fetchMerchItems()
    expect(item.price).toBe(30)
    expect(item.name).toBe('Tech Shirt')
  })

  it('returns an empty list for a null payload', async () => {
    h.queue.push({ data: null, error: null })
    expect(await fetchMerchItems()).toEqual([])
  })

  it('rejects a row that fails boundary validation', async () => {
    h.queue.push({ data: [{ id: 'not-a-number', name: 'x' }], error: null })
    await expect(fetchMerchItems()).rejects.toThrow()
  })
})

describe('fetchMerchInterests', () => {
  it('throws on error rather than logging and returning nothing', async () => {
    const err = { message: 'boom' }
    h.queue.push({ data: null, error: err })
    await expect(fetchMerchInterests()).rejects.toBe(err)
  })

  it('normalises the rows it returns', async () => {
    h.queue.push({ data: [interestRow({ status: null })], error: null })
    const [order] = await fetchMerchInterests()
    expect(order.status).toBe('ordered')
  })
})

// ── item writes ──────────────────────────────────────────────────────────

describe('item writes', () => {
  it('createMerchItem inserts the payload with the given display_order', async () => {
    h.queue.push({ error: null })
    await createMerchItem({ input, displayOrder: 4 })
    expect(argsFor('insert')[0]).toEqual({ ...input, display_order: 4 })
  })

  it('createMerchItem throws instead of retrying a stripped payload', async () => {
    const err = { message: 'insert failed' }
    h.queue.push({ error: err })
    await expect(createMerchItem({ input, displayOrder: 1 })).rejects.toBe(err)
    expect(h.calls.filter((c) => c.method === 'insert')).toHaveLength(1)
  })

  it('updateMerchItem targets the row by id', async () => {
    h.queue.push({ error: null })
    await updateMerchItem({ id: 3, input })
    expect(argsFor('update')[0]).toEqual(input)
    expect(argsFor('eq')).toEqual(['id', 3])
  })

  it('deactivateMerchItem soft-deletes rather than deleting the row', async () => {
    h.queue.push({ error: null })
    await deactivateMerchItem({ id: 9 })
    expect(argsFor('update')[0]).toEqual({ active: false })
    expect(h.calls.some((c) => c.method === 'delete')).toBe(false)
  })

  it('reorderMerchItems writes the array position as display_order', async () => {
    h.queue.push({ error: null }, { error: null }, { error: null })
    await reorderMerchItems({ orderedIds: [7, 3, 5] })
    const updates = h.calls.filter((c) => c.method === 'update').map((c) => c.args[0])
    const targets = h.calls.filter((c) => c.method === 'eq').map((c) => c.args[1])
    expect(updates).toEqual([{ display_order: 0 }, { display_order: 1 }, { display_order: 2 }])
    expect(targets).toEqual([7, 3, 5])
  })

  it('reorderMerchItems surfaces a partial failure', async () => {
    const err = { message: 'nope' }
    h.queue.push({ error: null }, { error: err })
    await expect(reorderMerchItems({ orderedIds: [1, 2] })).rejects.toBe(err)
  })
})

// ── image upload ─────────────────────────────────────────────────────────

describe('uploadMerchImages', () => {
  const file = (name: string) => ({ name }) as File

  it('returns a public URL per uploaded file', async () => {
    const urls = await uploadMerchImages({ files: [file('a.png'), file('b.png')] })
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('https://cdn.test/merch/')
  })

  it('replaces whitespace in the stored filename', async () => {
    await uploadMerchImages({ files: [file('my shirt.png')] })
    expect(h.uploads[0].filename).toContain('my_shirt.png')
    expect(h.uploads[0].filename).not.toContain(' ')
  })

  it('throws when the bucket rejects the upload', async () => {
    const err = { message: 'bucket missing' }
    h.uploadResult.current = { error: err }
    await expect(uploadMerchImages({ files: [file('a.png')] })).rejects.toBe(err)
  })
})

// ── order writes ─────────────────────────────────────────────────────────

describe('placeMerchOrder', () => {
  const order = { playerId: 'p-1', itemId: 1, size: 'M', customName: 'Alex' }

  it('inserts a new order when the player has none for the item', async () => {
    h.queue.push({ data: [], error: null }, { error: null })
    await placeMerchOrder(order)
    expect(argsFor('insert')[0]).toEqual({
      merch_item_id: 1,
      player_id: 'p-1',
      size: 'M',
      status: 'ordered',
      custom_name: 'Alex',
    })
  })

  it('updates only size and custom_name for an existing order', async () => {
    h.queue.push({ data: [{ id: 55 }], error: null }, { error: null })
    await placeMerchOrder(order)
    expect(argsFor('update')[0]).toEqual({ size: 'M', custom_name: 'Alex' })
    // Re-ordering must not reset a paid order back to 'ordered'.
    expect(argsFor('update')[0]).not.toHaveProperty('status')
    expect(h.calls.some((c) => c.method === 'insert')).toBe(false)
  })

  it('throws when the lookup fails instead of double-inserting', async () => {
    const err = { message: 'lookup failed' }
    h.queue.push({ data: null, error: err })
    await expect(placeMerchOrder(order)).rejects.toBe(err)
    expect(h.calls.some((c) => c.method === 'insert')).toBe(false)
  })

  it('throws instead of retrying with a stripped payload', async () => {
    const err = { message: 'insert failed' }
    h.queue.push({ data: [], error: null }, { error: err })
    await expect(placeMerchOrder(order)).rejects.toBe(err)
    expect(h.calls.filter((c) => c.method === 'insert')).toHaveLength(1)
  })
})

describe('order status writes', () => {
  it('setOrderStatus keeps the legacy boolean column in sync', async () => {
    h.queue.push({ error: null })
    await setOrderStatus({ id: 2, status: 'paid' })
    expect(argsFor('update')[0]).toEqual({ status: 'paid', paid: true })

    h.calls.length = 0
    h.queue.push({ error: null })
    await setOrderStatus({ id: 2, status: 'delivered' })
    expect(argsFor('update')[0]).toEqual({ status: 'delivered', delivered: true })
  })

  it('setOrderStatus throws on failure', async () => {
    const err = { message: 'denied' }
    h.queue.push({ error: err })
    await expect(setOrderStatus({ id: 2, status: 'paid' })).rejects.toBe(err)
  })

  it('cancelMerchOrder stamps the status, comment and time', async () => {
    h.queue.push({ error: null })
    await cancelMerchOrder({ id: 4, comment: 'out of stock' })
    const patch = argsFor('update')[0] as Record<string, unknown>
    expect(patch.status).toBe('cancelled')
    expect(patch.admin_comment).toBe('out of stock')
    expect(patch.paid).toBe(false)
    expect(patch.delivered).toBe(false)
    expect(typeof patch.cancelled_at).toBe('string')
  })

  it('cancelMerchOrder stores null for an empty comment', async () => {
    h.queue.push({ error: null })
    await cancelMerchOrder({ id: 4, comment: '' })
    expect((argsFor('update')[0] as Record<string, unknown>).admin_comment).toBeNull()
  })

  it('cancelMerchOrder throws rather than falling back to a partial update', async () => {
    const err = { message: 'denied' }
    h.queue.push({ error: err })
    await expect(cancelMerchOrder({ id: 4, comment: '' })).rejects.toBe(err)
    expect(h.calls.filter((c) => c.method === 'update')).toHaveLength(1)
  })
})
