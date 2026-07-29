// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import AdminAlerts, { type NewMerchOrder } from './AdminAlerts'
import { mkRegistration } from '../../test/factories'

afterEach(cleanup)

const order = (id: number, over: Partial<NewMerchOrder> = {}): NewMerchOrder =>
  ({
    id,
    player_id: 'p1',
    merch_item_id: 1,
    playerId: 'p1',
    status: 'ordered',
    customName: '',
    playerName: 'Ada Lovelace',
    itemName: 'Cap',
    created_at: '2026-07-27T08:00:00Z',
    ...over,
  }) as NewMerchOrder

const renderAlerts = (over: Partial<React.ComponentProps<typeof AdminAlerts>> = {}) =>
  render(
    <AdminAlerts
      isAdmin
      unpaid={[]}
      upcomingEvent={undefined}
      players={[]}
      newOrders={[]}
      onDismissMerch={vi.fn()}
      formatUpdateTime={() => '2h ago'}
      onNavigate={vi.fn()}
      {...over}
    />,
  )

describe('AdminAlerts', () => {
  it('renders nothing for a non-admin, even with alerts to show', () => {
    const { container } = renderAlerts({
      isAdmin: false,
      unpaid: [mkRegistration({ id: 'r1' }), mkRegistration({ id: 'r2' })],
      newOrders: [order(1)],
    })
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing for an admin with nothing outstanding', () => {
    const { container } = renderAlerts()
    expect(container.innerHTML).toBe('')
  })

  it('shows the unpaid count', () => {
    renderAlerts({ unpaid: [mkRegistration({ id: 'r1' }), mkRegistration({ id: 'r2' })] })
    expect(screen.getByText(/2 players haven't paid yet/i)).toBeTruthy()
  })

  it('lists a player whose birthday is today', () => {
    const now = new Date()
    // Local noon, so re-parsing the ISO string lands on the same calendar day
    // in whatever timezone the suite runs in.
    const birthday = new Date(1990, now.getMonth(), now.getDate(), 12).toISOString()
    renderAlerts({ players: [{ id: 'p1', name: 'Ada Lovelace', birthday }] })
    expect(screen.getByText('Ada')).toBeTruthy()
    expect(screen.getByText(/today!/i)).toBeTruthy()
  })

  it('caps the merch list at five and counts the rest', () => {
    renderAlerts({ newOrders: Array.from({ length: 7 }, (_, i) => order(i + 1)) })
    expect(screen.getAllByText(/ordered/i).length).toBe(5)
    expect(screen.getByText('+2 more')).toBeTruthy()
  })

  it('dismisses and navigates from "View all"', () => {
    const onDismissMerch = vi.fn()
    const onNavigate = vi.fn()
    renderAlerts({ newOrders: [order(1)], onDismissMerch, onNavigate })
    fireEvent.click(screen.getByRole('button', { name: /view all/i }))
    expect(onDismissMerch).toHaveBeenCalledTimes(1)
    expect(onNavigate).toHaveBeenCalledWith('merch-orders')
  })
})
