// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({ useApp: vi.fn(), navigate: vi.fn() }))
vi.mock('../../context/useApp', () => ({ useApp: h.useApp }))
vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }))
vi.mock('../auth/pinSunset', () => ({ PIN_SUNSET_LABEL: '10 November' }))

import PinUpgradeCard from './PinUpgradeCard'
import { dismissUpgradeCard } from './upgradeCardDismissal'

const asUser = (user: { id: string; email: string } | null) =>
  h.useApp.mockReturnValue({ session: user ? { user } : null })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(cleanup)

describe('PinUpgradeCard', () => {
  it('renders nothing when signed out', () => {
    asUser(null)
    const { container } = render(<PinUpgradeCard />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the real-email variant with the sunset date and email', () => {
    asUser({ id: 'p1', email: 'ada@example.com' })
    render(<PinUpgradeCard />)
    expect(screen.getByText('Signing in is getting easier 🦞')).toBeTruthy()
    expect(screen.getByText(/PINs stop working on 10 November/)).toBeTruthy()
    expect(screen.getByText('ada@example.com')).toBeTruthy()
  })

  it('routes to Sign-in & security from the change and password buttons', () => {
    asUser({ id: 'p1', email: 'ada@example.com' })
    render(<PinUpgradeCard />)
    fireEvent.click(screen.getByText('Not right? Change it'))
    fireEvent.click(screen.getByText('Set a password (optional)'))
    expect(h.navigate).toHaveBeenCalledTimes(2)
    expect(h.navigate).toHaveBeenCalledWith('/account#sign-in-security')
  })

  it('stays dismissed per player after Got it', () => {
    asUser({ id: 'p1', email: 'ada@example.com' })
    const first = render(<PinUpgradeCard />)
    fireEvent.click(screen.getByText('Got it'))
    expect(screen.queryByText('Got it')).toBeNull()
    expect(localStorage.getItem('pl_upgrade_card_dismissed:p1')).toBe('1')
    first.unmount()

    render(<PinUpgradeCard />)
    expect(screen.queryByText('Got it')).toBeNull()

    cleanup()
    asUser({ id: 'p2', email: 'ben@example.com' })
    render(<PinUpgradeCard />)
    expect(screen.getByText('Got it')).toBeTruthy()
  })

  it('still renders and dismisses when storage throws', () => {
    asUser({ id: 'p1', email: 'ada@example.com' })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<PinUpgradeCard />)
    fireEvent.click(screen.getByText('Got it'))
    expect(screen.queryByText('Got it')).toBeNull()
    vi.restoreAllMocks()
  })

  it('shows the synthetic variant without a dismiss button or the address', () => {
    asUser({ id: 'p1', email: 'player-abc@padelobsters.internal' })
    render(<PinUpgradeCard />)
    expect(screen.getByText('Add your email so you can keep signing in')).toBeTruthy()
    expect(screen.getByText(/Message an admin on WhatsApp/)).toBeTruthy()
    expect(screen.queryByText('Got it')).toBeNull()
    expect(document.body.textContent).not.toContain('padelobsters.internal')
  })

  it('hides when dismissed elsewhere while mounted', () => {
    asUser({ id: 'p1', email: 'ada@example.com' })
    render(<PinUpgradeCard />)
    act(() => dismissUpgradeCard({ playerId: 'p1' }))
    expect(screen.queryByText('Got it')).toBeNull()
  })
})
