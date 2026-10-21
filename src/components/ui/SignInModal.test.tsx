// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockUseApp } = vi.hoisted(() => ({ mockUseApp: vi.fn() }))
vi.mock('../../context/useApp', () => ({ useApp: mockUseApp }))
vi.mock('../../features/auth/authActions', () => ({
  normaliseEmail: (email: string) => email,
  looksLikeEmail: () => true,
}))

import { SignInModal } from './AuthGate'

const renderModal = (props: Partial<Parameters<typeof SignInModal>[0]> = {}) =>
  render(
    <MemoryRouter>
      <SignInModal open {...props} />
    </MemoryRouter>,
  )

beforeEach(() => mockUseApp.mockReturnValue({ role: 'guest', loginWithPin: vi.fn() }))
afterEach(cleanup)

describe('SignInModal', () => {
  it('shows the sign-in form prefilled, without the PIN option', () => {
    renderModal({ initialEmail: 'ada@example.com' })

    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('ada@example.com')
    expect(screen.queryByText(/sign in with pin/i)).toBeNull()
  })

  it('renders nothing when closed', () => {
    const view = renderModal({ open: false })

    expect(view.container.innerHTML).toBe('')
  })

  it('closes itself once the session has a role', () => {
    mockUseApp.mockReturnValue({ role: 'player', loginWithPin: vi.fn() })
    const onClose = vi.fn()
    renderModal({ onClose })

    expect(onClose).toHaveBeenCalled()
  })
})
