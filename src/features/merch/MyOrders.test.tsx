// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { MerchInterest, MerchItem } from './merchSchemas'
import MyOrders from './MyOrders'

afterEach(cleanup)

const items = [
  { id: 1, name: 'Lobster Tee', images: [] },
  { id: 2, name: 'Lobster Cap', images: [] },
] as unknown as MerchItem[]

const order = (id: number, itemId: number, status: MerchInterest['status']) =>
  ({
    id,
    merch_item_id: itemId,
    status,
    customName: '',
    created_at: `2026-10-0${id}T10:00:00Z`,
  }) as MerchInterest

describe('MyOrders', () => {
  it('lists the orders newest first, one row each', () => {
    render(<MyOrders myOrders={[order(1, 1, 'paid'), order(2, 2, 'ordered')]} items={items} />)
    expect(
      screen.getAllByRole('listitem').map((row) => row.querySelector('p')?.textContent),
    ).toEqual(['Lobster Cap', 'Lobster Tee'])
  })

  it('says why a cancelled order was cancelled', () => {
    render(
      <MyOrders
        myOrders={[{ ...order(1, 1, 'cancelled'), admin_comment: 'Out of stock' }]}
        items={items}
      />,
    )
    expect(screen.getByText('Order cancelled by admin')).toBeTruthy()
    expect(screen.getByText('"Out of stock"')).toBeTruthy()
  })

  it('points to the shop when there are no orders', () => {
    render(<MyOrders myOrders={[]} items={items} />)
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText(/No orders yet/)).toBeTruthy()
  })
})
