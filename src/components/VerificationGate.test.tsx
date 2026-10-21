// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockUseApp, mockCheck, logout } = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  mockCheck: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('../context/useApp', () => ({ useApp: mockUseApp }))
vi.mock('../features/auth/useSessionCheck', () => ({ useSessionCheck: mockCheck }))
vi.mock('../features/auth/SignInForm', () => ({ default: () => <p>sign-in form</p> }))

import VerificationGate from './VerificationGate'

const renderGate = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <VerificationGate>
        <p>page content</p>
      </VerificationGate>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockUseApp.mockReturnValue({ role: 'player', session: {}, sessionSettled: true, logout })
  mockCheck.mockReturnValue({ status: 'complete' })
})
afterEach(cleanup)

describe('VerificationGate — session check', () => {
  it('renders nothing while the check is pending, even on a public path', () => {
    mockCheck.mockReturnValue({ status: 'pending' })
    const view = renderGate('/home')

    expect(view.container.innerHTML).toBe('')
  })

  it('shows only the panel for an incomplete session, on any route, and signs out', () => {
    mockCheck.mockReturnValue({ status: 'incomplete', reason: 'no_player' })
    renderGate('/home')

    expect(screen.getByText(/account isn.t fully set up/i)).toBeTruthy()
    expect(screen.queryByText('page content')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(logout).toHaveBeenCalled()
  })

  it('renders the page for a complete session', () => {
    renderGate('/events')

    expect(screen.getByText('page content')).toBeTruthy()
  })
})
