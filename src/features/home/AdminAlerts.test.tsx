// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import AdminAlerts from './AdminAlerts'
import { mkRegistration } from '../../test/factories'

afterEach(cleanup)

const renderAlerts = (over: Partial<React.ComponentProps<typeof AdminAlerts>> = {}) =>
  render(
    <AdminAlerts
      isAdmin
      unpaid={[]}
      upcomingEvent={undefined}
      players={[]}
      onNavigate={vi.fn()}
      {...over}
    />,
  )

describe('AdminAlerts', () => {
  it('renders nothing for a non-admin, even with alerts to show', () => {
    const { container } = renderAlerts({
      isAdmin: false,
      unpaid: [mkRegistration({ id: 'r1' }), mkRegistration({ id: 'r2' })],
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
})
