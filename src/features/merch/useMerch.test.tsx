// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderHookWithClient } from '../../test/renderWithClient'
import { merchKeys } from './merchKeys'
import type { MerchInterest, MerchItem } from './merchSchemas'

const h = vi.hoisted(() => ({
  fetchMerchItems: vi.fn(),
  fetchMerchInterests: vi.fn(),
  createMerchItem: vi.fn(),
  updateMerchItem: vi.fn(),
  deactivateMerchItem: vi.fn(),
  reorderMerchItems: vi.fn(),
  uploadMerchImages: vi.fn(),
  placeMerchOrder: vi.fn(),
  setOrderStatus: vi.fn(),
  cancelMerchOrder: vi.fn(),
}))

vi.mock('./merchQueries', () => h)

import { useMerchActions, useMerchInterests, useMerchItems } from './useMerch'

const item = (over: Partial<MerchItem> = {}): MerchItem =>
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

const ITEMS = [
  item({ id: 1, name: 'Shirt', displayOrder: 0 }),
  item({ id: 2, name: 'Retired cap', active: false, displayOrder: 1 }),
  item({ id: 3, name: 'Socks', displayOrder: 2 }),
]

beforeEach(() => {
  vi.clearAllMocks()
  h.fetchMerchItems.mockResolvedValue(ITEMS)
  h.fetchMerchInterests.mockResolvedValue([] as MerchInterest[])
  h.deactivateMerchItem.mockResolvedValue(undefined)
  h.placeMerchOrder.mockResolvedValue(undefined)
  h.reorderMerchItems.mockResolvedValue(undefined)
})

describe('useMerchItems', () => {
  it('returns only active items by default', async () => {
    const { result } = renderHookWithClient(() => useMerchItems())
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.map((i) => i.id)).toEqual([1, 3])
  })

  it('returns every item when activeOnly is false', async () => {
    const { result } = renderHookWithClient(() => useMerchItems({ activeOnly: false }))
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.map((i) => i.id)).toEqual([1, 2, 3])
  })

  it('caches the full list under one key regardless of the filter', async () => {
    const { result, client } = renderHookWithClient(() => useMerchItems())
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(client.getQueryData<MerchItem[]>(merchKeys.items())?.map((i) => i.id)).toEqual([1, 2, 3])
  })

  it('surfaces a failed read as an error rather than an empty shop', async () => {
    const err = new Error('permission denied')
    h.fetchMerchItems.mockRejectedValue(err)
    const { result } = renderHookWithClient(() => useMerchItems())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
    expect(result.current.data).toBeUndefined()
  })
})

describe('useMerchInterests', () => {
  it('reads through the interests key', async () => {
    const orders = [{ id: 1, status: 'ordered' }] as unknown as MerchInterest[]
    h.fetchMerchInterests.mockResolvedValue(orders)
    const { result, client } = renderHookWithClient(() => useMerchInterests())
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(client.getQueryData(merchKeys.interests())).toBe(orders)
  })
})

describe('useMerchActions invalidation', () => {
  it('refetches items after an item write', async () => {
    const { result } = renderHookWithClient(() => ({
      items: useMerchItems(),
      actions: useMerchActions(),
    }))
    await waitFor(() => expect(h.fetchMerchItems).toHaveBeenCalledTimes(1))

    await result.current.actions.deactivateItem.mutateAsync({ id: 1 })

    await waitFor(() => expect(h.fetchMerchItems).toHaveBeenCalledTimes(2))
  })

  it('refetches interests after an order is placed', async () => {
    const { result } = renderHookWithClient(() => ({
      interests: useMerchInterests(),
      actions: useMerchActions(),
    }))
    await waitFor(() => expect(h.fetchMerchInterests).toHaveBeenCalledTimes(1))

    await result.current.actions.placeOrder.mutateAsync({
      playerId: 'p-1',
      itemId: 1,
      size: 'M',
      customName: '',
    })

    await waitFor(() => expect(h.fetchMerchInterests).toHaveBeenCalledTimes(2))
  })

  it('does not touch the items cache when only interests changed', async () => {
    const { result } = renderHookWithClient(() => ({
      items: useMerchItems(),
      interests: useMerchInterests(),
      actions: useMerchActions(),
    }))
    await waitFor(() => expect(h.fetchMerchItems).toHaveBeenCalledTimes(1))

    await result.current.actions.placeOrder.mutateAsync({
      playerId: 'p-1',
      itemId: 1,
      size: '',
      customName: '',
    })
    await waitFor(() => expect(h.fetchMerchInterests).toHaveBeenCalledTimes(2))

    expect(h.fetchMerchItems).toHaveBeenCalledTimes(1)
  })
})

describe('useMerchActions reorder', () => {
  it('applies the new order to the cache before the write resolves', async () => {
    let release = () => {}
    h.reorderMerchItems.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = () => resolve()
        }),
    )

    const { result, client } = renderHookWithClient(() => ({
      items: useMerchItems(),
      actions: useMerchActions(),
    }))
    await waitFor(() => expect(result.current.items.data).toBeDefined())

    void result.current.actions.reorderItems.mutateAsync({ orderedIds: [3, 1] })

    await waitFor(() =>
      expect(client.getQueryData<MerchItem[]>(merchKeys.items())?.map((i) => i.id)).toEqual([
        3, 1, 2,
      ]),
    )
    release()
  })

  it('rolls the cache back when the write fails', async () => {
    h.reorderMerchItems.mockRejectedValue(new Error('denied'))

    const { result, client } = renderHookWithClient(() => ({
      items: useMerchItems(),
      actions: useMerchActions(),
    }))
    await waitFor(() => expect(result.current.items.data).toBeDefined())

    await expect(
      result.current.actions.reorderItems.mutateAsync({ orderedIds: [3, 1] }),
    ).rejects.toThrow('denied')

    expect(client.getQueryData<MerchItem[]>(merchKeys.items())?.map((i) => i.id)).toEqual([1, 2, 3])
  })
})
