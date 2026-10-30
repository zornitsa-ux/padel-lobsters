// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Player } from '../../lib/normalise'
import type { MerchInterest, MerchItem } from './merchSchemas'

const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }
vi.mock('./useMerch', () => ({
  useMerchActions: () => ({ markOrder: mutation, cancelOrder: mutation }),
}))

import OrdersTable from './OrdersTable'

afterEach(cleanup)

const players = [{ id: 'p1', name: 'Ana Ruiz' }] as Player[]
const items = [{ id: 1, name: 'Shirt', price: 25 }] as MerchItem[]

const order = (id: number, status: MerchInterest['status']): MerchInterest =>
  ({
    id,
    merch_item_id: 1,
    status,
    customName: '',
    playerId: 'p1',
    created_at: '2026-10-01T10:00:00Z',
  }) as MerchInterest

const renderTable = (orders: MerchInterest[]) =>
  render(
    <OrdersTable
      activeOrders={orders.filter((o) => o.status !== 'cancelled')}
      interests={orders}
      items={items}
      players={players}
    />,
  )

describe('OrdersTable', () => {
  it('lists the open orders as one list', () => {
    renderTable([order(1, 'ordered'), order(2, 'paid')])
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Mark Paid' })).toBeTruthy()
  })

  it('keeps cancelled orders under a heading until shown', () => {
    renderTable([order(1, 'ordered'), order(2, 'cancelled')])
    expect(screen.getByRole('heading', { name: 'Cancelled (1)' })).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('still offers the cancelled orders when none are open', () => {
    renderTable([order(1, 'cancelled')])
    expect(screen.getByText(/No open orders/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cancelled (1)' })).toBeTruthy()
  })
})
