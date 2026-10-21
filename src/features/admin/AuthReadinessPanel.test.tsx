// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'

const h = vi.hoisted(() => ({ fetchAuthReadiness: vi.fn() }))

vi.mock('./authReadiness', async (orig) => ({
  ...(await orig<typeof import('./authReadiness')>()),
  fetchAuthReadiness: h.fetchAuthReadiness,
}))
vi.mock('../auth/pinSunset', () => ({ PIN_SUNSET_LABEL: '10 November' }))

import AuthReadinessPanel from './AuthReadinessPanel'

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('AuthReadinessPanel', () => {
  it('shows the lists, counts and sunset date', async () => {
    h.fetchAuthReadiness.mockResolvedValue({
      no_email: [{ id: 'a', name: 'Ana Nomail' }],
      recent_pin_users: [{ id: 'b', name: 'Ben Pin', last_pin_at: new Date().toISOString() }],
      switched_count: 7,
      still_pin_count: 3,
    })
    renderWithClient(<AuthReadinessPanel />)
    expect(await screen.findByText('Ana Nomail')).toBeTruthy()
    expect(screen.getByText('No real email — contact these players')).toBeTruthy()
    expect(screen.getByText('Signed in with a PIN in the last 14 days')).toBeTruthy()
    expect(screen.getByText('Ben Pin')).toBeTruthy()
    expect(screen.getByText('today')).toBeTruthy()
    expect(screen.getByText('Switched to email: 7 · Still on PIN: 3')).toBeTruthy()
    expect(screen.getByText(/10 November/)).toBeTruthy()
  })

  it('hides empty lists', async () => {
    h.fetchAuthReadiness.mockResolvedValue({
      no_email: [],
      recent_pin_users: [],
      switched_count: 0,
      still_pin_count: 0,
    })
    renderWithClient(<AuthReadinessPanel />)
    expect(await screen.findByText('Switched to email: 0 · Still on PIN: 0')).toBeTruthy()
    expect(screen.queryByText('No real email — contact these players')).toBeNull()
  })

  it('shows a loading state, then an error', async () => {
    h.fetchAuthReadiness.mockRejectedValue(new Error('boom'))
    renderWithClient(<AuthReadinessPanel />)
    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(await screen.findByText('Could not load sign-in readiness.')).toBeTruthy()
  })
})
