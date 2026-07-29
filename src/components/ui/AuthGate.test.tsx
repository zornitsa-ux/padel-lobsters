import { beforeEach, describe, expect, it, vi } from 'vitest'
import { propsOf } from '../../test/element'

const { mockUseApp } = vi.hoisted(() => ({ mockUseApp: vi.fn() }))
vi.mock('../../context/useApp', () => ({ useApp: mockUseApp }))

import { SignInBanner } from './AuthGate'

const sessionWithRole = (role?: string) => ({
  session: role ? { user: { app_metadata: { role } } } : null,
})

beforeEach(() => {
  mockUseApp.mockReturnValue(sessionWithRole())
})

describe('SignInBanner', () => {
  it('uses amber styling and admin copy for the admin role', () => {
    const el = SignInBanner({ role: 'admin' })
    expect(String(propsOf(el).className)).toContain('bg-amber-50')
    const [, body] = propsOf(el).children as unknown[]
    const [title, copy] = propsOf(body).children as unknown[]
    expect(propsOf(title).children).toBe('Admin sign-in required')
    expect(propsOf(copy).children).toBe('Sign in as admin from Settings → Account to manage this.')
  })

  it('uses teal styling and player copy for the player role', () => {
    const el = SignInBanner({ role: 'player' })
    expect(String(propsOf(el).className)).toContain('bg-lob-cream')
    const [, body] = propsOf(el).children as unknown[]
    const [title] = propsOf(body).children as unknown[]
    expect(propsOf(title).children).toBe('Verify your identity')
  })

  it('prefers the message override over the default copy', () => {
    const el = SignInBanner({ role: 'player', message: 'Custom' })
    const [, body] = propsOf(el).children as unknown[]
    const [, copy] = propsOf(body).children as unknown[]
    expect(propsOf(copy).children).toBe('Custom')
  })

  it('renders a slim row in compact mode and navigates to settings', () => {
    const onNavigate = vi.fn()
    const el = SignInBanner({ role: 'player', compact: true, onNavigate })
    expect(String(propsOf(el).className)).toContain('rounded-xl')
    const [, , button] = propsOf(el).children as unknown[]
    ;(propsOf(button).onClick as () => void)()
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })

  it('does not throw when no onNavigate is supplied', () => {
    const el = SignInBanner({ role: 'player', compact: true })
    const [, , button] = propsOf(el).children as unknown[]
    expect(() => (propsOf(button).onClick as () => void)()).not.toThrow()
  })
})
