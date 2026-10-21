// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({ useApp: vi.fn(), navigate: vi.fn() }))
vi.mock('../../context/useApp', () => ({ useApp: h.useApp }))
vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }))
vi.mock('./pinSunset', () => ({ PIN_SUNSET_LABEL: '10 November' }))

import PinSignInInterstitial from './PinSignInInterstitial'
import { hasPinSignIn, markPinSignIn } from './pinSignInFlag'

const signedInAs = (email: string | null) =>
  h.useApp.mockReturnValue({ session: email ? { user: { id: 'p1', email } } : null })

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})
afterEach(cleanup)

describe('PinSignInInterstitial', () => {
  it('stays hidden without a PIN sign-in', () => {
    signedInAs('ada@example.com')
    render(<PinSignInInterstitial />)
    expect(screen.queryByText('PINs stop working on 10 November')).toBeNull()
  })

  it('shows the email after a PIN sign-in and clears the flag on Got it', () => {
    signedInAs('ada@example.com')
    render(<PinSignInInterstitial />)
    act(() => markPinSignIn())
    expect(screen.getByText('PINs stop working on 10 November')).toBeTruthy()
    expect(screen.getByText('ada@example.com')).toBeTruthy()
    fireEvent.click(screen.getByText('Got it'))
    expect(screen.queryByText('PINs stop working on 10 November')).toBeNull()
    expect(hasPinSignIn()).toBe(false)
  })

  it('shows on mount when the flag is already set', () => {
    signedInAs('ada@example.com')
    sessionStorage.setItem('pl_pin_sign_in', '1')
    render(<PinSignInInterstitial />)
    expect(screen.getByText('Set a password now')).toBeTruthy()
  })

  it('routes to Sign-in & security from Set a password now', () => {
    signedInAs('ada@example.com')
    render(<PinSignInInterstitial />)
    act(() => markPinSignIn())
    fireEvent.click(screen.getByText('Set a password now'))
    expect(h.navigate).toHaveBeenCalledWith('/account#sign-in-security')
    expect(hasPinSignIn()).toBe(false)
  })

  it('asks synthetic accounts to message an admin, with no password button', () => {
    signedInAs('player-abc@padelobsters.internal')
    render(<PinSignInInterstitial />)
    act(() => markPinSignIn())
    expect(screen.getByText(/Message an admin on WhatsApp/)).toBeTruthy()
    expect(screen.queryByText('Set a password now')).toBeNull()
    expect(document.body.textContent).not.toContain('padelobsters.internal')
  })

  it('clears the flag on sign-out', () => {
    signedInAs('ada@example.com')
    const view = render(<PinSignInInterstitial />)
    act(() => markPinSignIn())
    signedInAs(null)
    view.rerender(<PinSignInInterstitial />)
    expect(hasPinSignIn()).toBe(false)
  })

  it('dismisses the upgrade card when a real-email interstitial closes', () => {
    signedInAs('ada@example.com')
    render(<PinSignInInterstitial />)
    act(() => markPinSignIn())
    fireEvent.click(screen.getByText('Got it'))
    expect(localStorage.getItem('pl_upgrade_card_dismissed:p1')).toBe('1')
  })

  it('leaves the synthetic upgrade card alone', () => {
    signedInAs('player-abc@padelobsters.internal')
    render(<PinSignInInterstitial />)
    act(() => markPinSignIn())
    fireEvent.click(screen.getByText('Got it'))
    expect(localStorage.getItem('pl_upgrade_card_dismissed:p1')).toBeNull()
  })
})
